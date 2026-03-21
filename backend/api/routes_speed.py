"""
TransformerTwin — Simulation speed REST route.

PUT /api/simulation/speed — change simulation time multiplier
"""

import logging

from fastapi import APIRouter, Request

from config import (
    DGA_UPDATE_INTERVAL_SIM_S,
    DIAGNOSTIC_UPDATE_INTERVAL_SIM_S,
    EQUIPMENT_UPDATE_INTERVAL_SIM_S,
    THERMAL_UPDATE_INTERVAL_SIM_S,
)
from models.schemas import SpeedUpdateRequestSchema, SpeedUpdateResponseSchema

logger = logging.getLogger(__name__)

router = APIRouter()


@router.put("/simulation/speed", response_model=SpeedUpdateResponseSchema)
async def set_simulation_speed(
    body: SpeedUpdateRequestSchema,
    request: Request,
) -> SpeedUpdateResponseSchema:
    """Change the simulation time multiplier.

    Args:
        body: SpeedUpdateRequestSchema with speed_multiplier (1–60).
        request: FastAPI request (access to app.state.simulator).

    Returns:
        SpeedUpdateResponseSchema with new speed and effective intervals.
    """
    speed = body.speed_multiplier

    # TODO (Phase 1.6): request.app.state.simulator.set_speed(speed)

    # Compute effective wall-clock milliseconds per group at this speed
    def ms(sim_interval_s: int) -> int:
        """Convert sim-second interval to wall-clock milliseconds.

        Args:
            sim_interval_s: Interval in simulation seconds.

        Returns:
            Wall-clock milliseconds rounded to nearest integer.
        """
        return round((sim_interval_s / speed) * 1000)

    return SpeedUpdateResponseSchema(
        speed_multiplier=speed,
        effective_intervals={  # type: ignore[arg-type]
            "thermal_ms": ms(THERMAL_UPDATE_INTERVAL_SIM_S),
            "dga_ms": ms(DGA_UPDATE_INTERVAL_SIM_S),
            "equipment_ms": ms(EQUIPMENT_UPDATE_INTERVAL_SIM_S),
            "diagnostic_ms": ms(DIAGNOSTIC_UPDATE_INTERVAL_SIM_S),
        },
    )
