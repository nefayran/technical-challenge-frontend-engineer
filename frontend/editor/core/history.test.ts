import { describe, expect, test } from "bun:test";

import { CellCode, createGrid } from "./grid.ts";
import { PatchBuilder, UndoStack, patchByteSize } from "./history.ts";

describe("PatchBuilder", () => {
  test("records before/after only for changed cells", () => {
    const grid = createGrid(4, 1);
    grid.cells[1] = CellCode.Wall;
    const builder = new PatchBuilder(grid);
    builder.set(0, CellCode.Wall);
    builder.set(1, CellCode.Wall); // no-op: already a wall
    const patch = builder.build()!;
    expect(Array.from(patch.indices)).toEqual([0]);
    expect(patch.before[0]).toBe(CellCode.Empty);
    expect(patch.after[0]).toBe(CellCode.Wall);
  });

  test("paint-then-revert collapses to a null patch", () => {
    const grid = createGrid(2, 1);
    const builder = new PatchBuilder(grid);
    builder.set(0, CellCode.Wall);
    builder.set(0, CellCode.Empty);
    expect(builder.build()).toBeNull();
    expect(grid.cells[0]).toBe(CellCode.Empty);
  });

  test("keeps the original before across repeated writes", () => {
    const grid = createGrid(1, 1);
    grid.cells[0] = CellCode.Pellet;
    const builder = new PatchBuilder(grid);
    builder.set(0, CellCode.Wall);
    builder.set(0, CellCode.PowerPellet);
    const patch = builder.build()!;
    expect(patch.before[0]).toBe(CellCode.Pellet);
    expect(patch.after[0]).toBe(CellCode.PowerPellet);
  });
});

describe("UndoStack byte budget", () => {
  test("evicts oldest patches but never the newest", () => {
    const grid = createGrid(1000, 1000);
    const stack = new UndoStack();
    const bigPatch = () => {
      const builder = new PatchBuilder(grid);
      for (let i = 0; i < 1_000_000; i++) {
        builder.set(i, grid.cells[i] === CellCode.Wall ? CellCode.Empty : CellCode.Wall);
      }
      return builder.build()!;
    };
    const patches = Array.from({ length: 12 }, bigPatch);
    let bytes = 0;
    for (const patch of patches) {
      stack.push(patch);
      bytes += patchByteSize(patch);
    }
    expect(bytes).toBeGreaterThan(64 * 1024 * 1024);
    let undos = 0;
    while (stack.undo(grid) !== null) {
      undos++;
    }
    expect(undos).toBeGreaterThanOrEqual(1);
    expect(undos).toBeLessThan(12);
  });

  test("clear drops both stacks", () => {
    const grid = createGrid(2, 1);
    const stack = new UndoStack();
    const builder = new PatchBuilder(grid);
    builder.set(0, CellCode.Wall);
    stack.push(builder.build()!);
    stack.undo(grid);
    stack.clear();
    expect(stack.canUndo).toBe(false);
    expect(stack.canRedo).toBe(false);
  });

  test("undo then redo restores after-state exactly", () => {
    const grid = createGrid(3, 1);
    const stack = new UndoStack();
    const builder = new PatchBuilder(grid);
    builder.set(0, CellCode.Wall);
    builder.set(2, CellCode.Pellet);
    stack.push(builder.build()!);
    stack.undo(grid);
    expect(Array.from(grid.cells)).toEqual([0, 0, 0]);
    stack.redo(grid);
    expect(grid.cells[0]).toBe(CellCode.Wall);
    expect(grid.cells[2]).toBe(CellCode.Pellet);
  });
});
