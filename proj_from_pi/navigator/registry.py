"""
Lot Registry — CRUD for parking lot definitions stored in SQLite.

Each lot has: id, name, address, camera_index, enabled, tiers (JSON).
The tiers JSON follows the same structure as lot_config.py:
  [{"id": "lower", "label": "Lower Deck", "spaces": ["L1","L2",...]}, ...]
"""

from __future__ import annotations

import json
from typing import Optional

from pydantic import BaseModel, Field

from db import get_db
from logging_config import get_logger

log = get_logger("registry")


# ── Pydantic models (used by admin API) ─────────────────────────────────────

class LotCreate(BaseModel):
    id: str
    name: str
    address: str = ""
    camera_index: int = 0
    enabled: bool = True
    tiers: list[dict] = Field(default_factory=list)


class LotPatch(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    camera_index: Optional[int] = None
    enabled: Optional[bool] = None
    tiers: Optional[list[dict]] = None


class LotConfig(BaseModel):
    id: str
    name: str
    address: str
    camera_index: int
    enabled: bool
    tiers: list[dict]
    total_spaces: int
    created_at: str
    updated_at: str


# ── Table init ───────────────────────────────────────────────────────────────

def init_registry():
    """Create the lots table (idempotent)."""
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS lots (
            id           TEXT PRIMARY KEY,
            name         TEXT NOT NULL,
            address      TEXT DEFAULT '',
            camera_index INTEGER DEFAULT 0,
            enabled      INTEGER DEFAULT 1,
            tiers        TEXT NOT NULL DEFAULT '[]',
            created_at   TEXT NOT NULL,
            updated_at   TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()


# ── Seed from static config ─────────────────────────────────────────────────

def seed_defaults():
    """Insert default lot from lot_config.py if the table is empty."""
    conn = get_db()
    count = conn.execute("SELECT COUNT(*) FROM lots").fetchone()[0]
    if count > 0:
        conn.close()
        return

    from lot_config import LOT_STATIC
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    tiers_json = json.dumps(LOT_STATIC["tiers"])

    conn.execute(
        """INSERT INTO lots (id, name, address, camera_index, enabled, tiers, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            LOT_STATIC["lot_id"],
            LOT_STATIC["name"],
            LOT_STATIC.get("address", ""),
            0,  # default camera index
            1,
            tiers_json,
            now,
            now,
        ),
    )
    conn.commit()
    conn.close()
    log.info(f"Seeded default lot: {LOT_STATIC['lot_id']}")


# ── CRUD ────────────────────────────────────────────────────────────────────

def get_all() -> list[dict]:
    """Return all lots ordered by creation time."""
    conn = get_db()
    rows = conn.execute("SELECT * FROM lots ORDER BY created_at").fetchall()
    conn.close()
    return [_row_to_dict(r) for r in rows]


def get_enabled() -> list[dict]:
    """Return only enabled lots."""
    conn = get_db()
    rows = conn.execute("SELECT * FROM lots WHERE enabled = 1 ORDER BY created_at").fetchall()
    conn.close()
    return [_row_to_dict(r) for r in rows]


def get_by_id(lot_id: str) -> Optional[dict]:
    """Return a single lot or None."""
    conn = get_db()
    row = conn.execute("SELECT * FROM lots WHERE id = ?", (lot_id,)).fetchone()
    conn.close()
    return _row_to_dict(row) if row else None


def exists(lot_id: str) -> bool:
    conn = get_db()
    row = conn.execute("SELECT 1 FROM lots WHERE id = ?", (lot_id,)).fetchone()
    conn.close()
    return row is not None


def get_camera_index(lot_id: str) -> int:
    """Return the camera_index for a lot, or 0 if not found."""
    conn = get_db()
    row = conn.execute("SELECT camera_index FROM lots WHERE id = ?", (lot_id,)).fetchone()
    conn.close()
    return row[0] if row else 0


def create(lot: LotCreate) -> dict:
    """Create a new lot. Raises ValueError if ID already exists."""
    if exists(lot.id):
        raise ValueError(f"Lot '{lot.id}' already exists")
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    tiers_json = json.dumps(lot.tiers)

    conn = get_db()
    conn.execute(
        """INSERT INTO lots (id, name, address, camera_index, enabled, tiers, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (lot.id, lot.name, lot.address, lot.camera_index, int(lot.enabled), tiers_json, now, now),
    )
    conn.commit()
    conn.close()
    log.info(f"Created lot: {lot.id}")
    return get_by_id(lot.id)


def update(lot_id: str, patch: LotPatch) -> dict:
    """Patch an existing lot. Raises KeyError if not found."""
    existing = get_by_id(lot_id)
    if not existing:
        raise KeyError(f"Lot '{lot_id}' not found")

    updates = {}
    if patch.name is not None:
        updates["name"] = patch.name
    if patch.address is not None:
        updates["address"] = patch.address
    if patch.camera_index is not None:
        updates["camera_index"] = patch.camera_index
    if patch.enabled is not None:
        updates["enabled"] = int(patch.enabled)
    if patch.tiers is not None:
        updates["tiers"] = json.dumps(patch.tiers)

    if not updates:
        return existing

    from datetime import datetime, timezone
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [lot_id]

    conn = get_db()
    conn.execute(f"UPDATE lots SET {set_clause} WHERE id = ?", values)
    conn.commit()
    conn.close()
    log.info(f"Updated lot {lot_id}: {list(updates.keys())}")
    return get_by_id(lot_id)


def delete(lot_id: str) -> None:
    """Delete a lot. Raises KeyError if not found or if it's the last lot."""
    if not exists(lot_id):
        raise KeyError(f"Lot '{lot_id}' not found")
    conn = get_db()
    count = conn.execute("SELECT COUNT(*) FROM lots").fetchone()[0]
    if count <= 1:
        conn.close()
        raise ValueError("Cannot delete the last remaining lot")
    conn.execute("DELETE FROM lots WHERE id = ?", (lot_id,))
    conn.commit()
    conn.close()
    log.info(f"Deleted lot: {lot_id}")


def count() -> int:
    conn = get_db()
    n = conn.execute("SELECT COUNT(*) FROM lots").fetchone()[0]
    conn.close()
    return n


# ── Helpers ─────────────────────────────────────────────────────────────────

def _row_to_dict(row) -> dict:
    """Convert a sqlite3.Row to a LotConfig dict with parsed tiers."""
    d = dict(row)
    try:
        d["tiers"] = json.loads(d.get("tiers", "[]"))
    except (json.JSONDecodeError, TypeError):
        d["tiers"] = []
    # Compute total_spaces from tiers
    d["total_spaces"] = sum(len(t.get("spaces", [])) for t in d["tiers"])
    d["enabled"] = bool(d.get("enabled", 1))
    return d
