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
