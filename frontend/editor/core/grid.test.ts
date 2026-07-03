import { describe, expect, test } from "bun:test";

import { CLASSIC, fromAscii2d, Block } from "../../game/engine/index.ts";
import {
  CellCode,
  countCells,
  createGrid,
  gridsEqual,
  parseAscii2d,
  serializeAscii2d,
} from "./grid.ts";

describe("parseAscii2d", () => {
  test("matches engine parse of CLASSIC cell by cell", () => {
    const grid = parseAscii2d(CLASSIC);
    const board = fromAscii2d(CLASSIC);
    expect(grid.width).toBe(board.width);
    expect(grid.height).toBe(board.height);
    for (let j = 0; j < board.height; j++) {
      for (let i = 0; i < board.width; i++) {
        const block = board.getBlock(i, j);
        const code = grid.cells[j * grid.width + i]!;
        switch (block.kind) {
          case Block.Empty:
            expect(code).toBe(CellCode.Empty);
            break;
          case Block.Wall:
            expect(code).toBe(CellCode.Wall);
            break;
          case Block.Pellet:
            expect(code).toBe(CellCode.Pellet);
            break;
          case Block.PowerPellet:
            expect(code).toBe(CellCode.PowerPellet);
            break;
          case Block.Player:
            expect(code).toBe(CellCode.PlayerUp + block.direction);
            break;
          case Block.Ghost:
            expect(code).toBe(CellCode.GhostUp + block.direction);
            break;
        }
      }
    }
  });

  test("pads ragged rows with Empty", () => {
    const grid = parseAscii2d("####\n##\n");
    expect(grid.width).toBe(2);
    expect(grid.height).toBe(2);
    expect(grid.cells[3]).toBe(CellCode.Empty);
  });

  test("rejects odd line length", () => {
    expect(() => parseAscii2d("###\n")).toThrow();
  });

  test("rejects unknown pair", () => {
    expect(() => parseAscii2d("XX\n")).toThrow();
  });
});

describe("serializeAscii2d", () => {
  test("round-trips CLASSIC through grid form", () => {
    const grid = parseAscii2d(CLASSIC);
    const text = serializeAscii2d(grid);
    expect(gridsEqual(parseAscii2d(text), grid)).toBe(true);
  });

  test("output parses in the game engine with entities intact", () => {
    const grid = parseAscii2d(CLASSIC);
    const board = fromAscii2d(serializeAscii2d(grid));
    let players = 0;
    let ghosts = 0;
    for (let j = 0; j < board.height; j++) {
      for (let i = 0; i < board.width; i++) {
        const kind = board.getBlock(i, j).kind;
        if (kind === Block.Player) players++;
        if (kind === Block.Ghost) ghosts++;
      }
    }
    const counts = countCells(grid);
    expect(players).toBe(counts.players);
    expect(ghosts).toBe(counts.ghosts);
    expect(players).toBeGreaterThan(0);
  });

  test("round-trips every cell code", () => {
    const grid = createGrid(12, 1);
    for (let code = 0; code < 12; code++) {
      grid.cells[code] = code;
    }
    expect(gridsEqual(parseAscii2d(serializeAscii2d(grid)), grid)).toBe(true);
  });
});
