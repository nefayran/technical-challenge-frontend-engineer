import { Block, Direction, type Board } from "./board.ts";
import { fromAscii2d } from "./ascii2d.ts";
import { UNIT, fromNum, type BoardCoord } from "./coord.ts";
import { advanceGhost, turnGhost, type Ghost, type GhostId } from "./ghost.ts";
import {
  advance,
  eatPellets,
  eatPowerPellets,
  isPoweredUp,
  turn,
  type Movable,
  type Player,
} from "./player.ts";
import type { Pellet, PowerPellet } from "./pellet.ts";

export type Readings = {
  direction: Direction | null;
};

// How long a power pellet keeps a player dangerous to ghosts. At UNIT/8 per tick
// (8 ticks per cell) this is roughly 60 cells of travel.
const POWER_PELLET_TICKS = 480;

// Because player and ghost move in the same tick they can swap places and never
// land on the exact same point, so collision is a proximity test rather than an
// equality test.
const GHOST_COLLISION_RADIUS = (UNIT / 2) as BoardCoord;

function axisDelta(a: BoardCoord, b: BoardCoord, cells: number): number {
  const span = cells * UNIT;
  const raw = Math.abs(a - b);
  return Math.min(raw, span - raw); // torus wrap
}

function collides(player: Movable, ghost: Movable, board: Board): boolean {
  const dx = axisDelta(player.x, ghost.x, board.width);
  const dy = axisDelta(player.y, ghost.y, board.height);
  return dx + dy < GHOST_COLLISION_RADIUS;
}

export class Engine {
  private readonly integrationStep: BoardCoord;
  private readonly players: Player[] = [];
  private readonly ghosts: Ghost[] = [];
  private readonly pellets: Pellet[] = [];
  private readonly powerPellets: PowerPellet[] = [];
  private readonly board: Board;
  private frame = 0;

  constructor(ascii2d: string, integrationStep: BoardCoord) {
    this.integrationStep = integrationStep;
    this.board = fromAscii2d(ascii2d);

    // One column-outer / row-inner sweep collects every entity. That order
    // yields pellets pre-sorted by (x, y), which comparePellets and
    // binarySearchPellet rely on - keep it.
    let nextGhostId = 0;
    for (let i = 0; i < this.board.width; i++) {
      for (let j = 0; j < this.board.height; j++) {
        const block = this.board.getBlock(i, j);
        const x = fromNum(i);
        const y = fromNum(j);
        switch (block.kind) {
          case Block.Player:
            this.players.push({
              x,
              y,
              current: block.direction,
              next: block.direction,
              poweredTicks: 0,
            });
            break;
          case Block.Ghost:
            this.ghosts.push({
              id: nextGhostId as GhostId,
              x,
              y,
              current: block.direction,
            });
            nextGhostId += 1;
            break;
          case Block.Pellet:
            this.pellets.push({ x, y });
            break;
          case Block.PowerPellet:
            this.powerPellets.push({ x, y });
            break;
        }
      }
    }
  }

  tick(input: Readings): void {
    for (const player of this.players) {
      advance(player, this.board, this.integrationStep);
    }

    // One input stream steers every player; there is no per-player control.
    if (input.direction !== null) {
      for (const player of this.players) {
        player.next = input.direction;
      }
    }

    for (const player of this.players) {
      turn(player, this.board);
    }

    for (const player of this.players) {
      eatPellets(player, this.pellets);
      if (eatPowerPellets(player, this.powerPellets)) {
        player.poweredTicks = POWER_PELLET_TICKS;
      }
    }

    for (const ghost of this.ghosts) {
      advanceGhost(ghost, this.board, this.integrationStep);
    }

    for (const ghost of this.ghosts) {
      turnGhost(ghost, this.board, this.frame);
    }

    this.resolveCollisions();

    for (const player of this.players) {
      if (player.poweredTicks > 0) {
        player.poweredTicks -= 1;
      }
    }

    this.frame += 1;
  }

  private resolveCollisions(): void {
    if (this.ghosts.length === 0 || this.players.length === 0) {
      return;
    }

    const eatenGhosts = new Set<Ghost>();
    const poppedPlayers = new Set<Player>();

    for (const player of this.players) {
      for (const ghost of this.ghosts) {
        if (eatenGhosts.has(ghost)) {
          continue;
        }
        if (!collides(player, ghost, this.board)) {
          continue;
        }
        if (isPoweredUp(player)) {
          eatenGhosts.add(ghost);
        } else {
          poppedPlayers.add(player);
          break;
        }
      }
    }

    if (eatenGhosts.size > 0) {
      const survivingGhosts = this.ghosts.filter((g) => !eatenGhosts.has(g));
      this.ghosts.length = 0;
      this.ghosts.push(...survivingGhosts);
    }
    if (poppedPlayers.size > 0) {
      const survivingPlayers = this.players.filter((p) => !poppedPlayers.has(p));
      this.players.length = 0;
      this.players.push(...survivingPlayers);
    }
  }

  getPlayers(): readonly Player[] {
    return this.players;
  }

  getGhosts(): readonly Ghost[] {
    return this.ghosts;
  }

  getPellets(): readonly Pellet[] {
    return this.pellets;
  }

  getPowerPellets(): readonly PowerPellet[] {
    return this.powerPellets;
  }

  getBoard(): Board {
    return this.board;
  }

  getFrame(): number {
    return this.frame;
  }
}
