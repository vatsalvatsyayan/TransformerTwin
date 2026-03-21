"""
TransformerTwin — Sensor data REST routes.

GET /api/sensors/current  — latest reading for all 21 sensors
GET /api/sensors/history  — historical readings for one sensor
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from config import (
    ALL_SENSOR_IDS,
    SENSOR_HISTORY_DEFAULT_LIMIT,
    SENSOR_HISTORY_MAX_LIMIT,
    SENSOR_UNITS,
)
from database import queries
from models.schemas import (
    SensorHistoryResponseSchema,
    SensorReadingSchema,
    SensorsCurrentResponseSchema,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/sensors/current", response_model=SensorsCurrentResponseSchema)
async def get_sensors_current() -> SensorsCurrentResponseSchema:
    """Return the latest reading for all 21 sensors.

    Returns:
        SensorsCurrentResponseSchema with timestamp, sim_time, and all sensors.
    """
    # TODO (Phase 1.6): read from SimulatorEngine state instead of stubs
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    sensors: dict[str, SensorReadingSchema] = {
        sid: SensorReadingSchema(
            value=0.0,
            unit=SENSOR_UNITS.get(sid, ""),
            status="NORMAL",
        )
        for sid in ALL_SENSOR_IDS
    }
    return SensorsCurrentResponseSchema(timestamp=now, sim_time=0.0, sensors=sensors)


@router.get("/sensors/history", response_model=SensorHistoryResponseSchema)
async def get_sensor_history(
    sensor_id: str = Query(..., description="Canonical SensorId"),
    from_ts: str | None = Query(None, alias="from"),
    to_ts: str | None = Query(None, alias="to"),
    limit: int = Query(SENSOR_HISTORY_DEFAULT_LIMIT, ge=1, le=SENSOR_HISTORY_MAX_LIMIT),
) -> SensorHistoryResponseSchema:
    """Return historical readings for one sensor.

    Args:
        sensor_id: One of the 21 canonical SensorId values.
        from_ts: ISO 8601 start timestamp (inclusive).
        to_ts: ISO 8601 end timestamp (inclusive).
        limit: Maximum number of readings to return.

    Returns:
        SensorHistoryResponseSchema with readings sorted oldest-first.

    Raises:
        HTTPException 422: If sensor_id is not valid.
    """
    if sensor_id not in ALL_SENSOR_IDS:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid sensor_id: '{sensor_id}'. Must be one of: {', '.join(ALL_SENSOR_IDS)}",
        )

    readings = await queries.get_sensor_history(
        sensor_id=sensor_id,
        from_ts=from_ts,
        to_ts=to_ts,
        limit=limit,
    )
    return SensorHistoryResponseSchema(
        sensor_id=sensor_id,
        unit=SENSOR_UNITS.get(sensor_id, ""),
        readings=readings,
    )
