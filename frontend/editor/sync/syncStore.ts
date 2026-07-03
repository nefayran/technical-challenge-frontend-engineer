// Save loop with the backend as authority. Whole-level POSTs guarded by
// base_version (optimistic concurrency). The subtle branch: a save whose
// response was lost still bumped the server version, so the next attempt
// 409s — we GET the level and, if the server content is byte-equal to what
// we sent, adopt the new version silently instead of bothering the user.

import type { LevelResponse, SyncState } from "../types.ts";
import { CONFIG } from "../config.ts";
import { ApiError, loadLevel, storeLevel } from "./api.ts";

export type SyncEvents = {
  onStateChange: (state: SyncState) => void;
  onVersionChange: (version: number) => void;
  onConflict: (server: LevelResponse) => void;
};

export class SyncController {
  private levelId: string;
  private baseVersion: number;
  private state: SyncState = "synced";
  private readonly serialize: () => string;
  private readonly nameOf: () => string;
  private readonly events: SyncEvents;

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryDelay: number = CONFIG.sync.retryBaseMs;
  private editsSinceSnapshot = false;
  private saveInFlight = false;
  private disposed = false;

  constructor(
    levelId: string,
    baseVersion: number,
    serialize: () => string,
    nameOf: () => string,
    events: SyncEvents,
  ) {
    this.levelId = levelId;
    this.baseVersion = baseVersion;
    this.serialize = serialize;
    this.nameOf = nameOf;
    this.events = events;
  }

  get currentState(): SyncState {
    return this.state;
  }

  get version(): number {
    return this.baseVersion;
  }

  get id(): string {
    return this.levelId;
  }

  private setState(state: SyncState): void {
    if (this.state !== state) {
      this.state = state;
      this.events.onStateChange(state);
    }
  }

  private setVersion(version: number): void {
    this.baseVersion = version;
    this.events.onVersionChange(version);
  }

  markDirty(): void {
    if (this.disposed) {
      return;
    }
    this.editsSinceSnapshot = true;
    if (this.state === "conflict") {
      return;
    }
    if (!this.saveInFlight) {
      this.setState("dirty");
      this.scheduleSave(CONFIG.sync.saveDebounceMs);
    }
  }

  flushNow(): void {
    if (this.state === "dirty") {
      this.scheduleSave(0);
    }
  }

  private scheduleSave(delayMs: number): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.save();
    }, delayMs);
  }

  private async save(): Promise<void> {
    if (this.disposed || this.saveInFlight || this.state === "conflict") {
      return;
    }
    this.saveInFlight = true;
    this.setState("saving");
    this.editsSinceSnapshot = false;
    const sent = { ascii2d: this.serialize(), baseVersion: this.baseVersion };

    try {
      const response = await storeLevel({
        ascii2d: sent.ascii2d,
        id: this.levelId,
        base_version: sent.baseVersion,
        name: this.nameOf(),
      });
      this.onSaveSuccess(response.version);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        await this.reconcile(sent.ascii2d);
      } else if (error instanceof ApiError) {
        this.setState("error");
        console.error("Save rejected:", error.detail);
      } else {
        this.onNetworkFailure();
      }
    } finally {
      this.saveInFlight = false;
    }
  }

  private onSaveSuccess(version: number): void {
    this.retryDelay = CONFIG.sync.retryBaseMs;
    this.setVersion(version);
    if (this.editsSinceSnapshot) {
      this.setState("dirty");
      this.scheduleSave(CONFIG.sync.saveDebounceMs);
    } else {
      this.setState("synced");
    }
  }

  private async reconcile(sentAscii2d: string): Promise<void> {
    let server: LevelResponse;
    try {
      server = await loadLevel(this.levelId);
    } catch {
      this.onNetworkFailure();
      return;
    }
    if (server.ascii2d === sentAscii2d) {
      // Lost-response case: the server already holds exactly what we sent.
      this.onSaveSuccess(server.version);
      return;
    }
    this.setState("conflict");
    this.events.onConflict(server);
  }

  private onNetworkFailure(): void {
    this.setState("offline");
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
    }
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.save();
    }, this.retryDelay);
    this.retryDelay = Math.min(CONFIG.sync.retryMaxMs, this.retryDelay * 2);
  }

  // Conflict resolution. "Theirs": the caller has replaced the local grid with
  // the server content already. "Mine": rebase our content onto the server
  // version and resend.
  resolveTakeTheirs(serverVersion: number): void {
    this.setVersion(serverVersion);
    this.editsSinceSnapshot = false;
    this.setState("synced");
  }

  resolveKeepMine(serverVersion: number): void {
    this.setVersion(serverVersion);
    this.setState("dirty");
    this.scheduleSave(0);
  }

  dispose(): void {
    this.disposed = true;
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
    }
  }
}
