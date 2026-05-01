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
    import argparse

    parser = argparse.ArgumentParser(description="Camera source utility")
    parser.add_argument("--scan", action="store_true", help="Scan indices 0-10 and report which cameras are available")
    args = parser.parse_args()

    if args.scan:
        system = platform.system()
        use_dshow = system == "Windows"
        print(f"[video_source] Scanning cameras on {system}...")

        # Try to get DirectShow device names on Windows
        device_names: dict[int, str] = {}
        if use_dshow:
            # Method 1: pygrabber (pip install pygrabber)
            try:
                from pygrabber.dshow_graph import FilterGraph
                for i, name in enumerate(FilterGraph().get_input_devices()):
                    device_names[i] = name
            except ImportError:
                # Method 2: PowerShell Get-PnpDevice
                try:
                    import subprocess
                    result = subprocess.run(
                        ["powershell", "-Command",
                         "Get-PnpDevice -Class Camera -Status OK | Select-Object -ExpandProperty FriendlyName"],
                        capture_output=True, text=True, timeout=5,
                    )
                    for i, line in enumerate(result.stdout.strip().splitlines()):
                        device_names[i] = line.strip()
                except Exception:
                    pass

        for idx in range(11):
            try:
                if use_dshow:
                    cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
                else:
                    cap = cv2.VideoCapture(idx)
                if cap.isOpened():
                    ret, frame = cap.read()
                    if ret and frame is not None:
                        h, w = frame.shape[:2]
                        name = device_names.get(idx, "unknown")
                        print(f"  Index {idx}: OK — {w}x{h} — \"{name}\"")
                    else:
                        print(f"  Index {idx}: opened but no frame")
                    cap.release()
                else:
                    print(f"  Index {idx}: not available")
            except Exception as e:
                print(f"  Index {idx}: error — {e}")
    else:
        cap = open_camera()
        ret, frame = cap.read()
        if ret:
            h, w = frame.shape[:2]
            print(f"[video_source] Test frame OK - {w}x{h}", flush=True)
        cap.release()
