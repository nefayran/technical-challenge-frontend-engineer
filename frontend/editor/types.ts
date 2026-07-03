// Shared editor types. API types mirror backend/server/models.py by hand —
// the backend is Python, so there is nothing to import; keep them in lockstep.

export enum CellCode {
  Empty = 0,
  Wall = 1,
  Pellet = 2,
  PowerPellet = 3,
  PlayerUp = 4,
  PlayerRight = 5,
  PlayerDown = 6,
  PlayerLeft = 7,
  GhostUp = 8,
  GhostRight = 9,
  GhostDown = 10,
  GhostLeft = 11,
}

export type LevelGrid = {
  width: number;
  height: number;
  cells: Uint8Array;
};

export type Camera = {
  x: number;
  y: number;
  scale: number;
};

export type CellPoint = { i: number; j: number };

export type CellRect = { i0: number; j0: number; i1: number; j1: number };

export type Patch = {
  indices: Uint32Array;
  before: Uint8Array;
  after: Uint8Array;
};

export type ToolKind = "paint" | "erase" | "line" | "rect" | "flood" | "pan";

export type ToolPreview = {
  indices: Uint32Array;
  code: CellCode;
};

// Mirrors LevelResponse in backend/server/models.py.
export type LevelResponse = {
  id: string;
  version: number;
  ascii2d: string;
};

// Mirrors StoreRequest in backend/server/models.py.
export type StoreRequest = {
  ascii2d: string;
  id?: string;
  base_version?: number;
};

// Mirrors GenerateRequest/GenerateResponse in backend/server/models.py.
export type GenerateRequest = {
  seed: number;
  size: number;
};

export type GenerateResponse = {
  seed: number;
  size: number;
  ascii2d: string;
};

export type SyncState =
  | "loading"
  | "synced"
  | "dirty"
  | "saving"
  | "conflict"
  | "offline"
  | "error";

export type LocalDraft = {
  levelId: string;
  baseVersion: number;
  width: number;
  height: number;
  b64cells: string;
  savedAt: number;
};
