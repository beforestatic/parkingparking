"""
=============================================================================
Parking Navigator API  —  main.py (multi-lot)
=============================================================================

PURPOSE
-------
Receives real-time occupancy data from one or more parking lot detectors and
serves it to mapping clients (2GIS, Yandex Maps, custom UIs) via a REST API.

Supports a dynamic lot registry — lots can be created, updated, or removed
at runtime through the admin API.  Each lot can be assigned a camera index
and independently enabled/disabled.

FEATURES
--------
- REST API for lot/occupancy data (multi-lot)
- WebSocket broadcast for live updates (all lots in one stream)
- Lot registry (CRUD via admin API, persisted in SQLite)
- Per-lot camera assignment
- Structured JSON logging
- Centralised configuration (config.py)
- Automatic DB retention cleanup on startup

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
  WS   /ws/live                      — real-time occupancy stream (all lots)
  GET  /                             — demo HTML map panel

  ADMIN (lot registry):
  GET    /admin/lots                  — list all lots
  POST   /admin/lots                  — create a new lot
  GET    /admin/lots/{lot_id}         — get a single lot
  PATCH  /admin/lots/{lot_id}         — update lot config
  DELETE /admin/lots/{lot_id}         — delete a lot
  PUT    /admin/lots/{lot_id}/camera  — set camera index

AUTH
----
  Ingest endpoint: X-API-Key: demo-key-01
  Map endpoints:   public, no auth required
  Admin endpoints: public (same network only)
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

from config import API_KEY, WS_BROADCAST_INTERVAL
from demo_ui import DEMO_HTML
from logging_config import get_logger
from lot_config import LOT_STATIC, SPACE_LABELS
from db import (
    init_db, log_ingest, log_space_event, get_history,
    start_session, end_session, log_error, get_errors, get_sessions,
    cleanup_old_data,
)
import registry
from registry import LotCreate, LotPatch

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
# In-memory state  (per-lot)
# ---------------------------------------------------------------------------

# { lot_id: { space_id: {"status": str, "label": str, "distance_cm": float|None} } }
_lot_state: dict[str, dict[str, dict]] = {}

_last_ingest: dict[str, Optional[datetime]] = {}
_session_id: Optional[int] = None
_total_updates: int = 0


def _ensure_lot(lot_id: str) -> None:
    """Make sure in-memory state exists for a lot (from registry)."""
    if lot_id in _lot_state:
        return
    lot = registry.get_by_id(lot_id)
    if not lot:
        return
    space_map: dict[str, dict] = {}
    for tier in lot.get("tiers", []):
        for sid in tier.get("spaces", []):
            space_map[sid] = {
                "status": "unknown",
                "label": SPACE_LABELS.get(sid, sid),
                "distance_cm": None,
            }
    _lot_state[lot_id] = space_map
    _last_ingest[lot_id] = None


def _init_all_lots() -> None:
    """Load all enabled lots from the registry into memory."""
    for lot in registry.get_enabled():
        lid = lot["id"]
        if lid not in _lot_state:
            space_map: dict[str, dict] = {}
            for tier in lot.get("tiers", []):
                for sid in tier.get("spaces", []):
                    space_map[sid] = {
                        "status": "unknown",
                        "label": SPACE_LABELS.get(sid, sid),
                        "distance_cm": None,
                    }
            _lot_state[lid] = space_map
            _last_ingest[lid] = None


def _rebuild_lot_state(lot_id: str) -> None:
    """Rebuild in-memory state for a lot after config change."""
    lot = registry.get_by_id(lot_id)
    if not lot:
        _lot_state.pop(lot_id, None)
        _last_ingest.pop(lot_id, None)
        return
    new_spaces: dict[str, dict] = {}
    for tier in lot.get("tiers", []):
        for sid in tier.get("spaces", []):
            existing = _lot_state.get(lot_id, {}).get(sid, {})
            new_spaces[sid] = {
                "status": existing.get("status", "unknown"),
                "label": SPACE_LABELS.get(sid, sid),
                "distance_cm": existing.get("distance_cm"),
            }
    _lot_state[lot_id] = new_spaces
    if lot_id not in _last_ingest:
        _last_ingest[lot_id] = None


def _get_lot_state(lot_id: str) -> dict[str, dict]:
    """Return state dict for a lot, raising 404 if unknown."""
    _ensure_lot(lot_id)
    if lot_id not in _lot_state:
        raise HTTPException(status_code=404, detail=f"Lot '{lot_id}' not found.")
    return _lot_state[lot_id]


# ---------------------------------------------------------------------------
# WebSocket broadcast
# ---------------------------------------------------------------------------

_ws_clients: set[WebSocket] = set()
_ws_lock = asyncio.Lock()


async def _broadcast_loop():
    """Push current state of all enabled lots to all WS clients."""
    while True:
        await asyncio.sleep(WS_BROADCAST_INTERVAL)
        if not _ws_clients:
            continue
        summaries = _build_all_summaries()
        # Send as a list so the client can distinguish single vs multi
        payload = json.dumps([s.model_dump() for s in summaries])
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

    # Seed + load lot registry
    registry.init_registry()
    registry.seed_defaults()
    _init_all_lots()

    _session_id = start_session("live")
    task = asyncio.create_task(_broadcast_loop())

    try:
        hostname = socket.gethostname()
        local_ip = socket.gethostbyname(hostname)
    except Exception:
        local_ip = "127.0.0.1"

    from config import PORT
    lot_count = registry.count()
    log.info("Parking Navigator API (multi-lot) — ready")
    log.info(f"  Lots       →  {lot_count} registered")
    log.info(f"  Demo UI    →  http://{local_ip}:{PORT}/")
    log.info(f"  API docs   →  http://{local_ip}:{PORT}/docs")
    log.info(f"  Ingest     →  http://{local_ip}:{PORT}/ingest/parking")
    log.info(f"  WebSocket  →  ws://{local_ip}:{PORT}/ws/live")
    log.info(f"  Admin      →  http://{local_ip}:{PORT}/admin/lots")
    log.info(f"  Key        →  {API_KEY}")

    yield

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
        "Real-time multi-lot smart parking navigator. "
        "Ingests occupancy data from detectors and exposes a "
        "standardised REST API for mapping applications."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Error handling middleware
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


def _build_summary(lot_id: str) -> LotSummary:
    """Build a LotSummary for a single lot."""
    state = _get_lot_state(lot_id)
    lot_cfg = registry.get_by_id(lot_id)

    free = sum(1 for s in state.values() if s["status"] == "free")
    occupied = sum(1 for s in state.values() if s["status"] == "occupied")
    total = len(state)
    if lot_cfg:
        total = lot_cfg.get("total_spaces", total) or total
    pct = round((free / total) * 100, 1) if total else 0.0

    return LotSummary(
        lot_id=lot_id,
        name=lot_cfg["name"] if lot_cfg else lot_id,
        brand="Times",
        address=lot_cfg.get("address", "") if lot_cfg else "",
        total_spaces=total,
        free_spaces=free,
        occupied_spaces=occupied,
        availability_pct=pct,
        status=_status_label(free),
        last_updated=_last_ingest.get(lot_id),
    )


def _build_detail(lot_id: str) -> LotDetail:
    """Build a LotDetail (with tiers) for a single lot."""
    summary = _build_summary(lot_id)
    state = _lot_state.get(lot_id, {})
    lot_cfg = registry.get_by_id(lot_id)
    tiers: list[TierDetail] = []
    if lot_cfg:
        for tier_cfg in lot_cfg.get("tiers", []):
            spaces = [
                SpaceStatus(
                    id=sid,
                    label=state.get(sid, {}).get("label", sid),
                    status=state.get(sid, {}).get("status", "unknown"),
                )
                for sid in tier_cfg.get("spaces", [])
            ]
            tiers.append(TierDetail(id=tier_cfg["id"], label=tier_cfg["label"], spaces=spaces))
    elif state:
        # Unregistered lot with auto-created state — build a single tier from memory
        spaces = [
            SpaceStatus(id=sid, label=s.get("label", sid), status=s.get("status", "unknown"))
            for sid, s in state.items()
        ]
        tiers.append(TierDetail(id="main", label="Main", spaces=spaces))
    return LotDetail(**summary.model_dump(), tiers=tiers)


def _build_all_summaries() -> list[LotSummary]:
    """Build summaries for all enabled lots + any auto-created unregistered lots."""
    summaries: list[LotSummary] = []
    seen: set[str] = set()
    # Registered enabled lots
    for lot in registry.get_enabled():
        lid = lot["id"]
        seen.add(lid)
        try:
            summaries.append(_build_summary(lid))
        except Exception:
            pass
    # Unregistered lots that have in-memory state (auto-created via ingest)
    # Skip lots that ARE registered but disabled
    all_registered = {l["id"] for l in registry.get_all()}
    for lid in _lot_state:
        if lid not in seen and lid not in all_registered:
            try:
                summaries.append(_build_summary(lid))
            except Exception:
                pass
    return summaries


def _notify_ws_clients():
    """Fire-and-forget broadcast to WS clients after an ingest."""
    if not _ws_clients:
        return
    summaries = _build_all_summaries()
    payload = json.dumps([s.model_dump() for s in summaries])

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
        summaries = _build_all_summaries()
        await ws.send_text(json.dumps([s.model_dump() for s in summaries]))
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        async with _ws_lock:
            _ws_clients.discard(ws)
        log.info(f"WS client disconnected ({len(_ws_clients)} total)")

# ---------------------------------------------------------------------------
# Routes — ingest (detector → navigator)
# ---------------------------------------------------------------------------

@app.post("/ingest/parking", response_model=IngestResponse, tags=["Ingest"])
async def ingest_parking(
    payload: IngestPayload,
    _: None = Depends(verify_api_key),
) -> IngestResponse:
    global _total_updates

    lot_id = payload.lot_id

    # Auto-ensure lot state (supports dynamic lots without prior registration)
    _ensure_lot(lot_id)
    if lot_id not in _lot_state:
        # Lot not in registry — create basic state from payload
        space_map: dict[str, dict] = {}
        for sp in payload.spaces:
            space_map[sp.id] = {
                "status": sp.status,
                "label": sp.label or sp.id,
                "distance_cm": sp.distance_cm,
            }
        _lot_state[lot_id] = space_map
        _last_ingest[lot_id] = None

    state = _lot_state[lot_id]

    for space in payload.spaces:
        if space.id in state:
            state[space.id]["status"] = space.status
            if space.label:
                state[space.id]["label"] = space.label
            state[space.id]["distance_cm"] = space.distance_cm

    _last_ingest[lot_id] = payload.timestamp
    _total_updates += 1

    # Log to database
    free = sum(1 for s in state.values() if s["status"] == "free")
    occupied = sum(1 for s in state.values() if s["status"] == "occupied")
    total = len(state)
    ts_str = payload.timestamp.isoformat() if hasattr(payload.timestamp, "isoformat") else str(payload.timestamp)
    source = getattr(payload, "source", None) or "camera"

    log_ingest(
        lot_id=lot_id,
        timestamp=ts_str,
        source=source,
        total=total,
        free=free,
        occupied=occupied,
        raw_json=json.dumps([s.model_dump() for s in payload.spaces])
    )
    for space in payload.spaces:
        log_space_event(
            lot_id=lot_id,
            space_id=space.id,
            status=space.status,
            timestamp=ts_str,
            source=source,
        )

    log.info(
        f"Ingest [{lot_id}]: {free}/{total} free from {source}",
        extra={"component": "ingest", "lot_id": lot_id},
    )

    _notify_ws_clients()
    return IngestResponse(ok=True, received=len(payload.spaces))

# ---------------------------------------------------------------------------
# Routes — map client API (navigator → 2GIS / Yandex / custom UI)
# ---------------------------------------------------------------------------

@app.get("/api/v1/lots", response_model=list[LotSummary], tags=["Map API"])
async def list_lots() -> list[LotSummary]:
    """Return summaries for all enabled lots."""
    return _build_all_summaries()


@app.get("/api/v1/lots/{lot_id}", response_model=LotDetail, tags=["Map API"])
async def get_lot(lot_id: str) -> LotDetail:
    """Full detail with per-space breakdown for a single lot."""
    return _build_detail(lot_id)


@app.get("/api/v1/lots/{lot_id}/spaces", response_model=list[SpaceStatus], tags=["Map API"])
async def get_spaces(lot_id: str) -> list[SpaceStatus]:
    state = _get_lot_state(lot_id)
    return [
        SpaceStatus(id=sid, label=s["label"], status=s["status"])
        for sid, s in state.items()
    ]


@app.get("/api/v1/lots/{lot_id}/history", tags=["Map API"])
async def get_lot_history(lot_id: str, limit: int = 100):
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
# Routes — Admin API (lot registry)
# ---------------------------------------------------------------------------

@app.get("/admin/lots", tags=["Admin"])
async def admin_list_lots():
    """List all registered lots (including disabled)."""
    return registry.get_all()


@app.post("/admin/lots", tags=["Admin"], status_code=201)
async def admin_create_lot(lot: LotCreate):
    """Create a new parking lot."""
    try:
        created = registry.create(lot)
        _ensure_lot(created["id"])
        return created
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@app.get("/admin/lots/{lot_id}", tags=["Admin"])
async def admin_get_lot(lot_id: str):
    """Get a single lot's config."""
    lot = registry.get_by_id(lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail=f"Lot '{lot_id}' not found.")
    return lot


@app.patch("/admin/lots/{lot_id}", tags=["Admin"])
async def admin_update_lot(lot_id: str, patch: LotPatch):
    """Update lot config (name, address, camera, tiers, enabled)."""
    try:
        updated = registry.update(lot_id, patch)
        _rebuild_lot_state(lot_id)
        return updated
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.delete("/admin/lots/{lot_id}", tags=["Admin"])
async def admin_delete_lot(lot_id: str):
    """Delete a lot."""
    try:
        registry.delete(lot_id)
        _lot_state.pop(lot_id, None)
        _last_ingest.pop(lot_id, None)
        return {"ok": True, "deleted": lot_id}
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


class CameraIndexPayload(BaseModel):
    camera_index: int


@app.put("/admin/lots/{lot_id}/camera", tags=["Admin"])
async def admin_set_camera(lot_id: str, payload: CameraIndexPayload):
    """Set the camera index for a lot."""
    try:
        return registry.update(lot_id, LotPatch(camera_index=payload.camera_index))
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ---------------------------------------------------------------------------
# Routes — health check
# ---------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse, tags=["Meta"])
async def health() -> HealthResponse:
    return HealthResponse(ok=True, lots=registry.count(), last_ingest=None)


# ---------------------------------------------------------------------------
# Routes — demo UI
# ---------------------------------------------------------------------------

@app.get("/", response_class=HTMLResponse, tags=["Demo UI"], include_in_schema=False)
async def demo_ui() -> HTMLResponse:
    return HTMLResponse(content=DEMO_HTML)
