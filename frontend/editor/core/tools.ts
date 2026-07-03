import { CellCode, type CellPoint, type LevelGrid, type Patch, type ToolKind, type ToolPreview } from "../types.ts";
import { PatchBuilder } from "./history.ts";

export type { ToolKind, ToolPreview };

// A stroke lives from pointer-down to pointer-up. Paint/erase/flood mutate the
// grid live and accumulate a diff; line/rect only preview until commit.
// move() returns the grid indices it touched so the caller can refresh the
// overview bitmap incrementally.
export interface ToolSession {
  move(cell: CellPoint): ArrayLike<number>;
  preview(): ToolPreview | null;
  commit(): Patch | null;
}

function index(grid: LevelGrid, i: number, j: number): number {
  return j * grid.width + i;
}

function inBounds(grid: LevelGrid, cell: CellPoint): boolean {
  return cell.i >= 0 && cell.i < grid.width && cell.j >= 0 && cell.j < grid.height;
}

function lineIndices(grid: LevelGrid, a: CellPoint, b: CellPoint): number[] {
  const result: number[] = [];
  let x0 = a.i;
  let y0 = a.j;
  const x1 = b.i;
  const y1 = b.j;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    if (x0 >= 0 && x0 < grid.width && y0 >= 0 && y0 < grid.height) {
      result.push(index(grid, x0, y0));
    }
    if (x0 === x1 && y0 === y1) {
      break;
    }
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
  return result;
}

function rectIndices(grid: LevelGrid, a: CellPoint, b: CellPoint, filled: boolean): number[] {
  const i0 = Math.max(0, Math.min(a.i, b.i));
  const i1 = Math.min(grid.width - 1, Math.max(a.i, b.i));
  const j0 = Math.max(0, Math.min(a.j, b.j));
  const j1 = Math.min(grid.height - 1, Math.max(a.j, b.j));
  const result: number[] = [];
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const onBorder = i === i0 || i === i1 || j === j0 || j === j1;
      if (filled || onBorder) {
        result.push(index(grid, i, j));
      }
    }
  }
  return result;
}

class BrushSession implements ToolSession {
  private readonly builder: PatchBuilder;
  private readonly grid: LevelGrid;
  private readonly code: CellCode;
  private last: CellPoint;

  constructor(grid: LevelGrid, start: CellPoint, code: CellCode) {
    this.grid = grid;
    this.code = code;
    this.builder = new PatchBuilder(grid);
    this.last = start;
    this.move(start);
  }

  move(cell: CellPoint): ArrayLike<number> {
    const touched = lineIndices(this.grid, this.last, cell);
    for (const idx of touched) {
      this.builder.set(idx, this.code);
    }
    this.last = cell;
    return touched;
  }

  preview(): ToolPreview | null {
    return null;
  }

  commit(): Patch | null {
    return this.builder.build();
  }
}

class ShapeSession implements ToolSession {
  private readonly grid: LevelGrid;
  private readonly code: CellCode;
  private readonly anchor: CellPoint;
  private readonly shape: "line" | "rect";
  private current: CellPoint;

  constructor(grid: LevelGrid, start: CellPoint, code: CellCode, shape: "line" | "rect") {
    this.grid = grid;
    this.code = code;
    this.anchor = start;
    this.current = start;
    this.shape = shape;
  }

  move(cell: CellPoint): ArrayLike<number> {
    this.current = cell;
    return [];
  }

  private indices(): number[] {
    if (this.shape === "line") {
      return lineIndices(this.grid, this.anchor, this.current);
    }
    return rectIndices(this.grid, this.anchor, this.current, false);
  }

  preview(): ToolPreview {
    return { indices: Uint32Array.from(this.indices()), code: this.code };
  }

  commit(): Patch | null {
    const builder = new PatchBuilder(this.grid);
    for (const idx of this.indices()) {
      builder.set(idx, this.code);
    }
    return builder.build();
  }
}

class FloodSession implements ToolSession {
  private readonly patch: Patch | null;

  constructor(grid: LevelGrid, start: CellPoint, code: CellCode) {
    this.patch = inBounds(grid, start) ? floodFill(grid, start, code) : null;
  }

  move(): ArrayLike<number> {
    return [];
  }

  preview(): ToolPreview | null {
    return null;
  }

  commit(): Patch | null {
    return this.patch;
  }
}

// Scanline flood fill over the byte array; visits each cell at most once, so
// filling the whole of a 1000x1000 board stays in the tens of milliseconds.
export function floodFill(grid: LevelGrid, start: CellPoint, code: CellCode): Patch | null {
  const { width, height, cells } = grid;
  const target = cells[index(grid, start.i, start.j)]!;
  if (target === code) {
    return null;
  }
  const builder = new PatchBuilder(grid);
  const stack: number[] = [index(grid, start.i, start.j)];
  while (stack.length > 0) {
    const idx = stack.pop()!;
    if (cells[idx] !== target) {
      continue;
    }
    const j = Math.floor(idx / width);
    const rowBase = j * width;
    let left = idx;
    while (left > rowBase && cells[left - 1] === target) {
      left--;
    }
    let right = idx;
    while (right < rowBase + width - 1 && cells[right + 1] === target) {
      right++;
    }
    for (let k = left; k <= right; k++) {
      builder.set(k, code);
      if (j > 0 && cells[k - width] === target) {
        stack.push(k - width);
      }
      if (j < height - 1 && cells[k + width] === target) {
        stack.push(k + width);
      }
    }
  }
  return builder.build();
}

export function startSession(
  tool: ToolKind,
  grid: LevelGrid,
  start: CellPoint,
  code: CellCode,
): ToolSession | null {
  switch (tool) {
    case "paint":
      return new BrushSession(grid, start, code);
    case "erase":
      return new BrushSession(grid, start, CellCode.Empty);
    case "line":
      return new ShapeSession(grid, start, code, "line");
    case "rect":
      return new ShapeSession(grid, start, code, "rect");
    case "flood":
      return new FloodSession(grid, start, code);
    case "pan":
      return null;
  }
}
