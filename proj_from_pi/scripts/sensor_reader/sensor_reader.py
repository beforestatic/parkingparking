"""
=============================================================================
sensor_reader.py  —  HC-SR04 Ultrasonic Sensor Reader
=============================================================================

Reads five HC-SR04 sensors wired to a Raspberry Pi 4 GPIO and pushes
occupancy updates to the Parking Navigator API.

WIRING (Trig pin, Echo pin per space)
--------------------------------------
  L1: Trig=17  Echo=27
  L2: Trig=22  Echo=23
  L3: Trig=24  Echo=25
  L4: Trig=5   Echo=6
  L5: Trig=13  Echo=19

INSTALLATION
------------
  pip install requests RPi.GPIO   # RPi.GPIO only required on real Pi hardware

RUNNING
-------
  # On the Pi:
  python sensor_reader.py

  # On a dev laptop (auto-detects missing RPi.GPIO → mock mode):
  python sensor_reader.py

ENVIRONMENT VARIABLES
----------------------
  NAVIGATOR_API_URL               http://localhost:9000/ingest/parking
  NAVIGATOR_API_KEY               demo-key-01
  ULTRASONIC_POLL_INTERVAL        1.0   (seconds between sensor reads)
  ULTRASONIC_OCCUPIED_THRESHOLD_CM 15.0 (cm below which space = occupied)
  ULTRASONIC_DEBOUNCE_N           2     (consecutive consistent reads to flip)
=============================================================================
"""

from __future__ import annotations

import os
import random
import sys
import time
from datetime import datetime, timezone
from typing import Optional

import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

NAVIGATOR_API_URL: str = os.getenv(
    "NAVIGATOR_API_URL", "http://localhost:9000/ingest/parking"
)
NAVIGATOR_API_KEY: str = os.getenv("NAVIGATOR_API_KEY", "demo-key-01")
POLL_INTERVAL: float = float(os.getenv("ULTRASONIC_POLL_INTERVAL", "1.0"))
OCCUPIED_THRESHOLD_CM: float = float(
    os.getenv("ULTRASONIC_OCCUPIED_THRESHOLD_CM", "15.0")
)
DEBOUNCE_N: int = int(os.getenv("ULTRASONIC_DEBOUNCE_N", "2"))

LOT_ID = "times-mockup-01"

# GPIO pin mapping: space_id -> (trig_pin, echo_pin)
PIN_MAP: dict[str, tuple[int, int]] = {
    "L1": (17, 27),
    "L2": (22, 23),
    "L3": (24, 25),
    "L4": (5,  6),
    "L5": (13, 19),
}

MOCK_MODE = False

# ---------------------------------------------------------------------------
# GPIO / Mock GPIO
# ---------------------------------------------------------------------------

try:
    import RPi.GPIO as GPIO  # type: ignore

    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)
except ImportError:
    print("[MOCK MODE] RPi.GPIO not found — using simulated distances.", flush=True)
    MOCK_MODE = True

    class _MockGPIO:
        """Simulated GPIO for development on non-Pi hardware."""

        BCM = OUT = IN = 0
        FALLING = RISING = BOTH = 0

        # Simulated occupancy state: space_id -> bool
        _occupied: dict[str, bool] = {sid: random.random() < 0.4 for sid in PIN_MAP}
        _last_flip: float = time.monotonic()
        FLIP_INTERVAL: float = 15.0  # seconds between random state changes

        def setmode(self, *a: object, **kw: object) -> None: ...
        def setwarnings(self, *a: object) -> None: ...

        def setup(self, pin: int, mode: int, **kw: object) -> None: ...

        def output(self, pin: int, value: int) -> None: ...

        def input(self, pin: int) -> int:
            # Return a plausible echo value — actual timing is in measure_distance
            return 0

        def cleanup(self) -> None: ...

        def _maybe_flip(self) -> None:
            now = time.monotonic()
            if now - self._last_flip >= self.FLIP_INTERVAL:
                target = random.choice(list(self._occupied.keys()))
                self._occupied[target] = not self._occupied[target]
                self._last_flip = now
                print(
                    f"[MOCK] Space {target} flipped → "
                    f"{'occupied' if self._occupied[target] else 'free'}",
                    flush=True,
                )

        def mock_distance(self, space_id: str) -> float:
            self._maybe_flip()
            if self._occupied[space_id]:
                return random.uniform(3.0, 8.0)
            return random.uniform(22.0, 28.0)

    GPIO = _MockGPIO()  # type: ignore

# ---------------------------------------------------------------------------
# SensorReader
# ---------------------------------------------------------------------------


class SensorReader:
    """
    Manages five HC-SR04 ultrasonic sensors for the lower parking deck.

    Usage::

        reader = SensorReader()
        distances = reader.read_all()   # {"L1": 12.3, "L2": None, ...}
        occupied  = reader.is_occupied(distances["L1"])
    """

    ECHO_TIMEOUT_S: float = 0.030  # 30 ms — no echo → sensor error / out of range
    TRIGGER_PULSE_S: float = 0.000010  # 10 µs trigger pulse

    def __init__(self) -> None:
        for space_id, (trig, echo) in PIN_MAP.items():
            GPIO.setup(trig, GPIO.OUT)
            GPIO.setup(echo, GPIO.IN)
        print(
            f"[SensorReader] Initialised {len(PIN_MAP)} sensors "
            f"({'MOCK' if MOCK_MODE else 'REAL GPIO'})",
            flush=True,
        )

    # ------------------------------------------------------------------
    # Low-level measurement
    # ------------------------------------------------------------------

    def measure_distance(self, trig: int, echo: int, space_id: str = "") -> Optional[float]:
        """
        Send a 10 µs trigger pulse and time the echo response.

        Returns distance in centimetres, or None on timeout / sensor error.
        """
        if MOCK_MODE:
            # For mock mode we look up by space_id
            return GPIO.mock_distance(space_id) if space_id else random.uniform(5.0, 30.0)  # type: ignore[attr-defined]

        # Ensure trigger is low
        GPIO.output(trig, 0)
        time.sleep(0.000002)  # 2 µs settle

        # 10 µs trigger pulse
        GPIO.output(trig, 1)
        time.sleep(self.TRIGGER_PULSE_S)
        GPIO.output(trig, 0)

        # Wait for echo HIGH
        pulse_start = time.monotonic()
        while GPIO.input(echo) == 0:
            if time.monotonic() - pulse_start > self.ECHO_TIMEOUT_S:
                return None
            pulse_start = time.monotonic()

        # Time the HIGH duration
        pulse_end = time.monotonic()
        while GPIO.input(echo) == 1:
            pulse_end = time.monotonic()
            if pulse_end - pulse_start > self.ECHO_TIMEOUT_S:
                return None

        elapsed = pulse_end - pulse_start
        distance_cm = (elapsed * 34300) / 2
        return round(distance_cm, 1)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def read_all(self) -> dict[str, Optional[float]]:
        """
        Read all five sensors.

        Returns::

            {
                "L1": 12.3,   # cm
                "L2": None,   # timeout / sensor error
                "L3": 26.7,
                ...
            }
        """
        results: dict[str, Optional[float]] = {}
        for space_id, (trig, echo) in PIN_MAP.items():
            results[space_id] = self.measure_distance(trig, echo, space_id)
        return results

    @staticmethod
    def is_occupied(distance_cm: Optional[float]) -> bool:
        """Return True if distance indicates a vehicle is present."""
        if distance_cm is None:
            return False
        return distance_cm < OCCUPIED_THRESHOLD_CM

    def cleanup(self) -> None:
        GPIO.cleanup()


# ---------------------------------------------------------------------------
# Navigator client (HTTP push)
# ---------------------------------------------------------------------------


def push_to_navigator(spaces: list[dict]) -> None:
    """POST current lower-deck occupancy to the Parking Navigator API."""
    free = sum(1 for s in spaces if s["status"] == "free")
    payload = {
        "lot_id": LOT_ID,
        "source": "ultrasonic",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total_spaces": len(spaces),
        "free_spaces": free,
        "occupied_spaces": len(spaces) - free,
        "spaces": spaces,
    }
    try:
        resp = requests.post(
            NAVIGATOR_API_URL,
            json=payload,
            headers={"X-API-Key": NAVIGATOR_API_KEY},
            timeout=5,
        )
        resp.raise_for_status()
        print(
            f"[push] → {NAVIGATOR_API_URL}  "
            f"free={free}/{len(spaces)}  HTTP {resp.status_code}",
            flush=True,
        )
    except requests.RequestException as exc:
        print(f"[push] ERROR: {exc}", flush=True)


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------


def main() -> None:
    reader = SensorReader()

    # Debounce: track pending state changes before committing
    # reported_state[sid] = "free" | "occupied" | "unknown"
    reported_state: dict[str, str] = {sid: "unknown" for sid in PIN_MAP}
    # pending_state[sid] = (candidate_status, consecutive_count)
    pending: dict[str, tuple[str, int]] = {sid: ("unknown", 0) for sid in PIN_MAP}

    print(
        f"\n[SensorReader] Polling every {POLL_INTERVAL}s  "
        f"threshold={OCCUPIED_THRESHOLD_CM} cm  debounce={DEBOUNCE_N}x\n",
        flush=True,
    )

    changed_ever = False

    try:
        while True:
            distances = reader.read_all()
            state_changed = False

            for sid, dist in distances.items():
                new_status = "occupied" if reader.is_occupied(dist) else "free"
                candidate, count = pending[sid]

                if new_status == candidate:
                    count += 1
                else:
                    candidate = new_status
                    count = 1

                pending[sid] = (candidate, count)

                if count >= DEBOUNCE_N and candidate != reported_state[sid]:
                    reported_state[sid] = candidate
                    state_changed = True
                    print(
                        f"  {sid}: {candidate}"
                        + (f"  ({dist:.1f} cm)" if dist is not None else "  (no echo)"),
                        flush=True,
                    )

            if state_changed or not changed_ever:
                spaces = [
                    {
                        "id": sid,
                        "status": reported_state[sid],
                        "distance_cm": distances.get(sid),
                    }
                    for sid in PIN_MAP
                ]
                push_to_navigator(spaces)
                changed_ever = True

            time.sleep(POLL_INTERVAL)

    except BaseException as exc:
        # Catch everything — KeyboardInterrupt, SystemExit, unexpected crashes —
        # so GPIO.cleanup() is guaranteed to run and pins are not left in a bad state.
        if isinstance(exc, KeyboardInterrupt):
            print("\n[SensorReader] Interrupted — cleaning up GPIO.", flush=True)
        else:
            print(
                f"\n[SensorReader] Unexpected error ({type(exc).__name__}): {exc}",
                flush=True,
            )
            raise
    finally:
        reader.cleanup()


if __name__ == "__main__":
    main()
