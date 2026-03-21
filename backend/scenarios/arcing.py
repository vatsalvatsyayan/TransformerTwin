"""
TransformerTwin — FM-003 Arcing Event scenario.

A high-energy electrical discharge in the oil.
Progresses over 15 simulated minutes (900 sim-seconds).

Stages:
  0–30%:   Stage 1: Discharge inception — C2H2 spike beginning
  30–70%:  Stage 2: Active arcing — H2 and C2H2 rapid rise
  70–100%: Stage 3: Severe arc — CRITICAL thresholds

Skeleton only — modifiers implemented in Phase 1.4.
"""

from config import SCENARIO_ARCING_DURATION_S
from scenarios.base import BaseScenario


class ArcingScenario(BaseScenario):
    """FM-003: High-energy arcing event in oil."""

    scenario_id = "arcing"
    name = "Arcing Event"
    description = (
        "High-energy electrical discharge in transformer oil. "
        "Rapid C₂H₂ and H₂ generation over 15 simulated minutes."
    )
    duration_sim_s = SCENARIO_ARCING_DURATION_S

    def get_current_stage(self) -> str:
        """Return current stage description based on progress."""
        p = self.progress_percent
        if p < 30:
            return "Stage 1: Discharge inception — C₂H₂ spike beginning"
        elif p < 70:
            return "Stage 2: Active arcing — H₂ and C₂H₂ rapid rise"
        else:
            return "Stage 3: Severe arc — critical gas levels"

    def get_thermal_modifiers(self) -> dict[str, float]:
        """No significant bulk temperature rise from arcing (localized)."""
        # TODO (Phase 1.4): small winding temp offset
        return {}

    def get_dga_modifiers(self) -> dict[str, float]:
        """Aggressive C2H2 and H2 generation multipliers."""
        # TODO (Phase 1.4): implement stage-based arcing gas ratios
        return {
            "DGA_H2": 1.0,
            "DGA_C2H2": 1.0,
            "DGA_CH4": 1.0,
        }
