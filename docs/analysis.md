# TransformerTwin — Comprehensive QA Analysis

**Date**: 2026-03-22
**Tester**: Claude Code (Playwright MCP)
**Session context**: Fresh Playwright session, backend already running (pre-existing simulation state)
**Frontend**: http://localhost:5173 (Vite + React 18 + TypeScript)
**Backend**: http://localhost:8001 (FastAPI + Python 3.11)
**Speed tested**: 1× (initial), 30× (scenarios)
**Duration**: ~25 min real-time, ~5h sim-time covered

---

## Methodology

All 14 feature areas tested end-to-end using Playwright MCP browser automation. Screenshots saved to `screenshots/`. Sequence:

1. App startup and initial load
2. Sensor panel (all 21 sensors)
3. Speed control (1×→30×)
4. Health gauge + breakdown + 3D highlight
5. DGA tab (Duval, Summary, Trends)
6. FMEA panel (empty state → Stage 2 → cascade)
7. Decision tab (risk, prognosis, economics, runbooks, operator controls)
8. What-If simulation
9. Alerts panel (expand, Ack)
10. Physics tab (Operating Envelope, Temporal Correlation)
11. Timeline tab
12. Scenarios (hot_spot Stages 1–3, cascade escalation)
13. 3D viewer (click to open Part Detail Panel, Health→3D highlight, Reset Camera)
14. Historical playback (toggle, scrubber)

---

## Feature Test Results

### T1: App Load ✅ PASS (with issues noted)

- Header: TransformerTwin branding, TRF-001 nameplate renders ✓
- AssetKPIBar: Load Factor, Winding Temp, Top Oil Temp, Health Index, Est. Time-to-Critical ✓
- Scenario selector (6 options), Speed buttons (1×–200×) all present ✓
- Health circular gauge visible ✓
- Live badge (green dot) shows WebSocket connected ✓
- Console: 1 WebSocket warning on initial load (WS closes briefly before reconnecting) — non-fatal
- **Issue noted**: Est. Time-to-Critical shows "5–8 sim-hr / Rapidly Degrading" at Health=100/100 GOOD — contradictory (see BUG-NEW-3)

### T2: 3D Viewer ✅ PASS

- Three.js/R3F renders full transformer model (tank, radiators, bushings, fans, pump) ✓
- Clicking tank opens Part Detail Panel: name, description, health component (NORMAL/CAUTION/etc.), sensor readings ✓
- Reset Camera button works ✓
- Thermal gradient visible on tank: at light load, tank is dark blue; during hot spot Stage 3, top section becomes orange-red ✓
- **Health→3D highlight**: clicking "Oil Temp" health component turns tank CYAN immediately ✓
- RadiatorBank oil flow particles active when fans running ✓

### T3: Speed Control ✅ PASS

- All 6 speeds functional: 1×, 10×, 30×, 60×, 100×, 200× ✓
- Active button shows ring highlight ✓
- Speed change triggers AnomalyDetector history reset (quiet period) ✓
- Sim-time advances proportionally at 30× speed ✓

### T4: Sensor Panel ✅ PASS (with minor caveats)

- All 21 sensors present with correct values, units, trend arrows (↑↓→), limit bars, sparklines ✓
- Fan Bank 1, Fan Bank 2, Oil Pump 1 show "ON"/"OFF" labels correctly ✓
- Model deviation badges (mdl ±X°C) display for TOP_OIL_TEMP, WINDING_TEMP, BOT_OIL_TEMP ✓
- Expandable context line: "IEC 60076-7 model predicts X°C. Actual is Y above/below model by Z°C" ✓
- Status dots update correctly to reflect sensor status ✓
- **Caveat**: During post-scenario recovery, BOT_OIL_TEMP shows `mdl −0.6°C` badges when value is barely below model — triggers anomaly alert at just 2.5% deviation (see BUG-NEW-1)

### T5: Health Visualization ✅ PASS

- Circular health gauge always visible above tab content ✓
- 6 component breakdown bars: DGA, Winding, Oil Temp, Cooling, Oil Quality, Bushing ✓
- Clicking component highlights it blue, changes 3D model color to cyan ✓
- **Issue**: Health score is highly volatile — bounces between 96 and 100 repeatedly during normal operation (see BUG-NEW-2)

### T6: DGA Tab ✅ PASS

**Duval Triangle:**
- All 7 IEC 60599 zones render with correct colors ✓
- Default sub-tab is Duval (not Trends) ✓
- During hot_spot Stage 3 + cascade: point moved to T3 zone (Thermal > 700°C), CH₄ 31.1%, C₂H₄ 56.8%, C₂H₂ 12.1% ✓
- Historical trail (white dots) visible tracing gas evolution ✓
- Zone label updates correctly ✓

**DGA Summary sub-tab:**
- TDCG bar, CO₂/CO ratio bar present ✓
- 7 gas rows with ppm, trend, time-to-threshold ✓

**DGA Trends sub-tab:**
- 7 line charts with historical data ✓
- CASCADE FAILURE banner propagates into DGA tab correctly ✓

### T7: FMEA Panel ⚠ PARTIAL PASS

- **Normal operation**: Empty state with SVG icon and "No anomalies detected" ✓
- **Stage 2 (38–67% hot_spot, winding 75°C)**: "No anomalies detected" — **FMEA does not activate** until Stage 3 (see BUG-NEW-5)
- **Post-cascade**: "Arcing Event" 60% Possible (FM-003), "OLTC Wear" 36% Monitoring ✓
- Confidence bar renders correctly ✓
- CASCADE FAILURE banner propagates into FMEA tab ✓

### T8: Decision Tab ⚠ PARTIAL PASS

**Operator Controls:**
- Load Management buttons: 70% Load, 40% Load, Full Load ✓
- Cooling Mode buttons: Auto, ONAF, OFAF ✓
- Current active mode shown as disabled (greyed with checkmark) ✓
- Applying 70% Load: load jumps to 69.8% immediately ✓
- "Active: Load capped at 70%" banner appears ✓
- "Restore Normal" button appears ✓
- **Critical bug**: Applying 70% Load when current load was 42% INCREASED the load, causing health to plummet from 81→71/100 and degradation rate to jump from -0.64 → -24.38 pts/sim-hr (see BUG-NEW-4)

**Asset Risk Assessment:**
- During active Stage 2 hot_spot (winding 75°C): shows **NOMINAL / 0% risk index** ✗ (see BUG-NEW-6)
- Post-cascade: shows **LOW / 28–38% risk index** — better but still contradicts CASCADE FAILURE banner

**Live Prognosis:**
- Degradation rate displayed ✓
- Time-to-WARNING/CRITICAL displayed ✓
- 3-column health projection (24h/48h/72h, No Action vs 70% Load) ✓
- Thermal Fatigue bar ✓
- **Bug**: After applying 70% Load override, projected health scores show "1" instead of actual values (see BUG-NEW-7)
- **Bug**: Rate oscillates wildly (-0.64 → +8.10 → -24.38 pts/sim-hr) due to health history volatility

**Cascade state:**
- CASCADE FAILURE banner at top of Decision tab ✓
- "CASCADE FAILURE IN PROGRESS" warning block with technical description ✓
- **Inconsistency**: CASCADE says "Immediate de-energization may be required" but Recommended Action says "routine inspection within 30 days" (see BUG-NEW-6)

**Economic Impact:**
- Act Now / Delay / No Action cost comparison renders ✓
- Escalation risk updates when CASCADE active (0% → 34% → 43%) ✓

**Runbooks:**
- "Arcing Event Emergency Response" runbook appears during cascade ✓
- Runbook shows FM code, procedure code, time-to-act ✓

### T9: What-If Simulation ✅ PASS

- Sliders: Load% (1–130), Ambient Temp (−20 to 45°C), Horizon (1–30 days) ✓
- Cooling Mode dropdown (ONAN, ONAF, OFAF) ✓
- Run Simulation button → results appear ✓
- Results: Hot Spot Temp (73.0°C), Top Oil Temp (53.0°C), aging rate ✓
- Cooling Energy Impact card: "−27.0% ONAF reduces losses vs ONAN baseline" ✓
- 7-day projection chart renders ✓
- **Minor issue**: Projection chart shows flat horizontal lines (equilibrium behavior — correct physics but visually confusing without an explanation)

### T10: Alerts Panel ⚠ PARTIAL PASS

- Alert list renders with severity badges ✓
- Expanding alert shows full description with current/expected/deviation ✓
- "Ack" button present ✓
- FMEA-sourced alerts get purple badge ✓
- **Critical bug (BUG-NEW-1)**: 82+ alerts in ~8 minutes at 30× during post-scenario recovery. During 1× normal operation: 9 alerts in 8 minutes. Alert titles say "CAUTION Level Reached" for readings that are 2–26% below model prediction (see BUG-NEW-1 and BUG-NEW-2)

### T11: Physics Tab ✅ PASS (with known limitations)

**Operating Envelope:**
- Blue IEC 60076-7 model curve renders ✓
- Scatter points show historical operating points ✓
- Current op-point badge: "Load: 36%, Top Oil: 27.7°C, Model: 36.8°C, −8.9°C below IEC model" ✓
- Threshold lines (75°C CAUTION, 85°C WARNING, 95°C CRITICAL) ✓
- "Why This Matters" explainer text ✓
- **Known issue**: During post-scenario recovery, all scatter points cluster below the blue model curve (temps cooled faster than model predicted). Looks odd but is physically correct.

**Temporal Correlation:**
- Dual Y-axis: Load% (left) vs Temps (right) ✓
- Hot spot Stage 3 visible as dramatic winding temp spike to ~125°C ✓
- Fault signature clearly shows winding separating from oil temp ✓
- "Load ↑ → Temps ↑", "Thermal Gradient", "Fault Signature" insight cards ✓
- CASCADE FAILURE banner propagates correctly ✓

### T12: Timeline Tab ✅ PASS (with volume concern)

- 139 events total in a ~25 min session ✓
- CRITICAL/WARNING/CAUTION/INFO all four severity types present ✓
- Rich event descriptions: sensor value, expected value, deviation % ✓
- Health drops interleaved with alerts that caused them ✓
- CASCADE FAILURE banner propagates into Timeline tab ✓
- **Known issue**: 99+ badge instead of actual count; alert volume so high the timeline is dominated by anomaly CAUTION alerts (see BUG-NEW-1)

### T13: Scenarios ✅ PASS

**Hot Spot scenario:**
- Stage 1 (0–33%): Winding temp +15°C delta ✓
- Stage 2 (33–67%): DGA gases rising (CH₄, C₂H₄ building), winding at 75°C ✓
- Stage 3 (67–100%): Winding at 113°C, CRITICAL alerts, tank thermal gradient visible ✓
- ScenarioProgressBar: yellow→orange→red gradient with stage label ✓
- Progress bar shows in both tab content area AND bottom bar ✓

**Cascade:**
- After sustained CRITICAL winding: C₂H₂ and H₂ injected into DGA ✓
- "CASCADE FAILURE — THERMAL→ARCING ESCALATION ACTIVE" red banner across ALL tabs ✓
- Banner persists after scenario ends ✓
- FMEA correctly identifies "Arcing Event" at 60% confidence post-cascade ✓

### T14: Historical Playback ⚠ PARTIAL PASS

- Clicking LIVE badge toggles to playback mode ✓
- Scrubber slider appears from T+0 to current sim-time ✓
- "◀ LIVE" button appears to return to live ✓
- Clicking "◀ LIVE" returns to live data ✓
- **Issue**: Dragging scrubber slider via Playwright mouse events did not visibly update KPI/sensor values. May be a Playwright interaction limitation with the range input, or a genuine bug in the snapshot API response.

---

## Bugs Found This Session

### BUG-NEW-1 — CRITICAL: Anomaly alert flood during operation

**Severity**: Critical (demo-breaking, alert fatigue)
**Rate**: ~9 alerts/8 min at 1× speed; 82 alerts in ~8 min at 30× post-scenario
**Root cause**: After hot_spot scenario ends, oil temperatures cool faster than the IEC 60076-7 rolling mean adapts. Values 5–26% BELOW the rolling mean trigger CAUTION/WARNING anomaly alerts. The Z-score threshold is too low relative to the natural variance during recovery.

**Examples observed**:
- "Bottom Oil Temperature — CAUTION Level Reached: Current 20.5°C (expected ≈ 22.2°C). Deviation: −7.5%"
- "Top Oil Temperature — CAUTION Level Reached: Current 28.0°C (expected ≈ 38.0°C). Deviation: −26.2%"
- "Winding Hot Spot Temperature — CAUTION Level Reached: Current 36.2°C (expected ≈ 36.0°C). Deviation: +0.6%"

All of these temperatures are physically NORMAL. The problem is the rolling mean was elevated from the hot spot scenario and hasn't adapted to the new (cooler) steady state.

**Proposed fix**: In `anomaly_detector.py`, add a minimum absolute deviation floor in addition to the relative Z-score: only emit CAUTION if `abs(value - expected) > 2°C` for temperature sensors (not just `z_score > threshold`). This prevents triggering on sub-2°C deviations regardless of how anomalous they appear statistically.

---

### BUG-NEW-2 — HIGH: Alert titles say "Level Reached" for anomaly detection alerts

**Severity**: High (misleading language, implies threshold breach when it's statistical anomaly)
**Location**: `backend/engine.py` (anomaly alert formatting)

**Problem**: Alert title "Top Oil Temperature — WARNING Level Reached" implies the sensor crossed a fixed safety threshold (e.g., 85°C). But the body says "Current: 28.0°C" — a reading of 28°C should NEVER generate a "WARNING Level Reached" alert.

The word "Level" comes from the anomaly detector using the same CAUTION/WARNING/CRITICAL severity levels as threshold-based alerts, but with completely different semantics (statistical deviation vs. absolute threshold).

**Proposed fix**: Change anomaly alert titles to explicitly indicate they are anomaly/deviation alerts:
- `"{sensor_name} — Anomaly Detected (CAUTION)"` instead of `"— CAUTION Level Reached"`
- Or use a different suffix: `"— Deviation Exceeds {pct}%"`

This preserves alert severity levels while making it clear the trigger is deviation, not absolute threshold.

---

### BUG-NEW-3 — HIGH: "Est. Time-to-Critical / Rapidly Degrading" when Health=100

**Severity**: High (contradictory KPI display)
**Location**: `frontend/src/components/layout/AssetKPIBar.tsx`

The KPI bar shows "5 sim-hr / Rapidly Degrading" even when Health Index is 100/100 GOOD. This happens because the prognostics regression uses recent health history which may include a rapid drop-then-recovery (from anomaly alert burst), making the linear regression slope negative.

**Proposed fix**: In the prognostics calculation, if current health ≥ 90 AND degradation_rate > -0.1 pts/sim-hr, show "Stable" not "Rapidly Degrading". Apply a stability dead-band: only show "Rapidly Degrading" if rate < -1.0 pts/sim-hr sustained over multiple readings.

---

### BUG-NEW-4 — HIGH: "70% Load" operator control increases load when current load < 70%

**Severity**: High (operator control produces opposite-of-intended effect)
**Location**: `backend/api/routes_operator.py`, `frontend/src/components/panels/DecisionPanel.tsx`

**Problem**: The "70% Load" operator control sets load to exactly 70%, not caps it at 70%. When the transformer was running at 42% load (post-scenario light load), clicking "70% Load" increased load from 42% → 70%, causing immediate thermal stress:
- Degradation rate jumped from -0.64 → -24.38 pts/sim-hr
- Health dropped from 81 → 71 in seconds
- AlertToast fired "WARNING - Top Oil Temperature"

The button label "70% Load" and tooltip "Load capped at 70%" are contradictory — the tooltip implies capping, but the behavior is exact setting.

**Proposed fix**: Two options:
1. **Backend fix**: In `routes_operator.py`, treat operator_load_override as a cap: `effective_load = min(current_load, override_load)`. Only apply if current > override.
2. **Frontend fix**: Disable "70% Load" button if `currentLoad < 0.70` and show tooltip "Already below 70% — no action needed."

---

### BUG-NEW-5 — MEDIUM: FMEA shows no anomalies during Stage 2 hot spot (winding 75°C)

**Severity**: Medium (FMEA diagnostic window is too narrow)
**Location**: `backend/analytics/fmea_engine.py`

At Stage 2 (33–67% progress), winding temperature was 74–76°C — well above normal (35°C). Yet FMEA showed "No anomalies detected." Only at Stage 3 (≥67%) did FMEA activate. For a demo context, operators expect FMEA to start flagging "Winding Hot Spot — Monitoring" much earlier (even at Stage 1 when winding exceeds 45°C).

**Proposed fix**: Lower the FMEA display threshold from 40% (Possible) to show failure modes at 25%+ with "Monitoring" status. This gives earlier warning. The current 40% threshold means FMEA is silent for the first 67% of the scenario.

---

### BUG-NEW-6 — MEDIUM: Decision panel risk/recommendation inconsistent with CASCADE state

**Severity**: Medium (contradictory guidance — most critical for demo)
**Location**: `backend/analytics/decision_engine.py`

During active CASCADE FAILURE:
- CASCADE banner: "Immediate de-energization may be required"
- Risk Assessment: **LOW / 28–38% risk index** — "Early indicators present"
- Recommended Action: "Increase monitoring frequency, schedule routine inspection within 30 days"

These three messages are contradictory. An operator seeing CASCADE FAILURE but reading "routine inspection within 30 days" would be confused.

**Root cause**: `decision_engine.py` computes risk from health score (85/100) and FMEA confidence (58% Possible). The cascade flag is not factored into the risk or recommendation logic.

**Proposed fix**: In `decision_engine.py`:
1. Check `simulator.engine.cascade_triggered` flag
2. If True, override risk to at least ELEVATED (or CRITICAL) regardless of health score
3. Override recommended_action to "Immediate: De-energize and inspect for arcing — cascade failure in progress"

---

### BUG-NEW-7 — MEDIUM: Projected health scores show "1" after operator override applied

**Severity**: Medium (data display glitch)
**Location**: `frontend/src/components/panels/PrognosticsWidget.tsx`

After clicking "70% Load" operator override, the projected health score table showed:
- +24h: No action = 1, 70% load = 1
- +48h: No action = 0, 70% load = 1
- +72h: No action = 0, 70% load = 1

Before the override, these showed meaningful values (No action=70/55/39, 70% load=100/100/100). The "1" values appear to be display bugs — possibly the projection data not updating correctly after the override state changes, or a rounding/clamping issue near zero.

**Proposed fix**: Add null/min checks in `PrognosticsWidget.tsx` for the projected values. Clamp display to [0, 100] range. Investigate whether `/api/prognostics` returns stale or incorrect data immediately after operator override.

---

## Summary of Known Pre-Existing Issues (Not Fixed)

These were documented in the previous analysis.md and remain open:

| Issue | Severity | Description |
|-------|----------|-------------|
| ISSUE-C | LOW | Physics Correlation Y-axis: data compressed at bottom during normal ops |
| ISSUE-D | LOW | Prognostics shows "Rapidly Degrading" during normal recovery post-fault |
| ISSUE-E | LOW | Timeline badge capped at "99+" (actual count up to 300) |
| ISSUE-F | LOW | Fan/pump sensors show "0.0" in playback/snapshot mode |

---

## Fix Plan (Priority Order)

### FIX-1 — PRIORITY: Anomaly detector absolute deviation floor [BUG-NEW-1]

**File**: `backend/analytics/anomaly_detector.py`
**Change**: Add `min_abs_deviation` per sensor group. Temperature sensors: require `abs(value - mean) >= 2.0°C` before emitting any alert, regardless of Z-score. This prevents sub-2°C deviations from ever alerting even when statistically anomalous.

**Why safe**: Only tightens the alert trigger condition. No existing tests will break since tests inject deliberate anomalies far larger than 2°C.

---

### FIX-2 — PRIORITY: Alert title language for anomaly alerts [BUG-NEW-2]

**File**: `backend/engine.py` (the `_emit_anomaly_alert` or equivalent method)
**Change**: Change alert title format from `"{sensor_label} — {severity} Level Reached"` to `"{sensor_label} — Anomaly Detected"` for anomaly-sourced alerts. Threshold-based alerts (from health_score) keep their existing format.

**Why safe**: Changes only alert message text. No schema or API changes.

---

### FIX-3 — PRIORITY: Decision engine cascade awareness [BUG-NEW-6]

**File**: `backend/analytics/decision_engine.py`
**Change**: Add cascade_triggered parameter to `compute()`. If `cascade_triggered=True`, force risk ≥ ELEVATED and set `recommended_action` to the cascade-specific emergency action.

**File**: `backend/api/routes_decision.py`
**Change**: Pass `app.state.simulator.engine.cascade_triggered` to `DecisionEngine.compute()`.

**Why safe**: Purely additive logic. Only activates when cascade flag is set (which the existing engine already manages).

---

### FIX-4 — PRIORITY: 70% Load operator control behavior [BUG-NEW-4]

**File**: `backend/api/routes_operator.py`
**Change**: For load overrides, apply only if the override load is LESS than the current load. Add `effective_override = None if override_pct >= current_load_pct else override_pct`. Return a message field indicating "No override applied — current load already below target."

**File**: `frontend/src/components/panels/DecisionPanel.tsx`
**Change**: Disable "70% Load" button when store load factor < 0.70. Show tooltip "Current load (42%) already below 70% — no override needed."

**Why safe**: Only changes operator override behavior. Does not affect normal simulation physics. Existing tests don't test operator controls.

---

### FIX-5 — MEDIUM: FMEA lower display threshold [BUG-NEW-5]

**File**: `backend/analytics/fmea_engine.py`
**Change**: Change the result filtering threshold from 40% (Possible) to 25% (Monitoring) for display purposes. Failure modes at 25–39% confidence should show as "Monitoring" in the FMEA panel without emitting alerts.

**File**: `frontend/src/components/panels/FMEAPanel.tsx`
**Change**: Ensure failure modes with "Monitoring" status (below 40%) render with a CAUTION dot (not orange/WARNING) and a reduced opacity to indicate lower confidence.

**Why safe**: Only changes display threshold. Alert emission threshold (40%) stays unchanged.

---

### FIX-6 — MEDIUM: Prognostics projection display null guard [BUG-NEW-7]

**File**: `frontend/src/components/panels/PrognosticsWidget.tsx`
**Change**: Add null/undefined/NaN guards on projected score display. Clamp displayed value to [0, 100]. Add `Math.max(0, Math.min(100, score ?? 0))` on every projected score.

**Why safe**: Pure defensive frontend rendering change.

---

## Architecture Observations

### What Works Exceptionally Well

1. **Duval Triangle progression during hot_spot+cascade**: Point moves T2 → T3 during scenario, then stays in D1/T3 region post-cascade (DGA gases persist in oil). Physically accurate and visually compelling.

2. **Temporal Correlation during hot_spot**: The winding temp spike to 125°C vs steady load line is the clearest possible fault signature visualization. The "widening gap" between winding and oil temp is textbook hot spot detection.

3. **Cascade fault chain**: Thermal → arcing escalation with C₂H₂ injection, FMEA detecting "Arcing Event" at 60%, CASCADE banner propagating across all tabs — end-to-end fault cascade chain works correctly.

4. **Health→3D highlight**: Clicking a health component turns the 3D tank cyan immediately. The Part Detail Panel shows matching sensor readings. Clean cross-component data flow.

5. **3D thermal gradient**: During Stage 3 hot spot, the tank top section clearly darkens/warms to orange-red while bottom stays cooler. The 5-slice emissive gradient is physically correct.

6. **What-If simulation**: Results appear in ~1s, cooling energy card shows −27% for ONAF vs ONAN. The Arrhenius aging calculation is fast and the results are physically reasonable.

7. **Economic decision tables**: The escalation risk correctly rises from 0% → 34% → 43% as fault severity increases. Cost comparison ($16k vs $59k vs $3.8M) gives operators a clear financial decision framework.

### Areas for Improvement

1. **Alert management is the #1 UX issue**: 139 events in 25 minutes is alert fatigue at its worst. The alert flood makes the Timeline and Alerts tabs nearly unusable during post-fault recovery. This is the most demo-critical fix needed.

2. **Decision engine reacts to health, not scenarios**: The NOMINAL risk during a 75°C winding hot spot shows the decision engine's blind spot — it uses health score (which uses absolute thresholds) but the hot spot hasn't crossed those thresholds yet. Prognostics and FMEA confidence should feed more strongly into risk.

3. **Operator Controls context-sensitivity**: The "70% Load / 40% Load / Full Load" pattern assumes operators understand they're setting (not capping) the load. In real operations, "reduce load" commands are relative, not absolute targets.

4. **FMEA silent for 67% of scenario**: For a demo, FMEA should start showing "Monitoring" modes much earlier. At 38% scenario progress with 75°C winding, any experienced operator would expect the diagnostic system to flag something.

---

## Test Coverage Summary

| Feature Area | Status | Key Finding |
|---|---|---|
| App load / WebSocket | ✅ PASS | Clean load, 1 WS warning (non-fatal) |
| 3D viewer / Part Detail | ✅ PASS | Click, highlight, reset all work |
| Speed control (1×–200×) | ✅ PASS | All speeds functional |
| Sensor panel (21 sensors) | ✅ PASS | All present, labels correct |
| Health gauge + breakdown | ✅ PASS | volatile score (see BUG-NEW-2/3) |
| Health→3D highlight | ✅ PASS | Cyan highlight works correctly |
| DGA: Duval Triangle | ✅ PASS | T3 zone correct during cascade |
| DGA: Summary + Trends | ✅ PASS | Gas rates, CO₂/CO ratio present |
| FMEA panel | ⚠ PARTIAL | Silent during Stage 2 (BUG-NEW-5) |
| Decision: Operator controls | ⚠ PARTIAL | 70% Load increases load if below 70% (BUG-NEW-4) |
| Decision: Risk + Prognosis | ⚠ PARTIAL | NOMINAL during hot spot (BUG-NEW-6) |
| Decision: Cascade awareness | ⚠ PARTIAL | Contradictory risk vs. cascade banner (BUG-NEW-6) |
| Decision: Economics + Runbooks | ✅ PASS | Costs update with escalation risk |
| What-If simulation | ✅ PASS | Results correct, flat chart expected |
| Alerts panel | ⚠ PARTIAL | Alert flood (BUG-NEW-1, BUG-NEW-2) |
| Physics: Operating Envelope | ✅ PASS | Model curve, scatter, deviation badge |
| Physics: Temporal Correlation | ✅ PASS | Hot spot spike clearly visible |
| Timeline | ✅ PASS | 139 events, cascade markers visible |
| Scenarios: hot_spot | ✅ PASS | All 3 stages, DGA, FMEA response |
| Scenarios: cascade | ✅ PASS | C₂H₂ injection, banner, FMEA |
| Operator intervention | ⚠ PARTIAL | Load increases instead of decreasing (BUG-NEW-4) |
| Historical playback | ⚠ PARTIAL | Toggle works; scrubber drag may not update values |

**New Bugs Found**: 7 (BUG-NEW-1 through BUG-NEW-7)
**Pre-existing Issues Still Open**: 4 (ISSUE-C/D/E/F)
**Overall Status**: Core features working; alert flood + decision engine are the top priorities before next demo.

---

## Fix Implementation Order

```
FIX-1  anomaly_detector.py   — add 2°C absolute deviation floor for temperature sensors
FIX-2  engine.py             — change anomaly alert titles to "Anomaly Detected"
FIX-3  decision_engine.py    — cascade_triggered forces ELEVATED+ risk
FIX-3b routes_decision.py    — pass cascade flag to decision engine
FIX-4  routes_operator.py    — 70% Load is a cap, not a set
FIX-4b DecisionPanel.tsx     — disable button if current load < target
FIX-5  fmea_engine.py        — lower display threshold to 25%
FIX-6  PrognosticsWidget.tsx — null guard on projected scores
```
