<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";

import { CONFIG } from "../config.ts";
import { CellCode, type Camera, type CellPoint } from "../types.ts";
import { clampCamera, fitGrid, panBy, screenToCell, zoomAt } from "../core/camera.ts";
import {
  beginStroke,
  cancelStroke,
  chrome,
  continueStroke,
  endStroke,
  gridRef,
  redrawTick,
  rendererRef,
  requestRedraw,
  strokePreview,
} from "../store.ts";

const canvasRef = ref<HTMLCanvasElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);
const cursorAnnouncement = ref("");

let camera: Camera = { x: 0, y: 0, scale: 16 };
let hover: CellPoint | null = null;
let kbCursor: CellPoint | null = null;
let dirty = true;
let frameId = 0;
let cssWidth = 0;
let cssHeight = 0;
let panning = false;
let stroking = false;
let spaceHeld = false;
let lastPointer = { x: 0, y: 0 };
let resizeObserver: ResizeObserver | null = null;

watch(redrawTick, () => {
  dirty = true;
});

watch(
  () => gridRef.value,
  (grid) => {
    if (grid !== null && cssWidth > 0) {
      camera = fitGrid(grid.width, grid.height, cssWidth, cssHeight);
      dirty = true;
    }
  },
);

function resize(): void {
  const canvas = canvasRef.value;
  const container = containerRef.value;
  if (canvas === null || container === null) {
    return;
  }
  const dpr = window.devicePixelRatio || 1;
  cssWidth = container.clientWidth;
  cssHeight = container.clientHeight;
  canvas.width = Math.max(1, Math.round(cssWidth * dpr));
  canvas.height = Math.max(1, Math.round(cssHeight * dpr));
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  dirty = true;
}

function draw(): void {
  const canvas = canvasRef.value;
  const grid = gridRef.value;
  const renderer = rendererRef.value;
  if (canvas === null || grid === null || renderer === null) {
    return;
  }
  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    return;
  }
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  renderer.draw(ctx, grid, camera, cssWidth, cssHeight, {
    hover: stroking ? null : hover,
    cursor: kbCursor,
    preview: strokePreview(),
  });
}

function frame(): void {
  if (dirty) {
    dirty = false;
    draw();
  }
  frameId = requestAnimationFrame(frame);
}

function pointerCell(event: PointerEvent): CellPoint {
  const rect = canvasRef.value!.getBoundingClientRect();
  return screenToCell(camera, event.clientX - rect.left, event.clientY - rect.top);
}

function isPanGesture(event: PointerEvent): boolean {
  return event.button === 1 || spaceHeld || chrome.tool === "pan";
}

function onPointerDown(event: PointerEvent): void {
  canvasRef.value?.setPointerCapture(event.pointerId);
  lastPointer = { x: event.clientX, y: event.clientY };
  if (isPanGesture(event)) {
    panning = true;
    return;
  }
  if (event.button === 0) {
    stroking = true;
    beginStroke(pointerCell(event));
    dirty = true;
  }
}

function onPointerMove(event: PointerEvent): void {
  if (panning) {
    const grid = gridRef.value;
    camera = panBy(camera, event.clientX - lastPointer.x, event.clientY - lastPointer.y);
    if (grid !== null) {
      camera = clampCamera(camera, cssWidth, cssHeight, grid.width, grid.height);
    }
    lastPointer = { x: event.clientX, y: event.clientY };
    dirty = true;
    return;
  }
  lastPointer = { x: event.clientX, y: event.clientY };
  const cell = pointerCell(event);
  if (hover === null || hover.i !== cell.i || hover.j !== cell.j) {
    hover = cell;
    dirty = true;
    if (stroking) {
      continueStroke(cell);
    }
  }
}

function onPointerUp(): void {
  if (panning) {
    panning = false;
    return;
  }
  if (stroking) {
    stroking = false;
    endStroke();
    dirty = true;
  }
}

function onPointerLeave(): void {
  hover = null;
  dirty = true;
}

function onWheel(event: WheelEvent): void {
  event.preventDefault();
  const rect = canvasRef.value!.getBoundingClientRect();
  const factor = Math.pow(CONFIG.camera.wheelZoomFactor, -event.deltaY);
  camera = zoomAt(camera, event.clientX - rect.left, event.clientY - rect.top, factor);
  const grid = gridRef.value;
  if (grid !== null) {
    camera = clampCamera(camera, cssWidth, cssHeight, grid.width, grid.height);
  }
  dirty = true;
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.code === "Space" && !event.repeat) {
    spaceHeld = true;
    event.preventDefault();
  }
  if (event.key === "Escape" && stroking) {
    stroking = false;
    cancelStroke();
    dirty = true;
  }
}

// Keyboard editing when the canvas itself is focused: arrows move a cell
// cursor, Enter stamps the selected block at it.
function announceCursor(): void {
  const grid = gridRef.value;
  if (kbCursor === null || grid === null) {
    cursorAnnouncement.value = "";
    return;
  }
  const code = grid.cells[kbCursor.j * grid.width + kbCursor.i]!;
  cursorAnnouncement.value = `${kbCursor.i}, ${kbCursor.j}: ${CellCode[code]}`;
}

function ensureCursorVisible(): void {
  if (kbCursor === null) {
    return;
  }
  const viewW = cssWidth / camera.scale;
  const viewH = cssHeight / camera.scale;
  if (
    kbCursor.i < camera.x ||
    kbCursor.i >= camera.x + viewW - 1 ||
    kbCursor.j < camera.y ||
    kbCursor.j >= camera.y + viewH - 1
  ) {
    camera = {
      x: kbCursor.i - viewW / 2,
      y: kbCursor.j - viewH / 2,
      scale: camera.scale,
    };
  }
}

function onCanvasKeyDown(event: KeyboardEvent): void {
  const grid = gridRef.value;
  if (grid === null) {
    return;
  }
  const moves: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  const move = moves[event.key];
  if (move !== undefined) {
    event.preventDefault();
    if (kbCursor === null) {
      const center = screenToCell(camera, cssWidth / 2, cssHeight / 2);
      kbCursor = {
        i: Math.min(grid.width - 1, Math.max(0, center.i)),
        j: Math.min(grid.height - 1, Math.max(0, center.j)),
      };
    } else {
      kbCursor = {
        i: Math.min(grid.width - 1, Math.max(0, kbCursor.i + move[0])),
        j: Math.min(grid.height - 1, Math.max(0, kbCursor.j + move[1])),
      };
    }
    ensureCursorVisible();
    announceCursor();
    dirty = true;
    return;
  }
  if (event.key === "Enter" && kbCursor !== null) {
    event.preventDefault();
    beginStroke(kbCursor);
    endStroke();
    announceCursor();
    dirty = true;
  }
}

function onCanvasBlur(): void {
  kbCursor = null;
  cursorAnnouncement.value = "";
  dirty = true;
}

function onKeyUp(event: KeyboardEvent): void {
  if (event.code === "Space") {
    spaceHeld = false;
  }
}

export interface CanvasApi {
  fit(): void;
}

function fit(): void {
  const grid = gridRef.value;
  if (grid !== null) {
    camera = fitGrid(grid.width, grid.height, cssWidth, cssHeight);
    dirty = true;
  }
}

defineExpose<CanvasApi>({ fit });

onMounted(() => {
  resize();
  resizeObserver = new ResizeObserver(resize);
  if (containerRef.value !== null) {
    resizeObserver.observe(containerRef.value);
  }
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  fit();
  requestRedraw();
  frameId = requestAnimationFrame(frame);
});

onUnmounted(() => {
  cancelAnimationFrame(frameId);
  resizeObserver?.disconnect();
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
});
</script>

<template>
  <div ref="containerRef" class="canvas-host" data-tour="canvas">
    <canvas
      ref="canvasRef"
      tabindex="0"
      role="application"
      aria-label="Level grid. Arrow keys move the cursor, Enter places the selected block."
      :class="{ panning: chrome.tool === 'pan' }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @pointerleave="onPointerLeave"
      @wheel="onWheel"
      @keydown="onCanvasKeyDown"
      @blur="onCanvasBlur"
      @contextmenu.prevent
    />
    <div class="visually-hidden" aria-live="polite">{{ cursorAnnouncement }}</div>
  </div>
</template>

<style scoped>
.canvas-host {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

canvas {
  display: block;
  cursor: crosshair;
  touch-action: none;
}

canvas.panning {
  cursor: grab;
}
</style>
