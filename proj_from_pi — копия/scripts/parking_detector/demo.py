"""
demo.py — Times Parking mockup demo configuration
===================================================
Defines the physical space layout (lower deck only, L1-L5),
car colour palette (real Tomica die-cast cars, OpenCV BGR order),
and named occupancy scenarios used by the detection demo.
"""

# ── Layout ─────────────────────────────────────────────────────────────────
# Lower deck only — one row of 5 spaces.

SPACE_IDS: list[str] = ["L1", "L2", "L3", "L4", "L5"]

SPACE_LABELS: dict[str, str] = {
    "L1": "Lower 1",
    "L2": "Lower 2",
    "L3": "Lower 3",
    "L4": "Lower 4",
    "L5": "Lower 5",
}

# ── Car colour palette (OpenCV BGR) ────────────────────────────────────────
# Tuned to the real Tomica die-cast cars used in the demo rig.
#
#   Car                  BGR              Notes
#   ────────────────     ──────────────   ──────────────────────────────────
#   Glossy black VW      ( 25,  25,  25)  Very dark, almost no reflectance
#   Matte dark grey RR   ( 50,  50,  55)  Range Rover, slightly blue-grey
#   Red Toyota 86        (  0,   0, 200)  Pure red channel (R=200, B=G=0)
#   White Nissan GT-R    (215, 215, 210)  Warm white, slightly warm-grey

CAR_PALETTE: list[tuple[int, int, int]] = [
    (25,  25,  25),   # glossy black VW
    (50,  50,  55),   # matte dark grey Range Rover
    (0,   0,  200),   # red Toyota 86     (BGR: R channel = index 2)
    (215, 215, 210),  # white Nissan GT-R
]

# ── Scenarios ──────────────────────────────────────────────────────────────
# Each value is the list of space IDs that are OCCUPIED in that scenario.
# Spaces not listed are considered FREE.

SCENARIOS: dict[str, list[str]] = {
    "all_free":       [],
    "morning_light":  ["L2"],
    "midday_busy":    ["L1", "L2", "L3"],
    "evening_full":   ["L1", "L2", "L3", "L4", "L5"],
    "only_dark_cars": ["L2", "L4"],
}

# Default scenario shown on startup
DEFAULT_SCENARIO = "morning_light"


def scenario_to_space_map(scenario_name: str) -> dict[str, str]:
    """Return {space_id: 'occupied'|'free'} for the given scenario name."""
    occupied = set(SCENARIOS.get(scenario_name, SCENARIOS[DEFAULT_SCENARIO]))
    return {sid: ("occupied" if sid in occupied else "free") for sid in SPACE_IDS}
