@echo off
set NAVIGATOR_API_URL=http://localhost:9000/ingest/parking
set NAVIGATOR_API_KEY=demo-key-01
REM Set CAMERA_INDEX to your webcam's index (try 0, 1, 2 if it doesn't work)
set CAMERA_INDEX=0
call .venv\Scripts\activate.bat
python gui_server.py --mode live
pause
