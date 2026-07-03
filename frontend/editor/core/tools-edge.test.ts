import { describe, expect, test } from "bun:test";

import { CellCode, createGrid } from "./grid.ts";
import { startSession } from "./tools.ts";

describe("tool sessions, edge cases", () => {
  test("pan produces no session", () => {
    const grid = createGrid(4, 4);
    expect(startSession("pan", grid, { i: 0, j: 0 }, CellCode.Wall)).toBeNull();
  });

  test("brush preview is null (live painting needs no overlay)", () => {
    const grid = createGrid(4, 4);
    const session = startSession("paint", grid, { i: 1, j: 1 }, CellCode.Wall)!;
    expect(session.preview()).toBeNull();
    session.commit();
  });

  test("flood on an out-of-bounds start is a no-op", () => {
    const grid = createGrid(4, 4);
    const session = startSession("flood", grid, { i: -1, j: 99 }, CellCode.Wall)!;
    expect(session.move({ i: 0, j: 0 }).length).toBe(0);
    expect(session.commit()).toBeNull();
    expect(grid.cells.every((c) => c === CellCode.Empty)).toBe(true);
  });

  test("flood preview is null and move is inert", () => {
    const grid = createGrid(3, 3);
    const session = startSession("flood", grid, { i: 1, j: 1 }, CellCode.Pellet)!;
    expect(session.preview()).toBeNull();
    expect(session.move({ i: 2, j: 2 }).length).toBe(0);
    const patch = session.commit()!;
    expect(patch.indices.length).toBe(9);
  });

  test("rect collapsed to a single cell paints exactly one", () => {
    const grid = createGrid(5, 5);
    const session = startSession("rect", grid, { i: 2, j: 2 }, CellCode.Wall)!;
    const patch = session.commit()!;
    expect(patch.indices.length).toBe(1);
    expect(grid.cells[2 * 5 + 2]).toBe(CellCode.Wall);
  });
});
