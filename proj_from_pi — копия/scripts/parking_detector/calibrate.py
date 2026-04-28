"""
calibrate.py — Interactive parking space polygon calibration
=============================================================
Click the four corners of each parking space on the live camera frame.
After the fourth click a polygon is drawn and you are asked to confirm
before it is saved to spaces.json.

Controls
--------
  Left-click          Add a corner point
  Enter / Space       Confirm current polygon (triggers y/n prompt in terminal)
  r                   Reset / discard the current in-progress polygon
  q                   Quit and save all confirmed spaces to spaces.json

Output
------
  spaces.json — list of {"id": "L1", "polygon": [[x,y], ...]} objects

Usage
-----
    python calibrate.py [--camera 0] [--out spaces.json]
"""

from __future__ import annotations

import argparse
import json
import os
import sys

import cv2

try:
    from video_source import open_camera
except ImportError:
    # Fallback if run from a different working directory
    def open_camera(preferred_index: int = 0, **_) -> "cv2.VideoCapture":  # type: ignore[misc]
        cap = cv2.VideoCapture(preferred_index)
        if not cap.isOpened():
            raise RuntimeError(f"Cannot open camera {preferred_index}")
        return cap


# ── Space ID sequence ──────────────────────────────────────────────────────

SPACE_IDS = ["L1", "L2", "L3", "L4", "L5"]

# ── Drawing constants ──────────────────────────────────────────────────────

COLOUR_PENDING   = (0,   255, 255)   # yellow — points being placed
COLOUR_CONFIRMED = (0,   200, 0)     # green  — saved spaces
COLOUR_DISCARDED = (0,   0,   200)   # red flash on discard
FONT             = cv2.FONT_HERSHEY_SIMPLEX

# ── State ──────────────────────────────────────────────────────────────────

confirmed_spaces: list[dict] = []   # [{id, polygon}, ...]
current_points:   list[tuple[int, int]] = []
space_index: int = 0                # index into SPACE_IDS for the next space


def _confirm_prompt(space_id: str) -> bool:
    """
    Ask the operator in the terminal whether to save the completed polygon.
    Returns True (save) or False (discard and re-click).
    """
    while True:
        try:
            answer = input(f"\nSave space {space_id}? (y/n): ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            return False
        if answer in ("y", "yes"):
            return True
        if answer in ("n", "no"):
            return False
        print("  Please enter y or n.")


def _draw_overlay(frame, current_pts: list, spaces: list) -> None:
    """Draw all confirmed spaces and the in-progress polygon on frame."""
    # Confirmed spaces
    for sp in spaces:
        pts = [tuple(p) for p in sp["polygon"]]
        for i in range(len(pts)):
            cv2.line(frame, pts[i], pts[(i + 1) % len(pts)], COLOUR_CONFIRMED, 2)
        # Label in the centroid
        cx = int(sum(p[0] for p in pts) / len(pts))
        cy = int(sum(p[1] for p in pts) / len(pts))
        cv2.putText(frame, sp["id"], (cx - 10, cy + 6), FONT, 0.6, COLOUR_CONFIRMED, 2)

    # In-progress points
    for pt in current_pts:
        cv2.circle(frame, pt, 5, COLOUR_PENDING, -1)
    for i in range(1, len(current_pts)):
        cv2.line(frame, current_pts[i - 1], current_pts[i], COLOUR_PENDING, 1)
    if len(current_pts) == 4:
        cv2.line(frame, current_pts[-1], current_pts[0], COLOUR_PENDING, 1)


def _mouse_callback(event, x: int, y: int, flags, param: dict) -> None:
    if event == cv2.EVENT_LBUTTONDOWN:
        pts: list = param["current_points"]
        if len(pts) < 4:
            pts.append((x, y))
            print(f"  Point {len(pts)}/4 — ({x}, {y})", flush=True)


def _save_spaces(spaces: list, out_path: str) -> None:
    with open(out_path, "w") as f:
        json.dump(spaces, f, indent=2)
    print(f"\n[calibrate] Saved {len(spaces)} space(s) to {out_path}", flush=True)


# ── Main ───────────────────────────────────────────────────────────────────

def main() -> None:
    global space_index, current_points, confirmed_spaces

    parser = argparse.ArgumentParser(description="Parking space polygon calibration")
    parser.add_argument("--camera", type=int, default=int(os.getenv("CAMERA_INDEX", "0")),
                        help="Camera index (default: CAMERA_INDEX env var or 0)")
    parser.add_argument("--out",    type=str, default="spaces.json",
                        help="Output path for spaces.json")
    args = parser.parse_args()

    cap = open_camera(preferred_index=args.camera)

    window = "Calibration — click 4 corners per space  |  r=reset  q=quit"
    cv2.namedWindow(window)

    param = {"current_points": current_points}
    cv2.setMouseCallback(window, _mouse_callback, param)

    print("\n[calibrate] Starting calibration.", flush=True)
    if space_index < len(SPACE_IDS):
        print(f"[calibrate] Click 4 corners for space: {SPACE_IDS[space_index]}", flush=True)

    while True:
        ret, frame = cap.read()
        if not ret:
            print("[calibrate] Camera read failed — exiting.", file=sys.stderr, flush=True)
            break

        # Auto-complete polygon once 4 points are placed
        if len(current_points) == 4 and space_index < len(SPACE_IDS):
            space_id = SPACE_IDS[space_index]
            print(f"\n[calibrate] 4 points recorded for {space_id}:", flush=True)
            for i, pt in enumerate(current_points, 1):
                print(f"  {i}. {pt}", flush=True)

            # ── Confirmation prompt ─────────────────────────────────────────
            if _confirm_prompt(space_id):
                confirmed_spaces.append({
                    "id":      space_id,
                    "polygon": [list(p) for p in current_points],
                })
                print(f"[calibrate] ✓ Space {space_id} saved.", flush=True)
                space_index += 1
                if space_index < len(SPACE_IDS):
                    print(
                        f"[calibrate] Click 4 corners for space: {SPACE_IDS[space_index]}",
                        flush=True,
                    )
                else:
                    print("[calibrate] All spaces done. Press q to save and quit.", flush=True)
            else:
                print(f"[calibrate] ✗ Space {space_id} discarded — click again.", flush=True)

            # Reset in-progress points regardless of decision
            current_points.clear()

        _draw_overlay(frame, current_points, confirmed_spaces)

        # HUD
        if space_index < len(SPACE_IDS):
            label = f"Space: {SPACE_IDS[space_index]}  ({len(current_points)}/4 points)"
        else:
            label = "All spaces done — press q to save"
        cv2.putText(frame, label, (10, 28), FONT, 0.65, (255, 255, 255), 2)
        cv2.putText(frame, "r=reset  q=quit", (10, frame.shape[0] - 10),
                    FONT, 0.45, (180, 180, 180), 1)

        cv2.imshow(window, frame)
        key = cv2.waitKey(30) & 0xFF

        if key == ord("q"):
            break
        elif key == ord("r"):
            print("[calibrate] Reset — discarding current points.", flush=True)
            current_points.clear()

    cap.release()
    cv2.destroyAllWindows()

    if confirmed_spaces:
        _save_spaces(confirmed_spaces, args.out)
    else:
        print("[calibrate] No spaces confirmed — nothing saved.", flush=True)


if __name__ == "__main__":
    main()
