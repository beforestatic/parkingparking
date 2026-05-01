"""
Pydantic models for the Parking Navigator API.

Request models:  IngestPayload (from Raspberry Pi detector)
Response models: SpaceStatus, TierDetail, LotSummary, LotDetail, HealthResponse
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Ingest (detector → navigator)
# ---------------------------------------------------------------------------

class SpaceIngest(BaseModel):
    id: str
    label: Optional[str] = None
    status: Literal["free", "occupied", "unknown"] = "unknown"
    distance_cm: Optional[float] = None  # ultrasonic sensor payload


class IngestPayload(BaseModel):
    lot_id: str
    timestamp: datetime
    total_spaces: int
    free_spaces: Optional[int] = None
    occupied_spaces: Optional[int] = None
    spaces: list[SpaceIngest] = Field(default_factory=list)
    source: Optional[str] = None  # "camera" | "ultrasonic" | None


class IngestResponse(BaseModel):
    ok: bool = True
    received: int  # number of spaces received


# ---------------------------------------------------------------------------
# Outgoing API (navigator → map clients)
# ---------------------------------------------------------------------------

class SpaceStatus(BaseModel):
    id: str
    label: str
    status: Literal["free", "occupied", "unknown"]


class TierDetail(BaseModel):
    id: str
    label: str
    spaces: list[SpaceStatus]


class LotSummary(BaseModel):
    lot_id: str
    name: str
    brand: str
    address: str
    total_spaces: int
    free_spaces: int
    occupied_spaces: int
    availability_pct: float
    status: Literal["available", "limited", "full"]
    last_updated: Optional[datetime]


class LotDetail(LotSummary):
    tiers: list[TierDetail]


class HealthResponse(BaseModel):
    ok: bool = True
    lots: int
    last_ingest: Optional[datetime]
