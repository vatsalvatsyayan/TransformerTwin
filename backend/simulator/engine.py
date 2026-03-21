"""
TransformerTwin — SimulatorEngine: main async loop and tick dispatcher.

Skeleton only — business logic implemented in Phase 1.3.
"""

import asyncio
import logging
from datetime import datetime, timezone

from config import TICK_INTERVAL_SECONDS
from models.schemas import TransformerState
from scenarios.manager import ScenarioManager

logger = logging.getLogger(__name__)


class SimulatorEngine:
    """Drives the simulation forward in time and dispatches sensor readings.

    Each tick advances sim_time by (tick_interval × speed_multiplier) seconds.
    Sensor groups fire at their own intervals; see config.py for values.
    """

    def __init__(self, speed_multiplier: int = 1) -> None:
        self.sim_time: float = 0.0
        self.speed: int = speed_multiplier
        self.tick_interval: float = TICK_INTERVAL_SECONDS
        self.state: TransformerState = TransformerState()
        self.scenario_manager: ScenarioManager = ScenarioManager()
        self.running: bool = False

        # Callbacks registered by the WebSocket handler to receive tick data
        self._sensor_callbacks: list = []
        self._health_callbacks: list = []
        self._alert_callbacks: list = []
        self._scenario_callbacks: list = []

    def set_speed(self, multiplier: int) -> None:
        """Change simulation speed multiplier (1–60).

        Args:
            multiplier: New time acceleration factor.
        """
        self.speed = max(1, min(60, multiplier))
        logger.info("Simulation speed set to %dx", self.speed)

    def register_sensor_callback(self, cb) -> None:  # noqa: ANN001
        """Register a coroutine to be called on each sensor group update."""
        self._sensor_callbacks.append(cb)

    def register_health_callback(self, cb) -> None:  # noqa: ANN001
        """Register a coroutine to be called on health score updates."""
        self._health_callbacks.append(cb)

    def register_alert_callback(self, cb) -> None:  # noqa: ANN001
        """Register a coroutine to be called when new alerts are generated."""
        self._alert_callbacks.append(cb)

    def register_scenario_callback(self, cb) -> None:  # noqa: ANN001
        """Register a coroutine to be called on scenario progress updates."""
        self._scenario_callbacks.append(cb)

    async def run(self) -> None:
        """Start the main simulation loop. Runs until stop() is called.

        This is the async entry point launched as a background task in main.py.
        """
        self.running = True
        logger.info("SimulatorEngine starting (speed=%dx)", self.speed)
        while self.running:
            tick_start = asyncio.get_event_loop().time()
            await self._tick()
            elapsed = asyncio.get_event_loop().time() - tick_start
            sleep_for = max(0.0, self.tick_interval - elapsed)
            await asyncio.sleep(sleep_for)
        logger.info("SimulatorEngine stopped.")

    async def stop(self) -> None:
        """Signal the simulation loop to stop after the current tick."""
        self.running = False

    async def _tick(self) -> None:
        """Advance simulation by one tick. Placeholder for Phase 1.3 logic."""
        # TODO (Phase 1.3): compute physics, apply fault modifiers, emit data
        sim_delta = self.speed * self.tick_interval
        self.sim_time = round(self.sim_time + sim_delta, 1)
