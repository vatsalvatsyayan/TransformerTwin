"""
TransformerTwin — Decision Engine.

Translates sensor data and analytics results into prescriptive recommendations:
- Asset risk level (LOW / MEDIUM / HIGH / CRITICAL)
- Remaining useful life estimate (hours to maintenance threshold)
- Economic impact analysis (act now vs. delay vs. ignore)
- Operator runbooks (step-by-step procedures per active failure mode)

This is the "so what?" layer — turning monitoring data into business decisions.
"""

import logging
import math

from config import (
    AGING_ARRHENIUS_K,
    AGING_REFERENCE_TEMP_C,
    DECISION_RISK_LOW,
    DECISION_RISK_MEDIUM,
    DECISION_RISK_HIGH,
    DECISION_ACT_NOW_THRESHOLD_HRS,
    ECONOMIC_TRANSFORMER_REPLACEMENT_USD,
    ECONOMIC_OUTAGE_COST_PER_DAY_USD,
    ECONOMIC_PLANNED_MAINTENANCE_USD,
    ECONOMIC_MAINTENANCE_PRODUCTION_LOSS_PER_HR_USD,
    ECONOMIC_MAINTENANCE_WINDOW_HRS,
    ECONOMIC_DELAYED_ESCALATION_FACTOR,
    ECONOMIC_EMERGENCY_REPAIR_HRS,
    ECONOMIC_REPLACEMENT_OUTAGE_DAYS,
)
from models.schemas import TransformerState

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Operator Runbooks — step-by-step field procedures per failure mode.
# These map directly to real utility standard operating procedures (SOPs).
# ---------------------------------------------------------------------------

_RUNBOOKS: dict[str, dict] = {
    "FM-001": {
        "title": "Winding Hot Spot Response",
        "procedure_id": "OP-TRF-004",
        "urgency_hours": 72,
        "steps": [
            "Reduce transformer load to 70% of rated capacity immediately",
            "Verify Fan Bank 1 and Fan Bank 2 are both running (check local control panel)",
            "If fans are not running: escalate to Cooling System Failure procedure (OP-TRF-006)",
            "Notify shift supervisor and control room (ext. 4421)",
            "Log event in CMMS: Category=TRF-THERMAL, Asset=TRF-001, Priority=HIGH",
            "Dispatch oil sampling crew — DGA analysis required within 4 hours",
            "If winding temp > 120°C or C2H4 > 400 ppm: initiate planned outage within 24 hours",
            "Schedule thermal imaging inspection of tank exterior within 48 hours",
        ],
    },
    "FM-002": {
        "title": "Paper Insulation Degradation Response",
        "procedure_id": "OP-TRF-007",
        "urgency_hours": 168,  # 7 days
        "steps": [
            "Review transformer loading history for sustained overloads (last 30 days)",
            "Schedule oil sampling for furanic compound analysis (DP test within 72 hours)",
            "Calculate CO2/CO ratio trend — if ratio < 5.0, escalate urgency",
            "Reduce average loading to 80% or below to slow paper degradation",
            "Contact asset manager to assess remaining insulation life",
            "Book thermovision inspection to locate hot spots",
            "Evaluate scheduling planned outage for internal inspection within 30 days",
        ],
    },
    "FM-003": {
        "title": "Arcing Event Emergency Response",
        "procedure_id": "OP-TRF-002",
        "urgency_hours": 4,
        "steps": [
            "IMMEDIATE: Reduce load to minimum (<40% rated)",
            "Verify Buchholz relay has not tripped — check indicator",
            "Call transformer engineer and operations manager immediately",
            "Initiate emergency oil sampling — C2H2 gas ratio is critical indicator",
            "If C2H2 > 200 ppm: prepare for emergency controlled shutdown",
            "Do NOT re-energize without engineering approval if protection has operated",
            "Prepare alternative supply routing to maintain grid stability",
            "Contact equipment manufacturer for emergency technical support",
        ],
    },
    "FM-004": {
        "title": "Partial Discharge Investigation",
        "procedure_id": "OP-TRF-009",
        "urgency_hours": 120,  # 5 days
        "steps": [
            "Increase DGA monitoring frequency to daily oil sampling",
            "Schedule ultrasonic partial discharge (PD) detection test within 5 days",
            "Review transformer insulation age and historical DGA trend",
            "Check bushing capacitance readings for drift (>5% from nameplate)",
            "Reduce loading to 85% or below to minimize electrical stress",
            "Consult condition monitoring specialist for PD test interpretation",
            "If H2 trend is accelerating: escalate to emergency inspection",
        ],
    },
    "FM-005": {
        "title": "Oil Degradation Management",
        "procedure_id": "OP-TRF-010",
        "urgency_hours": 240,  # 10 days
        "steps": [
            "Schedule comprehensive oil testing: acid number, interfacial tension, color index",
            "Check transformer breather/desiccant — replace if saturated",
            "Inspect all tank seals, gaskets, and valves for moisture ingress points",
            "Plan oil filtration (reclamation) or full oil replacement",
            "Review oil service history — when was last oil replacement?",
            "If dielectric strength < 35 kV: immediate oil replacement or filtration required",
        ],
    },
    "FM-006": {
        "title": "Cooling System Failure Response",
        "procedure_id": "OP-TRF-006",
        "urgency_hours": 8,
        "steps": [
            "Dispatch maintenance crew to inspect Fan Bank 1 and Fan Bank 2 immediately",
            "Check fan motor circuit breakers and contactor operation",
            "Verify oil pump operation (if OFAF cooling mode required)",
            "Reduce transformer load to 60% or below until cooling is restored",
            "Check cooling control panel for fault indicators",
            "If both fan banks fail: consider emergency load transfer to backup transformer",
            "Log all fan start/stop times and circuit breaker states",
            "Test cooling system once repaired before returning to full load",
        ],
    },
    "FM-007": {
        "title": "OLTC Wear Maintenance",
        "procedure_id": "OP-TRF-008",
        "urgency_hours": 336,  # 14 days
        "steps": [
            "Review tap operation count against manufacturer maintenance schedule",
            "Schedule OLTC contact resistance test and dynamic resistance measurement",
            "Check OLTC oil compartment for C2H2 contamination (separate DGA)",
            "Plan OLTC overhaul at next available scheduled outage",
            "Increase DGA monitoring frequency for OLTC-specific gases",
            "Verify OLTC drive motor and mechanism operation is smooth",
        ],
    },
    "FM-008": {
        "title": "Bushing Deterioration Investigation",
        "procedure_id": "OP-TRF-011",
        "urgency_hours": 96,  # 4 days
        "steps": [
            "Schedule power factor (tan-delta) bushing test within 4 days",
            "Visually inspect bushings for cracks, contamination, or oil leaks",
            "Check bushing oil level sight glass on OIP (oil-impregnated paper) bushings",
            "Compare capacitance readings to nameplate and last test values",
            "If capacitance drift > 10% from nominal: immediate replacement planning",
            "WARNING: Bushing failure can be sudden and catastrophic — treat with urgency",
            "Ensure protection settings are correctly applied for bushing fault scenarios",
        ],
    },
}

# ---------------------------------------------------------------------------
# Risk computation
# ---------------------------------------------------------------------------


def _compute_risk_score(
    health_score: float,
    fmea_results: list[dict],
    anomalies: list[dict],
) -> float:
    """Compute a composite risk score in [0.0, 1.0].

    Combines health score degradation, FMEA confidence, and anomaly severity
    into a single risk metric for decision-making.

    Args:
        health_score: Current overall health score (0–100).
        fmea_results: Active FMEA failure modes (sorted by match_score desc).
        anomalies: Current anomalies from AnomalyDetector.

    Returns:
        Float in [0.0, 1.0] — higher is more risky.
    """
    # Component 1: health score degradation (weight 0.40)
    health_risk = max(0.0, (100.0 - health_score) / 100.0)

    # Component 2: FMEA confidence (weight 0.40)
    fmea_risk = 0.0
    if fmea_results:
        # Take the top FMEA mode's match score as the primary driver
        top_score = fmea_results[0]["match_score"]
        fmea_risk = min(1.0, top_score)

    # Component 3: anomaly severity (weight 0.20)
    anomaly_risk = 0.0
    if anomalies:
        severity_map = {"CAUTION": 0.3, "WARNING": 0.6, "CRITICAL": 1.0}
        max_severity = max(severity_map.get(a.get("status", "CAUTION"), 0.0) for a in anomalies)
        anomaly_risk = max_severity

    composite = 0.40 * health_risk + 0.40 * fmea_risk + 0.20 * anomaly_risk
    return min(1.0, composite)


def _risk_level_label(risk_score: float) -> str:
    """Map risk score to human-readable level label.

    Args:
        risk_score: Float in [0.0, 1.0].

    Returns:
        "LOW", "MEDIUM", "HIGH", or "CRITICAL".
    """
    if risk_score >= DECISION_RISK_HIGH:
        return "CRITICAL" if risk_score >= 0.85 else "HIGH"
    if risk_score >= DECISION_RISK_MEDIUM:
        return "MEDIUM"
    if risk_score >= DECISION_RISK_LOW:
        return "LOW"
    return "NOMINAL"


# ---------------------------------------------------------------------------
# Remaining Useful Life estimation
# ---------------------------------------------------------------------------


def _estimate_rul_hours(
    health_score: float,
    risk_score: float,
    state: TransformerState,
    fmea_results: list[dict],
) -> float:
    """Estimate remaining hours until maintenance action threshold is reached.

    Uses a combination of:
    1. Health score trajectory (how fast health is falling)
    2. Winding temperature Arrhenius aging (IEC 60076-7)
    3. FMEA confidence escalation rate

    Args:
        health_score: Current overall health score (0–100).
        risk_score: Composite risk score (0.0–1.0).
        state: Current transformer state (for Arrhenius calc).
        fmea_results: Active FMEA failure modes.

    Returns:
        Estimated hours remaining to DECISION_ACT_NOW_THRESHOLD.
        Returns 9999 if system is nominal.
    """
    if health_score >= 90.0 and risk_score < DECISION_RISK_LOW:
        return 9999.0

    # Arrhenius aging rate at current winding temperature
    # V = exp(K × (θ_H - θ_ref)) per IEC 60076-7 Annex A
    winding_temp = getattr(state, "winding_temp", 85.0)
    aging_rate = math.exp(AGING_ARRHENIUS_K * (winding_temp - AGING_REFERENCE_TEMP_C))
    # Normalize: at reference temp (98°C) aging_rate = 1.0 (normal life consumption)
    # At 120°C: aging_rate ≈ 13.5× (life consumed 13.5× faster)

    # Base RUL: how many hours at current aging rate until health reaches 70 (action threshold)
    # Simple model: degradation rate scales with risk_score and aging_rate
    health_margin = max(0.0, health_score - 70.0)  # How far above action threshold

    # Degradation rate: hours to lose 1 health point
    # At nominal (aging_rate=1, risk=0): ~200 hrs/point (very slow normal aging)
    # At high risk (aging_rate=13.5, risk=0.7): ~10 hrs/point
    base_hrs_per_point = 200.0
    degradation_rate = base_hrs_per_point / max(1.0, aging_rate * (1.0 + risk_score * 3.0))

    rul = health_margin * degradation_rate

    # If we have a Probable FMEA mode, apply urgency multiplier
    if fmea_results and fmea_results[0]["confidence_label"] == "Probable":
        rul = rul * 0.3  # Probable fault: much less time

    elif fmea_results and fmea_results[0]["confidence_label"] == "Possible":
        rul = rul * 0.6

    return max(0.0, rul)


# ---------------------------------------------------------------------------
# Economic impact computation
# ---------------------------------------------------------------------------


def _compute_economic_impact(
    risk_score: float,
    rul_hours: float,
    fmea_results: list[dict],
) -> dict:
    """Compute three economic scenarios: act now, delay, failure.

    Args:
        risk_score: Composite risk score.
        rul_hours: Estimated remaining useful life in hours.
        fmea_results: Active FMEA failure modes.

    Returns:
        Dict with "act_now", "act_later", "no_action" cost scenarios.
    """
    # Act Now: planned maintenance cost + small production loss
    maintenance_cost = ECONOMIC_PLANNED_MAINTENANCE_USD
    production_loss = ECONOMIC_MAINTENANCE_PRODUCTION_LOSS_PER_HR_USD * ECONOMIC_MAINTENANCE_WINDOW_HRS
    act_now_total = maintenance_cost + production_loss

    # Act Later (14 days): higher probability of fault escalation
    # If risk is already high, fault escalation probability increases
    fault_escalation_prob = min(0.95, risk_score * 1.2)
    delay_repair_cost = maintenance_cost * ECONOMIC_DELAYED_ESCALATION_FACTOR
    delay_downtime_cost = ECONOMIC_OUTAGE_COST_PER_DAY_USD * (ECONOMIC_EMERGENCY_REPAIR_HRS / 24.0)
    act_later_expected = act_now_total + (fault_escalation_prob * (delay_repair_cost + delay_downtime_cost))
    act_later_total = round(act_later_expected, -2)  # round to nearest $100

    # No Action (failure): replacement + extended outage
    no_action_total = ECONOMIC_TRANSFORMER_REPLACEMENT_USD + (
        ECONOMIC_OUTAGE_COST_PER_DAY_USD * ECONOMIC_REPLACEMENT_OUTAGE_DAYS
    )

    # Potential savings = difference between no_action and act_now
    savings = no_action_total - act_now_total

    return {
        "currency": "USD",
        "act_now": {
            "label": "Act Now (Recommended)",
            "maintenance_cost": int(maintenance_cost),
            "production_loss": int(production_loss),
            "total": int(act_now_total),
            "description": f"Scheduled {int(ECONOMIC_MAINTENANCE_WINDOW_HRS)}-hour maintenance window during off-peak",
        },
        "act_later": {
            "label": "Delay 14 Days",
            "fault_escalation_probability": round(fault_escalation_prob, 2),
            "repair_cost": int(delay_repair_cost),
            "downtime_hours": int(ECONOMIC_EMERGENCY_REPAIR_HRS),
            "downtime_cost": int(delay_downtime_cost),
            "total": int(act_later_total),
            "description": f"{round(fault_escalation_prob * 100)}% probability of fault escalation requiring emergency repair",
        },
        "no_action": {
            "label": "No Action (Failure Risk)",
            "replacement_cost": int(ECONOMIC_TRANSFORMER_REPLACEMENT_USD),
            "outage_days": int(ECONOMIC_REPLACEMENT_OUTAGE_DAYS),
            "outage_cost": int(ECONOMIC_OUTAGE_COST_PER_DAY_USD * ECONOMIC_REPLACEMENT_OUTAGE_DAYS),
            "total": int(no_action_total),
            "description": "Transformer failure requiring emergency replacement and extended grid outage",
        },
        "potential_savings_usd": int(savings),
    }


# ---------------------------------------------------------------------------
# Decision recommendation
# ---------------------------------------------------------------------------


def _build_recommendation(
    risk_level: str,
    rul_hours: float,
    fmea_results: list[dict],
    act_now_cost: int,
    savings: int,
) -> dict:
    """Build the decision recommendation text and urgency.

    Args:
        risk_level: "NOMINAL", "LOW", "MEDIUM", "HIGH", or "CRITICAL".
        rul_hours: Estimated hours remaining.
        fmea_results: Active FMEA failure modes.
        act_now_cost: Cost of acting now (USD).
        savings: Potential savings vs failure scenario (USD).

    Returns:
        Dict with "action", "reasoning", "deadline_hours".
    """
    top_fault = fmea_results[0]["name"] if fmea_results else None
    top_confidence = fmea_results[0]["confidence_label"] if fmea_results else None

    if risk_level in ("HIGH", "CRITICAL"):
        deadline = min(rul_hours, DECISION_ACT_NOW_THRESHOLD_HRS)
        action = f"Schedule maintenance within {int(deadline)} hours"
        reasoning_parts = []
        if top_fault and top_confidence:
            score_pct = round(fmea_results[0]["match_score"] * 100)
            reasoning_parts.append(
                f"{top_fault} has reached {top_confidence} confidence ({score_pct}% match)."
            )
        reasoning_parts.append(
            f"Acting now costs ${act_now_cost:,} and avoids an estimated ${savings:,} in failure costs."
        )
        if rul_hours < 72:
            reasoning_parts.append(f"Estimated {int(rul_hours)} hours to action threshold — time is critical.")
        reasoning = " ".join(reasoning_parts)

    elif risk_level == "MEDIUM":
        deadline = min(rul_hours, 168.0)  # 7 days
        action = "Schedule inspection within 7 days"
        reasoning_parts = []
        if top_fault and top_confidence:
            reasoning_parts.append(f"{top_fault} is at {top_confidence} confidence — monitoring closely.")
        reasoning_parts.append("Condition trending toward fault. Proactive inspection will prevent escalation.")
        reasoning = " ".join(reasoning_parts)

    elif risk_level == "LOW":
        deadline = min(rul_hours, 720.0)  # 30 days
        action = "Increase monitoring frequency, schedule routine inspection within 30 days"
        reasoning = "Early indicators detected. No immediate action required, but continued monitoring is recommended."

    else:
        deadline = 9999.0
        action = "Continue normal monitoring"
        reasoning = "All systems nominal. No action required at this time."

    return {
        "action": action,
        "reasoning": reasoning,
        "deadline_hours": int(deadline) if deadline < 9999 else None,
    }


# ---------------------------------------------------------------------------
# Main public API
# ---------------------------------------------------------------------------


class DecisionEngine:
    """Compute prescriptive decision support from current analytics state."""

    def compute(
        self,
        state: TransformerState,
        health_result: dict,
        fmea_results: list[dict],
        anomalies: list[dict],
    ) -> dict:
        """Produce a complete decision support snapshot.

        Args:
            state: Current transformer state.
            health_result: Latest health score result from HealthScoreCalculator.
            fmea_results: Latest FMEA results from FMEAEngine.
            anomalies: Latest anomalies from AnomalyDetector.

        Returns:
            Decision support dict matching DecisionResponse schema.
        """
        health_score = health_result.get("overall_score", 100.0)

        # Risk assessment
        risk_score = _compute_risk_score(health_score, fmea_results, anomalies)
        risk_level = _risk_level_label(risk_score)

        # Remaining useful life
        rul_hours = _estimate_rul_hours(health_score, risk_score, state, fmea_results)

        # Economic impact
        economic = _compute_economic_impact(risk_score, rul_hours, fmea_results)
        act_now_cost = economic["act_now"]["total"]
        savings = economic["potential_savings_usd"]

        # Decision recommendation
        recommendation = _build_recommendation(
            risk_level, rul_hours, fmea_results, act_now_cost, savings
        )

        # Active runbooks — only for Possible/Probable failure modes
        active_runbooks = []
        for mode in fmea_results:
            if mode["confidence_label"] in ("Possible", "Probable"):
                fm_id = mode["id"]
                if fm_id in _RUNBOOKS:
                    runbook = dict(_RUNBOOKS[fm_id])
                    runbook["failure_mode_id"] = fm_id
                    runbook["confidence_label"] = mode["confidence_label"]
                    runbook["match_score"] = mode["match_score"]
                    active_runbooks.append(runbook)

        # Risk description
        if risk_level == "CRITICAL":
            risk_description = "Active fault with high probability of imminent failure"
        elif risk_level == "HIGH":
            risk_description = "Probable failure mode detected — maintenance required urgently"
        elif risk_level == "MEDIUM":
            risk_description = "Possible fault developing — increased monitoring recommended"
        elif risk_level == "LOW":
            risk_description = "Early indicators present — schedule inspection"
        else:
            risk_description = "All parameters within normal operating range"

        return {
            "risk_level": risk_level,
            "risk_score": round(risk_score, 3),
            "risk_description": risk_description,
            "time_to_action_hours": int(rul_hours) if rul_hours < 9999 else None,
            "confidence_pct": round(
                fmea_results[0]["match_score"] * 100 if fmea_results else risk_score * 100
            ),
            "economic_impact": economic,
            "decision_recommendation": recommendation,
            "active_runbooks": active_runbooks,
            "active_failure_modes": [
                {
                    "id": m["id"],
                    "name": m["name"],
                    "confidence_label": m["confidence_label"],
                    "match_score": m["match_score"],
                }
                for m in fmea_results
            ],
        }
