"""
Centralised configuration for the Parking Navigator API.

All tuneable values live here — override via environment variables.
"""

import os

# ── Server ──────────────────────────────────────────────────────────────────
HOST: str = os.getenv("NAVIGATOR_HOST", "0.0.0.0")
PORT: int = int(os.getenv("NAVIGATOR_PORT", "9000"))

# ── Auth ────────────────────────────────────────────────────────────────────
API_KEY: str = os.getenv("NAVIGATOR_API_KEY", "demo-key-01")

# ── Database ────────────────────────────────────────────────────────────────
DB_PATH: str = os.getenv("DB_PATH", "parking_data.db")

# ── Lot ─────────────────────────────────────────────────────────────────────
LOT_ID: str = "times-mockup-01"

# ── WebSocket ───────────────────────────────────────────────────────────────
WS_BROADCAST_INTERVAL: float = float(os.getenv("WS_BROADCAST_INTERVAL", "2.0"))

# ── Logging ─────────────────────────────────────────────────────────────────
LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
LOG_FORMAT: str = os.getenv("LOG_FORMAT", "json")  # "json" or "text"

# ── Retention ───────────────────────────────────────────────────────────────
RETENTION_DAYS: int = int(os.getenv("RETENTION_DAYS", "30"))
