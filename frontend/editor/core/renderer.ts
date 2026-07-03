import { CONFIG } from "../config.ts";
import { CellCode, type Camera, type CellPoint, type LevelGrid, type ToolPreview } from "../types.ts";
import { visibleCellRect } from "./camera.ts";
import { isGhost, isPlayer, spawnDirection } from "./grid.ts";

export const COLORS = {
  background: "#1f1f1f",
  boardEmpty: "#2b2b2b",
  wall: "#3f51b5",
  pellet: "#e0e0e0",
  power: "#ffd54f",
  player: "#ffeb3b",
  ghost: "#ef5350",
  gridLine: "rgba(255, 255, 255, 0.06)",
  boardBorder: "#4caf50",
  hover: "rgba(255, 255, 255, 0.35)",
  preview: "rgba(255, 255, 255, 0.45)",
} as const;

// RGBA per cell code for the 1px-per-cell overview bitmap.
const OVERVIEW_PALETTE = new Uint8Array(12 * 4);
{
  const set = (code: CellCode, r: number, g: number, b: number) => {
    OVERVIEW_PALETTE[code * 4] = r;
    OVERVIEW_PALETTE[code * 4 + 1] = g;
    OVERVIEW_PALETTE[code * 4 + 2] = b;
    OVERVIEW_PALETTE[code * 4 + 3] = 255;
  };
  set(CellCode.Empty, 0x2b, 0x2b, 0x2b);
  set(CellCode.Wall, 0x3f, 0x51, 0xb5);
  set(CellCode.Pellet, 0x9e, 0x9e, 0x9e);
  set(CellCode.PowerPellet, 0xff, 0xd5, 0x4f);
  for (let d = 0; d < 4; d++) {
    set(CellCode.PlayerUp + d, 0xff, 0xeb, 0x3b);
    set(CellCode.GhostUp + d, 0xef, 0x53, 0x50);
  }
}

// Below this zoom, cells are blitted from the overview bitmap instead of drawn
// as glyphs; a full-glyph pass over ~100k visible cells would blow the frame
// budget, a scaled drawImage of a prerendered bitmap does not.
const GLYPH_MIN_SCALE = CONFIG.render.glyphMinScale;
const GRID_LINE_MIN_SCALE = CONFIG.render.gridLineMinScale;
const SPAWN_ARROW_MIN_SCALE = CONFIG.render.spawnArrowMinScale;

export type DrawOptions = {
  hover: CellPoint | null;
  preview: ToolPreview | null;
};

const DIR_VECTORS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;

export class Renderer {
  private overviewCanvas: HTMLCanvasElement;
  private overviewCtx: CanvasRenderingContext2D;
  private imageData: ImageData;
  private overviewDirty = true;
  private width = 0;
  private height = 0;

  constructor(grid: LevelGrid) {
    this.overviewCanvas = document.createElement("canvas");
    const ctx = this.overviewCanvas.getContext("2d");
    if (ctx === null) {
      throw new Error("2d context unavailable");
    }
    this.overviewCtx = ctx;
    this.imageData = new ImageData(1, 1);
    this.reset(grid);
  }

  reset(grid: LevelGrid): void {
    this.width = grid.width;
    this.height = grid.height;
    this.overviewCanvas.width = grid.width;
    this.overviewCanvas.height = grid.height;
    this.imageData = new ImageData(grid.width, grid.height);
    const px = this.imageData.data;
    const cells = grid.cells;
    for (let idx = 0; idx < cells.length; idx++) {
      const base = cells[idx]! * 4;
      const out = idx * 4;
      px[out] = OVERVIEW_PALETTE[base]!;
      px[out + 1] = OVERVIEW_PALETTE[base + 1]!;
      px[out + 2] = OVERVIEW_PALETTE[base + 2]!;
      px[out + 3] = 255;
    }
    this.overviewDirty = true;
  }

  applyCells(grid: LevelGrid, indices: ArrayLike<number>): void {
    const px = this.imageData.data;
    const cells = grid.cells;
    for (let k = 0; k < indices.length; k++) {
      const idx = indices[k]!;
      const base = cells[idx]! * 4;
      const out = idx * 4;
      px[out] = OVERVIEW_PALETTE[base]!;
      px[out + 1] = OVERVIEW_PALETTE[base + 1]!;
      px[out + 2] = OVERVIEW_PALETTE[base + 2]!;
    }
    this.overviewDirty = true;
  }

  getOverviewCanvas(): HTMLCanvasElement {
    this.flushOverview();
    return this.overviewCanvas;
  }

  private flushOverview(): void {
    if (this.overviewDirty) {
      this.overviewCtx.putImageData(this.imageData, 0, 0);
      this.overviewDirty = false;
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    grid: LevelGrid,
    camera: Camera,
    canvasWidth: number,
    canvasHeight: number,
    options: DrawOptions,
  ): void {
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const rect = visibleCellRect(camera, canvasWidth, canvasHeight, grid.width, grid.height);
    if (rect.i0 >= rect.i1 || rect.j0 >= rect.j1) {
      return;
    }
    const scale = camera.scale;

    if (scale < GLYPH_MIN_SCALE) {
      this.flushOverview();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        this.overviewCanvas,
        rect.i0,
        rect.j0,
        rect.i1 - rect.i0,
        rect.j1 - rect.j0,
        (rect.i0 - camera.x) * scale,
        (rect.j0 - camera.y) * scale,
        (rect.i1 - rect.i0) * scale,
        (rect.j1 - rect.j0) * scale,
      );
    } else {
      this.drawGlyphs(ctx, grid, camera, rect);
    }

    ctx.strokeStyle = COLORS.boardBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(
      (0 - camera.x) * scale,
      (0 - camera.y) * scale,
      grid.width * scale,
      grid.height * scale,
    );

    if (options.preview !== null) {
      this.drawPreview(ctx, grid, camera, options.preview);
    }
    if (options.hover !== null && scale >= 2) {
      const { i, j } = options.hover;
      if (i >= 0 && i < grid.width && j >= 0 && j < grid.height) {
        ctx.strokeStyle = COLORS.hover;
        ctx.lineWidth = Math.max(1, scale / 12);
        ctx.strokeRect((i - camera.x) * scale, (j - camera.y) * scale, scale, scale);
      }
    }
  }

  private drawGlyphs(
    ctx: CanvasRenderingContext2D,
    grid: LevelGrid,
    camera: Camera,
    rect: { i0: number; j0: number; i1: number; j1: number },
  ): void {
    const scale = camera.scale;
    const cells = grid.cells;

    ctx.fillStyle = COLORS.boardEmpty;
    ctx.fillRect(
      (rect.i0 - camera.x) * scale,
      (rect.j0 - camera.y) * scale,
      (rect.i1 - rect.i0) * scale,
      (rect.j1 - rect.j0) * scale,
    );

    for (let j = rect.j0; j < rect.j1; j++) {
      const rowBase = j * grid.width;
      const top = (j - camera.y) * scale;
      for (let i = rect.i0; i < rect.i1; i++) {
        const code = cells[rowBase + i]!;
        if (code === CellCode.Empty) {
          continue;
        }
        const left = (i - camera.x) * scale;
        this.drawGlyph(ctx, code, left, top, scale);
      }
    }

    if (scale >= GRID_LINE_MIN_SCALE) {
      ctx.strokeStyle = COLORS.gridLine;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = rect.i0; i <= rect.i1; i++) {
        const x = Math.round((i - camera.x) * scale) + 0.5;
        ctx.moveTo(x, (rect.j0 - camera.y) * scale);
        ctx.lineTo(x, (rect.j1 - camera.y) * scale);
      }
      for (let j = rect.j0; j <= rect.j1; j++) {
        const y = Math.round((j - camera.y) * scale) + 0.5;
        ctx.moveTo((rect.i0 - camera.x) * scale, y);
        ctx.lineTo((rect.i1 - camera.x) * scale, y);
      }
      ctx.stroke();
    }
  }

  private drawGlyph(
    ctx: CanvasRenderingContext2D,
    code: CellCode,
    left: number,
    top: number,
    scale: number,
  ): void {
    const cx = left + scale / 2;
    const cy = top + scale / 2;

    if (code === CellCode.Wall) {
      ctx.fillStyle = COLORS.wall;
      ctx.fillRect(left, top, scale, scale);
      return;
    }
    if (code === CellCode.Pellet) {
      ctx.fillStyle = COLORS.pellet;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1, scale / 9), 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    if (code === CellCode.PowerPellet) {
      ctx.fillStyle = COLORS.power;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(2, scale / 3.5), 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    if (isPlayer(code)) {
      this.drawPlayer(ctx, code, cx, cy, scale);
      return;
    }
    if (isGhost(code)) {
      this.drawGhost(ctx, code, cx, cy, scale);
    }
  }

  private drawPlayer(
    ctx: CanvasRenderingContext2D,
    code: CellCode,
    cx: number,
    cy: number,
    scale: number,
  ): void {
    const dir = spawnDirection(code);
    const radius = scale * 0.42;
    const mouthCenter = [-Math.PI / 2, 0, Math.PI / 2, Math.PI][dir]!;
    const mouth = Math.PI / 5;
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, mouthCenter + mouth, mouthCenter + Math.PI * 2 - mouth);
    ctx.closePath();
    ctx.fill();
    this.drawSpawnArrow(ctx, dir, cx, cy, scale);
  }

  private drawGhost(
    ctx: CanvasRenderingContext2D,
    code: CellCode,
    cx: number,
    cy: number,
    scale: number,
  ): void {
    const dir = spawnDirection(code);
    const radius = scale * 0.38;
    const bodyTop = cy - radius;
    const bodyBottom = cy + radius;
    ctx.fillStyle = COLORS.ghost;
    ctx.beginPath();
    ctx.arc(cx, bodyTop + radius, radius, Math.PI, 0, false);
    ctx.lineTo(cx + radius, bodyBottom);
    const feet = 3;
    const footWidth = (radius * 2) / feet;
    for (let f = 0; f < feet; f++) {
      const footRight = cx + radius - f * footWidth;
      ctx.lineTo(footRight - footWidth / 2, bodyBottom - scale * 0.12);
      ctx.lineTo(footRight - footWidth, bodyBottom);
    }
    ctx.lineTo(cx - radius, bodyTop + radius);
    ctx.closePath();
    ctx.fill();
    this.drawSpawnArrow(ctx, dir, cx, cy, scale);
  }

  private drawSpawnArrow(
    ctx: CanvasRenderingContext2D,
    dir: number,
    cx: number,
    cy: number,
    scale: number,
  ): void {
    if (scale < SPAWN_ARROW_MIN_SCALE) {
      return;
    }
    const [dx, dy] = DIR_VECTORS[dir]!;
    const len = scale * 0.3;
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = Math.max(1, scale / 14);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + dx * len, cy + dy * len);
    ctx.stroke();
  }

  private drawPreview(
    ctx: CanvasRenderingContext2D,
    grid: LevelGrid,
    camera: Camera,
    preview: ToolPreview,
  ): void {
    const scale = camera.scale;
    ctx.fillStyle = COLORS.preview;
    for (let k = 0; k < preview.indices.length; k++) {
      const idx = preview.indices[k]!;
      const i = idx % grid.width;
      const j = Math.floor(idx / grid.width);
      ctx.fillRect((i - camera.x) * scale, (j - camera.y) * scale, scale, scale);
    }
  }
}
