"""
TransformerTwin — Health score REST routes.

GET /api/health          — current health score
GET /api/health/history  — health score history
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Query

from config import HEALTH_WEIGHTS
from database import queries
from models.schemas import (
    HealthComponentDetailSchema,
    HealthHistoryResponseSchema,
    HealthResponseSchema,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health", response_model=HealthResponseSchema)
async def get_health() -> HealthResponseSchema:
    """Return the current transformer health score.

    Returns:
        HealthResponseSchema with overall score and component breakdown.
    """
    # TODO (Phase 2.4): compute from live HealthScoreCalculator state
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    components = {
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
        components=components,  # type: ignore[arg-type]
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
