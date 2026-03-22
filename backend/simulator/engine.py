"""
TransformerTwin — SimulatorEngine: main async loop and tick dispatcher.

Wires all physics models together and emits sensor/scenario updates
to registered callbacks (WebSocket broadcaster, database writer, etc.).

Phase 2.6: analytics modules (anomaly, DGA, FMEA, health) wired in.
"""

import asyncio
import logging
from collections import deque
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
    HEALTH_UPDATE_THRESHOLD,
)
from models.schemas import TransformerState, AlertSchema
from scenarios.manager import ScenarioManager
from simulator.load_profile import get_load_fraction, get_ambient_temp
from simulator.thermal_model import ThermalModel
from simulator.equipment_model import EquipmentModel
from simulator.dga_model import DGAModel
from simulator.noise import add_noise
from analytics.anomaly_detector import AnomalyDetector
from analytics.dga_analyzer import DGAAnalyzer
from analytics.fmea_engine import FMEAEngine
from analytics.health_score import HealthScoreCalculator

logger = logging.getLogger(__name__)

# Diagnostic sensor nominal values (slow drift only — no physics model yet)
_DIAG_NOMINALS: dict[str, float] = {
    "OIL_MOISTURE":   8.0,
    "OIL_DIELECTRIC": 55.0,
    "BUSHING_CAP_HV": 500.0,
    "BUSHING_CAP_LV": 420.0,
}

# Number of DGA history entries to keep for trend analysis
_DGA_HISTORY_LEN: int = 15

# Alert severity map: SensorStatus → AlertSeverity (no CAUTION in alerts)
_STATUS_TO_ALERT_SEVERITY: dict[str, str] = {
    "CAUTION":  "INFO",
    "WARNING":  "WARNING",
    "CRITICAL": "CRITICAL",
}

# Sensor-to-human-readable name for alert titles
_SENSOR_NAMES: dict[str, str] = {
    "TOP_OIL_TEMP":  "Top Oil Temperature",
    "BOT_OIL_TEMP":  "Bottom Oil Temperature",
    "WINDING_TEMP":  "Winding Hot Spot Temperature",
    "DGA_H2":        "Hydrogen (H2)",
    "DGA_CH4":       "Methane (CH4)",
    "DGA_C2H6":      "Ethane (C2H6)",
    "DGA_C2H4":      "Ethylene (C2H4)",
    "DGA_C2H2":      "Acetylene (C2H2)",
    "DGA_CO":        "Carbon Monoxide (CO)",
    "DGA_CO2":       "Carbon Dioxide (CO2)",
}

# Per-sensor recommended actions for anomaly alerts.
# These give operators immediate, concrete steps — not just "alert: temperature high".
_ANOMALY_RECOMMENDED_ACTIONS: dict[str, list[str]] = {
    "TOP_OIL_TEMP": [
        "Check that Fan Bank 1 and Fan Bank 2 are running",
        "Reduce transformer load to 70% or below",
        "Verify oil flow in cooling radiators",
        "Log reading and notify shift supervisor",
    ],
    "BOT_OIL_TEMP": [
        "Inspect bottom oil drain valve for blockage",
        "Verify cooling pump operation",
        "Compare top/bottom oil differential — if >20°C, escalate to FM investigation",
        "Log reading in operations log",
    ],
    "WINDING_TEMP": [
        "Reduce load immediately — target <70% rated",
        "Verify all cooling fans operational",
        "Initiate emergency DGA oil sample within 4 hours",
        "Contact transformer engineer if temperature exceeds 120°C",
        "Prepare for possible planned outage",
    ],
    "DGA_H2": [
        "Increase DGA sampling to daily",
        "Check for partial discharge — review bushing capacitance readings",
        "Review historical H2 trend for acceleration",
        "If H2 > 700 ppm: consult transformer specialist",
    ],
    "DGA_CH4": [
        "Cross-reference with C2H4 ratio for fault classification",
        "Increase DGA monitoring frequency",
        "Plot on Duval Triangle — check zone classification",
        "If Duval zone is T2/T3: initiate thermal fault investigation",
    ],
    "DGA_C2H6": [
        "Monitor for rising trend — C2H6 alone indicates low-temperature thermal fault",
        "Increase DGA sampling frequency to weekly",
        "Check load profile for sustained overloads",
    ],
    "DGA_C2H4": [
        "C2H4 elevation indicates thermal fault ≥300°C",
        "Initiate Winding Hot Spot investigation (FM-001)",
        "Reduce transformer load immediately",
        "Schedule thermal imaging of tank exterior",
    ],
    "DGA_C2H2": [
        "CRITICAL: Acetylene indicates arcing — immediate action required",
        "If C2H2 > 35 ppm: reduce load and prepare for outage",
        "If C2H2 > 200 ppm: emergency shutdown may be required",
        "Call control room and transformer engineer immediately",
        "Do not increase load until root cause confirmed",
    ],
    "DGA_CO": [
        "CO elevation indicates paper insulation degradation",
        "Check CO2/CO ratio — ratio < 5 indicates active paper burning",
        "Review transformer overload history",
        "Schedule furanic compound oil test to assess remaining insulation life",
    ],
    "DGA_CO2": [
        "Elevated CO2 may indicate overheated cellulose insulation",
        "Calculate CO2/CO ratio — if < 5: urgent paper degradation risk",
        "Review winding temperature trends",
        "Schedule comprehensive oil analysis",
    ],
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

    Phase 2.6 additions:
    - AnomalyDetector runs on every thermal + DGA group update
    - DGAAnalyzer runs whenever the DGA group updates
    - FMEAEngine + HealthScoreCalculator run on every thermal tick
    - health_update emitted when score delta >= HEALTH_UPDATE_THRESHOLD
    - alert emitted for each new/escalated anomaly
    - Sensor readings + health scores + alerts persisted to SQLite
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

        # Analytics modules
        self.anomaly_detector: AnomalyDetector = AnomalyDetector()
        self.dga_analyzer: DGAAnalyzer = DGAAnalyzer()
        self.fmea_engine: FMEAEngine = FMEAEngine()
        self.health_calculator: HealthScoreCalculator = HealthScoreCalculator()

        # Current transformer state
        self.state: TransformerState = TransformerState()

        # Latest analytics results (read by REST routes)
        self.latest_dga_analysis: dict = {}
        self.latest_fmea_result: list[dict] = []
        self.latest_health_result: dict = {
            "overall_score": 100.0,
            "status": "GOOD",
            "components": {},
        }
        self.latest_anomalies: list[dict] = []

        # Health tracking for delta-based emit
        self._last_health_score_emitted: float = 100.0

        # DGA history buffers for trend analysis (deque of float, newest last)
        self._dga_history: dict[str, deque[float]] = {
            sid: deque(maxlen=_DGA_HISTORY_LEN) for sid in DGA_SENSOR_IDS
        }

        # Auto-increment alert counter (used as fallback before DB assigns real ID)
        self._alert_seq: int = 0

        # Track last emitted FMEA alert confidence per failure mode ID.
        # Used to emit alerts only when confidence escalates (avoids alert flood).
        self._fmea_alert_confidence: dict[str, str] = {}

        # Last sim_time at which each sensor group was emitted
        self._last_thermal_emit: float = -THERMAL_UPDATE_INTERVAL_SIM_S
        self._last_equip_emit: float = -EQUIPMENT_UPDATE_INTERVAL_SIM_S
        self._last_dga_emit: float = -DGA_UPDATE_INTERVAL_SIM_S
        self._last_diag_emit: float = -DIAGNOSTIC_UPDATE_INTERVAL_SIM_S

        # Operator overrides — set by REST endpoints, applied each tick
        self.operator_load_override: float | None = None
        self.operator_cooling_override: str | None = None

        # Callbacks registered by the WebSocket handler / persistence layer
        self._sensor_callbacks: list = []
        self._health_callbacks: list = []
        self._alert_callbacks: list = []
        self._scenario_callbacks: list = []
        self._persist_callbacks: list = []

    # ------------------------------------------------------------------
    # Public control API
    # ------------------------------------------------------------------

    def set_speed(self, multiplier: int) -> None:
        """Change simulation speed multiplier (1–200).

        Args:
            multiplier: New time acceleration factor.
        """
        self.speed = max(1, min(200, multiplier))
        logger.info("Simulation speed set to %dx", self.speed)

    def set_operator_load(self, load_fraction: float | None) -> None:
        """Override the load fraction used in physics.  None restores normal profile.

        Args:
            load_fraction: Fixed load fraction (0.0–1.2) or None to clear.
        """
        self.operator_load_override = load_fraction
        logger.info(
            "Operator load override: %s",
            f"{load_fraction * 100:.0f}%" if load_fraction is not None else "cleared",
        )

    def set_operator_cooling(self, mode: str | None) -> None:
        """Override the cooling mode used in physics.  None restores automatic control.

        Args:
            mode: "ONAN", "ONAF", or "OFAF", or None to clear.
        """
        self.operator_cooling_override = mode
        logger.info("Operator cooling override: %s", mode if mode is not None else "cleared")

    def clear_operator_overrides(self) -> None:
        """Remove all operator overrides — return to normal automatic operation."""
        self.operator_load_override = None
        self.operator_cooling_override = None
        logger.info("All operator overrides cleared.")

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

    def register_persist_callback(self, cb) -> None:  # noqa: ANN001
        """Register a coroutine called after analytics for DB persistence."""
        self._persist_callbacks.append(cb)

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
        """Advance simulation by one tick: physics -> state -> analytics -> callbacks."""
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
        top_oil_delta: float = thermal_mods.get("top_oil_delta", 0.0)
        cooling_override: str | None = thermal_mods.get("cooling_mode_override", None)

        # --- 3. Load + ambient profiles ---
        # Operator load override takes precedence over the normal sinusoidal profile.
        if self.operator_load_override is not None:
            load_fraction = self.operator_load_override
        else:
            load_fraction = get_load_fraction(self.sim_time)
        ambient_temp = get_ambient_temp(self.sim_time)

        # --- 4. Equipment model (derives cooling mode) ---
        # Operator cooling override takes precedence over scenario override.
        effective_cooling_override = self.operator_cooling_override or cooling_override
        equip = self.equipment_model.update(
            top_oil_temp=self.state.top_oil_temp,
            load_fraction=load_fraction,
            fan_bank_1=self.state.fan_bank_1,
            fan_bank_2=self.state.fan_bank_2,
            oil_pump_1=self.state.oil_pump_1,
            tap_position=self.state.tap_position,
            tap_op_count=self.state.tap_op_count,
            cooling_mode_override=effective_cooling_override,
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
        # top_oil_delta: scenario additive offset (e.g. hot_spot heat transfer to oil).
        # Applied to output only — does NOT feed back into the thermal lag integrator.
        self.state.top_oil_temp = add_noise("TOP_OIL_TEMP", thermal.top_oil_temp + top_oil_delta)
        self.state.bot_oil_temp = add_noise("BOT_OIL_TEMP", thermal.bot_oil_temp)
        self.state.winding_temp = add_noise("WINDING_TEMP", thermal.winding_temp)
        self.state.load_current = add_noise("LOAD_CURRENT", round(load_fraction * 100.0, 1))
        self.state.ambient_temp = add_noise("AMBIENT_TEMP", ambient_temp)
        self.state.cooling_mode = cooling_mode

        # DGA (noise applied separately; clamp to >= 0 in DGAModel)
        for gas_id in DGA_SENSOR_IDS:
            field = gas_id.lower()  # e.g. DGA_H2 -> dga_h2
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

        thermal_due = self.sim_time - self._last_thermal_emit >= THERMAL_UPDATE_INTERVAL_SIM_S
        equip_due   = self.sim_time - self._last_equip_emit   >= EQUIPMENT_UPDATE_INTERVAL_SIM_S
        dga_due     = self.sim_time - self._last_dga_emit     >= DGA_UPDATE_INTERVAL_SIM_S
        diag_due    = self.sim_time - self._last_diag_emit    >= DIAGNOSTIC_UPDATE_INTERVAL_SIM_S

        if thermal_due:
            await self._emit_sensor_group("thermal", now_iso)
            self._last_thermal_emit = self.sim_time

            # Anomaly detection on thermal sensors
            thermal_anomalies = self.anomaly_detector.evaluate(self.state, "thermal")
            self.latest_anomalies = thermal_anomalies

            # Emit alerts for new/escalated anomalies
            for anomaly in thermal_anomalies:
                if anomaly.get("is_new") or anomaly.get("is_escalated"):
                    await self._emit_anomaly_alert(anomaly, now_iso)

        if equip_due:
            await self._emit_sensor_group("equipment", now_iso)
            self._last_equip_emit = self.sim_time

        if dga_due:
            await self._emit_sensor_group("dga", now_iso)
            self._last_dga_emit = self.sim_time

            # Update DGA history buffers for trend analysis
            for gas_id in DGA_SENSOR_IDS:
                val = float(getattr(self.state, gas_id.lower(), 0.0))
                self._dga_history[gas_id].append(val)

            # Anomaly detection on DGA sensors
            dga_anomalies = self.anomaly_detector.evaluate(self.state, "dga")
            self.latest_anomalies = self.latest_anomalies + dga_anomalies

            # Full DGA analysis
            self.latest_dga_analysis = self.dga_analyzer.analyze(
                h2=self.state.dga_h2,
                ch4=self.state.dga_ch4,
                c2h6=self.state.dga_c2h6,
                c2h4=self.state.dga_c2h4,
                c2h2=self.state.dga_c2h2,
                co=self.state.dga_co,
                co2=self.state.dga_co2,
                history_h2=list(self._dga_history["DGA_H2"]),
                history_ch4=list(self._dga_history["DGA_CH4"]),
                history_c2h4=list(self._dga_history["DGA_C2H4"]),
                history_c2h2=list(self._dga_history["DGA_C2H2"]),
                history_co=list(self._dga_history["DGA_CO"]),
                history_co2=list(self._dga_history["DGA_CO2"]),
                history_c2h6=list(self._dga_history["DGA_C2H6"]),
            )

            # Emit DGA anomaly alerts
            for anomaly in dga_anomalies:
                if anomaly.get("is_new") or anomaly.get("is_escalated"):
                    await self._emit_anomaly_alert(anomaly, now_iso)

        if diag_due:
            await self._emit_sensor_group("diagnostic", now_iso)
            self._last_diag_emit = self.sim_time

        # --- 11. FMEA + Health score on every thermal tick ---
        if thermal_due:
            all_anomalies = self.latest_anomalies
            self.latest_fmea_result = self.fmea_engine.evaluate(
                state=self.state,
                dga_analysis=self.latest_dga_analysis,
                anomalies=all_anomalies,
            )
            health_result = self.health_calculator.compute(
                state=self.state,
                dga_analysis=self.latest_dga_analysis,
                anomalies=all_anomalies,
            )
            self.latest_health_result = health_result

            # Emit FMEA alerts when confidence escalates
            active_fm_ids: set[str] = set()
            for mode in self.latest_fmea_result:
                fm_id = mode["id"]
                confidence = mode["confidence_label"]
                active_fm_ids.add(fm_id)
                prev_confidence = self._fmea_alert_confidence.get(fm_id, "")
                # Emit on first arrival at Possible/Probable, or escalation to Probable
                if confidence in ("Possible", "Probable") and confidence != prev_confidence:
                    await self._emit_fmea_alert(mode, now_iso)
                    self._fmea_alert_confidence[fm_id] = confidence
            # Reset tracking for failure modes that dropped below report threshold
            for fm_id in list(self._fmea_alert_confidence):
                if fm_id not in active_fm_ids:
                    del self._fmea_alert_confidence[fm_id]

            # Emit health_update if score changed by >= threshold
            new_score = health_result["overall_score"]
            delta = abs(new_score - self._last_health_score_emitted)
            if delta >= HEALTH_UPDATE_THRESHOLD:
                await self._emit_health_update(health_result, new_score, now_iso)
                self._last_health_score_emitted = new_score

                # Persist health score snapshot
                await self._fire_callbacks(
                    self._persist_callbacks,
                    {
                        "type": "persist_health",
                        "overall_score": new_score,
                        "sim_time": self.sim_time,
                        "timestamp": now_iso,
                    },
                )

        # --- 12. Persist sensor readings (thermal + DGA groups) ---
        if thermal_due:
            for sid in THERMAL_SENSOR_IDS:
                value, status = self._get_sensor_value_and_status(sid)
                await self._fire_callbacks(
                    self._persist_callbacks,
                    {
                        "type": "persist_sensor",
                        "sensor_id": sid,
                        "value": value,
                        "status": status,
                        "sim_time": self.sim_time,
                        "timestamp": now_iso,
                    },
                )
        if dga_due:
            for sid in DGA_SENSOR_IDS:
                value, status = self._get_sensor_value_and_status(sid)
                await self._fire_callbacks(
                    self._persist_callbacks,
                    {
                        "type": "persist_sensor",
                        "sensor_id": sid,
                        "value": value,
                        "status": status,
                        "sim_time": self.sim_time,
                        "timestamp": now_iso,
                    },
                )

        # --- 13. Scenario updates during active scenarios ---
        if scenario.scenario_id != "normal":
            await self._emit_scenario_update(now_iso)

    # ------------------------------------------------------------------
    # Analytics emission helpers
    # ------------------------------------------------------------------

    async def _emit_anomaly_alert(self, anomaly: dict, timestamp: str) -> None:
        """Build and broadcast an alert message for an anomaly.

        Args:
            anomaly: Anomaly dict from AnomalyDetector.
            timestamp: ISO 8601 UTC timestamp string.
        """
        self._alert_seq += 1
        sensor_id = anomaly["sensor_id"]
        status = anomaly["status"]
        severity = _STATUS_TO_ALERT_SEVERITY.get(status, "INFO")
        sensor_name = _SENSOR_NAMES.get(sensor_id, sensor_id)
        actual = anomaly.get("actual", 0.0)
        expected = anomaly.get("expected", 0.0)
        deviation_pct = anomaly.get("deviation_pct", 0.0)
        unit = SENSOR_UNITS.get(sensor_id, "")

        trend = anomaly.get("trend", "STABLE")
        trend_text = " Trend: rising rapidly." if trend == "RISING" else ""

        title = f"{sensor_name} — {status} Level Reached"
        description = (
            f"{sensor_name} has reached {status} level. "
            f"Current: {actual:.1f}{unit} (expected ≈ {expected:.1f}{unit}). "
            f"Deviation: {deviation_pct:.1f}%.{trend_text}"
        )

        recommended_actions = _ANOMALY_RECOMMENDED_ACTIONS.get(sensor_id, [])

        alert_dict = {
            "type": "alert",
            "alert": {
                "id": self._alert_seq,
                "timestamp": timestamp,
                "severity": severity,
                "title": title,
                "description": description,
                "source": "ANOMALY_ENGINE",
                "sensor_ids": [sensor_id],
                "failure_mode_id": None,
                "recommended_actions": recommended_actions,
                "acknowledged": False,
                "acknowledged_at": None,
                "sim_time": self.sim_time,
            },
        }

        await self._fire_callbacks(self._alert_callbacks, alert_dict)

        # Persist to DB via persist callback
        alert_schema = AlertSchema(
            id=self._alert_seq,
            timestamp=timestamp,
            severity=severity,  # type: ignore[arg-type]
            title=title,
            description=description,
            source="ANOMALY_ENGINE",  # type: ignore[arg-type]
            sensor_ids=[sensor_id],
            failure_mode_id=None,
            recommended_actions=recommended_actions,
            acknowledged=False,
            acknowledged_at=None,
            sim_time=self.sim_time,
        )
        await self._fire_callbacks(
            self._persist_callbacks,
            {"type": "persist_alert", "alert": alert_schema},
        )

    async def _emit_fmea_alert(self, mode: dict, timestamp: str) -> None:
        """Build and broadcast an alert message for an FMEA failure mode match.

        Emitted when a failure mode confidence escalates to "Possible" or "Probable".
        Includes all recommended_actions and the failure_mode_id so the frontend
        can link the alert directly to the FMEA panel.

        Args:
            mode: FMEA mode dict from FMEAEngine.evaluate() with keys:
                  id, name, match_score, confidence_label, recommended_actions.
            timestamp: ISO 8601 UTC timestamp string.
        """
        self._alert_seq += 1
        confidence = mode["confidence_label"]
        severity = "CRITICAL" if confidence == "Probable" else "WARNING"
        fm_id = mode["id"]
        name = mode["name"]
        score_pct = round(mode["match_score"] * 100)
        actions: list[str] = mode.get("recommended_actions", [])

        title = f"{name} — {confidence} ({score_pct}% match)"
        description = (
            f"FMEA analysis has identified a {confidence.lower()} {name} pattern "
            f"with {score_pct}% confidence. "
            + (f"Immediate action: {actions[0]}." if actions else "")
        )

        alert_dict = {
            "type": "alert",
            "alert": {
                "id": self._alert_seq,
                "timestamp": timestamp,
                "severity": severity,
                "title": title,
                "description": description,
                "source": "FMEA_ENGINE",
                "sensor_ids": [],
                "failure_mode_id": fm_id,
                "recommended_actions": actions,
                "acknowledged": False,
                "acknowledged_at": None,
                "sim_time": self.sim_time,
            },
        }
        await self._fire_callbacks(self._alert_callbacks, alert_dict)

        alert_schema = AlertSchema(
            id=self._alert_seq,
            timestamp=timestamp,
            severity=severity,  # type: ignore[arg-type]
            title=title,
            description=description,
            source="FMEA_ENGINE",  # type: ignore[arg-type]
            sensor_ids=[],
            failure_mode_id=fm_id,
            recommended_actions=actions,
            acknowledged=False,
            acknowledged_at=None,
            sim_time=self.sim_time,
        )
        await self._fire_callbacks(
            self._persist_callbacks,
            {"type": "persist_alert", "alert": alert_schema},
        )

    async def _emit_health_update(
        self, health_result: dict, new_score: float, timestamp: str
    ) -> None:
        """Broadcast a health_update WebSocket message.

        Args:
            health_result: Dict from HealthScoreCalculator.compute().
            new_score: New overall score.
            timestamp: ISO 8601 UTC timestamp.
        """
        components_out: dict[str, dict] = {}
        for key, comp in health_result.get("components", {}).items():
            components_out[key] = {
                "status": comp["status"],
                "contribution": comp["contribution"],
            }

        message = {
            "type": "health_update",
            "timestamp": timestamp,
            "sim_time": self.sim_time,
            "overall_score": round(new_score, 1),
            "previous_score": round(self._last_health_score_emitted, 1),
            "components": components_out,
        }
        await self._fire_callbacks(self._health_callbacks, message)

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

        # Add `expected` field for thermal sensors (rolling mean from anomaly detector)
        if group == "thermal":
            for sid in ("TOP_OIL_TEMP", "BOT_OIL_TEMP", "WINDING_TEMP"):
                if sid in sensors:
                    hist = list(self.anomaly_detector._history.get(sid, []))
                    if len(hist) >= 5:
                        sensors[sid]["expected"] = round(sum(hist) / len(hist), 1)

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
