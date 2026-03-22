# TransformerTwin — Progress Tracker

> **This is a living document.** Update after every work session.
> Last updated: 2026-03-22 (Session 22 — Thermal Runaway Cascade: COMPLETE)

---

## Current Status: 🟢 Session 22 Complete — Thermal Runaway Cascade: 6-Stage Failure to Terminal Relay Trip

### Session 22 Additions (2026-03-22)

**Goal**: Implement `thermal_runaway` — a 6-stage cascading failure scenario that chains cooling failure → hot spot → oil/paper deterioration → partial discharge → arcing → terminal relay trip. The transformer actually "dies" (protection relay operates, LOAD_CURRENT → 0, overlay shown).

**Status**: COMPLETE. 28/28 backend tests pass. 125/125 frontend tests pass. TypeScript build clean.

#### What was implemented:

1. **`backend/scenarios/thermal_runaway.py`** (NEW) — 6-stage `ThermalRunawayScenario` class with thermal modifiers, DGA injection rates, and diagnostic offsets per stage. At 200× = 45 real seconds.
2. **`backend/scenarios/base.py`** — Added `get_diagnostic_modifiers()` + `is_terminal_failure()` with default no-op implementations. Fully backwards compatible.
3. **`backend/models/schemas.py`** — Added `"thermal_runaway"` to `ScenarioId`; added `terminal_failure: bool = False` to `WSScenarioUpdateSchema`.
4. **`backend/simulator/engine.py`** — Terminal failure state machine: `_terminal_failure` flag, `_terminal_failure_emitted` gate, `_diag_offsets` dict for diagnostic sensor physics, `_emit_terminal_failure_alert()`, stage 6 load=0 override, clean reset on scenario→normal.
5. **`backend/scenarios/manager.py`** — Registered `ThermalRunawayScenario`.
6. **`backend/config.py`** — Added `SCENARIO_THERMAL_RUNAWAY_DURATION_S`, stage boundary constants, `SCENARIO_THERMAL_RUNAWAY` ID constant.
7. **`frontend/src/types/scenario.ts`** — Added `'thermal_runaway'` to `ScenarioId`.
8. **`frontend/src/store/index.ts`** — Added `terminalFailure: boolean` state + extraction in `updateScenario`.
9. **`frontend/src/hooks/useWebSocket.ts`** — Extracts `terminal_failure` from `scenario_update` WS message.
10. **`frontend/src/components/common/ScenarioSelector.tsx`** — Added `⚡ Thermal Runaway — Full Cascade` option.
11. **`frontend/src/components/common/ScenarioProgressBar.tsx`** — Terminal failure pulse banner when `terminalFailure === true`.
12. **`frontend/src/components/panels/TerminalFailureOverlay.tsx`** (NEW) — Full-screen overlay: "⚡ PROTECTION RELAY OPERATED", fault chain timeline, reset button.
13. **`frontend/src/App.tsx`** — Renders `TerminalFailureOverlay` when `terminalFailure === true`.
14. **`docs/INTEGRATION_CONTRACT.md`** — Added `thermal_runaway` to `ScenarioId`; added `terminal_failure` field to `scenario_update` schema.
15. **`docs/DECISIONS.md`** — ADR-030 (terminal failure state machine), ADR-031 (diagnostic offsets).

#### Physics stages:
| Stage | Sim-time | @200× | Signal |
|-------|----------|-------|--------|
| 1 | 0–1500s | 0–7.5s | Fans seized, ONAN only, oil heating |
| 2 | 1500–3000s | 7.5–15s | Winding +35°C, early DGA CO/H2 |
| 3 | 3000–4800s | 15–24s | OIL_DIELECTRIC -8kV, OIL_MOISTURE +12ppm, CO rising |
| 4 | 4800–6600s | 24–33s | H2/CH4 dominant → Duval PD zone |
| 5 | 6600–8100s | 33–40.5s | C2H2 spike → Duval D1/D2, bushing drift |
| 6 | 8100–9000s | 40.5–45s | LOAD_CURRENT=0, relay trip, TerminalFailureOverlay appears |

---

### Session 22 Plan (2026-03-22) — ARCHIVED

**Goal**: Implement `thermal_runaway` — a 6-stage cascading failure scenario that chains cooling failure → hot spot → oil/paper deterioration → partial discharge → arcing → terminal relay trip. The transformer actually "dies" (protection relay operates, LOAD_CURRENT → 0, overlay shown).

**Full implementation plan**: See [`docs/CASCADE_FAILURE_PLAN.md`](CASCADE_FAILURE_PLAN.md)

#### What's New (not in any existing scenario):
1. **6-stage multi-system cascade** — spans FM-001, FM-002, FM-003, FM-004, FM-006 across a single scenario
2. **Diagnostic sensor physics** — OIL_DIELECTRIC falls, OIL_MOISTURE rises (novel: no existing scenario modifies diagnostics)
3. **Terminal failure state** — engine `_terminal_failure` flag; scenario does NOT auto-reset; LOAD_CURRENT → 0
4. **TerminalFailureOverlay.tsx** — dramatic full-screen overlay: "PROTECTION RELAY OPERATED — TRANSFORMER TRIPPED"
5. **`get_diagnostic_modifiers()`** + **`is_terminal_failure()`** added to `BaseScenario` (default no-ops, backwards compatible)

#### Physics Rationale:
```
Fan seizure → ONAN cooling → oil can't remove heat → winding hot spot
→ Arrhenius-accelerated cellulose pyrolysis → CO/CO₂ + moisture
→ wet degraded oil → void PD discharges → H₂/CH₄
→ PD tracks across paper → arc channel → C₂H₂ spike
→ inter-winding short → differential relay → breaker trip
```

#### Stage Timeline (@200× speed):
| Stage | Sim-time | Real-time | Name |
|-------|----------|-----------|------|
| 1 | 0–1500s | 0–7.5s | Cooling System Failure |
| 2 | 1500–3000s | 7.5–15s | Hot Spot Formation |
| 3 | 3000–4800s | 15–24s | Oil & Paper Deterioration |
| 4 | 4800–6600s | 24–33s | Partial Discharge |
| 5 | 6600–8100s | 33–40.5s | Arc Development |
| 6 | 8100–9000s | 40.5–45s | **Terminal Failure** |

#### Files to Create:
- `backend/scenarios/thermal_runaway.py` (new scenario class)
- `frontend/src/components/panels/TerminalFailureOverlay.tsx` (new UI overlay)

#### Files to Modify:
- `backend/scenarios/base.py` — add `get_diagnostic_modifiers()` + `is_terminal_failure()` (default no-ops)
- `backend/models/schemas.py` — add `"thermal_runaway"` to `ScenarioId`, `terminal_failure` to `WSScenarioUpdateSchema`
- `backend/simulator/engine.py` — terminal failure state machine + diagnostic offset application + `_emit_terminal_failure_alert()`
- `backend/scenarios/manager.py` — register `ThermalRunawayScenario`
- `backend/config.py` — add `SCENARIO_THERMAL_RUNAWAY_DURATION_S` + stage boundary constants
- `frontend/src/types/scenario.ts` — add `thermal_runaway`
- `frontend/src/store/index.ts` — add `terminalFailure: boolean`
- `frontend/src/hooks/useWebSocket.ts` — handle `terminal_failure` in `scenario_update`
- `frontend/src/components/common/ScenarioSelector.tsx` — add scenario card (red DANGER styling)
- `frontend/src/components/common/ScenarioProgressBar.tsx` — terminal failure banner
- `frontend/src/App.tsx` — render `TerminalFailureOverlay`
- `docs/INTEGRATION_CONTRACT.md` — document new `terminal_failure` field

#### Session 22 Log Entry
| 2026-03-22 | 22 | Designed and planned thermal_runaway cascading failure scenario. Implementation plan in docs/CASCADE_FAILURE_PLAN.md. |

---

## Current Status: 🟢 Session 21 Complete — UX Polish: Readability, Dynamic Economics, Actionable Alerts

### Session 21 Additions (2026-03-22)

**Context**: Four UX issues identified via visual inspection. All implemented without breaking any existing tests. 28/28 backend + 125/125 frontend tests pass. TypeScript compiles clean.

#### IMPROVEMENT-1: AssetKPIBar readability (`AssetKPIBar.tsx`)
- Increased KPI tile min-width `96px → 120px`, label font `text-[9px] → text-[10px]`, value font `text-sm → text-[15px]`
- Progress bar height `h-[3px] → h-1`, tile padding `py-1.5 → py-2`, container gaps increased
- Nameplate text `text-[9px] → text-[10px]`, ID label `text-xs → text-sm`

#### IMPROVEMENT-2: Dynamic economic analysis (`decision_engine.py`)
- `act_now` cost now scales with active failure mode count (+25% per FM) and maintenance window (2h base → 4h with Probable fault)
- `no_action` outage days extend to 10.5 days (from 7) when `risk_score > 0.8`
- Descriptions now reference specific failure mode names driving cost increases
- All three scenario totals visibly change as conditions worsen during fault scenarios

#### IMPROVEMENT-3: Clickable alert toasts (`AlertToast.tsx`, `store/index.ts`, `TabContainer.tsx`)
- Lifted `activeTab` state from TabContainer's local `useState` to Zustand store (`activeTab: string`, `setActiveTab`)
- AlertToast: removed `pointer-events-none`, added `cursor-pointer` + click handler → switches to Alerts tab + closes toast
- Added "View in Alerts tab →" footer prompt in the toast UI

#### IMPROVEMENT-4: Specific steps in risk recommendation (`DecisionPanel.tsx`)
- "Recommended Action" section now shows top 3 steps from the most active runbook inline
- Steps are numbered with the procedure ID (e.g., OP-TRF-004) for traceability
- "+N more in Runbooks below ↓" link when runbook has >3 steps

#### Session 21 Log Entry
| 2026-03-22 | 21 | UX polish: AssetKPIBar readability, dynamic economic analysis, clickable alert toasts (store-lifted tab state), specific runbook steps in risk recommendation. All tests pass. |

---

## Current Status: 🟢 Session 20 Complete — Comprehensive Diagnosis + 5 Bug Fixes

### Session 20 Additions (2026-03-22)

**Context**: User reported app broken after recent changes. Ran full app diagnosis via Playwright visual QA + backend tests + network inspection. Found 5 bugs (2 high severity, 3 low/medium), all fixed. 28/28 backend tests + 125/125 frontend tests continue to pass. Build clean.

#### FIX-1 (HIGH): Cascade failure banner persists after Normal Operation (`engine.py`, `useWebSocket.ts`)
- **Root cause (dual)**: `_emit_scenario_update()` is guarded by `if scenario_id != "normal"` so no WS message clears `cascade_triggered` on the frontend. Backend `_cascade_triggered` flag also took ~10 real min to decay at 1× speed.
- **Fix**: Added `else` block on scenario-transition detection — immediately resets `_cascade_triggered=False`, `_winding_critical_duration=0`, and emits a final `scenario_update` with `cascade_triggered=False`. Added defensive `cascadeNow = scenario_id === 'normal' ? false : rawCascade` guard in `useWebSocket.ts`.

#### FIX-2 (MEDIUM): Prognostics intervention projection double-counted warmup degradation (`prognostics.py`)
- **Root cause**: `project_intervention()` subtracted `rate_per_hr * warmup` from `score_after_warmup` — which already included that warmup degradation — then added `intervention_rate_per_hr * remaining`. Double-subtraction produced overly pessimistic intervention scores.
- **Fix**: Removed erroneous term. Formula: `score_after_warmup + intervention_rate_per_hr * remaining`.

#### FIX-3 (LOW): WSSetSpeedSchema cap too restrictive (`schemas.py`, `websocket_handler.py`)
- `WSSetSpeedSchema` had `le=60` while REST API and UI both support up to 200×.
- **Fix**: Changed to `le=200`; error message updated to "1–200".

#### FIX-4 (LOW): Frontend nameplate mismatch (`AssetKPIBar.tsx`)
- Hardcoded "Siemens AG / 220/33kV / 2009" didn't match backend config (GE Vernova / 230/69kV / 2005).
- **Fix**: Updated to match `config.py` TRANSFORMER_* constants exactly.

#### FIX-5 (LOW): ISSUE-031 "Rapidly Degrading" label on fresh load (`prognostics.py`)
- With 2 history points, a 0.1 pt health dip produced massive apparent rate → RAPIDLY_DEGRADING.
- **Fix**: Added `n >= 10` gate before assigning RAPIDLY_DEGRADING trend label.

#### Session 20 Log Entry
| 2026-03-22 | 20 | Comprehensive app diagnosis (Playwright QA + backend tests + network). Fixed 5 bugs: cascade banner persistence (HIGH), prognostics double-subtraction (MED), speed schema cap, nameplate mismatch, rapidly-degrading fresh-load gate. |

---

## Current Status: 🟢 Session 19 Complete — Full QA + 6 Bug Fixes

### Session 19 Additions (2026-03-22)

**Context**: Ran full Playwright QA across all 14 feature areas (cleared screenshots folder, took fresh screenshots). Wrote comprehensive new `docs/analysis.md` with 7 bugs found (BUG-NEW-1→7). Implemented 6 fixes covering the most impactful issues.

#### FIX-1: Anomaly alert absolute deviation floor (`anomaly_detector.py`)
- Added `_MIN_ABS_DEVIATION` dict: thermal sensors require ≥2°C absolute deviation before any alert fires.
- Eliminates spurious CAUTION alerts for sub-degree fluctuations that produce high z-scores due to very low natural noise.

#### FIX-2: Anomaly alert title clearer (`engine.py`)
- Changed from `"{sensor} — {STATUS} Level Reached"` to `"{sensor} — Anomaly Detected"`.
- The old title was misleading — z-score anomalies are pattern deviations, not absolute threshold crossings.
- Also updated description to say "deviates from baseline" instead of "has reached {status} level".

#### FIX-3/3b: Decision engine cascade-aware risk (`decision_engine.py`, `routes_decision.py`)
- Added `cascade_triggered: bool = False` parameter to `DecisionEngine.compute()`.
- When True, forces risk level to at least "HIGH" regardless of health score calculation.
- Health lags the physical fault by many minutes; cascade is an immediate HIGH risk signal.
- `routes_decision.py` now reads `simulator._cascade_triggered` and passes it through.

#### FIX-4: 70% Load override is a cap, not a fixed set (`engine.py`)
- Changed load application from `load_fraction = operator_load_override` to `min(operator_load_override, natural_load)`.
- Previously, clicking "70% Load" when load was 42% would raise load to 70%, increasing thermal stress.
- Now it correctly caps the natural profile at 70% without raising load below that level.

#### FIX-5: FMEA detects early hot spot via physics model deviation (`config.py`, `fmea_engine.py`)
- Lowered `FMEA_MIN_REPORT_SCORE` from 0.30 to 0.25.
- Updated `_score_fm_001` to compute `dev_pct` from `state.expected_winding_temp` (IEC physics model).
- A winding at 75°C when model predicts 35°C is 114% above model → e2=1.0 → match_score≈0.25 → appears as "Monitoring".
- This surfaces FM-001 during Stage 2 hot_spot before absolute caution threshold (90°C) is reached.

#### FIX-6: Projected health scores display fix (`PrognosticsWidget.tsx`)
- Changed `score.toFixed(0)` to `Math.max(0, Math.min(100, Math.round(score)))` in `ProjectionBars`.
- Prevents displaying "1" (from `(0.5).toFixed(0) = "1"`) when projected score is near zero.
- Shows "0" for projected scores below 0.5 instead of the misleading "1".

#### Session 19 Log Entry
| 2026-03-22 | 19 | Full Playwright QA (all 14 areas) → new analysis.md with 7 bugs. Implemented 6 fixes: anomaly abs-dev floor, alert title clarity, cascade→decision risk, 70%-Load as cap, FMEA early detection via physics model, projected score display fix. |

---

## Current Status: 🟢 Session 18 Complete — QA Analysis + 8 Bug Fixes

### Session 18 Additions (2026-03-22)

**Context**: Ran full Playwright QA across all 14 feature areas (see `docs/analysis.md`). Found 4 bugs during live testing (BUG-001→004), plus addressed all 4 outstanding issues from ISSUES.md (ISSUE-027→030). All 8 items now resolved.

#### BUG-001 Fixed: App crash on first load (SensorRow.tsx)
- `expected != null` guard (was `!== undefined`): backend sends `null` on first tick, not `undefined`. This crashed `null.toFixed(1)` in every render. Now safe.

#### BUG-002 Fixed: FAN_BANK/OIL_PUMP showed raw sensor IDs (constants.ts)
- Added SENSOR_META entries for `FAN_BANK_1`, `FAN_BANK_2`, `OIL_PUMP_1` so labels show "Fan Bank 1" etc.

#### BUG-003 Fixed: OIL_DIELECTRIC LimitBar always at 100% (constants.ts, SensorRow.tsx)
- Added `invertedScale?: boolean` to `SensorMeta`. `OIL_DIELECTRIC` now shows ~0% fill (healthy) for 54 kV and fills toward 100% as voltage approaches 30 kV (critical minimum).

#### BUG-004 Fixed: "−7.4°C above model" for below-model readings (OperatingEnvelopeChart.tsx)
- Made "above/below" direction word dynamic based on deviation sign.

#### ISSUE-027 Fixed: Anomaly alert flood during high-speed operation
- `AnomalyDetector.reset_history()` added — clears rolling baselines + last_status.
- `SimulatorEngine.set_speed()` now calls `anomaly_detector.reset_history()` when speed changes. Forces 20-sample quiet period before any new alerts can fire.

#### ISSUE-028 Fixed: Direction-agnostic recommended actions
- Added `_ANOMALY_RECOMMENDED_ACTIONS_BELOW_MODEL` dict for TOP_OIL_TEMP, BOT_OIL_TEMP, WINDING_TEMP.
- `_emit_anomaly_alert()` selects the below-model actions when `deviation_pct < 0` for thermal sensors.

#### ISSUE-029 Fixed: Snapshot API returns NORMAL for boolean fan/pump sensors
- `GET /api/sensors/snapshot` now maps boolean sensors (where `SENSOR_UNITS[sid] == "boolean"`) to ON/OFF status based on stored float value (≥0.5 → ON, <0.5 → OFF).

#### ISSUE-030 Fixed: Physics Correlation Y-axis fixed at 0–150°C
- `CorrelationChart.tsx` now computes `tempDomain` from actual data range ± 10% padding (rounded to nearest 5°C). Normal operation data (25–45°C) now fills the chart height.

#### Session 18 Log Entry
| 2026-03-22 | 18 | Comprehensive QA (analysis.md) + 8 bug fixes: BUG-001 null-guard crash, BUG-002 FAN/PUMP labels, BUG-003 invertedScale dielectric, BUG-004 above/below phrasing, ISSUE-027 anomaly reset on speed change, ISSUE-028 direction-aware actions, ISSUE-029 snapshot boolean ON/OFF, ISSUE-030 auto-scale correlation Y. 28/28 backend tests pass. |

---

## Current Status: 🟢 Session 17 Complete — Critical Bug Fixes (Refresh + UI Stability)

### Session 17 Additions (2026-03-21)

**Context**: User reported the app "refreshes" and "can't click many buttons." A deep code analysis identified 5 root-cause bugs; all fixed.

#### Bug Fix: WebSocket Reconnects on Every Playback Toggle (`useWebSocket.ts`)
- **Root cause**: `mode` was in `handleMessage`'s `useCallback` dep array → `connect` was recreated → `useEffect([connect])` re-ran on every LIVE/playback switch, closing and reopening the WebSocket.
- **Fix**: Replaced `const mode = useStore(...)` with a `modeRef` + a syncing `useEffect`. `modeRef.current` is read inside `handleMessage` at call time; `mode` no longer appears in the dep array. `handleMessage` and `connect` are now stable for the lifetime of the component.

#### Bug Fix: StrictMode Double WebSocket Connections (`useWebSocket.ts`)
- **Root cause**: React StrictMode's cleanup+re-run caused the `onclose` handler to fire and schedule a reconnect via a stale `connect_v1` closure. If the new `connect_v2` socket was still CONNECTING, `connect_v1` opened a third parallel connection — causing racing store writes.
- **Fix**: Added `isIntentionalCloseRef` boolean. The cleanup sets it to `true` before calling `ws.close()`. The `onclose` handler returns immediately if the flag is set, skipping the reconnect timer. Also strengthened the guard from `readyState === OPEN` to `readyState === OPEN || readyState === CONNECTING`.

#### Bug Fix: Compact Health Strip — ~142px → ~44px (`HealthBreakdown.tsx`, `TabContainer.tsx`)
- **Root cause**: The always-visible HealthBreakdown had 6 rows × ~22px = ~132px + padding = ~142px. On a 14" MacBook Pro, this left only ~385px for tab content with a fault scenario active.
- **Fix**: Added `compact` prop to `HealthBreakdown`. In compact mode, 6 components render as inline colored-dot chips (`flex-wrap` row) with hover/click behavior preserved. TabContainer now uses `<HealthBreakdown compact />` with a 44px gauge, total strip ~44px. Gain: ~100px more content area.

#### Bug Fix: ScenarioProgressBar No Longer Causes Layout Shift (`ScenarioProgressBar.tsx`)
- **Root cause**: The multi-line block (scenario name row + stage row + progress bar = ~90px) appeared suddenly when a fault scenario started, shifting all content down by 90px mid-interaction.
- **Fix**: Rewritten as a compact single-line strip (~32px): "⚡ [Scenario Name] [mini-bar] [X%]". All info preserved. Layout shift eliminated. Total savings with health strip fix: ~160px more content area on smaller screens.

#### Bug Fix: Playback Slider Max Froze When Entering Playback (`store/index.ts`, `useWebSocket.ts`, `BottomTimeline.tsx`)
- **Root cause**: `simTime` is suppressed in playback mode (sensor_update messages ignored), so the slider `max` froze at the simTime when playback was entered.
- **Fix**: Added `maxAvailableSimTime` to the store (always updated in both live and playback modes via a dedicated `setMaxAvailableSimTime` action). The playback slider now uses this value for its `max` attribute.

#### Session 17 Log Entry
| 2026-03-21 | 17 | Bug fixes: (1) WS mode-dep reconnect — modeRef breaks dep chain; (2) StrictMode double-connect — isIntentionalCloseRef + CONNECTING guard; (3) HealthBreakdown compact prop — 142px → 44px strip; (4) ScenarioProgressBar single-line — 90px → 32px; (5) maxAvailableSimTime for playback slider max. 28/28 backend + 125/125 frontend tests pass. Build clean. |

---

## Current Status: 🟢 Session 16 Complete — True Digital Twin Paradigm

### Session 16 Additions (2026-03-21)

This session addresses the **fundamental gap between "monitoring dashboard" and "digital twin"**: the model-vs-reality paradigm. Previous sessions had all the visual chrome, but the core DT insight — _what should it read vs what does it read_ — was missing. Now it's the centerpiece.

**Critical Analysis (as digital twin domain expert):**
The previous system's "expected" value in sensor readings used a rolling statistical mean of recent actuals — that is a statistical anomaly detector, not a digital twin. A real DT continuously runs the physics model in parallel and compares: "given load=72%, ambient=28°C, cooling=ONAF, IEC 60076-7 predicts 68°C — actual is 79°C — this +11°C gap is the fault signature." This distinction is what GE SmartSignal and similar platforms are built on.

#### Feature: Physics-Based Model vs. Reality (THE Core DT Change)

**Backend — `simulator/thermal_model.py`:**
- Added `winding_temp_physics: float` field to `ThermalState` dataclass — the IEC 60076-7 prediction without scenario modifier
- `tick()` now returns both `winding_temp` (observed, includes fault delta) and `winding_temp_physics` (pure physics prediction)
- Comment explains the digital-twin significance: "gap = fault signature"

**Backend — `models/schemas.py`:**
- Added `expected_top_oil_temp`, `expected_winding_temp`, `expected_bot_oil_temp` to `TransformerState` (all default 0.0, backward compatible)
- Updated DGA default values to match new config baseline

**Backend — `simulator/engine.py`:**
- `_tick()` now captures expected values from thermal model BEFORE scenario modifiers: `state.expected_*` = IEC 60076-7 prediction
- `_emit_sensor_group()` uses physics-based expected values instead of rolling mean for the `expected` field in WebSocket messages — **this is the paradigm shift**
- Added `_last_scenario_id` tracking to detect scenario transitions
- New `_emit_scenario_start_alert()` method: emits an equipment/operational alert at the START of each scenario (before thermal consequences manifest), making fault causality physically realistic

#### Feature: Realistic Equipment Fault Alarms at Scenario Start
Five scenario-specific startup alerts that fire when a scenario begins:
- `hot_spot`: "Abnormal Winding Temperature Rise Detected — IEC model deviation >10°C"
- `cooling_failure`: "EQUIPMENT ALARM: Cooling Fan Protection Tripped — Overcurrent" (CRITICAL severity)
- `arcing`: "PROTECTION ALERT: Buchholz Relay Pre-Trip Condition"
- `partial_discharge`: "Online Monitor: Partial Discharge Activity Increasing"
- `paper_degradation`: "Insulation Aging Monitor: CO/CO₂ Ratio Declining"

In real SCADA, the equipment event fires FIRST, then thermal consequences follow. This is now correct.

#### Feature: Model-vs-Actual Deviation in SensorRow (`SensorRow.tsx`)
For the three thermal sensors (TOP_OIL_TEMP, WINDING_TEMP, BOT_OIL_TEMP):
- Shows `mdl +11.2°C` badge when deviation ≥ 0.5°C
- Color-coded: grey (< 5°C), yellow (5–10°C), orange (10–15°C), red (≥ 15°C)
- Expandable context line shows "IEC model: 68.0°C · actual: 79.4°C" when deviation ≥ 2°C
- This is the defining digital twin signal — visible in the sensor panel at all times

#### Feature: DGA Rate-to-Threshold (`DGASummary.tsx` — fully rewritten)
- TDCG bar: visual fill with IEEE C57.104 thresholds (720/1920/4630 ppm) marked
- CO₂/CO Ratio: color-coded bar with normal/caution/critical ranges; interpretation text
- Gas concentration table: for each gas, shows current ppm, trend arrow, rate (+X.X ppm/day), and **time-to-next-threshold** at current rate (e.g., "to CAUTION: 4 days")
- Time-to-threshold colored: red = hours, orange < 7 days, yellow < 30 days, slate = safe
- Standards badges: IEEE C57.104, IEC 60599

#### Feature: Operating Envelope Chart (`OperatingEnvelopeChart.tsx` — NEW)
The defining digital twin visualization — Load% vs Top Oil Temperature:
- **Blue curve**: IEC 60076-7 steady-state prediction at current cooling mode (ONAN/ONAF/OFAF)
- **Historical scatter points**: colored by deviation from model (grey=on-model, yellow=+2–5°C, orange=+5–10°C, red=>+10°C fault)
- **Live point**: large dot showing where transformer is RIGHT NOW on the envelope
- **Design limit lines**: CAUTION/WARNING/CRITICAL horizontal reference lines
- **Current operating callout**: shows Load%, Actual, Model, and deviation prominently
- **Explanation tile**: "Why This Matters" — explains the GE SmartSignal paradigm
- Added to Physics tab as the primary sub-tab (Operating Envelope | Temporal Correlation)

#### Feature: Realistic DGA Baseline (config.py + schemas.py)
Updated initial DGA gas levels to represent TRF-001 as a genuine 17-year-old in-service transformer:
- H₂: 15→25 ppm, CH₄: 8→12 ppm, C₂H₆: 12→15 ppm, C₂H₄: 3→4 ppm
- C₂H₂: 0.2→0.5 ppm, CO: 80→120 ppm, CO₂: 600→900 ppm
- CO₂/CO ratio = 7.5 → within normal aging range (5–13 per IEEE C57.104)
- TDCG baseline = 176.5 ppm — well within Level 1 (<720 ppm)

#### Session 16 Log Entry
| 2026-03-21 | 16 | Real DT paradigm: physics model vs. reality in thermal sensors (winding_temp_physics in ThermalState, expected_* in TransformerState, engine captures IEC 60076-7 prediction), scenario-start equipment alarms (5 scenarios), SensorRow model deviation badge, DGASummary rewrite (TDCG bar + CO₂/CO ratio + rate-to-threshold), OperatingEnvelopeChart (Load% vs Temp with IEC model curve + historical scatter + deviation coloring). 28/28 backend + 125/125 frontend tests pass. |

## Current Status: 🟢 Session 15 Complete — Digital Twin Visual & UX Overhaul

### Session 15 Additions (2026-03-21)

This session addresses the five most impactful gaps: **the project looked like a dashboard, not a digital twin.** All changes are frontend-only, additive. 125/125 tests still pass.

**Why these 5?** A visitor couldn't answer: (1) what transformer is this? (2) where is the heat? (3) what happened and when? (4) is this reading abnormal? (5) does the physics actually work? — now they can.

#### Asset KPI Bar (`AssetKPIBar.tsx` — NEW)
Full-width strip between header and 3D viewer:
- Transformer nameplate: TRF-001 | 100 MVA | 220/33 kV | ONAN/ONAF/OFAF | Siemens AG | Bay 3 Substation | Est. 2009
- 5 live KPI tiles: Load Factor (% of rated), Winding Temp (% of 140°C limit), Top Oil Temp (% of 95°C limit), Health Index, Est. Time-to-Critical
- Each tile has a color-coded fill bar (green→yellow→orange→red) and status sub-label
- IEC 60076-7 / IEC 60599 / IEEE C57.104 standard badges — proves domain authenticity

#### Thermal Gradient 3D Model (`Tank.tsx` — REWRITTEN)
The tank body now **visualizes the oil thermal gradient** from bottom to top:
- 5 horizontal slices interpolating BOT_OIL_TEMP (bottom) → TOP_OIL_TEMP (top) emissive colors
- Temp→color: <50°C=no glow | 65°C=amber | 75°C=orange | 85°C=red | 95°C+=critical red
- `lerpEmissive()`: hex-color interpolation for smooth gradient
- Health selection highlight still overrides temperature gradient when active
- This is the defining digital-twin visual: **you can SEE where heat accumulates in the oil column**

#### Animated Oil Circulation (`RadiatorBank.tsx` — ENHANCED)
When FAN_BANK_1, FAN_BANK_2, or OIL_PUMP_1 is ON:
- 7 animated sky-blue particles (one per inter-fin channel) move upward via `useFrame`
- Phase-staggered for realistic non-uniform flow; fade-out near top for seamless loop
- Makes the cooling system VISUALLY ACTIVE — not just a color change

#### Event Timeline Tab (`EventTimeline.tsx` + store + `useWebSocket.ts` — NEW TAB)
Chronological operational log capturing everything that happens during a session:
- Alert events, health drops (≥3pt), scenario stage changes, cascade events, connection events
- Color-coded severity (info/caution/warning/critical) with left border + dot
- Timeline tab shows event count badge; store caps at 300 events
- New: `frontend/src/types/timeline.ts`, `TimelineEvent` in store, `addTimelineEvent` action

#### Sensor Trend + Limit Bars (`SensorRow.tsx` — ENHANCED)
- **Trend arrow**: ↑/→/↓ from last 4 readings; orange when rising+anomalous
- **Limit bar**: 3px fill bar showing value as % of CRITICAL threshold, color-coded by status

#### Physics Correlation Chart (`CorrelationChart.tsx` — NEW TAB "Physics")
Dual Y-axis chart proving IEC 60076-7 thermal physics is working:
- Load% (left, indigo) correlated with Top Oil °C (orange), Winding °C (red), Bot Oil °C (gray dashed) over time
- IEC reference lines: 140°C winding, 95°C top-oil, 100% load limits
- 3 explanation tiles: causal physics, thermal gradient theory, fault signature pattern
- History aligned on sim_time, down-sampled to ≤120 points for performance

#### Session 15 Log Entry
| 2026-03-21 | 15 | Digital twin overhaul: AssetKPIBar (nameplate + 5 KPI tiles), Tank thermal gradient (5-slice BOT→TOP interpolation), RadiatorBank animated oil flow (useFrame particles), EventTimeline tab (alert/health/scenario/cascade events), SensorRow trend+limit bars, CorrelationChart Physics tab (dual Y-axis load vs temps). 125/125 tests, build clean. |

### Session 14 Additions (2026-03-21)

This session adds the "secret sauce" that makes TransformerTwin feel like a real digital twin rather than a monitoring dashboard: **emergent physics, irreversible damage, and predictive capability**.

#### Feature: Automatic Fault Cascade (Thermal→Arcing)
When a fault scenario is running and winding temperature stays at CRITICAL (≥120°C) for more than 5 simulated minutes, the system organically escalates to arcing — without any operator intervention:
- **`backend/config.py`**: Added `CASCADE_ARCING_TRIGGER_S=300.0`, `CASCADE_C2H2_RATE_PPM_PER_S`, `CASCADE_H2_RATE_PPM_PER_S`, `CASCADE_CH4_RATE_PPM_PER_S`, `CASCADE_ARCING_RAMP_S=600.0`
- **`backend/simulator/engine.py`**: Tracks `_winding_critical_duration` per tick; once threshold exceeded, injects escalating C₂H₂+H₂ DGA rates via `dga_mods`; emits one-time CRITICAL alert "CASCADE FAILURE: Thermal→Arcing Escalation"; broadcasts `cascade_triggered`, `cascade_duration_s` in `scenario_update` WebSocket messages
- **Frontend**: `cascadeTriggered` state in store (set via `updateScenario`); `CascadeBanner` in `ScenarioProgressBar.tsx` (red banner at top of tab area); flashing red emergency section in `DecisionPanel.tsx`

#### Feature: Thermal Fatigue Tracking (Irreversible Insulation Aging)
Cumulative degree-hours above 105°C (the insulation onset threshold) that never reset — modeling permanent insulation damage:
- **`backend/config.py`**: Added `FATIGUE_ONSET_THRESHOLD_C=105.0`, `FATIGUE_FULL_DAMAGE_DEGREE_HOURS=1000.0`
- **`backend/simulator/engine.py`**: `_thermal_stress_integral` accumulates `(winding_temp - 105°C) × dt_hr` each tick; exposed as `thermal_fatigue_score` property (0.0–1.0); broadcast in `scenario_update`
- **Frontend**: `thermalFatigueScore` in store; `ThermalFatigueBar` in `PrognosticsWidget.tsx` showing cumulative % with label (Negligible/Low/Moderate/High/Severe) and description

#### Feature: Prognostics Engine — Time-to-Failure Prediction
The system now predicts the future: how long until WARNING and CRITICAL thresholds are breached, and what intervention would buy:
- **`backend/analytics/prognostics.py`** (NEW): `PrognosticsEngine.compute()` runs linear regression on health score history → degradation rate (pts/sim-hr), trend (RAPIDLY_DEGRADING/DEGRADING/STABLE/IMPROVING), time-to-WARNING (health <60), time-to-CRITICAL (health <40), projected health at 24h/48h/72h under no-action and 70%-load intervention
- **`backend/config.py`**: Added `PROGNOSTICS_HISTORY_LEN=100`, `PROGNOSTICS_MIN_HISTORY_POINTS=8`, warning/critical thresholds, horizon, intervention constants
- **`backend/api/routes_prognostics.py`** (NEW): `GET /api/prognostics` endpoint
- **`backend/main.py`**: Registered `routes_prognostics`
- **`frontend/src/types/prognostics.ts`** (NEW): Full TypeScript types for `PrognosticsResponse`, `ThermalFatigue`, `ProjectedHealth`, `InterventionProjection`
- **`frontend/src/lib/api.ts`**: Added `getPrognostics()`
- **`frontend/src/hooks/useApi.ts`**: Added `fetchPrognostics()`
- **`frontend/src/store/index.ts`**: Added `prognostics` state + `setPrognostics` action
- **`frontend/src/App.tsx`**: Initial fetch + 5s polling for prognostics

#### Feature: PrognosticsWidget
New `frontend/src/components/panels/PrognosticsWidget.tsx` with:
- Degradation rate display (pts/sim-hr, color-coded by severity)
- Time-to-WARNING and Time-to-CRITICAL countdowns
- 3-column projected health bars (24h/48h/72h) comparing no-action vs 70%-load intervention
- Thermal fatigue progress bar
- Urgency-based border color (red for CRITICAL/EMERGENCY, orange for HIGH, yellow for MEDIUM)
- Embedded in Decision tab between Risk Assessment and Recommended Action

#### Enhancement: FMEACard Evidence Chain Visualization
`frontend/src/components/panels/FMEACard.tsx` rewritten:
- Matched evidence renders as a **visual causal chain** with connecting vertical line, node dots, and sensor value badges
- Unmatched conditions shown dimly below
- Confidence label badge added to header row alongside failure mode ID
- Match score progress bar always visible under the header (red/orange/yellow)
- Affected components rendered as monospace tag badges
- Metadata row (severity + development time) above recommended actions

All tests still pass: 28/28 backend, 125/125 frontend. Frontend TypeScript build clean.

### Session 13 Additions (2026-03-21)

#### Bug Fix: Speed 100×/200× not activating
- Root cause: `SpeedUpdateRequestSchema` had `Field(ge=1, le=60)` — Pydantic rejected 100 and 200
- Fix: changed to `Field(ge=1, le=200)` in `backend/models/schemas.py`
- Also fixed `engine.py` docstring ("1–60" → "1–200")

#### Feature: Health Component → 3D Highlight
Clicking a health component row in HealthBreakdown now highlights the corresponding 3D parts:
- `HealthBreakdown.tsx`: rows are now clickable buttons; selected row shown with cyan ring + sky-blue bar
- `useHealthColor.ts`: when `selectedHealthComponent === key`, returns `{ emissive: '#38bdf8', emissiveIntensity: 1.8 }` (bright cyan override)
- `store/index.ts`: added `selectedHealthComponent: HealthComponentKey | null` + `setSelectedHealthComponent`
- `types/parts.ts`: added `healthKey: 'cooling'` to `fan_1` and `fan_2` entries
- `parts/FanUnit.tsx`: reads `selectedHealthComponent === 'cooling'` from store, overrides ON/OFF color with cyan when selected
- Click the same row again to deselect and clear the 3D highlight
- Mapping: DGA→Buchholz relay, Winding→Tap Changer, Oil Temp→Tank, Cooling→Radiator+Fans+Pump, Oil Quality→Conservator, Bushing→HV+LV Bushings

#### Feature: Operator Control System (the killer demo feature)
Real-time operator interventions that directly affect the physics simulation:

**Backend:**
- `backend/api/routes_operator.py` (NEW): `POST /api/operator/actions`, `GET /api/operator/status`
- `backend/simulator/engine.py`: added `operator_load_override: float | None` + `operator_cooling_override: str | None`
  - `set_operator_load(fraction)` / `set_operator_cooling(mode)` / `clear_operator_overrides()`
  - Applied in `_tick()`: operator overrides take precedence over normal profile and scenario overrides
- `backend/models/schemas.py`: added `OperatorActionRequestSchema`, `OperatorStatusResponseSchema`, `OperatorActionType`
- `backend/main.py`: registered `/api/operator/actions` and `/api/operator/status` routes

**Frontend:**
- `frontend/src/types/operator.ts` (NEW): `OperatorAction` union type + `OperatorStatus` interface
- `frontend/src/lib/api.ts`: added `executeOperatorAction()`, `getOperatorStatus()`
- `frontend/src/hooks/useApi.ts`: added `fetchOperatorStatus()`
- `frontend/src/store/index.ts`: added `operatorStatus`, `setOperatorStatus`
- `frontend/src/App.tsx`: initial fetch + 5s polling for operator status
- `frontend/src/components/panels/DecisionPanel.tsx`: **Operator Controls** section (always shown at top of Decision tab)
  - Load Management: 70% Load / 40% Load / Full Load (toggle buttons, active state shown with checkmark)
  - Cooling Mode: Auto / ONAF / OFAF (toggle buttons)
  - Active overrides: pulsing green banner "Active: Load 70% + ONAF cooling"
  - "Restore Normal" button clears all overrides
  - Immediate feedback message after each action

**Demo sequence**: trigger hot_spot → watch winding temp climb → click "70% Load" + "ONAF" → watch temperatures flatten and recover over ~30 real seconds at 30× speed. This closes the feedback loop and turns the system from passive monitoring to active control.

All tests still pass: 28/28 backend, 125/125 frontend.

### Session 12 Additions (2026-03-21)
- **Speed options expanded**: Now supports 1×, 10×, 30×, 60×, 100×, 200× (was capped at 60×). At 200× you can watch a full 3-hour fault scenario in 54 real seconds.
- **Actionable anomaly alerts**: Every sensor anomaly alert now includes sensor-specific step-by-step recommended actions (9 sensors covered: thermal and all DGA gases). Previously `recommended_actions` was always `[]`.
- **Decision Support System** — the centerpiece real-world use case feature:
  - `backend/analytics/decision_engine.py`: New `DecisionEngine` class computing risk, RUL, economics, and runbooks
  - `backend/api/routes_decision.py`: `GET /api/decision` REST endpoint
  - `backend/config.py`: Economic constants (transformer replacement $3.2M, outage $85k/day, maintenance $12k)
  - `frontend/src/types/decision.ts`: Full TypeScript types for decision response
  - `frontend/src/components/panels/DecisionPanel.tsx`: New tab panel with 4 sections
  - Polling: `fetchDecision()` called on mount + every 5s alongside DGA/FMEA
- **Decision Panel sections**:
  1. **Asset Risk Assessment**: 5-dot visual risk meter (NOMINAL/LOW/MEDIUM/HIGH/CRITICAL), risk description
  2. **Recommended Action**: Specific action with deadline and business reasoning
  3. **Economic Impact Analysis**: 3-scenario cost table (Act Now ~$16k / Delay 14d ~$220k / Failure ~$3.8M) with potential savings
  4. **Operator Runbooks**: Per-fault step-by-step procedures (8 runbooks for FM-001 through FM-008) with interactive checkboxes, progress bar, and procedure ID
- **Tab indicator**: Decision tab shows orange/yellow dot when risk is MEDIUM or higher

All backend intelligence implemented. Anomaly detection, DGA analysis, FMEA, health score, what-if simulation, and WebSocket wiring all running. 28/28 integration tests passing. 125/125 frontend tests passing.

### Session 11 Additions (2026-03-21)
- **2 new fault scenarios**: Partial Discharge (CH4/H2 → Duval PD zone), Paper Insulation Degradation (CO/CO2 ratio decay)
- **FMEA alert emission**: Engine now emits `FMEA_ENGINE` alerts when confidence escalates (Monitoring→Possible→Probable) with full `recommended_actions` list
- **Richer anomaly descriptions**: Include current value, expected value, deviation %, and trend direction
- **Expandable AlertPanel**: Click any alert to expand description + recommended actions; FMEA alerts get purple badge + colored left border
- **ScenarioProgressBar**: Prominent color-coded strip (yellow→orange→red) above tab content during active fault simulations
- **AlertToast**: Transient CRITICAL/WARNING overlay on 3D viewer with fade-slide animation (5s auto-dismiss)

---

## Reading Order for a New Coding Agent

Before touching any code, read docs in this order:
1. `docs/INTEGRATION_CONTRACT.md` — authoritative field names, schemas, enums
2. `docs/PRD.md` — product requirements and feature acceptance criteria
3. `docs/BACKEND_ARCHITECTURE.md` — module responsibilities and data flow
4. `docs/DOMAIN_GUIDE.md` — transformer domain terminology
5. `docs/THERMAL_PHYSICS.md` — ⚠️ **Required before touching simulator/**
6. `docs/DGA_GAS_GENERATION.md` — ⚠️ **Required before touching dga_model.py**
7. `docs/DUVAL_TRIANGLE_VERTICES.md` — ⚠️ **Required before touching dga_analyzer.py**
8. `docs/FMEA_DEFINITIONS.md` — ⚠️ **Required before touching fmea_engine.py**
9. `docs/DECISIONS.md` — architecture decisions already made (do not re-debate)
10. This file — current implementation state

---

## Phase 0: Pre-Implementation Documentation ✅ COMPLETE
Target: Fill all physics/classification spec gaps before any business logic is written

- [x] **0.1** `docs/THERMAL_PHYSICS.md` — IEC 60076-7 thermal model, all formulas, all constants
- [x] **0.2** `docs/DGA_GAS_GENERATION.md` — per-gas base rates, Arrhenius constants, scenario modifiers
- [x] **0.3** `docs/DUVAL_TRIANGLE_VERTICES.md` — zone polygon vertices for classifier + SVG renderer
- [x] **0.4** `docs/FMEA_DEFINITIONS.md` — all 8 failure modes with conditions and weights
- [x] **0.5** `docs/improvement.md` — full gap analysis of skeleton vs docs
- [x] **0.6** `INTEGRATION_CONTRACT.md` updated — SensorStatus vs AlertSeverity callout, scenario durations
- [x] **0.7** `.env.example` — port and config documentation

---

## Phase 1: Backend Foundation
Target: Sensor simulator + FastAPI + WebSocket streaming

- [x] **1.1** Project scaffolding (FastAPI app, folder structure, dependencies)
  - All 35 backend files created across `simulator/`, `scenarios/`, `analytics/`, `api/`, `database/`, `models/`
  - `requirements.txt` with FastAPI, uvicorn, aiosqlite, pydantic, numpy (Python 3.13-compatible)
  - `.venv` created; `uvicorn main:app` starts and serves all REST endpoints
- [x] **1.2** Shared types and constants (`schemas.py`, `config.py`)
  - All Pydantic schemas matching Integration Contract exactly (WebSocket + REST)
  - All constants in `config.py` with explanatory comments (thresholds, sensor IDs, intervals)
- [x] **1.3** Sensor simulator — physics implementation
  > ⚠️ Read `docs/THERMAL_PHYSICS.md`, `docs/DGA_GAS_GENERATION.md` before starting.
  > All constants referenced in these docs must be added to `config.py` before writing formulas.
  - [x] **1.3a** Add new physics constants to `config.py`
    - Thermal: `THERMAL_TOP_OIL_RISE_RATED_C`, `THERMAL_WINDING_GRADIENT_C`, `THERMAL_HOT_SPOT_FACTOR_H`, `THERMAL_OIL_EXPONENT_N`, `THERMAL_WINDING_EXPONENT_M`, `THERMAL_TAU_OIL_S`, `THERMAL_TAU_WINDING_S`, `COOLING_PARAMS` dict
    - DGA: `DGA_BASE_RATES_PPM_PER_HR`, `DGA_THERMAL_THRESHOLD_C`, `DGA_ARRHENIUS_K`, `DGA_PAPER_THRESHOLD_C`, `DGA_PAPER_CO_K`, `DGA_PAPER_CO2_K`, `DGA_NOISE_SIGMA` dict
    - Noise: `NOISE_SIGMA` dict for all 21 sensors
  - [x] **1.3b** `simulator/load_profile.py` — implement `get_load_fraction(sim_time_s)` and `get_ambient_temp(sim_time_s)`
    - Weekday sinusoidal load: 35–85%, period 86400s, peak at 14:00 local
    - Weekend load: 35–65%, same period
    - Ambient: 15–35°C, period 86400s, peak at 15:00 local
    - Both functions must be pure (no side effects), deterministic, and accept `sim_time_s: float`
  - [x] **1.3c** `simulator/thermal_model.py` — implement `ThermalModel` class
    - `tick(dt_s, load_fraction, ambient_temp, cooling_mode)` → updates internal state
    - Returns `ThermalState(top_oil_temp, bot_oil_temp, winding_temp)` dataclass
    - Uses exponential lag formula from `docs/THERMAL_PHYSICS.md`
    - Reads all constants from `config.py` (zero magic numbers)
  - [x] **1.3d** `simulator/equipment_model.py` — implement `EquipmentModel` class
    - Fan bank 1 ON when `top_oil_temp > 75°C`, OFF when `< 70°C` (hysteresis)
    - Fan bank 2 ON when `top_oil_temp > 85°C`, OFF when `< 80°C`
    - Oil pump ON when `load_fraction > 0.80`, OFF when `< 0.75`
    - Tap position: follows load, nominally centered at 17, ±3 taps over load range
    - Cooling mode: ONAN when no fans, ONAF when fan bank 1, OFAF when pump active
  - [x] **1.3e** `simulator/dga_model.py` — implement `DGAModel` class
    - `tick(dt_s, winding_temp, scenario_modifier)` → updates gas state
    - Uses base rates + Arrhenius formula from `docs/DGA_GAS_GENERATION.md`
    - `scenario_modifier` is a dict of `{gas_id: extra_ppm_per_s}` from scenario engine
    - Gases accumulate (never reset) — this models real dissolved gas in oil
  - [x] **1.3f** `simulator/noise.py` — implement `add_noise(sensor_id, value)` function
    - Gaussian noise, per-sensor sigma from `NOISE_SIGMA` constants
    - Must not push value below 0 for gas sensors
  - [x] **1.3g** `simulator/engine.py` — wire the tick loop
    - `SimulatorEngine` class with `tick()` method called every `TICK_INTERVAL_SECONDS`
    - Computes `dt_s = tick_interval × speed_multiplier`
    - Calls: load_profile → thermal_model → equipment_model → dga_model → noise
    - Packages result as `TransformerState` Pydantic model
    - Exposes `get_current_state() → TransformerState`
- [x] **1.4** Fault injection system — wire scenario modifiers to physics
  > Scenario state machines (base.py, manager.py) already exist. This step wires their modifier output into the simulator engine.
  - [x] Fault scenario state machine — `scenarios/manager.py`, `scenarios/base.py`
  - [x] Scenario 1: Developing Hot Spot — `scenarios/hot_spot.py` (stages defined)
  - [x] Scenario 2: Arcing Event — `scenarios/arcing.py` (stages defined)
  - [x] Scenario 3: Cooling Fan Failure — `scenarios/cooling_failure.py` (stages defined)
  - [x] Scenario 4: Normal Operation — `scenarios/normal.py`
  - [x] Implement `get_thermal_modifiers()` / `get_dga_modifiers()` in each scenario file
    - `hot_spot.py`: increase `WINDING_TEMP` by stage-dependent delta; increase CH4, C2H4 DGA rates
    - `arcing.py`: add C2H2, H2 DGA rates; brief thermal spike
    - `cooling_failure.py`: disable fan banks in `EquipmentModel`; let oil temp rise naturally
    - `normal.py`: returns zero modifier (no-op)
- [x] **1.5** SQLite database setup and schema
  - Tables: `sensor_readings`, `health_history`, `alerts`
  - All CRUD queries in `database/queries.py`
  - Auto-migration on startup via `database/migrations.py`
- [x] **1.6** WebSocket endpoint — streaming simulator output
  - Wire `SimulatorEngine` output to `api/websocket_handler.py`
  - Broadcast `sensor_update` per group at correct sim-time intervals
  - Broadcast `scenario_update` on every thermal tick during active scenario
  - Broadcast `health_update` when score delta ≥ 0.5 (after Phase 2.4)
  - Broadcast `alert` when new alert generated (after Phase 2.1)
- [x] **1.7** REST endpoints — all 13 routes implemented as skeletons returning valid stub data
  - GET /api/transformer ✅
  - GET /api/sensors/current ✅
  - GET /api/sensors/history ✅
  - GET /api/health ✅
  - GET /api/health/history ✅
  - GET /api/dga/analysis ✅
  - GET /api/fmea ✅
  - GET /api/alerts ✅
  - PUT /api/alerts/{id}/acknowledge ✅
  - POST /api/simulation ✅
  - POST /api/scenario/{id}/trigger ✅
  - GET /api/scenario/status ✅
  - PUT /api/simulation/speed ✅

---

## Phase 2: Backend Intelligence
Target: Anomaly detection + DGA analysis + FMEA + Health score

> ⚠️ Read `docs/DUVAL_TRIANGLE_VERTICES.md` before 2.2, `docs/FMEA_DEFINITIONS.md` before 2.3.

- [x] **2.1** Anomaly detection engine — `analytics/anomaly_detector.py`
  - Rolling baseline: 360-tick window (= 30 sim-minutes) per thermal sensor
  - Z-score computation: `z = (value - mean) / std`
  - Classification: z > 2.0 → CAUTION, z > 3.5 → WARNING, z > 5.0 → CRITICAL (from `config.py`)
  - Rate-of-change check: if value changes > 10% of range per sim-minute → escalate by one level
  - Emit alert (via callback) on first detection and on level escalation (not every tick)
  - Only applies to thermal sensors (TOP_OIL_TEMP, BOT_OIL_TEMP, WINDING_TEMP, DGA group)
- [x] **2.2** DGA analysis module — `analytics/dga_analyzer.py`
  - Duval Triangle 1: classify current CH4/C2H4/C2H2 percentages into a `DuvalZone`
  - TDCG: sum of H2+CH4+C2H6+C2H4+C2H2+CO; compare against `TDCG_*_PPM` thresholds
  - CO2/CO ratio: check against `CO2_CO_RATIO_LOW` and `CO2_CO_RATIO_HIGH`
  - Gas rate trend: RISING if ppm increased >5% in last 10 readings, FALLING if decreased >5%, else STABLE
  - Returns `DGAAnalysisResponseSchema` (see Integration Contract Section 3.6)
- [x] **2.3** Failure mode engine — `analytics/fmea_engine.py`
  - All 8 failure modes (FM-001 through FM-008) evaluated via weighted evidence scoring
  - Only return modes with `match_score ≥ FMEA_MIN_REPORT_SCORE` (0.3)
  - Confidence labels: < 0.4 = Monitoring, 0.4–0.7 = Possible, ≥ 0.7 = Probable
  - Returns list sorted by `match_score` descending
- [x] **2.4** Health score calculator — `analytics/health_score.py`
  - 6-component weighted penalty model (weights in `HEALTH_WEIGHTS` in `config.py`)
  - Penalty per status level: CAUTION=25, WARNING=50, CRITICAL=100 (from `config.py`)
  - Formula: `score = 100 - Σ(penalty[status[component]] × weight[component])`
  - Clamp to [0, 100]
- [x] **2.5** What-if simulation engine — `api/routes_simulation.py`
  - IEC 60076-7 Annex A Arrhenius insulation aging: `V = exp(K × (θ_H - 98))`
  - Day-by-day timeline with projected temps and cumulative aging factor
  - Human-readable interpretation strings + cooling energy impact
- [x] **2.6** Wire all analytics into WebSocket stream
  - Analytics run in SimulatorEngine tick loop after each physics tick
  - `alert` message emitted for new/escalated anomalies
  - `health_update` message emitted when score delta ≥ 0.5
  - Sensor readings, health history, and alerts persisted to SQLite
  - REST routes (DGA, FMEA, health) read from `engine.latest_*` attributes
- [x] **2.7** Backend integration test — `tests/test_phase2_integration.py`
  - 28 tests: DGAAnalyzer (13), AnomalyDetector (4), HealthScore (5), FMEA (4), integration (2)
  - All Duval zones (PD, T1, T2, T3, D1, D2, DT) verified
  - Hot-spot scenario progression test: WINDING_TEMP WARNING + DGA CAUTION + FM-001 active + health < 85
  - What-if simulation plausibility test
  - **All 28/28 tests pass**

---

## Phase 3: Frontend Foundation ✅ COMPLETE
Target: 3D model + dashboard layout + WebSocket connection

- [x] **3.1** Project scaffolding (Vite + React + TypeScript + Tailwind)
  - All 60+ frontend files created across `types/`, `store/`, `hooks/`, `components/`, `lib/`
  - `npm install` succeeds; `npm run build` passes TypeScript strict check; dev server starts
- [x] **3.2** WebSocket hook and state management setup
  - `hooks/useWebSocket.ts` — exponential backoff reconnection, full message routing
  - `store/index.ts` — flat Zustand store with all state slices merged
  - `store/selectors.ts` — typed selectors for common derived state
- [x] **3.3** Dashboard layout (panels, grid system, dark theme)
  - `components/layout/Header.tsx` — 56px header with all controls
  - `components/layout/MainLayout.tsx` — 55/45 split
  - `components/layout/BottomTimeline.tsx` — 48px scenario progress bar
  - Full Tailwind dark theme in `tailwind.config.ts` + `styles/globals.css`
- [x] **3.4** 3D Transformer model (React Three Fiber) — skeleton geometry
  - All 9 mesh parts created in `components/viewer3d/parts/`
  - `TransformerScene.tsx` — R3F Canvas with lights, OrbitControls, shadows
  - StatusLegend, CameraResetButton overlays
- [x] **3.5** Sensor data panel (live values, sparklines)
  - `SensorPanel.tsx` — all 21 sensors in `SensorRow` list
  - `SensorSparkline.tsx` — 60-point Recharts sparkline
  - `TabContainer.tsx` — Sensors / DGA / FMEA / What-If / Alerts tabs
- [x] **3.6** Health score display (gauge/badge)
  - `HealthGauge.tsx` — SVG circular gauge
  - `HealthBreakdown.tsx` — component contribution bars

---

## Phase 4: Frontend Intelligence
Target: Charts + Duval Triangle + Alerts + Simulation + Playback

> ⚠️ Before implementing DuvalTriangle.tsx geometry: read `docs/DUVAL_TRIANGLE_VERTICES.md`.
> The ternary→Cartesian formula and all zone polygon vertices are defined there.

- [x] **4.1** Time-series charts skeleton — `SensorLineChart.tsx` with threshold reference lines
- [x] **4.2** Duval Triangle visualization (SVG) — `DuvalTriangle.tsx` fully implemented
  - [x] **4.2a** Zone polygons in `lib/duvalGeometry.ts` — all 7 zones with normalized Cartesian vertices from `docs/DUVAL_TRIANGLE_VERTICES.md`
  - [x] **4.2b** Ternary→Cartesian coordinate transform — correct IEC 60599 formula (CH4→BL, C2H4→BR, C2H2→Top)
  - [x] **4.2c** Live CH4/C2H4/C2H2 point + historical trail (last 20 readings, fading opacity)
- [x] **4.3** Alert/diagnostics panel — `AlertPanel.tsx` with acknowledge button
- [x] **4.4** FMEA diagnostic cards — `FMEACard.tsx` collapsible with evidence list
- [x] **4.5** What-if simulation panel — `WhatIfPanel.tsx` with sliders + `ProjectionChart.tsx`
- [x] **4.6** Historical playback (time slider + controls)
  - `BottomTimeline.tsx` rewritten: LIVE badge / playback button, time scrubber slider, scenario progress bar
  - `GET /api/sensors/snapshot?sim_time=X` backend endpoint added (returns all 21 sensors at closest sim_time)
  - `useWebSocket.ts` suppresses live sensor/health updates while in playback mode
  - `api.ts` updated with `getSensorsSnapshot()` method
  - `frontend/src/store/index.ts` updated with `duvalHistory: DuvalResult[]` ring buffer (max 20)
- [x] **4.7** Full integration test — run fault scenario, verify end-to-end
  - 28/28 backend integration tests pass
  - Frontend TypeScript build passes (tsc + vite build clean)
  - Manual verification: start backend on 8001, frontend on 5173, trigger hot_spot at 10×
    → sensor values change, Duval point moves, alerts appear, health drops

---

## Phase 5: Polish & Demo Prep ✅ COMPLETE
- [x] **5.1** UI polish (loading states, real sensor status)
  - `SensorRow.tsx`: replaced hardcoded `'NORMAL'` with live status from `useSensorReading` selector
  - `App.tsx`: added initial connecting overlay (spinner before first data) + disconnection banner when WS drops
- [x] **5.2** Error handling (WebSocket disconnect, API errors)
  - Initial REST fetches in `App.tsx` now have `.catch()` handlers (errors logged, not silent)
  - Disconnected banner displayed when `connectionStatus === 'disconnected'` and data was previously received
- [x] **5.3** Demo script — `docs/DEMO_SCRIPT.md` — 8-segment, ~10-minute walkthrough with talking points and troubleshooting guide
- [x] **5.4** README.md — full setup instructions, project structure, API reference, WebSocket protocol, architecture notes
- [x] **5.5** Final verification: 28/28 backend tests pass, frontend build clean (tsc + vite)

---

## Phase 6: Frontend Unit Tests ✅ COMPLETE
Target: Vitest + React Testing Library — per CLAUDE.md spec (was the only unimplemented testing layer)

- [x] **6.1** Vitest + @vitest/coverage-v8 installed; `vite.config.ts` updated with test config
  - `package.json` scripts: `npm test` (vitest run) and `npm run test:watch` (vitest)
  - Test environment: `node` (pure functions, no DOM needed for unit tests)
  - Include pattern: `src/__tests__/**/*.test.ts`
- [x] **6.2** `src/__tests__/duval-geometry.test.ts` — 53 tests
  - `ternaryToNormalized()`: all 3 triangle vertices, equal-thirds centroid
  - `normalizedToSVG()`: corner mappings, Y-flip behavior
  - `ternaryToCartesian()`: end-to-end, SVG bounds containment
  - `pointInPolygon()`: unit-square and right-triangle fixtures
  - **Zone classifications**: 10 tests verifying IEC 60599 known gas samples → T1, T2, T3, D1, D2, DT
  - `getTriangleSVGPoints()` / `polygonToSVGPoints()` format validation
  - `DUVAL_ZONE_COLORS` / `DUVAL_ZONE_LABELS` — all 7 zones present, colors are hex strings
  - `DUVAL_ZONE_POLYGONS` — 7 entries, all vertices in [0,1], ≥3 vertices each
- [x] **6.3** `src/__tests__/formatters.test.ts` — 35 tests
  - `formatSensorValue`, `formatHealthScore`, `formatSimTime`, `formatSimDuration`, `formatPercent`, `formatCount`
  - Boundary and edge cases: zero, round-up, unit omission, buffer size boundary
- [x] **6.4** `src/__tests__/store.test.ts` — 37 tests
  - `updateReadings`: history ring buffer grows + trims at SENSOR_HISTORY_BUFFER_SIZE (720)
  - `updateHealth`: all 4 status labels (GOOD/FAIR/POOR/CRITICAL) + all 3 boundary values (80/60/40)
  - `addAlert`: deduplication, activeCount, pre-acknowledged handling
  - `acknowledgeAlert`: decrement, double-ack guard, unknown ID no-op
  - `setDGAAnalysis`: NONE zone skips trail, valid zone appends, cap at 20
  - Playback mode: enterPlayback, exitPlayback, setIsPlaying
- [x] **6.5** All 125 tests pass; frontend build (tsc + vite) still clean

---

## Decisions Made
(Move to DECISIONS.md when they accumulate)

- 2026-03-20 Chose Python FastAPI over Next.js for backend — need real WebSocket streaming + NumPy for sensor math
- 2026-03-20 Chose React Three Fiber for 3D — stays in React ecosystem, JSX-based
- 2026-03-20 Chose SQLite over external DB — zero infra, sufficient for single-asset POC
- 2026-03-20 Deterministic fault scenarios with state machines — reproducible demos
- 2026-03-20 Used flat Zustand store (no immer middleware) for simplicity during skeleton phase
- 2026-03-20 Pinned requirements to `>=` ranges for Python 3.13 binary wheel compatibility
- 2026-03-20 Chose IEC 60076-7 exponential lag thermal model (not linear approximation) — more realistic transient behavior, only ~10 lines of code overhead
- 2026-03-20 Chose linear + Arrhenius DGA model (not full Oommen model) — sufficient for POC, calibrated to hit correct Duval zones at scenario peaks

---

## Blockers / Open Questions

- Port 8000 is taken on this machine. Run backend with `--port 8001`. Before Phase 1.6 integration: update `frontend/src/lib/api.ts` and `frontend/src/hooks/useWebSocket.ts` to point to port 8001. See `.env.example`.

---

## Session Log
| Date | Session | What Was Done | Next Steps |
|------|---------|--------------|------------|
| 2026-03-20 | 1 | Full backend + frontend skeleton scaffolded. Both servers start and respond. | Phase 1.3: implement sensor simulator physics |
| 2026-03-20 | 2 | Full doc review. Created THERMAL_PHYSICS.md, DGA_GAS_GENERATION.md, DUVAL_TRIANGLE_VERTICES.md, FMEA_DEFINITIONS.md, .env.example, improvement.md. Updated INTEGRATION_CONTRACT.md and PROGRESS.md. | Phase 1.3a: add physics constants to config.py, then implement simulator modules |
| 2026-03-21 | 3 | Phase 1.3 + 1.4 + 1.6 fully implemented. All physics models (thermal IEC 60076-7, DGA Arrhenius, equipment hysteresis) running. Engine tick loop wired. Scenario modifiers (hot_spot, arcing, cooling_failure) complete. WebSocket streaming live. REST routes for sensors/current, scenario/status/trigger, and simulation/speed wired to engine. Fixed winding_delta runaway bug (ADR-006). | Phase 2: anomaly detection, DGA analysis, FMEA, health score |
| 2026-03-21 | 4 | Phase 2 fully implemented (2.1–2.7). Anomaly detector (rolling Z-score + rate-of-change), DGA analyzer (Duval Triangle + TDCG + CO2/CO + trends), FMEA engine (8 failure modes), health score (weighted penalty), what-if simulation (IEC 60076-7 Arrhenius), analytics wired into engine tick loop + WebSocket + SQLite persistence. 28/28 integration tests pass. | Phase 3/4 frontend integration with live backend data |
| 2026-03-21 | 5 | Phase 4.2a-c + 4.6 complete. Duval Triangle: correct IEC 60599 coordinate system, all 7 zone polygons with colors, live point + 20-reading fading trail, gas % display. Historical playback: LIVE/PLAYBACK toggle in BottomTimeline, scrubber slider, debounced snapshot API call, WebSocket suppression in playback mode. Fixed critical port bug (api.ts + useWebSocket.ts pointed to 8000, corrected to 8001). Backend: GET /api/sensors/snapshot endpoint added. Frontend build passes tsc + vite. | Phase 4.7 end-to-end integration test, then Phase 5 polish |
| 2026-03-21 | 6 | Phase 5 complete. Fixed SensorRow status (was hardcoded NORMAL). Added disconnection banner and connecting overlay in App.tsx. Fixed silent API error swallowing. Wrote README.md (full setup, API reference, architecture notes). Wrote docs/DEMO_SCRIPT.md (10-min walkthrough, 8 segments, talking points, troubleshooting). 28/28 tests pass, frontend build clean. | Visual QA |
| 2026-03-21 | 7 | Visual QA via Playwright MCP. Ran full 15-section TEST_PLAN.md. Found and fixed: DGA+FMEA never fetched (added REST polling in App.tsx + useApi.ts), FAN_BANK showing "0.0" instead of ON/OFF (SensorRow.tsx), Duval zone labels outside triangle (centroid Y sign bug in DuvalTriangle.tsx), speed button active state not visible (added ring highlight), What-If missing cooling energy row (added card to WhatIfPanel.tsx), FMEA/Alert empty states had no icons (added SVG icons). All fixes verified with screenshots. | Frontend unit tests |
| 2026-03-21 | 8 | Phase 6: Frontend unit tests. Installed Vitest, configured vite.config.ts. Wrote 3 test files (125 tests total): duval-geometry.test.ts (53 — coord transforms, zone classification per IEC 60599), formatters.test.ts (35 — all format functions), store.test.ts (37 — actions, ring buffer, health labels, alert dedup, DGA trail cap). All 125/125 pass. Frontend build still clean. | Project fully complete |
| 2026-03-21 | 9 | Comprehensive Playwright MCP QA of all 12 feature areas. Found and fixed 3 critical bugs: (1) HealthGauge + HealthBreakdown never rendered — added to TabContainer as always-visible strip; (2) anomaly detector min_std floor too small (1e-9) causing 1400+ alert flood — fixed to 1% of sensor range; (3) historical playback snapshot route not registered because backend was started without --reload before route was added — restarted backend. All features now verified: WebSocket, header controls, 3D model, 21 sensors + sparklines, health gauge/breakdown, DGA/Duval Triangle, FMEA, What-If, alerts, hot-spot scenario, arcing scenario, playback scrubber. ADR-019, ADR-020 logged. ISSUE-017, ISSUE-018, ISSUE-019 resolved. | Project fully demo-ready |
| 2026-03-21 | 12 | Decision Support System. Added 100×/200× speed options. Added per-sensor recommended_actions to anomaly alerts. Created DecisionEngine (risk, RUL, economic impact, runbooks) + GET /api/decision + DecisionPanel frontend tab. Decision panel shows: risk assessment (5-dot visual), recommended action with deadline, 3-scenario economic impact table ($16k now vs $3.8M failure), 8 operator runbooks with interactive checkboxes. Frontend build clean (tsc + vite). Backend imports verified. | Session 13 |
| 2026-03-21 | 13 | Operator Controls + Speed 200× fix + Health→3D highlight. SpeedUpdateRequestSchema le=60→200. Health breakdown rows clickable, selected component highlights cyan in 3D model via useHealthColor. New routes_operator.py (POST /api/operator/actions, GET /api/operator/status). Engine applies load/cooling overrides before physics. DecisionPanel: Operator Controls section (Load/Cooling buttons) + active overrides green banner. 28/28 + 125/125 tests. | Session 14 |
| 2026-03-21 | 14 | Fault Cascade + Thermal Fatigue + Prognostics Engine. Engine gains cascade tracking (_winding_critical_duration → injects C₂H₂/H₂ DGA after 5 sim-min CRITICAL), thermal stress integral (_thermal_stress_integral → fatigue_score 0–1). New analytics/prognostics.py: linear regression on health history → degradation rate, time-to-warning/critical, 24h/48h/72h projections. New GET /api/prognostics. New PrognosticsWidget in Decision tab. FMEACard: visual causal evidence chain. ScenarioProgressBar: cascade emergency banner. Frontend build clean. | Digital twin UX overhaul |
| 2026-03-21 | 15 | Digital Twin Core Overhaul (all 5 changes frontend-only). (1) AssetKPIBar: transformer nameplate + 5 live KPI tiles with limit bars. (2) Tank.tsx thermal gradient: 5-slice BOT→TOP oil temp emissive interpolation — you can see the heat in the oil column. (3) RadiatorBank.tsx animated oil flow: useFrame particles when fans/pump ON. (4) EventTimeline tab: chronological operational log (alerts, health drops, scenario stages, cascade events). (5) SensorRow trend arrows + limit bars. (6) Physics tab with CorrelationChart: dual Y-axis Load% vs Temps proving IEC 60076-7 causality. 125/125 frontend tests, build clean. | Demo-ready |
| 2026-03-21 | 16 | Real DT paradigm — physics model vs. reality throughout. (1) `winding_temp_physics` added to ThermalState (pure IEC 60076-7, no fault modifier). (2) `expected_top_oil_temp/winding_temp/bot_oil_temp` in TransformerState; engine captures before scenario modifier applies. (3) SensorRow rewrite: IEC model deviation badge (mdl ±X°C) + expandable context line ("IEC model: 68.0°C · actual: 79.4°C") for thermal sensors. (4) DGASummary rewrite: TDCG bar with IEEE C57.104 thresholds, CO₂/CO ratio bar, gas rates with time-to-threshold countdown. (5) OperatingEnvelopeChart (NEW): Load% vs Top Oil scatter + IEC 60076-7 model curve + deviation-colored historical points + CAUTION/WARNING/CRITICAL reference lines. (6) Physics tab now defaults to Operating Envelope sub-tab. (7) Scenario-start equipment alarms (5 scenarios, SCADA-authentic descriptions). (8) DGA baseline → realistic 17-year-old transformer (H2:25, CO:120, CO2:900, CO₂/CO=7.5). 28/28 backend + 125/125 frontend tests pass. |
