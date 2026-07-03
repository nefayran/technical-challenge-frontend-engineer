// Editor state hub. The grid deliberately lives OUTSIDE Vue reactivity — a
// reactive proxy over a 1MB Uint8Array would tax every cell write. Vue owns
// only the chrome (tool, palette, sync badge, dialogs); the canvas redraws
// when `redrawTick` bumps.

import { reactive, ref, shallowRef } from "vue";

import { CONFIG } from "./config.ts";
import {
  CellCode,
  type CellPoint,
  type LevelGrid,
  type LevelResponse,
  type SyncState,
  type ToolKind,
} from "./types.ts";
import { cloneGrid, createGrid, gridsEqual, parseAscii2d, serializeAscii2d } from "./core/grid.ts";
import { PatchBuilder, UndoStack } from "./core/history.ts";
import { Renderer } from "./core/renderer.ts";
import { startSession, type ToolSession } from "./core/tools.ts";
import * as api from "./sync/api.ts";
import { clearDraft, loadDraft, saveDraft } from "./sync/draft.ts";
import { SyncController } from "./sync/syncStore.ts";

export type DraftOffer = {
  savedAt: number;
  grid: LevelGrid;
};

export const chrome = reactive({
  tool: "paint" as ToolKind,
  code: CellCode.Wall,
  syncState: "loading" as SyncState,
  version: 0,
  levelId: "",
  levels: [] as string[],
  loading: true,
  loadError: "",
  conflict: null as LevelResponse | null,
  draftOffer: null as DraftOffer | null,
  canUndo: false,
  canRedo: false,
  playtesting: false,
});

export const redrawTick = ref(0);
export const gridRef = shallowRef<LevelGrid | null>(null);
export const rendererRef = shallowRef<Renderer | null>(null);

const undoStack = new UndoStack();
let sync: SyncController | null = null;
let activeSession: ToolSession | null = null;
let draftTimer: ReturnType<typeof setTimeout> | null = null;

export function requestRedraw(): void {
  redrawTick.value++;
}

function refreshUndoFlags(): void {
  chrome.canUndo = undoStack.canUndo;
  chrome.canRedo = undoStack.canRedo;
}

function scheduleDraftWrite(): void {
  if (draftTimer !== null) {
    return;
  }
  draftTimer = setTimeout(() => {
    draftTimer = null;
    const grid = gridRef.value;
    if (grid !== null && sync !== null && chrome.syncState !== "synced") {
      saveDraft(sync.id, sync.version, grid);
    }
  }, CONFIG.draft.throttleMs);
}

function attachSync(levelId: string, version: number): void {
  sync?.dispose();
  chrome.levelId = levelId;
  chrome.version = version;
  sync = new SyncController(
    levelId,
    version,
    () => serializeAscii2d(gridRef.value!),
    {
      onStateChange: (state) => {
        chrome.syncState = state;
        if (state === "synced") {
          clearDraft(levelId);
        }
      },
      onVersionChange: (v) => {
        chrome.version = v;
      },
      onConflict: (server) => {
        chrome.conflict = server;
      },
    },
  );
  chrome.syncState = "synced";
}

function adoptGrid(grid: LevelGrid): void {
  gridRef.value = grid;
  if (rendererRef.value === null) {
    rendererRef.value = new Renderer(grid);
  } else {
    rendererRef.value.reset(grid);
  }
  undoStack.clear();
  refreshUndoFlags();
  requestRedraw();
}

export async function refreshLevelList(): Promise<void> {
  try {
    chrome.levels = await api.listLevels();
  } catch {
    // Sidebar list is non-critical; the sync badge already reflects backend
    // availability.
  }
}

export async function openLevel(id: string): Promise<void> {
  chrome.loading = true;
  chrome.loadError = "";
  chrome.draftOffer = null;
  chrome.conflict = null;
  try {
    const level = await api.loadLevel(id);
    adoptGrid(parseAscii2d(level.ascii2d));
    attachSync(level.id, level.version);
    const draft = loadDraft(id);
    if (draft !== null && !gridsEqual(draft.grid, gridRef.value!)) {
      chrome.draftOffer = { savedAt: draft.draft.savedAt, grid: draft.grid };
    } else if (draft !== null) {
      clearDraft(id);
    }
  } catch (error) {
    chrome.loadError = error instanceof Error ? error.message : String(error);
    chrome.syncState = "error";
  } finally {
    chrome.loading = false;
  }
}

export async function createLevel(grid: LevelGrid): Promise<void> {
  chrome.loading = true;
  chrome.loadError = "";
  chrome.draftOffer = null;
  chrome.conflict = null;
  try {
    const level = await api.storeLevel({ ascii2d: serializeAscii2d(grid) });
    adoptGrid(grid);
    attachSync(level.id, level.version);
    await refreshLevelList();
  } catch (error) {
    chrome.loadError = error instanceof Error ? error.message : String(error);
    chrome.syncState = "error";
  } finally {
    chrome.loading = false;
  }
}

export function newBlankLevel(width: number, height: number): Promise<void> {
  const grid = createGrid(width, height);
  return createLevel(grid);
}

export async function newGeneratedLevel(seed: number, size: number): Promise<void> {
  chrome.loading = true;
  try {
    const generated = await api.generateLevel(seed, size);
    await createLevel(parseAscii2d(generated.ascii2d));
  } catch (error) {
    chrome.loadError = error instanceof Error ? error.message : String(error);
    chrome.loading = false;
  }
}

export function duplicateLevel(): Promise<void> {
  const grid = gridRef.value;
  if (grid === null) {
    return Promise.resolve();
  }
  return createLevel(cloneGrid(grid));
}

export function beginStroke(cell: CellPoint): void {
  const grid = gridRef.value;
  if (grid === null || chrome.tool === "pan") {
    return;
  }
  activeSession = startSession(chrome.tool, grid, cell, chrome.code);
  if (activeSession !== null && chrome.tool === "flood") {
    endStroke();
    return;
  }
  if (activeSession !== null) {
    continueStroke(cell);
  }
}

export function continueStroke(cell: CellPoint): void {
  if (activeSession === null) {
    return;
  }
  const touched = activeSession.move(cell);
  if (touched.length > 0) {
    rendererRef.value?.applyCells(gridRef.value!, touched);
  }
  requestRedraw();
}

export function strokePreview() {
  return activeSession?.preview() ?? null;
}

export function endStroke(): void {
  if (activeSession === null) {
    return;
  }
  const patch = activeSession.commit();
  activeSession = null;
  if (patch !== null) {
    undoStack.push(patch);
    rendererRef.value?.applyCells(gridRef.value!, patch.indices);
    refreshUndoFlags();
    sync?.markDirty();
    scheduleDraftWrite();
  }
  requestRedraw();
}

export function cancelStroke(): void {
  if (activeSession === null) {
    return;
  }
  const patch = activeSession.commit();
  activeSession = null;
  if (patch !== null) {
    const grid = gridRef.value!;
    for (let k = 0; k < patch.indices.length; k++) {
      grid.cells[patch.indices[k]!] = patch.before[k]!;
    }
    rendererRef.value?.applyCells(grid, patch.indices);
  }
  requestRedraw();
}

export function undo(): void {
  const grid = gridRef.value;
  if (grid === null) {
    return;
  }
  const patch = undoStack.undo(grid);
  if (patch !== null) {
    rendererRef.value?.applyCells(grid, patch.indices);
    refreshUndoFlags();
    sync?.markDirty();
    scheduleDraftWrite();
    requestRedraw();
  }
}

export function redo(): void {
  const grid = gridRef.value;
  if (grid === null) {
    return;
  }
  const patch = undoStack.redo(grid);
  if (patch !== null) {
    rendererRef.value?.applyCells(grid, patch.indices);
    refreshUndoFlags();
    sync?.markDirty();
    scheduleDraftWrite();
    requestRedraw();
  }
}

export function resolveConflictTakeTheirs(): void {
  const server = chrome.conflict;
  if (server === null || sync === null) {
    return;
  }
  const serverGrid = parseAscii2d(server.ascii2d);
  const grid = gridRef.value;
  if (grid !== null && grid.width === serverGrid.width && grid.height === serverGrid.height) {
    // Same dimensions: apply the server content as one undoable patch, so
    // "take theirs" does not destroy the local edits.
    const builder = new PatchBuilder(grid);
    for (let i = 0; i < grid.cells.length; i++) {
      if (grid.cells[i] !== serverGrid.cells[i]) {
        builder.set(i, serverGrid.cells[i]!);
      }
    }
    const patch = builder.build();
    if (patch !== null) {
      undoStack.push(patch);
      rendererRef.value?.applyCells(grid, patch.indices);
      refreshUndoFlags();
    }
    requestRedraw();
  } else {
    adoptGrid(serverGrid);
  }
  chrome.conflict = null;
  sync.resolveTakeTheirs(server.version);
}

export function resolveConflictKeepMine(): void {
  const server = chrome.conflict;
  if (server === null || sync === null) {
    return;
  }
  chrome.conflict = null;
  sync.resolveKeepMine(server.version);
}

export function restoreDraft(): void {
  const offer = chrome.draftOffer;
  if (offer === null) {
    return;
  }
  adoptGrid(offer.grid);
  chrome.draftOffer = null;
  sync?.markDirty();
}

export function discardDraft(): void {
  if (chrome.draftOffer !== null) {
    clearDraft(chrome.levelId);
    chrome.draftOffer = null;
  }
}

export async function boot(): Promise<void> {
  await refreshLevelList();
  const first = chrome.levels.includes("classic") ? "classic" : chrome.levels[0];
  if (first !== undefined) {
    await openLevel(first);
  } else {
    chrome.loading = false;
    chrome.loadError = "Backend unreachable or has no levels";
    chrome.syncState = "error";
  }
}
