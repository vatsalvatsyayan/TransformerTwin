"""
TransformerTwin — Anomaly detection engine.

Computes expected values from a rolling baseline and flags deviations
using z-score classification and rate-of-change checks.

Phase 2.1: rolling Z-score + rate-of-change detection for thermal/DGA sensors.
"""

import logging
import math
from collections import deque

from config import (
    ANOMALY_BASELINE_WINDOW,
    ANOMALY_Z_CAUTION,
    ANOMALY_Z_WARNING,
    ANOMALY_Z_CRITICAL,
    SENSOR_THRESHOLDS,
)
from models.schemas import TransformerState

logger = logging.getLogger(__name__)

# Sensors subject to anomaly detection (thermal + DGA, excluding load/ambient)
_MONITORED_SENSORS: tuple[str, ...] = (
    "TOP_OIL_TEMP",
    "BOT_OIL_TEMP",
    "WINDING_TEMP",
    "DGA_H2",
    "DGA_CH4",
    "DGA_C2H6",
    "DGA_C2H4",
    "DGA_C2H2",
    "DGA_CO",
    "DGA_CO2",
)

# Rate-of-change threshold: >10% of sensor range per tick triggers escalation
_RATE_OF_CHANGE_THRESHOLD_PCT: float = 0.10

# Minimum samples before z-score baseline is considered valid
_MIN_BASELINE_SAMPLES: int = 20


def _sensor_range(sensor_id: str) -> float:
    """Return the useful range (warning - caution) for rate-of-change scaling.

    Args:
        sensor_id: Canonical sensor ID.

    Returns:
        Numeric range value (always > 0).
    """
    if sensor_id not in SENSOR_THRESHOLDS:
        return 1.0
    caution, warning, _critical = SENSOR_THRESHOLDS[sensor_id]
    return max(1.0, abs(warning - caution))


def _severity_rank(status: str) -> int:
    """Return numeric rank for severity comparison.

    Args:
        status: SensorStatus string.

    Returns:
        Integer rank (0=NORMAL, 1=CAUTION, 2=WARNING, 3=CRITICAL).
    """
    return {"NORMAL": 0, "CAUTION": 1, "WARNING": 2, "CRITICAL": 3}.get(status, 0)


class AnomalyDetector:
    """Detects sensor deviations from rolling-baseline expectations.

    For each monitored sensor, maintains a fixed-length deque of recent values.
    Computes z-score (deviation from rolling mean/std) and optionally escalates
    the severity based on rate-of-change.

    Also tracks per-sensor trends ("RISING", "STABLE", "FALLING") for FMEA use.
    """

    def __init__(self) -> None:
        # Rolling history: sensor_id → deque of float values
        self._history: dict[str, deque[float]] = {
            sid: deque(maxlen=ANOMALY_BASELINE_WINDOW)
            for sid in _MONITORED_SENSORS
        }

        # Last emitted status per sensor (to avoid re-alerting on every tick)
        self._last_status: dict[str, str] = {
            sid: "NORMAL" for sid in _MONITORED_SENSORS
        }

    def feed(self, sensor_id: str, value: float) -> None:
        """Append a new value to the rolling history for a sensor.

        Args:
            sensor_id: Canonical sensor ID.
            value: Latest reading.
        """
        if sensor_id in self._history:
            self._history[sensor_id].append(value)

    def get_trend(self, sensor_id: str, n_readings: int = 10) -> str:
        """Compute trend from recent history.

        RISING if last n_readings increased >5%, FALLING if decreased >5%,
        else STABLE.

        Args:
            sensor_id: Canonical sensor ID.
            n_readings: Comparison window length (default 10).

        Returns:
            "RISING", "STABLE", or "FALLING".
        """
        hist = list(self._history.get(sensor_id, []))
        if len(hist) < n_readings + 1:
            return "STABLE"
        older = hist[-(n_readings + 1)]
        newer = hist[-1]
        if older <= 0.0:
            return "STABLE"
        pct_change = (newer - older) / older
        if pct_change > 0.05:
            return "RISING"
        if pct_change < -0.05:
            return "FALLING"
        return "STABLE"

    def get_all_trends(self) -> dict[str, str]:
        """Return current trend for every monitored sensor.

        Returns:
            Dict mapping sensor_id → trend string.
        """
        return {sid: self.get_trend(sid) for sid in _MONITORED_SENSORS}

    def evaluate(
        self,
        state: TransformerState,
        group: str,
    ) -> list[dict]:
        """Evaluate all sensors in a group for anomalies.

        Feeds current values into rolling history, computes z-scores, applies
        rate-of-change escalation, and returns anomaly records for non-NORMAL
        sensors.

        Args:
            state: Current transformer simulation state.
            group: Sensor group ("thermal", "dga", "equipment", "diagnostic").

        Returns:
            List of anomaly dicts with keys:
                sensor_id, actual, expected, deviation_pct, status, trend,
                z_score, is_new, is_escalated.
            Empty list if no anomalies detected.
        """
        if group == "thermal":
            candidates: tuple[str, ...] = ("TOP_OIL_TEMP", "BOT_OIL_TEMP", "WINDING_TEMP")
        elif group == "dga":
            candidates = ("DGA_H2", "DGA_CH4", "DGA_C2H6", "DGA_C2H4",
                          "DGA_C2H2", "DGA_CO", "DGA_CO2")
        else:
            # No anomaly detection for equipment or diagnostic sensors
            return []

        results: list[dict] = []
        for sid in candidates:
            if sid not in _MONITORED_SENSORS:
                continue
            value = float(getattr(state, sid.lower(), 0.0))
            self.feed(sid, value)
            anomaly = self._classify(sid, value)
            if anomaly is not None:
                results.append(anomaly)

        return results

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _classify(self, sensor_id: str, value: float) -> dict | None:
        """Classify a single sensor reading against its rolling baseline.

        Args:
            sensor_id: Canonical sensor ID.
            value: Current reading.

        Returns:
            Anomaly dict if status is not NORMAL, else None.
        """
        hist = self._history[sensor_id]
        if len(hist) < _MIN_BASELINE_SAMPLES:
            return None

        values = list(hist)
        mean = sum(values) / len(values)
        variance = sum((v - mean) ** 2 for v in values) / len(values)
        # Floor std at 1% of sensor range to prevent tiny natural noise
        # from generating huge z-scores and false CAUTION alerts.
        min_std = _sensor_range(sensor_id) * 0.01
        std = max(min_std, math.sqrt(variance) if variance > 0 else 0.0)

        z = abs(value - mean) / std

        # Z-score → status (higher z = more anomalous)
        if z >= ANOMALY_Z_CRITICAL:
            status = "CRITICAL"
        elif z >= ANOMALY_Z_WARNING:
            status = "WARNING"
        elif z >= ANOMALY_Z_CAUTION:
            status = "CAUTION"
        else:
            status = "NORMAL"

        # Rate-of-change escalation: if value changed >10% of range vs prev tick
        if len(hist) >= 2 and status != "CRITICAL":
            prev = list(hist)[-2]
            sensor_range = _sensor_range(sensor_id)
            roc_pct = abs(value - prev) / sensor_range
            if roc_pct > _RATE_OF_CHANGE_THRESHOLD_PCT:
                # Escalate by one level
                if status == "NORMAL":
                    status = "CAUTION"
                elif status == "CAUTION":
                    status = "WARNING"
                elif status == "WARNING":
                    status = "CRITICAL"

        deviation_pct = round((value - mean) / max(abs(mean), 1e-9) * 100.0, 1)
        trend = self.get_trend(sensor_id)

        if status == "NORMAL":
            self._last_status[sensor_id] = "NORMAL"
            return None

        prev_status = self._last_status.get(sensor_id, "NORMAL")
        self._last_status[sensor_id] = status

        return {
            "sensor_id": sensor_id,
            "actual": round(value, 1),
            "expected": round(mean, 1),
            "deviation_pct": deviation_pct,
            "status": status,
            "trend": trend,
            "z_score": round(z, 2),
            "is_new": prev_status == "NORMAL",
            "is_escalated": (
                prev_status not in ("NORMAL", status)
                and _severity_rank(status) > _severity_rank(prev_status)
            ),
        }
