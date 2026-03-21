"""
TransformerTwin — FM-006 Cooling Fan Failure scenario.

Fan bank failure causes progressive oil and winding temperature rise.
Progresses over 1 simulated hour (3600 sim-seconds).

Stages:
  0–25%:   Stage 1: Fan bank 1 fails — reduced cooling
  25–60%:  Stage 2: Temperature rising — approaching CAUTION
  60–85%:  Stage 3: Temperature at WARNING — fan bank 2 overloaded
  85–100%: Stage 4: Critical overheating — oil pump at limit

Skeleton only — modifiers implemented in Phase 1.4.
"""

from config import SCENARIO_COOLING_FAILURE_DURATION_S
from scenarios.base import BaseScenario


class CoolingFailureScenario(BaseScenario):
    """FM-006: Cooling fan failure causing progressive overheating."""

    scenario_id = "cooling_failure"
    name = "Cooling Fan Failure"
    description = (
        "Cooling fan bank failure causing progressive oil temperature rise. "
        "Develops over 1 simulated hour."
    )
    duration_sim_s = SCENARIO_COOLING_FAILURE_DURATION_S

    def get_current_stage(self) -> str:
        """Return current stage description based on progress."""
        p = self.progress_percent
        if p < 25:
            return "Stage 1: Fan bank 1 fails — reduced cooling capacity"
        elif p < 60:
            return "Stage 2: Temperature rising — CAUTION threshold approaching"
        elif p < 85:
            return "Stage 3: Temperature at WARNING — fan bank 2 overloaded"
        else:
            return "Stage 4: Critical overheating"

    def get_thermal_modifiers(self) -> dict[str, float]:
        """Return temperature offsets from reduced cooling."""
        # TODO (Phase 1.4): implement progressive temperature rise
        return {
            "top_oil_temp_offset": 0.0,
            "winding_temp_offset": 0.0,
        }

    def get_dga_modifiers(self) -> dict[str, float]:
        """Return DGA multipliers from thermal overloading."""
        # TODO (Phase 1.4): thermal gas generation increase
        return {}
