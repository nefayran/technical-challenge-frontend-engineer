"""FastAPI service for the level editor.

Endpoints (the editor in ``frontend/editor/`` is the client):

    GET  /level/load?id=...   load a stored level
    POST /level/store         create (no id) or update (id + base_version)
    POST /level/generate      deterministic board from (seed, size)
    GET  /levels              list known level ids

Storage is in-memory only (see ``storage.py``); restarting the process clears
everything except the CLASSIC level, which is re-seeded on startup.
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from ..generator import CLASSIC, generate
from .models import (
    GenerateRequest,
    GenerateResponse,
    LevelResponse,
    StoreRequest,
)
from .storage import LevelNotFound, LevelStore, StoredLevel, VersionConflict

CLASSIC_LEVEL_ID = "classic"

app = FastAPI(title="Maze Chase level service")

# No auth and no deployment in scope; the editor runs on a different dev port,
# so allow any origin for local development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

store = LevelStore()
store.seed(CLASSIC_LEVEL_ID, CLASSIC)


def _as_response(level: StoredLevel) -> LevelResponse:
    return LevelResponse(id=level.id, version=level.version, ascii2d=level.ascii2d)


@app.get("/level/load")
def load_level(id: str = Query(...)) -> LevelResponse:
    try:
        return _as_response(store.get(id))
    except LevelNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/level/store")
def store_level(request: StoreRequest) -> LevelResponse:
    if request.id is None:
        return _as_response(store.create(request.ascii2d))

    if request.base_version is None:
        raise HTTPException(
            status_code=422,
            detail="base_version is required when updating an existing level",
        )
    try:
        updated = store.update(request.id, request.ascii2d, request.base_version)
    except LevelNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except VersionConflict as exc:
        # 409 lets the editor reconcile against authoritative state instead of
        # silently overwriting a newer version.
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _as_response(updated)


@app.post("/level/generate")
def generate_level(request: GenerateRequest) -> GenerateResponse:
    ascii2d = generate(request.seed, request.size)
    return GenerateResponse(seed=request.seed, size=request.size, ascii2d=ascii2d)


@app.get("/levels")
def list_levels() -> list[str]:
    return store.ids()


def main() -> None:
    import uvicorn

    uvicorn.run("backend.server.app:app", host="127.0.0.1", port=8000, reload=True)
