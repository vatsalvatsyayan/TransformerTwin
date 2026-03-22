# TransformerTwin — Architecture Decision Records (ADR)

> Log every non-trivial technical decision here with context and rationale.
> Format: ADR-NNN: Title

---

## ADR-026: Anomaly absolute deviation floor for thermal sensors (Session 19)
- **Date**: 2026-03-22
- **Context**: Rolling z-score alerts were firing for sub-degree temperature fluctuations. A 0.6°C drift with very low natural noise can produce z > 3.0 and trigger CAUTION. This generated 82+ alerts in 8 min at 30× speed — alert fatigue kills demo value.
- **Decision**: Add `_MIN_ABS_DEVIATION` dict in `anomaly_detector.py`. Thermal sensors require ≥2°C absolute deviation from rolling mean before any alert fires, regardless of z-score.
- **Rationale**: A 0.6°C drift is not operationally meaningful even if statistically unusual. The 2°C floor is below any actionable temperature change but above normal sensor noise.
- **Trade-off**: Could miss very slow, tiny drifts. Acceptable — absolute threshold alerts (CAUTION/WARNING) will still catch these before the z-score would be meaningful.

## ADR-027: Operator load override as cap, not fixed set (Session 19)
- **Date**: 2026-03-22
- **Context**: "70% Load" operator override was implemented as `load_fraction = 0.70` (fixed). If natural load was 42%, clicking "70% Load" raised load to 70%, increasing thermal stress — the opposite of the intended protective action.
- **Decision**: Change to `load_fraction = min(operator_load_override, natural_load)`. The override is now a ceiling on the natural load profile, not a forced fixed value.
- **Rationale**: Semantically correct — "reduce load to 70%" means "don't let load exceed 70%", not "force load to exactly 70%". This matches the status message "Load capped at 70%".
- **Trade-off**: None — purely corrects wrong behavior.

## ADR-028: Decision engine receives cascade flag to override risk score (Session 19)
- **Date**: 2026-03-22
- **Context**: During an active thermal→arcing cascade, the decision engine showed "NOMINAL" risk because health was still at 100 (health lags the physical fault by many simulation minutes).
- **Decision**: Add `cascade_triggered: bool = False` to `DecisionEngine.compute()`. When True, force risk level to at least HIGH. Pass this flag from `simulator._cascade_triggered` in `routes_decision.py`.
- **Rationale**: Cascade is an unambiguous HIGH-risk event that cannot be safely ignored. Health score is a lagging indicator; cascade is a leading one. The decision layer must account for both.
- **Trade-off**: Using private `_cascade_triggered` attr (not a public property). Acceptable for this codebase size; could be formalized as a public property later.

## ADR-029: FMEA FM-001 uses IEC physics model deviation for early detection (Session 19)
- **Date**: 2026-03-22
- **Context**: FMEA was silent during Stage 2 hot_spot (winding 75°C) because FM-001's first evidence condition only scores above 0 when winding_temp ≥ 90°C (caution threshold). Hot spots developing below the caution temperature were completely invisible.
- **Decision**: Compute `dev_pct` in `_score_fm_001` from `state.expected_winding_temp` (IEC 60076-7 physics model). A winding at 75°C when the model predicts 35°C is 114% above expectation → evidence score e2=1.0 → total FM-001 ≈ 0.25 (Monitoring level). Also lowered `FMEA_MIN_REPORT_SCORE` from 0.30 to 0.25.
- **Rationale**: The digital twin paradigm is "actual vs. model". FM-001 should flag winding hot spots based on deviation from the physics model, not only on absolute temperature. This is the correct engineering approach — a 75°C winding in winter with a 35°C model prediction is more alarming than an 88°C winding in summer with a 85°C model prediction.
- **Trade-off**: May surface FM-001 "Monitoring" during normal summer peaks when winding is slightly above model due to ambient effects. Acceptable since "Monitoring" level requires no action.

---

## ADR-030: Terminal Failure as Non-Resettable Engine State (Session 22)
- **Date**: 2026-03-22
- **Context**: All existing scenarios auto-reset to `normal` when `is_complete()` returns True. The `thermal_runaway` scenario requires a permanent tripped state — the transformer is offline and cannot resume without explicit operator action.
- **Decision**: Add `_terminal_failure` boolean to the engine. When True: (1) scenario completion block is skipped, (2) `load_fraction` is overridden to 0.0, (3) `scenario_update` carries `terminal_failure: true`, (4) one-time CRITICAL alert is emitted. State clears only when user explicitly triggers `normal` scenario.
- **Rationale**: This mirrors real-world transformer protection: once a differential relay operates, the breaker remains open until engineering sign-off. The operator must consciously decide to re-energise.
- **Alternatives rejected**: Auto-reset after 30s in terminal state (removes drama and educational value); New `tripped` scenario ID (overkill — just a flag).

## ADR-031: Diagnostic Sensor Physics via Stage-Based Offsets (Session 22)
- **Date**: 2026-03-22
- **Context**: No existing scenario modified OIL_DIELECTRIC or OIL_MOISTURE. The thermal_runaway scenario requires these sensors to degrade realistically to drive FMEA evidence and demonstrate the oil/paper deterioration stage.
- **Decision**: Add `get_diagnostic_modifiers()` to `BaseScenario` (default returns `{}`). In engine, maintain `_diag_offsets` dict. Each tick, the active scenario's diagnostic offsets are applied as fixed additive offsets from nominal (not accumulated). Stage-based: a scenario being in Stage 3 sets OIL_DIELECTRIC to nominal-8 regardless of how long it's been in Stage 3.
- **Rationale**: Diagnostics degrade progressively with stage advancement but don't need precise accumulation — the physical degradation happens over the whole stage. Fixed offsets per stage are simpler, more predictable, and sufficient for the demo. OIL_DIELECTRIC clamped at 10 kV/mm (catastrophic failure floor); OIL_MOISTURE clamped at 60 ppm (saturation ceiling).
- **Trade-off**: Diagnostic sensors will jump discretely at stage boundaries rather than transitioning smoothly. Acceptable since diagnostic updates are only sent every 3600 sim-seconds (1 sim-hour), so the jump is often not visible in normal demo pacing.

## ADR-001: Python FastAPI for Backend
- **Date**: Pre-implementation
- **Context**: Needed real-time WebSocket streaming with numerical computation for sensor simulation and anomaly detection.
- **Decision**: Use Python 3.11+ with FastAPI instead of Next.js API routes.
- **Rationale**: FastAPI has native WebSocket support, async-first design. Python's NumPy/SciPy needed for statistical computations (z-scores, rolling statistics). Next.js serverless functions can't maintain persistent WebSocket connections.
- **Trade-off**: Two separate deployments needed (frontend + backend) instead of one. Accepted because WebSocket fidelity matters more for this project.

## ADR-002: React Three Fiber for 3D Visualization
- **Date**: Pre-implementation
- **Context**: Need interactive 3D transformer model with real-time data overlays.
- **Decision**: Use React Three Fiber (@react-three/fiber) instead of raw Three.js or a pre-built 3D model.
- **Rationale**: Stays in React/JSX paradigm. Declarative scene graph matches React mental model. Easier to bind sensor data to visual properties. @react-three/drei provides useful abstractions (OrbitControls, Html overlays, etc.).
- **Trade-off**: Stylized geometry (coded shapes) instead of photorealistic CAD model. Acceptable for POC — looks professional, and demonstrates technical skill.

## ADR-003: SQLite for Time-Series Storage
- **Date**: Pre-implementation
- **Context**: Need to store 24 hours of sensor readings for historical playback.
- **Decision**: Use SQLite via aiosqlite.
- **Rationale**: Zero infrastructure. Single file. Plenty fast for single-asset reads/writes. Supports the demo without any setup. 
- **Future**: Would migrate to TimescaleDB or InfluxDB for production multi-asset deployment.

## ADR-004: Deterministic Sensor Simulator
- **Date**: Pre-implementation
- **Context**: Need realistic sensor data that follows physics correlations.
- **Decision**: Build a deterministic simulator where sensor values are computed from a model (load, ambient, cooling state, fault state) rather than from random number generation.
- **Rationale**: Makes demo reproducible. Enables historical playback (recompute any past state). Ensures sensor correlations are physically realistic (load↑ → temp↑ → gas generation↑). Allows what-if simulation by changing input parameters.
- **Trade-off**: More complex to build than a random data generator. Worth it — the realism is a core selling point.

## ADR-005: Fault Scenarios as State Machines
- **Date**: Pre-implementation
- **Context**: Need fault scenarios that develop gradually and realistically.
- **Decision**: Implement each fault scenario as a state machine with defined stages and transitions.
- **Rationale**: Real transformer faults develop over time (hours to days). State machines let us define progression stages with specific sensor deltas at each stage. Can be triggered via API for demo control. Multiple scenarios can run independently.

---

## ADR-006: Scenario winding_delta applied to output only, not internal state
- **Date**: 2026-03-21
- **Context**: Implementing Phase 1.3 ThermalModel and Phase 1.4 scenario modifiers.
- **Decision**: `winding_delta` from fault scenarios is added to the ThermalModel **output** only; the internal `self._winding` stores only the physics value (no delta).
- **Rationale**: If winding_delta were accumulated into `self._winding`, the exponential lag formula `θ(t+1) = θ_ss + (θ(t) - θ_ss) × e^(-dt/τ)` would diverge to θ_ss + delta/(1 - e^(-dt/τ)). With τ_winding=600s and dt=1s, this is delta × 600, turning a 15°C delta into a 9000°C spike. Adding to output only gives a constant, stable elevation of exactly `winding_delta` °C above the physics value.
- **Trade-off**: The scenario-elevated winding temperature does not feedback into the oil thermal model (top oil remains unaffected by the winding delta). This is a reasonable simplification for Phase 1 — in reality, a local hot spot does affect oil temperature, but the effect is smaller and the correction would need the full OFAF dynamic model.

## ADR-007: TransformerState field name `load_current` (not `load_current_pct`)
- **Date**: 2026-03-21
- **Context**: `LOAD_CURRENT` sensor ID maps to field via `sensor_id.lower()` pattern. The original skeleton used `load_current_pct` which broke the pattern.
- **Decision**: Renamed to `load_current` in `models/schemas.py` to match the universal `sensor_id.lower()` pattern.
- **Rationale**: All 21 sensors now map cleanly via `sensor_id.lower()` to their TransformerState fields. No special-case mappings needed.

## ADR-008: Analytics wired into engine tick loop (not lazy REST evaluation)
- **Date**: 2026-03-21
- **Context**: Phase 2.6 — where to run anomaly_detector, dga_analyzer, fmea_engine, health_score.
- **Decision**: Run all analytics inside `SimulatorEngine._tick()` after each physics tick. REST routes read from `engine.latest_*` attributes.
- **Rationale**: WebSocket clients need real-time `alert` and `health_update` messages on every tick. If analytics ran only on REST request, WebSocket would never emit alerts. Storing results in `latest_*` attributes lets REST routes return current values without re-computation.
- **Trade-off**: Slight CPU overhead on every tick even when no client is connected. Acceptable for POC — the analytics modules are O(1) and take < 1ms per tick.

## ADR-009: Anomaly detector uses min_std floor to avoid zero-division
- **Date**: 2026-03-21
- **Context**: When rolling baseline is perfectly stable (all values identical), std=0 causes z = infinity for any deviation.
- **Decision**: Apply `min_std = sensor_range × 0.01` (1% of sensor range) as floor for std when baseline std is below that value.
- **Rationale**: A 1% range floor means a sensor must deviate by at least 2% of its operating range (z=2) to trigger CAUTION. This is physically meaningful — sensors have measurement uncertainty of ~0.5–1% so a 2% deviation is a real signal.
- **Trade-off**: When baseline truly has no variance (e.g., synthetic test data), extremely small deviations still won't trigger alerts since min_std is nonzero. Tests must use slightly varied baseline data to reflect realistic sensor noise.

## ADR-010: DGA history passed as list to analyzer (not circular buffer in analyzer)
- **Date**: 2026-03-21
- **Context**: DGA trend detection needs 10–15 previous readings per gas. Where to maintain history.
- **Decision**: `SimulatorEngine` maintains `_dga_history` deques (maxlen=15) per gas. On each DGA tick, it passes `history_*` lists to `DGAAnalyzer.analyze()`.
- **Rationale**: Keeps the analyzer stateless and easily unit-testable (inject any history). The engine already owns the simulation timeline, so it's the natural place to buffer historical readings.
- **Trade-off**: More arguments to `analyze()`. Mitigated by using keyword arguments and a well-typed signature.

## ADR-011: What-if simulation creates isolated ThermalModel (not re-uses engine state)
- **Date**: 2026-03-21
- **Context**: `POST /api/simulation` must project future temperatures without affecting live simulator.
- **Decision**: Create a fresh `ThermalModel()` instance per request, warm it up with 12 burn-in hours at the requested conditions, then project the timeline.
- **Rationale**: Completely isolated from live engine state. Concurrent requests don't interfere. The 12-hour burn-in ensures initial transients are removed before the projection timeline starts.
- **Trade-off**: Each request does 12 + N×24 ThermalModel ticks (cheap). No state is shared, so projections are slightly pessimistic (don't start from current real state). Acceptable for what-if analysis — the point is to show steady-state behavior at the requested conditions.

## ADR-012: Duval Triangle uses CH4→BL, C2H4→BR, C2H2→Top convention
- **Date**: 2026-03-21
- **Context**: The skeleton `duvalGeometry.ts` used an incorrect vertex orientation that placed CH4 in the middle of the base. The `DuvalTriangle.tsx` axis labels were also wrong.
- **Decision**: Rewrite `duvalGeometry.ts` with the correct IEC 60599 convention: CH4=100% at bottom-left (0,0), C2H4=100% at bottom-right (1,0), C2H2=100% at top (0.5, 0.866).
- **Rationale**: Matches `docs/DUVAL_TRIANGLE_VERTICES.md` exactly. Zone polygon vertices from that doc are normalized [0,1] Cartesian and now render correctly.
- **Trade-off**: Breaking change to `ternaryToCartesian` signature — now takes `TernaryPoint` with fractions and additional optional SVG size/padding args. DuvalTriangle.tsx updated in the same commit.

## ADR-013: Historical playback uses snapshot endpoint (not per-sensor history)
- **Date**: 2026-03-21
- **Context**: Phase 4.6 playback slider needs to load sensor state at a given sim_time. The existing `/api/sensors/history` endpoint returns one sensor at a time.
- **Decision**: Add `GET /api/sensors/snapshot?sim_time=X` endpoint that returns all 21 sensors in one query using `GROUP BY sensor_id` with `MAX(sim_time)`.
- **Rationale**: One network round-trip instead of 21. Single query is O(N log N) instead of O(21N). Keeps the response shape identical to `/api/sensors/current` so the frontend can reuse the same store action.
- **Trade-off**: SQLite's "bare column" behavior with GROUP BY (non-aggregated columns from MAX() row) is well-defined in SQLite but nonstandard SQL. Acceptable for this POC; would need `JOIN` subquery for other databases.

## ADR-014: WebSocket suppresses sensor/health updates in playback mode
- **Date**: 2026-03-21
- **Context**: When the user scrubs to a historical time, the next live WebSocket message would immediately overwrite the historical state.
- **Decision**: `useWebSocket.ts` checks `mode === 'live'` before calling `updateReadings` and `updateHealth`. Alerts still flow through in both modes (user should see new alerts even while reviewing history).
- **Rationale**: Simple client-side gate. The WebSocket stays connected so reconnection logic is unaffected. Returning to live mode is instant (no reconnect needed).
- **Trade-off**: Scenario updates (progress bar, stage) continue in playback mode — acceptable since they don't affect sensor data display.

## ADR-015: DGA and FMEA data polled via REST (not WebSocket broadcast)
- **Date**: 2026-03-21
- **Context**: DGA analysis and FMEA results are computed on each backend tick but were never surfacing in the frontend. The WebSocket protocol only broadcasts `sensor_update`, `health_update`, `alert`, and `scenario_update`.
- **Decision**: Poll `GET /api/dga/analysis` and `GET /api/fmea` every 5 seconds from `App.tsx`. Initial fetch on mount, then interval-based.
- **Rationale**: Adding DGA/FMEA to the WebSocket stream would require new message types and schema changes in the Integration Contract. REST polling at 5s is sufficient since DGA gas concentrations change slowly; the endpoint is already implemented and working.
- **Trade-off**: Slight latency (up to 5s behind vs real-time). Acceptable — DGA analysis is inherently a slow-moving signal (gases accumulate over hours/days).

## ADR-016: Equipment sensor ON/OFF display via status field (not value)
- **Date**: 2026-03-21
- **Context**: `FAN_BANK_1`, `FAN_BANK_2`, `OIL_PUMP_1` have boolean values (0.0/1.0) which displayed as "0.0" in the sensor row numeric column.
- **Decision**: `SensorRow.tsx` checks `status === 'ON' | 'OFF'` (from the engine's `SensorReading.status`) and renders colored text labels instead of calling `formatSensorValue`.
- **Rationale**: The engine already computes boolean status for these sensors via `_compute_sensor_status()`. Reading from `status` avoids a magic threshold check on the frontend, keeping domain logic in the backend.
- **Trade-off**: Tight coupling between frontend display logic and the backend's status string values ("ON"/"OFF"). Documented in Integration Contract as valid `SensorStatus` values.

## ADR-017: Frontend unit tests use explicit Vitest imports (no globals)
- **Date**: 2026-03-21
- **Context**: Vitest supports both `globals: true` (auto-inject describe/it/expect) and explicit imports. Setting globals requires adding `"types": ["vitest/globals"]` to tsconfig, which could conflict with the existing strict tsconfig and its `noUnusedLocals` / `noUnusedParameters` flags.
- **Decision**: Use explicit `import { describe, it, expect, beforeEach } from 'vitest'` in all test files. No tsconfig changes needed.
- **Rationale**: Keeps the test setup minimal — no need for a separate tsconfig for tests, no injection of globals that TypeScript doesn't know about. Explicit imports are also more self-documenting.
- **Trade-off**: Slightly more boilerplate per test file (one import line). Accepted — all test files are small.

## ADR-018: Test environment set to 'node' (not 'jsdom')
- **Date**: 2026-03-21
- **Context**: The frontend test suite covers pure utility functions (duvalGeometry, formatters) and Zustand store actions. No React component rendering is tested.
- **Decision**: Set `test.environment: 'node'` in vite.config.ts.
- **Rationale**: jsdom adds significant overhead and isn't needed for pure function and store action tests. Zustand stores work in a Node environment because they're just closures around JavaScript state.
- **Trade-off**: Component rendering tests (React Testing Library) would require switching to `'jsdom'` environment. If component tests are added later, the environment config will need to change.

## ADR-019: HealthGauge + HealthBreakdown always visible in TabContainer strip
- **Date**: 2026-03-21
- **Context**: HealthGauge and HealthBreakdown were implemented but never placed in the UI. They need to be visible at all times (demo script calls out watching health score drop during fault scenarios), not behind a tab.
- **Decision**: Added a fixed health strip (64px circular SVG gauge + 6 horizontal component bars) between the tab bar and tab content in `TabContainer.tsx`. This makes health always visible regardless of which tab is active.
- **Rationale**: Avoids requiring a separate "Health" tab or hiding it in the sensor list. The strip is compact (~90px), non-scrollable, and positioned where the user naturally looks when switching tabs.
- **Trade-off**: Reduces available height for tab content by ~90px. Acceptable — all tab panels scroll internally.

## ADR-020: Anomaly detector std floor at 1% of sensor range
- **Date**: 2026-03-21
- **Context**: The anomaly detector was using `1e-9` as a std floor, causing near-zero variance in stable sensors to produce enormous z-scores and constant false CAUTION alerts. Over 1400 alerts accumulated during a test session.
- **Decision**: Set `min_std = _sensor_range(sensor_id) * 0.01` (1% of sensor range). Uses `_sensor_range()` which already computes `abs(warning - caution)` per sensor.
- **Rationale**: 1% of the caution→warning band is a physically reasonable noise floor. For TOP_OIL_TEMP (range=15°C), this is 0.15°C — realistic sensor noise is well below this. An actual anomaly should deviate by multiple sensor ranges, not fractions of a degree. This matches the spec in MEMORY.md.
- **Trade-off**: Marginally increases the minimum detectable anomaly size, which is correct behavior. Alert flooding was far more harmful to the demo than a slightly higher detection threshold.

## ADR-021: Health Component selection drives 3D highlight via useHealthColor hook
- **Date**: 2026-03-21
- **Context**: Users wanted to click a health component in the panel and see the corresponding 3D parts highlighted on the model, creating a bidirectional link between the data panel and the 3D view.
- **Decision**: Added `selectedHealthComponent: HealthComponentKey | null` to Zustand store. Modified `useHealthColor(key)` to check if `selectedHealthComponent === key` — if true, returns a bright cyan emissive override instead of the health status color. This means ALL mesh parts using that health key automatically glow without any prop changes.
- **Rationale**: The hook-based approach propagates the selection to all 3D parts with zero prop drilling — any part component that calls `useHealthColor(key)` gets the selection highlight for free. Only FanUnit needed special handling since it doesn't use `useHealthColor` (it uses ON/OFF sensor state for color).
- **Trade-off**: The selection is stored globally (one component at a time). Two overlapping health components can't both be selected. This is correct behavior for the demo.

## ADR-022: Operator overrides applied as physics inputs, not post-processing
- **Date**: 2026-03-21
- **Context**: Need operator interventions (load reduction, cooling upgrade) to produce realistic physical responses — temperatures should actually change, not just display labels.
- **Decision**: `operator_load_override` and `operator_cooling_override` are applied as inputs to the physics tick (before thermal model and equipment model). They override the sinusoidal load profile and scenario cooling override respectively. Operator cooling takes precedence over scenario overrides.
- **Rationale**: Applying overrides as physics inputs means the IEC 60076-7 thermal model computes the correct response — load reduction reduces winding power dissipation → slower heat generation → temperatures plateau and decline. This is what a real digital twin should do: simulate the consequence of operator actions.
- **Trade-off**: Operator overrides persist indefinitely until explicitly cleared. If a scenario completes while overrides are set, the operator must manually clear them. This is acceptable and physically realistic — operators don't automatically restore normal load when an alarm clears.

## ADR-023: Physics-based expected values separated from fault-affected actuals (Session 16)
- **Date**: 2026-03-21
- **Context**: The original "expected" value sent to the frontend used a rolling statistical mean — which is a lag indicator, not a physics model. A true digital twin's core signal is: physics model says X, reality says Y, deviation = fault signature.
- **Decision**: Added `winding_temp_physics` to `ThermalState` (pure IEC 60076-7 output before any scenario `winding_delta` is applied). Added `expected_top_oil_temp/winding_temp/bot_oil_temp` to `TransformerState`. Engine captures these AFTER thermal model tick but BEFORE scenario modifiers, emitting them as `expected` fields on thermal sensor readings.
- **Rationale**: `thermal.top_oil_temp` is already the clean physics value (top_oil_delta is applied to `state.top_oil_temp` separately in the engine, not inside the model). `winding_temp` includes `winding_delta` from fault scenarios, so the model needed a separate `winding_temp_physics` field. This enables the SensorRow to show "mdl +12.3°C" — the IEC model says 68°C, actual is 80.3°C, the 12.3°C gap is the fault.
- **Trade-off**: Slight duplication (expected values stored on TransformerState and also carried in SensorReading). Accepted — they serve different purposes: state field drives REST API responses, SensorReading field drives real-time WebSocket overlay.

## ADR-024: Operating Envelope as the primary Physics sub-tab (Session 16)
- **Date**: 2026-03-21
- **Context**: The Physics tab originally defaulted to the Correlation (temporal) chart. The Operating Envelope (Load% vs Temperature scatter with IEC model curve) is the more compelling DT visualization for demonstrating fault detection.
- **Decision**: Physics tab defaults to "Envelope" sub-tab. The IEC 60076-7 thermal model is also re-implemented in the frontend (`iecModelTopOil()`) so the model curve updates instantly with cooling mode changes without a round-trip to the backend.
- **Rationale**: The Operating Envelope embodies the "actual vs. expected" paradigm visually. Scatter points above the blue curve = fault. A single glance communicates the entire digital twin value proposition. Re-implementing the simple model formula in JS is justified — it's 5 lines of math that avoids a polling round-trip.
- **Trade-off**: Frontend and backend now both implement `iecModelTopOil()`. If parameters change in `config.py`, the frontend constants must be manually updated. Mitigated by prominent comments in OperatingEnvelopeChart.tsx noting they must match backend config.py.

## ADR-025: Scenario-start equipment alarms use SCADA-authentic descriptions (Session 16)
- **Date**: 2026-03-21
- **Context**: Previous scenario transitions produced no immediate alert — the operator had no warning until temperatures climbed above thresholds. Real SCADA systems fire equipment alarms (Buchholz relay, protection relay, overcurrent trip) before thermal consequences.
- **Decision**: `_emit_scenario_start_alert()` fires one CRITICAL/WARNING alert on scenario activation with sensor-specific descriptions matching what real SCADA operators see — "Buchholz Relay Pre-Trip Condition" for arcing, "Cooling Fan Protection Tripped — Overcurrent" for cooling_failure, "Abnormal Winding Temperature Rise Detected" for hot_spot, etc.
- **Rationale**: Equipment protection relays respond to electrical signals (gas pressure, current, impedance change) in seconds — long before thermal sensors register. This is the correct sequence for all five fault types. Without this, the system felt like pure telemetry monitoring rather than a protection system.
- **Trade-off**: Scenario-start alerts don't repeat if the scenario is re-triggered without returning to normal. The `_last_scenario_id` guard prevents duplicate emission. If the same scenario is started twice consecutively, no second alert fires — acceptable.

*Add new ADRs below as decisions are made during implementation.*
