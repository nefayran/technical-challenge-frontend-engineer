import { describe, expect, test } from "bun:test";

import { CONFIG } from "../config.ts";
import {
  MAX_SCALE,
  MIN_SCALE,
  cellToScreen,
  clampCamera,
  fitGrid,
  panBy,
  screenToCell,
  visibleCellRect,
  zoomAt,
} from "./camera.ts";

describe("screenToCell / cellToScreen", () => {
  test("round-trips a cell under the pointer", () => {
    const camera = { x: 3.5, y: -2, scale: 16 };
    const { x, y } = cellToScreen(camera, 10, 7);
    const cell = screenToCell(camera, x + 1, y + 1);
    expect(cell).toEqual({ i: 10, j: 7 });
  });

  test("floors fractional positions", () => {
    const camera = { x: 0, y: 0, scale: 10 };
    expect(screenToCell(camera, 9, 19)).toEqual({ i: 0, j: 1 });
    expect(screenToCell(camera, 10, 20)).toEqual({ i: 1, j: 2 });
  });
});

describe("visibleCellRect", () => {
  test("clamps to grid bounds", () => {
    const camera = { x: -5, y: -5, scale: 10 };
    const rect = visibleCellRect(camera, 100, 100, 8, 8);
    expect(rect).toEqual({ i0: 0, j0: 0, i1: 5, j1: 5 });
  });

  test("covers exactly the viewport when inside the grid", () => {
    const camera = { x: 10, y: 20, scale: 10 };
    const rect = visibleCellRect(camera, 100, 50, 1000, 1000);
    expect(rect).toEqual({ i0: 10, j0: 20, i1: 20, j1: 25 });
  });
});

describe("zoomAt", () => {
  test("keeps the board point under the cursor fixed", () => {
    const camera = { x: 0, y: 0, scale: 10 };
    const zoomed = zoomAt(camera, 50, 50, 2);
    const before = screenToCell(camera, 50, 50);
    const after = screenToCell(zoomed, 50, 50);
    expect(after).toEqual(before);
    expect(zoomed.scale).toBe(20);
  });

  test("clamps to scale limits and returns the same camera at the edge", () => {
    const atMax = { x: 0, y: 0, scale: MAX_SCALE };
    expect(zoomAt(atMax, 0, 0, 4)).toBe(atMax);
    const atMin = { x: 0, y: 0, scale: MIN_SCALE };
    expect(zoomAt(atMin, 0, 0, 0.1)).toBe(atMin);
  });
});

describe("panBy", () => {
  test("moves opposite to the drag in cell units", () => {
    const camera = { x: 10, y: 10, scale: 20 };
    const panned = panBy(camera, 40, -20);
    expect(panned.x).toBe(8);
    expect(panned.y).toBe(11);
  });
});

describe("fitGrid", () => {
  test("centers a small grid and respects padding", () => {
    const camera = fitGrid(10, 10, 200, 200);
    const centerCell = screenToCell(camera, 100, 100);
    expect(centerCell.i).toBeGreaterThanOrEqual(4);
    expect(centerCell.i).toBeLessThanOrEqual(5);
    expect(camera.scale).toBeLessThanOrEqual((200 - 2 * CONFIG.camera.fitPaddingPx) / 10);
  });

  test("clamps scale for a huge grid", () => {
    const camera = fitGrid(1000, 1000, 400, 400);
    expect(camera.scale).toBe(MIN_SCALE);
  });
});

describe("clampCamera", () => {
  test("limits panning past the board edge to the overscroll fraction", () => {
    const camera = { x: -1000, y: 1000, scale: 10 };
    const clamped = clampCamera(camera, 100, 100, 50, 50);
    const viewCells = 100 / 10;
    expect(clamped.x).toBe(-viewCells * CONFIG.camera.panOverscroll);
    expect(clamped.y).toBe(50 - viewCells + viewCells * CONFIG.camera.panOverscroll);
  });
});
