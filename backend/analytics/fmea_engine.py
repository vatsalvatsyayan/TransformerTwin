"""
TransformerTwin — FMEA (Failure Mode and Effects Analysis) engine.

Matches observed sensor deviations to known failure mode patterns
and computes a match score for each.

Phase 2.3: all 8 failure modes from docs/FMEA_DEFINITIONS.md.
"""

import logging

from config import (
    FMEA_MIN_REPORT_SCORE,
    FMEA_CONFIDENCE_POSSIBLE,
    FMEA_CONFIDENCE_PROBABLE,
)
from models.schemas import TransformerState

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Scoring helper functions (from docs/FMEA_DEFINITIONS.md)
# ---------------------------------------------------------------------------


def _threshold_score(value: float, caution: float, warning: float, critical: float) -> float:
    """Score 0.0 (normal) → 1.0 (critical) based on threshold levels.

    Returns 0.0 below caution, interpolates to 0.5 at warning, 1.0 at/above critical.

    Args:
        value: Sensor reading.
        caution: CAUTION threshold.
        warning: WARNING threshold.
        critical: CRITICAL threshold.

    Returns:
        Float in [0.0, 1.0].
    """
    if value < caution:
        return 0.0
    if value >= critical:
        return 1.0
    if value >= warning:
        return 0.5 + 0.5 * (value - warning) / (critical - warning)
    return 0.5 * (value - caution) / (warning - caution)


def _inverse_threshold_score(value: float, caution: float, warning: float, critical: float) -> float:
    """Score for sensors where lower values are worse (e.g. OIL_DIELECTRIC).

    Args:
        value: Sensor reading.
        caution: CAUTION threshold (lower than normal = worse).
        warning: WARNING threshold.
        critical: CRITICAL threshold (lowest).

    Returns:
        Float in [0.0, 1.0].
    """
    return _threshold_score(-value, -caution, -warning, -critical)


def _confidence_label(score: float) -> str:
    """Convert match_score to FMEA confidence label.

    Args:
        score: Match score in [0.0, 1.0].

    Returns:
        "Probable", "Possible", or "Monitoring".
    """
    if score >= FMEA_CONFIDENCE_PROBABLE:
        return "Probable"
    if score >= FMEA_CONFIDENCE_POSSIBLE:
        return "Possible"
    return "Monitoring"


# ---------------------------------------------------------------------------
# Per-failure-mode evidence evidence evaluators
# ---------------------------------------------------------------------------


def _score_fm_001(state: TransformerState, dga: dict) -> tuple[float, list[dict]]:
    """FM-001: Winding Hot Spot.

    Args:
        state: Current transformer state.
        dga: DGA analysis result dict.

    Returns:
        (match_score, evidence_list) tuple.
    """
    duval_zone = dga.get("duval", {}).get("zone", "NONE") if dga else "NONE"

    # Use expected_winding_temp from IEC 60076-7 physics model (populated by engine).
    # This enables early FM-001 detection when winding exceeds the model prediction
    # even before absolute caution thresholds (90°C) are reached — e.g. a hot_spot
    # scenario at Stage 2 with winding 75°C vs. model 35°C (114% deviation).
    expected_winding = getattr(state, "expected_winding_temp", 0.0)
    if expected_winding > 5.0 and state.winding_temp > expected_winding:
        dev_pct = (state.winding_temp - expected_winding) / max(expected_winding, 1.0) * 100.0
    else:
        dev_pct = 0.0

    e1 = _threshold_score(state.winding_temp, 90.0, 105.0, 120.0)
    e2 = min(1.0, dev_pct / 100.0)  # 100% above physics model = full score; 50% = 0.5
    e3 = _threshold_score(state.dga_c2h4, 50.0, 200.0, 600.0)
    e4 = _threshold_score(state.dga_ch4, 75.0, 200.0, 600.0)
    e5 = 1.0 if duval_zone in {"T1", "T2", "T3"} else 0.0

    weights = [0.35, 0.25, 0.20, 0.10, 0.10]
    scores  = [e1,   e2,   e3,   e4,   e5  ]
    match_score = sum(s * w for s, w in zip(scores, weights))

    evidence = [
        {"condition": f"Winding temperature {state.winding_temp:.1f}°C (caution 90°C)", "matched": e1 > 0, "value": f"{state.winding_temp:.1f}°C"},
        {"condition": f"Winding {dev_pct:.0f}% above physics model ({expected_winding:.1f}°C expected)", "matched": e2 > 0, "value": f"{dev_pct:.1f}%"},
        {"condition": f"Ethylene elevated {state.dga_c2h4:.1f}ppm (caution 50ppm)", "matched": e3 > 0, "value": f"{state.dga_c2h4:.1f}ppm"},
        {"condition": f"Methane elevated {state.dga_ch4:.1f}ppm (caution 75ppm)", "matched": e4 > 0, "value": f"{state.dga_ch4:.1f}ppm"},
        {"condition": f"Duval zone is thermal (current: {duval_zone})", "matched": e5 > 0, "value": duval_zone},
    ]
    return match_score, evidence


def _score_fm_002(state: TransformerState, dga: dict) -> tuple[float, list[dict]]:
    """FM-002: Paper Insulation Degradation.

    Args:
        state: Current transformer state.
        dga: DGA analysis result dict.

    Returns:
        (match_score, evidence_list) tuple.
    """
    ratio = state.dga_co2 / max(state.dga_co, 0.1)
    e1 = _threshold_score(state.dga_co,  350.0, 900.0, 1800.0)
    e2 = _threshold_score(state.dga_co2, 2500.0, 4000.0, 9000.0)
    e3 = 1.0 if ratio < 5.0 or ratio > 13.0 else 0.0
    e4 = _threshold_score(state.winding_temp, 85.0, 100.0, 115.0)
    e5 = _threshold_score(state.oil_moisture, 15.0, 25.0, 35.0)

    weights = [0.30, 0.25, 0.20, 0.15, 0.10]
    scores  = [e1,   e2,   e3,   e4,   e5  ]
    match_score = sum(s * w for s, w in zip(scores, weights))

    evidence = [
        {"condition": f"CO elevated {state.dga_co:.1f}ppm (caution 350ppm)", "matched": e1 > 0, "value": f"{state.dga_co:.1f}ppm"},
        {"condition": f"CO2 elevated {state.dga_co2:.1f}ppm (caution 2500ppm)", "matched": e2 > 0, "value": f"{state.dga_co2:.1f}ppm"},
        {"condition": f"CO2/CO ratio {ratio:.1f} (normal 5–13)", "matched": e3 > 0, "value": f"{ratio:.1f}"},
        {"condition": f"Winding temp {state.winding_temp:.1f}°C (caution 85°C)", "matched": e4 > 0, "value": f"{state.winding_temp:.1f}°C"},
        {"condition": f"Oil moisture {state.oil_moisture:.1f}ppm (caution 15ppm)", "matched": e5 > 0, "value": f"{state.oil_moisture:.1f}ppm"},
    ]
    return match_score, evidence


def _score_fm_003(state: TransformerState, dga: dict, anomaly: dict) -> tuple[float, list[dict]]:
    """FM-003: Arcing Event.

    Args:
        state: Current transformer state.
        dga: DGA analysis result dict.
        anomaly: Anomaly result dict with trends.

    Returns:
        (match_score, evidence_list) tuple.
    """
    duval_zone = dga.get("duval", {}).get("zone", "NONE") if dga else "NONE"
    gas_rates = dga.get("gas_rates", {}) if dga else {}
    c2h2_trend = gas_rates.get("DGA_C2H2", {}).get("trend", "STABLE")

    e1 = _threshold_score(state.dga_c2h2, 1.0, 35.0, 200.0)
    e2 = _threshold_score(state.dga_h2, 100.0, 700.0, 1800.0)
    e3 = 1.0 if duval_zone in {"D1", "D2", "DT"} else 0.0
    e4 = 1.0 if c2h2_trend == "RISING" else 0.0

    weights = [0.45, 0.25, 0.20, 0.10]
    scores  = [e1,   e2,   e3,   e4  ]
    match_score = sum(s * w for s, w in zip(scores, weights))

    evidence = [
        {"condition": f"Acetylene present {state.dga_c2h2:.1f}ppm (caution 1ppm)", "matched": e1 > 0, "value": f"{state.dga_c2h2:.1f}ppm"},
        {"condition": f"Hydrogen elevated {state.dga_h2:.1f}ppm (caution 100ppm)", "matched": e2 > 0, "value": f"{state.dga_h2:.1f}ppm"},
        {"condition": f"Duval zone is discharge (current: {duval_zone})", "matched": e3 > 0, "value": duval_zone},
        {"condition": f"C2H2 trend: {c2h2_trend}", "matched": e4 > 0, "value": c2h2_trend},
    ]
    return match_score, evidence


def _score_fm_004(state: TransformerState, dga: dict) -> tuple[float, list[dict]]:
    """FM-004: Partial Discharge.

    Args:
        state: Current transformer state.
        dga: DGA analysis result dict.

    Returns:
        (match_score, evidence_list) tuple.
    """
    duval_zone = dga.get("duval", {}).get("zone", "NONE") if dga else "NONE"
    e1 = _threshold_score(state.dga_h2, 100.0, 700.0, 1800.0)
    e2 = _threshold_score(state.dga_ch4, 75.0, 200.0, 600.0)
    e3 = 1.0 if duval_zone == "PD" else 0.0
    e4 = 1.0 - _threshold_score(state.dga_c2h2, 1.0, 35.0, 200.0)  # inverse: low C2H2 = PD

    weights = [0.40, 0.25, 0.20, 0.15]
    scores  = [e1,   e2,   e3,   e4  ]
    match_score = sum(s * w for s, w in zip(scores, weights))

    evidence = [
        {"condition": f"Hydrogen elevated {state.dga_h2:.1f}ppm (primary PD indicator)", "matched": e1 > 0, "value": f"{state.dga_h2:.1f}ppm"},
        {"condition": f"Methane present {state.dga_ch4:.1f}ppm", "matched": e2 > 0, "value": f"{state.dga_ch4:.1f}ppm"},
        {"condition": f"Duval zone is PD (current: {duval_zone})", "matched": e3 > 0, "value": duval_zone},
        {"condition": f"Acetylene absent {state.dga_c2h2:.1f}ppm (confirms PD not arc)", "matched": e4 > 0, "value": f"{state.dga_c2h2:.1f}ppm"},
    ]
    return match_score, evidence


def _score_fm_005(state: TransformerState, dga: dict) -> tuple[float, list[dict]]:
    """FM-005: Oil Degradation.

    Args:
        state: Current transformer state.
        dga: DGA analysis result dict.

    Returns:
        (match_score, evidence_list) tuple.
    """
    e1 = _inverse_threshold_score(state.oil_dielectric, 45.0, 40.0, 30.0)
    e2 = _threshold_score(state.oil_moisture, 15.0, 25.0, 35.0)
    e3 = _threshold_score(state.top_oil_temp, 75.0, 85.0, 95.0)
    e4 = _threshold_score(state.dga_co2, 2500.0, 4000.0, 9000.0)

    weights = [0.35, 0.30, 0.20, 0.15]
    scores  = [e1,   e2,   e3,   e4  ]
    match_score = sum(s * w for s, w in zip(scores, weights))

    evidence = [
        {"condition": f"Oil dielectric {state.oil_dielectric:.1f}kV (caution <45kV)", "matched": e1 > 0, "value": f"{state.oil_dielectric:.1f}kV"},
        {"condition": f"Oil moisture {state.oil_moisture:.1f}ppm (caution 15ppm)", "matched": e2 > 0, "value": f"{state.oil_moisture:.1f}ppm"},
        {"condition": f"Top oil temp {state.top_oil_temp:.1f}°C (caution 75°C)", "matched": e3 > 0, "value": f"{state.top_oil_temp:.1f}°C"},
        {"condition": f"CO2 elevated {state.dga_co2:.1f}ppm (oil oxidation marker)", "matched": e4 > 0, "value": f"{state.dga_co2:.1f}ppm"},
    ]
    return match_score, evidence


def _score_fm_006(state: TransformerState, anomaly: dict) -> tuple[float, list[dict]]:
    """FM-006: Cooling System Failure.

    Args:
        state: Current transformer state.
        anomaly: Anomaly result dict with trends.

    Returns:
        (match_score, evidence_list) tuple.
    """
    # Expected top-oil rise under ONAN at current load
    expected_rise = 55.0 * (state.load_current / 100.0) ** 1.6
    actual_rise = state.top_oil_temp - state.ambient_temp
    e1 = max(0.0, min(1.0, (actual_rise - expected_rise) / 30.0))

    fan1 = 1.0 if state.fan_bank_1 else 0.0
    fan2 = 1.0 if state.fan_bank_2 else 0.0
    e2 = 1.0 if (state.top_oil_temp > 75.0 and fan1 < 0.5 and fan2 < 0.5) else 0.0

    pump = 1.0 if state.oil_pump_1 else 0.0
    e3 = 1.0 if (state.load_current > 80.0 and pump < 0.5) else 0.0

    trends = anomaly.get("trends", {}) if anomaly else {}
    top_oil_trend = trends.get("TOP_OIL_TEMP", "STABLE")
    e4 = 1.0 if (top_oil_trend == "RISING" and state.top_oil_temp > 70.0) else 0.0

    weights = [0.40, 0.30, 0.20, 0.10]
    scores  = [e1,   e2,   e3,   e4  ]
    match_score = sum(s * w for s, w in zip(scores, weights))

    evidence = [
        {"condition": f"Oil rise {actual_rise:.1f}°C vs expected {expected_rise:.1f}°C for load", "matched": e1 > 0, "value": f"{actual_rise:.1f}°C vs {expected_rise:.1f}°C"},
        {"condition": f"Fans off at {state.top_oil_temp:.1f}°C (fans: {bool(fan1)}/{bool(fan2)})", "matched": e2 > 0, "value": f"Fan1={bool(fan1)} Fan2={bool(fan2)}"},
        {"condition": f"Pump off at {state.load_current:.1f}% load", "matched": e3 > 0, "value": f"Pump={bool(pump)} Load={state.load_current:.1f}%"},
        {"condition": f"Top oil trending {top_oil_trend} above 70°C", "matched": e4 > 0, "value": top_oil_trend},
    ]
    return match_score, evidence


def _score_fm_007(state: TransformerState) -> tuple[float, list[dict]]:
    """FM-007: OLTC (On-Load Tap Changer) Wear.

    Args:
        state: Current transformer state.

    Returns:
        (match_score, evidence_list) tuple.
    """
    e1 = min(1.0, state.tap_op_count / 50000.0)
    e2 = _threshold_score(state.dga_c2h2, 1.0, 10.0, 35.0)
    e3 = _threshold_score(state.dga_h2, 50.0, 200.0, 700.0)
    e4 = _threshold_score(state.bushing_cap_hv, 525.0, 550.0, 600.0)

    weights = [0.35, 0.25, 0.20, 0.20]
    scores  = [e1,   e2,   e3,   e4  ]
    match_score = sum(s * w for s, w in zip(scores, weights))

    evidence = [
        {"condition": f"Tap operation count {state.tap_op_count:,} (threshold 50,000)", "matched": e1 > 0, "value": f"{state.tap_op_count:,}"},
        {"condition": f"Trace acetylene {state.dga_c2h2:.1f}ppm (contact arcing indicator)", "matched": e2 > 0, "value": f"{state.dga_c2h2:.1f}ppm"},
        {"condition": f"Trace hydrogen {state.dga_h2:.1f}ppm (caution 50ppm)", "matched": e3 > 0, "value": f"{state.dga_h2:.1f}ppm"},
        {"condition": f"HV bushing capacitance {state.bushing_cap_hv:.1f}pF (caution 525pF)", "matched": e4 > 0, "value": f"{state.bushing_cap_hv:.1f}pF"},
    ]
    return match_score, evidence


def _score_fm_008(state: TransformerState, dga: dict) -> tuple[float, list[dict]]:
    """FM-008: Bushing Deterioration.

    Args:
        state: Current transformer state.
        dga: DGA analysis result dict.

    Returns:
        (match_score, evidence_list) tuple.
    """
    duval_zone = dga.get("duval", {}).get("zone", "NONE") if dga else "NONE"
    e1 = _threshold_score(state.bushing_cap_hv, 525.0, 550.0, 600.0)
    e2 = _threshold_score(state.bushing_cap_lv, 441.0, 462.0, 504.0)
    e3 = _threshold_score(state.dga_h2, 100.0, 700.0, 1800.0)
    e4 = 1.0 if duval_zone == "PD" else 0.0

    weights = [0.40, 0.30, 0.20, 0.10]
    scores  = [e1,   e2,   e3,   e4  ]
    match_score = sum(s * w for s, w in zip(scores, weights))

    evidence = [
        {"condition": f"HV bushing capacitance {state.bushing_cap_hv:.1f}pF (nominal 500pF)", "matched": e1 > 0, "value": f"{state.bushing_cap_hv:.1f}pF"},
        {"condition": f"LV bushing capacitance {state.bushing_cap_lv:.1f}pF (nominal 420pF)", "matched": e2 > 0, "value": f"{state.bushing_cap_lv:.1f}pF"},
        {"condition": f"Hydrogen elevated {state.dga_h2:.1f}ppm (PD in bushing)", "matched": e3 > 0, "value": f"{state.dga_h2:.1f}ppm"},
        {"condition": f"Duval zone is PD (current: {duval_zone})", "matched": e4 > 0, "value": duval_zone},
    ]
    return match_score, evidence


# ---------------------------------------------------------------------------
# Recommended actions per failure mode
# ---------------------------------------------------------------------------

_RECOMMENDED_ACTIONS: dict[str, list[str]] = {
    "FM-001": [
        "Reduce transformer load to 70% or below",
        "Verify cooling system is fully operational",
        "Schedule thermal imaging inspection within 24 hours",
        "Increase DGA sampling frequency to daily",
    ],
    "FM-002": [
        "Review transformer loading history",
        "Schedule oil sampling for furanic compounds (paper degradation markers)",
        "Assess remaining insulation life",
        "Consider planned outage for internal inspection",
    ],
    "FM-003": [
        "Immediate load reduction",
        "Prepare for emergency shutdown if C2H2 > 200 ppm",
        "Emergency oil sampling and analysis",
        "Contact manufacturer for assessment",
    ],
    "FM-004": [
        "Increase DGA monitoring frequency",
        "Schedule ultrasonic partial discharge detection test",
        "Review transformer insulation age",
        "Consult condition monitoring specialist",
    ],
    "FM-005": [
        "Schedule oil testing (acid number, interfacial tension, color)",
        "Plan oil filtration or replacement",
        "Check breather/desiccant condition",
        "Inspect tank for moisture ingress points",
    ],
    "FM-006": [
        "Inspect Fan Bank 1 and Fan Bank 2 operation",
        "Check oil pump operation",
        "Reduce load until cooling is restored",
        "Dispatch maintenance team for cooling system inspection",
    ],
    "FM-007": [
        "Schedule OLTC inspection and contact resistance test",
        "Review tap operation count against maintenance schedule",
        "Increase DGA monitoring frequency",
        "Plan OLTC overhaul at next scheduled outage",
    ],
    "FM-008": [
        "Schedule power factor / tan-delta bushing test",
        "Inspect bushing oil level and condition",
        "Monitor continuously — bushing failure can be sudden",
        "Plan bushing replacement at next outage if drift exceeds 10%",
    ],
}

_AFFECTED_COMPONENTS: dict[str, list[str]] = {
    "FM-001": ["winding_temp", "dga"],
    "FM-002": ["dga", "oil_quality", "winding_temp"],
    "FM-003": ["dga"],
    "FM-004": ["dga", "bushing"],
    "FM-005": ["oil_quality", "oil_temp"],
    "FM-006": ["cooling", "oil_temp"],
    "FM-007": ["bushing", "dga"],
    "FM-008": ["bushing", "dga"],
}


class FMEAEngine:
    """Matches current sensor state to failure mode signatures.

    Each failure mode has a set of evidence conditions. The engine
    evaluates which conditions are met and computes a match score.
    """

    def evaluate(
        self,
        state: TransformerState,
        dga_analysis: dict | None = None,
        anomalies: list[dict] | None = None,
    ) -> list[dict]:
        """Evaluate all failure modes against current state.

        Args:
            state: Current transformer simulation state.
            dga_analysis: Result from DGAAnalyzer.analyze() (optional).
            anomalies: Result from AnomalyDetector.evaluate() (optional).

        Returns:
            List of active mode dicts (score >= FMEA_MIN_REPORT_SCORE),
            sorted by match_score descending. Matches FMEAActiveModeSchema.
        """
        dga = dga_analysis or {}

        # Build a trend map from anomaly results
        anomaly_trends: dict[str, str] = {}
        if anomalies:
            for a in anomalies:
                sid = a.get("sensor_id", "")
                trend = a.get("trend", "STABLE")
                anomaly_trends[sid] = trend
        anomaly_ctx = {"trends": anomaly_trends}

        evaluations = [
            ("FM-001", "Winding Hot Spot",            *_score_fm_001(state, dga)),
            ("FM-002", "Paper Insulation Degradation", *_score_fm_002(state, dga)),
            ("FM-003", "Arcing Event",                *_score_fm_003(state, dga, anomaly_ctx)),
            ("FM-004", "Partial Discharge",           *_score_fm_004(state, dga)),
            ("FM-005", "Oil Degradation",             *_score_fm_005(state, dga)),
            ("FM-006", "Cooling System Failure",      *_score_fm_006(state, anomaly_ctx)),
            ("FM-007", "OLTC Wear",                   *_score_fm_007(state)),
            ("FM-008", "Bushing Deterioration",       *_score_fm_008(state, dga)),
        ]

        results: list[dict] = []
        for fm_id, name, score, evidence in evaluations:
            if score < FMEA_MIN_REPORT_SCORE:
                continue

            score_rounded = round(score, 3)
            confidence = _confidence_label(score_rounded)

            # Severity: 1 = Monitoring, 2 = Possible, 3 = Probable
            if confidence == "Probable":
                severity = 3
            elif confidence == "Possible":
                severity = 2
            else:
                severity = 1

            results.append({
                "id": fm_id,
                "name": name,
                "match_score": score_rounded,
                "confidence_label": confidence,
                "severity": severity,
                "affected_components": _AFFECTED_COMPONENTS.get(fm_id, []),
                "evidence": evidence,
                "recommended_actions": _RECOMMENDED_ACTIONS.get(fm_id, []),
                "development_time": "Active",  # simplified; could track onset time
            })

        # Sort by match_score descending
        results.sort(key=lambda m: m["match_score"], reverse=True)
        return results
