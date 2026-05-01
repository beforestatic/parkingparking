# Parking Navigator API

Real-time smart parking lot navigator.  
Receives occupancy data from a Raspberry Pi detector and serves it to mapping clients (2GIS, Yandex Maps, custom UIs) via a standardised REST API.

---

## Quick start

```bash
cd navigator/
pip install fastapi uvicorn
uvicorn main:app --host 0.0.0.0 --port 9000 --reload
```

Open the demo panel: **http://localhost:9000/**  
OpenAPI docs: **http://localhost:9000/docs**

---

## Pointing the detector at this navigator

On the Raspberry Pi (or wherever `parking_detector.py` / `sensor_reader.py` run):

```bash
export NAVIGATOR_API_URL="http://<navigator-ip>:9000/ingest/parking"
export NAVIGATOR_API_KEY="demo-key-01"
```

Replace `<navigator-ip>` with the LAN IP of the machine running uvicorn.  
Use `ip addr` or `hostname -I` to find it.

---

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/ingest/parking` | `X-API-Key` header | Detector pushes occupancy updates |
| `GET`  | `/api/v1/lots` | none | All lots — summary |
| `GET`  | `/api/v1/lots/{lot_id}` | none | Full lot detail + per-space status |
| `GET`  | `/api/v1/lots/{lot_id}/spaces` | none | Flat space list |
| `GET`  | `/health` | none | Liveness + last-ingest timestamp |
| `GET`  | `/` | none | Demo HTML map panel |

---

## Ingest payload (sent by detector)

```json
POST /ingest/parking
X-API-Key: demo-key-01
Content-Type: application/json

{
  "lot_id": "times-mockup-01",
  "timestamp": "2026-04-25T10:00:00Z",
  "total_spaces": 10,
  "free_spaces": 4,
  "occupied_spaces": 6,
  "spaces": [
    { "id": "U1", "label": "Upper 1", "status": "free" },
    { "id": "U2", "label": "Upper 2", "status": "occupied" }
  ]
}
```

The ultrasonic sensor reader additionally includes `"source": "ultrasonic"` and per-space `"distance_cm"` values — the navigator stores and ignores the extras gracefully.

---

## Lot layout

**Times Parking (Mockup)**  `times-mockup-01`

```
Upper Deck   [U1][U2][U3][U4][U5]   (yellow divider lines)
Lower Deck   [L1][L2][L3][L4][L5]   (white P markings, covered)
```

Status logic:
- `"available"` — 3 or more free spaces
- `"limited"`   — 1–2 free spaces
- `"full"`       — 0 free spaces

---

## File structure

```
navigator/
  main.py        — FastAPI app, all routes, in-memory state
  models.py      — Pydantic request/response models
  lot_config.py  — Hardcoded Times mockup lot metadata
  demo_ui.py     — Self-contained HTML for the demo panel
  README.md      — This file

scripts/
  sensor_reader/
    sensor_reader.py  — HC-SR04 ultrasonic sensor reader (Pi GPIO)
```

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NAVIGATOR_API_KEY` | `demo-key-01` | Ingest auth key |

---

## Sensor reader (ultrasonic)

See `scripts/sensor_reader/README.md` or the top of `sensor_reader.py` for wiring, config, and mock-mode instructions.

```bash
cd scripts/sensor_reader/
pip install requests RPi.GPIO   # RPi.GPIO only needed on Pi hardware
python sensor_reader.py
```

Runs in **mock mode** automatically on a dev laptop (no GPIO hardware needed).

---

## Running on Raspberry Pi (real hardware)

### 1. Disable mock mode in gui_server

By default `gui_server.py` starts in `--mode mock`.  
On the Pi with a real webcam, pass `--mode live`:

```bash
cd scripts/parking_detector/
python gui_server.py --mode live
```

This opens the camera at `CAMERA_INDEX` (default `0`) and feeds live frames into the MJPEG stream and the detection pipeline.

### 2. Set NAVIGATOR_API_URL to the Pi's LAN IP

The gui_server and sensor_reader both need to know where the navigator is.  
Find the Pi's address with:

```bash
hostname -I   # e.g. 192.168.1.42
```

Then export before starting either script:

```bash
export NAVIGATOR_API_URL="http://192.168.1.42:9000/ingest/parking"
export NAVIGATOR_API_KEY="demo-key-01"
```

Or add them to `/etc/environment` / a `.env` file loaded by your service manager.

### 3. Run sensor_reader.py alongside gui_server.py

Open two terminals (or use `screen` / `tmux`):

**Terminal 1 — detection server:**
```bash
cd scripts/parking_detector/
export NAVIGATOR_API_URL="http://192.168.1.42:9000/ingest/parking"
export NAVIGATOR_API_KEY="demo-key-01"
python gui_server.py --mode live
```

**Terminal 2 — ultrasonic sensor reader:**
```bash
cd scripts/sensor_reader/
export NAVIGATOR_API_URL="http://192.168.1.42:9000/ingest/parking"
export NAVIGATOR_API_KEY="demo-key-01"
python sensor_reader.py
```

The sensor reader sends ultrasonic distance data independently of the camera — both contribute to the same lot state in the navigator.

### 4. Calibrate the baseline (Admin UI)

1. Open **http://\<pi-ip\>:5173/admin** in a browser on the same network.
2. Switch the mode toggle to **Live** in the top-right.
3. Point the camera at the **empty** parking lot.
4. Click **Capture Snapshot** — `baseline_preview.jpg` downloads to your device so you can verify framing.
5. If the angle looks correct, click **Set as Baseline** to commit the frame as the detection reference.

### 5. FRAME_SKIP tuning for Pi 4 performance

`FRAME_SKIP` controls how many frames the camera loop skips before running detection.  
Higher = less CPU, lower accuracy; lower = more CPU, higher accuracy.

| Hardware | Recommended FRAME_SKIP |
|----------|------------------------|
| Pi 5 | 1–2 (default) |
| Pi 4 | 3–4 |
| Pi 3 / Zero 2 | 6–8 |

Set it as an environment variable:

```bash
export FRAME_SKIP=4
python gui_server.py --mode live
```
