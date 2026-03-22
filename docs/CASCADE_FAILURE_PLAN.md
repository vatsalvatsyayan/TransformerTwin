# TransformerTwin — Cascading Failure Scenario: Implementation Plan

> **Audience**: Coding agents implementing the `thermal_runaway` scenario.
> **Pre-read**: `BACKEND_ARCHITECTURE.md`, `INTEGRATION_CONTRACT.md`, `docs/PROGRESS.md` (Sessions 9–21 already done).
> **Must not break**: 28/28 backend tests, 125/125 frontend tests, TypeScript build, Python startup.

---

## 1. Domain Physics Rationale

Real transformer catastrophic failures follow a well-documented multi-system chain.
Each stage causes physical conditions that *trigger* the next stage — not just time-based
progression, but genuine causal coupling across mechanical, thermal, chemical, and electrical
subsystems.

```
[Fan Seizure] → [Hot Spot] → [Oil/Paper Chemistry] → [PD] → [Arcing] → [Relay Trip]
    Stage 1         Stage 2          Stage 3            Stage 4   Stage 5    Stage 6
  (Mechanical)    (Thermal)        (Chemical)         (Electrical) (Electrical) (Terminal)
```

### Why each transition is physically justified:

| Transition | Physics |
|-----------|---------|
| Stage 1→2 | Loss of forced-air cooling → oil cannot remove winding heat → hot spot forms |
| Stage 2→3 | Winding temp >100°C → Arrhenius-accelerated cellulose pyrolysis → CO/CO₂ + moisture release; hot oil oxidises → dielectric falls |
| Stage 3→4 | Wet, degraded oil + reduced dielectric strength → void discharges at weak insulation points → H₂/CH₄ (PD signature) |
| Stage 4→5 | PD tracks across degraded paper → sustained arc channel forms → C₂H₂ spike (arcing fingerprint); bushing corona begins |
| Stage 5→6 | Sustained arc causes inter-winding short → instantaneous overcurrent → Buchholz relay + differential relay operate → breaker trips |

---

## 2. Scenario Specification

**Scenario ID**: `thermal_runaway`
**Display Name**: "Thermal Runaway — Full Cascade to Failure"
**Total sim duration**: 9000 sim-seconds
**At 200× speed**: 45 real seconds (excellent demo pacing)
**At 30× speed**: 5 minutes (detailed walkthrough)

### Stage Timeline

| # | Sim-time (s) | @200× (real-s) | Stage Name | Primary Signal |
|---|-------------|-----------------|------------|----------------|
| 1 | 0–1500 | 0–7.5 | Cooling System Failure | Fans go dark, oil temp climbs |
| 2 | 1500–3000 | 7.5–15 | Hot Spot Formation | WINDING_TEMP +35°C, early DGA |
| 3 | 3000–4800 | 15–24 | Oil & Paper Deterioration | OIL_DIELECTRIC falls, CO rising, CO₂/CO <5 |
| 4 | 4800–6600 | 24–33 | Partial Discharge | H₂/CH₄ spike → Duval PD zone |
| 5 | 6600–8100 | 33–40.5 | Arc Development | C₂H₂ spike → Duval D1/D2; bushing drift |
| 6 | 8100–9000 | 40.5–45 | **Terminal Failure** | LOAD_CURRENT → 0; relay trip |

### FMEA Failure Modes Engaged (chronologically)

- Stage 1 → **FM-006** (Cooling System Failure) activates: Monitoring → Probable
- Stage 2 → **FM-001** (Winding Hot Spot) activates: Monitoring → Probable
- Stage 3 → **FM-002** (Paper Degradation) activates: Monitoring → Probable
- Stage 4 → **FM-004** (Partial Discharge) activates: Monitoring → Probable
- Stage 5 → **FM-003** (Arcing Event) activates: Monitoring → Probable
- Stage 6 → All FM scores maxed → Decision risk = CRITICAL

---

## 3. Files to Create

### 3.1 `backend/scenarios/thermal_runaway.py` (NEW)

```python
"""
TransformerTwin — Thermal Runaway Cascade scenario.

Six-stage chain: Cooling Failure → Hot Spot → Oil/Paper Deterioration
→ Partial Discharge → Arcing → Terminal Failure.

Total duration: 9000 sim-seconds.
"""

from scenarios.base import BaseScenario

# --- Stage boundaries (sim-seconds) ---
_STAGE_1_END: float = 1500.0   # Cooling failure
_STAGE_2_END: float = 3000.0   # Hot spot formation
_STAGE_3_END: float = 4800.0   # Oil/paper deterioration
_STAGE_4_END: float = 6600.0   # Partial discharge
_STAGE_5_END: float = 8100.0   # Arcing development
_STAGE_6_END: float = 9000.0   # Terminal failure (end of scenario)

# --- Thermal modifiers (°C, additive to physics model output) ---
_THERMAL = {
    1: {"winding_delta": 8.0,  "top_oil_delta": 3.0},
    2: {"winding_delta": 35.0, "top_oil_delta": 18.0},
    3: {"winding_delta": 55.0, "top_oil_delta": 30.0},
    4: {"winding_delta": 70.0, "top_oil_delta": 38.0},
    5: {"winding_delta": 85.0, "top_oil_delta": 45.0},
    6: {"winding_delta": 0.0,  "top_oil_delta": 0.0},  # De-energised
}

# --- DGA modifiers (ppm/second injection, signed positive = increase) ---
_DGA = {
    1: {},  # No DGA yet
    2: {"DGA_H2": 0.008, "DGA_CH4": 0.010, "DGA_C2H4": 0.012, "DGA_CO": 0.015},
    3: {"DGA_H2": 0.012, "DGA_CH4": 0.018, "DGA_C2H4": 0.025, "DGA_CO": 0.040, "DGA_CO2": 0.025},
    # Stage 4: H2 and CH4 dominant (PD signature — CH4 > C2H4, H2 rising fast)
    4: {"DGA_H2": 0.045, "DGA_CH4": 0.040, "DGA_C2H4": 0.008, "DGA_CO": 0.060, "DGA_CO2": 0.035},
    # Stage 5: C2H2 primary (arcing fingerprint)
    5: {"DGA_C2H2": 0.055, "DGA_H2": 0.080, "DGA_CH4": 0.020, "DGA_CO": 0.080, "DGA_CO2": 0.050},
    # Stage 6: gases stabilize (de-energised), minimal new generation
    6: {"DGA_C2H2": 0.005, "DGA_H2": 0.008},
}

# --- Diagnostic modifiers (additive offset from nominal, applied per-stage) ---
# OIL_DIELECTRIC nominal = 55.0 kV/mm; WARNING < 30 kV/mm; CRITICAL < 20 kV/mm
# OIL_MOISTURE nominal = 8.0 ppm; WARNING = 25 ppm; CRITICAL = 35 ppm
# BUSHING_CAP_HV nominal = 500.0 pF; drift >10% = fault
_DIAG = {
    1: {},
    2: {},
    3: {"OIL_DIELECTRIC": -8.0,  "OIL_MOISTURE": +12.0},
    4: {"OIL_DIELECTRIC": -18.0, "OIL_MOISTURE": +22.0, "BUSHING_CAP_HV": +30.0},
    5: {"OIL_DIELECTRIC": -28.0, "OIL_MOISTURE": +30.0, "BUSHING_CAP_HV": +65.0},
    6: {"OIL_DIELECTRIC": -35.0, "OIL_MOISTURE": +35.0, "BUSHING_CAP_HV": +90.0},
}

_STAGE_NAMES = {
    1: "Stage 1/6: Cooling System Failure",
    2: "Stage 2/6: Hot Spot Formation",
    3: "Stage 3/6: Oil & Paper Deterioration",
    4: "Stage 4/6: Partial Discharge",
    5: "Stage 5/6: Arc Development",
    6: "Stage 6/6: TERMINAL FAILURE — Relay Trip",
}


class ThermalRunawayScenario(BaseScenario):
    """Six-stage cascading failure from cooling loss to terminal relay trip."""

    scenario_id = "thermal_runaway"
    name = "Thermal Runaway — Full Cascade"
    description = (
        "Fan seizure → hot spot → oil/paper degradation → partial discharge → "
        "arcing → protection relay trip. Demonstrates complete transformer failure."
    )
    duration_sim_s = 9000

    def _stage(self) -> int:
        t = self.elapsed_sim_time
        if t < _STAGE_1_END: return 1
        if t < _STAGE_2_END: return 2
        if t < _STAGE_3_END: return 3
        if t < _STAGE_4_END: return 4
        if t < _STAGE_5_END: return 5
        return 6

    def get_current_stage(self) -> str:
        return _STAGE_NAMES[self._stage()]

    def get_thermal_modifiers(self) -> dict[str, float]:
        mods = _THERMAL[self._stage()]
        # Stages 1–5 force ONAN (cooling system failed — no fans)
        if self._stage() < 6:
            mods = dict(mods)
            mods["cooling_mode_override"] = "ONAN"
        return mods

    def get_dga_modifiers(self) -> dict[str, float]:
        return dict(_DGA[self._stage()])

    def get_diagnostic_modifiers(self) -> dict[str, float]:
        """Return additive offsets (from nominal) for diagnostic sensors."""
        return dict(_DIAG[self._stage()])

    def is_terminal_failure(self) -> bool:
        """Return True when Stage 6 is active (relay trip imminent)."""
        return self.elapsed_sim_time >= _STAGE_5_END
```

**Key design notes for implementing agent**:
- `_stage()` helper keeps all stage logic in one place
- `get_diagnostic_modifiers()` is a new method — add it to `BaseScenario` (see §4.1)
- `is_terminal_failure()` is a new method — add it to `BaseScenario` (see §4.1)
- `cooling_mode_override` is embedded in thermal_modifiers dict (already handled by engine — see engine.py:460)

---

### 3.2 `frontend/src/components/panels/TerminalFailureOverlay.tsx` (NEW)

Full-screen overlay rendered when `terminalFailure: true` in the Zustand store.

**Spec:**

```typescript
// Props: none — reads entirely from Zustand store
// Renders: fixed overlay, z-50, dark red gradient bg
// Shows:
//   - Large "⚡ PROTECTION RELAY OPERATED" headline (text-red-400, animate-pulse)
//   - "TRANSFORMER TRIPPED — UNIT OFFLINE" subheading
//   - 6-stage fault chain summary (vertical timeline, each stage as a dot + label)
//   - Sim time of failure (from store.elapsedSimTime)
//   - "Reset to Normal Operation" button → calls triggerScenario('normal') via REST
//     then dispatches updateScenario({ scenario_id: 'normal', ... }) to clear store state
// Does NOT auto-close — user must click Reset
// Styling: bg-gradient-to-b from-black/95 to-red-950/90
//   backdrop-blur-sm, animate-fadeIn (same @keyframes as AlertToast)
```

**Fault chain timeline data** (hardcoded in component, 6 entries):
```typescript
const FAULT_CHAIN = [
  { stage: 1, label: 'Cooling System Failure', icon: '❄️' },
  { stage: 2, label: 'Hot Spot Formation',      icon: '🌡️' },
  { stage: 3, label: 'Oil & Paper Deterioration', icon: '⚗️' },
  { stage: 4, label: 'Partial Discharge',        icon: '⚡' },
  { stage: 5, label: 'Arc Development',          icon: '🔴' },
  { stage: 6, label: 'Terminal Failure',         icon: '💀' },
]
```

---

## 4. Files to Modify

### 4.1 `backend/scenarios/base.py`

Add two new abstract/default methods **with default implementations** (so all existing scenarios continue to work unchanged):

```python
def get_diagnostic_modifiers(self) -> dict[str, float]:
    """Return additive offsets for diagnostic sensors. Default: no effect.

    Keys: "OIL_DIELECTRIC", "OIL_MOISTURE", "BUSHING_CAP_HV", "BUSHING_CAP_LV"
    Values: signed float offset from nominal (e.g. -8.0 lowers dielectric by 8 kV/mm).

    Returns:
        Empty dict (no diagnostic modification) by default.
    """
    return {}

def is_terminal_failure(self) -> bool:
    """Return True when scenario is in terminal failure state (Stage 6).

    When True, engine forces load_current to 0 and emits terminal alert.

    Returns:
        False for all base scenarios.
    """
    return False
```

**Important**: These are NOT `@abstractmethod` — existing scenarios inherit the defaults.

---

### 4.2 `backend/models/schemas.py`

**Change 1**: Add `"thermal_runaway"` to `ScenarioId`:
```python
ScenarioId = Literal[
    "normal", "hot_spot", "arcing", "cooling_failure",
    "partial_discharge", "paper_degradation",
    "thermal_runaway",   # ← add this
]
```

**Change 2**: Add `terminal_failure` field to `WSScenarioUpdateSchema`:
```python
class WSScenarioUpdateSchema(BaseModel):
    type: Literal["scenario_update"] = "scenario_update"
    scenario_id: ScenarioId
    name: str
    stage: str
    progress_percent: float
    elapsed_sim_time: float
    terminal_failure: bool = False   # ← add this field (default False for backwards compat)
```

**Note**: The engine sends `_emit_scenario_update` as a raw dict (not using this Pydantic schema),
so also update that method in `engine.py` (see §4.3). The schema here is the authoritative contract.

---

### 4.3 `backend/simulator/engine.py`

**Change 1**: Add instance variables in `__init__` (after `_cascade_triggered`):
```python
self._terminal_failure: bool = False
self._terminal_failure_emitted: bool = False  # Gate: emit alert exactly once
```

**Change 2**: Add diagnostic sensor accumulators in `__init__`:
```python
# Diagnostic sensor cumulative offsets (reset when scenario returns to normal)
self._diag_offsets: dict[str, float] = {
    "OIL_DIELECTRIC": 0.0,
    "OIL_MOISTURE":   0.0,
    "BUSHING_CAP_HV": 0.0,
    "BUSHING_CAP_LV": 0.0,
}
```

**Change 3**: In `_tick()`, after getting DGA modifiers (step 2, around line 460), also get diagnostic modifiers:
```python
diag_mods = scenario.get_diagnostic_modifiers()   # NEW: dict[str, float]
```

**Change 4**: In `_tick()`, at step 3 (load/ambient), add terminal failure load override:
```python
natural_load = get_load_fraction(self.sim_time)
if self._terminal_failure:
    load_fraction = 0.0          # Breaker opened — no current
elif self.operator_load_override is not None:
    load_fraction = min(self.operator_load_override, natural_load)
else:
    load_fraction = natural_load
```

**Change 5**: In `_tick()`, after step 6 (DGA model), apply diagnostic offsets:
```python
# Apply diagnostic scenario modifiers (before diagnostic sensor state update)
# Only update diag_offsets when a non-normal scenario is active
if scenario.scenario_id != "normal":
    for k, v in diag_mods.items():
        if k in self._diag_offsets:
            self._diag_offsets[k] = v  # Stage-based fixed offset (not accumulation)
else:
    # Reset diagnostic offsets to zero when normal operation resumes
    for k in self._diag_offsets:
        self._diag_offsets[k] = 0.0
```

**Change 6**: In step 7 (diagnostic sensor update), apply the offsets:
```python
# Diagnostic sensors — slow drift + scenario offset + noise
# OIL_DIELECTRIC degrades (lower is worse); clamp at 10 kV/mm (catastrophic failure)
# OIL_MOISTURE rises (higher is worse); clamp at 60 ppm (saturation)
self.state.oil_dielectric = max(
    10.0,
    add_noise("OIL_DIELECTRIC", _DIAG_NOMINALS["OIL_DIELECTRIC"] + self._diag_offsets["OIL_DIELECTRIC"])
)
self.state.oil_moisture = min(
    60.0,
    add_noise("OIL_MOISTURE", _DIAG_NOMINALS["OIL_MOISTURE"] + self._diag_offsets["OIL_MOISTURE"])
)
self.state.bushing_cap_hv = add_noise(
    "BUSHING_CAP_HV", _DIAG_NOMINALS["BUSHING_CAP_HV"] + self._diag_offsets["BUSHING_CAP_HV"]
)
self.state.bushing_cap_lv = add_noise(
    "BUSHING_CAP_LV", _DIAG_NOMINALS["BUSHING_CAP_LV"] + self._diag_offsets["BUSHING_CAP_LV"]
)
```

**Change 7**: In step 8 (advance scenario), add terminal failure interception. REPLACE the existing `is_complete()` block:

```python
# --- 8. Advance scenario ---
self.scenario_manager.advance(dt_s)

# Terminal failure: scenario runs to completion but does NOT reset to normal.
# Instead, the engine freezes in the tripped state until user manually resets.
if scenario.is_terminal_failure() and not self._terminal_failure:
    self._terminal_failure = True
    logger.warning("Terminal failure entered: %s", scenario.scenario_id)

# Do NOT auto-reset a terminal failure scenario to normal.
# Only reset non-terminal completed scenarios.
if self.scenario_manager.is_complete() and not self._terminal_failure:
    logger.info("Scenario '%s' complete — reverting to normal.", scenario.scenario_id)
    self.scenario_manager.trigger("normal")
```

**Change 8**: In step 10 (scenario transition detection), handle terminal failure reset:
```python
if current_scenario_id != self._last_scenario_id:
    if current_scenario_id != "normal":
        await self._emit_scenario_start_alert(current_scenario_id, now_iso)
    else:
        # Scenario transitioned back to normal — clear all failure state
        self._cascade_triggered = False
        self._winding_critical_duration = 0.0
        self._terminal_failure = False              # NEW: reset terminal flag
        self._terminal_failure_emitted = False      # NEW: allow re-trigger
        for k in self._diag_offsets:               # NEW: reset diagnostic offsets
            self._diag_offsets[k] = 0.0
        await self._emit_scenario_update(now_iso)
    self._last_scenario_id = current_scenario_id
```

**Change 9**: Emit terminal failure alert (exactly once), after cascade alert block (~line 675):
```python
# --- 10c. Terminal failure alert: emit once when Stage 6 first entered ---
if self._terminal_failure and not self._terminal_failure_emitted:
    self._terminal_failure_emitted = True
    await self._emit_terminal_failure_alert(now_iso)
```

**Change 10**: In `_emit_scenario_update()`, add `terminal_failure` to the dict:
```python
message = {
    "type": "scenario_update",
    "scenario_id": scenario.scenario_id,
    "name": scenario.name,
    "stage": scenario.get_current_stage(),
    "progress_percent": scenario.progress_percent,
    "elapsed_sim_time": scenario.elapsed_sim_time,
    "cascade_triggered": self._cascade_triggered,
    "cascade_duration_s": round(self._winding_critical_duration, 1),
    "thermal_fatigue_score": round(thermal_fatigue_score, 4),
    "terminal_failure": self._terminal_failure,   # NEW
}
```

**Change 11**: Add `_emit_terminal_failure_alert()` method (alongside `_emit_cascade_alert`):
```python
async def _emit_terminal_failure_alert(self, timestamp: str) -> None:
    """Emit CRITICAL terminal failure alert when protection relay operates.

    This is the final, irreversible alert in the thermal_runaway cascade.
    Physical basis: differential relay + Buchholz relay both operated simultaneously.

    Args:
        timestamp: ISO 8601 UTC timestamp string.
    """
    alert = AlertSchema(
        id=self._next_alert_id(),
        timestamp=timestamp,
        severity="CRITICAL",
        title="PROTECTION RELAY OPERATED — TRANSFORMER TRIPPED",
        description=(
            "Differential relay and Buchholz relay operated simultaneously. "
            "Inter-winding arcing caused instantaneous overcurrent. "
            "Unit de-energised. LOAD_CURRENT = 0. Do not re-energise "
            "without full internal inspection, DGA analysis, and engineering assessment."
        ),
        source="THRESHOLD",
        sensor_ids=["LOAD_CURRENT", "WINDING_TEMP", "DGA_C2H2", "DGA_H2", "OIL_DIELECTRIC"],
        failure_mode_id="FM-003",
        recommended_actions=[
            "Confirm breaker open; lock-out/tag-out (LOTO) before approach",
            "Capture DGA oil sample immediately (gases freeze at current levels)",
            "Notify engineering — do NOT re-energise without IEC 60076-7 post-fault assessment",
            "Initiate insurance claim; schedule internal visual inspection",
            "Coordinate with grid operator for load transfer to standby transformer",
        ],
        acknowledged=False,
        acknowledged_at=None,
        sim_time=self.sim_time,
    )
    message = {"type": "alert", "alert": alert.model_dump()}
    await self._fire_callbacks(self._alert_callbacks, message)
    for cb in self._persist_callbacks:
        await cb(alert)
    logger.critical("TERMINAL FAILURE ALERT emitted at sim_time=%.1f", self.sim_time)
```

---

### 4.4 `backend/scenarios/manager.py`

Add import and register:
```python
from scenarios.thermal_runaway import ThermalRunawayScenario  # NEW

SCENARIO_REGISTRY: dict[str, type[BaseScenario]] = {
    "normal": NormalScenario,
    "hot_spot": HotSpotScenario,
    "arcing": ArcingScenario,
    "cooling_failure": CoolingFailureScenario,
    "partial_discharge": PartialDischargeScenario,
    "paper_degradation": PaperDegradationScenario,
    "thermal_runaway": ThermalRunawayScenario,   # NEW
}
```

---

### 4.5 `backend/config.py`

Add thermal runaway duration constant alongside the other `SCENARIO_*` constants:
```python
# --- Thermal Runaway Cascade scenario ---
# Six-stage cascade total duration: 9000 sim-seconds
# At 200× speed: 45 real seconds; at 30× speed: ~5 minutes
SCENARIO_THERMAL_RUNAWAY_DURATION_S: int = 9000  # Total sim-seconds for full cascade

# Stage boundaries (seconds elapsed in scenario)
THERMAL_RUNAWAY_STAGE_1_END_S: float = 1500.0   # Cooling failure ends, hot spot begins
THERMAL_RUNAWAY_STAGE_2_END_S: float = 3000.0   # Hot spot peak, oil degradation begins
THERMAL_RUNAWAY_STAGE_3_END_S: float = 4800.0   # Oil degraded, PD begins
THERMAL_RUNAWAY_STAGE_4_END_S: float = 6600.0   # PD established, arcing begins
THERMAL_RUNAWAY_STAGE_5_END_S: float = 8100.0   # Arcing peak, terminal failure
# Stage 6: 8100–9000 (terminal failure)
```

Use `SCENARIO_THERMAL_RUNAWAY_DURATION_S` in `thermal_runaway.py` instead of hardcoded `9000`.

---

## 5. Frontend Changes

### 5.1 `frontend/src/types/scenario.ts`

Add `thermal_runaway` to the `ScenarioId` type:
```typescript
export type ScenarioId =
  | 'normal' | 'hot_spot' | 'arcing' | 'cooling_failure'
  | 'partial_discharge' | 'paper_degradation'
  | 'thermal_runaway'   // NEW
```

---

### 5.2 `frontend/src/store/index.ts`

Add `terminalFailure` field:
```typescript
// In the state type interface (alongside cascadeTriggered):
terminalFailure: boolean

// In the initial state:
terminalFailure: false,

// In updateScenario action (alongside cascadeTriggered):
terminalFailure: p.terminal_failure ?? false,
```

---

### 5.3 `frontend/src/hooks/useWebSocket.ts`

In the `scenario_update` handler, the existing code extracts `cascade_triggered` via a cast.
Add `terminal_failure` extraction the same way:
```typescript
case 'scenario_update': {
    const rawCascade = (msg as { cascade_triggered?: boolean }).cascade_triggered ?? false
    const cascadeNow = msg.scenario_id === 'normal' ? false : rawCascade
    const terminalNow = (msg as { terminal_failure?: boolean }).terminal_failure ?? false   // NEW
    updateScenario({
        scenario_id: msg.scenario_id,
        name: msg.name,
        stage: msg.stage,
        progress_percent: msg.progress_percent,
        elapsed_sim_time: msg.elapsed_sim_time,
        cascade_triggered: cascadeNow,
        thermal_fatigue_score: (msg as { thermal_fatigue_score?: number }).thermal_fatigue_score,
        terminal_failure: terminalNow,   // NEW
    })
    break
}
```

Also update `store/index.ts`'s `updateScenario` action signature to accept `terminal_failure?: boolean`.

---

### 5.4 `frontend/src/components/common/ScenarioSelector.tsx`

Add the thermal_runaway scenario card. It should have **distinctive styling** to signal danger:
- Background: `bg-red-950/30 border-red-800/60` (vs `bg-slate-800/40` for others)
- Badge: `DANGER` label in red (vs other scenarios which have `FAULT`)
- Warning line: "⚠ Cannot be interrupted mid-cascade — completes to terminal failure"
- Duration label: "~45s @200× · ~5min @30×"
- The selector should show all 7 scenarios (normal + 6 faults)

Add metadata alongside existing scenarios (or in whatever pattern is used for scenario cards):
```typescript
{
  id: 'thermal_runaway',
  name: 'Thermal Runaway — Full Cascade',
  description: 'Six-stage cascade: cooling failure → hot spot → oil/paper deterioration → partial discharge → arcing → relay trip. Demonstrates complete transformer failure.',
  duration: '~45s @200× / ~5min @30×',
  severity: 'CRITICAL',
  badge: 'DANGER',
  stages: 6,
}
```

---

### 5.5 `frontend/src/components/common/ScenarioProgressBar.tsx`

**No changes required** — the existing bar already shows `stage` (from the store), which will
now show the Stage N/6 labels from `ThermalRunawayScenario.get_current_stage()`.

However, **add terminal failure styling**: when `terminalFailure === true`, show a special
static banner instead of the progress bar:
```tsx
{terminalFailure && (
  <div className="flex items-center gap-2 px-3 py-1 bg-black border-b border-red-600/80 animate-pulse">
    <span className="text-[10px] font-bold text-red-300 uppercase tracking-widest">
      ⚡ TRANSFORMER TRIPPED — PROTECTION RELAY OPERATED
    </span>
  </div>
)}
```

Read `terminalFailure` from the store: `const terminalFailure = useStore((s) => s.terminalFailure)`.

---

### 5.6 `frontend/src/components/panels/TerminalFailureOverlay.tsx` (NEW)

Create this component per the spec in §3.2. It is rendered in `App.tsx` only when
`terminalFailure: true`.

**Reset flow**: The "Reset to Normal Operation" button should:
1. Call `POST /api/scenario/normal/trigger` (the existing REST endpoint)
2. On success: the backend transitions to normal → WebSocket `scenario_update` with `scenario_id: 'normal'` and `terminal_failure: false` → `updateScenario()` in store sets `terminalFailure: false`
3. The overlay automatically unmounts because `terminalFailure` becomes false

No extra store action needed — the existing WebSocket flow handles cleanup automatically.

---

### 5.7 `frontend/src/App.tsx`

Import and render `TerminalFailureOverlay`:
```tsx
import { TerminalFailureOverlay } from './components/panels/TerminalFailureOverlay'

// In JSX, render alongside AlertToast (near the top, outside the main layout):
{terminalFailure && <TerminalFailureOverlay />}
```

Read `terminalFailure` from the store in App.tsx.

---

## 6. Integration Contract Updates

Update `docs/INTEGRATION_CONTRACT.md` Section 3.7 (WebSocket: scenario_update):

Add to the `scenario_update` message schema:
```
terminal_failure  boolean   True when Stage 6 (terminal failure) is active.
                            Frontend should show TerminalFailureOverlay.
                            Resets to false when scenario transitions to 'normal'.
```

Add `thermal_runaway` to the ScenarioId enum table in Section 1.

---

## 7. Testing Checklist

### Backend (run: `cd backend && .venv/bin/python -m pytest tests/ -v`)

- [ ] All 28 existing tests still pass (no regressions)
- [ ] `thermal_runaway` is in `SCENARIO_REGISTRY` — check by hitting `GET /api/scenario/status` after triggering
- [ ] `POST /api/scenario/thermal_runaway/trigger` returns `{ scenario_id: 'thermal_runaway', status: 'TRIGGERED' }`
- [ ] Sensor values are physically realistic per stage (winding_temp matches stage offsets)
- [ ] Stage 6 sets `terminal_failure: true` in `scenario_update` WS message
- [ ] `LOAD_CURRENT` → 0 in Stage 6

### Frontend (run: `cd frontend && npm test`)

- [ ] All 125 existing tests still pass
- [ ] TypeScript build clean: `npm run build`
- [ ] No `any` types introduced

### Manual QA (Playwright or browser)

- [ ] At 200× speed: trigger thermal_runaway, observe 6 stage transitions in ~45 seconds
- [ ] Stage 1: FAN_BANK_1 forced OFF despite temp >65°C (ONAN cooling)
- [ ] Stage 2: WINDING_TEMP shows ~35°C above model expected
- [ ] Stage 3: OIL_DIELECTRIC falls, OIL_MOISTURE rises in diagnostic tab
- [ ] Stage 3: CO₂/CO ratio in DGA panel approaches warning (<5)
- [ ] Stage 4: Duval triangle shows PD zone
- [ ] Stage 5: Duval triangle shows D1/D2 zone, C2H2 dominant
- [ ] Stage 5: FM-003 (Arcing) shows Probable in FMEA panel
- [ ] Stage 6: LOAD_CURRENT = 0, TerminalFailureOverlay appears
- [ ] Stage 6: Decision panel shows CRITICAL risk
- [ ] "Reset to Normal Operation" button clears overlay and restores normal state
- [ ] FMEA panel shows all 5 failure modes simultaneously (FM-001 through FM-006)
- [ ] Scenario progress bar shows "Stage N/6:" label correctly
- [ ] ScenarioProgressBar shows terminal failure banner in Stage 6

---

## 8. Implementation Order (for coding agents)

Follow this order to avoid breaking the build at any intermediate step:

```
Step 1: backend/config.py              — add constants (no risk)
Step 2: backend/scenarios/base.py      — add default methods (no risk, backwards compatible)
Step 3: backend/models/schemas.py      — add ScenarioId + WSScenarioUpdateSchema field
Step 4: backend/scenarios/thermal_runaway.py  — new file
Step 5: backend/scenarios/manager.py   — register scenario
Step 6: backend/simulator/engine.py    — add terminal_failure logic + diagnostic offsets
Step 7: Verify: cd backend && python -c "import main" succeeds (no import errors)
Step 8: Verify: cd backend && python -m pytest tests/ -v (28/28 pass)

Step 9:  frontend/src/types/scenario.ts        — add ScenarioId
Step 10: frontend/src/store/index.ts           — add terminalFailure state
Step 11: frontend/src/hooks/useWebSocket.ts    — handle terminal_failure
Step 12: frontend/src/components/common/ScenarioSelector.tsx  — add card
Step 13: frontend/src/components/common/ScenarioProgressBar.tsx — terminal banner
Step 14: frontend/src/components/panels/TerminalFailureOverlay.tsx  — new file
Step 15: frontend/src/App.tsx                  — render overlay

Step 16: Verify: cd frontend && npm test (125/125 pass)
Step 17: Verify: cd frontend && npm run build (zero TS errors)
Step 18: Update docs/INTEGRATION_CONTRACT.md
Step 19: Update docs/PROGRESS.md (mark session complete)
Step 20: Update docs/DECISIONS.md (log ADR for terminal failure state machine)
```

---

## 9. Backwards Compatibility Guarantees

| Concern | Impact | Mitigation |
|---------|--------|------------|
| `get_diagnostic_modifiers()` added to `BaseScenario` | All 6 existing scenarios | Default returns `{}` — no change in behavior |
| `is_terminal_failure()` added to `BaseScenario` | All 6 existing scenarios | Default returns `False` — no change in behavior |
| `ScenarioId` literal extended | Frontend type + WS schema | Additive change only; existing values unchanged |
| `WSScenarioUpdateSchema.terminal_failure` | Any code consuming scenario_update | Field has `default=False` — backwards compatible |
| `_diag_offsets` dict added to engine | None | New instance variable, no side effects |
| Diagnostic sensor clamping | `oil_dielectric` now has `max(10.0, ...)` | Minor: existing nominal ~55 is far above 10; no effect during normal operation |
| `_terminal_failure` blocks `is_complete()` reset | Only `thermal_runaway` scenario | `is_terminal_failure()` only returns True for `ThermalRunawayScenario` |

---

## 10. Architecture Decision to Log (ADR-030)

**Title**: Terminal Failure as Non-Resettable Engine State

**Context**: All existing scenarios auto-reset to `normal` when `is_complete()` returns True.
The `thermal_runaway` scenario requires a permanent tripped state — the transformer is offline
and cannot resume without explicit operator action (unlike e.g. hot_spot which naturally resolves).

**Decision**: Add `_terminal_failure` boolean to the engine. When True:
1. The scenario completion block is skipped (no auto-reset)
2. `load_fraction` is overridden to 0.0
3. `scenario_update` carries `terminal_failure: true`
4. A one-time CRITICAL alert is emitted
5. State clears only when user explicitly triggers `normal` scenario

**Rationale**: This mirrors real-world transformer protection: once a differential relay
operates, the breaker remains open until engineering sign-off. The operator must consciously
decide to re-energise.

**Alternatives rejected**:
- Auto-reset after 30s in terminal state: removes the drama and educational value
- New `tripped` scenario ID: would require additional REST endpoint, WS handler, frontend state — overkill for what is essentially a flag

---

*End of plan. All existing tests must pass at every step.*
