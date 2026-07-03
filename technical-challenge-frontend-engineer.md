# Technical challenge — Frontend Engineer

**Topic:** 2D game level editor
**Estimated time:** 4-8 hours
**Submission format:** project git repository

## Background: Pacman-like game

A grid of cells: walls, corridors, pellets, power pellets, spawn points for the player and ghosts. The player navigates corridors collecting pellets; ghosts patrol and chase; touching a ghost ends a life. A power pellet briefly makes ghosts vulnerable.

`frontend/game/engine/` is the source of truth for the exact mechanics this engine supports. The editor is for designing levels — placing walls, pellets, spawns — that this engine plays.

## What you're given

- `frontend/game/engine/` — Core game engine. Pure TypeScript.
- `frontend/game/` — Minimalistic playground. Vue3.
- `backend/server/` — Backend level database. FastAPI.
- `backend/generator/` — Deterministic generator of game boards.

Toolchain: **bun**, **uv**, Vue, TypeScript, FastAPI.

## Task

Implement level editor in `frontend/editor/`.

Editor requirements:

- **Good UX.** Be nice to the user. Anticipate what they're about to do. The shape of the editor — controls, layout, interactions, feedback — is your call. Design and defend it.
- **Performance.** Edits of 1000x1000 grid should feel snappy and responsive as 10x10.
- **Backend is authority.** On reload or abrupt disconnect, the editor restores from the backend cleanly. No silent loss of work, no double-applied edits.

When the brief or starter code is ambiguous, make a reasonable call, keep moving, and explain the trade-off in `REPORT.md`.
Modify provided sources if you need to.

## Deliverables

1. **Working editor** that builds and runs from a clean clone.
2. **Written report** (`REPORT.md` at repo root, <=2 screens) covering:
   1. What technical decisions you made and why — boundaries, data structures, sync design.
   2. What you read in the given code, and what you chose **not** to change. Be specific.
   3. How you used AI tools, and what for — what you let it write, what you wrote yourself, what it tried to add that you refused.

## Evaluation

We are not looking for an AAA-level editor. We are looking for evidence of:

- **Mature UI** — a clear understanding of what the editor is doing and why your design helps the user, not just bluntly follows the spec.
- **Engineering judgement** — knowing when to iterate, when to simplify, when a negative result is itself informative.
- **Communication** — explaining non-trivial choices concisely and honestly, including dead ends.
- **Intellectual curiosity** — going slightly past the minimum; an interesting follow-up question about the problem, even if you didn't have time to answer it.
- **AI under control** — the most interesting decisions on this task are the ones AI is worst at making for you. Where you spent your own attention, and what you refused to let AI add, is part of the work.

## Scope notes

- No auth, no multi-user, no deployment.
- No new framework, language, or build system.
- No changes to game mechanics 