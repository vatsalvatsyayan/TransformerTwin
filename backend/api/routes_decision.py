"""
TransformerTwin — Decision Support REST route.

GET /api/decision — returns the current decision support snapshot:
  - Asset risk level and score
  - Economic impact analysis (3 cost scenarios)
  - Recommended action with deadline
  - Active operator runbooks with step-by-step procedures
"""

import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from fastapi import APIRouter, Request

from analytics.decision_engine import DecisionEngine

if TYPE_CHECKING:
    from simulator.engine import SimulatorEngine

logger = logging.getLogger(__name__)

router = APIRouter()
_decision_engine = DecisionEngine()


@router.get("/decision")
async def get_decision(request: Request) -> dict:
    """Compute and return the current decision support snapshot.

    Reads latest analytics state from the simulator engine and passes it
    to the DecisionEngine for prescriptive analysis.

    Returns:
        Decision support response dict.
    """
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    simulator: SimulatorEngine | None = getattr(request.app.state, "simulator", None)

    if simulator is None:
        return {
            "timestamp": now,
            "risk_level": "NOMINAL",
            "risk_score": 0.0,
            "risk_description": "Simulator not yet initialised",
            "time_to_action_hours": None,
            "confidence_pct": 0,
            "economic_impact": {},
            "decision_recommendation": {
                "action": "Wait for simulator to initialise",
                "reasoning": "",
                "deadline_hours": None,
            },
            "active_runbooks": [],
            "active_failure_modes": [],
        }

    state = simulator.get_current_state()
    health_result = getattr(simulator, "latest_health_result", {"overall_score": 100.0})
    fmea_results = getattr(simulator, "latest_fmea_result", [])
    anomalies = getattr(simulator, "latest_anomalies", [])

    result = _decision_engine.compute(
        state=state,
        health_result=health_result,
        fmea_results=fmea_results,
        anomalies=anomalies,
    )
    result["timestamp"] = now
    return result
