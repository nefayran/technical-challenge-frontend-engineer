"""Level storage: an in-memory dict with write-through JSON persistence.

A level is opaque ascii2d text plus a monotonic ``version``. The version is the
backend's authority signal: every accepted write bumps it, and updates must
quote the ``base_version`` they were derived from. A stale ``base_version`` is
rejected with ``VersionConflict``, so a reconnecting or duplicated client cannot
silently clobber newer work or double-apply an edit.

Persistence happens under the same lock as the write that caused it, via an
atomic tempfile rename, so the file on disk is always a consistent snapshot
and the version/conflict contract above is unchanged.
"""

import json
import os
import tempfile
import threading
import uuid
from dataclasses import asdict, dataclass
from pathlib import Path


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


DEFAULT_DB_PATH = Path(__file__).resolve().parent / "levels.json"


class LevelStore:
    def __init__(self, db_path: Path | None = None) -> None:
        self._levels: dict[str, StoredLevel] = {}
        self._lock = threading.Lock()
        self._db_path = db_path or Path(
            os.environ.get("LEVELS_DB_PATH", DEFAULT_DB_PATH)
        )
        self._load()

    def _load(self) -> None:
        try:
            raw = json.loads(self._db_path.read_text())
        except (FileNotFoundError, json.JSONDecodeError):
            return
        self._levels = {
            item["id"]: StoredLevel(**item) for item in raw.get("levels", [])
        }

    def _persist_locked(self) -> None:
        """Write the current state atomically; caller must hold the lock."""
        payload = json.dumps(
            {"levels": [asdict(level) for level in self._levels.values()]}
        )
        fd, tmp_path = tempfile.mkstemp(
            dir=self._db_path.parent, prefix=self._db_path.name, suffix=".tmp"
        )
        try:
            with os.fdopen(fd, "w") as handle:
                handle.write(payload)
            os.replace(tmp_path, self._db_path)
        except BaseException:
            os.unlink(tmp_path)
            raise

    def create(self, ascii2d: str) -> StoredLevel:
        level = StoredLevel(id=uuid.uuid4().hex, version=1, ascii2d=ascii2d)
        with self._lock:
            self._levels[level.id] = level
            self._persist_locked()
        return level

    def seed(self, level_id: str, ascii2d: str) -> StoredLevel:
        """Preload a level under a fixed id unless it already exists.

        Seeding must not overwrite: with persistence, edits to the seeded
        level survive restarts and an unconditional overwrite would drop them.
        """
        with self._lock:
            existing = self._levels.get(level_id)
            if existing is not None:
                return existing
            level = StoredLevel(id=level_id, version=1, ascii2d=ascii2d)
            self._levels[level_id] = level
            self._persist_locked()
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
            self._persist_locked()
        return updated

    def ids(self) -> list[str]:
        with self._lock:
            return list(self._levels.keys())
