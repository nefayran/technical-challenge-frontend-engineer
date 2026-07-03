# Maze Chase

A Pac-Man-like game and an online 2D level editor for designing its levels.
See `technical-challenge-frontend-engineer.md` for the task.

## Quick start

```bash
bun install && uv sync
uv run backend
bun run game     # playground on :3000
bun run editor   # level editor on :3001
bun test         # editor unit tests
```

The editor lives in `frontend/editor/`; design notes are in [REPORT.md](REPORT.md).
