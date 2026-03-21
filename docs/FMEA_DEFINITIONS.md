# TransformerTwin — FMEA Failure Mode Definitions

> **Status:** Implementation-Ready
> **Standard:** IEEE C57.104, IEC 60599, IEC 60812 (FMEA methodology)
> **Applies to:** `analytics/fmea_engine.py`, `config.py`

This document defines all 8 failure modes evaluated by the FMEA engine. Each mode has:
- A set of **evidence conditions** (each scoring 0.0–1.0)
- **Weights** per evidence item (sum to 1.0 per mode)
- A final `match_score = Σ(condition_score × weight)`
- Minimum report threshold: `match_score ≥ 0.30` (from `FMEA_MIN_REPORT_SCORE` in `config.py`)

**Rule:** The engine evaluates ALL 8 modes on every analytics tick and returns the list sorted by `match_score` descending, filtered to `≥ FMEA_MIN_REPORT_SCORE`.

---

## Scoring Helper Functions

```python
def threshold_score(value: float, caution: float, warning: float, critical: float) -> float:
    """
    Returns 0.0 (below caution), 0.5 (at warning), 1.0 (at critical).
    Interpolates between thresholds.
    """
    if value < caution:
        return 0.0
    if value >= critical:
        return 1.0
    if value >= warning:
        return 0.5 + 0.5 * (value - warning) / (critical - warning)
    return 0.5 * (value - caution) / (warning - caution)

def inverse_threshold_score(value: float, caution: float, warning: float, critical: float) -> float:
    """For sensors where LOWER is worse (OIL_DIELECTRIC)."""
    return threshold_score(-value, -caution, -warning, -critical)

def rate_of_change_score(current: float, previous: float, threshold_pct: float = 0.10) -> float:
    """Returns 1.0 if value changed > threshold_pct of its value in last reading."""
    if previous == 0:
        return 0.0
    change = abs(current - previous) / abs(previous)
    return min(1.0, change / threshold_pct)

def bool_score(value: float, threshold: float = 0.5) -> float:
    """Returns 1.0 if value >= threshold, else 0.0. For boolean sensors (0/1)."""
    return 1.0 if value >= threshold else 0.0
```

---

## FM-001: Winding Hot Spot

**Description:** Localized overheating of a winding conductor. Caused by insulation failure, eddy current concentration, or blocked oil flow. Primary risk: accelerated insulation aging and paper degradation.

**Associated Duval Zone:** T1, T2, T3
**Primary scenario:** `hot_spot`

| # | Evidence | Sensor(s) | Weight | Score Logic |
|---|----------|-----------|--------|-------------|
| 1 | Winding temperature elevated | WINDING_TEMP | 0.35 | `threshold_score(value, 90, 105, 120)` |
| 2 | Winding temp above expected (anomaly) | WINDING_TEMP `expected` field | 0.25 | `min(1.0, deviation_pct / 20.0)` where `deviation_pct = (actual - expected) / expected * 100` |
| 3 | Ethylene elevated (thermal > 300°C) | DGA_C2H4 | 0.20 | `threshold_score(value, 50, 200, 600)` |
| 4 | Methane elevated (thermal < 300°C) | DGA_CH4 | 0.10 | `threshold_score(value, 75, 200, 600)` |
| 5 | Duval zone is thermal (T1/T2/T3) | Duval zone | 0.10 | `1.0 if zone in {"T1","T2","T3"} else 0.0` |

```python
FM_001_WEIGHTS = [0.35, 0.25, 0.20, 0.10, 0.10]

def score_fm_001(state: TransformerState, dga: DGAAnalysis) -> float:
    e1 = threshold_score(state.winding_temp, 90, 105, 120)
    expected = state.winding_temp_expected or state.winding_temp  # fallback
    dev_pct = abs(state.winding_temp - expected) / max(expected, 1.0) * 100
    e2 = min(1.0, dev_pct / 20.0)
    e3 = threshold_score(state.dga_c2h4, 50, 200, 600)
    e4 = threshold_score(state.dga_ch4, 75, 200, 600)
    e5 = 1.0 if dga.duval_zone in {"T1", "T2", "T3"} else 0.0
    scores = [e1, e2, e3, e4, e5]
    return sum(s * w for s, w in zip(scores, FM_001_WEIGHTS))
```

**Recommended Actions:**
- Reduce transformer load to 70% or below
- Verify cooling system is fully operational
- Schedule thermal imaging inspection within 24 hours
- Increase DGA sampling frequency to daily

---

## FM-002: Paper Insulation Degradation

**Description:** Long-term thermal or moisture-induced degradation of cellulose (paper) insulation. Produces CO and CO2 as primary by-products. Irreversible — indicates loss of insulation life.

**Associated Duval Zone:** T1, T2 (thermal with paper involvement)
**Primary scenario:** `hot_spot` (Stage 3 where paper burns)

| # | Evidence | Sensor(s) | Weight | Score Logic |
|---|----------|-----------|--------|-------------|
| 1 | CO elevated | DGA_CO | 0.30 | `threshold_score(value, 350, 900, 1800)` |
| 2 | CO2 elevated | DGA_CO2 | 0.25 | `threshold_score(value, 2500, 4000, 9000)` |
| 3 | CO2/CO ratio outside normal range | DGA_CO2 / DGA_CO | 0.20 | `1.0 if ratio < 5 or ratio > 13 else 0.0` (abnormal ratio indicates active paper fault) |
| 4 | Winding temperature history | WINDING_TEMP | 0.15 | `threshold_score(value, 85, 100, 115)` |
| 5 | Oil moisture elevated | OIL_MOISTURE | 0.10 | `threshold_score(value, 15, 25, 35)` |

```python
FM_002_WEIGHTS = [0.30, 0.25, 0.20, 0.15, 0.10]

def score_fm_002(state: TransformerState, dga: DGAAnalysis) -> float:
    e1 = threshold_score(state.dga_co, 350, 900, 1800)
    e2 = threshold_score(state.dga_co2, 2500, 4000, 9000)
    ratio = state.dga_co2 / max(state.dga_co, 0.1)
    e3 = 1.0 if ratio < 5.0 or ratio > 13.0 else 0.0
    e4 = threshold_score(state.winding_temp, 85, 100, 115)
    e5 = threshold_score(state.oil_moisture, 15, 25, 35)
    scores = [e1, e2, e3, e4, e5]
    return sum(s * w for s, w in zip(scores, FM_002_WEIGHTS))
```

**Recommended Actions:**
- Review transformer loading history
- Schedule oil sampling for furanic compounds (paper degradation markers)
- Assess remaining insulation life
- Consider planned outage for internal inspection

---

## FM-003: Arcing Event

**Description:** Electrical discharge between conductors or between conductor and ground. Produces acetylene (C2H2) as the primary indicator — C2H2 is only generated at arc temperatures (>700°C). Any C2H2 > 1 ppm is significant.

**Associated Duval Zone:** D1, D2, DT
**Primary scenario:** `arcing`

| # | Evidence | Sensor(s) | Weight | Score Logic |
|---|----------|-----------|--------|-------------|
| 1 | Acetylene present | DGA_C2H2 | 0.45 | `threshold_score(value, 1, 35, 200)` — any C2H2 is serious |
| 2 | Hydrogen elevated | DGA_H2 | 0.25 | `threshold_score(value, 100, 700, 1800)` |
| 3 | Duval zone is discharge | Duval zone | 0.20 | `1.0 if zone in {"D1","D2","DT"} else 0.0` |
| 4 | Rapid gas rate of change | DGA_C2H2 rate | 0.10 | `1.0 if c2h2_trend == "RISING" else 0.0` |

```python
FM_003_WEIGHTS = [0.45, 0.25, 0.20, 0.10]

def score_fm_003(state: TransformerState, dga: DGAAnalysis) -> float:
    e1 = threshold_score(state.dga_c2h2, 1, 35, 200)
    e2 = threshold_score(state.dga_h2, 100, 700, 1800)
    e3 = 1.0 if dga.duval_zone in {"D1", "D2", "DT"} else 0.0
    e4 = 1.0 if dga.gas_trends.get("DGA_C2H2") == "RISING" else 0.0
    scores = [e1, e2, e3, e4]
    return sum(s * w for s, w in zip(scores, FM_003_WEIGHTS))
```

**Recommended Actions:**
- Immediate load reduction
- Prepare for emergency shutdown if C2H2 > 200 ppm
- Emergency oil sampling and analysis
- Contact manufacturer for assessment

---

## FM-004: Partial Discharge

**Description:** Small electrical discharges within voids in solid insulation or between conductor surfaces. Produces primarily hydrogen with some methane. Low energy but indicative of insulation degradation path.

**Associated Duval Zone:** PD
**Primary scenario:** Not explicitly simulated (background level only)

| # | Evidence | Sensor(s) | Weight | Score Logic |
|---|----------|-----------|--------|-------------|
| 1 | Hydrogen elevated (primary PD indicator) | DGA_H2 | 0.40 | `threshold_score(value, 100, 700, 1800)` |
| 2 | Methane present, acetylene absent | DGA_CH4 | 0.25 | `threshold_score(value, 75, 200, 600)` |
| 3 | Duval zone is PD | Duval zone | 0.20 | `1.0 if zone == "PD" else 0.0` |
| 4 | Acetylene absent (confirms PD not arc) | DGA_C2H2 | 0.15 | `1.0 - threshold_score(value, 1, 35, 200)` (inverse: low C2H2 = more likely PD) |

```python
FM_004_WEIGHTS = [0.40, 0.25, 0.20, 0.15]

def score_fm_004(state: TransformerState, dga: DGAAnalysis) -> float:
    e1 = threshold_score(state.dga_h2, 100, 700, 1800)
    e2 = threshold_score(state.dga_ch4, 75, 200, 600)
    e3 = 1.0 if dga.duval_zone == "PD" else 0.0
    e4 = 1.0 - threshold_score(state.dga_c2h2, 1, 35, 200)  # inverse
    scores = [e1, e2, e3, e4]
    return sum(s * w for s, w in zip(scores, FM_004_WEIGHTS))
```

**Recommended Actions:**
- Increase DGA monitoring frequency
- Schedule ultrasonic partial discharge detection test
- Review transformer insulation age
- Consult condition monitoring specialist

---

## FM-005: Oil Degradation

**Description:** Oxidation or contamination of transformer insulating oil. Reduces dielectric strength and heat transfer efficiency. Caused by moisture ingress, oxygen contamination, or aging.

**Associated Duval Zone:** None specific (not a gas fault)
**Primary scenario:** Long-running normal (gradual)

| # | Evidence | Sensor(s) | Weight | Score Logic |
|---|----------|-----------|--------|-------------|
| 1 | Oil dielectric strength reduced | OIL_DIELECTRIC | 0.35 | `inverse_threshold_score(value, 45, 40, 30)` (lower is worse) |
| 2 | Oil moisture elevated | OIL_MOISTURE | 0.30 | `threshold_score(value, 15, 25, 35)` |
| 3 | Top oil temperature elevated | TOP_OIL_TEMP | 0.20 | `threshold_score(value, 75, 85, 95)` |
| 4 | CO2 elevated (oil oxidation marker) | DGA_CO2 | 0.15 | `threshold_score(value, 2500, 4000, 9000)` |

```python
FM_005_WEIGHTS = [0.35, 0.30, 0.20, 0.15]

def score_fm_005(state: TransformerState, dga: DGAAnalysis) -> float:
    e1 = inverse_threshold_score(state.oil_dielectric, 45, 40, 30)
    e2 = threshold_score(state.oil_moisture, 15, 25, 35)
    e3 = threshold_score(state.top_oil_temp, 75, 85, 95)
    e4 = threshold_score(state.dga_co2, 2500, 4000, 9000)
    scores = [e1, e2, e3, e4]
    return sum(s * w for s, w in zip(scores, FM_005_WEIGHTS))
```

**Recommended Actions:**
- Schedule oil testing (acid number, interfacial tension, color)
- Plan oil filtration or replacement
- Check breather/desiccant condition
- Inspect tank for moisture ingress points

---

## FM-006: Cooling System Failure

**Description:** Failure of forced cooling (fan banks or oil pump). Causes oil temperature to rise even at normal load. Identifiable by fan/pump status vs. oil temperature mismatch.

**Associated Duval Zone:** None specific
**Primary scenario:** `cooling_failure`

| # | Evidence | Sensor(s) | Weight | Score Logic |
|---|----------|-----------|--------|-------------|
| 1 | Top oil temperature elevated for load | TOP_OIL_TEMP vs LOAD_CURRENT | 0.40 | `max(0, (actual_rise - expected_ONAN_rise) / 30.0)` where expected_ONAN_rise = 55 × (load/100)^1.6 |
| 2 | Fan banks off at high temperature | FAN_BANK_1, FAN_BANK_2 | 0.30 | `1.0 if (top_oil > 75 and fan1 == 0 and fan2 == 0) else 0.0` |
| 3 | Oil pump off at high load | OIL_PUMP_1 | 0.20 | `1.0 if (load > 80 and pump == 0) else 0.0` |
| 4 | Rising oil temperature trend | TOP_OIL_TEMP rate | 0.10 | `1.0 if top_oil_trend == "RISING" and top_oil > 70 else 0.0` |

```python
FM_006_WEIGHTS = [0.40, 0.30, 0.20, 0.10]

def score_fm_006(state: TransformerState, anomaly: AnomalyResult) -> float:
    import math
    expected_rise = 55.0 * (state.load_current / 100.0) ** 1.6
    actual_rise = state.top_oil_temp - state.ambient_temp
    e1 = max(0.0, min(1.0, (actual_rise - expected_rise) / 30.0))
    e2 = 1.0 if (state.top_oil_temp > 75 and state.fan_bank_1 < 0.5 and state.fan_bank_2 < 0.5) else 0.0
    e3 = 1.0 if (state.load_current > 80 and state.oil_pump_1 < 0.5) else 0.0
    top_oil_trend = anomaly.trends.get("TOP_OIL_TEMP", "STABLE")
    e4 = 1.0 if (top_oil_trend == "RISING" and state.top_oil_temp > 70) else 0.0
    scores = [e1, e2, e3, e4]
    return sum(s * w for s, w in zip(scores, FM_006_WEIGHTS))
```

**Recommended Actions:**
- Inspect Fan Bank 1 and Fan Bank 2 operation
- Check oil pump operation
- Reduce load until cooling is restored
- Dispatch maintenance team for cooling system inspection

---

## FM-007: OLTC (On-Load Tap Changer) Wear

**Description:** Mechanical wear of tap changer contacts from excessive switching operations. Produces trace C2H2 and H2 from contact arcing, and causes bushing capacitance drift.

**Associated Duval Zone:** D1 (trace levels), or NONE
**Primary scenario:** Not directly simulated; accumulates in normal operation

| # | Evidence | Sensor(s) | Weight | Score Logic |
|---|----------|-----------|--------|-------------|
| 1 | High tap operation count | TAP_OP_COUNT | 0.35 | `min(1.0, tap_op_count / 50000)` — 50,000 ops is typical overhaul threshold |
| 2 | Trace acetylene | DGA_C2H2 | 0.25 | `threshold_score(value, 1, 10, 35)` — low levels indicate contact arcing |
| 3 | Trace hydrogen | DGA_H2 | 0.20 | `threshold_score(value, 50, 200, 700)` — lower threshold than FM-003 |
| 4 | Bushing capacitance drift (HV) | BUSHING_CAP_HV | 0.20 | `threshold_score(value, 525, 550, 600)` |

```python
FM_007_WEIGHTS = [0.35, 0.25, 0.20, 0.20]

def score_fm_007(state: TransformerState) -> float:
    e1 = min(1.0, state.tap_op_count / 50000.0)
    e2 = threshold_score(state.dga_c2h2, 1, 10, 35)
    e3 = threshold_score(state.dga_h2, 50, 200, 700)
    e4 = threshold_score(state.bushing_cap_hv, 525, 550, 600)
    scores = [e1, e2, e3, e4]
    return sum(s * w for s, w in zip(scores, FM_007_WEIGHTS))
```

**Recommended Actions:**
- Schedule OLTC inspection and contact resistance test
- Review tap operation count against maintenance schedule
- Increase DGA monitoring frequency
- Plan OLTC overhaul at next scheduled outage

---

## FM-008: Bushing Deterioration

**Description:** Degradation of high-voltage or low-voltage bushings. Capacitance drift above ±5% of nominal indicates insulation deterioration. Can lead to bushing failure — a catastrophic and sudden failure mode.

**Associated Duval Zone:** PD (in late-stage deterioration)
**Primary scenario:** Not directly simulated

| # | Evidence | Sensor(s) | Weight | Score Logic |
|---|----------|-----------|--------|-------------|
| 1 | HV bushing capacitance drift | BUSHING_CAP_HV | 0.40 | `threshold_score(value, 525, 550, 600)` (nominal 500 pF) |
| 2 | LV bushing capacitance drift | BUSHING_CAP_LV | 0.30 | `threshold_score(value, 441, 462, 504)` (nominal 420 pF) |
| 3 | H2 elevated (PD in bushing) | DGA_H2 | 0.20 | `threshold_score(value, 100, 700, 1800)` |
| 4 | Duval zone is PD | Duval zone | 0.10 | `1.0 if zone == "PD" else 0.0` |

```python
FM_008_WEIGHTS = [0.40, 0.30, 0.20, 0.10]

def score_fm_008(state: TransformerState, dga: DGAAnalysis) -> float:
    e1 = threshold_score(state.bushing_cap_hv, 525, 550, 600)
    e2 = threshold_score(state.bushing_cap_lv, 441, 462, 504)
    e3 = threshold_score(state.dga_h2, 100, 700, 1800)
    e4 = 1.0 if dga.duval_zone == "PD" else 0.0
    scores = [e1, e2, e3, e4]
    return sum(s * w for s, w in zip(scores, FM_008_WEIGHTS))
```

**Recommended Actions:**
- Schedule power factor / tan-delta bushing test
- Inspect bushing oil level and condition
- Monitor continuously — bushing failure can be sudden
- Plan bushing replacement at next outage if drift exceeds 10%

---

## FMEA Engine — Full Evaluation Loop

```python
def evaluate_all_failure_modes(
    state: TransformerState,
    dga: DGAAnalysis,
    anomaly: AnomalyResult,
) -> list[FailureMode]:
    """
    Evaluate all 8 failure modes and return those above the minimum threshold.

    Returns:
        List of FailureMode Pydantic objects sorted by match_score descending.
        Only includes modes with match_score >= FMEA_MIN_REPORT_SCORE (0.30).
    """
    results = []

    evaluations = [
        ("FM-001", "Winding Hot Spot",           score_fm_001(state, dga)),
        ("FM-002", "Paper Insulation Degradation", score_fm_002(state, dga)),
        ("FM-003", "Arcing Event",                score_fm_003(state, dga)),
        ("FM-004", "Partial Discharge",           score_fm_004(state, dga)),
        ("FM-005", "Oil Degradation",             score_fm_005(state, dga)),
        ("FM-006", "Cooling System Failure",      score_fm_006(state, anomaly)),
        ("FM-007", "OLTC Wear",                   score_fm_007(state)),
        ("FM-008", "Bushing Deterioration",       score_fm_008(state, dga)),
    ]

    for fm_id, name, score in evaluations:
        if score >= FMEA_MIN_REPORT_SCORE:
            confidence = (
                "Probable" if score >= FMEA_CONFIDENCE_PROBABLE  # 0.7
                else "Possible" if score >= FMEA_CONFIDENCE_POSSIBLE  # 0.4
                else "Monitoring"
            )
            results.append(FailureMode(
                id=fm_id,
                name=name,
                match_score=round(score, 3),
                confidence=confidence,
                # evidence list and recommended_actions defined per mode above
            ))

    return sorted(results, key=lambda m: m.match_score, reverse=True)
```

---

## Expected Scores by Scenario

Use these to validate the FMEA engine is scoring correctly:

| Scenario | Sim Time | Expected Top Mode | Expected Score Range |
|----------|----------|-------------------|---------------------|
| Normal (75% load) | Any | FM-007 or FM-005 (low) | 0.10–0.25 (below report threshold) |
| Hot Spot Stage 2 | 60 min | FM-001 | 0.55–0.75 |
| Hot Spot Stage 3 | 120 min | FM-001, FM-002 | FM-001: 0.80+, FM-002: 0.55+ |
| Arcing Stage 2 | 10 min | FM-003 | 0.75–0.90 |
| Cooling Failure | 45 min | FM-006 | 0.60–0.80 |
