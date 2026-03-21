"""
TransformerTwin — FM-001 Developing Hot Spot scenario.

A blocked cooling duct causes localized winding overheating.
Progresses over 2 simulated hours (7200 sim-seconds).

Stages:
  0–20%:   Stage 1: Blocked duct detected — slight winding temp rise
  20–60%:  Stage 2: Gas generation beginning — CH4, C2H4 rising
  60–90%:  Stage 3: Hot spot established — WINDING_TEMP WARNING threshold
  90–100%: Stage 4: Critical — CRITICAL threshold approaching

Skeleton only — modifiers implemented in Phase 1.4.
"""

from config import SCENARIO_HOT_SPOT_DURATION_S
from scenarios.base import BaseScenario


class HotSpotScenario(BaseScenario):
    """FM-001: Developing winding hot spot from blocked cooling duct."""

    scenario_id = "hot_spot"
    name = "Developing Hot Spot"
    description = (
        "Blocked cooling duct causing localized winding overheating. "
        "Develops over 2 simulated hours."
    )
    duration_sim_s = SCENARIO_HOT_SPOT_DURATION_S

    def get_current_stage(self) -> str:
        """Return current stage description based on progress."""
        p = self.progress_percent
        if p < 20:
            return "Stage 1: Blocked duct detected — winding temp rising"
        elif p < 60:
            return "Stage 2: Gas generation beginning"
        elif p < 90:
            return "Stage 3: Hot spot established"
        else:
            return "Stage 4: Critical — immediate action required"

    def get_thermal_modifiers(self) -> dict[str, float]:
        """Return winding temperature offset based on fault progression."""
        # TODO (Phase 1.4): return proportional temperature offset
        return {"winding_temp_offset": 0.0}

    def get_dga_modifiers(self) -> dict[str, float]:
        """Return DGA rate multipliers based on fault progression."""
        # TODO (Phase 1.4): return stage-based gas generation multipliers
        return {
            "DGA_H2": 1.0,
            "DGA_CH4": 1.0,
            "DGA_C2H6": 1.0,
            "DGA_C2H4": 1.0,
            "DGA_C2H2": 1.0,
        }
