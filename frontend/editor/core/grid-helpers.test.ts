import { describe, expect, test } from "bun:test";

import { Direction } from "../../game/engine/index.ts";
import {
  CellCode,
  cloneGrid,
  createGrid,
  gridsEqual,
  isGhost,
  isPlayer,
  parseAscii2d,
  serializeAscii2d,
  spawnDirection,
} from "./grid.ts";

describe("spawn helpers", () => {
  test("isPlayer / isGhost partition the spawn codes", () => {
    const players = [
      CellCode.PlayerUp,
      CellCode.PlayerRight,
      CellCode.PlayerDown,
      CellCode.PlayerLeft,
    ];
    const ghosts = [
      CellCode.GhostUp,
      CellCode.GhostRight,
      CellCode.GhostDown,
      CellCode.GhostLeft,
    ];
    for (const code of players) {
      expect(isPlayer(code)).toBe(true);
      expect(isGhost(code)).toBe(false);
    }
    for (const code of ghosts) {
      expect(isGhost(code)).toBe(true);
      expect(isPlayer(code)).toBe(false);
    }
    for (const code of [CellCode.Empty, CellCode.Wall, CellCode.Pellet, CellCode.PowerPellet]) {
      expect(isPlayer(code)).toBe(false);
      expect(isGhost(code)).toBe(false);
    }
  });

  test("spawnDirection matches the engine's Direction order", () => {
    expect(spawnDirection(CellCode.PlayerUp)).toBe(Direction.UP);
    expect(spawnDirection(CellCode.PlayerRight)).toBe(Direction.RIGHT);
    expect(spawnDirection(CellCode.GhostDown)).toBe(Direction.DOWN);
    expect(spawnDirection(CellCode.GhostLeft)).toBe(Direction.LEFT);
  });

  test("spawnDirection rejects non-spawn codes", () => {
    expect(() => spawnDirection(CellCode.Wall)).toThrow();
  });
});

describe("grid utilities", () => {
  test("cloneGrid copies cells, not the reference", () => {
    const grid = createGrid(2, 2);
    grid.cells[3] = CellCode.Wall;
    const copy = cloneGrid(grid);
    copy.cells[3] = CellCode.Empty;
    expect(grid.cells[3]).toBe(CellCode.Wall);
    expect(gridsEqual(grid, copy)).toBe(false);
  });

  test("gridsEqual rejects dimension mismatch even with equal bytes", () => {
    expect(gridsEqual(createGrid(2, 3), createGrid(3, 2))).toBe(false);
  });

  test("parse rejects an empty board", () => {
    expect(() => parseAscii2d("\n\n")).toThrow();
  });

  test("serialize ends every row with a newline pairable by the parser", () => {
    const grid = createGrid(3, 2);
    const text = serializeAscii2d(grid);
    expect(text.endsWith("\n")).toBe(true);
    expect(text.split("\n").filter((l) => l.length > 0).length).toBe(2);
  });
});
