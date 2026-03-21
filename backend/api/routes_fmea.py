"""
TransformerTwin — FMEA diagnostic REST route.

GET /api/fmea — failure mode analysis results
"""

import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from fastapi import APIRouter, Request

from analytics.fmea_engine import FMEAEngine
from models.schemas import FMEAResponseSchema

if TYPE_CHECKING:
    from simulator.engine import SimulatorEngine

logger = logging.getLogger(__name__)

router = APIRouter()
_fmea = FMEAEngine()


@router.get("/fmea", response_model=FMEAResponseSchema)
async def get_fmea(request: Request) -> FMEAResponseSchema:
    """Return current FMEA diagnostic results from live engine state.

    Returns:
        FMEAResponseSchema with list of active failure modes sorted by match score.
    """
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    simulator: SimulatorEngine | None = getattr(request.app.state, "simulator", None)

    if simulator is not None and simulator.latest_fmea_result:
        active_modes = simulator.latest_fmea_result
    elif simulator is not None:
        # Compute on demand if engine hasn't run analytics yet
        state = simulator.get_current_state()
        active_modes = _fmea.evaluate(
            state=state,
            dga_analysis=simulator.latest_dga_analysis,
            anomalies=simulator.latest_anomalies,
        )
    else:
        active_modes = []

    return FMEAResponseSchema(timestamp=now, active_modes=active_modes)  # type: ignore[arg-type]
