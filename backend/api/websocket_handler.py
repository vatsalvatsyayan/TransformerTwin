"""
TransformerTwin — WebSocket endpoint and connection manager.

Handles the WS lifecycle: accept, send connection_ack, route incoming
messages, broadcast sensor/health/alert/scenario updates from the simulator.
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from config import WS_PING_INTERVAL_S
from models.schemas import WSConnectionAckSchema, WSErrorSchema, WSPingSchema

if TYPE_CHECKING:
    from simulator.engine import SimulatorEngine

logger = logging.getLogger(__name__)

router = APIRouter()

# Will be set by main.py after engine is created
_engine: "SimulatorEngine | None" = None


def set_engine(engine: "SimulatorEngine") -> None:
    """Bind the simulator engine so WS messages can control it.

    Args:
        engine: The running SimulatorEngine instance.
    """
    global _engine  # noqa: PLW0603
    _engine = engine


class ConnectionManager:
    """Manages active WebSocket connections.

    All active connections are stored so the simulator can broadcast
    messages to all connected clients.
    """

    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        """Accept a new WebSocket connection.

        Args:
            websocket: Incoming WebSocket connection.
        """
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(
            "WebSocket connected. Total connections: %d",
            len(self.active_connections),
        )

    def disconnect(self, websocket: WebSocket) -> None:
        """Remove a WebSocket from the active list.

        Args:
            websocket: WebSocket to remove.
        """
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(
            "WebSocket disconnected. Total connections: %d",
            len(self.active_connections),
        )

    async def broadcast(self, message: dict) -> None:
        """Send a JSON message to all active connections.

        Drops connections that fail to send (client disconnected).

        Args:
            message: Dict to serialize as JSON and send.
        """
        dead: list[WebSocket] = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:  # noqa: BLE001
                dead.append(connection)
        for ws in dead:
            self.disconnect(ws)

    async def send_personal(self, websocket: WebSocket, message: dict) -> None:
        """Send a JSON message to a single connection.

        Args:
            websocket: Target WebSocket.
            message: Dict to serialize and send.
        """
        await websocket.send_json(message)


# Singleton connection manager — shared across the application
manager = ConnectionManager()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """Handle a WebSocket connection for real-time streaming.

    Lifecycle:
    1. Accept connection.
    2. Send connection_ack with current sim state.
    3. Start ping loop as background task.
    4. Listen for client messages until disconnect.

    Args:
        websocket: The incoming WebSocket connection.
    """
    await manager.connect(websocket)
    ping_task: asyncio.Task | None = None

    try:
        # Build connection_ack with live engine state if available
        sim_time = 0.0
        speed = 1
        active_scenario = "normal"
        if _engine is not None:
            sim_time = _engine.sim_time
            speed = _engine.speed
            active_scenario = _engine.scenario_manager.active_scenario.scenario_id

        ack = WSConnectionAckSchema(
            timestamp=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            sim_time=sim_time,
            speed_multiplier=speed,
            active_scenario=active_scenario,  # type: ignore[arg-type]
        )
        await manager.send_personal(websocket, ack.model_dump())

        # Start heartbeat ping loop
        ping_task = asyncio.create_task(_ping_loop(websocket))

        # Message receive loop
        while True:
            raw = await websocket.receive_text()
            await _handle_client_message(websocket, raw)

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected.")
    except Exception as exc:  # noqa: BLE001
        logger.error("WebSocket error: %s", exc)
    finally:
        if ping_task:
            ping_task.cancel()
        manager.disconnect(websocket)


async def _ping_loop(websocket: WebSocket) -> None:
    """Send periodic ping messages to the client.

    Args:
        websocket: The WebSocket to ping.
    """
    while True:
        await asyncio.sleep(WS_PING_INTERVAL_S)
        try:
            ping = WSPingSchema(
                timestamp=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            )
            await websocket.send_json(ping.model_dump())
        except Exception:  # noqa: BLE001
            break


async def _handle_client_message(websocket: WebSocket, raw: str) -> None:
    """Route an incoming client message to the appropriate handler.

    Args:
        websocket: The sending WebSocket.
        raw: Raw JSON string received from the client.
    """
    try:
        msg = json.loads(raw)
    except json.JSONDecodeError:
        error = WSErrorSchema(code="INVALID_MESSAGE", message="Message is not valid JSON.")
        await manager.send_personal(websocket, error.model_dump())
        return

    msg_type = msg.get("type")

    if msg_type == "pong":
        # Heartbeat response — no action required
        pass

    elif msg_type == "set_speed":
        if _engine is not None:
            try:
                multiplier = int(msg.get("speed_multiplier", 1))
                _engine.set_speed(multiplier)
                logger.info("Speed set to %dx via WebSocket", multiplier)
            except (ValueError, TypeError):
                error = WSErrorSchema(
                    code="INVALID_MESSAGE", message="speed_multiplier must be an integer 1–60."
                )
                await manager.send_personal(websocket, error.model_dump())

    elif msg_type == "trigger_scenario":
        if _engine is not None:
            scenario_id = msg.get("scenario_id", "")
            try:
                _engine.scenario_manager.trigger(scenario_id)
                logger.info("Scenario '%s' triggered via WebSocket", scenario_id)
            except ValueError as exc:
                error = WSErrorSchema(code="INVALID_SCENARIO", message=str(exc))
                await manager.send_personal(websocket, error.model_dump())

    elif msg_type == "acknowledge_alert":
        # TODO (Phase 2.6): write acknowledgement to database
        logger.debug("acknowledge_alert received: alert_id=%s", msg.get("alert_id"))

    else:
        error = WSErrorSchema(
            code="INVALID_MESSAGE",
            message=f"Unknown message type: '{msg_type}'",
        )
        await manager.send_personal(websocket, error.model_dump())
