import { beforeEach, describe, expect, test } from "bun:test";

import { CONFIG } from "../config.ts";
import type { SyncState } from "../types.ts";
import { SyncController } from "./syncStore.ts";

// Real timers with tiny delays keep the controller code untouched.
(CONFIG.sync as { saveDebounceMs: number }).saveDebounceMs = 5;
(CONFIG.sync as { retryBaseMs: number }).retryBaseMs = 5;
(CONFIG.sync as { retryMaxMs: number }).retryMaxMs = 20;
// Keep the live-pull out of the way unless a test opts in.
(CONFIG.sync as { pollIntervalMs: number }).pollIntervalMs = 60_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type FetchCall = { url: string; body: unknown };

function installFetch(
  handler: (url: string, init?: RequestInit) => { status: number; json: unknown },
): FetchCall[] {
  const calls: FetchCall[] = [];
  globalThis.fetch = ((url: string, init?: RequestInit) => {
    const result = handler(String(url), init);
    calls.push({
      url: String(url),
      body: init?.body !== undefined ? JSON.parse(String(init.body)) : undefined,
    });
    if (result.status === -1) {
      return Promise.reject(new TypeError("network down"));
    }
    return Promise.resolve(
      new Response(JSON.stringify(result.json), { status: result.status }),
    );
  }) as typeof fetch;
  return calls;
}

function makeController(content: () => string, name = () => "lvl-name") {
  const states: SyncState[] = [];
  const versions: number[] = [];
  const conflicts: unknown[] = [];
  const updates: unknown[] = [];
  const controller = new SyncController("lvl", 1, content, name, {
    onStateChange: (s) => states.push(s),
    onVersionChange: (v) => versions.push(v),
    onConflict: (c) => conflicts.push(c),
    onRemoteUpdate: (u) => updates.push(u),
  });
  return { controller, states, versions, conflicts, updates };
}

let board = "AAAA";

beforeEach(() => {
  board = "AAAA";
});

describe("save cycle", () => {
  test("markDirty debounces into one store call and lands on synced", async () => {
    const calls = installFetch(() => ({
      status: 200,
      json: { id: "lvl", version: 2, ascii2d: board, name: "lvl-name" },
    }));
    const { controller, states } = makeController(() => board);
    controller.markDirty();
    controller.markDirty();
    controller.markDirty();
    await sleep(40);
    expect(calls.filter((c) => c.url.includes("/level/store")).length).toBe(1);
    expect(calls[0]!.body).toMatchObject({
      id: "lvl",
      base_version: 1,
      ascii2d: "AAAA",
      name: "lvl-name",
    });
    expect(states.at(-1)).toBe("synced");
    expect(controller.version).toBe(2);
    controller.dispose();
  });

  test("edits during an in-flight save trigger a follow-up save", async () => {
    let version = 1;
    const stores: Array<{ ascii2d: string }> = [];
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      const sent = JSON.parse(String(init?.body)) as { ascii2d: string };
      stores.push(sent);
      await sleep(20);
      version += 1;
      return new Response(
        JSON.stringify({ id: "lvl", version, ascii2d: sent.ascii2d, name: "n" }),
        { status: 200 },
      );
    }) as typeof fetch;

    const { controller, states } = makeController(() => board);
    controller.markDirty();
    await sleep(12); // debounce (5ms) fired, first save is now in flight
    board = "BBBB";
    controller.markDirty();
    await sleep(100);
    expect(stores.length).toBe(2);
    expect(stores.at(-1)!.ascii2d).toBe("BBBB");
    expect(states.at(-1)).toBe("synced");
    expect(controller.version).toBe(3);
    controller.dispose();
  });
});

describe("409 reconciliation", () => {
  test("lost response: server already holds what we sent -> adopt version silently", async () => {
    const calls = installFetch((url) => {
      if (url.includes("/level/store")) {
        return { status: 409, json: { detail: "stale" } };
      }
      return {
        status: 200,
        json: { id: "lvl", version: 5, ascii2d: board, name: "n" },
      };
    });
    const { controller, states, conflicts } = makeController(() => board);
    controller.markDirty();
    await sleep(40);
    expect(conflicts.length).toBe(0);
    expect(controller.version).toBe(5);
    expect(states.at(-1)).toBe("synced");
    expect(calls.some((c) => c.url.includes("/level/load"))).toBe(true);
    controller.dispose();
  });

  test("real conflict: differing server content -> conflict state + callback", async () => {
    installFetch((url) => {
      if (url.includes("/level/store")) {
        return { status: 409, json: { detail: "stale" } };
      }
      return {
        status: 200,
        json: { id: "lvl", version: 7, ascii2d: "ZZZZ", name: "n" },
      };
    });
    const { controller, states, conflicts } = makeController(() => board);
    controller.markDirty();
    await sleep(40);
    expect(conflicts.length).toBe(1);
    expect(states.at(-1)).toBe("conflict");
    expect(controller.version).toBe(1);
    controller.dispose();
  });

  test("keep mine rebases and resends against the server version", async () => {
    let storeCount = 0;
    installFetch((url, init) => {
      if (url.includes("/level/store")) {
        storeCount += 1;
        const sent = JSON.parse(String(init?.body)) as { base_version: number };
        if (sent.base_version === 1) {
          return { status: 409, json: { detail: "stale" } };
        }
        return { status: 200, json: { id: "lvl", version: 8, ascii2d: board, name: "n" } };
      }
      return { status: 200, json: { id: "lvl", version: 7, ascii2d: "ZZZZ", name: "n" } };
    });
    const { controller, states } = makeController(() => board);
    controller.markDirty();
    await sleep(40);
    controller.resolveKeepMine(7);
    await sleep(40);
    expect(storeCount).toBe(2);
    expect(controller.version).toBe(8);
    expect(states.at(-1)).toBe("synced");
    controller.dispose();
  });

  test("take theirs adopts the server version without a request", async () => {
    installFetch((url) => {
      if (url.includes("/level/store")) {
        return { status: 409, json: { detail: "stale" } };
      }
      return { status: 200, json: { id: "lvl", version: 7, ascii2d: "ZZZZ", name: "n" } };
    });
    const { controller, states } = makeController(() => board);
    controller.markDirty();
    await sleep(40);
    controller.resolveTakeTheirs(7);
    expect(controller.version).toBe(7);
    expect(states.at(-1)).toBe("synced");
    controller.dispose();
  });
});

describe("offline", () => {
  test("network failure -> offline, retry with backoff, recovery -> synced", async () => {
    let down = true;
    installFetch(() => {
      if (down) {
        return { status: -1, json: null };
      }
      return { status: 200, json: { id: "lvl", version: 2, ascii2d: board, name: "n" } };
    });
    const { controller, states } = makeController(() => board);
    controller.markDirty();
    await sleep(30);
    expect(states).toContain("offline");
    down = false;
    await sleep(80);
    expect(states.at(-1)).toBe("synced");
    expect(controller.version).toBe(2);
    controller.dispose();
  });

  test("markDirty during conflict does not schedule a save", async () => {
    const calls = installFetch((url) => {
      if (url.includes("/level/store")) {
        return { status: 409, json: { detail: "stale" } };
      }
      return { status: 200, json: { id: "lvl", version: 7, ascii2d: "ZZZZ", name: "n" } };
    });
    const { controller, states } = makeController(() => board);
    controller.markDirty();
    await sleep(40);
    const storesBefore = calls.filter((c) => c.url.includes("/level/store")).length;
    controller.markDirty();
    await sleep(40);
    const storesAfter = calls.filter((c) => c.url.includes("/level/store")).length;
    expect(storesAfter).toBe(storesBefore);
    expect(states.at(-1)).toBe("conflict");
    controller.dispose();
  });

  test("flushNow saves immediately from dirty", async () => {
    (CONFIG.sync as { saveDebounceMs: number }).saveDebounceMs = 500;
    const calls = installFetch(() => ({
      status: 200,
      json: { id: "lvl", version: 2, ascii2d: board, name: "n" },
    }));
    const { controller, states } = makeController(() => board);
    controller.markDirty();
    controller.flushNow();
    await sleep(30);
    (CONFIG.sync as { saveDebounceMs: number }).saveDebounceMs = 5;
    expect(calls.filter((c) => c.url.includes("/level/store")).length).toBe(1);
    expect(states.at(-1)).toBe("synced");
    expect(controller.currentState).toBe("synced");
    expect(controller.id).toBe("lvl");
    controller.dispose();
  });

  test("live pull adopts a newer server version while synced", async () => {
    (CONFIG.sync as { pollIntervalMs: number }).pollIntervalMs = 10;
    installFetch(() => ({
      status: 200,
      json: { id: "lvl", version: 9, ascii2d: "REMOTE", name: "renamed" },
    }));
    const { controller, updates, states } = makeController(() => board);
    await sleep(60);
    (CONFIG.sync as { pollIntervalMs: number }).pollIntervalMs = 60_000;
    expect(updates.length).toBeGreaterThanOrEqual(1);
    expect(controller.version).toBe(9);
    expect(states).not.toContain("conflict");
    controller.dispose();
  });

  test("live pull stays quiet while dirty", async () => {
    (CONFIG.sync as { pollIntervalMs: number }).pollIntervalMs = 10;
    (CONFIG.sync as { saveDebounceMs: number }).saveDebounceMs = 500;
    installFetch((url) => {
      if (url.includes("/level/store")) {
        return { status: 200, json: { id: "lvl", version: 2, ascii2d: board, name: "n" } };
      }
      return { status: 200, json: { id: "lvl", version: 9, ascii2d: "REMOTE", name: "n" } };
    });
    const { controller, updates } = makeController(() => board);
    controller.markDirty();
    await sleep(60);
    (CONFIG.sync as { pollIntervalMs: number }).pollIntervalMs = 60_000;
    (CONFIG.sync as { saveDebounceMs: number }).saveDebounceMs = 5;
    expect(updates.length).toBe(0);
    controller.dispose();
  });

  test("dispose cancels pending work", async () => {
    const calls = installFetch(() => ({
      status: 200,
      json: { id: "lvl", version: 2, ascii2d: board, name: "n" },
    }));
    const { controller } = makeController(() => board);
    controller.markDirty();
    controller.dispose();
    await sleep(30);
    expect(calls.length).toBe(0);
  });
});
