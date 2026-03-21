"""
TransformerTwin — What-if simulation REST route.

POST /api/simulation — run a what-if thermal/aging projection
"""

import logging

from fastapi import APIRouter

from models.schemas import SimulationRequestSchema, SimulationResponseSchema

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/simulation", response_model=SimulationResponseSchema)
async def run_simulation(body: SimulationRequestSchema) -> SimulationResponseSchema:
    """Run a what-if simulation projection.

    Args:
        body: Simulation parameters (load, ambient, cooling, horizon).

    Returns:
        SimulationResponseSchema with projected temperatures and aging factor.
    """
    # TODO (Phase 2.5): implement Arrhenius thermal projection model
    timeline = [
        {"day": d + 1, "hotspot_temp_c": 0.0, "top_oil_temp_c": 0.0, "aging_factor": 1.0}
        for d in range(body.time_horizon_days)
    ]
    return SimulationResponseSchema(
        projected_hotspot_temp_c=0.0,
        projected_top_oil_temp_c=0.0,
        aging_acceleration_factor=1.0,
        aging_interpretation="Simulation not yet implemented.",
        estimated_days_to_warning=None,
        cooling_energy_impact_percent=0.0,
        cooling_energy_interpretation="",
        projection_timeline=timeline,  # type: ignore[arg-type]
    )
