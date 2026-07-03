// Shared movement for players and ghosts. Wall collisions and perpendicular
// turns are only evaluated at "turn points" (cell centers, frac(x)==frac(y)==0);
// between centers entities glide. 180 turns are allowed anywhere, and motion
// past the board edge wraps toroidally (the side tunnels).

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
  sub,
  type BoardCoord,
} from "./coord.ts";
import {
  binarySearchPellet,
  type Pellet,
  type PowerPellet,
} from "./pellet.ts";

export type Movable = {
  x: BoardCoord;
  y: BoardCoord;
  current: Direction;
};

export type Player = Movable & {
  next: Direction;
  poweredTicks: number;
};

export function isPoweredUp(player: Player): boolean {
  return player.poweredTicks > 0;
}

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

function wrapCoord(
  value: BoardCoord,
  boardSize: BoardCoord,
  halfUnit: BoardCoord,
): BoardCoord {
  let result = value;
  if (result < -halfUnit) {
    result = add(result, boardSize);
  }
  if (result > sub(boardSize, halfUnit)) {
    result = sub(result, boardSize);
  }
  return result;
}

export function advance(
  entity: Movable,
  board: Board,
  integrationStep: BoardCoord,
): void {
  if (!(integrationStep > ZERO)) {
    throw new Error("integrationStep must be > 0");
  }
  if (!(integrationStep < UNIT)) {
    throw new Error("integrationStep must be < UNIT");
  }

  const turnPoint = frac(entity.x) === ZERO && frac(entity.y) === ZERO;
  const { movX, movY } = movement(entity.current);
  const entityRadius = div(UNIT, fromNum(2));

  // Probe a half-cell (radius) + one step ahead: from a centered entity this
  // reaches into the next cell, so movement halts the instant that cell is a
  // wall. Only enforced at turn points; between centers the entity glides.
  const projectedX = add(
    entity.x,
    mul(movX, add(entityRadius, integrationStep)),
  );
  const projectedY = add(
    entity.y,
    mul(movY, add(entityRadius, integrationStep)),
  );

  const enteredCellI =
    (roundToNum(projectedX) + board.width) % board.width;
  const enteredCellJ =
    (roundToNum(projectedY) + board.height) % board.height;

  if (turnPoint && board.hasWall(enteredCellI, enteredCellJ)) {
    return;
  }

  let x = add(entity.x, mul(movX, integrationStep));
  let y = add(entity.y, mul(movY, integrationStep));

  const w = fromNum(board.width);
  const h = fromNum(board.height);
  const halfUnit = div(UNIT, fromNum(2));

  x = wrapCoord(x, w, halfUnit);
  y = wrapCoord(y, h, halfUnit);

  entity.x = x;
  entity.y = y;
}

export function turn(player: Player, board: Board): void {
  if (player.next === player.current) {
    return;
  }

  const turn180 = player.next === opposite(player.current);

  if (turn180) {
    player.current = player.next;
    return;
  }

  const turnPoint = frac(player.x) === ZERO && frac(player.y) === ZERO;
  if (!turnPoint) {
    return;
  }

  const { movX, movY } = movement(player.next);
  const projectedX = add(
    player.x,
    mul(movX, add(radius(), increment())),
  );
  const projectedY = add(
    player.y,
    mul(movY, add(radius(), increment())),
  );

  const enteredCellI =
    (roundToNum(projectedX) + board.width) % board.width;
  const enteredCellJ =
    (roundToNum(projectedY) + board.height) % board.height;

  if (!board.hasWall(enteredCellI, enteredCellJ)) {
    player.current = player.next;
  }
}

export function eatPellets(player: Player, pellets: Pellet[]): void {
  const turnPoint = frac(player.x) === ZERO && frac(player.y) === ZERO;
  if (!turnPoint) {
    return;
  }

  const idx = binarySearchPellet(pellets, { x: player.x, y: player.y });
  if (idx >= 0) {
    pellets.splice(idx, 1);
  }
}

export function eatPowerPellets(
  player: Player,
  powerPellets: PowerPellet[],
): boolean {
  const turnPoint = frac(player.x) === ZERO && frac(player.y) === ZERO;
  if (!turnPoint) {
    return false;
  }

  const idx = binarySearchPellet(powerPellets, { x: player.x, y: player.y });
  if (idx >= 0) {
    powerPellets.splice(idx, 1);
    return true;
  }
  return false;
}
