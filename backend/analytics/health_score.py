"""
TransformerTwin — Health score calculator.

Computes a weighted composite health score (0–100) from component
status levels using the weights defined in config.py.

Phase 2.4: full implementation of weighted penalty deduction model.
"""

import logging

from config import (
    HEALTH_WEIGHTS,
    HEALTH_STATUS_GOOD,
    HEALTH_STATUS_FAIR,
    HEALTH_STATUS_POOR,
    HEALTH_PENALTY_CAUTION,
    HEALTH_PENALTY_WARNING,
    HEALTH_PENALTY_CRITICAL,
    SENSOR_THRESHOLDS,
    TDCG_CAUTION_PPM,
    TDCG_WARNING_PPM,
    TDCG_CRITICAL_PPM,
)
from models.schemas import TransformerState

logger = logging.getLogger(__name__)

# Maps SensorStatus → penalty points
_PENALTY: dict[str, int] = {
    "NORMAL":   0,
    "CAUTION":  HEALTH_PENALTY_CAUTION,
    "WARNING":  HEALTH_PENALTY_WARNING,
    "CRITICAL": HEALTH_PENALTY_CRITICAL,
}


def _sensor_status(sensor_id: str, value: float) -> str:
    """Return the threshold-based status for a sensor value.

    OIL_DIELECTRIC is reversed (lower is worse).

    Args:
        sensor_id: Canonical sensor ID.
        value: Current reading.

    Returns:
        "NORMAL", "CAUTION", "WARNING", or "CRITICAL".
    """
    if sensor_id not in SENSOR_THRESHOLDS:
        return "NORMAL"
    caution, warning, critical = SENSOR_THRESHOLDS[sensor_id]

    if sensor_id == "OIL_DIELECTRIC":
        if value < critical:
            return "CRITICAL"
        if value < warning:
            return "WARNING"
        if value < caution:
            return "CAUTION"
        return "NORMAL"

    if value >= critical:
        return "CRITICAL"
    if value >= warning:
        return "WARNING"
    if value >= caution:
        return "CAUTION"
    return "NORMAL"


def _tdcg_status(h2: float, ch4: float, c2h6: float, c2h4: float,
                 c2h2: float, co: float) -> str:
    """Return TDCG-based status (IEEE C57.104 Table 2).

    Args:
        h2, ch4, c2h6, c2h4, c2h2, co: Gas concentrations in ppm.

    Returns:
        SensorStatus string.
    """
    tdcg = int(h2 + ch4 + c2h6 + c2h4 + c2h2 + co)
    if tdcg >= TDCG_CRITICAL_PPM:
        return "CRITICAL"
    if tdcg >= TDCG_WARNING_PPM:
        return "WARNING"
    if tdcg >= TDCG_CAUTION_PPM:
        return "CAUTION"
    return "NORMAL"


def _worst_status(*statuses: str) -> str:
    """Return the most severe status from a set.

    Args:
        *statuses: SensorStatus strings.

    Returns:
        Most severe SensorStatus.
    """
    rank = {"NORMAL": 0, "CAUTION": 1, "WARNING": 2, "CRITICAL": 3}
    worst = max(statuses, key=lambda s: rank.get(s, 0))
    return worst


class HealthScoreCalculator:
    """Computes composite transformer health score.

    Score starts at 100 and deductions are made based on penalty points
    for each component that is in CAUTION / WARNING / CRITICAL state.

    Component mapping:
        dga         → worst of all DGA sensor statuses + TDCG
        winding_temp → WINDING_TEMP status
        oil_temp     → worst of TOP_OIL_TEMP / BOT_OIL_TEMP
        cooling      → worst of fan/pump anomaly (from anomaly result)
        oil_quality  → worst of OIL_MOISTURE / OIL_DIELECTRIC
        bushing      → worst of BUSHING_CAP_HV / BUSHING_CAP_LV
    """

    def compute(
        self,
        state: TransformerState,
        dga_analysis: dict | None = None,
        anomalies: list[dict] | None = None,
    ) -> dict:
        """Compute the overall health score and component breakdown.

        Args:
            state: Current transformer simulation state.
            dga_analysis: DGA analysis result (optional).
            anomalies: Detected anomalies list (optional).

        Returns:
            Dict matching HealthResponseSchema structure with keys:
                overall_score, status, components.
        """
        # --- Per-component status determination ---

        # dga: worst DGA sensor + TDCG
        dga_statuses = [
            _sensor_status("DGA_H2",   state.dga_h2),
            _sensor_status("DGA_CH4",  state.dga_ch4),
            _sensor_status("DGA_C2H6", state.dga_c2h6),
            _sensor_status("DGA_C2H4", state.dga_c2h4),
            _sensor_status("DGA_C2H2", state.dga_c2h2),
            _sensor_status("DGA_CO",   state.dga_co),
            _sensor_status("DGA_CO2",  state.dga_co2),
            _tdcg_status(
                state.dga_h2, state.dga_ch4, state.dga_c2h6,
                state.dga_c2h4, state.dga_c2h2, state.dga_co,
            ),
        ]
        # Also incorporate DGA anomaly statuses if available
        if anomalies:
            for a in anomalies:
                if a.get("sensor_id", "").startswith("DGA_"):
                    dga_statuses.append(a.get("status", "NORMAL"))

        dga_component_status = _worst_status(*dga_statuses)

        # winding_temp: WINDING_TEMP threshold + anomaly
        winding_statuses = [_sensor_status("WINDING_TEMP", state.winding_temp)]
        if anomalies:
            for a in anomalies:
                if a.get("sensor_id") == "WINDING_TEMP":
                    winding_statuses.append(a.get("status", "NORMAL"))
        winding_component_status = _worst_status(*winding_statuses)

        # oil_temp: worst of top/bot oil temps
        oil_temp_statuses = [
            _sensor_status("TOP_OIL_TEMP", state.top_oil_temp),
            _sensor_status("BOT_OIL_TEMP", state.bot_oil_temp),
        ]
        if anomalies:
            for a in anomalies:
                if a.get("sensor_id") in ("TOP_OIL_TEMP", "BOT_OIL_TEMP"):
                    oil_temp_statuses.append(a.get("status", "NORMAL"))
        oil_temp_component_status = _worst_status(*oil_temp_statuses)

        # cooling: derive from fan/pump vs oil_temp mismatch
        # Fans expected ON when top_oil > 75°C; pump expected ON when load > 80%
        fan1 = state.fan_bank_1
        fan2 = state.fan_bank_2
        pump = state.oil_pump_1
        cooling_status = "NORMAL"
        if state.top_oil_temp > 85.0 and not fan1 and not fan2:
            cooling_status = "CRITICAL"
        elif state.top_oil_temp > 75.0 and not fan1 and not fan2:
            cooling_status = "WARNING"
        elif state.load_current > 80.0 and not pump:
            cooling_status = "CAUTION"

        # oil_quality: moisture + dielectric
        oil_quality_statuses = [
            _sensor_status("OIL_MOISTURE",   state.oil_moisture),
            _sensor_status("OIL_DIELECTRIC", state.oil_dielectric),
        ]
        oil_quality_component_status = _worst_status(*oil_quality_statuses)

        # bushing: HV + LV bushing caps
        bushing_statuses = [
            _sensor_status("BUSHING_CAP_HV", state.bushing_cap_hv),
            _sensor_status("BUSHING_CAP_LV", state.bushing_cap_lv),
        ]
        bushing_component_status = _worst_status(*bushing_statuses)

        # --- Assemble component map ---
        component_statuses: dict[str, str] = {
            "dga":          dga_component_status,
            "winding_temp": winding_component_status,
            "oil_temp":     oil_temp_component_status,
            "cooling":      cooling_status,
            "oil_quality":  oil_quality_component_status,
            "bushing":      bushing_component_status,
        }

        # --- Apply weighted penalty formula ---
        # score = 100 - Σ(penalty[status[component]] × weight[component])
        total_penalty = 0.0
        components: dict[str, dict] = {}
        for key, weight in HEALTH_WEIGHTS.items():
            status = component_statuses.get(key, "NORMAL")
            penalty = _PENALTY.get(status, 0)
            contribution = round(penalty * weight, 1)
            total_penalty += penalty * weight
            components[key] = {
                "status": status,
                "penalty": penalty,
                "weight": weight,
                "contribution": contribution,
            }

        overall_score = max(0.0, min(100.0, round(100.0 - total_penalty, 1)))

        return {
            "overall_score": overall_score,
            "status": self._score_to_label(overall_score),
            "components": components,
        }

    def _score_to_label(self, score: float) -> str:
        """Map a numeric score to a health status label.

        Args:
            score: Health score (0–100).

        Returns:
            One of "GOOD", "FAIR", "POOR", "CRITICAL".
        """
        if score >= HEALTH_STATUS_GOOD:
            return "GOOD"
        if score >= HEALTH_STATUS_FAIR:
            return "FAIR"
        if score >= HEALTH_STATUS_POOR:
            return "POOR"
        return "CRITICAL"
