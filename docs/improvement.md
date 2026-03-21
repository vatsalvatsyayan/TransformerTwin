# TransformerTwin — Pre-Phase 1.3 Review & Improvement Analysis

> **Reviewed:** 2026-03-20
> **Scope:** All docs (PRD, BACKEND_ARCHITECTURE, FRONTEND_ARCHITECTURE, INTEGRATION_CONTRACT, DOMAIN_GUIDE, DECISIONS, ISSUES, PROGRESS) cross-checked against actual backend/ and frontend/src/ folder contents.

---

## Overall Verdict: ✅ Skeleton is solid — but 4 critical doc gaps will block Phase 1.3+

The scaffolding is in excellent shape. All 35 backend files, all 60+ frontend files, all 13 REST routes, all Pydantic/TypeScript types, and the database schema are present and consistent. **No missing stubs were found.** The blocking issues are not in code — they are underspecified physics formulas and classification data in the docs, which will make it impossible to implement the simulator correctly without guessing.

---

## 1. Folder Structure vs Docs

| Layer | Expected (docs) | Actual (disk) | Status |
|---|---|---|---|
| `backend/simulator/` | 6 files | 6 files | ✅ |
| `backend/scenarios/` | 6 files | 6 files | ✅ |
| `backend/analytics/` | 4 files | 4 files | ✅ |
| `backend/api/` | 10 files | 10 files | ✅ |
| `backend/database/` | 3 files | 3 files | ✅ |
| `backend/models/` | 1 file | 1 file | ✅ |
| `frontend/src/types/` | 8 files | 8 files | ✅ |
| `frontend/src/store/` | 10 files | 10 files | ✅ |
| `frontend/src/hooks/` | 4 files | 4 files | ✅ |
| `frontend/src/components/` | 40+ files | 40+ files | ✅ |
| `frontend/src/lib/` | 4 files | 4 files | ✅ |

**No missing or extra files found.**

---

## 2. Schema Consistency

All enums and IDs are consistent across PRD → INTEGRATION_CONTRACT → `schemas.py` → TypeScript types:

- ✅ All 21 sensor IDs match exactly across all 4 layers
- ✅ 6 health component keys (`dga`, `winding_temp`, `oil_temp`, `cooling`, `oil_quality`, `bushing`) consistent
- ✅ 4 scenario IDs (`normal`, `hot_spot`, `arcing`, `cooling_failure`) consistent
- ✅ 8 Duval zones (`PD`, `T1`, `T2`, `T3`, `D1`, `D2`, `DT`, `NONE`) consistent
- ✅ 8 failure mode IDs (`FM-001` through `FM-008`) consistent
- ✅ All 13 REST routes implemented as stubs returning valid contract-conforming responses

---

## 3. Minor Doc Inconsistencies

### 3.1 SensorStatus vs AlertSeverity — needs a callout
- `SensorStatus`: 4 levels (`NORMAL`, `CAUTION`, `WARNING`, `CRITICAL`) — per-sensor
- `AlertSeverity`: 3 levels (`INFO`, `WARNING`, `CRITICAL`) — per-alert message
- Both are correct and intentional, but nowhere in INTEGRATION_CONTRACT is this distinction called out explicitly. A reader writing the anomaly detector could easily confuse them.
- **Fix:** Add a note in INTEGRATION_CONTRACT Section 1.3 clarifying which enum applies where.

### 3.2 Port 8000 vs 8001
- PRD/docs assume backend on port 8000. Memory note confirms port 8000 is taken on this machine, so backend runs on 8001.
- `config.py` CORS origin correctly points to `http://localhost:5173` (Vite).
- `frontend/src/lib/api.ts` and `frontend/src/hooks/useWebSocket.ts` URLs will need to point to port 8001 when wiring integration.
- **Fix:** Document in a `.env.example` file (not yet created) and note in PROGRESS.md before integration.

---

## 4. Critical Gaps That Will Block Phase 1.3

These are the highest priority issues — implementation cannot proceed correctly without resolving them.

---

### 🔴 GAP-1: Thermal Model — Missing Constant `k` and Oil Baseline

**Affects:** `simulator/thermal_model.py`

PRD Section 5 (F2) gives the winding temp rise formula:
```
winding_temp_rise = k × load_fraction² × 55
```
- The `55°C` reference rise is specified.
- The constant `k` is **never defined** anywhere in any doc.
- The nominal oil temperature at 0% load and 25°C ambient is also undefined (only runtime examples with active load are given).

**Action needed:** Before starting thermal_model.py, decide and document:
```
k = 1.0  (dimensionless correction factor; = 1.0 for reference transformer)
nominal_top_oil_at_0_load = ambient + 40°C
nominal_bot_oil_at_0_load = ambient + 20°C
tau_oil_seconds = 1800   (already in config.py — 30 min thermal lag)
tau_winding_seconds = 600 (10 min lag — not specified, needs to be added to config.py)
```

**Cooling factor application is also ambiguous.** PRD gives `ONAN=1.0, ONAF=0.7, OFAF=0.5` but doesn't say if it's:
- Option A: `oil_rise = thermal_rise × cooling_factor` ← most likely (multiplicative reduction)
- Option B: `oil_temp = ambient + (rise - cooling_factor × rise)`

**Recommended fix:** Create `/docs/THERMAL_PHYSICS.md` with the full formula set before Phase 1.3.

---

### 🔴 GAP-2: DGA Gas Generation Rates Not Specified

**Affects:** `simulator/dga_model.py`

PRD states gas generation increases when hot spot exceeds 150°C, but gives **no formula** for:
- Rate of generation per °C above threshold
- Whether the model is Arrhenius (exponential) or linear
- Baseline ppm/hour values under normal operation per gas (H₂, CH₄, C₂H₄, C₂H₂, CO, CO₂, C₂H₆)

Without this, dga_model.py cannot produce physically realistic values for the Duval Triangle to classify.

**Recommended fix:** Create `/docs/DGA_GAS_GENERATION.md` with a simplified generation model:
```
For T <= 150°C: rate = base_rate_ppm_per_hour (per gas, from IEC 60599 normal ranges)
For T > 150°C:  rate = base_rate × exp(k_arrhenius × (T - 150))
                where k_arrhenius ≈ 0.02 (calibrate so T3 zone is reached by hot_spot scenario peak)
```

---

### 🔴 GAP-3: Duval Triangle Zone Vertices Not Provided

**Affects:** `analytics/dga_analyzer.py`, `frontend/src/lib/duvalGeometry.ts`, `frontend/src/components/charts/DuvalTriangle.tsx`

PRD Section 5 (F4) explicitly states: *"The exact polygon vertices should be derived from IEC 60599. A reasonable approximation is acceptable."* But then provides **only zone names and colors** — no vertex coordinates.

The frontend DuvalTriangle SVG and the backend DGA classifier both need exact (% CH₄, % C₂H₄, % C₂H₂) ternary coordinates for the 7 zone polygons (PD, T1, T2, T3, D1, D2, DT).

**Recommended fix:** Create `/docs/DUVAL_TRIANGLE_VERTICES.md` with approximate IEC 60599 zone boundary coordinates in ternary form. These are published in the standard and widely reproduced; hardcoding a known-good approximation is the right approach for a POC.

Example format needed:
```
Zone T1 (T < 300°C): [(ch4=98, c2h4=2, c2h2=0), (ch4=64, c2h4=36, c2h2=0), ...]
Zone T2 (300-700°C): [...]
...
```

---

### 🔴 GAP-4: FMEA Failure Mode Conditions Defined for FM-001 Only

**Affects:** `analytics/fmea_engine.py`

PRD Section 5 (F5) fully defines only FM-001 (Winding Hot Spot) with 5 conditions and confidence scores. **FM-002 through FM-008 are not detailed** — no conditions, no evidence thresholds, no weights are given for 7 of the 8 failure modes.

**Recommended fix:** Create `/docs/FMEA_DEFINITIONS.md` fully specifying all 8 failure modes before Phase 2.3. This is not needed for Phase 1.3, but should be done before Phase 2.

---

## 5. Medium Priority Issues

### 5.1 Health Score Penalty Values — in code but not in docs

`config.py` correctly defines:
```python
HEALTH_PENALTY_CAUTION  = 25
HEALTH_PENALTY_WARNING  = 50
HEALTH_PENALTY_CRITICAL = 100
```
These are consistent with the worked examples in PRD Section 5 (F6). However, the PRD example shows the derivation (`100 - (50 × 0.30) = 85`) without stating the penalty table explicitly. Any future contributor reading only the PRD would have to reverse-engineer these values.

**Fix:** Add a penalty reference table to PRD Section 5, F6.

### 5.2 Anomaly Detection Window — better in code than in docs

`config.py` specifies:
```python
ANOMALY_BASELINE_WINDOW = 360  # 30 minutes
ANOMALY_Z_CAUTION  = 2.0
ANOMALY_Z_WARNING  = 3.5
ANOMALY_Z_CRITICAL = 5.0
```
PRD Section 5 (F3) only says "baseline + 2× std dev" — it doesn't define the window size, the 3-tier z-score system, or how rate-of-change and z-score combine. The code is more complete than the spec.

**Fix:** PRD Section 5 (F3) should reference these constants or state the thresholds explicitly.

### 5.3 Scenario Durations Not in Integration Contract

Scenario durations are in `config.py` but not in INTEGRATION_CONTRACT. The frontend `BottomTimeline.tsx` progress bar will need these values for accurate display.

**Fix:** Add to INTEGRATION_CONTRACT Section 2.3.1 (scenario_update message schema) as documented fields.

---

## 6. What's in Good Shape (Don't Touch)

- **WebSocket Protocol** (INTEGRATION_CONTRACT Section 2) — thorough, well-specified, all message types covered
- **Pydantic schemas** (`models/schemas.py`) — matches Integration Contract exactly, no drift
- **TypeScript types** (`frontend/src/types/`) — strict, complete, aligned with backend
- **Database schema** (`database/migrations.py`) — correct tables, indexes, auto-migration on startup
- **All stub REST routes** — return valid, contract-conforming response shapes
- **config.py** — comprehensive constants with IEEE/IEC references and `# WHY` comments throughout
- **Scenario state machines** — stages defined, modifiers stubbed, easy to wire up
- **Decisions.md** — all 5 ADRs are well-reasoned

---

## 7. Action Plan (Ordered by Priority)

| Priority | Action | Needed For |
|---|---|---|
| 🔴 1 | Create `docs/THERMAL_PHYSICS.md` — thermal model formula, `k`, baseline, tau values | Phase 1.3 start |
| 🔴 2 | Create `docs/DGA_GAS_GENERATION.md` — per-gas rates, Arrhenius constants, baseline ppm | Phase 1.3 start |
| 🔴 3 | Create `docs/DUVAL_TRIANGLE_VERTICES.md` — zone polygon coordinates (ternary) | Phase 1.3 + 4.2 |
| 🟡 4 | Create `.env.example` — document port, CORS, DB path config vars | Before integration |
| 🟡 5 | Update INTEGRATION_CONTRACT — add SensorStatus vs AlertSeverity callout, scenario durations | Before Phase 1.6 |
| 🟠 6 | Create `docs/FMEA_DEFINITIONS.md` — all 8 failure modes fully specified | Before Phase 2.3 |
| 🟠 7 | Update PRD Section 5 F3 + F6 — reference penalty constants and anomaly thresholds | Doc hygiene |

Items 1–3 are gates for Phase 1.3. Items 4–7 can be done in parallel or deferred to just before the relevant phase.

---

## 8. Files to Create/Update

| File | Action | Reason |
|---|---|---|
| `docs/THERMAL_PHYSICS.md` | CREATE | Thermal model formula spec |
| `docs/DGA_GAS_GENERATION.md` | CREATE | DGA rate model spec |
| `docs/DUVAL_TRIANGLE_VERTICES.md` | CREATE | Zone polygon data |
| `docs/FMEA_DEFINITIONS.md` | CREATE | FM-002 through FM-008 specs |
| `.env.example` | CREATE | Port/config documentation |
| `docs/INTEGRATION_CONTRACT.md` | UPDATE | Section 1.3, 2.3.1, 3.6 |
| `docs/PRD.md` | UPDATE | Section 5 F3 + F6 constant references |
