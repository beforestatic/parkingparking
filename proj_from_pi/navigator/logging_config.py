"""
Structured logging for the Parking Navigator.

Outputs JSON lines (default) or plain text, configurable via LOG_FORMAT env var.
"""

import logging
import json
import sys
from datetime import datetime, timezone

from config import LOG_LEVEL, LOG_FORMAT


class JSONFormatter(logging.Formatter):
    """Emit one JSON object per line — easy to parse with jq, ELK, etc."""

    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info and record.exc_info[0]:
            entry["exc"] = self.formatException(record.exc_info)
        # Attach any extra fields passed via `extra={}`
        for key in ("component", "event", "detail", "lot_id", "space_id"):
            val = getattr(record, key, None)
            if val is not None:
                entry[key] = val
        return json.dumps(entry, default=str)


class TextFormatter(logging.Formatter):
    """Human-readable for local dev."""

    def format(self, record: logging.LogRecord) -> str:
        ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
        return f"[{ts}] {record.levelname:5s} {record.name}: {record.getMessage()}"


def get_logger(name: str) -> logging.Logger:
    """Return a configured logger. Call once per module."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(
            JSONFormatter() if LOG_FORMAT == "json" else TextFormatter()
        )
        logger.addHandler(handler)
        logger.setLevel(getattr(logging, LOG_LEVEL.upper(), logging.INFO))
    return logger
