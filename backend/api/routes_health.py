"""
TransformerTwin — Health score REST routes.

GET /api/health          — current health score
GET /api/health/history  — health score history
"""

import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from fastapi import APIRouter, Query, Request

from config import HEALTH_WEIGHTS
from database import queries
from models.schemas import (
    HealthComponentDetailSchema,
    HealthHistoryResponseSchema,
    HealthResponseSchema,
)

if TYPE_CHECKING:
    from simulator.engine import SimulatorEngine

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health", response_model=HealthResponseSchema)
async def get_health(request: Request) -> HealthResponseSchema:
    """Return the current transformer health score from live engine state.

    Returns:
        HealthResponseSchema with overall score and component breakdown.
    """
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    simulator: SimulatorEngine | None = getattr(request.app.state, "simulator", None)

    if simulator is not None and simulator.latest_health_result.get("components"):
        result = simulator.latest_health_result
        components = {}
        for key, comp in result["components"].items():
            components[key] = HealthComponentDetailSchema(
                status=comp["status"],
                penalty=comp["penalty"],
                weight=comp["weight"],
                contribution=comp["contribution"],
            )
        return HealthResponseSchema(
            timestamp=now,
            overall_score=result["overall_score"],
            status=result["status"],
            components=components,  # type: ignore[arg-type]
        )

    # Fallback: return all-NORMAL before analytics has run
    components_fallback = {
        key: HealthComponentDetailSchema(
            status="NORMAL",
            penalty=0,
            weight=weight,
            contribution=0.0,
        )
        for key, weight in HEALTH_WEIGHTS.items()
    }
    return HealthResponseSchema(
        timestamp=now,
        overall_score=100.0,
        status="GOOD",
        components=components_fallback,  # type: ignore[arg-type]
    )


@router.get("/health/history", response_model=HealthHistoryResponseSchema)
async def get_health_history(
    from_ts: str | None = Query(None, alias="from"),
    to_ts: str | None = Query(None, alias="to"),
) -> HealthHistoryResponseSchema:
    """Return health score history.

    Args:
        from_ts: ISO 8601 start timestamp. Defaults to 2 hours ago.
        to_ts: ISO 8601 end timestamp. Defaults to now.

    Returns:
        HealthHistoryResponseSchema with list of score snapshots.
    """
    rows = await queries.get_health_history(from_ts=from_ts, to_ts=to_ts)
    return HealthHistoryResponseSchema(scores=rows)  # type: ignore[arg-type]
