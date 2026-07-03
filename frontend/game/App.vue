<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";

import {
  CLASSIC,
  Direction,
  Engine,
  div,
  frac,
  fromNum,
  isPoweredUp,
  toNum,
  type Ghost,
  type Player,
  type Pellet,
  type PowerPellet,
} from "./engine/index.ts";

const BLOCK_SIZE = 16;
const BOARD_OFFSET = 16;

// The engine ticks once per animation frame (~60fps), so ~60 ticks ≈ 1 second.
const TICKS_PER_SECOND = 60;
const POWER_BLINK_TICKS = TICKS_PER_SECOND;
const POWER_BLINK_PERIOD = 8;

const engine = ref<Engine | null>(null);
const players = ref<readonly Player[]>([]);
const ghosts = ref<readonly Ghost[]>([]);
const pellets = ref<readonly Pellet[]>([]);
const powerPellets = ref<readonly PowerPellet[]>([]);
const levelWidth = ref(0);
const levelHeight = ref(0);
const fps = ref(0);
const heldDirection = ref<Direction | null>(null);

let frameId = 0;
let lastFrameTime = 0;
let frameCount = 0;
let fpsWindowStart = 0;

const canvasWidth = computed(
  () => BOARD_OFFSET * 2 + levelWidth.value * BLOCK_SIZE,
);
const canvasHeight = computed(
  () => BOARD_OFFSET * 2 + levelHeight.value * BLOCK_SIZE + 48,
);

function syncState(): void {
  if (engine.value === null) {
    return;
  }
  players.value = engine.value.getPlayers();
  ghosts.value = engine.value.getGhosts();
  pellets.value = engine.value.getPellets();
  powerPellets.value = engine.value.getPowerPellets();
  const board = engine.value.getBoard();
  levelWidth.value = board.width;
  levelHeight.value = board.height;
}

function drawGhost(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
): void {
  const radius = size * 0.4;
  const totalHeight = size * 0.88;
  const top = y - totalHeight / 2;
  const bottom = y + totalHeight / 2;
  const left = x - radius;
  const right = x + radius;
  const domeCenterY = top + radius;

  const feet = 3;
  const footWidth = (radius * 2) / feet;
  const footNotch = size * 0.14;

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  // Domed head: upper semicircle from left to right.
  ctx.arc(x, domeCenterY, radius, Math.PI, 0, false);
  // Right side straight down to the feet.
  ctx.lineTo(right, bottom);
  // Scalloped bottom: notch up between each foot tip.
  for (let i = 0; i < feet; i++) {
    const footRight = right - i * footWidth;
    ctx.lineTo(footRight - footWidth / 2, bottom - footNotch);
    ctx.lineTo(footRight - footWidth, bottom);
  }
  // Left side back up to the dome.
  ctx.lineTo(left, domeCenterY);
  ctx.closePath();
  ctx.fill();
}

function playerColor(player: Player): string {
  const NORMAL = "#ffeb3b";
  const POWERED = "#e53935";
  if (!isPoweredUp(player)) {
    return NORMAL;
  }
  // In the last second before power runs out, blink between the two colors.
  if (player.poweredTicks < POWER_BLINK_TICKS) {
    const on = Math.floor(player.poweredTicks / POWER_BLINK_PERIOD) % 2 === 0;
    return on ? NORMAL : POWERED;
  }
  return POWERED;
}

function drawPill(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  length: number,
  thickness: number,
): void {
  const r = thickness / 2;
  const left = -length / 2;
  const right = length / 2;
  const top = -r;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((30 * Math.PI) / 180);

  // Capsule (stadium) outline, centered on the origin.
  ctx.beginPath();
  ctx.moveTo(left + r, top);
  ctx.lineTo(right - r, top);
  ctx.arc(right - r, 0, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(left + r, r);
  ctx.arc(left + r, 0, r, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();

  ctx.save();
  ctx.clip();
  ctx.fillStyle = "#e53935";
  ctx.fillRect(left, top, length / 2, thickness);
  ctx.fillStyle = "#ffd54f";
  ctx.fillRect(0, top, length / 2, thickness);
  ctx.restore();

  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D): void {
  if (engine.value === null) {
    return;
  }

  const board = engine.value.getBoard();
  ctx.fillStyle = "#2b2b2b";
  ctx.fillRect(0, 0, canvasWidth.value, canvasHeight.value);

  ctx.fillStyle = "#f5f5f5";
  ctx.font = "14px monospace";
  const status = `players: ${players.value.length} | ghosts: ${ghosts.value.length} | pellets: ${pellets.value.length}`;
  ctx.fillText(
    `${levelWidth.value}x${levelHeight.value} @ ${fps.value} FPS`,
    12,
    20,
  );
  ctx.fillText(status, 12, 38);

  for (let i = 0; i < board.width; i++) {
    for (let j = 0; j < board.height; j++) {
      const left = BOARD_OFFSET + i * BLOCK_SIZE;
      const top = BOARD_OFFSET + 48 + j * BLOCK_SIZE;
      if (board.hasWall(i, j)) {
        ctx.fillStyle = "#111111";
        ctx.fillRect(left, top, BLOCK_SIZE, BLOCK_SIZE);
      }
    }
  }

  ctx.strokeStyle = "#4caf50";
  ctx.lineWidth = 2;
  ctx.strokeRect(
    BOARD_OFFSET,
    BOARD_OFFSET + 48,
    board.width * BLOCK_SIZE,
    board.height * BLOCK_SIZE,
  );

  ctx.fillStyle = "#ffffff";
  for (const pellet of pellets.value) {
    const x = BOARD_OFFSET + BLOCK_SIZE / 2 + toNum(pellet.x) * BLOCK_SIZE;
    const y = BOARD_OFFSET + 48 + BLOCK_SIZE / 2 + toNum(pellet.y) * BLOCK_SIZE;
    ctx.beginPath();
    ctx.arc(x, y, BLOCK_SIZE / 10, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const powerPellet of powerPellets.value) {
    const x = BOARD_OFFSET + BLOCK_SIZE / 2 + toNum(powerPellet.x) * BLOCK_SIZE;
    const y = BOARD_OFFSET + 48 + BLOCK_SIZE / 2 + toNum(powerPellet.y) * BLOCK_SIZE;
    drawPill(ctx, x, y, BLOCK_SIZE * 0.9, BLOCK_SIZE * 0.5);
  }

  for (const ghost of ghosts.value) {
    const x = BOARD_OFFSET + BLOCK_SIZE / 2 + toNum(ghost.x) * BLOCK_SIZE;
    const y = BOARD_OFFSET + 48 + BLOCK_SIZE / 2 + toNum(ghost.y) * BLOCK_SIZE;
    drawGhost(ctx, x, y, BLOCK_SIZE);
  }

  for (const player of players.value) {
    const x = BOARD_OFFSET + BLOCK_SIZE / 2 + toNum(player.x) * BLOCK_SIZE;
    const y = BOARD_OFFSET + 48 + BLOCK_SIZE / 2 + toNum(player.y) * BLOCK_SIZE;
    const radius = (BLOCK_SIZE / 2) * 0.9;

    const openingCenter =
      player.current === Direction.UP
        ? -Math.PI / 2
        : player.current === Direction.RIGHT
          ? 0
          : player.current === Direction.DOWN
            ? Math.PI / 2
            : Math.PI;

    const phase =
      Math.abs(toNum(frac(player.x)) + toNum(frac(player.y)) - 0.5) * 2;
    const openingWidth = ((45 - 45 * phase) * Math.PI) / 180;
    const startAngle = openingCenter + openingWidth;
    const endAngle = openingCenter + Math.PI * 2 - openingWidth;

    ctx.fillStyle = playerColor(player);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fill();
  }
}

function tickFrame(timestamp: number): void {
  if (engine.value === null) {
    return;
  }

  if (lastFrameTime > 0) {
    engine.value.tick({ direction: heldDirection.value });
    syncState();
  }
  lastFrameTime = timestamp;

  frameCount += 1;
  if (fpsWindowStart === 0) {
    fpsWindowStart = timestamp;
  }
  if (timestamp - fpsWindowStart >= 1000) {
    fps.value = frameCount;
    frameCount = 0;
    fpsWindowStart = timestamp;
  }

  const canvas = document.getElementById("game-canvas");
  if (canvas instanceof HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (ctx !== null) {
      draw(ctx);
    }
  }

  frameId = requestAnimationFrame(tickFrame);
}

function directionFromKey(key: string): Direction | null {
  if (key === "ArrowRight") {
    return Direction.RIGHT;
  }
  if (key === "ArrowLeft") {
    return Direction.LEFT;
  }
  if (key === "ArrowUp") {
    return Direction.UP;
  }
  if (key === "ArrowDown") {
    return Direction.DOWN;
  }
  return null;
}

function onKeyDown(event: KeyboardEvent): void {
  const direction = directionFromKey(event.key);
  if (direction !== null) {
    heldDirection.value = direction;
    event.preventDefault();
  }
}

function onKeyUp(event: KeyboardEvent): void {
  const direction = directionFromKey(event.key);
  if (direction !== null && heldDirection.value === direction) {
    heldDirection.value = null;
    event.preventDefault();
  }
}

onMounted(() => {
  engine.value = new Engine(CLASSIC, div(fromNum(1), fromNum(8)));
  syncState();
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  frameId = requestAnimationFrame(tickFrame);
});

onUnmounted(() => {
  cancelAnimationFrame(frameId);
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
});
</script>

<template>
  <main class="game">
    <h1>Maze Chase</h1>
    <p class="hint">Arrow keys to move</p>
    <canvas id="game-canvas" :width="canvasWidth" :height="canvasHeight" />
  </main>
</template>

<style scoped>
.game {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-height: 100vh;
  padding: 24px;
}

h1 {
  margin: 0;
  font-size: 1.5rem;
}

.hint {
  margin: 0;
  color: #aaaaaa;
  font-size: 0.875rem;
}

canvas {
  border: 1px solid #444444;
  background: #2b2b2b;
}
</style>
