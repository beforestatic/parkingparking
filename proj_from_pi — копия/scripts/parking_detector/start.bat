@echo off
set NAVIGATOR_API_URL=http://localhost:9000/ingest/parking
set NAVIGATOR_API_KEY=demo-key-01
set CAMERA_INDEX=0
call .venv\Scripts\activate.bat
python gui_server.py --mode mock