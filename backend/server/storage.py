"""In-memory level storage. Process-local, no persistence across restarts.

A level is opaque ascii2d text plus a monotonic ``version``. The version is the
backend's authority signal: every accepted write bumps it, and updates must
quote the ``base_version`` they were derived from. A stale ``base_version`` is
rejected with ``VersionConflict``, so a reconnecting or duplicated client cannot
silently clobber newer work or double-apply an edit.
"""

import threading
import uuid
from dataclasses import dataclass


@dataclass(frozen=True)
class StoredLevel:
    id: str
    version: int
    ascii2d: str


class LevelNotFound(Exception):
    def __init__(self, level_id: str) -> None:
        super().__init__(f"No level with id {level_id!r}")
        self.level_id = level_id


class VersionConflict(Exception):
    """Raised when an update's base_version is not the current version."""

    def __init__(self, level_id: str, expected: int, actual: int) -> None:
        super().__init__(
            f"Stale write to {level_id!r}: based on version {expected}, "
            f"current is {actual}"
        )
        self.level_id = level_id
        self.expected = expected
        self.actual = actual


class LevelStore:
    # TODO: persist levels so work survives a process restart; the dict below is
    # wiped on every restart (only CLASSIC is re-seeded). Back it with durable
    # storage without changing the version/conflict contract above.
    def __init__(self) -> None:
        self._levels: dict[str, StoredLevel] = {}
        self._lock = threading.Lock()

    def create(self, ascii2d: str) -> StoredLevel:
        level = StoredLevel(id=uuid.uuid4().hex, version=1, ascii2d=ascii2d)
        with self._lock:
            self._levels[level.id] = level
        return level

    def seed(self, level_id: str, ascii2d: str) -> StoredLevel:
        """Insert a level under a fixed id (used to preload CLASSIC)."""
        level = StoredLevel(id=level_id, version=1, ascii2d=ascii2d)
        with self._lock:
            self._levels[level_id] = level
        return level

    def get(self, level_id: str) -> StoredLevel:
        with self._lock:
            level = self._levels.get(level_id)
        if level is None:
            raise LevelNotFound(level_id)
        return level

    def update(self, level_id: str, ascii2d: str, base_version: int) -> StoredLevel:
        with self._lock:
            current = self._levels.get(level_id)
            if current is None:
                raise LevelNotFound(level_id)
            if current.version != base_version:
                raise VersionConflict(level_id, base_version, current.version)
            updated = StoredLevel(
                id=level_id, version=current.version + 1, ascii2d=ascii2d
            )
            self._levels[level_id] = updated
        return updated

    def ids(self) -> list[str]:
        with self._lock:
            return list(self._levels.keys())
