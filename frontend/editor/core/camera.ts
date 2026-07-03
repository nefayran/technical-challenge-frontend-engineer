// Camera maps board space to screen space: (x, y) is the board coordinate (in
// cells, fractional) at the canvas top-left corner, scale is pixels per cell.

import { CONFIG } from "../config.ts";
import type { Camera, CellPoint, CellRect } from "../types.ts";

export type { Camera, CellPoint, CellRect };

export const MIN_SCALE = CONFIG.camera.minScale;
export const MAX_SCALE = CONFIG.camera.maxScale;

export function screenToCell(camera: Camera, px: number, py: number): CellPoint {
  return {
    i: Math.floor(camera.x + px / camera.scale),
    j: Math.floor(camera.y + py / camera.scale),
  };
}

export function cellToScreen(camera: Camera, i: number, j: number): { x: number; y: number } {
  return {
    x: (i - camera.x) * camera.scale,
    y: (j - camera.y) * camera.scale,
  };
}

export function visibleCellRect(
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
  gridWidth: number,
  gridHeight: number,
): CellRect {
  const i0 = Math.max(0, Math.floor(camera.x));
  const j0 = Math.max(0, Math.floor(camera.y));
  const i1 = Math.min(gridWidth, Math.ceil(camera.x + canvasWidth / camera.scale));
  const j1 = Math.min(gridHeight, Math.ceil(camera.y + canvasHeight / camera.scale));
  return { i0, j0, i1, j1 };
}

export function zoomAt(camera: Camera, px: number, py: number, factor: number): Camera {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, camera.scale * factor));
  if (scale === camera.scale) {
    return camera;
  }
  return {
    x: camera.x + px / camera.scale - px / scale,
    y: camera.y + py / camera.scale - py / scale,
    scale,
  };
}

export function panBy(camera: Camera, dxPx: number, dyPx: number): Camera {
  return {
    x: camera.x - dxPx / camera.scale,
    y: camera.y - dyPx / camera.scale,
    scale: camera.scale,
  };
}

export function fitGrid(
  gridWidth: number,
  gridHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  padding = CONFIG.camera.fitPaddingPx,
): Camera {
  const usableW = Math.max(1, canvasWidth - padding * 2);
  const usableH = Math.max(1, canvasHeight - padding * 2);
  const scale = Math.min(
    MAX_SCALE,
    Math.max(MIN_SCALE, Math.min(usableW / gridWidth, usableH / gridHeight)),
  );
  return {
    x: gridWidth / 2 - canvasWidth / (2 * scale),
    y: gridHeight / 2 - canvasHeight / (2 * scale),
    scale,
  };
}

export function clampCamera(
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
  gridWidth: number,
  gridHeight: number,
): Camera {
  const viewW = canvasWidth / camera.scale;
  const viewH = canvasHeight / camera.scale;
  const marginW = viewW * CONFIG.camera.panOverscroll;
  const marginH = viewH * CONFIG.camera.panOverscroll;
  return {
    x: Math.min(gridWidth - viewW + marginW, Math.max(-marginW, camera.x)),
    y: Math.min(gridHeight - viewH + marginH, Math.max(-marginH, camera.y)),
    scale: camera.scale,
  };
}
