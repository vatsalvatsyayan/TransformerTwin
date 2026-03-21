"""
TransformerTwin — FM-003 Arcing Event scenario.

High-energy electrical discharge in the oil.
Duration: 15 simulated minutes (900 sim-seconds).

Stages (docs/DGA_GAS_GENERATION.md Section 4.3):
  Stage 1 (0–180 s):   Pre-arc, discharge beginning
  Stage 2 (180–600 s): Active arcing — H2 and C2H2 rapid rise
  Stage 3 (600–900 s): Post-arc — gases dissolving
"""

from config import SCENARIO_ARCING_DURATION_S
from scenarios.base import BaseScenario

_DGA_STAGE_1: dict[str, float] = {
    "DGA_H2":   0.05,
    "DGA_C2H2": 0.02,
}

_DGA_STAGE_2: dict[str, float] = {
    "DGA_H2":   0.80,   # H2 spikes dramatically during arcing
    "DGA_C2H2": 0.50,   # C2H2 spike — primary arcing indicator
    "DGA_CH4":  0.10,
    "DGA_C2H4": 0.05,
}

_DGA_STAGE_3: dict[str, float] = {
    "DGA_H2":   0.10,
    "DGA_C2H2": 0.05,   # Rate drops but accumulated level remains
}

_STAGE_1_END_S: float = 180.0
_STAGE_2_END_S: float = 600.0


class ArcingScenario(BaseScenario):
    """FM-003: High-energy arcing event in oil."""

    scenario_id = "arcing"
    name = "Arcing Event"
    description = (
        "High-energy electrical discharge in transformer oil. "
        "Rapid C2H2 and H2 generation over 15 simulated minutes."
    )
    duration_sim_s = SCENARIO_ARCING_DURATION_S

    def get_current_stage(self) -> str:
        """Return current stage description based on elapsed sim time."""
        t = self.elapsed_sim_time
        if t < _STAGE_1_END_S:
            return "Stage 1: Discharge inception — C2H2 spike beginning"
        elif t < _STAGE_2_END_S:
            return "Stage 2: Active arcing — H2 and C2H2 rapid rise"
        else:
            return "Stage 3: Post-arc — gases dissolving"

    def get_thermal_modifiers(self) -> dict[str, float]:
        """Minor thermal contribution from arc (localized, not bulk oil).

        Returns:
            Dict with "winding_delta": small constant additive degrees C.
        """
        # Source: docs/THERMAL_PHYSICS.md Section 5 — arcing: +5 degrees C winding
        return {"winding_delta": 5.0}

    def get_dga_modifiers(self) -> dict[str, float]:
        """Return per-gas ppm/second injection rates for current stage.

        Returns:
            Dict mapping DGA sensor ID to ppm/second injection rate.
        """
        t = self.elapsed_sim_time
        if t < _STAGE_1_END_S:
            return dict(_DGA_STAGE_1)
        elif t < _STAGE_2_END_S:
            return dict(_DGA_STAGE_2)
        else:
            return dict(_DGA_STAGE_3)
