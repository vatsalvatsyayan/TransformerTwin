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

*Add new ADRs below as decisions are made during implementation.*
