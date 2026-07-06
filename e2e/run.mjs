// E2E harness: starts its own backend (with a throwaway levels DB) and editor
// server, drives a real Chromium through the scenarios, then tears everything
// down. Requires ports 8000 and 3001 to be free.
//
//   bunx playwright install chromium   (once)
//   bun run e2e
//
// The backend port is fixed at 8000 because the editor's apiBase points there.

import { chromium } from "playwright";

import { killAll, startStack } from "./stack.mjs";
import editorBasics from "./scenarios/editor-basics.mjs";
import perf1000 from "./scenarios/perf-1000.mjs";
import conflict409 from "./scenarios/conflict-409.mjs";
import liveUpdate from "./scenarios/live-update.mjs";
import offlineDraft from "./scenarios/offline-draft.mjs";

async function main() {
  const { backend, editorUrl } = await startStack();

  const browser = await chromium.launch();
  const scenarios = [
    ["editor-basics", editorBasics],
    ["perf-1000", perf1000],
    ["conflict-409", conflict409],
    ["live-update", liveUpdate],
    ["offline-draft", offlineDraft],
  ];

  let failed = 0;
  for (const [name, scenario] of scenarios) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: "dark",
    });
    // The onboarding tour auto-opens for first-time visitors and its overlay
    // would swallow the scripted mouse input.
    await context.addInitScript(() => {
      localStorage.setItem("maze-editor-tour-seen", "1");
    });
    const started = Date.now();
    try {
      await scenario({ context, editorUrl, backend });
      console.log(`PASS ${name} (${Date.now() - started}ms)`);
    } catch (error) {
      failed += 1;
      console.error(`FAIL ${name}: ${error.message}`);
    } finally {
      await context.close();
      await backend.start().catch(() => {});
    }
  }

  await browser.close();
  process.exitCode = failed === 0 ? 0 : 1;
}

try {
  await main();
} finally {
  killAll();
}
