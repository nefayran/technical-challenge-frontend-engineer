import { describe, expect, test } from "bun:test";

import { CellCode, createGrid } from "./grid.ts";
import { UndoStack } from "./history.ts";
import { floodFill, startSession } from "./tools.ts";

describe("brush", () => {
  test("connects drag samples with a line", () => {
    const grid = createGrid(10, 10);
    const session = startSession("paint", grid, { i: 0, j: 0 }, CellCode.Wall)!;
    session.move({ i: 9, j: 9 });
    const patch = session.commit();
    expect(patch).not.toBeNull();
    expect(patch!.indices.length).toBe(10);
    expect(grid.cells[0]).toBe(CellCode.Wall);
    expect(grid.cells[99]).toBe(CellCode.Wall);
    expect(grid.cells[5 * 10 + 5]).toBe(CellCode.Wall);
  });

  test("ignores out-of-bounds drag", () => {
    const grid = createGrid(4, 4);
    const session = startSession("paint", grid, { i: 1, j: 1 }, CellCode.Wall)!;
    session.move({ i: -5, j: 1 });
    const patch = session.commit()!;
    for (let k = 0; k < patch.indices.length; k++) {
      expect(patch.indices[k]!).toBeLessThan(16);
    }
  });

  test("no-op stroke commits null", () => {
    const grid = createGrid(4, 4);
    grid.cells[5] = CellCode.Wall;
    const session = startSession("paint", grid, { i: 1, j: 1 }, CellCode.Wall)!;
    expect(session.commit()).toBeNull();
  });
});

describe("shapes", () => {
  test("rect draws outline only", () => {
    const grid = createGrid(6, 6);
    const session = startSession("rect", grid, { i: 1, j: 1 }, CellCode.Wall)!;
    session.move({ i: 4, j: 4 });
    expect(grid.cells.every((c) => c === CellCode.Empty)).toBe(true);
    const patch = session.commit()!;
    expect(patch.indices.length).toBe(12);
    expect(grid.cells[1 * 6 + 1]).toBe(CellCode.Wall);
    expect(grid.cells[2 * 6 + 2]).toBe(CellCode.Empty);
  });

  test("line previews without mutating until commit", () => {
    const grid = createGrid(6, 1);
    const session = startSession("line", grid, { i: 0, j: 0 }, CellCode.Pellet)!;
    session.move({ i: 5, j: 0 });
    expect(session.preview()!.indices.length).toBe(6);
    expect(grid.cells[3]).toBe(CellCode.Empty);
    session.commit();
    expect(grid.cells[3]).toBe(CellCode.Pellet);
  });
});

describe("floodFill", () => {
  test("fills enclosed region only", () => {
    const grid = createGrid(5, 5);
    for (let i = 0; i < 5; i++) {
      grid.cells[2 * 5 + i] = CellCode.Wall;
    }
    const patch = floodFill(grid, { i: 0, j: 0 }, CellCode.Pellet)!;
    expect(patch.indices.length).toBe(10);
    expect(grid.cells[0]).toBe(CellCode.Pellet);
    expect(grid.cells[4 * 5]).toBe(CellCode.Empty);
  });

  test("fill with same code is a no-op", () => {
    const grid = createGrid(3, 3);
    expect(floodFill(grid, { i: 1, j: 1 }, CellCode.Empty)).toBeNull();
  });

  test("fills 1000x1000 fast", () => {
    const grid = createGrid(1000, 1000);
    const start = performance.now();
    const patch = floodFill(grid, { i: 500, j: 500 }, CellCode.Wall)!;
    const elapsed = performance.now() - start;
    expect(patch.indices.length).toBe(1_000_000);
    expect(elapsed).toBeLessThan(500);
  });
});

describe("UndoStack", () => {
  test("undo/redo restore cell states", () => {
    const grid = createGrid(4, 1);
    const stack = new UndoStack();
    const session = startSession("paint", grid, { i: 0, j: 0 }, CellCode.Wall)!;
    session.move({ i: 3, j: 0 });
    stack.push(session.commit()!);

    expect(grid.cells[2]).toBe(CellCode.Wall);
    stack.undo(grid);
    expect(grid.cells[2]).toBe(CellCode.Empty);
    expect(stack.canRedo).toBe(true);
    stack.redo(grid);
    expect(grid.cells[2]).toBe(CellCode.Wall);
  });

  test("new stroke clears redo", () => {
    const grid = createGrid(2, 1);
    const stack = new UndoStack();
    const s1 = startSession("paint", grid, { i: 0, j: 0 }, CellCode.Wall)!;
    stack.push(s1.commit()!);
    stack.undo(grid);
    const s2 = startSession("paint", grid, { i: 1, j: 0 }, CellCode.Pellet)!;
    stack.push(s2.commit()!);
    expect(stack.canRedo).toBe(false);
  });
});
