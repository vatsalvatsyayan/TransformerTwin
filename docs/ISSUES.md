# TransformerTwin — Issues & Tech Debt

> Track bugs, tech debt, and open questions here.
> Prefix: 🐛 Bug | 🔧 Tech Debt | ❓ Open Question | 💡 Enhancement

---

## Open

### 🔧 ISSUE-001: REST routes still returning stub data (except sensors/current, scenario, speed)
- **Found**: Phase 1.3/1.6 implementation (2026-03-21)
- **Severity**: Medium
- **Description**: Most REST routes (`/api/health`, `/api/dga/analysis`, `/api/fmea`, `/api/alerts`) still return static stub responses. They need to be wired to the analytics engines in Phase 2.
- **Impact**: Frontend displays stale/placeholder data in health, DGA, FMEA, and alerts tabs until Phase 2 is complete.
- **Resolution**: Will be addressed in Phase 2.1–2.4.

### 🔧 ISSUE-002: Sensor readings not persisted to SQLite
- **Found**: Phase 1.6 implementation (2026-03-21)
- **Severity**: Medium
- **Description**: The engine emits sensor data via WebSocket callbacks but does not write to the `sensor_readings` table. The `GET /api/sensors/history` route returns empty results.
- **Impact**: No historical data available; historical playback (Phase 4.6) cannot work.
- **Resolution**: Wire `database/queries.py` persistence into `SimulatorEngine._tick()` in Phase 2.6.

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

(Resolved issues moved here with resolution notes)

---

## Template

### 🐛/🔧/❓/💡 ISSUE-NNN: Title
- **Found**: [date/phase]
- **Severity**: Low / Medium / High / Critical
- **Description**: What's wrong or what needs attention
- **Impact**: What breaks or degrades if not addressed
- **Resolution**: (filled in when resolved)
