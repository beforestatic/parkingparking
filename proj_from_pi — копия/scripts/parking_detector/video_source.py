from __future__ import annotations
import sys
import cv2

def open_camera(preferred_index: int = 3, width: int = 640, height: int = 480):
    for idx in [preferred_index, 3, 2, 0, 1]:
        cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
        if cap.isOpened():
            ret, frame = cap.read()
            if ret and frame is not None and frame.sum() > 0:
                cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
                print(f"[video_source] Camera opened on index {idx} ({frame.shape[1]}x{frame.shape[0]})", flush=True)
                return cap
            cap.release()
    print("[video_source] No camera found!", file=sys.stderr)
    raise RuntimeError("Could not open any camera")

if __name__ == "__main__":
    cap = open_camera()
    ret, frame = cap.read()
    if ret:
        h, w = frame.shape[:2]
        print(f"[video_source] Test frame OK - {w}x{h}", flush=True)
    cap.release()
