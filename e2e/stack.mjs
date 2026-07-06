// Shared harness plumbing: spawn the backend (throwaway levels DB) and the
// editor server as process-group children, wait for health, kill trees.

import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const BACKEND_URL = "http://127.0.0.1:8000";
export const EDITOR_URL = "http://localhost:3001";

const children = new Set();

// Children get their own process group so a kill reaches the whole tree —
// `uv run backend` wraps a uvicorn reloader that spawns the actual server.
export function spawnChild(command, args, extraEnv = {}) {
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

export function killTree(child) {
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    child.kill("SIGKILL");
  }
}

export function killAll() {
  for (const child of children) {
    killTree(child);
  }
}

export async function waitFor(url, timeoutMs = 15000) {
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

export async function assertPortFree(url, label) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(1000) });
  } catch {
    return;
  }
  throw new Error(`${label} already responds at ${url} — stop it before running.`);
}

export async function startStack() {
  await assertPortFree(`${BACKEND_URL}/levels`, "A backend");
  await assertPortFree(EDITOR_URL, "An editor server");

  const dbPath = join(mkdtempSync(join(tmpdir(), "maze-e2e-")), "levels.json");
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
      if (backendChild !== null) {
        return;
      }
      backendChild = spawnChild("uv", ["run", "backend"], { LEVELS_DB_PATH: dbPath });
      await waitFor(`${BACKEND_URL}/levels`);
    },
  };

  await backend.start();
  spawnChild("bun", ["frontend/editor/serve.ts"], { PORT: "3001" });
  await waitFor(EDITOR_URL);

  return { backend, editorUrl: EDITOR_URL };
}
