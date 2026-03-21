"""
TransformerTwin — What-if simulation REST route.

POST /api/simulation — run a what-if thermal/aging projection.

Phase 2.5: Arrhenius insulation aging model (IEC 60076-7 Annex A).
"""

import logging
import math

from fastapi import APIRouter

from config import (
    AGING_REFERENCE_TEMP_C,
    AGING_ARRHENIUS_K,
    COOLING_PARAMS,
    SENSOR_THRESHOLDS,
)
from models.schemas import SimulationRequestSchema, SimulationResponseSchema
from simulator.thermal_model import ThermalModel

logger = logging.getLogger(__name__)

router = APIRouter()

# Number of thermal ticks per simulated day at constant conditions
# We use 3600-second steps (1 hour per step) for efficiency
_STEP_S: float = 3600.0   # 1 sim-hour per projection step
_STEPS_PER_DAY: int = 24  # 24 steps = 1 day

# WINDING_TEMP WARNING threshold (from config) — used for days-to-warning calc
_WINDING_WARNING_C: float = SENSOR_THRESHOLDS.get("WINDING_TEMP", (90.0, 105.0, 120.0))[1]


def _aging_rate(winding_temp_c: float) -> float:
    """Compute relative insulation aging rate at a given winding temperature.

    IEC 60076-7 Annex A formula:
        V = exp(K × (θ_H - θ_H_ref))
    where θ_H_ref = 98°C (reference hot spot temperature)
    and K = ln(2)/6 ≈ 0.1155 (aging doubles every 6°C above reference).

    Args:
        winding_temp_c: Winding hot spot temperature in °C.

    Returns:
        Relative aging rate (1.0 = nominal, >1 = faster aging).
    """
    return math.exp(AGING_ARRHENIUS_K * (winding_temp_c - AGING_REFERENCE_TEMP_C))


@router.post("/simulation", response_model=SimulationResponseSchema)
async def run_simulation(body: SimulationRequestSchema) -> SimulationResponseSchema:
    """Run a what-if thermal + insulation aging projection.

    Uses ThermalModel to compute steady-state temperatures at the requested
    load/ambient/cooling conditions, then applies the IEC 60076-7 Arrhenius
    aging formula to estimate cumulative insulation aging over the horizon.

    Args:
        body: Simulation parameters (load, ambient, cooling, horizon).

    Returns:
        SimulationResponseSchema with projected temperatures and aging factor.
    """
    load_fraction = body.load_percent / 100.0
    ambient_temp = body.ambient_temp_c
    cooling_mode = body.cooling_mode

    # Validate cooling mode is in config
    if cooling_mode not in COOLING_PARAMS:
        cooling_mode = "ONAN"

    # Create an isolated ThermalModel initialized to steady state
    thermal = ThermalModel()
    thermal.initialize_steady_state(load_fraction, ambient_temp, cooling_mode)

    # Run for a few steps to reach steady state (initialization already handles this,
    # but a short burn-in removes any lag residual from the warm-start)
    for _ in range(12):  # 12 × 1h = 12 sim-hours burn-in
        state = thermal.tick(_STEP_S, load_fraction, ambient_temp, cooling_mode)

    projected_top_oil = round(state.top_oil_temp, 1)
    projected_winding = round(state.winding_temp, 1)
    aging_factor_steady = round(_aging_rate(projected_winding), 3)

    # Build day-by-day timeline
    # For a constant-load scenario the temperatures are constant after burn-in.
    # Cumulative aging factor grows each day.
    timeline: list[dict] = []
    cumulative_aging = 0.0
    days_to_warning: float | None = None

    for day in range(1, body.time_horizon_days + 1):
        # Each day: 24 hourly steps with constant conditions
        daily_aging = 0.0
        for _ in range(_STEPS_PER_DAY):
            tick_state = thermal.tick(_STEP_S, load_fraction, ambient_temp, cooling_mode)
            daily_aging += _aging_rate(tick_state.winding_temp)

        # Average hourly aging rate for the day
        avg_daily_aging = daily_aging / _STEPS_PER_DAY
        cumulative_aging += avg_daily_aging

        if days_to_warning is None and tick_state.winding_temp >= _WINDING_WARNING_C:
            days_to_warning = float(day)

        timeline.append({
            "day": day,
            "hotspot_temp_c": round(tick_state.winding_temp, 1),
            "top_oil_temp_c": round(tick_state.top_oil_temp, 1),
            "aging_factor": round(avg_daily_aging, 3),
        })

    total_days = body.time_horizon_days
    avg_aging = round(cumulative_aging / total_days, 3) if total_days > 0 else 1.0

    # Human-readable aging interpretation
    if avg_aging < 0.5:
        aging_interpretation = (
            f"Operating conditions are favorable. Insulation aging at {avg_aging:.2f}× "
            "normal rate — transformer life extended."
        )
    elif avg_aging <= 1.5:
        aging_interpretation = (
            f"Normal aging rate ({avg_aging:.2f}×). No action required."
        )
    elif avg_aging <= 5.0:
        aging_interpretation = (
            f"Elevated aging rate ({avg_aging:.2f}×). Consider load reduction or "
            "cooling improvement to reduce insulation wear."
        )
    else:
        aging_interpretation = (
            f"Critical aging rate ({avg_aging:.2f}×). Immediate action required — "
            "reduce load and verify cooling to prevent premature failure."
        )

    # Cooling energy impact: OFAF saves ~45% energy vs ONAN; ONAF saves ~27%
    cooling_energy_map = {"ONAN": 0.0, "ONAF": -27.0, "OFAF": -45.0}
    cooling_energy_impact = cooling_energy_map.get(cooling_mode, 0.0)
    if cooling_energy_impact < 0:
        cooling_energy_interpretation = (
            f"{cooling_mode} cooling reduces transformer losses by "
            f"~{abs(cooling_energy_impact):.0f}% vs ONAN baseline."
        )
    else:
        cooling_energy_interpretation = "ONAN (natural cooling) — no auxiliary cooling energy."

    return SimulationResponseSchema(
        projected_hotspot_temp_c=projected_winding,
        projected_top_oil_temp_c=projected_top_oil,
        aging_acceleration_factor=avg_aging,
        aging_interpretation=aging_interpretation,
        estimated_days_to_warning=days_to_warning,
        cooling_energy_impact_percent=cooling_energy_impact,
        cooling_energy_interpretation=cooling_energy_interpretation,
        projection_timeline=timeline,  # type: ignore[arg-type]
    )
