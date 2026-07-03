// Pellet lists are kept sorted by comparePellets (x then y) so eating is an
// O(log n) binarySearchPellet rather than a scan.

import type { BoardCoord } from "./coord.ts";

export type Pellet = {
  x: BoardCoord;
  y: BoardCoord;
};

export type PowerPellet = {
  x: BoardCoord;
  y: BoardCoord;
};

export function comparePellets(a: Pellet, b: Pellet): number {
  if (a.x !== b.x) {
    return a.x - b.x;
  }
  return a.y - b.y;
}

export function binarySearchPellet(pellets: Pellet[], target: Pellet): number {
  let low = 0;
  let high = pellets.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const pellet = pellets[mid];
    if (pellet === undefined) {
      return -1;
    }
    const cmp = comparePellets(pellet, target);
    if (cmp === 0) {
      return mid;
    }
    if (cmp < 0) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return -1;
}
