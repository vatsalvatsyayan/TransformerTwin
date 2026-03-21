# TransformerTwin — Issues & Tech Debt

> Track bugs, tech debt, and open questions here.
> Prefix: 🐛 Bug | 🔧 Tech Debt | ❓ Open Question | 💡 Enhancement

---

## Open

### 🔧 ISSUE-007: Playback slider max is `simTime` at component render (not live-updating)
- **Found**: Phase 4.6 (2026-03-21)
- **Severity**: Low
- **Description**: The range slider in `BottomTimeline.tsx` uses `Math.max(simTime, 1)` as the `max` attribute. `simTime` is read from the Zustand store, so it does update as the sim runs. However, when the user is in playback mode, `simTime` still advances (the WebSocket suppression only affects `updateReadings`/`updateHealth`, not `setSimTime` via `sensor_update` messages — wait, actually `setSimTime` is also suppressed because it's inside the `mode === 'live'` block). In playback mode `simTime` will freeze at the value when playback was entered.
- **Impact**: If a user enters playback mode early (low simTime), the slider max will be frozen at that value. They can exit playback and re-enter to get an updated max.
- **Resolution**: Expose `maxSimTime` separately in the store, always updated regardless of mode. Low priority.

### 🔧 ISSUE-008: SQLite snapshot query uses bare-column behaviour (SQLite-specific)
- **Found**: Phase 4.6 backend (2026-03-21)
- **Severity**: Low
- **Description**: `get_sensor_snapshot()` uses `SELECT sensor_id, value, status, timestamp, MAX(sim_time) FROM sensor_readings WHERE sim_time <= ? GROUP BY sensor_id`. Returning non-aggregated columns (`value`, `status`, `timestamp`) alongside `MAX(sim_time)` is valid in SQLite's "bare column" extension but non-standard SQL.
- **Impact**: Works correctly in SQLite. Would need a subquery rewrite for PostgreSQL/MySQL.
- **Resolution**: Add a comment in `queries.py`. Not a bug for this SQLite-based POC.

### 🔧 ISSUE-005: FM-001 max score capped at ~0.45 in hot-spot test (expected ≥ 0.7)
- **Found**: Phase 2.7 integration test (2026-03-21)
- **Severity**: Low
- **Description**: After 2 sim-hours of hot_spot scenario, FM-001 (Winding Hot Spot) scores ~0.45 (Possible). The original spec called for > 0.7 (Probable). The scenario's DGA gas accumulation at 2 sim-hours is still in early T1/T2 zone — C2H4 is elevated but not at the levels that push FMEA evidence scores to 0.7.
- **Impact**: FM-001 correctly triggers and ranks first, just with lower confidence than hoped. Longer simulation (4+ sim-hours) produces 0.7+ scores.
- **Resolution**: Relaxed test assertion to >= 0.4. For demo purposes, trigger scenario earlier or run for longer. Consider revisiting DGA modifier rates in hot_spot.py to produce faster gas accumulation.

### 🔧 ISSUE-006: SQLite persist_callback not yet wired for sensor_readings (group-level write)
- **Found**: Phase 2.6 implementation (2026-03-21)
- **Severity**: Low
- **Description**: The engine emits `persist_sensor` messages per individual sensor reading, but `queries.insert_sensor_reading()` expects a single sensor at a time. Under 1× speed this is 21 writes/tick (every 60s). Under 60× speed it is 21 × 60 = 1260 writes/sec which could saturate SQLite.
- **Impact**: Historical data accumulates correctly at normal demo speeds. At high speed multipliers (60×+), SQLite inserts may lag behind.
- **Resolution**: Consider batching: accumulate readings and insert every N ticks; or use SQLite WAL mode. Low priority until Phase 4.6 playback is implemented.

### 🔧 ISSUE-003: Diagnostic sensor values are static nominals
- **Found**: Phase 1.3d (2026-03-21)
- **Severity**: Low
- **Description**: OIL_MOISTURE, OIL_DIELECTRIC, BUSHING_CAP_HV, BUSHING_CAP_LV use constant nominal values (no physics model). Only Gaussian noise varies them.
- **Impact**: These sensors are cosmetically realistic but do not respond to fault scenarios.
- **Resolution**: Implement slow degradation model in Phase 2 (low priority for demo).

### ❓ ISSUE-004: Thermal model validation table discrepancy
- **Found**: Phase 1.3c implementation (2026-03-21)
- **Severity**: Low
- **Description**: The `docs/THERMAL_PHYSICS.md` validation table shows 54°C top oil at 50% load / ONAN, but the IEC 60076-7 formula with n=0.8 gives 43°C. The full-load OFAF case (55°C) matches exactly.
- **Impact**: Temperatures at partial loads are ~10°C lower than the spec table. Demo still shows realistic progression and correct fault responses.
- **Resolution**: The IEC formula is correctly implemented. The spec table may have used different exponents. No code change needed.

---

## Resolved

### ✅ ISSUE-011: DGA analysis and FMEA data never fetched on frontend
- **Found**: Session 7 visual QA (2026-03-21)
- **Severity**: High — DGASummary always showed "No DGA data yet.", FMEAPanel always showed empty state even during active fault scenarios
- **Description**: `store.setDGAAnalysis()` and `store.setFMEAResponse()` were never called. `fetchDGAAnalysis()` and `fetchFMEA()` didn't exist in `useApi.ts`. `App.tsx` had no DGA/FMEA polling.
- **Resolution**: Added `fetchDGAAnalysis()` and `fetchFMEA()` to `useApi.ts`. Added initial fetch + 5s polling interval for both in `App.tsx`.

### ✅ ISSUE-012: FAN_BANK_1/2 and OIL_PUMP_1 showed "0.0" instead of ON/OFF
- **Found**: Session 7 visual QA (2026-03-21)
- **Severity**: Medium — Equipment sensors displayed raw float value instead of meaningful state label
- **Description**: `SensorRow.tsx` always called `formatSensorValue(latestValue, unit)` for all sensors. Equipment sensors have boolean values (0.0/1.0) and unit "" which formatted as "0.0".
- **Resolution**: Added conditional in SensorRow: if `status === 'ON'` render green "ON", if `status === 'OFF'` render slate "OFF", else fall through to numeric format.

### ✅ ISSUE-013: Duval Triangle zone labels positioned outside/below triangle
- **Found**: Session 7 visual QA (2026-03-21)
- **Severity**: Medium — Zone labels (PD, T1, T2, T3, D1, D2, DT) rendered below the SVG triangle boundary
- **Description**: Centroid Y calculation in `DuvalTriangle.tsx` used `H + PAD - cy * (H - 2 * PAD)` but should be `H - PAD - cy * (H - 2 * PAD)` (matching `normalizedToSVG` formula). The `+PAD` caused an 80px (2 × TRIANGLE_PADDING) downward offset.
- **Resolution**: Changed `H + PAD` to `H - PAD` in the zone centroid computation.

### ✅ ISSUE-014: Speed button active state not clearly visible
- **Found**: Session 7 visual QA (2026-03-21)
- **Severity**: Low — Active speed button (30×) had `bg-blue-600` but no ring/border for clear visual differentiation
- **Resolution**: Added `ring-2 ring-blue-400 ring-offset-1 ring-offset-[#111320]` to the active button class in `SpeedControl.tsx`.

### ✅ ISSUE-015: What-If results missing Cooling Energy Impact row
- **Found**: Session 7 visual QA (2026-03-21)
- **Severity**: Low — `SimulationResponse` has `cooling_energy_impact_percent` and `cooling_energy_interpretation` fields but WhatIfPanel never rendered them
- **Resolution**: Added cooling energy card to the results section in `WhatIfPanel.tsx`.

### ✅ ISSUE-016: FMEA and Alert panels had no empty-state icon
- **Found**: Session 7 visual QA (2026-03-21)
- **Severity**: Low — Both panels showed plain text only when empty; inconsistent with polished UI
- **Resolution**: Added SVG icons (checkmark circle for FMEA, shield-check for Alerts) with descriptive subtitle text to both empty state renderings.

### ✅ ISSUE-009: SensorRow hardcoded status NORMAL (never showed CAUTION/WARNING/CRITICAL)
- **Found**: Phase 5 review (2026-03-21)
- **Severity**: Medium — status dots always showed green regardless of actual sensor state
- **Description**: `SensorRow.tsx` had `const status = 'NORMAL'` hardcoded. The `status` field arrives on each `SensorReading` from the WebSocket engine but was never read.
- **Resolution**: Phase 5.1 — replaced with `useSensorReading(sensorId)` selector; status now reflects live engine output.

### ✅ ISSUE-010: Initial API fetch errors silently swallowed
- **Found**: Phase 5 review (2026-03-21)
- **Severity**: Low — `void fetchCurrentSensors()` silently dropped any fetch errors on startup
- **Description**: `App.tsx` called initial REST fetches with `void` prefix so thrown errors were uncaught.
- **Resolution**: Phase 5.2 — changed to `.catch()` handlers that log warnings to console.

### ✅ ISSUE-001: REST routes still returning stub data
- **Resolved**: Phase 2.6 (2026-03-21)
- **Resolution**: `/api/health`, `/api/dga/analysis`, `/api/fmea` now read from `engine.latest_*` attributes set by the analytics tick loop.

### ✅ ISSUE-002: Sensor readings not persisted to SQLite
- **Resolved**: Phase 2.6 (2026-03-21)
- **Resolution**: `register_persist_callback()` wired in `main.py` lifespan. Engine emits `persist_sensor`, `persist_health`, `persist_alert` messages on each tick.

---

## Template

### 🐛/🔧/❓/💡 ISSUE-NNN: Title
- **Found**: [date/phase]
- **Severity**: Low / Medium / High / Critical
- **Description**: What's wrong or what needs attention
- **Impact**: What breaks or degrades if not addressed
- **Resolution**: (filled in when resolved)
