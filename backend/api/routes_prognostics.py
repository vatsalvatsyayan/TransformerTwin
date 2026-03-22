"""
TransformerTwin — Prognostics REST endpoint.

GET /api/prognostics — returns health trajectory predictions:
  - degradation rate (health pts/sim-hour)
  - time to WARNING and CRITICAL thresholds
  - projected health at 24h/48h/72h horizons under no-action and intervention
  - thermal fatigue score (cumulative insulation aging)
  - cascade status (thermal→arcing escalation)

This is the "digital twin" differentiator — predicting the future state
of the transformer, not just reporting its current condition.
"""

import logging

from fastapi import APIRouter, Request

from analytics.prognostics import PrognosticsEngine

logger = logging.getLogger(__name__)

router = APIRouter()
_prognostics_engine = PrognosticsEngine()


@router.get("/prognostics")
async def get_prognostics(request: Request) -> dict:
    """Return health trajectory prediction and thermal fatigue assessment.

    Reads live simulation state from the engine and computes forward-looking
    projections based on recent health score history.

    Args:
        request: FastAPI request (used to access app.state.simulator).

    Returns:
        Prognostics dict matching PrognosticsResponse schema.
    """
    sim = request.app.state.simulator
    return _prognostics_engine.compute(
        health_history=sim.get_health_history(),
        health_result=sim.latest_health_result,
        fmea_results=sim.latest_fmea_result,
        state=sim.get_current_state(),
        thermal_fatigue_score=sim.thermal_fatigue_score,
        cascade_triggered=sim._cascade_triggered,
    )
