"""
=============================================================================
Parking Navigator API  —  main.py
=============================================================================

PURPOSE
-------
Receives real-time occupancy data from a Raspberry Pi detector and serves
it to mapping clients (2GIS, Yandex Maps, custom UIs) via a REST API.

FEATURES
--------
- REST API for lot/occupancy data
- WebSocket broadcast for live updates (no polling needed)
- Structured JSON logging
- Centralised configuration (config.py)
- Automatic DB retention cleanup on startup
- Error handling middleware with consistent responses

HOW TO RUN
----------
    pip install fastapi uvicorn websockets
    cd navigator/
    uvicorn main:app --host 0.0.0.0 --port 9000 --reload

ENDPOINTS
---------
  POST /ingest/parking               — detector pushes occupancy updates
  GET  /api/v1/lots                  — list all lots (map client summary)
  GET  /api/v1/lots/{lot_id}         — full detail with per-space breakdown
  GET  /api/v1/lots/{lot_id}/spaces  — flat space list
  GET  /api/v1/lots/{lot_id}/history — ingest history from DB
  GET  /api/v1/sessions              — all sessions
  GET  /api/v1/errors                — error log
  GET  /health                       — health check
  WS   /ws/live                      — real-time occupancy stream
  GET  /                             — demo HTML map panel

AUTH
----
  Ingest endpoint: X-API-Key: demo-key-01
  Map endpoints:   public, no auth required
=============================================================================
"""

import asyncio
import json
import socket
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel

from config import API_KEY, LOT_ID, WS_BROADCAST_INTERVAL
from demo_ui import DEMO_HTML
from logging_config import get_logger
from lot_config import ALL_SPACE_IDS, LOT_STATIC, SPACE_LABELS
from db import (
    init_db, log_ingest, log_space_event, get_history,
    start_session, end_session, log_error, get_errors, get_sessions,
    cleanup_old_data,
)

from models import (
    HealthResponse,
    IngestPayload,
    IngestResponse,
    LotDetail,
    LotSummary,
    SpaceStatus,
    TierDetail,
)

log = get_logger("navigator")

# ---------------------------------------------------------------------------
# In-memory state
# ---------------------------------------------------------------------------

_space_state: dict[str, dict] = {
    sid: {"status": "unknown", "label": SPACE_LABELS[sid], "distance_cm": None}
    for sid in ALL_SPACE_IDS
}

_last_ingest: Optional[datetime] = None
_session_id: Optional[int] = None
_total_updates: int = 0

# ---------------------------------------------------------------------------
# WebSocket broadcast
# ---------------------------------------------------------------------------

_ws_clients: set[WebSocket] = set()
_ws_lock = asyncio.Lock()


async def _broadcast_loop():
    """Push current lot state to all connected WS clients every N seconds."""
    while True:
        await asyncio.sleep(WS_BROADCAST_INTERVAL)
        if not _ws_clients:
            continue
        summary = _build_summary()
        payload = summary.model_dump_json()
        dead: list[WebSocket] = []
        async with _ws_lock:
            for ws in _ws_clients:
                try:
                    await ws.send_text(payload)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                _ws_clients.discard(ws)


# ---------------------------------------------------------------------------
# Lifespan (startup / shutdown)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _session_id
    init_db()
    cleanup_old_data()
    _session_id = start_session("live")

    task = asyncio.create_task(_broadcast_loop())

    try:
        hostname = socket.gethostname()
        local_ip = socket.gethostbyname(hostname)
    except Exception:
        local_ip = "127.0.0.1"

    from config import PORT
    log.info("Parking Navigator API — ready")
    log.info(f"  Demo UI    →  http://{local_ip}:{PORT}/")
    log.info(f"  API docs   →  http://{local_ip}:{PORT}/docs")
    log.info(f"  Ingest     →  http://{local_ip}:{PORT}/ingest/parking")
    log.info(f"  WebSocket  →  ws://{local_ip}:{PORT}/ws/live")
    log.info(f"  Key        →  {API_KEY}")

    yield

    # Shutdown
    task.cancel()
    if _session_id:
        end_session(_session_id, _total_updates)
    log.info("Navigator shut down cleanly")


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
    version="1.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Error handling middleware — consistent JSON error responses
# ---------------------------------------------------------------------------

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": True,
            "status": exc.status_code,
            "message": exc.detail,
            "path": str(request.url.path),
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    log.error(f"Unhandled error on {request.url.path}: {exc}", exc_info=True)
    log_error("navigator", "unhandled_error", str(exc), type(exc).__name__)
    return JSONResponse(
        status_code=500,
        content={
            "error": True,
            "status": 500,
            "message": "Internal server error",
            "path": str(request.url.path),
        },
    )


# ---------------------------------------------------------------------------
# Authentication dependency (ingest only)
# ---------------------------------------------------------------------------

def verify_api_key(request: Request) -> None:
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


def _notify_ws_clients():
    """Fire-and-forget broadcast to WS clients after an ingest."""
    if not _ws_clients:
        return
    summary = _build_summary()
    payload = summary.model_dump_json()

    async def _send():
        dead: list[WebSocket] = []
        async with _ws_lock:
            for ws in _ws_clients:
                try:
                    await ws.send_text(payload)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                _ws_clients.discard(ws)

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_send())
    except RuntimeError:
        pass

# ---------------------------------------------------------------------------
# Routes — WebSocket live stream
# ---------------------------------------------------------------------------

@app.websocket("/ws/live")
async def ws_live(ws: WebSocket):
    await ws.accept()
    async with _ws_lock:
        _ws_clients.add(ws)
    log.info(f"WS client connected ({len(_ws_clients)} total)")
    try:
        # Send current state immediately
        summary = _build_summary()
        await ws.send_text(summary.model_dump_json())
        # Keep alive — read until disconnect
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        async with _ws_lock:
            _ws_clients.discard(ws)
        log.info(f"WS client disconnected ({len(_ws_clients)} total)")

# ---------------------------------------------------------------------------
# Routes — ingest (Raspberry Pi → navigator)
# ---------------------------------------------------------------------------

@app.post("/ingest/parking", response_model=IngestResponse, tags=["Ingest"])
async def ingest_parking(
    payload: IngestPayload,
    _: None = Depends(verify_api_key),
) -> IngestResponse:
    global _last_ingest, _total_updates

    for space in payload.spaces:
        if space.id in _space_state:
            _space_state[space.id]["status"] = space.status
            if space.label:
                _space_state[space.id]["label"] = space.label
            _space_state[space.id]["distance_cm"] = space.distance_cm

    _last_ingest = payload.timestamp
    _total_updates += 1

    # Log to database
    free = sum(1 for s in _space_state.values() if s["status"] == "free")
    occupied = sum(1 for s in _space_state.values() if s["status"] == "occupied")
    total = LOT_STATIC["total_spaces"]
    ts_str = payload.timestamp.isoformat() if hasattr(payload.timestamp, "isoformat") else str(payload.timestamp)
    source = getattr(payload, "source", "camera")

    log_ingest(
        lot_id=payload.lot_id,
        timestamp=ts_str,
        source=source,
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
            timestamp=ts_str,
            source=source,
        )

    log.info(
        f"Ingest: {free}/{total} free from {source}",
        extra={"component": "ingest", "lot_id": payload.lot_id},
    )

    # Push to WS clients immediately
    _notify_ws_clients()

    return IngestResponse(ok=True, received=len(payload.spaces))

# ---------------------------------------------------------------------------
# Routes — map client API (navigator → 2GIS / Yandex / custom UI)
# ---------------------------------------------------------------------------

@app.get("/api/v1/lots", response_model=list[LotSummary], tags=["Map API"])
async def list_lots() -> list[LotSummary]:
    return [_build_summary()]


@app.get("/api/v1/lots/{lot_id}", response_model=LotDetail, tags=["Map API"])
async def get_lot(lot_id: str) -> LotDetail:
    if lot_id != LOT_STATIC["lot_id"]:
        raise HTTPException(status_code=404, detail=f"Lot '{lot_id}' not found.")
    return _build_detail()


@app.get("/api/v1/lots/{lot_id}/spaces", response_model=list[SpaceStatus], tags=["Map API"])
async def get_spaces(lot_id: str) -> list[SpaceStatus]:
    if lot_id != LOT_STATIC["lot_id"]:
        raise HTTPException(status_code=404, detail=f"Lot '{lot_id}' not found.")
    return [
        SpaceStatus(id=sid, label=state["label"], status=state["status"])
        for sid, state in _space_state.items()
    ]


@app.get("/api/v1/lots/{lot_id}/history", tags=["Map API"])
async def get_lot_history(lot_id: str, limit: int = 100):
    if lot_id != LOT_STATIC["lot_id"]:
        raise HTTPException(status_code=404, detail=f"Lot '{lot_id}' not found.")
    return get_history(lot_id, limit)


@app.get("/api/v1/errors", tags=["Map API"])
async def get_error_log(limit: int = 100, component: str = None):
    return get_errors(limit=limit, component=component)


class ErrorLogPayload(BaseModel):
    component: str
    error_type: str
    message: str
    detail: str = None


@app.post("/api/v1/errors/log", tags=["Map API"])
async def post_error_log(payload: ErrorLogPayload):
    """Receive error logs from other components (detector, sensor reader)."""
    log_error(payload.component, payload.error_type, payload.message, payload.detail)
    return {"ok": True}


@app.get("/api/v1/sessions", tags=["Map API"])
async def get_sessions_list():
    return get_sessions()

# ---------------------------------------------------------------------------
# Routes — health check
# ---------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse, tags=["Meta"])
async def health() -> HealthResponse:
    return HealthResponse(ok=True, lots=1, last_ingest=_last_ingest)

# ---------------------------------------------------------------------------
# Routes — demo UI
# ---------------------------------------------------------------------------

@app.get("/", response_class=HTMLResponse, tags=["Demo UI"], include_in_schema=False)
async def demo_ui() -> HTMLResponse:
    return HTMLResponse(content=DEMO_HTML)
