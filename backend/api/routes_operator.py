"""
TransformerTwin — Operator action REST routes.

POST /api/operator/actions — execute a direct operator intervention
GET  /api/operator/status  — retrieve current operator override state

Operator overrides are applied immediately on the next simulator tick.
They persist until explicitly cleared or replaced by a new action.
"""

import logging

from fastapi import APIRouter, Request

from models.schemas import OperatorActionRequestSchema, OperatorStatusResponseSchema
from simulator.engine import SimulatorEngine

logger = logging.getLogger(__name__)

router = APIRouter()


def _build_status(sim: SimulatorEngine) -> OperatorStatusResponseSchema:
    """Build a status response from the current engine override state.

    Args:
        sim: The running SimulatorEngine instance.

    Returns:
        OperatorStatusResponseSchema with current override state.
    """
    load_pct = (
        int(sim.operator_load_override * 100)
        if sim.operator_load_override is not None
        else None
    )
    cooling = sim.operator_cooling_override
    active = load_pct is not None or cooling is not None

    parts: list[str] = []
    if load_pct is not None:
        parts.append(f"Load capped at {load_pct}%")
    if cooling is not None:
        parts.append(f"Cooling forced to {cooling}")

    message = (
        f"Active overrides: {', '.join(parts)}"
        if parts
        else "Normal operation — no active overrides"
    )

    return OperatorStatusResponseSchema(
        load_override_pct=load_pct,
        cooling_override=cooling,
        active_overrides=active,
        message=message,
    )


@router.post("/operator/actions", response_model=OperatorStatusResponseSchema)
async def execute_operator_action(
    body: OperatorActionRequestSchema,
    request: Request,
) -> OperatorStatusResponseSchema:
    """Execute an operator intervention on the live simulator.

    Available actions:
    - REDUCE_LOAD_70: Cap load at 70% rated (reduces thermal stress)
    - REDUCE_LOAD_40: Emergency cap at 40% rated
    - RESTORE_LOAD:   Remove load cap, return to normal sinusoidal profile
    - UPGRADE_COOLING_ONAF: Force ONAF cooling (forced air, natural oil)
    - UPGRADE_COOLING_OFAF: Force OFAF cooling (forced air + forced oil)
    - RESTORE_COOLING: Remove cooling override, return to automatic control
    - CLEAR_ALL:       Remove all overrides at once

    Args:
        body: Action request with action type.
        request: FastAPI request (access to app.state.simulator).

    Returns:
        Current operator override state after applying the action.
    """
    sim: SimulatorEngine = request.app.state.simulator
    action = body.action

    if action == "REDUCE_LOAD_70":
        sim.set_operator_load(0.70)
    elif action == "REDUCE_LOAD_40":
        sim.set_operator_load(0.40)
    elif action == "RESTORE_LOAD":
        sim.set_operator_load(None)
    elif action == "UPGRADE_COOLING_ONAF":
        sim.set_operator_cooling("ONAF")
    elif action == "UPGRADE_COOLING_OFAF":
        sim.set_operator_cooling("OFAF")
    elif action == "RESTORE_COOLING":
        sim.set_operator_cooling(None)
    elif action == "CLEAR_ALL":
        sim.clear_operator_overrides()

    logger.info("Operator action executed: %s", action)
    return _build_status(sim)


@router.get("/operator/status", response_model=OperatorStatusResponseSchema)
async def get_operator_status(request: Request) -> OperatorStatusResponseSchema:
    """Return the current operator override state without changing anything.

    Args:
        request: FastAPI request (access to app.state.simulator).

    Returns:
        Current operator override state.
    """
    return _build_status(request.app.state.simulator)
