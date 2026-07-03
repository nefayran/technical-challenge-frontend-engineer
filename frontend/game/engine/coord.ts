// Fixed-point board coordinates: one cell spans UNIT (256), so sub-cell
// positions stay integers. Exact arithmetic keeps cell-alignment and equality
// tests exact, which is what makes the whole simulation deterministic.

export type BoardCoord = number & { readonly __boardCoord: unique symbol };

export const ZERO = 0 as BoardCoord;
export const UNIT = 256 as BoardCoord;
export const EPSILON = 1 as BoardCoord;

export function fromNum(n: number): BoardCoord {
  return (n * UNIT) as BoardCoord;
}

export function frac(c: BoardCoord): BoardCoord {
  const trunc =
    c >= 0
      ? (Math.floor(c / UNIT) * UNIT) as BoardCoord
      : (Math.ceil(c / UNIT) * UNIT) as BoardCoord;
  return (c - trunc) as BoardCoord;
}

export function roundToNum(c: BoardCoord): number {
  return Math.round(c / UNIT);
}

export function toNum(c: BoardCoord): number {
  return c / UNIT;
}

export function add(a: BoardCoord, b: BoardCoord): BoardCoord {
  return (a + b) as BoardCoord;
}

export function sub(a: BoardCoord, b: BoardCoord): BoardCoord {
  return (a - b) as BoardCoord;
}

// Fixed-point multiply/divide: results are rescaled by UNIT, so these are NOT
// plain a*b / a/b. To scale a coord by an integer n, pass fromNum(n) - e.g.
// div(UNIT, fromNum(2)) == UNIT/2, mul(UNIT, fromNum(3)) == 3*UNIT.
export function mul(a: BoardCoord, b: BoardCoord): BoardCoord {
  return Math.trunc((a * b) / UNIT) as BoardCoord;
}

export function div(a: BoardCoord, b: BoardCoord): BoardCoord {
  return Math.trunc((a * UNIT) / b) as BoardCoord;
}
