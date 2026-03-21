"""
TransformerTwin — FM-001 Developing Hot Spot scenario.

A blocked cooling duct causes localized winding overheating.
Progresses over 2 simulated hours (7200 sim-seconds).

Stages (from docs/THERMAL_PHYSICS.md and docs/DGA_GAS_GENERATION.md):
  Stage 1 (0–1800 s):    Hot spot forming — slight winding temp rise
  Stage 2 (1800–5400 s): Gas generation building — CH4, C2H4 rising
  Stage 3 (5400–7200 s): Critical hot spot — approaching CRITICAL threshold
"""

from config import SCENARIO_HOT_SPOT_DURATION_S
from scenarios.base import BaseScenario

# Thermal modifiers: additive °C applied to winding temperature after physics lag
# Source: docs/THERMAL_PHYSICS.md Section 5
_WINDING_DELTA_STAGE_1: float = 15.0
_WINDING_DELTA_STAGE_2: float = 40.0
_WINDING_DELTA_STAGE_3: float = 80.0

# DGA modifiers: direct ppm/second injection per gas
# Source: docs/DGA_GAS_GENERATION.md Section 4.2
_DGA_STAGE_1: dict[str, float] = {
    "DGA_H2":   0.002,
    "DGA_CH4":  0.001,
    "DGA_C2H4": 0.001,
}

_DGA_STAGE_2: dict[str, float] = {
    "DGA_H2":   0.010,
    "DGA_CH4":  0.008,
    "DGA_C2H4": 0.015,  # C2H4 becoming dominant -> Duval moves toward T2
    "DGA_CO":   0.020,
}

_DGA_STAGE_3: dict[str, float] = {
    "DGA_H2":   0.025,
    "DGA_CH4":  0.020,
    "DGA_C2H4": 0.060,  # C2H4 dominant — Duval in T2/T3 zone
    "DGA_C2H2": 0.003,
    "DGA_CO":   0.080,
    "DGA_CO2":  0.200,
}

_STAGE_1_END_S: float = 1800.0
_STAGE_2_END_S: float = 5400.0


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
        """Return current stage description based on elapsed sim time."""
        t = self.elapsed_sim_time
        if t < _STAGE_1_END_S:
            return "Stage 1: Hot spot forming — winding temp rising"
        elif t < _STAGE_2_END_S:
            return "Stage 2: Gas generation building — CH4, C2H4 rising"
        else:
            return "Stage 3: Critical hot spot — immediate action required"

    def get_thermal_modifiers(self) -> dict[str, float]:
        """Return winding and oil temperature additive offsets for current stage.

        In a real developing hot spot, excess winding heat transfers to the oil,
        raising top-oil temperature and eventually activating fan banks.
        top_oil_delta is a simplified surrogate for this heat transfer — it does
        NOT feed back into the thermal lag (same treatment as winding_delta).

        Returns:
            Dict with keys "winding_delta" and "top_oil_delta": additive °C.
        """
        t = self.elapsed_sim_time
        if t < _STAGE_1_END_S:
            # Stage 1: winding local overheating only; oil not yet affected
            return {"winding_delta": _WINDING_DELTA_STAGE_1, "top_oil_delta": 0.0}
        elif t < _STAGE_2_END_S:
            # Stage 2: heat spreading to oil — top oil rises ~15 °C above normal
            # (normal peak ~65 °C → ~80 °C → Fan Bank 1 activates at 75 °C)
            return {"winding_delta": _WINDING_DELTA_STAGE_2, "top_oil_delta": 15.0}
        else:
            # Stage 3: severe — top oil rises ~25 °C, Fan Bank 2 may also activate
            return {"winding_delta": _WINDING_DELTA_STAGE_3, "top_oil_delta": 25.0}

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
