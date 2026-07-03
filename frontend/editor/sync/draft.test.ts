import { beforeEach, describe, expect, test } from "bun:test";

function installLocalStorage(): Map<string, string> {
  const store = new Map<string, string>();
  const stub = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, "localStorage", { value: stub, configurable: true });
  return store;
}

const store = installLocalStorage();
const { clearDraft, loadDraft, saveDraft } = await import("./draft.ts");
const { createGrid, CellCode } = await import("../core/grid.ts");

beforeEach(() => {
  store.clear();
});

describe("draft round-trip", () => {
  test("saves and restores cells exactly", () => {
    const grid = createGrid(5, 4);
    grid.cells[0] = CellCode.Wall;
    grid.cells[7] = CellCode.PlayerRight;
    grid.cells[19] = CellCode.PowerPellet;
    saveDraft("lvl", 3, grid);

    const loaded = loadDraft("lvl")!;
    expect(loaded.draft.levelId).toBe("lvl");
    expect(loaded.draft.baseVersion).toBe(3);
    expect(loaded.grid.width).toBe(5);
    expect(loaded.grid.height).toBe(4);
    expect(Array.from(loaded.grid.cells)).toEqual(Array.from(grid.cells));
  });

  test("survives a large grid through base64", () => {
    const grid = createGrid(200, 200);
    for (let i = 0; i < grid.cells.length; i += 7) {
      grid.cells[i] = (i % 11) as CellCode;
    }
    saveDraft("big", 1, grid);
    const loaded = loadDraft("big")!;
    expect(Array.from(loaded.grid.cells)).toEqual(Array.from(grid.cells));
  });

  test("missing draft returns null", () => {
    expect(loadDraft("nope")).toBeNull();
  });

  test("corrupt JSON returns null", () => {
    store.set("maze-editor-draft:bad", "{not json");
    expect(loadDraft("bad")).toBeNull();
  });

  test("size mismatch returns null", () => {
    const grid = createGrid(2, 2);
    saveDraft("mismatch", 1, grid);
    const raw = JSON.parse(store.get("maze-editor-draft:mismatch")!);
    raw.width = 99;
    store.set("maze-editor-draft:mismatch", JSON.stringify(raw));
    expect(loadDraft("mismatch")).toBeNull();
  });

  test("clearDraft removes only its level", () => {
    saveDraft("a", 1, createGrid(2, 2));
    saveDraft("b", 1, createGrid(2, 2));
    clearDraft("a");
    expect(loadDraft("a")).toBeNull();
    expect(loadDraft("b")).not.toBeNull();
  });
});
