"""
TransformerTwin — FM-002 Paper Insulation Degradation scenario.

Thermal degradation of solid cellulose (paper) winding insulation.
Progresses over 3 simulated hours (10800 sim-seconds).

Physics: Cellulose pyrolysis at elevated temperature produces CO and CO2.
CO rises faster than CO2, causing the CO2/CO ratio to fall below the normal
range (5–13). A ratio below 5 is a recognised paper fault indicator (IEC 60599).

DGA signature: CO and CO2 dominant; no significant hydrocarbons.
Thermal: mild +10°C winding delta — modest overheating accelerates paper aging.

IEC 60599 Section 5.3: "High CO2/CO ratios indicate paper aging; low ratios
(< 3) indicate active cellulose fault."

Stages:
  Stage 1 (0–3600 s):    Paper aging — CO₂/CO ratio declining from normal (>7)
  Stage 2 (3600–7200 s): Active degradation — CO₂/CO ratio approaching warning (<5)
  Stage 3 (7200–10800 s): Severe paper fault — CO₂/CO ratio critical (<3), immediate action
"""

from config import SCENARIO_PAPER_DEGRADATION_DURATION_S
from scenarios.base import BaseScenario

# Winding temperature additive offset (°C)
# Mild overtemperature accelerates cellulose chain scission
_WINDING_DELTA: float = 10.0

# Stage boundaries (sim-seconds)
_STAGE_1_END_S: float = 3600.0
_STAGE_2_END_S: float = 7200.0

# DGA injection rates (ppm/second) per stage
# CO/CO2 ratio by stage:
#   Stage 1: CO=0.020, CO2=0.120 → net ratio ≈ 6 (borderline normal)
#   Stage 2: CO=0.050, CO2=0.200 → net ratio ≈ 4 (below warning threshold)
#   Stage 3: CO=0.100, CO2=0.250 → net ratio ≈ 2.5 (critical paper fault)
# A trace CH4 (0.002 ppm/s) represents mild oil thermal side reactions
_DGA_STAGE_1: dict[str, float] = {
    "DGA_CO":   0.020,   # CO rising — early paper aging marker
    "DGA_CO2":  0.120,   # CO2 rising faster initially — ratio still >5
    "DGA_CH4":  0.002,   # Trace thermal side product
}

_DGA_STAGE_2: dict[str, float] = {
    "DGA_CO":   0.050,   # CO accelerating faster than CO2 — ratio dropping
    "DGA_CO2":  0.200,   # CO2 still rising but CO catching up
    "DGA_CH4":  0.002,
}

_DGA_STAGE_3: dict[str, float] = {
    "DGA_CO":   0.100,   # CO dominant — ratio now below 3 → severe paper fault
    "DGA_CO2":  0.250,   # CO2 still rising but CO far outpacing it
    "DGA_CH4":  0.003,
}


class PaperDegradationScenario(BaseScenario):
    """FM-002: Thermal degradation of paper winding insulation."""

    scenario_id = "paper_degradation"
    name = "Paper Insulation Degradation"
    description = (
        "Thermal degradation of cellulose paper winding insulation. "
        "CO rises faster than CO2, driving CO2/CO ratio below the normal range (5–13). "
        "Develops over 3 simulated hours."
    )
    duration_sim_s = SCENARIO_PAPER_DEGRADATION_DURATION_S

    def get_current_stage(self) -> str:
        """Return current stage description based on elapsed sim time."""
        t = self.elapsed_sim_time
        if t < _STAGE_1_END_S:
            return "Stage 1: Paper aging — CO₂/CO ratio declining from normal (>7)"
        elif t < _STAGE_2_END_S:
            return "Stage 2: Active degradation — CO₂/CO ratio approaching warning (<5)"
        else:
            return "Stage 3: Severe paper fault — CO₂/CO ratio critical (<3), immediate action required"

    def get_thermal_modifiers(self) -> dict[str, float]:
        """Return winding temperature additive offset throughout scenario.

        Mild overtemperature accelerates cellulose chain scission throughout.

        Returns:
            Dict with key "winding_delta": additive °C.
        """
        return {"winding_delta": _WINDING_DELTA}

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
