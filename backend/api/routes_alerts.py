"""
TransformerTwin — Alert REST routes.

GET /api/alerts                  — list alerts
PUT /api/alerts/{id}/acknowledge — acknowledge an alert
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from database import queries
from models.schemas import AlertAckResponseSchema, AlertsListResponseSchema

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/alerts", response_model=AlertsListResponseSchema)
async def get_alerts(
    status: str = Query("all", description="active | acknowledged | all"),
    limit: int = Query(50, ge=1, le=200),
) -> AlertsListResponseSchema:
    """Return alerts filtered by status.

    Args:
        status: "active", "acknowledged", or "all".
        limit: Maximum alerts to return (newest-first).

    Returns:
        AlertsListResponseSchema with alerts, total_count, active_count.
    """
    if status not in ("active", "acknowledged", "all"):
        raise HTTPException(
            status_code=422,
            detail="status must be one of: active, acknowledged, all",
        )
    alerts = await queries.get_alerts(status=status, limit=limit)
    total, active = await queries.get_alert_counts()
    return AlertsListResponseSchema(
        alerts=alerts,
        total_count=total,
        active_count=active,
    )


@router.put("/alerts/{alert_id}/acknowledge", response_model=AlertAckResponseSchema)
async def acknowledge_alert(alert_id: int) -> AlertAckResponseSchema:
    """Acknowledge an alert by ID.

    Args:
        alert_id: Integer ID of the alert to acknowledge.

    Returns:
        AlertAckResponseSchema with acknowledged=True.

    Raises:
        HTTPException 404: If alert ID is not found.
    """
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    updated = await queries.acknowledge_alert(alert_id=alert_id, acknowledged_at=now)
    if not updated:
        raise HTTPException(status_code=404, detail="Alert not found")
    return AlertAckResponseSchema(
        id=alert_id,
        acknowledged=True,
        acknowledged_at=now,
    )
