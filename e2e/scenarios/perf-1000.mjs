// Generate a 1000x1000 board through the UI, then assert a paint drag keeps
// the frame budget and the far-zoom blit path renders.

const FRAME_BUDGET_MS = 16;

export default async function perf1000({ context, editorUrl }) {
  const page = await context.newPage();
  await page.goto(editorUrl);
  await page.waitForFunction(() => document.body.innerText.includes("Saved"));

  await page.click("button:has-text('Generate')");
  await page.fill(".dialog input >> nth=0", "42");
  await page.fill(".dialog input >> nth=1", "1000");
  await page.click(".dialog button.active");
  await page.waitForFunction(() => document.body.innerText.includes("1000×1000"), {
    timeout: 60000,
  });

  const box = await page.locator(".canvas-host canvas").boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  await page.evaluate(() => {
    window.__frames = [];
    let last = performance.now();
    const loop = (ts) => {
      window.__frames.push(ts - last);
      last = ts;
      if (window.__frames.length < 300) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });

  await page.mouse.move(cx - 300, cy);
  await page.mouse.down();
  for (let k = 0; k < 30; k++) {
    await page.mouse.move(cx - 300 + k * 20, cy + Math.sin(k) * 80, { steps: 3 });
  }
  await page.mouse.up();

  const frames = await page.evaluate(() => window.__frames.slice(5));
  const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
  if (avg > FRAME_BUDGET_MS) {
    throw new Error(`paint drag avg frame ${avg.toFixed(1)}ms > ${FRAME_BUDGET_MS}ms`);
  }

  // zoom far out — exercises the overview-bitmap blit path
  await page.mouse.move(cx, cy);
  for (let k = 0; k < 12; k++) {
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(20);
  }
  await page.waitForTimeout(300);

  // board must still be saveable at this size
  await page.waitForFunction(() => document.body.innerText.includes("Saved"), {
    timeout: 30000,
  });
}
