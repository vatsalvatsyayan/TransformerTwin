# TransformerTwin — Backend Architecture & Implementation Plan

**Version:** 1.0  
**Date:** March 20, 2026  
**Status:** Implementation-Ready  
**Companion Document:** TransformerTwin PRD v1.0  

---

## Table of Contents

1. Project Structure
2. Sensor Simulator Module
3. Fault Injection System
4. WebSocket Server Design
5. REST API Design
6. Anomaly Detection Engine
7. DGA Analysis Module
8. Failure Mode Engine (FMEA)
9. Health Score Calculator
10. What-If Simulation Engine
11. Database Design
12. Implementation Order
13. Testing Strategy

---

## 1. Project Structure

### 1.1 File Tree

```
backend/
├── main.py                      # FastAPI app entry, lifespan, CORS, WebSocket + REST mount
├── config.py                    # All constants, thresholds, magic numbers with explanations
├── requirements.txt             # Python dependencies
│
├── simulator/
│   ├── __init__.py
│   ├── engine.py                # SimulatorEngine: main async loop, tick dispatcher
│   ├── thermal_model.py         # Thermal physics: winding, oil, ambient, cooling
│   ├── dga_model.py             # DGA gas generation model (temp → gas ppm rates)
│   ├── load_profile.py          # Daily/weekly load curve + ambient cycle generators
│   ├── equipment_model.py       # Fan, pump, tap changer logic
│   └── noise.py                 # Gaussian noise generators per sensor type
│
├── scenarios/
│   ├── __init__.py
│   ├── manager.py               # ScenarioManager: state machine, trigger, progress tracking
│   ├── base.py                  # BaseScenario abstract class
│   ├── normal.py                # Normal operation (no fault)
│   ├── hot_spot.py              # FM-001 developing hot spot (2-hour progression)
│   ├── arcing.py                # FM-003 arcing event (15-minute progression)
│   └── cooling_failure.py       # FM-006 cooling fan failure (1-hour progression)
│
├── analytics/
│   ├── __init__.py
│   ├── anomaly_detector.py      # Actual-vs-expected engine, deviation classification
│   ├── dga_analyzer.py          # Duval Triangle, TDCG, CO₂/CO ratio, gas rates
│   ├── fmea_engine.py           # Failure mode pattern matching + scoring
│   └── health_score.py          # Weighted composite health score calculator
│
├── api/
│   ├── __init__.py
│   ├── routes_sensor.py         # GET /api/sensors/current, /api/sensors/history
│   ├── routes_health.py         # GET /api/health, /api/health/history
│   ├── routes_dga.py            # GET /api/dga/analysis
│   ├── routes_fmea.py           # GET /api/fmea
│   ├── routes_alerts.py         # GET /api/alerts, PUT /api/alerts/{id}/acknowledge
│   ├── routes_simulation.py     # POST /api/simulation
│   ├── routes_scenario.py       # POST /api/scenario/{id}/trigger, GET /api/scenario/status
│   ├── routes_transformer.py    # GET /api/transformer
│   ├── routes_speed.py          # PUT /api/simulation/speed
│   └── websocket_handler.py     # WebSocket endpoint, connection manager, message dispatch
│
├── database/
│   ├── __init__.py
│   ├── db.py                    # aiosqlite connection pool, init schema, helpers
│   ├── queries.py               # Named query functions (insert_reading, get_history, etc.)
│   └── migrations.py            # Schema creation / migration on startup
│
└── models/
    ├── __init__.py
    └── schemas.py               # All Pydantic models for API requests/responses & internal types
```

### 1.2 Naming Conventions

- **Files:** `snake_case.py`
- **Classes:** `PascalCase` (e.g., `SimulatorEngine`, `ScenarioManager`)
- **Functions/methods:** `snake_case` (e.g., `compute_winding_temp`, `get_health_score`)
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `THERMAL_TAU_SECONDS`, `DGA_UPDATE_INTERVAL`)
- **Pydantic models:** `PascalCase` with `Schema` suffix for API models (e.g., `SensorUpdateSchema`, `AlertResponseSchema`)

### 1.3 Module Dependency Graph

```
main.py
  ├── api/* (all route modules)
  │     └── database/queries.py
  │     └── models/schemas.py
  ├── api/websocket_handler.py
  │     └── simulator/engine.py
  │           ├── simulator/thermal_model.py
  │           ├── simulator/dga_model.py
  │           ├── simulator/load_profile.py
  │           ├── simulator/equipment_model.py
  │           ├── simulator/noise.py
  │           └── scenarios/manager.py
  │                 └── scenarios/{normal,hot_spot,arcing,cooling_failure}.py
  │     └── analytics/anomaly_detector.py
  │     └── analytics/dga_analyzer.py
  │     └── analytics/fmea_engine.py
  │     └── analytics/health_score.py
  ├── database/db.py
  └── config.py (imported everywhere)
```

### 1.4 Dependencies (requirements.txt)

```
fastapi==0.111.0
uvicorn[standard]==0.30.1
aiosqlite==0.20.0
pydantic==2.7.4
numpy==1.26.4
```

Only 5 dependencies. NumPy is used for noise generation and array math in thermal/DGA models.

---

## 2. Sensor Simulator Module

### 2.1 Architecture Overview

The `SimulatorEngine` runs an async loop that advances simulation time by a fixed tick interval, computes all sensor values using physics models, applies any active fault scenario modifiers, adds noise, and emits results. Each sensor group fires at its own interval.

```python
# simulator/engine.py

class SimulatorEngine:
    def __init__(self, speed_multiplier: int = 1):
        self.sim_time: float = 0.0          # seconds since start
        self.speed: int = speed_multiplier   # 1 = real-time, 60 = 1 hour/min
        self.tick_interval: float = 1.0      # wall-clock seconds between ticks
        self.state: TransformerState = TransformerState()
        self.scenario_manager: ScenarioManager = ScenarioManager()
        self.running: bool = False

    async def run(self) -> AsyncGenerator[SensorBatch, None]:
        """Main loop. Yields sensor batches at appropriate intervals."""
        self.running = True
        while self.running:
            dt = self.tick_interval * self.speed  # sim seconds per wall tick
            self.sim_time += dt
            self.state = self._compute_tick(dt)
            batches = self._collect_due_batches()
            for batch in batches:
                yield batch
            await asyncio.sleep(self.tick_interval)

    def _compute_tick(self, dt: float) -> TransformerState:
        """Single simulation step."""
        # 1. Compute ambient + load from profiles
        # 2. Apply scenario modifiers
        # 3. Compute thermal chain
        # 4. Compute equipment states
        # 5. Compute DGA (if due)
        # 6. Compute slow diagnostics (if due)
        # 7. Add noise
        ...
```

### 2.2 TransformerState Data Class

```python
# simulator/engine.py

from dataclasses import dataclass, field

@dataclass
class TransformerState:
    """Complete snapshot of all sensor values at a point in time."""
    # Thermal / Electrical (updated every 5 sim-seconds)
    top_oil_temp: float = 65.0       # °C
    bot_oil_temp: float = 45.0       # °C
    winding_temp: float = 80.0       # °C
    load_current: float = 50.0       # % of rating
    ambient_temp: float = 25.0       # °C

    # DGA (updated every 300 sim-seconds)
    dga_h2: float = 45.0             # ppm
    dga_ch4: float = 22.0
    dga_c2h6: float = 15.0
    dga_c2h4: float = 8.0
    dga_c2h2: float = 0.5
    dga_co: float = 200.0
    dga_co2: float = 1800.0

    # Equipment (updated every 10 sim-seconds)
    fan_bank_1: bool = False
    fan_bank_2: bool = False
    oil_pump_1: bool = False
    tap_position: int = 17           # 1–33
    tap_op_count: int = 23456

    # Slow diagnostics (updated every 3600 sim-seconds)
    oil_moisture: float = 12.0       # ppm
    oil_dielectric: float = 52.0     # kV
    bushing_cap_hv: float = 500.0    # pF (baseline)
    bushing_cap_lv: float = 420.0    # pF (baseline)

    # Internal (not directly reported, used for thermal model memory)
    _top_oil_target: float = 65.0
    _winding_target: float = 80.0
    _cooling_ramp: float = 1.0       # 0→1 ramp for cooling effect delay
```

### 2.3 Load Profile

```python
# simulator/load_profile.py

import math
import numpy as np

# Weekday hourly load targets (% of rated capacity)
# Index = hour (0–23). Source: PRD Section "Sensor Correlation Physics" item 6.
# Pattern: trough at 3 AM (35%), ramp to peak at 14:00 (85%), down to 50% by 22:00
WEEKDAY_LOAD = [
    38, 36, 35, 35, 37, 40,  # 00–05: nighttime trough
    50, 60, 70, 78, 82, 84,  # 06–11: morning ramp
    85, 85, 85, 83, 80, 75,  # 12–17: afternoon peak
    68, 62, 55, 50, 45, 42,  # 18–23: evening decline
]

# Weekend: flat 50–60%
WEEKEND_LOAD = [
    52, 50, 50, 50, 50, 51,
    53, 55, 57, 58, 59, 60,
    60, 60, 59, 58, 57, 56,
    55, 54, 53, 52, 52, 52,
]

def get_load_percent(sim_time: float, is_weekend: bool = False) -> float:
    """
    Compute target load % at a given simulation time.

    Uses linear interpolation between hourly targets + ±5% Gaussian noise.
    PRD: "Load follows daily pattern: peak 7am-6pm weekdays, ~60% on weekends. 
    Random noise of ±5%."

    Args:
        sim_time: Seconds since simulation start.
        is_weekend: Whether current sim day is a weekend.
    Returns:
        Load percentage (float, can exceed 100 with noise but clamped to [5, 120]).
    """
    profile = WEEKEND_LOAD if is_weekend else WEEKDAY_LOAD
    hour_of_day = (sim_time / 3600.0) % 24.0
    hour_int = int(hour_of_day)
    frac = hour_of_day - hour_int
    next_hour = (hour_int + 1) % 24
    base = profile[hour_int] + frac * (profile[next_hour] - profile[hour_int])

    # ±5% Gaussian noise (sigma = 2.5 gives ~95% of values within ±5%)
    noise = np.random.normal(0, 2.5)
    return float(np.clip(base + noise, 5.0, 120.0))


def get_ambient_temp(sim_time: float, seasonal_baseline: float = 30.0) -> float:
    """
    Compute ambient temperature at a given simulation time.

    PRD: "Daily cycle: low at 5am, peak at 3pm, amplitude ~10°C. 
    Baseline depends on 'season' setting."

    Model: sinusoidal with period 24h, peak at 15:00 (hour 15), trough at 03:00.
    T_ambient = baseline + amplitude * sin(2π * (hour - 9) / 24)
    Phase shift: sin peaks at π/2, so (hour - 9)/24 * 2π = π/2 when hour = 15. ✓

    Args:
        sim_time: Seconds since simulation start.
        seasonal_baseline: Center temperature for the season (°C). 
                          Summer=30, Spring/Fall=20, Winter=5.
    Returns:
        Ambient temperature in °C.
    """
    amplitude = 5.0  # ±5°C swing → 10°C total range
    hour_of_day = (sim_time / 3600.0) % 24.0
    # sin peaks at π/2; we want peak at hour=15: (15-9)/24 * 2π = π/2
    phase = 2.0 * math.pi * (hour_of_day - 9.0) / 24.0
    temp = seasonal_baseline + amplitude * math.sin(phase)
    # Add tiny noise for realism (σ=0.3°C)
    noise = np.random.normal(0, 0.3)
    return temp + noise
```

### 2.4 Thermal Model

This is the heart of the simulator. Each tick computes temperatures using the physics chain from PRD Section "Sensor Correlation Physics."

```python
# simulator/thermal_model.py

import math

# === Constants (all sourced from PRD) ===

WINDING_BASE_RISE = 55.0
# PRD: "base_rise ≈ 55°C at rated load" — winding temp rise above ambient at 100% load

OIL_BASE_RISE = 40.0
# Top oil temp rise above ambient at rated load (empirical, lower than winding due to cooling)

OIL_EXPONENT = 0.8
# PRD: "n ≈ 0.8 for ONAN" — oil rise exponent for load dependency

THERMAL_TAU = 1800.0
# PRD: "thermal time constant of ~30 minutes" = 1800 seconds
# This governs how fast top oil temp tracks toward its target.
# After 1 τ, response reaches 63.2% of the step change.

COOLING_RAMP_TAU = 300.0
# PRD: "Cooling takes 5 minutes (300 seconds) to reach full effect"

# Cooling mode factors — fraction of rated oil rise
# PRD: "cooling_factor is 1.0 (ONAN), 0.7 (ONAF), 0.5 (OFAF)"
COOLING_FACTORS = {
    "ONAN": 1.0,
    "ONAF": 0.7,
    "OFAF": 0.5,
}

NORMAL_OIL_GRADIENT = 20.0
# PRD: "Gradient should be 15–25°C during normal operation."
# We use 20 as the nominal gradient; noise will vary it 15–25.


def determine_cooling_mode(fan1: bool, fan2: bool, pump: bool) -> str:
    """Derive the effective cooling mode from equipment states."""
    if pump and (fan1 or fan2):
        return "OFAF"
    elif fan1 or fan2:
        return "ONAF"
    return "ONAN"


def compute_cooling_factor(
    current_factor: float,
    target_mode: str,
    dt: float,
) -> float:
    """
    Ramp cooling factor toward target with exponential approach.
    
    Cooling effect is not instantaneous — PRD specifies 5-minute ramp.
    Uses the same exponential approach as oil temperature.
    """
    target = COOLING_FACTORS[target_mode]
    alpha = 1.0 - math.exp(-dt / COOLING_RAMP_TAU)
    return current_factor + (target - current_factor) * alpha


def compute_winding_temp_target(
    ambient: float,
    load_fraction: float,
    cooling_factor: float,
    fault_offset: float = 0.0,
) -> float:
    """
    Compute the steady-state winding hot spot temperature.

    PRD formula: expected_winding = ambient + 55 × (load_fraction)² × cooling_factor
    The quadratic relationship means doubling load quadruples the temperature rise.

    Args:
        ambient: Ambient temperature (°C).
        load_fraction: Load as fraction (0.0–1.5). E.g., 78% load → 0.78.
        cooling_factor: Current effective cooling factor (1.0=ONAN, 0.5=OFAF).
        fault_offset: Additional degrees from fault injection (°C).
    """
    rise = WINDING_BASE_RISE * (load_fraction ** 2) * cooling_factor
    return ambient + rise + fault_offset


def compute_top_oil_temp(
    current_top_oil: float,
    target_top_oil: float,
    dt: float,
) -> float:
    """
    Compute new top oil temperature with thermal lag.

    PRD: "Top oil temperature follows winding temp with a thermal time constant of ~30 minutes"
    Model: exponential approach — top_oil(t) = top_oil(t-1) + (target - top_oil(t-1)) × (1 - e^(-dt/τ))

    Args:
        current_top_oil: Current top oil temp (°C).
        target_top_oil: Steady-state target top oil temp (°C).
        dt: Time step in seconds.
    """
    alpha = 1.0 - math.exp(-dt / THERMAL_TAU)
    return current_top_oil + (target_top_oil - current_top_oil) * alpha


def compute_top_oil_target(
    ambient: float,
    load_fraction: float,
    cooling_factor: float,
    fault_offset: float = 0.0,
) -> float:
    """
    Compute steady-state target for top oil temperature.

    PRD: target_top_oil = ambient + oil_rise_at_rated × (load_fraction)^n × cooling_factor
    where n ≈ 0.8 for ONAN.
    """
    rise = OIL_BASE_RISE * (load_fraction ** OIL_EXPONENT) * cooling_factor
    return ambient + rise + fault_offset


def compute_bottom_oil_temp(top_oil: float, gradient_offset: float = 0.0) -> float:
    """
    Compute bottom oil temperature from top oil.

    PRD: "Should be 15–25°C below top oil temp."
    Nominal gradient = 20°C. Fault conditions may alter this.
    """
    return top_oil - NORMAL_OIL_GRADIENT + gradient_offset
```

### 2.5 DGA Gas Generation Model

```python
# simulator/dga_model.py

import math
import numpy as np

# Gas generation rate model:
# PRD: "Gas production rate increases exponentially with temperature."
# Normal operation: very slow. Hotspot >150°C: measurable over days.
# Hotspot >300°C: measurable over hours. Arcing: acetylene instantly.
#
# We model generation rate (ppm/hour) as an exponential function of hot spot temp.
# rate = base_rate * exp(k * (hotspot - threshold))
# Each gas has its own activation threshold and rate constant.

GAS_GENERATION_PARAMS = {
    # (threshold_°C, k_constant, base_rate_ppm_per_hour)
    # threshold: temp above which generation becomes measurable
    # k: exponential sensitivity to temperature
    # base_rate: generation rate at the threshold temperature
    "DGA_H2":   {"threshold": 120, "k": 0.03, "base_rate": 0.05},
    "DGA_CH4":  {"threshold": 150, "k": 0.04, "base_rate": 0.08},  # low-temp thermal
    "DGA_C2H6": {"threshold": 200, "k": 0.03, "base_rate": 0.04},  # moderate thermal
    "DGA_C2H4": {"threshold": 250, "k": 0.05, "base_rate": 0.06},  # high-temp thermal
    "DGA_C2H2": {"threshold": 500, "k": 0.08, "base_rate": 0.01},  # arcing only
    "DGA_CO":   {"threshold": 105, "k": 0.015, "base_rate": 0.02}, # cellulose aging (lower threshold)
    "DGA_CO2":  {"threshold": 100, "k": 0.012, "base_rate": 0.05}, # cellulose aging
}

def compute_gas_generation_rate(
    gas_id: str,
    hotspot_temp: float,
    fault_rate_override: float | None = None,
) -> float:
    """
    Compute gas generation rate in ppm/hour for a single gas.

    The exponential model ensures:
    - At normal operating temps (60-95°C): rates are near zero
    - At moderate overheating (150°C): CH4/H2 become measurable
    - At severe overheating (300°C): C2H4 measurable
    - Acetylene only from arcing (fault_rate_override used for arc scenarios)

    Args:
        gas_id: Sensor ID (e.g., "DGA_H2")
        hotspot_temp: Current winding hot spot temperature (°C)
        fault_rate_override: If set, overrides computed rate (used by fault scenarios)
    Returns:
        Generation rate in ppm/hour (≥ 0)
    """
    if fault_rate_override is not None:
        return max(0.0, fault_rate_override)

    params = GAS_GENERATION_PARAMS[gas_id]
    if hotspot_temp < params["threshold"]:
        return 0.0

    delta = hotspot_temp - params["threshold"]
    rate = params["base_rate"] * math.exp(params["k"] * delta)
    return rate


def update_gas_levels(
    current_levels: dict[str, float],
    hotspot_temp: float,
    dt_hours: float,
    fault_overrides: dict[str, float] | None = None,
) -> dict[str, float]:
    """
    Update all DGA gas levels for one time step.

    Args:
        current_levels: Current gas ppm values {gas_id: ppm}
        hotspot_temp: Current hot spot temperature
        dt_hours: Time step in hours (e.g., 300 seconds = 300/3600 ≈ 0.083 hours)
        fault_overrides: Optional per-gas rate overrides from fault scenarios
    Returns:
        Updated gas levels dict
    """
    updated = {}
    for gas_id, current_ppm in current_levels.items():
        override = fault_overrides.get(gas_id) if fault_overrides else None
        rate = compute_gas_generation_rate(gas_id, hotspot_temp, override)
        new_ppm = current_ppm + rate * dt_hours
        # Add very small noise (σ = 0.5% of current value, min 0.1 ppm)
        noise = np.random.normal(0, max(0.1, current_ppm * 0.005))
        updated[gas_id] = max(0.0, new_ppm + noise)
    return updated
```

### 2.6 Equipment Model

```python
# simulator/equipment_model.py

def update_equipment(
    top_oil_temp: float,
    load_percent: float,
    current_fan1: bool,
    current_fan2: bool,
    current_pump: bool,
    tap_position: int,
    tap_op_count: int,
    fault_fan1_forced_off: bool = False,
    fault_fan2_forced_off: bool = False,
) -> tuple[bool, bool, bool, int, int]:
    """
    Compute equipment states based on operating conditions.

    PRD cooling activation rules:
    - Fan Bank 1 ON when TOP_OIL_TEMP > 65°C
    - Fan Bank 2 ON when TOP_OIL_TEMP > 75°C
    - Oil Pump ON when LOAD_CURRENT > 70% OR TOP_OIL_TEMP > 80°C

    Hysteresis: equipment turns OFF when condition drops 3°C / 5% below threshold
    to prevent chattering.
    """
    # Fan Bank 1: ON > 65°C, OFF < 62°C
    fan1 = current_fan1
    if not fault_fan1_forced_off:
        if top_oil_temp > 65.0:
            fan1 = True
        elif top_oil_temp < 62.0:
            fan1 = False
    else:
        fan1 = False  # Forced off by cooling_failure scenario

    # Fan Bank 2: ON > 75°C, OFF < 72°C
    fan2 = current_fan2
    if not fault_fan2_forced_off:
        if top_oil_temp > 75.0:
            fan2 = True
        elif top_oil_temp < 72.0:
            fan2 = False
    else:
        fan2 = False

    # Oil Pump: ON if load > 70% or top_oil > 80°C
    pump = current_pump
    if load_percent > 70.0 or top_oil_temp > 80.0:
        pump = True
    elif load_percent < 65.0 and top_oil_temp < 77.0:
        pump = False

    # Tap changer: stays at current position (no automatic tap logic for POC)
    # Tap operations count: no change unless scenario modifies it
    return fan1, fan2, pump, tap_position, tap_op_count
```

### 2.7 Noise Model

```python
# simulator/noise.py

import numpy as np

# Per-sensor noise parameters
# sigma chosen so 95% of noise falls within the specified range
# For temperature sensors: ±0.3°C range → σ = 0.15
# For DGA: ±0.5% of value or min 0.1 ppm
# For equipment: no noise (boolean/integer)

NOISE_SIGMA = {
    "TOP_OIL_TEMP": 0.15,    # ±0.3°C at 95% CI
    "BOT_OIL_TEMP": 0.15,
    "WINDING_TEMP": 0.20,    # Slightly noisier — derived from fiber optic
    "LOAD_CURRENT": 0.0,     # Noise already in load_profile
    "AMBIENT_TEMP": 0.0,     # Noise already in load_profile
    "OIL_MOISTURE": 0.3,
    "OIL_DIELECTRIC": 0.5,
    "BUSHING_CAP_HV": 0.2,
    "BUSHING_CAP_LV": 0.2,
}

def add_noise(sensor_id: str, value: float) -> float:
    """Add Gaussian noise to a sensor value. Returns noisy value."""
    sigma = NOISE_SIGMA.get(sensor_id, 0.0)
    if sigma == 0.0:
        return value
    return value + np.random.normal(0, sigma)
```

### 2.8 Simulation Tick Scheduling

The engine tracks accumulators for each sensor group to determine when each group is "due" for an update.

```python
# Inside SimulatorEngine

# Sensor group intervals (sim-seconds). From PRD F2 table.
INTERVALS = {
    "thermal": 5,       # TOP_OIL_TEMP, BOT_OIL_TEMP, WINDING_TEMP, LOAD_CURRENT, AMBIENT_TEMP
    "dga": 300,         # All DGA_* sensors
    "equipment": 10,    # FAN_BANK_*, OIL_PUMP_1, TAP_*
    "diagnostic": 3600, # OIL_MOISTURE, OIL_DIELECTRIC, BUSHING_CAP_*
}

def _collect_due_batches(self) -> list[SensorBatch]:
    """Check which sensor groups are due for emission based on sim_time."""
    batches = []
    for group, interval in INTERVALS.items():
        # Accumulator tracks time since last emission for this group
        if self.sim_time - self._last_emit[group] >= interval:
            self._last_emit[group] = self.sim_time
            batches.append(self._build_batch(group))
    return batches
```

---

## 3. Fault Injection System

### 3.1 Scenario State Machine

Each scenario is a state machine with discrete stages. The `ScenarioManager` holds the active scenario and advances it based on elapsed simulation time.

```python
# scenarios/base.py

from abc import ABC, abstractmethod
from dataclasses import dataclass

@dataclass
class FaultModifiers:
    """Adjustments applied on top of normal physics calculations."""
    winding_temp_offset: float = 0.0      # Additional °C added to winding target
    top_oil_temp_offset: float = 0.0
    oil_gradient_offset: float = 0.0       # Change to top-bottom oil gradient
    dga_rate_overrides: dict[str, float] | None = None  # ppm/hour per gas
    fan1_forced_off: bool = False
    fan2_forced_off: bool = False
    pump_forced_off: bool = False
    bushing_drift_hv: float = 0.0          # pF drift from baseline
    bushing_drift_lv: float = 0.0
    moisture_offset: float = 0.0
    dielectric_offset: float = 0.0

class BaseScenario(ABC):
    def __init__(self):
        self.start_time: float | None = None
        self.active: bool = False

    def trigger(self, sim_time: float):
        self.start_time = sim_time
        self.active = True

    def elapsed(self, sim_time: float) -> float:
        """Seconds since scenario started."""
        if self.start_time is None:
            return 0.0
        return sim_time - self.start_time

    @abstractmethod
    def get_modifiers(self, sim_time: float) -> FaultModifiers:
        """Return current fault modifiers based on elapsed time."""
        ...

    @abstractmethod
    def get_stage_info(self, sim_time: float) -> dict:
        """Return current stage name, progress, description."""
        ...
```

### 3.2 Hot Spot Scenario

```python
# scenarios/hot_spot.py

class HotSpotScenario(BaseScenario):
    """
    FM-001: Developing Hot Spot. Duration: 2 simulated hours (7200 seconds).
    PRD Scenario 1 — 4 stages.

    Stage 1 (0–30 min):  Winding temp creeps +0.5°C per reading above expected.
                         Cumulative: offset grows by 0.5°C every 5s → +180°C at 30 min? No.
                         PRD says "+0.5°C above expected per reading" meaning the deviation
                         is 0.5°C initially and grows. We model as linear ramp:
                         offset = 0.5 * (elapsed_min / 30) → offset of 0.5°C at min 1, ~0.5°C at 30 min
                         Actually PRD: "creeping up 0.5°C above expected per reading (cumulative)"
                         Interpretation: offset grows by 0.5°C every thermal update (5s).
                         At 30 min = 1800s / 5s = 360 readings → 180°C? Too high.
                         Better interpretation: offset ramps linearly to 5°C over 30 min.

    Realistic model: offset ramps smoothly from 0 to 20°C over 2 hours.
    """
    DURATION = 7200  # 2 hours in seconds

    STAGES = [
        # (end_time_s, name, description)
        (1800,  "Stage 1: Onset",        "Winding temp creeping above expected"),
        (3600,  "Stage 2: Gas onset",     "DGA gases beginning to rise"),
        (5400,  "Stage 3: Anomaly",       "Anomaly detection flagging, Duval T1"),
        (7200,  "Stage 4: Progression",   "Fault progressing, Duval T1→T2"),
    ]

    def get_modifiers(self, sim_time: float) -> FaultModifiers:
        elapsed = self.elapsed(sim_time)
        progress = min(elapsed / self.DURATION, 1.0)  # 0.0 → 1.0

        # Winding temperature offset: 0 → 20°C over 2 hours (linear ramp)
        winding_offset = 20.0 * progress

        # DGA gas rates (ppm/hour) — escalate with progress
        # Stage 1 (0–0.25 progress): no significant DGA change
        # Stage 2+ (0.25–1.0): gases ramp up
        dga_overrides = None
        if progress > 0.25:
            gas_progress = (progress - 0.25) / 0.75  # 0→1 within gas-active range
            dga_overrides = {
                "DGA_H2":   3.0 * gas_progress,   # up to 3 ppm/hr
                "DGA_CH4":  4.0 * gas_progress,   # up to 4 ppm/hr → crosses 75 ppm caution ~45min
                "DGA_C2H6": 1.5 * gas_progress,
                "DGA_C2H4": 5.0 * gas_progress,   # up to 5 ppm/hr → crosses 50 ppm caution ~60min
                "DGA_C2H2": 0.0,                    # No acetylene (not arcing)
                "DGA_CO":   0.5 * gas_progress,
                "DGA_CO2":  1.0 * gas_progress,
            }

        return FaultModifiers(
            winding_temp_offset=winding_offset,
            top_oil_temp_offset=winding_offset * 0.5,  # Oil rises less than winding
            dga_rate_overrides=dga_overrides,
        )

    def get_stage_info(self, sim_time: float) -> dict:
        elapsed = self.elapsed(sim_time)
        for end_time, name, description in self.STAGES:
            if elapsed <= end_time:
                stage_start = self.STAGES[self.STAGES.index((end_time, name, description)) - 1][0] if self.STAGES.index((end_time, name, description)) > 0 else 0
                stage_progress = (elapsed - stage_start) / (end_time - stage_start)
                return {
                    "stage": name,
                    "description": description,
                    "progress_percent": min(elapsed / self.DURATION * 100, 100),
                    "elapsed_sim_time": elapsed,
                }
        return {"stage": "Complete", "progress_percent": 100.0, "elapsed_sim_time": elapsed}
```

### 3.3 Arcing Scenario

```python
# scenarios/arcing.py

class ArcingScenario(BaseScenario):
    """
    FM-003: Arcing Event. Duration: 15 simulated minutes (900 seconds).
    PRD Scenario 2 — sudden onset, dramatic acetylene spike.
    """
    DURATION = 900

    def get_modifiers(self, sim_time: float) -> FaultModifiers:
        elapsed = self.elapsed(sim_time)
        progress = min(elapsed / self.DURATION, 1.0)

        # Acetylene: instant spike at 5 min (300s), continues rising
        # PRD: C2H2 jumps from 0.5 to 8 ppm at 5 min, then to 15 ppm at 10 min
        dga_overrides = {}
        if elapsed < 300:
            # Pre-event: no changes yet
            return FaultModifiers()
        elif elapsed < 600:
            # Minutes 5–10: initial spike
            spike_progress = (elapsed - 300) / 300  # 0→1 over 5 min
            dga_overrides = {
                "DGA_C2H2": 100.0,  # Very high rate → rapid jump
                "DGA_H2":   80.0,   # H₂ also spikes
                "DGA_CH4":  5.0,
                "DGA_C2H4": 10.0,
                "DGA_C2H6": 2.0,
                "DGA_CO":   1.0,
                "DGA_CO2":  2.0,
            }
        else:
            # Minutes 10–15: sustained elevated rates
            dga_overrides = {
                "DGA_C2H2": 60.0,  # Slower but still generating
                "DGA_H2":   40.0,
                "DGA_CH4":  3.0,
                "DGA_C2H4": 5.0,
                "DGA_C2H6": 1.0,
                "DGA_CO":   0.5,
                "DGA_CO2":  1.0,
            }

        return FaultModifiers(
            winding_temp_offset=3.0,  # Minor temp increase from arc energy
            dga_rate_overrides=dga_overrides,
        )
```

### 3.4 Cooling Failure Scenario

```python
# scenarios/cooling_failure.py

class CoolingFailureScenario(BaseScenario):
    """
    FM-006: Cooling System Failure. Duration: 1 simulated hour (3600 seconds).
    PRD Scenario 3 — Fan Bank 1 fails during high-load period.
    """
    DURATION = 3600

    def get_modifiers(self, sim_time: float) -> FaultModifiers:
        elapsed = self.elapsed(sim_time)
        progress = min(elapsed / self.DURATION, 1.0)

        # Fan 1 forced off immediately at trigger
        # Thermal effect builds over time as cooling mode degrades from ONAF → ONAN
        # After 30 min, slight DGA uptick
        dga_overrides = None
        if elapsed > 1800:  # After 30 min
            gas_progress = (elapsed - 1800) / 1800  # 0→1 over remaining 30 min
            dga_overrides = {
                "DGA_H2":   0.3 * gas_progress,
                "DGA_CH4":  0.5 * gas_progress,
                "DGA_C2H6": 0.2 * gas_progress,
                "DGA_C2H4": 0.3 * gas_progress,
                "DGA_C2H2": 0.0,
                "DGA_CO":   0.1 * gas_progress,
                "DGA_CO2":  0.2 * gas_progress,
            }

        return FaultModifiers(
            fan1_forced_off=True,
            dga_rate_overrides=dga_overrides,
        )
```

### 3.5 Scenario Manager

```python
# scenarios/manager.py

class ScenarioManager:
    SCENARIOS = {
        "normal": NormalScenario,
        "hot_spot": HotSpotScenario,
        "arcing": ArcingScenario,
        "cooling_failure": CoolingFailureScenario,
    }

    def __init__(self):
        self.active_scenario: BaseScenario = NormalScenario()
        self.active_id: str = "normal"

    def trigger(self, scenario_id: str, sim_time: float) -> dict:
        """Activate a new scenario. Replaces any currently active scenario."""
        cls = self.SCENARIOS.get(scenario_id)
        if not cls:
            raise ValueError(f"Unknown scenario: {scenario_id}")
        self.active_scenario = cls()
        self.active_scenario.trigger(sim_time)
        self.active_id = scenario_id
        return self.get_status(sim_time)

    def get_modifiers(self, sim_time: float) -> FaultModifiers:
        if not self.active_scenario.active:
            return FaultModifiers()
        return self.active_scenario.get_modifiers(sim_time)

    def get_status(self, sim_time: float) -> dict:
        info = self.active_scenario.get_stage_info(sim_time)
        return {
            "active_scenario": self.active_id,
            "name": self.active_scenario.__class__.__doc__.split('.')[0].strip() if self.active_scenario.__doc__ else self.active_id,
            **info,
        }
```

### 3.6 Multiple Simultaneous Faults

For the POC, only one scenario runs at a time. Triggering a new scenario replaces the active one. This matches the PRD's demo flow where scenarios are triggered one at a time. The `FaultModifiers` dataclass is designed to be additive if future versions need to combine faults — simply sum the offsets and merge the DGA override dicts.

---

## 4. WebSocket Server Design

### 4.1 Connection Lifecycle

```
Client connects → Server sends connection_ack → Server starts streaming
→ Client may send commands (set_speed, trigger_scenario, acknowledge_alert, pong)
→ Server sends sensor_update, health_update, alert, scenario_update, ping
→ Client disconnects OR server detects stale connection
```

### 4.2 WebSocket Handler

```python
# api/websocket_handler.py

from fastapi import WebSocket, WebSocketDisconnect
import asyncio
import json
from datetime import datetime

class ConnectionManager:
    """Manages WebSocket connections. Supports single client for POC."""

    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        """Send message to all connected clients."""
        dead = []
        for conn in self.active_connections:
            try:
                await conn.send_json(message)
            except Exception:
                dead.append(conn)
        for conn in dead:
            self.active_connections.remove(conn)


async def websocket_endpoint(
    websocket: WebSocket,
    manager: ConnectionManager,
    engine: "SimulatorEngine",
    anomaly_detector: "AnomalyDetector",
    dga_analyzer: "DGAAnalyzer",
    fmea_engine: "FMEAEngine",
    health_calculator: "HealthScoreCalculator",
    alert_manager: "AlertManager",
    db: "Database",
):
    await manager.connect(websocket)

    # Send connection acknowledgment
    await websocket.send_json({
        "type": "connection_ack",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "sim_time": engine.sim_time,
        "speed_multiplier": engine.speed,
        "active_scenario": engine.scenario_manager.active_id,
    })

    # Launch two concurrent tasks:
    # 1. Streaming task: reads from engine, processes analytics, broadcasts
    # 2. Receive task: listens for client commands

    async def stream_task():
        async for batch in engine.run():
            # Process through analytics pipeline
            anomalies = anomaly_detector.evaluate(batch, engine.state)
            dga_result = dga_analyzer.analyze(engine.state) if batch.group == "dga" else None
            fmea_result = fmea_engine.evaluate(engine.state, anomalies, dga_result)
            health = health_calculator.compute(engine.state, anomalies, dga_result)
            new_alerts = alert_manager.check_and_generate(
                anomalies, fmea_result, health, engine.sim_time
            )

            # Persist to database
            await db.insert_sensor_batch(batch)
            for a in anomalies:
                await db.insert_anomaly(a)
            await db.insert_health_score(health)
            for alert in new_alerts:
                await db.insert_alert(alert)

            # Broadcast sensor update
            await manager.broadcast(batch.to_ws_message())

            # Broadcast health if changed
            if health.changed:
                await manager.broadcast(health.to_ws_message())

            # Broadcast new alerts
            for alert in new_alerts:
                await manager.broadcast(alert.to_ws_message())

            # Broadcast scenario progress (every thermal tick)
            if batch.group == "thermal":
                status = engine.scenario_manager.get_status(engine.sim_time)
                if engine.scenario_manager.active_id != "normal":
                    await manager.broadcast({
                        "type": "scenario_update",
                        **status,
                    })

    async def receive_task():
        try:
            while True:
                data = await websocket.receive_json()
                msg_type = data.get("type")

                if msg_type == "pong":
                    pass  # Heartbeat response, just keep alive

                elif msg_type == "set_speed":
                    engine.speed = int(data["speed_multiplier"])

                elif msg_type == "trigger_scenario":
                    engine.scenario_manager.trigger(data["scenario_id"], engine.sim_time)

                elif msg_type == "acknowledge_alert":
                    await db.acknowledge_alert(data["alert_id"])
        except WebSocketDisconnect:
            manager.disconnect(websocket)

    # Run both tasks; cancel streaming when client disconnects
    stream = asyncio.create_task(stream_task())
    receive = asyncio.create_task(receive_task())
    done, pending = await asyncio.wait(
        [stream, receive], return_when=asyncio.FIRST_COMPLETED
    )
    for task in pending:
        task.cancel()
    manager.disconnect(websocket)
```

### 4.3 Heartbeat

The server sends `{"type": "ping", "timestamp": "..."}` every 30 wall-clock seconds. The client responds with `{"type": "pong"}`. If no pong is received within 60 seconds, the server closes the connection. This is implemented as a third task in the WebSocket handler:

```python
async def ping_task():
    while True:
        await asyncio.sleep(30)
        try:
            await websocket.send_json({
                "type": "ping",
                "timestamp": datetime.utcnow().isoformat() + "Z",
            })
        except Exception:
            break
```

### 4.4 Backpressure Handling

At high simulation speeds (60×), the server may produce messages faster than the client can process. Strategy:

- The server drops `sensor_update` messages if the WebSocket send buffer exceeds 50 messages. The latest message for each group always wins (drop older ones).
- `alert` and `health_update` messages are never dropped.
- Implementation: use a bounded `asyncio.Queue(maxsize=100)` between the engine and the broadcast logic. If full, drain and discard the oldest non-alert messages.

---

## 5. REST API Design

### 5.1 Application Setup

```python
# main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database.db import Database
from simulator.engine import SimulatorEngine
from api.websocket_handler import ConnectionManager, websocket_endpoint

# Shared instances
db = Database()
engine = SimulatorEngine()
conn_manager = ConnectionManager()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await db.initialize()
    yield
    # Shutdown
    engine.running = False
    await db.close()

app = FastAPI(title="TransformerTwin API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routes
from api.routes_sensor import router as sensor_router
from api.routes_health import router as health_router
from api.routes_dga import router as dga_router
from api.routes_fmea import router as fmea_router
from api.routes_alerts import router as alerts_router
from api.routes_simulation import router as sim_router
from api.routes_scenario import router as scenario_router
from api.routes_transformer import router as transformer_router
from api.routes_speed import router as speed_router

app.include_router(sensor_router, prefix="/api")
app.include_router(health_router, prefix="/api")
app.include_router(dga_router, prefix="/api")
app.include_router(fmea_router, prefix="/api")
app.include_router(alerts_router, prefix="/api")
app.include_router(sim_router, prefix="/api")
app.include_router(scenario_router, prefix="/api")
app.include_router(transformer_router, prefix="/api")
app.include_router(speed_router, prefix="/api")

@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    # Wire up all dependencies
    await websocket_endpoint(websocket, conn_manager, engine, ...)
```

### 5.2 Route Modules

Each route module follows this pattern:

```python
# api/routes_sensor.py

from fastapi import APIRouter, Query
from datetime import datetime, timedelta
from models.schemas import SensorCurrentResponse, SensorHistoryResponse

router = APIRouter(tags=["sensors"])

@router.get("/sensors/current", response_model=SensorCurrentResponse)
async def get_current_sensors():
    """Returns latest reading for all sensors. PRD Section 7.1."""
    from main import engine
    state = engine.state
    return SensorCurrentResponse.from_state(state, engine.sim_time)

@router.get("/sensors/history", response_model=SensorHistoryResponse)
async def get_sensor_history(
    sensor_id: str = Query(..., description="Sensor ID, e.g. TOP_OIL_TEMP"),
    from_time: datetime | None = Query(None, alias="from"),
    to_time: datetime | None = Query(None, alias="to"),
    limit: int = Query(1000, ge=1, le=10000),
):
    """Returns historical readings for a sensor. PRD Section 7.1."""
    from main import db
    if from_time is None:
        from_time = datetime.utcnow() - timedelta(hours=2)
    if to_time is None:
        to_time = datetime.utcnow()
    readings = await db.get_sensor_history(sensor_id, from_time, to_time, limit)
    return SensorHistoryResponse(sensor_id=sensor_id, unit=get_unit(sensor_id), readings=readings)
```

All other route modules follow identical patterns — thin handlers that read from engine state or query the database. See PRD Section 7.1 for the complete endpoint list and response schemas.

### 5.3 Error Handling

```python
# main.py — global exception handler

from fastapi.responses import JSONResponse

@app.exception_handler(ValueError)
async def value_error_handler(request, exc):
    return JSONResponse(status_code=422, content={"detail": str(exc)})

@app.exception_handler(Exception)
async def generic_error_handler(request, exc):
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
```

---

## 6. Anomaly Detection Engine

### 6.1 Architecture

The anomaly detector computes an expected value for each thermal sensor using the same physics model as the simulator, then measures deviation.

```python
# analytics/anomaly_detector.py

import math
from dataclasses import dataclass
from config import (
    ANOMALY_DEVIATION_NORMAL,    # 5% — PRD F3
    ANOMALY_DEVIATION_CAUTION,   # 15%
    ANOMALY_DEVIATION_WARNING,   # 30%
    BASELINE_WINDOW_SECONDS,     # 600 seconds (10 minutes) — PRD F3 edge case
    TRANSIENT_DEADBAND_SECONDS,  # 120 seconds (2 minutes) — PRD F3 edge case
)

@dataclass
class AnomalyResult:
    sensor_id: str
    actual: float
    expected: float
    deviation_percent: float
    severity: str  # NORMAL | CAUTION | WARNING | CRITICAL

class AnomalyDetector:
    def __init__(self):
        self.baseline_ready: bool = False
        self.baseline_start_time: float | None = None
        self.last_load_change_time: float = 0.0
        self.previous_load: float = 50.0
        # DGA baselines: {gas_id: {"mean": float, "std": float}}
        self.dga_baselines: dict[str, dict] = {}
        self._dga_history: dict[str, list[float]] = {}  # accumulates first 30 min

    def evaluate(
        self,
        batch: "SensorBatch",
        state: "TransformerState",
        sim_time: float,
    ) -> list[AnomalyResult]:
        """
        Evaluate a sensor batch for anomalies.

        Called on every sensor group update. Returns a list of AnomalyResult
        for sensors that deviate from expected values.
        """
        results = []

        # Check if we're in baseline learning mode (first 10 minutes)
        # PRD F3 edge case: "Use the first 10 minutes of readings to establish baseline.
        # During this window, anomaly detection operates in 'learning' mode and generates no alerts."
        if self.baseline_start_time is None:
            self.baseline_start_time = sim_time
        if sim_time - self.baseline_start_time < BASELINE_WINDOW_SECONDS:
            # Accumulate DGA baseline data
            if batch.group == "dga":
                for gas_id, value in batch.sensors.items():
                    self._dga_history.setdefault(gas_id, []).append(value)
            return []  # No anomalies during learning

        # Compute DGA baselines once learning period ends
        if not self.baseline_ready:
            self._compute_dga_baselines()
            self.baseline_ready = True

        # Check transient deadband (no anomalies for 2 min after >10% load change)
        # PRD F3: "Apply a deadband of 2 minutes after a load change >10%"
        load_delta = abs(state.load_current - self.previous_load)
        if load_delta > 10.0:
            self.last_load_change_time = sim_time
            self.previous_load = state.load_current
        if sim_time - self.last_load_change_time < TRANSIENT_DEADBAND_SECONDS:
            return []

        if batch.group == "thermal":
            results.extend(self._evaluate_thermal(state))
        elif batch.group == "dga":
            results.extend(self._evaluate_dga(state))

        return results

    def _evaluate_thermal(self, state: "TransformerState") -> list[AnomalyResult]:
        """Compare actual thermal values to physics-based expected values."""
        from simulator.thermal_model import (
            compute_winding_temp_target,
            compute_top_oil_target,
            determine_cooling_mode,
            COOLING_FACTORS,
        )

        cooling_mode = determine_cooling_mode(
            state.fan_bank_1, state.fan_bank_2, state.oil_pump_1
        )
        cf = COOLING_FACTORS[cooling_mode]
        load_frac = state.load_current / 100.0

        results = []

        # Winding temperature
        expected_winding = compute_winding_temp_target(state.ambient_temp, load_frac, cf)
        results.append(self._classify("WINDING_TEMP", state.winding_temp, expected_winding))

        # Top oil temperature
        expected_top_oil = compute_top_oil_target(state.ambient_temp, load_frac, cf)
        results.append(self._classify("TOP_OIL_TEMP", state.top_oil_temp, expected_top_oil))

        # Bottom oil temperature
        expected_bot_oil = expected_top_oil - 20.0
        results.append(self._classify("BOT_OIL_TEMP", state.bot_oil_temp, expected_bot_oil))

        return [r for r in results if r.severity != "NORMAL"]

    def _evaluate_dga(self, state: "TransformerState") -> list[AnomalyResult]:
        """Evaluate DGA gases against absolute thresholds + baseline drift."""
        from config import DGA_THRESHOLDS  # See config.py section below
        results = []
        gas_values = {
            "DGA_H2": state.dga_h2, "DGA_CH4": state.dga_ch4,
            "DGA_C2H6": state.dga_c2h6, "DGA_C2H4": state.dga_c2h4,
            "DGA_C2H2": state.dga_c2h2, "DGA_CO": state.dga_co,
            "DGA_CO2": state.dga_co2,
        }
        for gas_id, value in gas_values.items():
            thresholds = DGA_THRESHOLDS[gas_id]
            if value > thresholds["critical"]:
                severity = "CRITICAL"
            elif value > thresholds["warning"]:
                severity = "WARNING"
            elif value > thresholds["caution"]:
                severity = "CAUTION"
            else:
                severity = "NORMAL"

            if severity != "NORMAL":
                expected = self.dga_baselines.get(gas_id, {}).get("mean", thresholds["normal_max"])
                deviation = ((value - expected) / expected * 100) if expected > 0 else 0
                results.append(AnomalyResult(gas_id, value, expected, deviation, severity))

        return results

    def _classify(self, sensor_id: str, actual: float, expected: float) -> AnomalyResult:
        """Classify deviation severity for thermal sensors."""
        if expected == 0:
            return AnomalyResult(sensor_id, actual, expected, 0.0, "NORMAL")
        deviation = abs(actual - expected) / expected * 100
        if deviation > ANOMALY_DEVIATION_WARNING:   # >30%
            severity = "CRITICAL"
        elif deviation > ANOMALY_DEVIATION_CAUTION:  # >15%
            severity = "WARNING"
        elif deviation > ANOMALY_DEVIATION_NORMAL:   # >5%
            severity = "CAUTION"
        else:
            severity = "NORMAL"
        return AnomalyResult(sensor_id, actual, expected, deviation, severity)

    def _compute_dga_baselines(self):
        """Compute mean and std for each gas from the learning period."""
        import numpy as np
        for gas_id, values in self._dga_history.items():
            arr = np.array(values)
            self.dga_baselines[gas_id] = {
                "mean": float(arr.mean()),
                "std": float(arr.std()) if len(arr) > 1 else 1.0,
            }
```

### 6.2 Config: DGA Thresholds

```python
# config.py (excerpt)

# DGA gas thresholds in ppm. Source: PRD sensor specification table.
DGA_THRESHOLDS = {
    "DGA_H2":   {"normal_max": 100, "caution": 100, "warning": 200, "critical": 500},
    "DGA_CH4":  {"normal_max": 75,  "caution": 75,  "warning": 125, "critical": 400},
    "DGA_C2H6": {"normal_max": 65,  "caution": 65,  "warning": 100, "critical": 200},
    "DGA_C2H4": {"normal_max": 50,  "caution": 50,  "warning": 100, "critical": 200},
    "DGA_C2H2": {"normal_max": 2,   "caution": 2,   "warning": 10,  "critical": 35},
    "DGA_CO":   {"normal_max": 350, "caution": 350,  "warning": 570, "critical": 1400},
    "DGA_CO2":  {"normal_max": 2500,"caution": 2500, "warning": 4000,"critical": 10000},
}

# Anomaly deviation thresholds (percent). Source: PRD F3 table.
ANOMALY_DEVIATION_NORMAL = 5.0    # Within ±5% = NORMAL
ANOMALY_DEVIATION_CAUTION = 15.0  # 5–15% = CAUTION
ANOMALY_DEVIATION_WARNING = 30.0  # 15–30% = WARNING; >30% = CRITICAL

# Baseline learning window. PRD F3 edge case: "first 10 minutes"
BASELINE_WINDOW_SECONDS = 600

# Transient deadband. PRD F3: "deadband of 2 minutes after load change >10%"
TRANSIENT_DEADBAND_SECONDS = 120
```

---

## 7. DGA Analysis Module

### 7.1 Duval Triangle Implementation

The Duval Triangle 1 is a ternary diagram. We define zone boundaries as polygons in ternary coordinates (%CH₄, %C₂H₄, %C₂H₂) and use a point-in-polygon test.

```python
# analytics/dga_analyzer.py

from dataclasses import dataclass

@dataclass
class DuvalResult:
    pct_ch4: float
    pct_c2h4: float
    pct_c2h2: float
    zone: str          # PD, T1, T2, T3, D1, D2, DT
    zone_label: str

# Zone boundary polygons in ternary coordinates [%CH4, %C2H4, %C2H2].
# Each polygon is a list of vertices (clockwise). Coordinates sum to 100.
# Derived from IEC 60599 / Duval Triangle 1 standard boundaries.
DUVAL_ZONES = {
    "PD": {
        "label": "Partial Discharge",
        "vertices": [(98, 2, 0), (98, 0, 2), (100, 0, 0)],
    },
    "T1": {
        "label": "Thermal Fault <300°C",
        "vertices": [(96, 0, 4), (96, 4, 0), (76, 20, 4), (76, 0, 24)],
        # Adjusted: high CH4 (76-98), low C2H4 (<20), low C2H2 (<4)
    },
    "T2": {
        "label": "Thermal Fault 300–700°C",
        "vertices": [(76, 20, 4), (46, 50, 4), (46, 0, 54), (76, 0, 24)],
        # Medium CH4 (46-76), medium C2H4 (20-50), low C2H2 (<4)
        # Note: simplified polygon; actual boundaries are more complex
    },
    "T3": {
        "label": "Thermal Fault >700°C",
        "vertices": [(46, 50, 4), (0, 96, 4), (0, 85, 15), (15, 50, 35), (46, 0, 54)],
        # Low CH4, high C2H4 (>50), low C2H2 (<15)
    },
    "D1": {
        "label": "Low Energy Discharge",
        "vertices": [(23, 0, 77), (23, 23, 54), (0, 23, 77), (0, 0, 100)],
        # Low CH4 (<23), low C2H4 (<23), high C2H2 (>13)
    },
    "D2": {
        "label": "High Energy Discharge",
        "vertices": [(23, 23, 54), (23, 40, 37), (0, 40, 60), (0, 23, 77)],
        # Low CH4 (<23), medium C2H4 (<40), very high C2H2 (>29)
    },
    "DT": {
        "label": "Mixed Discharge + Thermal",
        "vertices": [(15, 50, 35), (0, 85, 15), (0, 40, 60), (23, 40, 37), (23, 23, 54), (46, 0, 54)],
        # Intermediate zone
    },
}

def ternary_to_cartesian(pct_ch4: float, pct_c2h4: float, pct_c2h2: float) -> tuple[float, float]:
    """
    Convert ternary coordinates to 2D Cartesian for point-in-polygon testing.

    Standard ternary → Cartesian mapping for an equilateral triangle:
    - CH4 at top vertex (0, 1)
    - C2H4 at bottom-right vertex (1, 0)
    - C2H2 at bottom-left vertex (-0.5, 0) — but we use standard orientation:
      x = 0.5 * (2*b + c) / (a + b + c)
      y = (sqrt(3)/2) * c / (a + b + c)
    where a=%CH4, b=%C2H4, c=%C2H2

    Actually using the standard mapping:
      x = pct_c2h4 + pct_c2h2 / 2
      y = pct_c2h2 * sqrt(3) / 2
    (with coordinates normalized to sum=100)
    """
    import math
    x = pct_c2h4 + pct_c2h2 / 2.0
    y = pct_c2h2 * math.sqrt(3) / 2.0
    return (x, y)


def point_in_polygon(px: float, py: float, polygon: list[tuple[float, float]]) -> bool:
    """
    Ray casting algorithm for point-in-polygon test.

    Standard algorithm: cast a horizontal ray from the point to the right
    and count how many polygon edges it crosses. Odd = inside, even = outside.
    """
    n = len(polygon)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def classify_duval(ch4_ppm: float, c2h4_ppm: float, c2h2_ppm: float) -> DuvalResult:
    """
    Classify a DGA reading using Duval Triangle 1.

    PRD F4: "If Sum = 0, no fault diagnosis possible"
    """
    total = ch4_ppm + c2h4_ppm + c2h2_ppm
    if total < 0.1:  # Effectively zero
        return DuvalResult(0, 0, 0, "NONE", "Insufficient data for Duval analysis")

    pct_ch4 = (ch4_ppm / total) * 100
    pct_c2h4 = (c2h4_ppm / total) * 100
    pct_c2h2 = (c2h2_ppm / total) * 100

    # Convert point and all zone polygons to Cartesian, then test
    px, py = ternary_to_cartesian(pct_ch4, pct_c2h4, pct_c2h2)

    for zone_id, zone_def in DUVAL_ZONES.items():
        cart_polygon = [
            ternary_to_cartesian(v[0], v[1], v[2]) for v in zone_def["vertices"]
        ]
        if point_in_polygon(px, py, cart_polygon):
            return DuvalResult(pct_ch4, pct_c2h4, pct_c2h2, zone_id, zone_def["label"])

    # Fallback: if no zone matched (edge case at boundaries), classify as DT
    return DuvalResult(pct_ch4, pct_c2h4, pct_c2h2, "DT", "Mixed Discharge + Thermal")
```

### 7.2 TDCG Computation

```python
# analytics/dga_analyzer.py (continued)

def compute_tdcg(state: "TransformerState") -> tuple[float, str]:
    """
    Total Dissolved Combustible Gas = H₂ + CH₄ + C₂H₆ + C₂H₄ + C₂H₂ + CO

    PRD thresholds: Normal (<720), Caution (720–1920), Warning (1920–4630), Critical (>4630)
    """
    tdcg = state.dga_h2 + state.dga_ch4 + state.dga_c2h6 + state.dga_c2h4 + state.dga_c2h2 + state.dga_co
    if tdcg > 4630:
        status = "CRITICAL"
    elif tdcg > 1920:
        status = "WARNING"
    elif tdcg > 720:
        status = "CAUTION"
    else:
        status = "NORMAL"
    return tdcg, status
```

### 7.3 CO₂/CO Ratio

```python
def compute_co2_co_ratio(co2: float, co: float) -> tuple[float, str]:
    """
    PRD: <3 = fault involving paper (serious), 3–10 = possible paper involvement, >10 = normal aging
    """
    if co < 1.0:  # Avoid division by zero
        return 999.0, "Normal paper aging"
    ratio = co2 / co
    if ratio < 3.0:
        interpretation = "Fault involving cellulose — serious"
    elif ratio < 10.0:
        interpretation = "Possible paper involvement"
    else:
        interpretation = "Normal paper aging"
    return ratio, interpretation
```

### 7.4 Gas Rate of Change

```python
def compute_gas_rates(
    current_values: dict[str, float],
    history: list[dict],  # [{timestamp, values: {gas_id: ppm}}] — last 24 hours
) -> dict[str, dict]:
    """
    Compute rate of change (ppm/day) for each gas.

    PRD: "Rate of change per day. Rapidly increasing = active fault."
    Uses linear regression over available history.
    """
    rates = {}
    for gas_id, current in current_values.items():
        if len(history) < 2:
            rates[gas_id] = {"rate_ppm_per_day": 0.0, "trend": "STABLE"}
            continue

        # Simple: (current - oldest) / time_span_days
        oldest = history[0]["values"].get(gas_id, current)
        time_span_hours = (history[-1]["sim_time"] - history[0]["sim_time"]) / 3600.0
        if time_span_hours < 0.1:
            rates[gas_id] = {"rate_ppm_per_day": 0.0, "trend": "STABLE"}
            continue

        rate_per_day = (current - oldest) / time_span_hours * 24.0
        trend = "RISING" if rate_per_day > 1.0 else "FALLING" if rate_per_day < -1.0 else "STABLE"
        rates[gas_id] = {"rate_ppm_per_day": round(rate_per_day, 2), "trend": trend}

    return rates
```

### 7.5 Complete DGA Analyzer Class

```python
class DGAAnalyzer:
    def __init__(self):
        self.dga_history: list[dict] = []  # Ring buffer, max 288 entries (24h at 5-min intervals)

    def analyze(self, state: "TransformerState", sim_time: float) -> "DGAAnalysisResult":
        """Run full DGA analysis suite. Called on every DGA sensor update (every 300 sim-seconds)."""
        # Store history
        values = {
            "DGA_H2": state.dga_h2, "DGA_CH4": state.dga_ch4,
            "DGA_C2H6": state.dga_c2h6, "DGA_C2H4": state.dga_c2h4,
            "DGA_C2H2": state.dga_c2h2, "DGA_CO": state.dga_co,
            "DGA_CO2": state.dga_co2,
        }
        self.dga_history.append({"sim_time": sim_time, "values": values})
        if len(self.dga_history) > 288:
            self.dga_history.pop(0)

        # 1. Duval Triangle
        duval = classify_duval(state.dga_ch4, state.dga_c2h4, state.dga_c2h2)

        # 2. TDCG
        tdcg_value, tdcg_status = compute_tdcg(state)

        # 3. CO2/CO ratio
        ratio, interpretation = compute_co2_co_ratio(state.dga_co2, state.dga_co)

        # 4. Gas rates
        gas_rates = compute_gas_rates(values, self.dga_history)

        return DGAAnalysisResult(
            duval=duval,
            tdcg_value=tdcg_value,
            tdcg_status=tdcg_status,
            co2_co_ratio=ratio,
            co2_co_interpretation=interpretation,
            gas_rates=gas_rates,
        )
```

---

## 8. Failure Mode Engine (FMEA)

### 8.1 Failure Mode Definitions and Scoring

```python
# analytics/fmea_engine.py

from dataclasses import dataclass

@dataclass
class FMEACondition:
    description: str
    weight: float
    evaluator: str  # Function name to call for evaluation

@dataclass
class FailureMode:
    id: str
    name: str
    severity: int
    affected_components: list[str]
    development_time: str
    recommended_actions: list[str]
    conditions: list[FMEACondition]

# All 8 failure modes from PRD Section "Failure Modes — FMEA Format"
FAILURE_MODES = [
    FailureMode(
        id="FM-001", name="Winding Hot Spot", severity=8,
        affected_components=["windings", "oil"],
        development_time="Days to weeks",
        recommended_actions=["Reduce load to 70%", "Check cooling system", "Schedule internal inspection"],
        conditions=[
            FMEACondition("Winding temp > expected by >15%", 0.30, "check_winding_deviation"),
            FMEACondition("CH₄ above Caution (75 ppm)", 0.30, "check_ch4_caution"),
            FMEACondition("C₂H₄ above Caution (50 ppm)", 0.20, "check_c2h4_caution"),
            FMEACondition("H₂ above Caution (100 ppm)", 0.10, "check_h2_caution"),
            FMEACondition("Duval zone is T1/T2/T3", 0.10, "check_duval_thermal"),
        ],
    ),
    FailureMode(
        id="FM-002", name="Partial Discharge", severity=6,
        affected_components=["insulation"],
        development_time="Weeks to months",
        recommended_actions=["Monitor trend", "Plan inspection at next outage"],
        conditions=[
            FMEACondition("H₂ dominant and rising", 0.50, "check_h2_dominant"),
            FMEACondition("Other gases low", 0.30, "check_other_gases_low"),
            FMEACondition("Duval zone is PD", 0.20, "check_duval_pd"),
        ],
    ),
    FailureMode(
        id="FM-003", name="Arcing (Internal)", severity=10,
        affected_components=["windings", "connections", "insulation"],
        development_time="Hours (can be sudden)",
        recommended_actions=["IMMEDIATE: Reduce load", "Emergency inspection", "Consider de-energization"],
        conditions=[
            FMEACondition("C₂H₂ > 2 ppm", 0.40, "check_c2h2_elevated"),
            FMEACondition("H₂ spike", 0.25, "check_h2_spike"),
            FMEACondition("Duval zone is D1/D2", 0.20, "check_duval_discharge"),
            FMEACondition("Rapid gas generation rate", 0.15, "check_rapid_generation"),
        ],
    ),
    FailureMode(
        id="FM-004", name="Cellulose Degradation", severity=7,
        affected_components=["paper insulation"],
        development_time="Months to years",
        recommended_actions=["Assess remaining insulation life", "Plan transformer replacement"],
        conditions=[
            FMEACondition("CO above Caution (350 ppm)", 0.35, "check_co_elevated"),
            FMEACondition("CO₂ above Caution (2500 ppm)", 0.25, "check_co2_elevated"),
            FMEACondition("CO₂/CO ratio < 3", 0.25, "check_co2_co_ratio_low"),
            FMEACondition("CO trending upward", 0.15, "check_co_trending"),
        ],
    ),
    FailureMode(
        id="FM-005", name="Oil Degradation", severity=5,
        affected_components=["oil"],
        development_time="Months to years",
        recommended_actions=["Oil filtering/degassing", "Check conservator seals"],
        conditions=[
            FMEACondition("Moisture > 20 ppm", 0.40, "check_moisture_high"),
            FMEACondition("Dielectric strength < 40 kV", 0.40, "check_dielectric_low"),
            FMEACondition("General slight gas increase", 0.20, "check_general_gas_increase"),
        ],
    ),
    FailureMode(
        id="FM-006", name="Cooling System Failure", severity=7,
        affected_components=["cooling system", "oil", "windings"],
        development_time="Immediate; thermal impact over hours",
        recommended_actions=["Repair/replace cooling equipment", "Reduce load until restored"],
        conditions=[
            FMEACondition("Fan/pump OFF when should be ON", 0.40, "check_cooling_equipment_fault"),
            FMEACondition("Top oil temp rising faster than expected", 0.35, "check_top_oil_anomaly"),
            FMEACondition("Temperature gradient change", 0.25, "check_gradient_anomaly"),
        ],
    ),
    FailureMode(
        id="FM-007", name="Tap Changer Wear", severity=6,
        affected_components=["OLTC"],
        development_time="Years (gradual)",
        recommended_actions=["Inspect contacts", "Measure contact resistance", "Refurbish/replace"],
        conditions=[
            FMEACondition("Tap operation count > 50,000", 0.50, "check_tap_count_high"),
            FMEACondition("Slight C₂H₂ present", 0.30, "check_slight_c2h2"),
            FMEACondition("Tap op count increasing rapidly", 0.20, "check_tap_rate"),
        ],
    ),
    FailureMode(
        id="FM-008", name="Bushing Degradation", severity=9,
        affected_components=["HV bushings", "LV bushings"],
        development_time="Months; failure can be sudden",
        recommended_actions=["Replace bushing if >5% drift", "Immediate replacement if >10%"],
        conditions=[
            FMEACondition("HV bushing cap drift > 3%", 0.40, "check_bushing_hv_drift"),
            FMEACondition("LV bushing cap drift > 3%", 0.40, "check_bushing_lv_drift"),
            FMEACondition("Drift rate increasing", 0.20, "check_bushing_drift_rate"),
        ],
    ),
]


class FMEAEngine:
    """
    Evaluates all failure modes against current state.
    Returns scored, ranked results for modes exceeding threshold.

    PRD F5: Score > 0.3 = display, > 0.4 = "Possible", > 0.7 = "Probable"
    """
    DISPLAY_THRESHOLD = 0.3
    POSSIBLE_THRESHOLD = 0.4
    PROBABLE_THRESHOLD = 0.7

    def __init__(self, bushing_baseline_hv: float = 500.0, bushing_baseline_lv: float = 420.0):
        self.bushing_baseline_hv = bushing_baseline_hv
        self.bushing_baseline_lv = bushing_baseline_lv

    def evaluate(
        self,
        state: "TransformerState",
        anomalies: list["AnomalyResult"],
        dga_result: "DGAAnalysisResult | None",
    ) -> list[dict]:
        """
        Score all failure modes and return those above display threshold.
        """
        results = []
        for fm in FAILURE_MODES:
            score, evidence = self._score_failure_mode(fm, state, anomalies, dga_result)
            if score >= self.DISPLAY_THRESHOLD:
                if score >= self.PROBABLE_THRESHOLD:
                    label = "Probable"
                elif score >= self.POSSIBLE_THRESHOLD:
                    label = "Possible"
                else:
                    label = "Monitoring"
                results.append({
                    "id": fm.id,
                    "name": fm.name,
                    "match_score": round(score, 2),
                    "confidence_label": label,
                    "severity": fm.severity,
                    "affected_components": fm.affected_components,
                    "evidence": evidence,
                    "recommended_actions": fm.recommended_actions,
                    "development_time": fm.development_time,
                })

        # Sort by score descending
        results.sort(key=lambda x: x["match_score"], reverse=True)
        return results

    def _score_failure_mode(self, fm, state, anomalies, dga_result):
        """
        Evaluate each condition in the failure mode and compute weighted score.

        Each condition evaluator returns (score: float 0–1, evidence_text: str).
        """
        total_score = 0.0
        evidence = []
        for cond in fm.conditions:
            cond_score, cond_evidence = self._eval_condition(
                cond.evaluator, state, anomalies, dga_result
            )
            total_score += cond_score * cond.weight
            evidence.append({
                "condition": cond.description,
                "matched": cond_score > 0.5,
                "value": cond_evidence,
            })
        return total_score, evidence

    def _eval_condition(self, evaluator_name, state, anomalies, dga_result):
        """Dispatch to specific condition evaluator."""
        evaluators = {
            "check_winding_deviation": self._check_winding_deviation,
            "check_ch4_caution": lambda s, a, d: self._check_gas_threshold(s.dga_ch4, 75, "CH₄"),
            "check_c2h4_caution": lambda s, a, d: self._check_gas_threshold(s.dga_c2h4, 50, "C₂H₄"),
            "check_h2_caution": lambda s, a, d: self._check_gas_threshold(s.dga_h2, 100, "H₂"),
            "check_c2h2_elevated": lambda s, a, d: self._check_gas_threshold(s.dga_c2h2, 2, "C₂H₂"),
            "check_h2_spike": self._check_h2_spike,
            "check_duval_thermal": lambda s, a, d: self._check_duval_zone(d, ["T1", "T2", "T3"]),
            "check_duval_pd": lambda s, a, d: self._check_duval_zone(d, ["PD"]),
            "check_duval_discharge": lambda s, a, d: self._check_duval_zone(d, ["D1", "D2"]),
            "check_h2_dominant": self._check_h2_dominant,
            "check_other_gases_low": self._check_other_gases_low,
            "check_co_elevated": lambda s, a, d: self._check_gas_threshold(s.dga_co, 350, "CO"),
            "check_co2_elevated": lambda s, a, d: self._check_gas_threshold(s.dga_co2, 2500, "CO₂"),
            "check_co2_co_ratio_low": self._check_co2_co_ratio_low,
            "check_co_trending": self._check_co_trending,
            "check_moisture_high": lambda s, a, d: self._check_threshold(s.oil_moisture, 20, "Moisture"),
            "check_dielectric_low": self._check_dielectric_low,
            "check_general_gas_increase": self._check_general_gas_increase,
            "check_cooling_equipment_fault": self._check_cooling_fault,
            "check_top_oil_anomaly": self._check_top_oil_anomaly,
            "check_gradient_anomaly": self._check_gradient_anomaly,
            "check_tap_count_high": lambda s, a, d: (min(s.tap_op_count / 50000, 1.0), f"{s.tap_op_count} operations"),
            "check_slight_c2h2": lambda s, a, d: (min(s.dga_c2h2 / 2.0, 1.0), f"{s.dga_c2h2:.1f} ppm"),
            "check_tap_rate": lambda s, a, d: (0.0, "N/A for POC"),
            "check_bushing_hv_drift": self._check_bushing_drift_hv,
            "check_bushing_lv_drift": self._check_bushing_drift_lv,
            "check_bushing_drift_rate": lambda s, a, d: (0.0, "N/A for POC"),
            "check_rapid_generation": self._check_rapid_generation,
        }
        fn = evaluators.get(evaluator_name, lambda s, a, d: (0.0, "Unknown"))
        return fn(state, anomalies, dga_result)

    # --- Individual evaluators ---

    def _check_winding_deviation(self, state, anomalies, dga_result):
        for a in anomalies:
            if a.sensor_id == "WINDING_TEMP":
                # PRD FM-001: match_score = (deviation% - 5) / 25, clamped [0, 1]
                score = max(0.0, min((a.deviation_percent - 5) / 25.0, 1.0))
                return score, f"{a.actual:.1f}°C vs {a.expected:.1f}°C expected ({a.deviation_percent:.1f}% deviation)"
        return 0.0, "No winding anomaly"

    def _check_gas_threshold(self, value, threshold, name):
        """Generic gas threshold check. Score = min(value/threshold, 1.0)."""
        score = min(value / threshold, 1.0) if threshold > 0 else 0.0
        return score, f"{value:.1f} ppm (threshold: {threshold})"

    def _check_threshold(self, value, threshold, name):
        score = min(value / threshold, 1.0) if threshold > 0 else 0.0
        return score, f"{value:.1f} (threshold: {threshold})"

    def _check_duval_zone(self, dga_result, target_zones):
        if dga_result is None:
            return 0.0, "No DGA data"
        if dga_result.duval.zone in target_zones:
            return 1.0, f"Zone {dga_result.duval.zone}"
        return 0.0, f"Zone {dga_result.duval.zone} (not in {target_zones})"

    def _check_h2_spike(self, state, anomalies, dga_result):
        for a in anomalies:
            if a.sensor_id == "DGA_H2" and a.severity in ("WARNING", "CRITICAL"):
                return 1.0, f"H₂ at {state.dga_h2:.1f} ppm ({a.severity})"
        score = min(state.dga_h2 / 200, 1.0)
        return score, f"H₂ at {state.dga_h2:.1f} ppm"

    def _check_h2_dominant(self, state, anomalies, dga_result):
        total = state.dga_h2 + state.dga_ch4 + state.dga_c2h4 + state.dga_c2h2
        if total < 10:
            return 0.0, "Gas levels too low"
        h2_fraction = state.dga_h2 / total
        return min(h2_fraction * 2, 1.0), f"H₂ = {h2_fraction*100:.0f}% of key gases"

    def _check_other_gases_low(self, state, anomalies, dga_result):
        others = state.dga_ch4 + state.dga_c2h4 + state.dga_c2h2
        if others < 30:
            return 1.0, f"Non-H₂ gases total: {others:.0f} ppm (low)"
        return max(0, 1.0 - others / 100), f"Non-H₂ gases total: {others:.0f} ppm"

    def _check_co2_co_ratio_low(self, state, anomalies, dga_result):
        if state.dga_co < 1:
            return 0.0, "CO too low for ratio"
        ratio = state.dga_co2 / state.dga_co
        if ratio < 3:
            return 1.0, f"Ratio = {ratio:.1f} (< 3 = serious)"
        elif ratio < 10:
            return 0.5, f"Ratio = {ratio:.1f} (3–10 = possible)"
        return 0.0, f"Ratio = {ratio:.1f} (> 10 = normal)"

    def _check_co_trending(self, state, anomalies, dga_result):
        if dga_result and dga_result.gas_rates.get("DGA_CO", {}).get("trend") == "RISING":
            return 1.0, "CO trending upward"
        return 0.0, "CO stable"

    def _check_dielectric_low(self, state, anomalies, dga_result):
        if state.oil_dielectric < 30:
            return 1.0, f"{state.oil_dielectric:.1f} kV (< 30 = critical)"
        elif state.oil_dielectric < 40:
            return 0.7, f"{state.oil_dielectric:.1f} kV (< 40 = warning)"
        return 0.0, f"{state.oil_dielectric:.1f} kV (normal)"

    def _check_general_gas_increase(self, state, anomalies, dga_result):
        if dga_result is None:
            return 0.0, "No DGA data"
        rising = sum(1 for r in dga_result.gas_rates.values() if r.get("trend") == "RISING")
        return min(rising / 3, 1.0), f"{rising} gases trending upward"

    def _check_cooling_fault(self, state, anomalies, dga_result):
        # Fan should be ON when top_oil > 65; pump when load > 70 or top_oil > 80
        faults = []
        if not state.fan_bank_1 and state.top_oil_temp > 65:
            faults.append("Fan 1 OFF but top oil > 65°C")
        if not state.fan_bank_2 and state.top_oil_temp > 75:
            faults.append("Fan 2 OFF but top oil > 75°C")
        if not state.oil_pump_1 and (state.load_current > 70 or state.top_oil_temp > 80):
            faults.append("Pump OFF but conditions require it")
        score = min(len(faults) / 2, 1.0)
        return score, "; ".join(faults) if faults else "Cooling equipment normal"

    def _check_top_oil_anomaly(self, state, anomalies, dga_result):
        for a in anomalies:
            if a.sensor_id == "TOP_OIL_TEMP" and a.severity in ("WARNING", "CRITICAL"):
                return 1.0, f"Top oil {a.deviation_percent:.1f}% above expected"
        return 0.0, "Top oil normal"

    def _check_gradient_anomaly(self, state, anomalies, dga_result):
        gradient = state.top_oil_temp - state.bot_oil_temp
        if gradient < 10:
            return 1.0, f"Gradient collapsed: {gradient:.1f}°C (< 10 = circulation impaired)"
        elif gradient > 30:
            return 0.8, f"Gradient high: {gradient:.1f}°C (> 30 = possible blockage)"
        return 0.0, f"Gradient normal: {gradient:.1f}°C"

    def _check_bushing_drift_hv(self, state, anomalies, dga_result):
        drift_pct = abs(state.bushing_cap_hv - self.bushing_baseline_hv) / self.bushing_baseline_hv * 100
        if drift_pct > 5:
            return 1.0, f"HV drift {drift_pct:.1f}% (> 5% = critical)"
        elif drift_pct > 3:
            return 0.7, f"HV drift {drift_pct:.1f}% (> 3% = warning)"
        return 0.0, f"HV drift {drift_pct:.1f}% (normal)"

    def _check_bushing_drift_lv(self, state, anomalies, dga_result):
        drift_pct = abs(state.bushing_cap_lv - self.bushing_baseline_lv) / self.bushing_baseline_lv * 100
        if drift_pct > 5:
            return 1.0, f"LV drift {drift_pct:.1f}% (> 5% = critical)"
        elif drift_pct > 3:
            return 0.7, f"LV drift {drift_pct:.1f}% (> 3% = warning)"
        return 0.0, f"LV drift {drift_pct:.1f}% (normal)"

    def _check_rapid_generation(self, state, anomalies, dga_result):
        if dga_result is None:
            return 0.0, "No DGA data"
        max_rate = max(r.get("rate_ppm_per_day", 0) for r in dga_result.gas_rates.values())
        if max_rate > 10:
            return 1.0, f"Max rate {max_rate:.1f} ppm/day (rapid)"
        elif max_rate > 3:
            return 0.5, f"Max rate {max_rate:.1f} ppm/day (moderate)"
        return 0.0, f"Max rate {max_rate:.1f} ppm/day (slow)"
```

---

## 9. Health Score Calculator

```python
# analytics/health_score.py

from config import DGA_THRESHOLDS

# Component weights from PRD F6
COMPONENT_WEIGHTS = {
    "dga":          0.30,
    "winding_temp": 0.25,
    "oil_temp":     0.15,
    "cooling":      0.10,
    "oil_quality":  0.10,
    "bushing":      0.10,
}

# Penalty points from PRD F6
PENALTY = {
    "NORMAL":   0,
    "CAUTION": 20,
    "WARNING": 50,
    "CRITICAL": 90,
}


class HealthScoreCalculator:
    def __init__(self):
        self._previous_score: float = 100.0
        self._smoothing_alpha: float = 0.3
        # Smoothing factor: new_score = alpha * raw + (1-alpha) * previous
        # 0.3 means ~70% weight on previous score → avoids jitter from noise
        # A real change (sustained deviation) propagates within 3-4 update cycles.

    def compute(
        self,
        state: "TransformerState",
        anomalies: list["AnomalyResult"],
        dga_result: "DGAAnalysisResult | None",
    ) -> "HealthScoreResult":
        """
        Compute weighted composite health score.
        PRD formula: Health = 100 - Σ(penalty × weight)
        """
        components = {}

        # 1. DGA status: worst of all 7 gases
        dga_status = self._compute_dga_status(state)
        components["dga"] = dga_status

        # 2. Winding temp status: threshold + anomaly elevation
        winding_status = self._compute_winding_status(state, anomalies)
        components["winding_temp"] = winding_status

        # 3. Oil temp status
        oil_status = self._compute_oil_status(state)
        components["oil_temp"] = oil_status

        # 4. Cooling status
        cooling_status = self._compute_cooling_status(state)
        components["cooling"] = cooling_status

        # 5. Oil quality status
        oil_quality_status = self._compute_oil_quality_status(state)
        components["oil_quality"] = oil_quality_status

        # 6. Bushing status
        bushing_status = self._compute_bushing_status(state)
        components["bushing"] = bushing_status

        # Calculate raw score
        total_penalty = sum(
            PENALTY[components[comp]] * COMPONENT_WEIGHTS[comp]
            for comp in COMPONENT_WEIGHTS
        )
        raw_score = max(0.0, min(100.0, 100.0 - total_penalty))

        # Apply smoothing to avoid jitter
        smoothed = self._smoothing_alpha * raw_score + (1 - self._smoothing_alpha) * self._previous_score
        changed = abs(smoothed - self._previous_score) > 0.5
        self._previous_score = smoothed

        return HealthScoreResult(
            overall_score=round(smoothed, 1),
            components={k: {"status": v, "penalty": PENALTY[v], "weight": COMPONENT_WEIGHTS[k],
                           "contribution": round(PENALTY[v] * COMPONENT_WEIGHTS[k], 1)}
                       for k, v in components.items()},
            changed=changed,
        )

    def _compute_dga_status(self, state) -> str:
        """Worst status among all DGA gases."""
        worst = "NORMAL"
        gas_values = {
            "DGA_H2": state.dga_h2, "DGA_CH4": state.dga_ch4,
            "DGA_C2H6": state.dga_c2h6, "DGA_C2H4": state.dga_c2h4,
            "DGA_C2H2": state.dga_c2h2, "DGA_CO": state.dga_co,
            "DGA_CO2": state.dga_co2,
        }
        severity_order = ["NORMAL", "CAUTION", "WARNING", "CRITICAL"]
        for gas_id, value in gas_values.items():
            t = DGA_THRESHOLDS[gas_id]
            if value > t["critical"]:
                status = "CRITICAL"
            elif value > t["warning"]:
                status = "WARNING"
            elif value > t["caution"]:
                status = "CAUTION"
            else:
                status = "NORMAL"
            if severity_order.index(status) > severity_order.index(worst):
                worst = status
        return worst

    def _compute_winding_status(self, state, anomalies) -> str:
        """PRD F6: WINDING_TEMP thresholds + anomaly elevation."""
        # Absolute thresholds
        if state.winding_temp > 110:
            base = "CRITICAL"
        elif state.winding_temp > 95:
            base = "CAUTION"
        else:
            base = "NORMAL"

        # Elevate by one level if anomaly detection flags WARNING or CRITICAL
        anomaly_severity = "NORMAL"
        for a in anomalies:
            if a.sensor_id == "WINDING_TEMP":
                anomaly_severity = a.severity
                break

        severity_order = ["NORMAL", "CAUTION", "WARNING", "CRITICAL"]
        base_idx = severity_order.index(base)
        if anomaly_severity in ("WARNING", "CRITICAL") and base_idx < 3:
            return severity_order[base_idx + 1]
        return base

    def _compute_oil_status(self, state) -> str:
        if state.top_oil_temp > 85:
            return "CRITICAL"
        elif state.top_oil_temp > 75:
            return "CAUTION"
        return "NORMAL"

    def _compute_cooling_status(self, state) -> str:
        faults = 0
        if not state.fan_bank_1 and state.top_oil_temp > 65:
            faults += 1
        if not state.fan_bank_2 and state.top_oil_temp > 75:
            faults += 1
        if not state.oil_pump_1 and (state.load_current > 70 or state.top_oil_temp > 80):
            faults += 1
        if faults >= 2:
            return "CRITICAL"
        elif faults == 1:
            return "WARNING"
        return "NORMAL"

    def _compute_oil_quality_status(self, state) -> str:
        """Worst of moisture and dielectric."""
        statuses = []
        # Moisture
        if state.oil_moisture > 35:
            statuses.append("CRITICAL")
        elif state.oil_moisture > 20:
            statuses.append("WARNING")
        else:
            statuses.append("NORMAL")
        # Dielectric
        if state.oil_dielectric < 30:
            statuses.append("CRITICAL")
        elif state.oil_dielectric < 40:
            statuses.append("WARNING")
        else:
            statuses.append("NORMAL")
        severity_order = ["NORMAL", "CAUTION", "WARNING", "CRITICAL"]
        return max(statuses, key=lambda s: severity_order.index(s))

    def _compute_bushing_status(self, state, baseline_hv=500.0, baseline_lv=420.0) -> str:
        drift_hv = abs(state.bushing_cap_hv - baseline_hv) / baseline_hv * 100
        drift_lv = abs(state.bushing_cap_lv - baseline_lv) / baseline_lv * 100
        max_drift = max(drift_hv, drift_lv)
        if max_drift > 5:
            return "CRITICAL"
        elif max_drift > 3:
            return "WARNING"
        return "NORMAL"
```

---

## 10. What-If Simulation Engine

```python
# api/routes_simulation.py (simulation logic)

import math

def run_whatif_simulation(
    load_percent: float,
    ambient_temp_c: float,
    cooling_mode: str,
    time_horizon_days: int,
    current_gas_rates: dict[str, float],  # ppm/day from DGA analyzer
    current_gas_levels: dict[str, float],
) -> dict:
    """
    PRD F7: Compute projected transformer behavior under adjusted parameters.
    """
    from simulator.thermal_model import COOLING_FACTORS, WINDING_BASE_RISE, OIL_BASE_RISE, OIL_EXPONENT

    load_frac = load_percent / 100.0
    cf = COOLING_FACTORS.get(cooling_mode, 1.0)

    # 1. Projected hot spot temperature
    # PRD: hotspot = ambient + 55 × (load_fraction)² × cooling_factor
    projected_hotspot = ambient_temp_c + WINDING_BASE_RISE * (load_frac ** 2) * cf

    # 2. Projected top oil temperature
    # PRD: top_oil = ambient + 40 × (load_fraction)^0.8 × cooling_factor
    projected_top_oil = ambient_temp_c + OIL_BASE_RISE * (load_frac ** OIL_EXPONENT) * cf

    # 3. Insulation aging acceleration factor
    # PRD Arrhenius: aging_factor = 2^((hotspot - 98) / 6.5)
    # At 98°C: 1.0x. At 111°C: 4.0x. At 120°C: ~10x.
    # Reference temperature = 98°C (IEEE standard reference for normal aging)
    # Halving interval = 6.5°C (empirical constant from Arrhenius for cellulose)
    aging_factor = 2.0 ** ((projected_hotspot - 98.0) / 6.5)
    aging_factor = max(0.01, aging_factor)  # Floor at 0.01 for very low temps

    if aging_factor > 10:
        interpretation = f"Aging {aging_factor:.1f}x faster — emergency, severe life reduction"
    elif aging_factor > 4:
        interpretation = f"Aging {aging_factor:.1f}x faster — significant life reduction"
    elif aging_factor > 2:
        interpretation = f"Aging {aging_factor:.1f}x faster — elevated, reduce load if possible"
    elif aging_factor > 1.1:
        interpretation = f"Aging {aging_factor:.1f}x — slightly above normal"
    else:
        interpretation = f"Aging {aging_factor:.1f}x — normal or better than normal"

    # 4. Estimated days to warning
    # PRD: "linear extrapolation from current gas generation rates"
    from config import DGA_THRESHOLDS
    days_to_warning = float('inf')
    for gas_id, rate in current_gas_rates.items():
        if rate <= 0:
            continue
        current = current_gas_levels.get(gas_id, 0)
        warning_threshold = DGA_THRESHOLDS.get(gas_id, {}).get("warning", float('inf'))
        if current < warning_threshold:
            days = (warning_threshold - current) / rate
            days_to_warning = min(days_to_warning, days)
    days_to_warning = None if days_to_warning == float('inf') else round(days_to_warning, 1)

    # 5. Cooling energy impact
    # PRD: ONAN = 0 (baseline), ONAF = 100% (fans), OFAF = 250% (fans + pumps)
    energy_map = {"ONAN": 0, "ONAF": 100, "OFAF": 250}
    projected_energy = energy_map.get(cooling_mode, 0)
    # Compare to current (assume ONAF as typical current)
    current_energy = 100  # placeholder; in production, read from engine state
    energy_delta = projected_energy - current_energy

    # 6. Timeline projection (daily data points with day/night ambient variation)
    timeline = []
    for day in range(1, time_horizon_days + 1):
        # Day: ambient + 5°C, Night: ambient - 5°C. Average = ambient.
        day_hotspot = (ambient_temp_c + 5) + WINDING_BASE_RISE * (load_frac ** 2) * cf
        night_hotspot = (ambient_temp_c - 5) + WINDING_BASE_RISE * (load_frac ** 2) * cf
        avg_hotspot = (day_hotspot + night_hotspot) / 2
        day_top_oil = (ambient_temp_c + 5) + OIL_BASE_RISE * (load_frac ** OIL_EXPONENT) * cf
        avg_aging = 2.0 ** ((avg_hotspot - 98) / 6.5)
        timeline.append({
            "day": day,
            "hotspot_temp_c": round(avg_hotspot, 1),
            "top_oil_temp_c": round(day_top_oil, 1),
            "aging_factor": round(avg_aging, 2),
        })

    return {
        "projected_hotspot_temp_c": round(projected_hotspot, 1),
        "projected_top_oil_temp_c": round(projected_top_oil, 1),
        "aging_acceleration_factor": round(aging_factor, 2),
        "aging_interpretation": interpretation,
        "estimated_days_to_warning": days_to_warning,
        "cooling_energy_impact_percent": energy_delta,
        "cooling_energy_interpretation": f"{abs(energy_delta)}% {'more' if energy_delta > 0 else 'less'} cooling energy than current mode",
        "projection_timeline": timeline,
    }
```

---

## 11. Database Design

### 11.1 Schema (CREATE TABLE Statements)

```python
# database/migrations.py

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS transformer_config (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    manufacturer TEXT,
    rating_mva REAL NOT NULL,
    voltage_hv_kv REAL,
    voltage_lv_kv REAL,
    cooling_type TEXT,
    year_manufactured INTEGER,
    oil_volume_liters REAL,
    location TEXT
);

CREATE TABLE IF NOT EXISTS sensor_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    sensor_id TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT NOT NULL,
    quality TEXT DEFAULT 'GOOD',
    sim_time REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_readings_time ON sensor_readings(timestamp);
CREATE INDEX IF NOT EXISTS idx_readings_sensor_time ON sensor_readings(sensor_id, timestamp);

CREATE TABLE IF NOT EXISTS anomaly_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    sensor_id TEXT NOT NULL,
    actual_value REAL NOT NULL,
    expected_value REAL NOT NULL,
    deviation_percent REAL NOT NULL,
    severity TEXT NOT NULL,
    sim_time REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_anomaly_time ON anomaly_events(timestamp);

CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    severity TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    source TEXT NOT NULL,
    sensor_ids TEXT,
    failure_mode_id TEXT,
    recommended_actions TEXT,
    acknowledged INTEGER DEFAULT 0,
    acknowledged_at TEXT,
    sim_time REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alerts_time ON alerts(timestamp);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(acknowledged);

CREATE TABLE IF NOT EXISTS health_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    overall_score REAL NOT NULL,
    dga_status TEXT NOT NULL,
    winding_temp_status TEXT NOT NULL,
    oil_temp_status TEXT NOT NULL,
    cooling_status TEXT NOT NULL,
    oil_quality_status TEXT NOT NULL,
    bushing_status TEXT NOT NULL,
    component_details TEXT,
    sim_time REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_health_time ON health_scores(timestamp);

-- Seed transformer config
INSERT OR IGNORE INTO transformer_config (id, name, manufacturer, rating_mva, voltage_hv_kv, voltage_lv_kv, cooling_type, year_manufactured, oil_volume_liters, location)
VALUES ('TRF-001', 'Main Power Transformer Unit 1', 'GE Vernova', 100.0, 230.0, 69.0, 'ONAN/ONAF/OFAF', 2005, 45000.0, 'Substation Alpha, Bay 3');
"""
```

### 11.2 Database Helper

```python
# database/db.py

import aiosqlite
from pathlib import Path

DB_PATH = Path("transformertwin.db")

class Database:
    def __init__(self):
        self._conn: aiosqlite.Connection | None = None

    async def initialize(self):
        self._conn = await aiosqlite.connect(DB_PATH)
        await self._conn.executescript(SCHEMA_SQL)
        await self._conn.commit()

    async def close(self):
        if self._conn:
            await self._conn.close()

    async def insert_sensor_batch(self, batch: "SensorBatch"):
        """Insert all sensors from a batch. Batched for performance."""
        rows = [
            (batch.timestamp, sid, val, batch.units.get(sid, ""), batch.sim_time)
            for sid, val in batch.sensors.items()
        ]
        await self._conn.executemany(
            "INSERT INTO sensor_readings (timestamp, sensor_id, value, unit, sim_time) VALUES (?, ?, ?, ?, ?)",
            rows,
        )
        await self._conn.commit()

    async def get_sensor_history(self, sensor_id, from_dt, to_dt, limit):
        cursor = await self._conn.execute(
            """SELECT timestamp, value, sim_time FROM sensor_readings
               WHERE sensor_id = ? AND timestamp >= ? AND timestamp <= ?
               ORDER BY timestamp DESC LIMIT ?""",
            (sensor_id, from_dt.isoformat(), to_dt.isoformat(), limit),
        )
        rows = await cursor.fetchall()
        return [{"timestamp": r[0], "value": r[1], "sim_time": r[2]} for r in reversed(rows)]

    async def insert_alert(self, alert: dict):
        import json
        await self._conn.execute(
            """INSERT INTO alerts (timestamp, severity, title, description, source, sensor_ids, failure_mode_id, recommended_actions, sim_time)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (alert["timestamp"], alert["severity"], alert["title"], alert["description"],
             alert["source"], json.dumps(alert.get("sensor_ids", [])),
             alert.get("failure_mode_id"), json.dumps(alert.get("recommended_actions", [])),
             alert["sim_time"]),
        )
        await self._conn.commit()

    async def acknowledge_alert(self, alert_id: int):
        from datetime import datetime
        await self._conn.execute(
            "UPDATE alerts SET acknowledged = 1, acknowledged_at = ? WHERE id = ?",
            (datetime.utcnow().isoformat() + "Z", alert_id),
        )
        await self._conn.commit()

    async def insert_health_score(self, result: "HealthScoreResult"):
        import json
        await self._conn.execute(
            """INSERT INTO health_scores (timestamp, overall_score, dga_status, winding_temp_status, oil_temp_status, cooling_status, oil_quality_status, bushing_status, component_details, sim_time)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (result.timestamp, result.overall_score,
             result.components["dga"]["status"],
             result.components["winding_temp"]["status"],
             result.components["oil_temp"]["status"],
             result.components["cooling"]["status"],
             result.components["oil_quality"]["status"],
             result.components["bushing"]["status"],
             json.dumps(result.components),
             result.sim_time),
        )
        await self._conn.commit()

    async def cleanup_old_data(self, max_rows: int = 500000):
        """Auto-purge oldest sensor readings when exceeding limit. PRD NFR: 500,000 rows max."""
        cursor = await self._conn.execute("SELECT COUNT(*) FROM sensor_readings")
        count = (await cursor.fetchone())[0]
        if count > max_rows:
            delete_count = count - max_rows
            await self._conn.execute(
                f"DELETE FROM sensor_readings WHERE id IN (SELECT id FROM sensor_readings ORDER BY id ASC LIMIT {delete_count})"
            )
            await self._conn.commit()
```

### 11.3 Indexing Strategy

- `sensor_readings(sensor_id, timestamp)`: Primary query pattern is "get readings for sensor X between time A and time B." Composite index supports this efficiently.
- `sensor_readings(timestamp)`: For "get all sensor readings at time T" (historical playback).
- `alerts(acknowledged)`: For filtering active vs. acknowledged alerts.
- `health_scores(timestamp)`: For health score trend queries.

### 11.4 Data Retention

Run `cleanup_old_data()` after every 1000th sensor write (roughly every ~80 minutes at 1× speed). This keeps the database under the 500,000 row limit (~24 hours of data at normal rates) per PRD NFR.

---

## 12. Implementation Order

| Step | Module | What to Build | Testable Output | Est. Time |
|------|--------|--------------|-----------------|-----------|
| 1 | `config.py` + `models/schemas.py` | All constants, thresholds, Pydantic models | Import without errors; models validate test data | 1 hour |
| 2 | `database/` | SQLite schema, db.py, queries.py | Run migration; insert and query a test reading | 1 hour |
| 3 | `simulator/load_profile.py` + `noise.py` | Load curve + ambient generators | Plot 24-hour load and ambient curves; verify shapes | 1 hour |
| 4 | `simulator/thermal_model.py` | All thermal functions | Unit test: at 100% load, 30°C ambient, ONAN → winding ≈ 85°C, top oil ≈ 70°C | 1.5 hours |
| 5 | `simulator/dga_model.py` + `equipment_model.py` | Gas generation + equipment logic | Unit test: gas rates near zero at 80°C; fans ON when oil > 65°C | 1 hour |
| 6 | `simulator/engine.py` | SimulatorEngine main loop (no scenarios) | Run engine for 60 sim-seconds; verify sensor values are correlated and realistic | 2 hours |
| 7 | `scenarios/` | All 4 scenario classes + manager | Trigger hot_spot, verify winding offset ramps over 2 hours | 2 hours |
| 8 | `analytics/anomaly_detector.py` | Anomaly detection engine | Feed normal data → no anomalies. Feed hot_spot data → WARNING at minute 60 | 2 hours |
| 9 | `analytics/dga_analyzer.py` | Duval Triangle + TDCG + rates | Unit test: known gas inputs → correct Duval zones. TDCG computation matches PRD examples | 2 hours |
| 10 | `analytics/fmea_engine.py` | All 8 failure modes + scoring | Hot spot scenario → FM-001 > 0.4 by hour 1. Arcing → FM-003 > 0.7 by minute 10 | 2 hours |
| 11 | `analytics/health_score.py` | Health score calculator | DGA Warning → score = 85. DGA Critical + Cooling Warning → score = 68 | 1 hour |
| 12 | `api/websocket_handler.py` | WebSocket endpoint + connection manager | Connect with `wscat`; receive `connection_ack` and `sensor_update` messages | 2 hours |
| 13 | `api/routes_*.py` | All REST endpoints | `curl` each endpoint; verify response matches PRD schemas | 2 hours |
| 14 | `api/routes_simulation.py` | What-if simulation | POST with 100% load → verify hotspot ≈ 85°C, aging factor ≈ 1.0 at 98°C | 1 hour |
| 15 | `main.py` | Full application wiring + CORS + lifespan | Start server; connect frontend; see data flowing end-to-end | 1.5 hours |
| 16 | Integration testing | End-to-end scenario run | Trigger hot_spot; verify alerts, health score, Duval classification all respond correctly | 2 hours |

**Total estimated: ~23 hours** (fits in a focused weekend with some buffer).

---

## 13. Testing Strategy

### 13.1 Unit Tests (per module)

**Thermal Model:**
```python
def test_winding_temp_quadratic():
    """Doubling load should ~4x the temperature rise."""
    rise_50 = compute_winding_temp_target(25, 0.5, 1.0) - 25  # Rise at 50%
    rise_100 = compute_winding_temp_target(25, 1.0, 1.0) - 25  # Rise at 100%
    assert abs(rise_100 / rise_50 - 4.0) < 0.1  # Should be ~4x

def test_cooling_factor_reduces_temp():
    temp_onan = compute_top_oil_target(25, 0.8, 1.0)
    temp_ofaf = compute_top_oil_target(25, 0.8, 0.5)
    assert temp_ofaf < temp_onan  # OFAF should be cooler

def test_thermal_lag():
    """Top oil should approach target exponentially, not instantly."""
    current = 60.0
    target = 80.0
    after_1tau = compute_top_oil_temp(current, target, 1800)  # 1 time constant
    # After 1τ, should be at ~63.2% of the way
    expected = current + 0.632 * (target - current)
    assert abs(after_1tau - expected) < 1.0
```

**DGA / Duval Triangle:**
```python
def test_duval_pure_ch4():
    """100% CH4 should be T1 or PD zone."""
    result = classify_duval(100, 0, 0)
    assert result.zone in ("PD", "T1")

def test_duval_high_c2h2():
    """High C2H2 should be D1 or D2."""
    result = classify_duval(5, 5, 90)
    assert result.zone in ("D1", "D2")

def test_duval_zero_sum():
    result = classify_duval(0, 0, 0)
    assert result.zone == "NONE"

def test_tdcg_normal():
    # H2=45, CH4=22, C2H6=15, C2H4=8, C2H2=0.5, CO=200 → sum = 290.5
    assert compute_tdcg_value(45, 22, 15, 8, 0.5, 200) < 720  # NORMAL
```

**Health Score:**
```python
def test_health_all_normal():
    """All normal → score should be 100."""
    # (In practice, simulator adds noise so score is 92-96, but raw formula = 100)
    score = compute_raw_health({"dga": "NORMAL", "winding_temp": "NORMAL", "oil_temp": "NORMAL",
                                 "cooling": "NORMAL", "oil_quality": "NORMAL", "bushing": "NORMAL"})
    assert score == 100.0

def test_health_dga_warning():
    """DGA Warning → score = 100 - 50*0.30 = 85."""
    score = compute_raw_health({"dga": "WARNING", "winding_temp": "NORMAL", "oil_temp": "NORMAL",
                                 "cooling": "NORMAL", "oil_quality": "NORMAL", "bushing": "NORMAL"})
    assert score == 85.0

def test_health_dga_critical_cooling_warning():
    """DGA Critical + Cooling Warning → 100 - (90*0.30 + 50*0.10) = 68."""
    score = compute_raw_health({"dga": "CRITICAL", "winding_temp": "NORMAL", "oil_temp": "NORMAL",
                                 "cooling": "WARNING", "oil_quality": "NORMAL", "bushing": "NORMAL"})
    assert score == 68.0
```

**Anomaly Detection:**
```python
def test_no_anomaly_during_learning():
    """No anomalies in first 10 minutes."""
    detector = AnomalyDetector()
    # Feed 9 minutes of data
    anomalies = detector.evaluate(normal_batch, normal_state, sim_time=500)
    assert len(anomalies) == 0

def test_anomaly_after_learning():
    """15% deviation after learning → WARNING."""
    detector = AnomalyDetector()
    # Complete learning period
    detector.baseline_ready = True
    detector.baseline_start_time = 0
    # Feed batch with 20% winding deviation
    anomalies = detector.evaluate(hot_batch, hot_state, sim_time=700)
    winding_anomalies = [a for a in anomalies if a.sensor_id == "WINDING_TEMP"]
    assert len(winding_anomalies) == 1
    assert winding_anomalies[0].severity == "WARNING"
```

### 13.2 Integration Tests

**Scenario End-to-End:**
```python
async def test_hot_spot_scenario_e2e():
    """Full hot spot scenario produces expected system responses over 2 sim hours."""
    engine = SimulatorEngine(speed_multiplier=60)  # 60x → 2 hours in 2 minutes
    engine.scenario_manager.trigger("hot_spot", 0)
    
    alerts_generated = []
    health_scores = []
    
    async for batch in engine.run():
        anomalies = anomaly_detector.evaluate(batch, engine.state, engine.sim_time)
        # ... run full pipeline ...
        
        if engine.sim_time > 7200:  # 2 hours done
            break
    
    # Verify: FM-001 detected as "Probable" (score > 0.7)
    # Verify: Health score dropped below 70
    # Verify: At least one WARNING or CRITICAL alert
    # Verify: Duval zone reached T2
```

### 13.3 Verifying Realistic Sensor Correlations

Run the "Normal Operation" scenario for 24 simulated hours and check:

1. Load follows expected weekday pattern (peak ~85% at 2 PM, trough ~35% at 3 AM).
2. Winding temperature correlates with load² — plot both and verify visual correlation.
3. Top oil temperature lags winding by ~30 minutes — cross-correlation peak at ~1800s offset.
4. Top-bottom oil gradient stays within 15–25°C.
5. No false anomalies, warnings, or critical alerts over 24 hours.
6. Health score stays between 90 and 96.
7. All DGA gases remain within Normal thresholds.

---

*End of Document*