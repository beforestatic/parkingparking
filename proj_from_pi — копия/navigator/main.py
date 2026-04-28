"""
=============================================================================
Parking Navigator API  —  main.py
=============================================================================

PURPOSE
-------
Receives real-time occupancy data from a Raspberry Pi detector and serves
it to mapping clients (2GIS, Yandex Maps, custom UIs) via a REST API.

HOW TO POINT THE DETECTOR AT THIS NAVIGATOR
-------------------------------------------
On the Raspberry Pi (or wherever parking_detector.py / sensor_reader.py run):

    export NAVIGATOR_API_URL="http://<this-machine-ip>:9000/ingest/parking"
    export NAVIGATOR_API_KEY="demo-key-01"

Replace <this-machine-ip> with the LAN IP of the machine running uvicorn.
Use 'ip addr' or 'hostname -I' to find it.

HOW TO RUN
----------
    pip install fastapi uvicorn
    cd navigator/
    uvicorn main:app --host 0.0.0.0 --port 9000 --reload

ENDPOINTS
---------
  POST /ingest/parking               — detector pushes occupancy updates
  GET  /api/v1/lots                  — list all lots (map client summary)
  GET  /api/v1/lots/{lot_id}         — full detail with per-space breakdown
  GET  /api/v1/lots/{lot_id}/spaces  — flat space list
  GET  /health                       — health check
  GET  /                             — demo HTML map panel (polls every 2s)

AUTH
----
  Ingest endpoint: X-API-Key: demo-key-01
  Map endpoints:   public, no auth required
=============================================================================
"""

import os
import socket
from datetime import datetime
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from demo_ui import DEMO_HTML
from lot_config import ALL_SPACE_IDS, LOT_STATIC, SPACE_LABELS
from db import init_db, log_ingest, log_space_event, get_history, start_session, log_error, get_errors
import json

from models import (
    HealthResponse,
    IngestPayload,
    IngestResponse,
    LotDetail,
    LotSummary,
    SpaceStatus,
    TierDetail,
)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

API_KEY: str = os.getenv("NAVIGATOR_API_KEY", "demo-key-01")

# ---------------------------------------------------------------------------
# In-memory state
# ---------------------------------------------------------------------------

# space_id -> {status, label, distance_cm}
_space_state: dict[str, dict] = {
    sid: {"status": "unknown", "label": SPACE_LABELS[sid], "distance_cm": None}
    for sid in ALL_SPACE_IDS
}

_last_ingest: Optional[datetime] = None
_session_id: Optional[int] = None
_total_updates: int = 0

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Parking Navigator API",
    description=(
        "Real-time smart parking lot navigator for 2GIS / Yandex Maps clients. "
        "Ingests occupancy data from a Raspberry Pi detector and exposes a "
        "standardised REST API for mapping applications."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Authentication dependency (ingest only)
# ---------------------------------------------------------------------------

def verify_api_key(request: Request) -> None:
    """Reject requests whose X-API-Key header does not match API_KEY."""
    key = request.headers.get("X-API-Key", "")
    if key != API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-API-Key header.",
        )

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _status_label(free: int) -> str:
    if free == 0:
        return "full"
    if free <= 2:
        return "limited"
    return "available"


def _build_summary() -> LotSummary:
    free = sum(1 for s in _space_state.values() if s["status"] == "free")
    occupied = sum(1 for s in _space_state.values() if s["status"] == "occupied")
    total: int = LOT_STATIC["total_spaces"]
    pct = round((free / total) * 100, 1) if total else 0.0
    return LotSummary(
        lot_id=LOT_STATIC["lot_id"],
        name=LOT_STATIC["name"],
        brand=LOT_STATIC["brand"],
        address=LOT_STATIC["address"],
        total_spaces=total,
        free_spaces=free,
        occupied_spaces=occupied,
        availability_pct=pct,
        status=_status_label(free),
        last_updated=_last_ingest,
    )


def _build_detail() -> LotDetail:
    summary = _build_summary()
    tiers: list[TierDetail] = []
    for tier_cfg in LOT_STATIC["tiers"]:
        spaces = [
            SpaceStatus(
                id=sid,
                label=_space_state[sid]["label"],
                status=_space_state[sid]["status"],
            )
            for sid in tier_cfg["spaces"]
            if sid in _space_state
        ]
        tiers.append(TierDetail(id=tier_cfg["id"], label=tier_cfg["label"], spaces=spaces))
    return LotDetail(**summary.model_dump(), tiers=tiers)

# ---------------------------------------------------------------------------
# Routes — ingest (Raspberry Pi → navigator)
# ---------------------------------------------------------------------------

@app.post("/ingest/parking", response_model=IngestResponse, tags=["Ingest"])
async def ingest_parking(
    payload: IngestPayload,
    _: None = Depends(verify_api_key),
) -> IngestResponse:
    """
    Receive an occupancy update from the detector.

    Only the spaces listed in the payload are updated; others retain their
    previous status.  Accepts payloads from both the camera detector and
    the ultrasonic sensor reader (distinguished by `source` field).
    """
    global _last_ingest

    for space in payload.spaces:
        if space.id in _space_state:
            _space_state[space.id]["status"] = space.status
            if space.label:
                _space_state[space.id]["label"] = space.label
            _space_state[space.id]["distance_cm"] = space.distance_cm

    _last_ingest = payload.timestamp
    global _total_updates
    _total_updates += 1

    # Log to database
    free = sum(1 for s in _space_state.values() if s["status"] == "free")
    occupied = sum(1 for s in _space_state.values() if s["status"] == "occupied")
    total = LOT_STATIC["total_spaces"]
    log_ingest(
        lot_id=payload.lot_id,
        timestamp=payload.timestamp.isoformat() if hasattr(payload.timestamp, "isoformat") else str(payload.timestamp),
        source=getattr(payload, "source", "camera"),
        total=total,
        free=free,
        occupied=occupied,
        raw_json=json.dumps([s.model_dump() for s in payload.spaces])
    )
    for space in payload.spaces:
        log_space_event(
            lot_id=payload.lot_id,
            space_id=space.id,
            status=space.status,
            timestamp=payload.timestamp.isoformat() if hasattr(payload.timestamp, "isoformat") else str(payload.timestamp),
            source=getattr(payload, "source", "camera"),
        )

    return IngestResponse(ok=True, received=len(payload.spaces))

# ---------------------------------------------------------------------------
# Routes — map client API (navigator → 2GIS / Yandex / custom UI)
# ---------------------------------------------------------------------------

@app.get("/api/v1/lots", response_model=list[LotSummary], tags=["Map API"])
async def list_lots() -> list[LotSummary]:
    """Return an availability summary for every known lot."""
    return [_build_summary()]


@app.get("/api/v1/lots/{lot_id}", response_model=LotDetail, tags=["Map API"])
async def get_lot(lot_id: str) -> LotDetail:
    """Return full detail for one lot including per-space and tier breakdown."""
    if lot_id != LOT_STATIC["lot_id"]:
        raise HTTPException(status_code=404, detail=f"Lot '{lot_id}' not found.")
    return _build_detail()


@app.get(
    "/api/v1/lots/{lot_id}/spaces",
    response_model=list[SpaceStatus],
    tags=["Map API"],
)
async def get_spaces(lot_id: str) -> list[SpaceStatus]:
    """Return flat list of all spaces with current status."""
    if lot_id != LOT_STATIC["lot_id"]:
        raise HTTPException(status_code=404, detail=f"Lot '{lot_id}' not found.")
    return [
        SpaceStatus(id=sid, label=state["label"], status=state["status"])
        for sid, state in _space_state.items()
    ]

# ---------------------------------------------------------------------------
# Routes — health check
# ---------------------------------------------------------------------------

@app.get("/api/v1/errors", tags=["Map API"])
async def get_error_log(limit: int = 100, component: str = None):
    """Return logged errors and failures."""
    return get_errors(limit=limit, component=component)

@app.get("/api/v1/lots/{lot_id}/history", tags=["Map API"])
async def get_lot_history(lot_id: str, limit: int = 100):
    """Return logged ingest history from SQLite database."""
    if lot_id != LOT_STATIC["lot_id"]:
        raise HTTPException(status_code=404, detail=f"Lot '{lot_id}' not found.")
    return get_history(lot_id, limit)

@app.get("/health", response_model=HealthResponse, tags=["Meta"])
async def health() -> HealthResponse:
    """Simple liveness + last-ingest timestamp."""
    return HealthResponse(ok=True, lots=1, last_ingest=_last_ingest)

# ---------------------------------------------------------------------------
# Routes — demo UI
# ---------------------------------------------------------------------------

@app.get("/", response_class=HTMLResponse, tags=["Demo UI"], include_in_schema=False)
async def demo_ui() -> HTMLResponse:
    """Serve the self-contained demo map panel (polls the API every 2 s)."""
    return HTMLResponse(content=DEMO_HTML)

# ---------------------------------------------------------------------------
# Startup banner
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def on_startup() -> None:
    global _session_id
    init_db()
    _session_id = start_session("live")

    try:
        hostname = socket.gethostname()
        local_ip = socket.gethostbyname(hostname)
    except Exception:
        local_ip = "127.0.0.1"

    port = 9000
    print("\n" + "=" * 60)
    print("  Parking Navigator API  —  ready")
    print("=" * 60)
    print(f"  Demo UI    →  http://{local_ip}:{port}/")
    print(f"  API docs   →  http://{local_ip}:{port}/docs")
    print(f"  Ingest     →  http://{local_ip}:{port}/ingest/parking")
    print(f"  Key        →  {API_KEY}")
    print()
    print("  On the Raspberry Pi set:")
    print(f'    export NAVIGATOR_API_URL="http://{local_ip}:{port}/ingest/parking"')
    print(f'    export NAVIGATOR_API_KEY="{API_KEY}"')
    print("=" * 60 + "\n")
