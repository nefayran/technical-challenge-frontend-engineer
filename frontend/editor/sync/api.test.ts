import { describe, expect, test } from "bun:test";

import { ApiError, generateLevel, listLevels, loadLevel, storeLevel } from "./api.ts";

function respond(handler: (url: string, init?: RequestInit) => Response): void {
  globalThis.fetch = ((url: string, init?: RequestInit) =>
    Promise.resolve(handler(String(url), init))) as typeof fetch;
}

describe("api wrappers", () => {
  test("loadLevel encodes the id and parses the response", async () => {
    let seen = "";
    respond((url) => {
      seen = url;
      return new Response(
        JSON.stringify({ id: "a b", version: 1, ascii2d: "##\n", name: "x" }),
        { status: 200 },
      );
    });
    const level = await loadLevel("a b");
    expect(seen).toContain("/level/load?id=a%20b");
    expect(level.version).toBe(1);
  });

  test("storeLevel posts JSON body", async () => {
    let body: unknown;
    respond((_url, init) => {
      body = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({ id: "n", version: 1, ascii2d: "##\n", name: "" }),
        { status: 200 },
      );
    });
    await storeLevel({ ascii2d: "##\n", name: "hello" });
    expect(body).toMatchObject({ ascii2d: "##\n", name: "hello" });
  });

  test("generateLevel and listLevels hit their endpoints", async () => {
    const urls: string[] = [];
    respond((url) => {
      urls.push(url);
      if (url.includes("generate")) {
        return new Response(JSON.stringify({ seed: 1, size: 15, ascii2d: "##\n" }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify([{ id: "a", name: "" }]), { status: 200 });
    });
    await generateLevel(1, 15);
    const levels = await listLevels();
    expect(urls[0]).toContain("/level/generate");
    expect(urls[1]).toContain("/levels");
    expect(levels[0]!.id).toBe("a");
  });

  test("error responses become ApiError with the detail string", async () => {
    respond(() => new Response(JSON.stringify({ detail: "stale write" }), { status: 409 }));
    try {
      await loadLevel("x");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(409);
      expect((error as ApiError).detail).toBe("stale write");
    }
  });

  test("non-JSON error bodies fall back to statusText", async () => {
    respond(() => new Response("<html>oops</html>", { status: 500, statusText: "Server Error" }));
    try {
      await loadLevel("x");
      expect.unreachable();
    } catch (error) {
      expect((error as ApiError).detail).toBe("Server Error");
    }
  });
});
