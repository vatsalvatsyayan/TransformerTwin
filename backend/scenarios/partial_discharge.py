"""
TransformerTwin — FM-004 Partial Discharge scenario.

Void/moisture partial discharge in winding insulation.
Progresses over 2 simulated hours (7200 sim-seconds).

Physics: Electrical micro-discharges in void defects in oil-paper insulation.
DGA signature: CH4 and H2 dominate; C2H4 minimal; C2H2 essentially absent.
In the Duval ternary (CH4, C2H4, C2H2), CH4 > 95% → PD zone.

IEC 60599 Section 5.1 states: "PD in oil gives mainly hydrogen and methane."

Stages:
  Stage 1 (0–2400 s):    Void discharge initiating — H2 and CH4 rising slowly
  Stage 2 (2400–5400 s): PD accelerating — CH4 accumulating in PD zone
  Stage 3 (5400–7200 s): PD zone established — TDCG reaching CAUTION level
"""

from config import SCENARIO_PARTIAL_DISCHARGE_DURATION_S
from scenarios.base import BaseScenario

# Winding temperature additive offset (°C)
# Partial discharge causes dielectric losses that slightly heat the insulation locally
_WINDING_DELTA: float = 5.0  # Mild heating — PD is primarily electrical, not thermal

# Stage boundaries (sim-seconds)
_STAGE_1_END_S: float = 2400.0
_STAGE_2_END_S: float = 5400.0

# DGA injection rates (ppm/second) per stage
# CH4/H2 ratio ≈ 3:1 — characteristic of oil PD (IEC 60599 Table 1)
# C2H4 kept < 0.5% of CH4+C2H4+C2H2 total to keep Duval point in PD zone
_DGA_STAGE_1: dict[str, float] = {
    "DGA_H2":   0.003,   # H2: early PD marker
    "DGA_CH4":  0.012,   # CH4 dominant — drives Duval toward PD zone
}

_DGA_STAGE_2: dict[str, float] = {
    "DGA_H2":   0.008,
    "DGA_CH4":  0.030,   # CH4 accelerating — Duval firmly in PD zone
    "DGA_C2H4": 0.0005,  # Trace only — must stay < 5% of CH4 for PD classification
}

_DGA_STAGE_3: dict[str, float] = {
    "DGA_H2":   0.015,
    "DGA_CH4":  0.060,   # CH4 dominant — TDCG approaching CAUTION
    "DGA_C2H4": 0.001,   # Still trace — Duval remains in PD zone
}


class PartialDischargeScenario(BaseScenario):
    """FM-004: Partial discharge from void/moisture defects in insulation."""

    scenario_id = "partial_discharge"
    name = "Partial Discharge"
    description = (
        "Void/moisture partial discharge in winding insulation. "
        "CH4 and H2 rise with CH4 dominant — Duval triangle moves to PD zone. "
        "Develops over 2 simulated hours."
    )
    duration_sim_s = SCENARIO_PARTIAL_DISCHARGE_DURATION_S

    def get_current_stage(self) -> str:
        """Return current stage description based on elapsed sim time."""
        t = self.elapsed_sim_time
        if t < _STAGE_1_END_S:
            return "Stage 1: Void discharge initiating — H2 and CH4 rising"
        elif t < _STAGE_2_END_S:
            return "Stage 2: PD accelerating — CH4 accumulating, Duval → PD zone"
        else:
            return "Stage 3: PD established — TDCG in CAUTION range, investigation required"

    def get_thermal_modifiers(self) -> dict[str, float]:
        """Return winding temperature additive offset for partial discharge.

        PD causes mild dielectric losses but no significant bulk heating.

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
