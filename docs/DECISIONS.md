# TransformerTwin — Architecture Decision Records (ADR)

> Log every non-trivial technical decision here with context and rationale.
> Format: ADR-NNN: Title

---

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

*Add new ADRs below as decisions are made during implementation.*
