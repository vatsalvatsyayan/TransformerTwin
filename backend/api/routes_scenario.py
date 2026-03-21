"""
TransformerTwin — Scenario control REST routes.

POST /api/scenario/{scenario_id}/trigger — trigger a fault scenario
GET  /api/scenario/status                — current scenario progress
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request

from config import VALID_SCENARIO_IDS
from models.schemas import ScenarioStatusResponseSchema, ScenarioTriggerResponseSchema
from scenarios.manager import SCENARIO_REGISTRY

logger = logging.getLogger(__name__)

router = APIRouter()

_SCENARIO_DESCRIPTIONS: dict[str, str] = {
    "normal": "Transformer operating within all normal parameters.",
    "hot_spot": (
        "Blocked cooling duct causing localized winding overheating. "
        "Develops over 2 simulated hours."
    ),
    "arcing": (
        "High-energy electrical discharge in transformer oil. "
        "Rapid C₂H₂ and H₂ generation over 15 simulated minutes."
    ),
    "cooling_failure": (
        "Cooling fan bank failure causing progressive oil temperature rise. "
        "Develops over 1 simulated hour."
    ),
}


@router.post("/scenario/{scenario_id}/trigger", response_model=ScenarioTriggerResponseSchema)
async def trigger_scenario(
    scenario_id: str,
    request: Request,
) -> ScenarioTriggerResponseSchema:
    """Trigger a fault scenario.

    Args:
        scenario_id: One of the 4 ScenarioId values.
        request: FastAPI request (used to access app state for simulator).

    Returns:
        ScenarioTriggerResponseSchema confirming the trigger.

    Raises:
        HTTPException 422: If scenario_id is invalid.
    """
    if scenario_id not in VALID_SCENARIO_IDS:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown scenario: '{scenario_id}'",
        )

    simulator = request.app.state.simulator
    scenario = simulator.scenario_manager.trigger(scenario_id)
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    return ScenarioTriggerResponseSchema(
        scenario_id=scenario_id,  # type: ignore[arg-type]
        name=scenario.name,
        status="TRIGGERED",
        description=_SCENARIO_DESCRIPTIONS[scenario_id],
        started_at=now,
    )


@router.get("/scenario/status", response_model=ScenarioStatusResponseSchema)
async def get_scenario_status(request: Request) -> ScenarioStatusResponseSchema:
    """Return the current scenario status and progress.

    Args:
        request: FastAPI request (used to access app state for simulator).

    Returns:
        ScenarioStatusResponseSchema with active scenario details.
    """
    simulator = request.app.state.simulator
    scenario = simulator.scenario_manager.active_scenario
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    started_at = scenario.started_at if scenario.started_at else now

    return ScenarioStatusResponseSchema(
        active_scenario=scenario.scenario_id,  # type: ignore[arg-type]
        name=scenario.name,
        started_at=started_at,
        elapsed_sim_time=scenario.elapsed_sim_time,
        progress_percent=scenario.progress_percent,
        stage=scenario.get_current_stage(),
    )
