"""
Tests for the Parking Navigator API.

Run:  pytest tests/ -v
"""

import pytest
from fastapi.testclient import TestClient

import tempfile, os

# Patch DB path before importing main
import config
_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
config.DB_PATH = _tmp.name
_tmp.close()

from main import app, _space_state, ALL_SPACE_IDS
from db import init_db

init_db()
client = TestClient(app)


# ── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def reset_state():
    """Reset in-memory space state before each test."""
    for sid in ALL_SPACE_IDS:
        _space_state[sid]["status"] = "unknown"
        _space_state[sid]["distance_cm"] = None
    yield


def _ingest(spaces, lot_id="times-mockup-01"):
    """Helper: POST an ingest payload."""
    return client.post(
        "/ingest/parking",
        json={
            "lot_id": lot_id,
            "timestamp": "2025-01-01T12:00:00Z",
            "total_spaces": len(spaces),
            "spaces": spaces,
            "source": "test",
        },
        headers={"X-API-Key": "demo-key-01"},
    )


# ── Auth ────────────────────────────────────────────────────────────────────

class TestAuth:
    def test_ingest_requires_key(self):
        res = client.post("/ingest/parking", json={
            "lot_id": "x", "timestamp": "2025-01-01T12:00:00Z",
            "total_spaces": 1, "spaces": [{"id": "L1", "status": "free"}],
        })
        assert res.status_code == 401

    def test_ingest_wrong_key(self):
        res = client.post("/ingest/parking", json={
            "lot_id": "x", "timestamp": "2025-01-01T12:00:00Z",
            "total_spaces": 1, "spaces": [{"id": "L1", "status": "free"}],
        }, headers={"X-API-Key": "wrong"})
        assert res.status_code == 401

    def test_public_endpoints_no_key(self):
        for path in ["/api/v1/lots", "/health"]:
            res = client.get(path)
            assert res.status_code == 200


# ── Ingest ──────────────────────────────────────────────────────────────────

class TestIngest:
    def test_ingest_updates_state(self):
        res = _ingest([{"id": "L1", "status": "free"}, {"id": "L2", "status": "occupied"}])
        assert res.status_code == 200
        assert res.json()["ok"] is True
        assert res.json()["received"] == 2

        lot = client.get("/api/v1/lots/times-mockup-01").json()
        assert lot["free_spaces"] == 1
        assert lot["occupied_spaces"] == 1

    def test_ingest_partial_update(self):
        _ingest([{"id": "L1", "status": "free"}])
        _ingest([{"id": "L2", "status": "occupied"}])
        lot = client.get("/api/v1/lots/times-mockup-01").json()
        assert lot["free_spaces"] == 1
        assert lot["occupied_spaces"] == 1

    def test_ingest_ignores_unknown_space(self):
        res = _ingest([{"id": "UNKNOWN", "status": "free"}])
        assert res.status_code == 200
        assert res.json()["received"] == 1


# ── Lot endpoints ───────────────────────────────────────────────────────────

class TestLotEndpoints:
    def test_list_lots(self):
        res = client.get("/api/v1/lots")
        assert res.status_code == 200
        assert len(res.json()) == 1
        assert res.json()[0]["lot_id"] == "times-mockup-01"

    def test_get_lot_detail(self):
        _ingest([{"id": "L1", "status": "free"}])
        res = client.get("/api/v1/lots/times-mockup-01")
        assert res.status_code == 200
        data = res.json()
        assert "tiers" in data
        assert len(data["tiers"]) > 0

    def test_get_lot_404(self):
        res = client.get("/api/v1/lots/nonexistent")
        assert res.status_code == 404

    def test_get_spaces(self):
        _ingest([{"id": "L1", "status": "free"}])
        res = client.get("/api/v1/lots/times-mockup-01/spaces")
        assert res.status_code == 200
        l1 = next(s for s in res.json() if s["id"] == "L1")
        assert l1["status"] == "free"

    def test_get_history(self):
        _ingest([{"id": "L1", "status": "free"}])
        res = client.get("/api/v1/lots/times-mockup-01/history")
        assert res.status_code == 200
        assert len(res.json()) >= 1

    def test_sessions_endpoint(self):
        res = client.get("/api/v1/sessions")
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_errors_endpoint(self):
        res = client.get("/api/v1/errors")
        assert res.status_code == 200


# ── Status logic ────────────────────────────────────────────────────────────

class TestStatusLogic:
    def test_all_free_is_available(self):
        _ingest([{"id": s, "status": "free"} for s in ALL_SPACE_IDS])
        lot = client.get("/api/v1/lots/times-mockup-01").json()
        assert lot["status"] == "available"
        assert lot["free_spaces"] == 5

    def test_all_occupied_is_full(self):
        _ingest([{"id": s, "status": "occupied"} for s in ALL_SPACE_IDS])
        lot = client.get("/api/v1/lots/times-mockup-01").json()
        assert lot["status"] == "full"
        assert lot["free_spaces"] == 0

    def test_two_free_is_limited(self):
        spaces = [{"id": s, "status": "occupied"} for s in ALL_SPACE_IDS]
        spaces[0]["status"] = "free"
        spaces[1]["status"] = "free"
        _ingest(spaces)
        lot = client.get("/api/v1/lots/times-mockup-01").json()
        assert lot["status"] == "limited"


# ── Health ──────────────────────────────────────────────────────────────────

class TestHealth:
    def test_health(self):
        res = client.get("/health")
        assert res.status_code == 200
        assert res.json()["ok"] is True
