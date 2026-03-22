"""
TransformerTwin — Thermal Runaway Cascade scenario.

Six-stage chain: Cooling Failure → Hot Spot → Oil/Paper Deterioration
→ Partial Discharge → Arcing → Terminal Failure.

Total duration: 9000 sim-seconds.
Physical basis: each stage causes conditions that trigger the next —
genuine causal coupling across mechanical, thermal, chemical, and electrical subsystems.
"""

from config import (
    SCENARIO_THERMAL_RUNAWAY_DURATION_S,
    THERMAL_RUNAWAY_STAGE_1_END_S,
    THERMAL_RUNAWAY_STAGE_2_END_S,
    THERMAL_RUNAWAY_STAGE_3_END_S,
    THERMAL_RUNAWAY_STAGE_4_END_S,
    THERMAL_RUNAWAY_STAGE_5_END_S,
)
from scenarios.base import BaseScenario

# --- Thermal modifiers (°C, additive to physics model output) ---
_THERMAL: dict[int, dict[str, float]] = {
    1: {"winding_delta": 8.0,  "top_oil_delta": 3.0},
    2: {"winding_delta": 35.0, "top_oil_delta": 18.0},
    3: {"winding_delta": 55.0, "top_oil_delta": 30.0},
    4: {"winding_delta": 70.0, "top_oil_delta": 38.0},
    5: {"winding_delta": 85.0, "top_oil_delta": 45.0},
    6: {"winding_delta": 0.0,  "top_oil_delta": 0.0},  # De-energised
}

# --- DGA modifiers (ppm/second injection, positive = increase) ---
_DGA: dict[int, dict[str, float]] = {
    1: {},  # No DGA yet — cooling failure not yet producing gas
    2: {"DGA_H2": 0.008, "DGA_CH4": 0.010, "DGA_C2H4": 0.012, "DGA_CO": 0.015},
    3: {"DGA_H2": 0.012, "DGA_CH4": 0.018, "DGA_C2H4": 0.025, "DGA_CO": 0.040, "DGA_CO2": 0.025},
    # Stage 4: H2 and CH4 dominant (PD signature — CH4 > C2H4, H2 rising fast)
    4: {"DGA_H2": 0.045, "DGA_CH4": 0.040, "DGA_C2H4": 0.008, "DGA_CO": 0.060, "DGA_CO2": 0.035},
    # Stage 5: C2H2 primary (arcing fingerprint)
    5: {"DGA_C2H2": 0.055, "DGA_H2": 0.080, "DGA_CH4": 0.020, "DGA_CO": 0.080, "DGA_CO2": 0.050},
    # Stage 6: gases stabilize (de-energised), minimal new generation
    6: {"DGA_C2H2": 0.005, "DGA_H2": 0.008},
}

# --- Diagnostic modifiers (additive offset from nominal) ---
# OIL_DIELECTRIC nominal = 55.0 kV/mm; WARNING < 40 kV/mm; CRITICAL < 30 kV/mm
# OIL_MOISTURE nominal = 8.0 ppm; WARNING = 25 ppm; CRITICAL = 35 ppm
# BUSHING_CAP_HV nominal = 500.0 pF; drift >10% = fault
_DIAG: dict[int, dict[str, float]] = {
    1: {},
    2: {},
    3: {"OIL_DIELECTRIC": -8.0,  "OIL_MOISTURE": +12.0},
    4: {"OIL_DIELECTRIC": -18.0, "OIL_MOISTURE": +22.0, "BUSHING_CAP_HV": +30.0},
    5: {"OIL_DIELECTRIC": -28.0, "OIL_MOISTURE": +30.0, "BUSHING_CAP_HV": +65.0},
    6: {"OIL_DIELECTRIC": -35.0, "OIL_MOISTURE": +35.0, "BUSHING_CAP_HV": +90.0},
}

_STAGE_NAMES: dict[int, str] = {
    1: "Stage 1/6: Cooling System Failure",
    2: "Stage 2/6: Hot Spot Formation",
    3: "Stage 3/6: Oil & Paper Deterioration",
    4: "Stage 4/6: Partial Discharge",
    5: "Stage 5/6: Arc Development",
    6: "Stage 6/6: TERMINAL FAILURE — Relay Trip",
}


class ThermalRunawayScenario(BaseScenario):
    """Six-stage cascading failure from cooling loss to terminal relay trip.

    Stage progression:
        Stage 1 (0–1500s):   Fan seizure → ONAN cooling only, oil heating
        Stage 2 (1500–3000s): Hot spot +35°C above physics model, early DGA
        Stage 3 (3000–4800s): Oil/paper deterioration, OIL_DIELECTRIC falls, CO rises
        Stage 4 (4800–6600s): Partial discharge, H2/CH4 dominant (Duval PD zone)
        Stage 5 (6600–8100s): Arcing, C2H2 spikes (Duval D1/D2), bushing drift
        Stage 6 (8100–9000s): Terminal failure — relay operated, LOAD_CURRENT=0
    """

    scenario_id = "thermal_runaway"
    name = "Thermal Runaway — Full Cascade"
    description = (
        "Fan seizure → hot spot → oil/paper degradation → partial discharge → "
        "arcing → protection relay trip. Demonstrates complete transformer failure."
    )
    duration_sim_s = SCENARIO_THERMAL_RUNAWAY_DURATION_S

    def _stage(self) -> int:
        """Return current stage number (1–6) based on elapsed simulation time."""
        t = self.elapsed_sim_time
        if t < THERMAL_RUNAWAY_STAGE_1_END_S:
            return 1
        if t < THERMAL_RUNAWAY_STAGE_2_END_S:
            return 2
        if t < THERMAL_RUNAWAY_STAGE_3_END_S:
            return 3
        if t < THERMAL_RUNAWAY_STAGE_4_END_S:
            return 4
        if t < THERMAL_RUNAWAY_STAGE_5_END_S:
            return 5
        return 6

    def get_current_stage(self) -> str:
        """Return the human-readable description of the current scenario stage.

        Returns:
            Stage label string, e.g. "Stage 1/6: Cooling System Failure".
        """
        return _STAGE_NAMES[self._stage()]

    def get_thermal_modifiers(self) -> dict[str, float]:
        """Return additive temperature offsets + ONAN cooling override for stages 1–5.

        Stages 1–5 force ONAN cooling (fans seized). Stage 6 is de-energised
        so winding and oil temperatures return to ambient quickly.

        Returns:
            Dict with winding_delta, top_oil_delta, and cooling_mode_override.
        """
        stage = self._stage()
        mods: dict[str, float] = dict(_THERMAL[stage])
        # Stages 1–5: cooling system failed — force ONAN (natural convection only)
        if stage < 6:
            mods["cooling_mode_override"] = "ONAN"  # type: ignore[assignment]
        return mods

    def get_dga_modifiers(self) -> dict[str, float]:
        """Return per-gas injection rates (ppm/sim-second) for the current stage.

        Returns:
            Dict mapping DGA sensor IDs to injection rates.
        """
        return dict(_DGA[self._stage()])

    def get_diagnostic_modifiers(self) -> dict[str, float]:
        """Return additive offsets from nominal for diagnostic sensors.

        Returns:
            Dict mapping sensor IDs (OIL_DIELECTRIC, OIL_MOISTURE, BUSHING_CAP_HV)
            to signed float offsets. Empty dict for stages 1–2.
        """
        return dict(_DIAG[self._stage()])

    def is_terminal_failure(self) -> bool:
        """Return True when Stage 6 is active (protection relay has operated).

        The engine will freeze the transformer in a tripped state — LOAD_CURRENT
        forced to 0 — until the operator explicitly resets to normal.

        Returns:
            True once elapsed_sim_time >= THERMAL_RUNAWAY_STAGE_5_END_S.
        """
        return self.elapsed_sim_time >= THERMAL_RUNAWAY_STAGE_5_END_S
