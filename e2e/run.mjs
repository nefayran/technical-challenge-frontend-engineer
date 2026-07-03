// E2E harness: starts its own backend (with a throwaway levels DB) and editor
// server, drives a real Chromium through the four scenarios, then tears
// everything down. Requires ports 8000 and 3001 to be free.
//
//   bunx playwright install chromium   (once)
//   bun run e2e
//
// The backend port is fixed at 8000 because the editor's apiBase points there.

import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

import editorBasics from "./scenarios/editor-basics.mjs";
import perf1000 from "./scenarios/perf-1000.mjs";
import conflict409 from "./scenarios/conflict-409.mjs";
import offlineDraft from "./scenarios/offline-draft.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BACKEND_URL = "http://127.0.0.1:8000";
const EDITOR_URL = "http://localhost:3001";
const DB_PATH = join(mkdtempSync(join(tmpdir(), "maze-e2e-")), "levels.json");

const children = new Set();

// Children run in their own process group so a kill reaches the whole tree —
// `uv run backend` wraps a uvicorn reloader that spawns the actual server.
function spawnChild(command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    cwd: ROOT,
    env: { ...process.env, ...extraEnv },
    stdio: "ignore",
    detached: true,
  });
  children.add(child);
  child.on("exit", () => children.delete(child));
  return child;
}

function killTree(child) {
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    child.kill("SIGKILL");
  }
}

async function waitFor(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function assertPortFree(url, label) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(1000) });
  } catch {
    return;
  }
  throw new Error(`${label} already responds at ${url} — stop it before running e2e.`);
}

function startBackend() {
  return spawnChild("uv", ["run", "backend"], { LEVELS_DB_PATH: DB_PATH });
}

let backendChild = null;

const backend = {
  url: BACKEND_URL,
  async stop() {
    if (backendChild !== null) {
      killTree(backendChild);
      backendChild = null;
      await new Promise((r) => setTimeout(r, 300));
    }
  },
  async start() {
    backendChild = startBackend();
    await waitFor(`${BACKEND_URL}/levels`);
  },
};

async function main() {
  await assertPortFree(`${BACKEND_URL}/levels`, "A backend");
  await assertPortFree(EDITOR_URL, "An editor server");

  await backend.start();
  spawnChild("bun", ["frontend/editor/serve.ts"], { PORT: "3001" });
  await waitFor(EDITOR_URL);

  const browser = await chromium.launch();
  const scenarios = [
    ["editor-basics", editorBasics],
    ["perf-1000", perf1000],
    ["conflict-409", conflict409],
    ["offline-draft", offlineDraft],
  ];

  let failed = 0;
  for (const [name, scenario] of scenarios) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: "dark",
    });
    const started = Date.now();
    try {
      await scenario({ context, editorUrl: EDITOR_URL, backend });
      console.log(`PASS ${name} (${Date.now() - started}ms)`);
    } catch (error) {
      failed += 1;
      console.error(`FAIL ${name}: ${error.message}`);
    } finally {
      await context.close();
      if (backendChild === null) {
        await backend.start();
      }
    }
  }

  await browser.close();
  process.exitCode = failed === 0 ? 0 : 1;
}

try {
  await main();
} finally {
  for (const child of children) {
    killTree(child);
  }
}
