"""
TransformerTwin — Sensor data REST routes.

GET /api/sensors/current  — latest reading for all 21 sensors
GET /api/sensors/history  — historical readings for one sensor
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from config import (
    ALL_SENSOR_IDS,
    SENSOR_HISTORY_DEFAULT_LIMIT,
    SENSOR_HISTORY_MAX_LIMIT,
    SENSOR_UNITS,
    EQUIPMENT_SENSOR_IDS,
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
async def get_sensors_current(request: Request) -> SensorsCurrentResponseSchema:
    """Return the latest reading for all 21 sensors.

    Args:
        request: FastAPI request (used to access app.state.simulator).

    Returns:
        SensorsCurrentResponseSchema with timestamp, sim_time, and all sensors.
    """
    from simulator.engine import _compute_sensor_status

    simulator = request.app.state.simulator
    state = simulator.get_current_state()
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    sensors: dict[str, SensorReadingSchema] = {}
    for sid in ALL_SENSOR_IDS:
        field = sid.lower()
        raw = getattr(state, field, 0.0)
        if isinstance(raw, bool):
            sensors[sid] = SensorReadingSchema(
                value=1.0 if raw else 0.0,
                unit=SENSOR_UNITS.get(sid, ""),
                status="ON" if raw else "OFF",
            )
        else:
            value = float(raw)
            sensors[sid] = SensorReadingSchema(
                value=value,
                unit=SENSOR_UNITS.get(sid, ""),
                status=_compute_sensor_status(sid, value),
            )

    return SensorsCurrentResponseSchema(
        timestamp=now,
        sim_time=state.sim_time,
        sensors=sensors,
    )


@router.get("/sensors/snapshot", response_model=SensorsCurrentResponseSchema)
async def get_sensors_snapshot(
    sim_time: float = Query(..., description="Simulation time (seconds). Returns closest reading at or before this value."),
) -> SensorsCurrentResponseSchema:
    """Return the closest reading at or before sim_time for all 21 sensors.

    Args:
        sim_time: Upper bound on simulation seconds (inclusive).

    Returns:
        SensorsCurrentResponseSchema with timestamp, sim_time, and all sensors.

    Raises:
        HTTPException 404: If no sensor data exists at or before the given sim_time.
    """
    rows = await queries.get_sensor_snapshot(sim_time)
    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"No sensor data found at or before sim_time={sim_time}",
        )

    # Index rows by sensor_id for O(1) lookup
    row_by_sensor: dict[str, dict] = {row["sensor_id"]: row for row in rows}

    # Use the maximum sim_time among returned rows as the response sim_time,
    # and the corresponding timestamp as the response timestamp.
    latest_row = max(rows, key=lambda r: r["sim_time"])
    response_timestamp: str = latest_row["timestamp"]
    response_sim_time: float = latest_row["sim_time"]

    # Boolean sensors (fans, pump) are stored in SQLite as REAL (0.0/1.0).
    # The live engine's isinstance(value, bool) check doesn't apply to DB rows.
    # Map them back to "ON"/"OFF" so playback matches live behaviour.
    _BOOLEAN_SENSOR_IDS: frozenset[str] = frozenset(
        sid for sid in EQUIPMENT_SENSOR_IDS if SENSOR_UNITS.get(sid) == "boolean"
    )

    sensors: dict[str, SensorReadingSchema] = {}
    for sid in ALL_SENSOR_IDS:
        row = row_by_sensor.get(sid)
        if row is not None:
            value = float(row["value"])
            if sid in _BOOLEAN_SENSOR_IDS:
                status = "ON" if value >= 0.5 else "OFF"
            else:
                status = str(row["status"])
            sensors[sid] = SensorReadingSchema(
                value=value,
                unit=SENSOR_UNITS.get(sid, ""),
                status=status,
            )
        else:
            # Sensor has no reading at or before sim_time — use a zero placeholder
            sensors[sid] = SensorReadingSchema(
                value=0.0,
                unit=SENSOR_UNITS.get(sid, ""),
                status="UNKNOWN",
            )

    return SensorsCurrentResponseSchema(
        timestamp=response_timestamp,
        sim_time=response_sim_time,
        sensors=sensors,
    )


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
