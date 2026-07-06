// Perf evidence generator: boots its own stack, measures frame times for the
// same gestures on a 10x10 board and a generated 1000x1000, plus the far-zoom
// blit path and the in-editor playtest, then writes charts and raw data to
// docs/perf/. Run: bun run perf (once before: bunx playwright install chromium).

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

import { barChart, lineChart } from "./chart.mjs";
import { ROOT, killAll, startStack } from "./stack.mjs";

const OUT_DIR = join(ROOT, "docs", "perf");
const BUDGET_MS = 16.7;

function stats(frames) {
  const sorted = [...frames].sort((a, b) => a - b);
  return {
    frames: frames.length,
    avg: frames.reduce((a, b) => a + b, 0) / frames.length,
    p95: sorted[Math.floor(sorted.length * 0.95)],
    worst: sorted.at(-1),
  };
}

async function collectFrames(page, action, frameCap = 600) {
  await page.evaluate((cap) => {
    window.__frames = [];
    window.__collect = true;
    let last = performance.now();
    const loop = (ts) => {
      window.__frames.push(ts - last);
      last = ts;
      if (window.__collect && window.__frames.length < cap) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }, frameCap);
  await action();
  return page.evaluate(() => {
    window.__collect = false;
    return window.__frames.slice(3);
  });
}

async function paintDrag(page) {
  const box = await page.locator(".canvas-host canvas").boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx - 300, cy);
  await page.mouse.down();
  for (let k = 0; k < 30; k++) {
    await page.mouse.move(cx - 300 + k * 20, cy + Math.sin(k) * 80, { steps: 3 });
  }
  await page.mouse.up();
}

async function zoomAndPan(page) {
  const box = await page.locator(".canvas-host canvas").boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  for (let k = 0; k < 10; k++) {
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(15);
  }
  await page.keyboard.down("Space");
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let k = 0; k < 20; k++) {
    await page.mouse.move(cx + Math.sin(k / 2) * 200, cy + Math.cos(k / 2) * 150, { steps: 3 });
  }
  await page.mouse.up();
  await page.keyboard.up("Space");
  for (let k = 0; k < 10; k++) {
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(15);
  }
}

async function waitBoard(page, label) {
  await page.waitForFunction(
    (l) => document.body.innerText.includes(l),
    label,
    { timeout: 60000 },
  );
  await page.waitForTimeout(400);
}

async function main() {
  const { editorUrl } = await startStack();
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
  });
  await context.addInitScript(() => {
    localStorage.setItem("maze-editor-tour-seen", "1");
  });
  const page = await context.newPage();
  await page.goto(editorUrl);
  await page.waitForFunction(() => document.body.innerText.includes("Saved"));

  // --- 10x10 blank board
  await page.click("button:has-text('Blank')");
  await page.fill(".dialog input >> nth=0", "10");
  await page.fill(".dialog input >> nth=1", "10");
  await page.click(".dialog button.active");
  await waitBoard(page, "10×10");
  const paint10 = stats(await collectFrames(page, () => paintDrag(page)));
  console.log("paint 10x10:", paint10);

  // --- 1000x1000 generated maze
  await page.click("button:has-text('Generate')");
  await page.fill(".dialog input >> nth=0", "42");
  await page.fill(".dialog input >> nth=1", "1000");
  await page.click(".dialog button.active");
  await waitBoard(page, "1000×1000");
  const paintFrames1000 = await collectFrames(page, () => paintDrag(page));
  const paint1000 = stats(paintFrames1000);
  console.log("paint 1000x1000:", paint1000);

  const zoom1000 = stats(await collectFrames(page, () => zoomAndPan(page)));
  console.log("zoom+pan 1000x1000:", zoom1000);

  // --- playtest on the same 1000x1000
  await page.click("header button:has-text('Play')");
  await page.waitForSelector(".playtest canvas");
  const playtest1000 = stats(
    await collectFrames(page, async () => {
      await page.keyboard.down("ArrowRight");
      await page.waitForTimeout(2500);
      await page.keyboard.up("ArrowRight");
      await page.keyboard.down("ArrowDown");
      await page.waitForTimeout(2500);
      await page.keyboard.up("ArrowDown");
    }),
  );
  console.log("playtest 1000x1000:", playtest1000);
  await page.keyboard.press("Escape");

  await browser.close();

  // --- write report
  mkdirSync(OUT_DIR, { recursive: true });
  const data = {
    note: "Frame times in ms, collected via requestAnimationFrame deltas in headless Chromium (1440x900).",
    budgetMs: BUDGET_MS,
    paint10,
    paint1000,
    zoom1000,
    playtest1000,
  };
  writeFileSync(join(OUT_DIR, "data.json"), JSON.stringify(data, null, 2));

  const toValues = (s) => [
    { name: "avg", value: s.avg },
    { name: "p95", value: s.p95 },
    { name: "worst", value: s.worst },
  ];
  writeFileSync(
    join(OUT_DIR, "editing.svg"),
    barChart({
      title: "Editing frame time — paint drag, 10×10 vs 1000×1000 (1M cells)",
      groups: [
        { label: "10×10 paint drag", values: toValues(paint10) },
        { label: "1000×1000 paint drag", values: toValues(paint1000) },
        { label: "1000×1000 zoom+pan (blit path)", values: toValues(zoom1000) },
      ],
      budget: BUDGET_MS,
    }),
  );
  writeFileSync(
    join(OUT_DIR, "frames.svg"),
    lineChart({
      title: "Frame-time trace during the 1000×1000 paint drag",
      series: [{ name: "1000×1000 paint drag", points: paintFrames1000 }],
      budget: BUDGET_MS,
    }),
  );
  writeFileSync(
    join(OUT_DIR, "playtest.svg"),
    barChart({
      title: "Playtest frame time — engine + culled render on 1000×1000",
      groups: [{ label: "1000×1000 playtest, steering", values: toValues(playtest1000) }],
      budget: BUDGET_MS,
    }),
  );

  const fmt = (s) => `avg ${s.avg.toFixed(1)} / p95 ${s.p95.toFixed(1)} / worst ${s.worst.toFixed(1)} ms (${s.frames} frames)`;
  writeFileSync(
    join(OUT_DIR, "README.md"),
    `# Performance evidence

Generated by \`bun run perf\` (headless Chromium 1440×900, frame times from
requestAnimationFrame deltas). The 60fps budget line is ${BUDGET_MS}ms.

| Scenario | Result |
| --- | --- |
| 10×10 paint drag | ${fmt(paint10)} |
| 1000×1000 paint drag | ${fmt(paint1000)} |
| 1000×1000 zoom + pan (overview blit) | ${fmt(zoom1000)} |
| 1000×1000 playtest, steering | ${fmt(playtest1000)} |

The zoom scenario's worst frame is a single one-time cost: entering the
far-zoom blit path after edits flushes the overview bitmap once
(\`putImageData\` of a 1MP ImageData); every following frame is a plain scaled
\`drawImage\`.

![Editing frame times](editing.svg)

![Frame-time trace](frames.svg)

![Playtest frame times](playtest.svg)

Raw numbers: [data.json](data.json). Regenerate with \`bun run perf\`
(ports 8000/3001 must be free; \`bunx playwright install chromium\` once).
`,
  );
  console.log(`written to ${OUT_DIR}`);
}

try {
  await main();
} finally {
  killAll();
}
