"""
gui_server.py — Times Parking camera server & detection control API
====================================================================
Usage:
    python gui_server.py --mode mock   # laptop / Docker (no camera needed)
    python gui_server.py --mode live   # Raspberry Pi with real webcam

Endpoints
---------
GET  /stream                  MJPEG camera stream
POST /api/baseline            Commit current frame as detection baseline
POST /api/pause               {"paused": true|false}
POST /api/scenario            {"scenario": "normal|busy|full|empty"}  (mock only)
POST /api/capture_snapshot    Returns current frame as image/jpeg

Environment variables
---------------------
NAVIGATOR_API_URL   URL to push occupancy updates to (navigator /ingest/parking)
NAVIGATOR_API_KEY   API key for the ingest endpoint
CAMERA_INDEX        OpenCV camera index (default 0)
FRAME_SKIP          Process every Nth frame for detection (default 2)
"""

import argparse
import io
import os
import threading
import time
from typing import Generator

import cv2
import requests
from flask import Flask, Response, jsonify, request
from video_source import open_camera

# ── Config ─────────────────────────────────────────────────────────────────

NAVIGATOR_API_URL = os.environ.get("NAVIGATOR_API_URL", "http://localhost:9000/ingest/parking")
NAVIGATOR_API_KEY = os.environ.get("NAVIGATOR_API_KEY", "demo-key-01")
CAMERA_INDEX      = int(os.environ.get("CAMERA_INDEX", 0))
FRAME_SKIP        = int(os.environ.get("FRAME_SKIP", 2))

LOT_ID = "times-mockup-01"

# ── App state ──────────────────────────────────────────────────────────────

state = {
    "mode":     "mock",
    "paused":   False,
    "scenario": "normal",
    "baseline": None,
}

frame_lock   = threading.Lock()
latest_frame: bytes | None = None

# ── Mock frame generator ───────────────────────────────────────────────────

def _mock_frame() -> bytes:
    import numpy as np
    img = np.zeros((360, 640, 3), dtype=np.uint8)
    img[:] = (26, 29, 40)
    cv2.putText(img, "MOCK MODE — no camera", (140, 170),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (247, 193, 46), 2)
    cv2.putText(img, f"scenario: {state['scenario']}", (220, 210),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (107, 114, 128), 1)
    cv2.putText(img, time.strftime("%H:%M:%S"), (270, 250),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (107, 114, 128), 1)
    _, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 70])
    return buf.tobytes()

# ── Camera thread (live mode) ──────────────────────────────────────────────

def _camera_loop():
    global latest_frame
    cap = open_camera(preferred_index=CAMERA_INDEX, width=640, height=480)
    frame_count = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            time.sleep(0.1)
            continue
        frame_count += 1
        if frame_count % FRAME_SKIP != 0:
            continue
        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
        with frame_lock:
            latest_frame = buf.tobytes()
        time.sleep(0.01)


def _mjpeg_frames() -> Generator[bytes, None, None]:
    while True:
        if state["mode"] == "mock":
            jpg = _mock_frame()
            time.sleep(0.1)
        else:
            with frame_lock:
                jpg = latest_frame
            if jpg is None:
                time.sleep(0.05)
                continue
        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n" + jpg + b"\r\n"
        )

# ── Navigator push ─────────────────────────────────────────────────────────

def _push_to_navigator(spaces_map: dict):
    """Push current space state to the navigator API in a background thread."""
    def _send():
        try:
            spaces = [
                {"id": sid, "label": _TIER_LABELS.get(sid, sid), "status": status}
                for sid, status in spaces_map.items()
            ]
            free = sum(1 for s in spaces if s["status"] == "free")
            payload = {
                "lot_id":          LOT_ID,
                "timestamp":       time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "source":          "camera",
                "total_spaces":    len(spaces),
                "free_spaces":     free,
                "occupied_spaces": len(spaces) - free,
                "spaces":          spaces,
            }
            requests.post(
                NAVIGATOR_API_URL,
                json=payload,
                headers={"X-API-Key": NAVIGATOR_API_KEY},
                timeout=2,
            )
            print(f"[navigator] Pushed {free}/{len(spaces)} free", flush=True)
        except Exception as e:
            print(f"[navigator] Push failed: {e}", flush=True)
    threading.Thread(target=_send, daemon=True).start()

# ── Flask app ──────────────────────────────────────────────────────────────

app = Flask(__name__)


@app.route("/stream")
def stream():
    return Response(
        _mjpeg_frames(),
        mimetype="multipart/x-mixed-replace; boundary=frame",
    )


@app.route("/api/baseline", methods=["POST"])
def set_baseline():
    if state["mode"] == "live":
        with frame_lock:
            jpg = latest_frame
        if jpg is not None:
            import numpy as np
            arr = np.frombuffer(jpg, dtype=np.uint8)
            state["baseline"] = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return jsonify({"ok": True, "mode": state["mode"]})


@app.route("/api/pause", methods=["POST"])
def pause():
    data = request.get_json(silent=True) or {}
    state["paused"] = bool(data.get("paused", False))
    return jsonify({"ok": True, "paused": state["paused"]})


@app.route("/api/scenario", methods=["POST"])
def scenario():
    data = request.get_json(silent=True) or {}
    s = data.get("scenario", "normal")
    if s not in _SCENARIO_SPACES:
        return jsonify({"error": "unknown scenario"}), 400
    state["scenario"] = s
    _push_mock_update(s)
    _push_to_navigator(_SCENARIO_SPACES.get(s, {}))
    return jsonify({"ok": True, "scenario": s})


@app.route("/api/capture_snapshot", methods=["POST"])
def capture_snapshot():
    if state["mode"] == "mock":
        jpg = _mock_frame()
    else:
        with frame_lock:
            jpg = latest_frame
        if jpg is None:
            return jsonify({"error": "No frame available yet"}), 503
    return Response(
        jpg,
        mimetype="image/jpeg",
        headers={"Content-Disposition": 'attachment; filename="baseline_preview.jpg"'},
    )

# ── Mock scenarios ─────────────────────────────────────────────────────────

_SCENARIO_SPACES = {
    "all_free":       {k: "free"      for k in ["L1", "L2", "L3", "L4", "L5"]},
    "morning_light":  {"L1":"free",   "L2":"occupied", "L3":"free",      "L4":"free",      "L5":"free"},
    "midday_busy":    {"L1":"occupied","L2":"occupied", "L3":"occupied",  "L4":"free",      "L5":"free"},
    "evening_full":   {k: "occupied"  for k in ["L1", "L2", "L3", "L4", "L5"]},
    "only_dark_cars": {"L1":"free",   "L2":"occupied", "L3":"free",      "L4":"occupied",  "L5":"free"},
    # Legacy aliases
    "normal": {"L1":"free",   "L2":"occupied", "L3":"free",     "L4":"free",     "L5":"free"},
    "busy":   {"L1":"occupied","L2":"occupied","L3":"occupied",  "L4":"free",     "L5":"free"},
    "full":   {k: "occupied"  for k in ["L1", "L2", "L3", "L4", "L5"]},
    "empty":  {k: "free"      for k in ["L1", "L2", "L3", "L4", "L5"]},
}

_TIER_LABELS = {
    "L1": "Lower 1", "L2": "Lower 2", "L3": "Lower 3", "L4": "Lower 4", "L5": "Lower 5",
}


def _push_mock_update(scenario: str):
    if state["paused"]:
        return
    spaces_map = _SCENARIO_SPACES.get(scenario, _SCENARIO_SPACES["normal"])
    spaces = [{"id": k, "label": _TIER_LABELS[k], "status": v} for k, v in spaces_map.items()]
    free = sum(1 for s in spaces if s["status"] == "free")
    payload = {
        "lot_id":          LOT_ID,
        "timestamp":       time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total_spaces":    5,
        "free_spaces":     free,
        "occupied_spaces": 5 - free,
        "spaces":          spaces,
    }
    try:
        requests.post(
            NAVIGATOR_API_URL,
            json=payload,
            headers={"X-API-Key": NAVIGATOR_API_KEY},
            timeout=2,
        )
    except Exception as exc:
        print(f"[gui_server] push failed: {exc}")

# ── Entry point ────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["mock", "live"], default="mock")
    args = parser.parse_args()
    state["mode"] = args.mode

    if args.mode == "live":
        print(f"[gui_server] Live mode — opening camera index {CAMERA_INDEX}")
        t = threading.Thread(target=_camera_loop, daemon=True)
        t.start()
    else:
        print("[gui_server] Mock mode — no camera required")

    print(f"[gui_server] Starting on http://0.0.0.0:8000  (FRAME_SKIP={FRAME_SKIP})")
    app.run(host="0.0.0.0", port=8000, threaded=True)


if __name__ == "__main__":
    main()
