<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";

import {
  Direction,
  Engine,
  div,
  fromNum,
  isPoweredUp,
  toNum,
  type Pellet,
} from "../../game/engine/index.ts";
import { CONFIG } from "../config.ts";
import { t } from "../i18n.ts";
import { serializeAscii2d } from "../core/grid.ts";
import { gridRef } from "../store.ts";
import { canvasColors } from "../tokens.ts";

const emit = defineEmits<{ close: [] }>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const pelletsLeft = ref(0);
const finished = ref<"" | "eaten" | "cleared">("");

let engine: Engine | null = null;
let frameId = 0;
let held: Direction | null = null;
let cameraX = 0;
let cameraY = 0;
let cssWidth = 0;
let cssHeight = 0;

// Editing scale is free, but playtesting fixes a readable cell size and the
// camera follows the player — a full-board draw at 1000x1000 would be 1M
// cells per frame, the culled view is a few thousand.
const SCALE = 22;

function start(): void {
  const grid = gridRef.value;
  if (grid === null) {
    return;
  }
  engine = new Engine(
    serializeAscii2d(grid),
    div(fromNum(1), fromNum(CONFIG.playtest.stepDenominator)),
  );
  finished.value = "";
  const players = engine.getPlayers();
  const first = players[0];
  cameraX = first !== undefined ? toNum(first.x) : engine.getBoard().width / 2;
  cameraY = first !== undefined ? toNum(first.y) : engine.getBoard().height / 2;
}

// Pellets are sorted by (x, y); find the first index with x >= minX so the
// draw loop only walks the visible column range.
function lowerBoundX(pellets: readonly Pellet[], minX: number): number {
  let lo = 0;
  let hi = pellets.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (toNum(pellets[mid]!.x) < minX) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

function drawCulledDots(
  ctx: CanvasRenderingContext2D,
  items: readonly Pellet[],
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  radius: number,
  color: string,
): void {
  ctx.fillStyle = color;
  for (let k = lowerBoundX(items, minX); k < items.length; k++) {
    const x = toNum(items[k]!.x);
    if (x > maxX) {
      break;
    }
    const y = toNum(items[k]!.y);
    if (y < minY || y > maxY) {
      continue;
    }
    ctx.beginPath();
    ctx.arc(
      (x - cameraX) * SCALE + cssWidth / 2 + SCALE / 2,
      (y - cameraY) * SCALE + cssHeight / 2 + SCALE / 2,
      radius,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

function draw(): void {
  const canvas = canvasRef.value;
  if (canvas === null || engine === null) {
    return;
  }
  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    return;
  }
  const colors = canvasColors();
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = colors.canvasBg;
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  const board = engine.getBoard();
  const halfW = cssWidth / 2 / SCALE;
  const halfH = cssHeight / 2 / SCALE;
  const i0 = Math.max(0, Math.floor(cameraX - halfW));
  const i1 = Math.min(board.width, Math.ceil(cameraX + halfW) + 1);
  const j0 = Math.max(0, Math.floor(cameraY - halfH));
  const j1 = Math.min(board.height, Math.ceil(cameraY + halfH) + 1);

  const sx = (i: number) => (i - cameraX) * SCALE + cssWidth / 2;
  const sy = (j: number) => (j - cameraY) * SCALE + cssHeight / 2;

  ctx.fillStyle = colors.boardEmpty;
  ctx.fillRect(sx(i0), sy(j0), (i1 - i0) * SCALE, (j1 - j0) * SCALE);
  ctx.fillStyle = colors.wall;
  for (let j = j0; j < j1; j++) {
    for (let i = i0; i < i1; i++) {
      if (board.hasWall(i, j)) {
        ctx.fillRect(sx(i), sy(j), SCALE, SCALE);
      }
    }
  }

  drawCulledDots(ctx, engine.getPellets(), i0, i1, j0, j1, SCALE / 9, colors.pellet);
  drawCulledDots(ctx, engine.getPowerPellets(), i0, i1, j0, j1, SCALE / 3.5, colors.power);

  for (const ghost of engine.getGhosts()) {
    const gx = toNum(ghost.x);
    const gy = toNum(ghost.y);
    if (gx < i0 - 1 || gx > i1 || gy < j0 - 1 || gy > j1) {
      continue;
    }
    ctx.fillStyle = colors.ghost;
    ctx.beginPath();
    ctx.arc(sx(gx) + SCALE / 2, sy(gy) + SCALE / 2 - SCALE * 0.05, SCALE * 0.38, Math.PI, 0);
    ctx.rect(sx(gx) + SCALE * 0.12, sy(gy) + SCALE * 0.45, SCALE * 0.76, SCALE * 0.4);
    ctx.fill();
  }

  for (const player of engine.getPlayers()) {
    const px = toNum(player.x);
    const py = toNum(player.y);
    const openingCenter =
      player.current === Direction.UP
        ? -Math.PI / 2
        : player.current === Direction.RIGHT
          ? 0
          : player.current === Direction.DOWN
            ? Math.PI / 2
            : Math.PI;
    const phase = Math.abs(((px + py) % 1) - 0.5) * 2;
    // Idle players freeze mid-animation; keep a minimum opening so a standing
    // pacman still reads as a pacman rather than a dot.
    const opening = (Math.max(10, 45 - 45 * phase) * Math.PI) / 180;
    ctx.fillStyle = isPoweredUp(player) ? colors.danger : colors.player;
    ctx.beginPath();
    const cx = sx(px) + SCALE / 2;
    const cy = sy(py) + SCALE / 2;
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, SCALE * 0.45, openingCenter + opening, openingCenter + Math.PI * 2 - opening);
    ctx.closePath();
    ctx.fill();
  }
}

function frame(): void {
  if (engine !== null && finished.value === "") {
    engine.tick({ direction: held });
    const players = engine.getPlayers();
    pelletsLeft.value = engine.getPellets().length;
    if (players.length === 0) {
      finished.value = "eaten";
    } else if (pelletsLeft.value === 0) {
      finished.value = "cleared";
    } else {
      const target = players[0]!;
      const lerp = CONFIG.playtest.cameraFollowLerp;
      cameraX += (toNum(target.x) - cameraX) * lerp;
      cameraY += (toNum(target.y) - cameraY) * lerp;
      const board = engine.getBoard();
      const viewW = cssWidth / SCALE;
      const viewH = cssHeight / SCALE;
      cameraX =
        board.width <= viewW
          ? board.width / 2
          : Math.min(board.width - viewW / 2, Math.max(viewW / 2, cameraX));
      cameraY =
        board.height <= viewH
          ? board.height / 2
          : Math.min(board.height - viewH / 2, Math.max(viewH / 2, cameraY));
    }
  }
  draw();
  frameId = requestAnimationFrame(frame);
}

function directionFromKey(key: string): Direction | null {
  switch (key) {
    case "ArrowRight":
      return Direction.RIGHT;
    case "ArrowLeft":
      return Direction.LEFT;
    case "ArrowUp":
      return Direction.UP;
    case "ArrowDown":
      return Direction.DOWN;
    default:
      return null;
  }
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    emit("close");
    return;
  }
  if (event.key.toLowerCase() === "r") {
    start();
    return;
  }
  const dir = directionFromKey(event.key);
  if (dir !== null) {
    held = dir;
    event.preventDefault();
  }
}

function onKeyUp(event: KeyboardEvent): void {
  const dir = directionFromKey(event.key);
  if (dir !== null && held === dir) {
    held = null;
  }
}

function resize(): void {
  const canvas = canvasRef.value;
  if (canvas === null) {
    return;
  }
  const dpr = window.devicePixelRatio || 1;
  cssWidth = canvas.clientWidth;
  cssHeight = canvas.clientHeight;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
}

onMounted(() => {
  start();
  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  frameId = requestAnimationFrame(frame);
});

onUnmounted(() => {
  cancelAnimationFrame(frameId);
  window.removeEventListener("resize", resize);
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
});
</script>

<template>
  <div class="playtest" role="dialog" aria-modal="true" :aria-label="t('app.play')">
    <canvas ref="canvasRef" />
    <div class="hud">
      <span>{{ pelletsLeft }} {{ t("playtest.pellets") }}</span>
      <span>{{ t("playtest.exit") }}</span>
    </div>
    <div v-if="finished !== ''" class="banner">
      {{ finished === "eaten" ? t("playtest.eaten") : t("playtest.cleared") }}
    </div>
    <button class="close" :aria-label="t('generate.cancel')" @click="emit('close')">✕</button>
  </div>
</template>

<style scoped>
.playtest {
  position: fixed;
  inset: 0;
  z-index: var(--z-playtest);
  background: var(--color-canvas-bg);
}

canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.hud {
  position: absolute;
  top: var(--space-lg);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: var(--space-xl);
  padding: var(--space-sm) var(--space-lg);
  background: var(--color-backdrop);
  color: var(--color-text);
  border-radius: var(--radius-base);
  font-size: var(--font-size-md);
}

.banner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: var(--space-lg) var(--space-xl);
  background: var(--color-backdrop);
  border: var(--border-width) solid var(--color-border-strong);
  border-radius: var(--radius-base);
  font-size: var(--font-size-lg);
}

.close {
  position: absolute;
  top: var(--space-lg);
  right: var(--space-lg);
}
</style>
