"""
TransformerTwin — Named query functions.

All SQL lives here. Route handlers and the simulator import from this module.
"""

import json
import logging
from datetime import datetime, timedelta, timezone

from database.db import get_db
from models.schemas import AlertSchema, SensorHistoryPointSchema

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Sensor readings
# ---------------------------------------------------------------------------

async def insert_sensor_reading(
    sensor_id: str,
    value: float,
    status: str,
    sim_time: float,
    timestamp: str,
) -> None:
    """Insert a single sensor reading row.

    Args:
        sensor_id: Canonical sensor identifier.
        value: Measured value.
        status: SensorStatus string.
        sim_time: Simulation seconds since start.
        timestamp: ISO 8601 UTC timestamp string.
    """
    async with get_db() as db:
        await db.execute(
            "INSERT INTO sensor_readings (sensor_id, value, status, sim_time, timestamp)"
            " VALUES (?, ?, ?, ?, ?)",
            (sensor_id, value, status, sim_time, timestamp),
        )
        await db.commit()


async def get_sensor_history(
    sensor_id: str,
    from_ts: str | None = None,
    to_ts: str | None = None,
    limit: int = 1000,
) -> list[SensorHistoryPointSchema]:
    """Return sensor readings in the given time range, oldest-first.

    Args:
        sensor_id: Canonical sensor identifier.
        from_ts: ISO 8601 start timestamp (inclusive). Defaults to 2 hours ago.
        to_ts: ISO 8601 end timestamp (inclusive). Defaults to now.
        limit: Maximum number of rows to return.

    Returns:
        List of SensorHistoryPointSchema sorted ascending by timestamp.
    """
    now = datetime.now(timezone.utc)
    default_from = (now - timedelta(hours=2)).isoformat().replace("+00:00", "Z")
    default_to = now.isoformat().replace("+00:00", "Z")

    from_ts = from_ts or default_from
    to_ts = to_ts or default_to

    async with get_db() as db:
        cursor = await db.execute(
            "SELECT timestamp, value, sim_time FROM sensor_readings"
            " WHERE sensor_id = ? AND timestamp >= ? AND timestamp <= ?"
            " ORDER BY timestamp ASC LIMIT ?",
            (sensor_id, from_ts, to_ts, limit),
        )
        rows = await cursor.fetchall()

    return [
        SensorHistoryPointSchema(
            timestamp=row["timestamp"],
            value=row["value"],
            sim_time=row["sim_time"],
        )
        for row in rows
    ]


# ---------------------------------------------------------------------------
# Health history
# ---------------------------------------------------------------------------

async def insert_health_score(
    overall_score: float,
    sim_time: float,
    timestamp: str,
) -> None:
    """Insert a health score snapshot row.

    Args:
        overall_score: Composite health score (0–100).
        sim_time: Simulation seconds since start.
        timestamp: ISO 8601 UTC timestamp string.
    """
    async with get_db() as db:
        await db.execute(
            "INSERT INTO health_history (overall_score, sim_time, timestamp) VALUES (?, ?, ?)",
            (overall_score, sim_time, timestamp),
        )
        await db.commit()


async def get_health_history(
    from_ts: str | None = None,
    to_ts: str | None = None,
) -> list[dict]:
    """Return health score history in the given time range.

    Args:
        from_ts: ISO 8601 start timestamp. Defaults to 2 hours ago.
        to_ts: ISO 8601 end timestamp. Defaults to now.

    Returns:
        List of dicts with keys: timestamp, overall_score, sim_time.
    """
    now = datetime.now(timezone.utc)
    default_from = (now - timedelta(hours=2)).isoformat().replace("+00:00", "Z")
    default_to = now.isoformat().replace("+00:00", "Z")

    from_ts = from_ts or default_from
    to_ts = to_ts or default_to

    async with get_db() as db:
        cursor = await db.execute(
            "SELECT timestamp, overall_score, sim_time FROM health_history"
            " WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC",
            (from_ts, to_ts),
        )
        rows = await cursor.fetchall()

    return [dict(row) for row in rows]


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

async def insert_alert(alert: AlertSchema) -> int:
    """Insert an alert and return its auto-generated database ID.

    Args:
        alert: Alert data (id field is ignored; DB assigns it).

    Returns:
        The new row's integer ID.
    """
    async with get_db() as db:
        cursor = await db.execute(
            "INSERT INTO alerts"
            " (timestamp, severity, title, description, source, sensor_ids,"
            "  failure_mode_id, recommended_actions, acknowledged, acknowledged_at, sim_time)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                alert.timestamp,
                alert.severity,
                alert.title,
                alert.description,
                alert.source,
                json.dumps(alert.sensor_ids),
                alert.failure_mode_id,
                json.dumps(alert.recommended_actions),
                int(alert.acknowledged),
                alert.acknowledged_at,
                alert.sim_time,
            ),
        )
        await db.commit()
        return cursor.lastrowid  # type: ignore[return-value]


async def get_alerts(
    status: str = "all",
    limit: int = 50,
) -> list[AlertSchema]:
    """Return alerts filtered by status, newest-first.

    Args:
        status: One of "active", "acknowledged", "all".
        limit: Maximum number of rows to return.

    Returns:
        List of AlertSchema.
    """
    if status == "active":
        where = "WHERE acknowledged = 0"
    elif status == "acknowledged":
        where = "WHERE acknowledged = 1"
    else:
        where = ""

    async with get_db() as db:
        cursor = await db.execute(
            f"SELECT * FROM alerts {where} ORDER BY timestamp DESC LIMIT ?",
            (limit,),
        )
        rows = await cursor.fetchall()

    return [_row_to_alert(dict(row)) for row in rows]


async def get_alert_counts() -> tuple[int, int]:
    """Return (total_count, active_count) for the alerts table.

    Returns:
        Tuple of (total, active) integers.
    """
    async with get_db() as db:
        total_cur = await db.execute("SELECT COUNT(*) FROM alerts")
        total_row = await total_cur.fetchone()
        active_cur = await db.execute("SELECT COUNT(*) FROM alerts WHERE acknowledged = 0")
        active_row = await active_cur.fetchone()

    total = total_row[0] if total_row else 0
    active = active_row[0] if active_row else 0
    return total, active


async def acknowledge_alert(alert_id: int, acknowledged_at: str) -> bool:
    """Mark an alert as acknowledged.

    Args:
        alert_id: Database row ID of the alert.
        acknowledged_at: ISO 8601 timestamp when acknowledged.

    Returns:
        True if the row was updated, False if no matching row found.
    """
    async with get_db() as db:
        cursor = await db.execute(
            "UPDATE alerts SET acknowledged = 1, acknowledged_at = ? WHERE id = ?",
            (acknowledged_at, alert_id),
        )
        await db.commit()
        return cursor.rowcount > 0


async def get_alert_by_id(alert_id: int) -> AlertSchema | None:
    """Fetch a single alert by ID.

    Args:
        alert_id: Database row ID.

    Returns:
        AlertSchema or None if not found.
    """
    async with get_db() as db:
        cursor = await db.execute("SELECT * FROM alerts WHERE id = ?", (alert_id,))
        row = await cursor.fetchone()

    if row is None:
        return None
    return _row_to_alert(dict(row))


def _row_to_alert(row: dict) -> AlertSchema:
    """Convert a raw database row dict to an AlertSchema.

    Args:
        row: Dict of column values from the alerts table.

    Returns:
        Populated AlertSchema instance.
    """
    return AlertSchema(
        id=row["id"],
        timestamp=row["timestamp"],
        severity=row["severity"],
        title=row["title"],
        description=row["description"],
        source=row["source"],
        sensor_ids=json.loads(row["sensor_ids"]),
        failure_mode_id=row.get("failure_mode_id"),
        recommended_actions=json.loads(row["recommended_actions"]),
        acknowledged=bool(row["acknowledged"]),
        acknowledged_at=row.get("acknowledged_at"),
        sim_time=row["sim_time"],
    )
