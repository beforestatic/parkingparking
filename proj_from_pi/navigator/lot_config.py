"""
Static metadata for the Times Parking mockup lot.
This module is imported by main.py to seed the in-memory state.
"""

LOT_STATIC: dict = {
    "lot_id": "times-mockup-01",
    "name": "Times Parking (Mockup)",
    "brand": "Times",
    "address": "Demo Location",
    "total_spaces": 5,
    "tiers": [
        {
            "id": "lower",
            "label": "Lower Deck (Covered)",
            "spaces": ["L1", "L2", "L3", "L4", "L5"],
        },
    ],
}

# Default label map: space_id -> human-readable label
SPACE_LABELS: dict[str, str] = {
    "L1": "Lower 1",
    "L2": "Lower 2",
    "L3": "Lower 3",
    "L4": "Lower 4",
    "L5": "Lower 5",
}

# All canonical space IDs in order
ALL_SPACE_IDS: list[str] = ["L1", "L2", "L3", "L4", "L5"]
