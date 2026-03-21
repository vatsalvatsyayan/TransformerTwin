"""
TransformerTwin — Database schema creation and migration.

Runs on startup via the lifespan context manager in main.py.
"""

import logging

import aiosqlite

from config import DB_PATH

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# DDL statements
# ---------------------------------------------------------------------------

CREATE_SENSOR_READINGS_TABLE = """
CREATE TABLE IF NOT EXISTS sensor_readings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    sensor_id   TEXT    NOT NULL,
    value       REAL    NOT NULL,
    status      TEXT    NOT NULL,
    sim_time    REAL    NOT NULL,
    timestamp   TEXT    NOT NULL
);
"""

CREATE_SENSOR_READINGS_INDEX = """
CREATE INDEX IF NOT EXISTS idx_sensor_readings_sensor_ts
    ON sensor_readings (sensor_id, timestamp DESC);
"""

CREATE_HEALTH_HISTORY_TABLE = """
CREATE TABLE IF NOT EXISTS health_history (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    overall_score  REAL    NOT NULL,
    sim_time       REAL    NOT NULL,
    timestamp      TEXT    NOT NULL
);
"""

CREATE_ALERTS_TABLE = """
CREATE TABLE IF NOT EXISTS alerts (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp            TEXT    NOT NULL,
    severity             TEXT    NOT NULL,
    title                TEXT    NOT NULL,
    description          TEXT    NOT NULL,
    source               TEXT    NOT NULL,
    sensor_ids           TEXT    NOT NULL,  -- JSON array stored as text
    failure_mode_id      TEXT,
    recommended_actions  TEXT    NOT NULL,  -- JSON array stored as text
    acknowledged         INTEGER NOT NULL DEFAULT 0,
    acknowledged_at      TEXT,
    sim_time             REAL    NOT NULL
);
"""

ALL_DDL: list[str] = [
    CREATE_SENSOR_READINGS_TABLE,
    CREATE_SENSOR_READINGS_INDEX,
    CREATE_HEALTH_HISTORY_TABLE,
    CREATE_ALERTS_TABLE,
]


async def run_migrations() -> None:
    """Create all tables if they do not already exist.

    Called once at application startup. Safe to call multiple times (idempotent).
    """
    logger.info("Running database migrations on %s", DB_PATH)
    async with aiosqlite.connect(DB_PATH) as db:
        for ddl in ALL_DDL:
            await db.execute(ddl)
        await db.commit()
    logger.info("Database migrations complete.")
