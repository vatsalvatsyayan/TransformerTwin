"""
TransformerTwin — SimulatorEngine: main async loop and tick dispatcher.

Wires all physics models together and emits sensor/scenario updates
to registered callbacks (WebSocket broadcaster, database writer, etc.).
"""

import asyncio
import logging
from datetime import datetime, timezone

from config import (
    TICK_INTERVAL_SECONDS,
    THERMAL_UPDATE_INTERVAL_SIM_S,
    EQUIPMENT_UPDATE_INTERVAL_SIM_S,
    DGA_UPDATE_INTERVAL_SIM_S,
    DIAGNOSTIC_UPDATE_INTERVAL_SIM_S,
    SENSOR_UNITS,
    SENSOR_THRESHOLDS,
    DGA_SENSOR_IDS,
    THERMAL_SENSOR_IDS,
    EQUIPMENT_SENSOR_IDS,
    DIAGNOSTIC_SENSOR_IDS,
)
from models.schemas import TransformerState
from scenarios.manager import ScenarioManager
from simulator.load_profile import get_load_fraction, get_ambient_temp
from simulator.thermal_model import ThermalModel
from simulator.equipment_model import EquipmentModel
from simulator.dga_model import DGAModel
from simulator.noise import add_noise

logger = logging.getLogger(__name__)

# Diagnostic sensor nominal values (slow drift only — no physics model yet)
_DIAG_NOMINALS: dict[str, float] = {
    "OIL_MOISTURE":   8.0,
    "OIL_DIELECTRIC": 55.0,
    "BUSHING_CAP_HV": 500.0,
    "BUSHING_CAP_LV": 420.0,
}


def _compute_sensor_status(sensor_id: str, value: float) -> str:
    """Return the status string for a sensor value against its thresholds.

    For most sensors: NORMAL < CAUTION < WARNING < CRITICAL (higher is worse).
    OIL_DIELECTRIC is reversed: lower is worse.

    Equipment boolean/count sensors always return "NORMAL" (status via On/Off logic).

    Args:
        sensor_id: Canonical sensor ID.
        value: Current sensor value.

    Returns:
        One of "NORMAL", "CAUTION", "WARNING", "CRITICAL".
    """
    if sensor_id not in SENSOR_THRESHOLDS:
        return "NORMAL"

    caution, warning, critical = SENSOR_THRESHOLDS[sensor_id]

    # OIL_DIELECTRIC: reversed thresholds — lower is worse
    if sensor_id == "OIL_DIELECTRIC":
        if value < critical:
            return "CRITICAL"
        elif value < warning:
            return "WARNING"
        elif value < caution:
            return "CAUTION"
        return "NORMAL"

    # All other sensors: higher is worse
    if value >= critical:
        return "CRITICAL"
    elif value >= warning:
        return "WARNING"
    elif value >= caution:
        return "CAUTION"
    return "NORMAL"


class SimulatorEngine:
    """Drives the simulation forward in time and dispatches sensor readings.

    Each tick advances sim_time by (tick_interval × speed_multiplier) seconds.
    Sensor groups fire at their own intervals; see config.py for values.
    """

    def __init__(self, speed_multiplier: int = 1) -> None:
        self.sim_time: float = 0.0
        self.speed: int = speed_multiplier
        self.tick_interval: float = TICK_INTERVAL_SECONDS
        self.running: bool = False
        self._initialized: bool = False

        # Physics models
        self.thermal_model: ThermalModel = ThermalModel()
        self.equipment_model: EquipmentModel = EquipmentModel()
        self.dga_model: DGAModel = DGAModel()
        self.scenario_manager: ScenarioManager = ScenarioManager()

        # Current transformer state
        self.state: TransformerState = TransformerState()

        # Last sim_time at which each sensor group was emitted
        self._last_thermal_emit: float = -THERMAL_UPDATE_INTERVAL_SIM_S
        self._last_equip_emit: float = -EQUIPMENT_UPDATE_INTERVAL_SIM_S
        self._last_dga_emit: float = -DGA_UPDATE_INTERVAL_SIM_S
        self._last_diag_emit: float = -DIAGNOSTIC_UPDATE_INTERVAL_SIM_S

        # Callbacks registered by the WebSocket handler / persistence layer
        self._sensor_callbacks: list = []
        self._health_callbacks: list = []
        self._alert_callbacks: list = []
        self._scenario_callbacks: list = []

    # ------------------------------------------------------------------
    # Public control API
    # ------------------------------------------------------------------

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

    def get_current_state(self) -> TransformerState:
        """Return the current TransformerState snapshot.

        Returns:
            Copy of current state.
        """
        return self.state.model_copy()

    # ------------------------------------------------------------------
    # Async run loop
    # ------------------------------------------------------------------

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

    # ------------------------------------------------------------------
    # Internal tick
    # ------------------------------------------------------------------

    async def _tick(self) -> None:
        """Advance simulation by one tick: physics → state → callbacks."""
        dt_s = float(self.speed) * self.tick_interval

        # --- 1. Lazy init: set thermal model to steady state on first tick ---
        if not self._initialized:
            load0 = get_load_fraction(0.0)
            ambient0 = get_ambient_temp(0.0)
            self.thermal_model.initialize_steady_state(load0, ambient0, "ONAN")
            self._initialized = True

        # --- 2. Scenario modifiers ---
        scenario = self.scenario_manager.active_scenario
        thermal_mods = scenario.get_thermal_modifiers()
        dga_mods = scenario.get_dga_modifiers()
        winding_delta: float = thermal_mods.get("winding_delta", 0.0)
        cooling_override: str | None = thermal_mods.get("cooling_mode_override", None)

        # --- 3. Load + ambient profiles ---
        load_fraction = get_load_fraction(self.sim_time)
        ambient_temp = get_ambient_temp(self.sim_time)

        # --- 4. Equipment model (derives cooling mode) ---
        equip = self.equipment_model.update(
            top_oil_temp=self.state.top_oil_temp,
            load_fraction=load_fraction,
            fan_bank_1=self.state.fan_bank_1,
            fan_bank_2=self.state.fan_bank_2,
            oil_pump_1=self.state.oil_pump_1,
            tap_position=self.state.tap_position,
            tap_op_count=self.state.tap_op_count,
            cooling_mode_override=cooling_override,
        )
        cooling_mode: str = equip["cooling_mode"]

        # --- 5. Thermal model ---
        thermal = self.thermal_model.tick(
            dt_s=dt_s,
            load_fraction=load_fraction,
            ambient_temp=ambient_temp,
            cooling_mode=cooling_mode,
            winding_delta=winding_delta,
        )

        # --- 6. DGA model ---
        dga = self.dga_model.tick(
            dt_s=dt_s,
            winding_temp=thermal.winding_temp,
            scenario_modifier=dga_mods,
        )

        # --- 7. Apply noise and update state ---
        self.state.sim_time = round(self.sim_time, 1)
        self.state.top_oil_temp = add_noise("TOP_OIL_TEMP", thermal.top_oil_temp)
        self.state.bot_oil_temp = add_noise("BOT_OIL_TEMP", thermal.bot_oil_temp)
        self.state.winding_temp = add_noise("WINDING_TEMP", thermal.winding_temp)
        self.state.load_current = add_noise("LOAD_CURRENT", round(load_fraction * 100.0, 1))
        self.state.ambient_temp = add_noise("AMBIENT_TEMP", ambient_temp)
        self.state.cooling_mode = cooling_mode

        # DGA (noise applied separately; clamp to >= 0 in DGAModel)
        for gas_id in DGA_SENSOR_IDS:
            field = gas_id.lower()  # e.g. DGA_H2 → dga_h2
            clean_val = dga.gas_ppm[gas_id]
            noisy = max(0.0, add_noise(gas_id, clean_val))
            setattr(self.state, field, noisy)

        # Equipment (no noise on boolean/integer sensors)
        self.state.fan_bank_1 = equip["fan_bank_1"]
        self.state.fan_bank_2 = equip["fan_bank_2"]
        self.state.oil_pump_1 = equip["oil_pump_1"]
        self.state.tap_position = equip["tap_position"]
        self.state.tap_op_count = equip["tap_op_count"]

        # Diagnostic sensors — slow drift with noise (no physics model yet)
        self.state.oil_moisture = add_noise("OIL_MOISTURE", _DIAG_NOMINALS["OIL_MOISTURE"])
        self.state.oil_dielectric = add_noise("OIL_DIELECTRIC", _DIAG_NOMINALS["OIL_DIELECTRIC"])
        self.state.bushing_cap_hv = add_noise("BUSHING_CAP_HV", _DIAG_NOMINALS["BUSHING_CAP_HV"])
        self.state.bushing_cap_lv = add_noise("BUSHING_CAP_LV", _DIAG_NOMINALS["BUSHING_CAP_LV"])

        # --- 8. Advance scenario ---
        self.scenario_manager.advance(dt_s)
        if self.scenario_manager.is_complete():
            logger.info(
                "Scenario '%s' complete — reverting to normal.",
                scenario.scenario_id,
            )
            self.scenario_manager.trigger("normal")

        # --- 9. Advance sim_time ---
        self.sim_time = round(self.sim_time + dt_s, 1)

        # --- 10. Emit sensor group updates at their scheduled intervals ---
        now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

        if self.sim_time - self._last_thermal_emit >= THERMAL_UPDATE_INTERVAL_SIM_S:
            await self._emit_sensor_group("thermal", now_iso)
            self._last_thermal_emit = self.sim_time

        if self.sim_time - self._last_equip_emit >= EQUIPMENT_UPDATE_INTERVAL_SIM_S:
            await self._emit_sensor_group("equipment", now_iso)
            self._last_equip_emit = self.sim_time

        if self.sim_time - self._last_dga_emit >= DGA_UPDATE_INTERVAL_SIM_S:
            await self._emit_sensor_group("dga", now_iso)
            self._last_dga_emit = self.sim_time

        if self.sim_time - self._last_diag_emit >= DIAGNOSTIC_UPDATE_INTERVAL_SIM_S:
            await self._emit_sensor_group("diagnostic", now_iso)
            self._last_diag_emit = self.sim_time

        # Always emit scenario update during active (non-normal) scenarios
        if scenario.scenario_id != "normal":
            await self._emit_scenario_update(now_iso)

    # ------------------------------------------------------------------
    # Emission helpers
    # ------------------------------------------------------------------

    async def _emit_sensor_group(self, group: str, timestamp: str) -> None:
        """Build and broadcast a sensor_update message for one sensor group.

        Args:
            group: One of "thermal", "dga", "equipment", "diagnostic".
            timestamp: ISO 8601 UTC timestamp string.
        """
        if group == "thermal":
            sensor_ids = THERMAL_SENSOR_IDS
        elif group == "dga":
            sensor_ids = DGA_SENSOR_IDS
        elif group == "equipment":
            sensor_ids = EQUIPMENT_SENSOR_IDS
        else:
            sensor_ids = DIAGNOSTIC_SENSOR_IDS

        sensors: dict = {}
        for sid in sensor_ids:
            value, status = self._get_sensor_value_and_status(sid)
            sensors[sid] = {
                "value": value,
                "unit": SENSOR_UNITS.get(sid, ""),
                "status": status,
            }

        message = {
            "type": "sensor_update",
            "timestamp": timestamp,
            "sim_time": self.sim_time,
            "group": group,
            "sensors": sensors,
        }
        await self._fire_callbacks(self._sensor_callbacks, message)

    async def _emit_scenario_update(self, timestamp: str) -> None:  # noqa: ARG002
        """Broadcast current scenario progress.

        Args:
            timestamp: ISO 8601 UTC timestamp string (unused but kept for symmetry).
        """
        scenario = self.scenario_manager.active_scenario
        message = {
            "type": "scenario_update",
            "scenario_id": scenario.scenario_id,
            "name": scenario.name,
            "stage": scenario.get_current_stage(),
            "progress_percent": scenario.progress_percent,
            "elapsed_sim_time": scenario.elapsed_sim_time,
        }
        await self._fire_callbacks(self._scenario_callbacks, message)

    def _get_sensor_value_and_status(self, sensor_id: str) -> tuple[float, str]:
        """Read current value for a sensor from state and compute its status.

        Args:
            sensor_id: Canonical sensor ID.

        Returns:
            (value, status_string) tuple.
        """
        field = sensor_id.lower()
        value = getattr(self.state, field, 0.0)

        # Boolean sensors: status is "ON" or "OFF"
        if isinstance(value, bool):
            return (1.0 if value else 0.0, "ON" if value else "OFF")

        value = float(value)
        status = _compute_sensor_status(sensor_id, value)
        return (value, status)

    @staticmethod
    async def _fire_callbacks(callbacks: list, message: dict) -> None:
        """Call all registered async callbacks with message.

        Args:
            callbacks: List of async callables.
            message: Message dict to pass to each callback.
        """
        for cb in callbacks:
            try:
                await cb(message)
            except Exception as exc:  # noqa: BLE001
                logger.error("Callback error: %s", exc)
