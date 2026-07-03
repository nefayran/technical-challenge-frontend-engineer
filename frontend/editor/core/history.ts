// Undo history as sparse cell diffs: a patch stores only the touched indices
// with their before/after bytes, so memory cost tracks edit size, not board
// size (a full 1000x1000 snapshot per stroke would be 1MB each).

import { CONFIG } from "../config.ts";
import type { LevelGrid, Patch } from "../types.ts";

export type { Patch };

export function patchByteSize(patch: Patch): number {
  return patch.indices.length * 6;
}

export class PatchBuilder {
  private readonly touched = new Map<number, number>();
  private readonly grid: LevelGrid;

  constructor(grid: LevelGrid) {
    this.grid = grid;
  }

  set(index: number, code: number): void {
    const cells = this.grid.cells;
    const current = cells[index]!;
    if (current === code) {
      return;
    }
    if (!this.touched.has(index)) {
      this.touched.set(index, current);
    }
    cells[index] = code;
  }

  get size(): number {
    return this.touched.size;
  }

  build(): Patch | null {
    const entries: Array<[number, number]> = [];
    const cells = this.grid.cells;
    for (const [index, before] of this.touched) {
      if (cells[index] !== before) {
        entries.push([index, before]);
      }
    }
    if (entries.length === 0) {
      return null;
    }
    const indices = new Uint32Array(entries.length);
    const before = new Uint8Array(entries.length);
    const after = new Uint8Array(entries.length);
    for (let k = 0; k < entries.length; k++) {
      const [index, prev] = entries[k]!;
      indices[k] = index;
      before[k] = prev;
      after[k] = cells[index]!;
    }
    return { indices, before, after };
  }
}

export class UndoStack {
  private readonly undoStack: Patch[] = [];
  private readonly redoStack: Patch[] = [];
  private bytes = 0;

  push(patch: Patch): void {
    this.undoStack.push(patch);
    this.bytes += patchByteSize(patch);
    this.redoStack.length = 0;
    while (this.bytes > CONFIG.history.byteBudget && this.undoStack.length > 1) {
      this.bytes -= patchByteSize(this.undoStack.shift()!);
    }
  }

  undo(grid: LevelGrid): Patch | null {
    const patch = this.undoStack.pop();
    if (patch === undefined) {
      return null;
    }
    for (let k = 0; k < patch.indices.length; k++) {
      grid.cells[patch.indices[k]!] = patch.before[k]!;
    }
    this.redoStack.push(patch);
    return patch;
  }

  redo(grid: LevelGrid): Patch | null {
    const patch = this.redoStack.pop();
    if (patch === undefined) {
      return null;
    }
    for (let k = 0; k < patch.indices.length; k++) {
      grid.cells[patch.indices[k]!] = patch.after[k]!;
    }
    this.undoStack.push(patch);
    return patch;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.bytes = 0;
  }
}
