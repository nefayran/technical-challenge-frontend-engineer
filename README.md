# Maze Chase

A Pac-Man-like game and an online 2D level editor for designing its levels.
See `technical-challenge-frontend-engineer.md` for the task.

## Quick start

```bash
bun install && uv sync
uv run backend
bun run game     # playground on :3000
bun run editor   # level editor on :3001
bun test         # unit tests (add --coverage for the report)
bun run e2e      # end-to-end suite; needs ports 8000/3001 free
                 # once before first e2e run: bunx playwright install chromium
```

The editor lives in `frontend/editor/`; design notes are in [REPORT.md](REPORT.md).
