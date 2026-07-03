// Ghosts share player movement; only turning differs. At cell centers they
// avoid reversing unless it is the only option, and at junctions pick from a
// weighted list (straight favored) indexed by a hash of (frame, id, x, y) -
// pseudo-random yet stateless, so runs stay deterministic.

import { Direction, opposite } from "./board.ts";
import type { Board } from "./board.ts";
import {
  ZERO,
  UNIT,
  add,
  div,
  frac,
  fromNum,
  mul,
  roundToNum,
  type BoardCoord,
} from "./coord.ts";
import { advance, type Movable } from "./player.ts";

export type GhostId = number & { readonly __ghostId: unique symbol };

export type Ghost = Movable & {
  id: GhostId;
};

const ALL_DIRECTIONS: Direction[] = [
  Direction.UP,
  Direction.RIGHT,
  Direction.DOWN,
  Direction.LEFT,
];

function radius(): BoardCoord {
  return div(UNIT, fromNum(2));
}

function increment(): BoardCoord {
  return div(UNIT, fromNum(8));
}

function movement(dir: Direction): { movX: BoardCoord; movY: BoardCoord } {
  switch (dir) {
    case Direction.UP:
      return { movX: ZERO, movY: -UNIT as BoardCoord };
    case Direction.RIGHT:
      return { movX: UNIT, movY: ZERO };
    case Direction.DOWN:
      return { movX: ZERO, movY: UNIT };
    case Direction.LEFT:
      return { movX: -UNIT as BoardCoord, movY: ZERO };
  }
}

function isDirectionOpen(
  x: BoardCoord,
  y: BoardCoord,
  dir: Direction,
  board: Board,
): boolean {
  const { movX, movY } = movement(dir);
  const projectedX = add(x, mul(movX, add(radius(), increment())));
  const projectedY = add(y, mul(movY, add(radius(), increment())));

  const enteredCellI =
    (roundToNum(projectedX) + board.width) % board.width;
  const enteredCellJ =
    (roundToNum(projectedY) + board.height) % board.height;

  return !board.hasWall(enteredCellI, enteredCellJ);
}

function availableDirections(
  x: BoardCoord,
  y: BoardCoord,
  board: Board,
): Direction[] {
  const directions: Direction[] = [];
  for (const dir of ALL_DIRECTIONS) {
    if (isDirectionOpen(x, y, dir, board)) {
      directions.push(dir);
    }
  }
  return directions;
}

function turnChoices(
  x: BoardCoord,
  y: BoardCoord,
  current: Direction,
  board: Board,
): Direction[] {
  const available = availableDirections(x, y, board);
  const past = opposite(current);
  const choices = available.filter((dir) => dir !== past);
  if (choices.length > 0) {
    return choices;
  }
  return available;
}

const STRAIGHT_WEIGHT = 2;

function weightedChoices(choices: Direction[], current: Direction): Direction[] {
  const weighted: Direction[] = [];
  for (const dir of choices) {
    const weight = dir === current ? STRAIGHT_WEIGHT : 1;
    for (let n = 0; n < weight; n++) {
      weighted.push(dir);
    }
  }
  return weighted;
}

function crossroadIndex(
  frame: number,
  id: GhostId,
  x: BoardCoord,
  y: BoardCoord,
  choices: number,
): number {
  const seed =
    (frame * 73856093) ^
    (id * 50331653) ^
    (roundToNum(x) * 19349663) ^
    (roundToNum(y) * 83492791);
  return ((seed % choices) + choices) % choices;
}

export function advanceGhost(
  ghost: Ghost,
  board: Board,
  integrationStep: BoardCoord,
): void {
  advance(ghost, board, integrationStep);
}

export function turnGhost(ghost: Ghost, board: Board, frame: number): void {
  const turnPoint = frac(ghost.x) === ZERO && frac(ghost.y) === ZERO;
  if (!turnPoint) {
    return;
  }

  const choices = turnChoices(ghost.x, ghost.y, ghost.current, board);
  if (choices.length === 0) {
    return;
  }

  if (choices.length === 1) {
    ghost.current = choices[0]!;
    return;
  }

  const weighted = weightedChoices(choices, ghost.current);
  const index = crossroadIndex(
    frame,
    ghost.id,
    ghost.x,
    ghost.y,
    weighted.length,
  );
  ghost.current = weighted[index]!;
}
