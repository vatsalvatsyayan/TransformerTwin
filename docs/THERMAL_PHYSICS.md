# TransformerTwin — Thermal Physics Specification

> **Status:** Implementation-Ready
> **Standard:** IEC 60076-7:2018 (Oil-immersed power transformers — Loading guide)
> **Applies to:** `simulator/thermal_model.py`, `simulator/equipment_model.py`, `config.py`

This document is the authoritative source for all thermal model formulas and constants. `simulator/thermal_model.py` must implement exactly these equations. Every constant referenced here must be added to `config.py` before writing any formula code.

---

## 1. Model Overview

The thermal model is a two-stage exponential lag system:

```
LOAD + AMBIENT
      │
      ▼
[Top Oil Steady-State Target] ──(τ_oil lag)──► TOP_OIL_TEMP
      │
      ▼
[Winding Hot Spot Steady-State] ──(τ_winding lag)──► WINDING_TEMP
      │
      ▼
[Bottom Oil] ──(derived from top oil)──► BOT_OIL_TEMP
```

The **exponential lag** models the thermal mass of the transformer — temperature does not jump instantly to its new steady-state when load changes; it approaches it with a time constant τ.

---

## 2. Constants (add all to `config.py`)

```python
# ---------------------------------------------------------------------------
# Thermal model constants — IEC 60076-7 Section 7
# ---------------------------------------------------------------------------

# Top oil temperature rise above ambient at rated load (100%), ONAN cooling.
# IEC 60076-7 Table 2: reference value for large power transformers.
THERMAL_TOP_OIL_RISE_RATED_C: float = 55.0

# Winding-to-top-oil temperature gradient at rated load.
# IEC 60076-7 Table 2: gradient for large power transformers.
THERMAL_WINDING_GRADIENT_C: float = 22.0

# Hot spot factor H — accounts for non-uniform current distribution.
# IEC 60076-7 Table 2: H = 1.3 for large power transformers (≥ 100 MVA).
THERMAL_HOT_SPOT_FACTOR_H: float = 1.3

# Oil thermal exponent n — empirical curve-fitting constant.
# IEC 60076-7 Table 3: n = 0.8 for ONAN.
THERMAL_OIL_EXPONENT_N: float = 0.8

# Winding thermal exponent m — empirical constant for winding rise.
# IEC 60076-7 Table 3: m = 0.8 for ONAN.
THERMAL_WINDING_EXPONENT_M: float = 0.8

# Thermal time constant for top oil (seconds).
# IEC 60076-7 Table 2: τ_TO = 180 min for large power transformers in ONAN.
# Physically: how long it takes top oil to reach 63% of a step-change target.
THERMAL_TAU_OIL_S: float = 10800.0  # 180 minutes

# Thermal time constant for winding (seconds).
# IEC 60076-7 Table 2: τ_w = 10 min for large power transformers.
THERMAL_TAU_WINDING_S: float = 600.0  # 10 minutes

# Bottom oil is approximated as midpoint between ambient and top oil.
# This is a simplification of the IEC 60076-7 bottom-oil model.
# Factor: BOT_OIL_TEMP = ambient + (TOP_OIL_TEMP - ambient) * BOTTOM_OIL_FRACTION
THERMAL_BOTTOM_OIL_FRACTION: float = 0.5

# Cooling mode parameters: (top_oil_rise_factor, tau_oil_factor)
# rise_factor: scales THERMAL_TOP_OIL_RISE_RATED_C (e.g., fans reduce steady-state rise)
# tau_factor:  scales THERMAL_TAU_OIL_S (fans also speed up thermal response)
# Calibrated so ONAN=55°C rise, ONAF≈40°C rise, OFAF≈30°C rise.
COOLING_PARAMS: dict[str, dict[str, float]] = {
    "ONAN": {"rise_factor": 1.000, "tau_factor": 1.000},  # Natural oil, natural air
    "ONAF": {"rise_factor": 0.727, "tau_factor": 0.667},  # Natural oil, forced air (fans)
    "OFAF": {"rise_factor": 0.545, "tau_factor": 0.500},  # Forced oil, forced air (pump + fans)
}

# Arrhenius aging constant for insulation (used in what-if simulation, Phase 2.5).
# Based on IEC 60076-7 Annex A: relative aging rate doubles every 6°C above 98°C reference.
# k = ln(2) / 6 ≈ 0.1155
AGING_REFERENCE_TEMP_C: float = 98.0  # IEC 60076-7 reference hot spot temperature
AGING_ARRHENIUS_K: float = 0.1155     # ln(2)/6 — aging doubles every 6°C
```

---

## 3. Formulas

### 3.1 Steady-State Top Oil Temperature Rise

```python
def compute_steady_top_oil_rise(load_fraction: float, cooling_mode: str) -> float:
    """
    Steady-state top oil temperature rise above ambient for a given load and cooling mode.

    Formula: IEC 60076-7 Equation (1)
        ΔΘ_TO_steady = ΔΘ_TO_rated × rise_factor × K^(2n)

    Args:
        load_fraction: Per-unit load (e.g., 0.75 = 75%). Range 0.0–1.2.
        cooling_mode: One of "ONAN", "ONAF", "OFAF".

    Returns:
        Temperature rise in °C above ambient (not the absolute temperature).
    """
    rise_factor = COOLING_PARAMS[cooling_mode]["rise_factor"]
    return THERMAL_TOP_OIL_RISE_RATED_C * rise_factor * (load_fraction ** (2 * THERMAL_OIL_EXPONENT_N))
```

### 3.2 Dynamic Top Oil Temperature (Exponential Lag)

```python
def update_top_oil_temp(
    prev_top_oil: float,
    ambient_temp: float,
    load_fraction: float,
    cooling_mode: str,
    dt_s: float,
) -> float:
    """
    Top oil temperature after one time step, using first-order exponential lag.

    Formula: IEC 60076-7 Equation (3)
        θ_TO(t) = θ_TO_steady + (θ_TO_prev - θ_TO_steady) × exp(-dt / τ_TO)

    Where:
        θ_TO_steady = ambient + ΔΘ_TO_steady
        τ_TO        = THERMAL_TAU_OIL_S × tau_factor(cooling_mode)
    """
    tau = THERMAL_TAU_OIL_S * COOLING_PARAMS[cooling_mode]["tau_factor"]
    steady = ambient_temp + compute_steady_top_oil_rise(load_fraction, cooling_mode)
    return steady + (prev_top_oil - steady) * math.exp(-dt_s / tau)
```

### 3.3 Steady-State Winding Hot Spot Rise Above Top Oil

```python
def compute_steady_winding_rise(load_fraction: float) -> float:
    """
    Steady-state winding hot spot rise above top oil temperature.

    Formula: IEC 60076-7 Equation (2)
        ΔΘ_winding_steady = H × ΔΘ_winding_rated × K^(2m)

    The winding exponent m is the same as n for ONAN (both 0.8).
    Cooling mode affects top oil, not the winding-to-top-oil gradient directly.
    """
    return (
        THERMAL_HOT_SPOT_FACTOR_H
        * THERMAL_WINDING_GRADIENT_C
        * (load_fraction ** (2 * THERMAL_WINDING_EXPONENT_M))
    )
```

### 3.4 Dynamic Winding Temperature (Exponential Lag)

```python
def update_winding_temp(
    prev_winding: float,
    top_oil_temp: float,
    load_fraction: float,
    dt_s: float,
) -> float:
    """
    Winding hot spot temperature after one time step.

    Formula: IEC 60076-7 Equation (4)
        θ_winding(t) = θ_winding_steady + (θ_winding_prev - θ_winding_steady) × exp(-dt / τ_w)

    Where:
        θ_winding_steady = θ_TOP_OIL + ΔΘ_winding_steady
        τ_w              = THERMAL_TAU_WINDING_S
    """
    steady = top_oil_temp + compute_steady_winding_rise(load_fraction)
    return steady + (prev_winding - steady) * math.exp(-dt_s / THERMAL_TAU_WINDING_S)
```

### 3.5 Bottom Oil Temperature

```python
def compute_bot_oil_temp(ambient_temp: float, top_oil_temp: float) -> float:
    """
    Bottom oil temperature — simplified linear interpolation between ambient and top oil.

    This is a simplification of IEC 60076-7 Section 6.4.
    Bottom oil ≈ midpoint between ambient and top oil.
    """
    return ambient_temp + (top_oil_temp - ambient_temp) * THERMAL_BOTTOM_OIL_FRACTION
```

---

## 4. Initial Conditions

The simulator starts at steady state for the initial load (e.g., 50% load, 25°C ambient, ONAN):

```python
# At startup (before first tick), initialize to steady state:
load_0 = get_load_fraction(sim_time_s=0)     # from load_profile.py
ambient_0 = get_ambient_temp(sim_time_s=0)   # from load_profile.py

top_oil_rise_0 = compute_steady_top_oil_rise(load_0, "ONAN")
top_oil_0      = ambient_0 + top_oil_rise_0
winding_rise_0 = compute_steady_winding_rise(load_0)
winding_0      = top_oil_0 + winding_rise_0
bot_oil_0      = compute_bot_oil_temp(ambient_0, top_oil_0)
```

This prevents an unrealistic cold-start spike on the first tick.

---

## 5. Scenario Modifiers

Fault scenarios apply additive offsets to the **thermal model's internal state** (not the steady-state target). These are defined in the scenario files and passed into `ThermalModel.tick()` as `winding_temp_override_delta: float = 0.0`.

| Scenario | Stage | Modifier |
|----------|-------|----------|
| `hot_spot` | Stage 1 (0–30 min) | `winding_delta = +15°C` (hot spot forming) |
| `hot_spot` | Stage 2 (30–90 min) | `winding_delta = +40°C` (hot spot developing) |
| `hot_spot` | Stage 3 (90–120 min) | `winding_delta = +80°C` (hot spot critical) |
| `arcing` | All stages | `winding_delta = +5°C` (minor thermal contribution from arc) |
| `cooling_failure` | All stages | Forces cooling mode = `"ONAN"` regardless of fan state |
| `normal` | — | `winding_delta = 0°C` (no override) |

The modifier is a **direct addition** applied after the physics model computes the lag:
```python
winding_temp = update_winding_temp(...) + scenario_winding_delta
```

---

## 6. Expected Values at Steady State (Validation Reference)

Use these to sanity-check your implementation:

| Condition | ambient | load | cooling | TOP_OIL | BOT_OIL | WINDING |
|-----------|---------|------|---------|---------|---------|---------|
| Normal, light load | 25°C | 50% | ONAN | ~54°C | ~40°C | ~72°C |
| Normal, peak load | 35°C | 85% | ONAF | ~72°C | ~54°C | ~97°C |
| Normal, full load | 25°C | 100% | OFAF | ~55°C | ~40°C | ~82°C |
| Hot spot Stage 3 | 32°C | 80% | ONAN | ~84°C | ~58°C | ~181°C |

If your thermal model produces values far from these, check:
1. Load fraction is in per-unit (0.0–1.0), not percent
2. The exponential lag formula uses `exp(-dt/tau)`, not `1 - exp(-dt/tau)`
3. `dt_s` is `tick_interval × speed_multiplier` (sim-seconds per tick), not wall-clock

---

## 7. `ThermalModel` Class Interface

```python
@dataclass
class ThermalState:
    top_oil_temp: float    # °C
    bot_oil_temp: float    # °C
    winding_temp: float    # °C
    cooling_mode: str      # "ONAN" | "ONAF" | "OFAF"

class ThermalModel:
    def __init__(self) -> None:
        """Initialize to cold-start (will reach steady state quickly due to τ_winding=10min)."""

    def tick(
        self,
        dt_s: float,
        load_fraction: float,
        ambient_temp: float,
        cooling_mode: str,
        winding_delta: float = 0.0,
    ) -> ThermalState:
        """
        Advance thermal state by dt_s simulation seconds.

        Args:
            dt_s: Simulation seconds elapsed (= tick_interval × speed_multiplier).
            load_fraction: Per-unit load, 0.0–1.2.
            ambient_temp: Ambient temperature in °C.
            cooling_mode: "ONAN", "ONAF", or "OFAF".
            winding_delta: Scenario override addition to winding temp in °C.

        Returns:
            Updated ThermalState.
        """
```
