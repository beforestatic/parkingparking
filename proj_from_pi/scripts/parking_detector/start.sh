#!/bin/bash
export NAVIGATOR_API_URL=http://localhost:9000/ingest/parking
export NAVIGATOR_API_KEY=demo-key-01
# Set CAMERA_INDEX to your webcam's index (try 0, 1, 2 if it doesn't work)
export CAMERA_INDEX=0
source .venv/bin/activate
python3 gui_server.py --mode live
