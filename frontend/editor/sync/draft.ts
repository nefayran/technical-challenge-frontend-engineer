// Crash-recovery draft in localStorage. sendBeacon/keepalive cap payloads at
// 64KB, so flushing a large board on unload is not an option; instead the raw
// cell bytes are stored base64-encoded (1M cells ~ 1.4MB, inside the quota
// where the 4MB UTF-16 ascii2d string would not be).

import { CONFIG } from "../config.ts";
import type { LevelGrid, LocalDraft } from "../types.ts";

function key(levelId: string): string {
  return `${CONFIG.draft.keyPrefix}${levelId}`;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function saveDraft(levelId: string, baseVersion: number, grid: LevelGrid): void {
  const draft: LocalDraft = {
    levelId,
    baseVersion,
    width: grid.width,
    height: grid.height,
    b64cells: toBase64(grid.cells),
    savedAt: Date.now(),
  };
  try {
    localStorage.setItem(key(levelId), JSON.stringify(draft));
  } catch {
    // Quota exceeded — drop the draft rather than break editing.
  }
}

export function loadDraft(levelId: string): { draft: LocalDraft; grid: LevelGrid } | null {
  const raw = localStorage.getItem(key(levelId));
  if (raw === null) {
    return null;
  }
  try {
    const draft = JSON.parse(raw) as LocalDraft;
    const cells = fromBase64(draft.b64cells);
    if (cells.length !== draft.width * draft.height) {
      return null;
    }
    return { draft, grid: { width: draft.width, height: draft.height, cells } };
  } catch {
    return null;
  }
}

export function clearDraft(levelId: string): void {
  localStorage.removeItem(key(levelId));
}
