# Level editor — report

Run: `bun install && uv sync`, then `uv run backend` and `bun run editor` → http://localhost:3001. Tests: `bun test`.

## Technical decisions

**Cell model.** One byte per cell (`Uint8Array`, 12 codes). Engine's `BlockValue` objects would be 1M heap allocations at 1000×1000; flat bytes make the board 1MB and every tool O(touched cells). Own lossless ascii2d codec: the engine's `toAscii2d` writes walls only and would strip pellets and spawns on the first save. Codec is unit-tested cell-by-cell against the engine parser.

**Rendering.** One canvas, camera {x, y, px/cell}, draw only the visible rect. At ≥4px/cell — glyphs; below — blit of a 1px/cell offscreen bitmap updated per edit, so far zoom of 1M cells is one scaled `drawImage`. Grid lives outside Vue reactivity; canvas repaints on an explicit tick. Measured: 8.4ms average frame during a paint drag on 1000×1000.

**Undo.** Sparse diffs `{indices, before, after}` per stroke under a byte budget. Memory tracks edit size, not board size.

**Sync.** Debounced autosave (800ms idle), whole board + `base_version` — the API is whole-level store with optimistic locking, no delta protocol invented. Trade-off: server versions become a conflict detector, not a save history. On 409, re-read the level: server byte-equal to what was sent = lost response, adopt the version silently — this is why retries never double-apply. Otherwise a dialog: take theirs (one undoable patch) or keep mine (rebase onto the server version, resend). Network failure: offline badge, exponential retry, editing continues.

**Crash safety.** `sendBeacon`/`fetch keepalive` cap at 64KB; a 1000×1000 board is ~4MB, so flush-on-unload is out. While unsaved, a local draft is throttle-written (raw cells, base64, ~1.4MB for 1M cells). On reload the backend state always loads; a differing draft is offered in a banner, never auto-applied.

**Backend (modified).** `storage.py` TODO implemented: write-through JSON under the existing lock, atomic rename, version contract untouched. Gotchas: `seed()` overwrote `classic` on every restart (now seed-if-absent); uvicorn's reload watcher restarted the server on each save until `levels.json` was excluded.

**Playtest.** Engine is pure TS — "Play" runs it on the serialized grid in an overlay. Full-board draw dies at 1000×1000, so: follow camera, same culling, pellet lookup by binary search on the engine's (x, y)-sorted array.

**Chrome.** Design tokens: one TS object injected as CSS custom properties and read by the canvas palette; a theme switch rebuilds the overview bitmap. Palette from noeon.ai — near-black ground, hairline borders, zero radii, violet/magenta accents — tokens only, no assets copied. i18n en/ru/ja via a ~30-line `t()`; vue-i18n rejected as a new framework. Keyboard: 1–6 tools, Cmd/Ctrl+Z/Shift+Z, F fit, Space pan; canvas is focusable — arrow-key cell cursor, Enter stamps, aria-live position readout.

## What I read, and what I chose not to change

Read all of `frontend/game/engine/` (board/ascii2d/coord/player/ghost/engine), the Vue playground, and both backend packages before writing code. Not changed: the engine (including the lossy `toAscii2d` — the editor works around it rather than "fixing" shipped behavior other code may rely on; noted here instead), the game playground, the generator, the API surface and its version contract. Changed: `storage.py`/`app.py` as described, plus `package.json` scripts.

## AI usage

Claude Code wrote most of the code. My part:

- **Architecture and product calls, made before generation**: the byte-grid + own codec, the overview-bitmap zoom strategy, autosave-over-versions, the 409 lost-response reconciliation, draft-offered-never-applied, implementing the backend TODO.
- **Structural steering mid-flight**, as I reviewed the output: when the first `HISTORY_BYTE_BUDGET` constant appeared, I had every tunable extracted into `config.ts`; shared types went into one `types.ts` mirroring the backend's Pydantic models instead of per-module duplicates.
- **Design system**: I asked for tokens up front — one TS source feeding both the CSS variables and the canvas palette — then re-skinned it to a reference site's visual language. That took supervision: the first pass left raw `px` values in component CSS (swept into tokens on my prompt), and the re-skin produced three radius tokens all set to `0px`, which I had collapsed to one.
- **Same prompt-review-correct pattern** for i18n (hand-rolled, en/ru/ja), keyboard/ARIA accessibility with an arrow-key cell cursor on the canvas, hand-drawn SVG icons replacing emoji glyphs, and level naming end-to-end.
- **Verification**: 73 unit tests, ~99% line coverage of the editor code (`bun test --coverage`; the given engine is excluded), plus a committed Playwright e2e suite (`bun run e2e`, test-only devDependency) that boots its own backend and editor and runs four scenarios: paint → autosave → version bump, 1000×1000 frame budget, a forced 409 with a foreign write, and offline-crash-draft-restore with the backend killed and revived mid-session.
- **What it produced by default and I refused to keep**: raw hex/px values inline in component CSS instead of a token system; types duplicated across modules instead of one `types.ts`; magic numbers scattered through the code instead of a single `config.ts`; a generic look with emoji as icons instead of a deliberate visual language; no keyboard access or ARIA on the canvas. Each of these shipped only after I made it redo the work properly.
Open question I did not get to: collaborative editing on top of this API — per-cell diffs against the 409 snapshot would allow three-way merge of non-overlapping edits instead of the binary theirs/mine choice, without any backend change.
