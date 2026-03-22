"""
TransformerTwin — Prognostics Engine.

Computes forward-looking health trajectory predictions from historical
health score data. This is the core "digital twin" capability: predicting
WHAT WILL HAPPEN rather than only reporting what IS happening.

Key outputs:
- Degradation rate: health points lost per sim-hour
- Time-to-warning: sim-hours until health crosses WARNING threshold (60)
- Time-to-critical: sim-hours until health crosses CRITICAL threshold (40)
- Projected health at 24h, 48h, 72h sim-horizons
- Intervention impact: how much time load reduction buys the operator
"""

import logging
import math

from config import (
    PROGNOSTICS_MIN_HISTORY_POINTS,
    PROGNOSTICS_WARNING_THRESHOLD,
    PROGNOSTICS_CRITICAL_THRESHOLD,
    PROGNOSTICS_HORIZON_SIM_HRS,
    PROGNOSTICS_INTERVENTION_RECOVERY_RATE_PER_HR,
    FATIGUE_FULL_DAMAGE_DEGREE_HOURS,
)
from models.schemas import TransformerState

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Slope estimation via least-squares linear regression
# ---------------------------------------------------------------------------


def _compute_slope(history: list[tuple[float, float]]) -> float | None:
    """Estimate health score degradation rate via linear regression.

    Args:
        history: List of (sim_time_s, health_score) tuples, oldest first.

    Returns:
        Slope in health-points per sim-second (negative = degrading),
        or None if insufficient data.
    """
    n = len(history)
    if n < PROGNOSTICS_MIN_HISTORY_POINTS:
        return None

    # Normalise times to reduce floating-point error
    t0 = history[0][0]
    xs = [h[0] - t0 for h in history]
    ys = [h[1] for h in history]

    # Standard least-squares: slope = (n·Σxy - Σx·Σy) / (n·Σx² - (Σx)²)
    sum_x  = sum(xs)
    sum_y  = sum(ys)
    sum_xy = sum(x * y for x, y in zip(xs, ys))
    sum_x2 = sum(x * x for x in xs)

    denom = n * sum_x2 - sum_x ** 2
    if abs(denom) < 1e-12:
        return 0.0

    slope_per_s = (n * sum_xy - sum_x * sum_y) / denom
    return slope_per_s


def _time_to_threshold(
    current_score: float,
    slope_per_s: float,
    threshold: float,
) -> float | None:
    """Compute sim-hours until health reaches a threshold at current slope.

    Args:
        current_score: Current health score (0–100).
        slope_per_s: Degradation rate in pts/sim-second (negative = degrading).
        threshold: Target health score threshold.

    Returns:
        Sim-hours until threshold is reached, or None if not projected.
        Returns None when score already below threshold or degradation is flat/improving.
    """
    if current_score <= threshold:
        return None  # Already past threshold
    if slope_per_s >= 0.0:
        return None  # Improving or stable — threshold not projected

    # Seconds until health reaches threshold
    delta_score = current_score - threshold
    seconds_to_threshold = delta_score / abs(slope_per_s)
    return seconds_to_threshold / 3600.0  # Convert to sim-hours


# ---------------------------------------------------------------------------
# Main public API
# ---------------------------------------------------------------------------


class PrognosticsEngine:
    """Computes forward-looking health trajectory from historical score data."""

    def compute(
        self,
        health_history: list[tuple[float, float]],
        health_result: dict,
        fmea_results: list[dict],
        state: TransformerState,
        thermal_fatigue_score: float,
        cascade_triggered: bool,
    ) -> dict:
        """Produce a complete prognostics snapshot.

        Args:
            health_history: List of (sim_time_s, health_score) tuples from engine.
            health_result: Latest health score result dict.
            fmea_results: Latest FMEA results list.
            state: Current transformer state.
            thermal_fatigue_score: Normalised cumulative fatigue (0.0–1.0).
            cascade_triggered: True if thermal→arcing cascade is active.

        Returns:
            Prognostics response dict.
        """
        current_score = health_result.get("overall_score", 100.0)

        # --- Degradation rate ---
        slope_per_s = _compute_slope(health_history)

        if slope_per_s is None or len(health_history) < PROGNOSTICS_MIN_HISTORY_POINTS:
            return self._insufficient_data(current_score, thermal_fatigue_score, cascade_triggered)

        # Convert to per-hour (positive = degrading, negative = improving)
        rate_per_hr = -slope_per_s * 3600.0  # pts/sim-hour, positive = getting worse

        # --- Time-to-threshold projections ---
        time_to_warning_hr = _time_to_threshold(current_score, slope_per_s, PROGNOSTICS_WARNING_THRESHOLD)
        time_to_critical_hr = _time_to_threshold(current_score, slope_per_s, PROGNOSTICS_CRITICAL_THRESHOLD)

        # --- Projected health scores ---
        def project(hours: float) -> float:
            projected = current_score + slope_per_s * hours * 3600.0
            return max(0.0, min(100.0, round(projected, 1)))

        projected_24h = project(24.0)
        projected_48h = project(48.0)
        projected_72h = project(72.0)

        # --- Intervention scenario: operator reduces load to 70% ---
        # Effect: thermal stress drops, DGA generation slows, health starts recovering
        # Conservative model: at 70% load, health recovers at flat rate if currently degrading
        intervention_rate_per_hr = (
            PROGNOSTICS_INTERVENTION_RECOVERY_RATE_PER_HR if rate_per_hr > 0 else 0.0
        )
        def project_intervention(hours: float) -> float:
            # No-action trajectory for first 0.5h (action takes time to take effect)
            warmup = min(hours, 0.5)
            remaining = max(0.0, hours - 0.5)
            # Warmup: continues degrading at natural rate
            score_after_warmup = current_score + slope_per_s * warmup * 3600.0
            # After intervention: health recovers at intervention_rate_per_hr.
            # Note: score_after_warmup already accounts for warmup degradation;
            # only add the recovery for the remaining post-intervention period.
            score_after_intervention = score_after_warmup + intervention_rate_per_hr * remaining
            return max(0.0, min(100.0, round(score_after_intervention, 1)))

        # --- Intervention time-to-critical ---
        # After intervention, health stabilises and recovers — so critical threshold
        # may never be reached. Use a conservative estimate.
        intervention_time_to_critical: float | None = None
        if rate_per_hr > intervention_rate_per_hr and current_score > PROGNOSTICS_CRITICAL_THRESHOLD:
            net_rate = rate_per_hr - intervention_rate_per_hr
            if net_rate > 0:
                hrs = (current_score - PROGNOSTICS_CRITICAL_THRESHOLD) / net_rate
                intervention_time_to_critical = max(0.0, hrs)

        # --- Trend classification ---
        # Require at least 10 history points before declaring RAPIDLY_DEGRADING to
        # prevent the 2-point fresh-load case (a single 0.1-pt dip) from producing
        # a large apparent rate and triggering a misleading urgent label on startup.
        if rate_per_hr > 3.0 and n >= 10:
            trend = "RAPIDLY_DEGRADING"
            trend_label = "Rapidly Degrading"
        elif rate_per_hr > 0.5:
            trend = "DEGRADING"
            trend_label = "Degrading"
        elif rate_per_hr < -0.5:
            trend = "IMPROVING"
            trend_label = "Recovering"
        else:
            trend = "STABLE"
            trend_label = "Stable"

        # --- Confidence: how reliable is the projection? ---
        n = len(health_history)
        if n >= 40 and abs(slope_per_s) > 1e-6:
            confidence = "HIGH"
        elif n >= 15:
            confidence = "MEDIUM"
        else:
            confidence = "LOW"

        # --- Urgency label ---
        if cascade_triggered:
            urgency = "EMERGENCY"
        elif time_to_critical_hr is not None and time_to_critical_hr < 1.0:
            urgency = "CRITICAL"
        elif time_to_critical_hr is not None and time_to_critical_hr < 6.0:
            urgency = "HIGH"
        elif time_to_warning_hr is not None and time_to_warning_hr < 12.0:
            urgency = "MEDIUM"
        elif rate_per_hr > 0.5:
            urgency = "LOW"
        else:
            urgency = "NOMINAL"

        return {
            "degradation_rate_per_sim_hr": round(rate_per_hr, 3),
            "trend": trend,
            "trend_label": trend_label,
            "confidence": confidence,
            "urgency": urgency,
            "current_health_score": round(current_score, 1),
            "time_to_warning_sim_hrs": round(time_to_warning_hr, 1) if time_to_warning_hr is not None else None,
            "time_to_critical_sim_hrs": round(time_to_critical_hr, 1) if time_to_critical_hr is not None else None,
            "projected_no_action": {
                "24h": projected_24h,
                "48h": projected_48h,
                "72h": projected_72h,
            },
            "projected_intervention_70pct_load": {
                "24h": project_intervention(24.0),
                "48h": project_intervention(48.0),
                "72h": project_intervention(72.0),
                "time_to_critical_sim_hrs": round(intervention_time_to_critical, 1) if intervention_time_to_critical is not None else None,
            },
            "thermal_fatigue": {
                "score": round(thermal_fatigue_score, 4),
                "pct": round(thermal_fatigue_score * 100, 1),
                "label": _fatigue_label(thermal_fatigue_score),
                "description": _fatigue_description(thermal_fatigue_score),
            },
            "cascade_triggered": cascade_triggered,
            "history_points": n,
        }

    def _insufficient_data(
        self,
        current_score: float,
        thermal_fatigue_score: float,
        cascade_triggered: bool,
    ) -> dict:
        """Return a minimal response when there's insufficient history.

        Args:
            current_score: Current health score.
            thermal_fatigue_score: Current fatigue level.
            cascade_triggered: Whether cascade is active.

        Returns:
            Prognostics dict with null projections.
        """
        return {
            "degradation_rate_per_sim_hr": 0.0,
            "trend": "STABLE",
            "trend_label": "Stable",
            "confidence": "INSUFFICIENT_DATA",
            "urgency": "EMERGENCY" if cascade_triggered else "NOMINAL",
            "current_health_score": round(current_score, 1),
            "time_to_warning_sim_hrs": None,
            "time_to_critical_sim_hrs": None,
            "projected_no_action": {"24h": None, "48h": None, "72h": None},
            "projected_intervention_70pct_load": {
                "24h": None, "48h": None, "72h": None,
                "time_to_critical_sim_hrs": None,
            },
            "thermal_fatigue": {
                "score": round(thermal_fatigue_score, 4),
                "pct": round(thermal_fatigue_score * 100, 1),
                "label": _fatigue_label(thermal_fatigue_score),
                "description": _fatigue_description(thermal_fatigue_score),
            },
            "cascade_triggered": cascade_triggered,
            "history_points": 0,
        }


# ---------------------------------------------------------------------------
# Fatigue label helpers
# ---------------------------------------------------------------------------


def _fatigue_label(score: float) -> str:
    """Human-readable label for fatigue level.

    Args:
        score: Normalised fatigue score (0.0–1.0).

    Returns:
        Short label string.
    """
    if score < 0.05:
        return "Negligible"
    if score < 0.20:
        return "Low"
    if score < 0.50:
        return "Moderate"
    if score < 0.80:
        return "High"
    return "Severe"


def _fatigue_description(score: float) -> str:
    """Explanatory description for fatigue level.

    Args:
        score: Normalised fatigue score (0.0–1.0).

    Returns:
        One-line description string.
    """
    if score < 0.05:
        return "Minimal accumulated thermal stress — insulation age unaffected"
    if score < 0.20:
        return "Mild accumulated thermal stress — some insulation aging, routine monitoring"
    if score < 0.50:
        return "Moderate thermal fatigue — schedule furanic compound oil test to assess insulation DP"
    if score < 0.80:
        return "High thermal fatigue — significant insulation aging; internal inspection recommended"
    return "Severe thermal fatigue — insulation life critically reduced; plan replacement or major overhaul"
