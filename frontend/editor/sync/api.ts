import { CONFIG } from "../config.ts";
import type { GenerateResponse, LevelResponse, LevelSummary, StoreRequest } from "../types.ts";

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(`API ${status}: ${detail}`);
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${CONFIG.sync.apiBase}${path}`, {
    ...init,
    signal: AbortSignal.timeout(CONFIG.sync.requestTimeoutMs),
  });
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = (await response.json()) as { detail?: string };
      if (typeof body.detail === "string") {
        detail = body.detail;
      }
    } catch {
      // non-JSON error body; keep statusText
    }
    throw new ApiError(response.status, detail);
  }
  return (await response.json()) as T;
}

export function loadLevel(id: string): Promise<LevelResponse> {
  return request<LevelResponse>(`/level/load?id=${encodeURIComponent(id)}`);
}

export function storeLevel(body: StoreRequest): Promise<LevelResponse> {
  return request<LevelResponse>("/level/store", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function generateLevel(seed: number, size: number): Promise<GenerateResponse> {
  return request<GenerateResponse>("/level/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seed, size }),
  });
}

export function listLevels(): Promise<LevelSummary[]> {
  return request<LevelSummary[]>("/levels");
}
