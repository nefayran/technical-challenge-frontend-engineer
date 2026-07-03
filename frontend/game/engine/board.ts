import type { BoardCoord } from "./coord.ts";

export type { BoardCoord };

export enum Direction {
  UP,
  RIGHT,
  DOWN,
  LEFT,
}

export function opposite(dir: Direction): Direction {
  switch (dir) {
    case Direction.UP:
      return Direction.DOWN;
    case Direction.RIGHT:
      return Direction.LEFT;
    case Direction.DOWN:
      return Direction.UP;
    case Direction.LEFT:
      return Direction.RIGHT;
  }
}

export enum Block {
  Empty,
  Wall,
  Player,
  Ghost,
  Pellet,
  PowerPellet,
}

export type BlockValue =
  | { kind: Block.Empty }
  | { kind: Block.Wall }
  | { kind: Block.Player; direction: Direction }
  | { kind: Block.Ghost; direction: Direction }
  | { kind: Block.Pellet }
  | { kind: Block.PowerPellet };

export class Board {
  readonly width: number;
  readonly height: number;
  private readonly blocks: BlockValue[];

  constructor(width: number, height: number, blocks: BlockValue[]) {
    if (blocks.length !== width * height) {
      throw new Error(`Expected ${width * height} blocks, got ${blocks.length}`);
    }
    this.width = width;
    this.height = height;
    this.blocks = blocks;
  }

  static empty(width: number, height: number): Board {
    const total = width * height;
    const blocks: BlockValue[] = Array.from({ length: total }, () => ({
      kind: Block.Empty,
    }));
    return new Board(width, height, blocks);
  }

  hasWall(i: number, j: number): boolean {
    return this.getBlock(i, j).kind === Block.Wall;
  }

  getBlock(i: number, j: number): BlockValue {
    const idx = j * this.width + i;
    const block = this.blocks[idx];
    if (block === undefined) {
      throw new Error(`Block out of bounds: (${i}, ${j})`);
    }
    return block;
  }
}
