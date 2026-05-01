from __future__ import annotations
import os
import platform
import sys
import cv2


def open_camera(preferred_index: int = 0, width: int = 640, height: int = 480):
    """
    Cross-platform camera opener.

    - Windows: uses CAP_DSHOW to avoid MSMF issues
    - Linux/Pi: plain VideoCapture
    - Tries preferred_index first, then 0-3 as fallback
    - Skips black frames
    """
    system = platform.system()
    use_dshow = system == "Windows"

    indices = [preferred_index] + [i for i in range(4) if i != preferred_index]

    for idx in indices:
        if use_dshow:
            cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
        else:
            cap = cv2.VideoCapture(idx)

        if cap.isOpened():
            ret, frame = cap.read()
            if ret and frame is not None and frame.sum() > 0:
                cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
                print(
                    f"[video_source] Camera opened on index {idx} "
                    f"({frame.shape[1]}x{frame.shape[0]}) "
                    f"[{system}]",
                    flush=True,
                )
                return cap
            cap.release()

    msg = (
        f"[video_source] No camera found on {system}! "
        f"Tried indices: {indices}. "
        f"Check USB connection or set CAMERA_INDEX env var."
    )
    print(msg, file=sys.stderr)
    raise RuntimeError(msg)


if __name__ == "__main__":
    cap = open_camera()
    ret, frame = cap.read()
    if ret:
        h, w = frame.shape[:2]
        print(f"[video_source] Test frame OK - {w}x{h}", flush=True)
    cap.release()
