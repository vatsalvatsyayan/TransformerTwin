"""
TransformerTwin — FastAPI application entry point.

Configures CORS, mounts all REST routes and the WebSocket endpoint,
runs the database migration on startup, and launches the simulator loop.
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import routes_alerts, routes_dga, routes_fmea, routes_health
from api import routes_scenario, routes_sensor, routes_simulation
from api import routes_speed, routes_transformer
from api.websocket_handler import router as ws_router
from config import API_PREFIX, CORS_ALLOWED_ORIGIN
from database.migrations import run_migrations
from simulator.engine import SimulatorEngine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage application startup and shutdown.

    On startup:
    - Runs database migrations.
    - Creates the SimulatorEngine and stores it in app.state.
    - Launches the simulator loop as a background task.

    On shutdown:
    - Signals the simulator to stop and awaits its completion.

    Args:
        app: The FastAPI application instance.

    Yields:
        Control to the ASGI server while the app is running.
    """
    logger.info("TransformerTwin backend starting up…")

    # 1. Initialise database schema
    await run_migrations()

    # 2. Create simulator engine and store on app state for route access
    simulator = SimulatorEngine(speed_multiplier=1)
    app.state.simulator = simulator

    # 3. Launch simulator background task
    sim_task = asyncio.create_task(simulator.run(), name="simulator")
    logger.info("Simulator started.")

    yield  # — app is now running —

    # Shutdown
    logger.info("TransformerTwin backend shutting down…")
    await simulator.stop()
    sim_task.cancel()
    try:
        await sim_task
    except asyncio.CancelledError:
        pass
    logger.info("Shutdown complete.")


app = FastAPI(
    title="TransformerTwin API",
    description="Real-time digital twin for a 100 MVA power transformer.",
    version="1.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS — allow Vite dev server origin (Integration Contract Section 3)
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[CORS_ALLOWED_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# REST routes
# ---------------------------------------------------------------------------
app.include_router(routes_transformer.router, prefix=API_PREFIX)
app.include_router(routes_sensor.router, prefix=API_PREFIX)
app.include_router(routes_health.router, prefix=API_PREFIX)
app.include_router(routes_dga.router, prefix=API_PREFIX)
app.include_router(routes_fmea.router, prefix=API_PREFIX)
app.include_router(routes_alerts.router, prefix=API_PREFIX)
app.include_router(routes_simulation.router, prefix=API_PREFIX)
app.include_router(routes_scenario.router, prefix=API_PREFIX)
app.include_router(routes_speed.router, prefix=API_PREFIX)

# ---------------------------------------------------------------------------
# WebSocket endpoint (no prefix — path is /ws)
# ---------------------------------------------------------------------------
app.include_router(ws_router)


@app.get("/health-check")
async def health_check() -> dict:
    """Simple liveness probe endpoint.

    Returns:
        Dict with status "ok".
    """
    return {"status": "ok"}
