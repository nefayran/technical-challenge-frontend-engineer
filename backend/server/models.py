"""Request/response schemas for the level API."""

from pydantic import BaseModel, Field

from ..generator.maze import MAX_SIZE, MIN_SIZE


class StoreRequest(BaseModel):
    # id absent => create a new level; id present => update that level, and
    # base_version must quote the version the edit was derived from.
    # name is optional metadata; None keeps the stored name on update.
    ascii2d: str
    id: str | None = None
    base_version: int | None = None
    name: str | None = None


class LevelResponse(BaseModel):
    id: str
    version: int
    ascii2d: str
    name: str


class LevelSummary(BaseModel):
    id: str
    name: str


class GenerateRequest(BaseModel):
    seed: int
    size: int = Field(ge=MIN_SIZE, le=MAX_SIZE)


class GenerateResponse(BaseModel):
    seed: int
    size: int
    ascii2d: str
