// Editor-side cell model: one byte per cell instead of the engine's BlockValue
// objects, so a 1000x1000 board is a single 1MB Uint8Array.
//
// The engine's toAscii2d() serializes walls only, so the editor has its own
// lossless codec. Parsing mirrors engine/ascii2d.ts semantics exactly: leading
// newline stripped, blank lines dropped, width = longest line / 2, short rows
// padded with Empty.

import { Direction } from "../../game/engine/index.ts";
import { CellCode, type LevelGrid } from "../types.ts";

export { CellCode };
export type { LevelGrid };

export const PLAYER_BASE = CellCode.PlayerUp;
export const GHOST_BASE = CellCode.GhostUp;

export function isPlayer(code: CellCode): boolean {
  return code >= CellCode.PlayerUp && code <= CellCode.PlayerLeft;
}

export function isGhost(code: CellCode): boolean {
  return code >= CellCode.GhostUp && code <= CellCode.GhostLeft;
}

export function spawnDirection(code: CellCode): Direction {
  if (isPlayer(code)) {
    return (code - PLAYER_BASE) as Direction;
  }
  if (isGhost(code)) {
    return (code - GHOST_BASE) as Direction;
  }
  throw new Error(`Not a spawn code: ${code}`);
}

export function createGrid(width: number, height: number): LevelGrid {
  return { width, height, cells: new Uint8Array(width * height) };
}

export function cloneGrid(grid: LevelGrid): LevelGrid {
  return {
    width: grid.width,
    height: grid.height,
    cells: grid.cells.slice(),
  };
}

export function gridsEqual(a: LevelGrid, b: LevelGrid): boolean {
  if (a.width !== b.width || a.height !== b.height) {
    return false;
  }
  const ac = a.cells;
  const bc = b.cells;
  for (let i = 0; i < ac.length; i++) {
    if (ac[i] !== bc[i]) {
      return false;
    }
  }
  return true;
}

const DIR_CHARS = ["U", "R", "D", "L"] as const;

const CODE_TO_PAIR: readonly string[] = [
  "  ",
  "##",
  ". ",
  "O ",
  ...DIR_CHARS.map((d) => `P${d}`),
  ...DIR_CHARS.map((d) => `G${d}`),
];

function dirFromChar(char: string, lineIndex: number): number {
  const dir = DIR_CHARS.indexOf(char as (typeof DIR_CHARS)[number]);
  if (dir === -1) {
    throw new Error(`Bad direction char ${char!} at line ${lineIndex}`);
  }
  return dir;
}

function codeFromPair(first: string, second: string, lineIndex: number): CellCode {
  if (first === " " && second === " ") {
    return CellCode.Empty;
  }
  if (first === "#" && second === "#") {
    return CellCode.Wall;
  }
  if (first === "." && second === " ") {
    return CellCode.Pellet;
  }
  if (first === "O" && second === " ") {
    return CellCode.PowerPellet;
  }
  if (first === "P") {
    return PLAYER_BASE + dirFromChar(second, lineIndex);
  }
  if (first === "G") {
    return GHOST_BASE + dirFromChar(second, lineIndex);
  }
  throw new Error(`Bad block (${first}, ${second}) at line ${lineIndex}`);
}

export function parseAscii2d(text: string): LevelGrid {
  const trimmed = text.replace(/^\n/, "");
  const lines = trimmed.split("\n").filter((line) => line.length > 0);
  if (lines.length === 0) {
    throw new Error("Empty board");
  }

  const maxLineLen = Math.max(...lines.map((line) => line.length));
  if (maxLineLen % 2 !== 0) {
    throw new Error("Bad line length");
  }
  const width = maxLineLen / 2;
  const height = lines.length;
  const cells = new Uint8Array(width * height);

  for (let j = 0; j < height; j++) {
    const line = lines[j]!;
    if (line.length % 2 !== 0) {
      throw new Error(`Blocks should be in pairs at line ${j}`);
    }
    const rowBase = j * width;
    for (let k = 0; k + 1 < line.length; k += 2) {
      cells[rowBase + k / 2] = codeFromPair(line[k]!, line[k + 1]!, j);
    }
  }

  return { width, height, cells };
}

export function serializeAscii2d(grid: LevelGrid): string {
  const { width, height, cells } = grid;
  const rows: string[] = new Array(height);
  const rowPairs: string[] = new Array(width);
  for (let j = 0; j < height; j++) {
    const rowBase = j * width;
    for (let i = 0; i < width; i++) {
      rowPairs[i] = CODE_TO_PAIR[cells[rowBase + i]!]!;
    }
    rows[j] = rowPairs.join("");
  }
  return rows.join("\n") + "\n";
}

export function countCells(grid: LevelGrid): {
  walls: number;
  pellets: number;
  powerPellets: number;
  players: number;
  ghosts: number;
} {
  let walls = 0;
  let pellets = 0;
  let powerPellets = 0;
  let players = 0;
  let ghosts = 0;
  const cells = grid.cells;
  for (let i = 0; i < cells.length; i++) {
    const code = cells[i]!;
    if (code === CellCode.Wall) {
      walls++;
    } else if (code === CellCode.Pellet) {
      pellets++;
    } else if (code === CellCode.PowerPellet) {
      powerPellets++;
    } else if (code >= PLAYER_BASE && code <= CellCode.PlayerLeft) {
      players++;
    } else if (code >= GHOST_BASE && code <= CellCode.GhostLeft) {
      ghosts++;
    }
  }
  return { walls, pellets, powerPellets, players, ghosts };
}
