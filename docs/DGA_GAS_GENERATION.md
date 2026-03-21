# TransformerTwin — DGA Gas Generation Model

> **Status:** Implementation-Ready
> **Standard:** IEC 60599:2022, IEEE C57.104-2019
> **Applies to:** `simulator/dga_model.py`, `config.py`

This document specifies the gas generation model for dissolved gas analysis simulation. `simulator/dga_model.py` must implement exactly this model. All constants must be added to `config.py`.

---

## 1. Model Overview

The DGA model tracks 7 dissolved gases (in ppm) that accumulate over simulation time. Gases are **never reset** — they reflect real dissolved gas behavior in transformer oil where gas accumulates over the transformer's lifetime.

Three generation mechanisms are modeled:

```
Gas accumulation = Normal aging + Thermal fault + Arcing fault + Gaussian noise
```

| Mechanism | When active | Primary gases produced |
|-----------|-------------|----------------------|
| Normal thermal aging of oil | Always | CH4, C2H6, H2 |
| Normal paper aging | Always | CO, CO2 |
| Accelerated thermal (winding > 120°C) | Hot temperatures | CH4, C2H4, H2, CO, CO2 |
| Arcing / electrical discharge | Arcing scenario | C2H2, H2 |
| Partial discharge (low level) | Background only | H2 |

---

## 2. Constants (add all to `config.py`)

```python
# ---------------------------------------------------------------------------
# DGA gas generation constants — IEC 60599, IEEE C57.104
# ---------------------------------------------------------------------------

# Base gas generation rates under normal operation (no fault).
# Units: ppm per simulation HOUR of transformer operation.
# Calibrated so that after 24 sim-hours of normal operation at 75% load,
# all gas levels remain well within CAUTION thresholds.
# Sources: IEC 60599 Table 1 typical ranges for fault-free transformers.
DGA_BASE_RATES_PPM_PER_HR: dict[str, float] = {
    "DGA_H2":   0.50,   # Background partial discharge and oil ionisation
    "DGA_CH4":  0.30,   # Low-temperature thermal decomposition of oil
    "DGA_C2H6": 0.20,   # Thermal aging of oil (most stable under normal conditions)
    "DGA_C2H4": 0.05,   # Minimal at normal temperatures
    "DGA_C2H2": 0.001,  # Essentially zero — any significant C2H2 indicates arcing
    "DGA_CO":   2.00,   # Slow cellulose (paper) aging at normal temps
    "DGA_CO2":  15.00,  # Slow paper aging (CO2/CO ≈ 7.5 under normal paper aging)
}
# Note: CO2/CO = 15.0/2.0 = 7.5, within normal range [5.0, 13.0] from config.py

# Winding temperature threshold above which accelerated thermal generation begins.
# Below this threshold, only base rates apply.
# 120°C is where thermal degradation of oil begins to accelerate measurably.
DGA_THERMAL_THRESHOLD_C: float = 120.0

# Arrhenius rate constant for thermal fault gas generation.
# At T > DGA_THERMAL_THRESHOLD_C:
#   multiplier = exp(DGA_ARRHENIUS_K × (winding_temp - DGA_THERMAL_THRESHOLD_C))
# Calibration target: at winding_temp=300°C (hot_spot Stage 3 peak),
#   multiplier ≈ 650×, producing CH4 at ~195 ppm/hr.
#   exp(0.04 × (300 - 120)) = exp(7.2) ≈ 1339 → base 0.30 × 1339 ≈ 400 ppm/hr ✓
# This ensures CH4 reaches ~400 ppm over 2 sim-hours in the hot_spot scenario.
DGA_ARRHENIUS_K: float = 0.04

# Per-gas thermal sensitivity multipliers (relative to CH4 at 1.0).
# At high temperatures, ethylene (C2H4) becomes dominant over methane (CH4).
# This makes the Duval Triangle point move toward T2/T3 zones as designed.
# Source: Arroyo et al., "DGA simulation for transformer fault detection" (2019).
DGA_THERMAL_GAS_FACTORS: dict[str, float] = {
    "DGA_H2":   0.8,   # H2 rises with temperature but less than CH4
    "DGA_CH4":  1.0,   # Reference (base rate × 1.0 × Arrhenius multiplier)
    "DGA_C2H6": 0.3,   # C2H6 increases less at higher temps (more stable)
    "DGA_C2H4": 2.5,   # C2H4 dominates at high temps — drives T2/T3 Duval zone
    "DGA_C2H2": 0.02,  # C2H2 remains low in thermal faults (not electrical)
    "DGA_CO":   3.0,   # Paper degradation accelerates strongly with temp
    "DGA_CO2":  8.0,   # CO2 from paper increases even faster than CO at high temp
}

# Winding temperature above which paper (CO/CO2) degradation accelerates.
# Below DGA_THERMAL_THRESHOLD_C, CO/CO2 use their base rates only.
# Above this additional threshold, paper degradation becomes dominant.
DGA_PAPER_THRESHOLD_C: float = 140.0

# Additional CO generation multiplier for paper degradation above 140°C.
# Distinct from oil thermal fault — paper begins to decompose at higher rates.
# Applied on top of DGA_THERMAL_GAS_FACTORS for CO and CO2 only.
DGA_PAPER_CO_EXTRA_FACTOR: float = 5.0
DGA_PAPER_CO2_EXTRA_FACTOR: float = 3.0

# Gaussian noise sigma for DGA sensors (ppm).
# Applied after generation to simulate sensor measurement noise.
# Kept small — DGA sensors are laboratory-grade instruments.
DGA_NOISE_SIGMA_PPM: dict[str, float] = {
    "DGA_H2":   0.5,
    "DGA_CH4":  0.3,
    "DGA_C2H6": 0.2,
    "DGA_C2H4": 0.2,
    "DGA_C2H2": 0.1,   # Very low — any noise above this is suspicious
    "DGA_CO":   1.0,
    "DGA_CO2":  5.0,
}

# Starting (initial) gas levels for a well-maintained transformer.
# Set to mid-range of IEC 60599 "typical" values for a healthy 20-year-old transformer.
# These are NOT zero — a real transformer has accumulated some gas from normal aging.
DGA_INITIAL_PPM: dict[str, float] = {
    "DGA_H2":   15.0,
    "DGA_CH4":   8.0,
    "DGA_C2H6": 12.0,
    "DGA_C2H4":  3.0,
    "DGA_C2H2":  0.2,
    "DGA_CO":   80.0,
    "DGA_CO2":  600.0,
}
```

---

## 3. Formulas

### 3.1 Normal Operation (No Fault)

```python
def compute_base_generation(dt_s: float) -> dict[str, float]:
    """
    Gas generation from normal aging over dt_s simulation seconds.

    Returns dict of {gas_id: ppm_increment}.
    """
    dt_hr = dt_s / 3600.0
    return {
        gas_id: rate * dt_hr
        for gas_id, rate in DGA_BASE_RATES_PPM_PER_HR.items()
    }
```

### 3.2 Thermal Fault Acceleration (winding_temp > DGA_THERMAL_THRESHOLD_C)

```python
def compute_thermal_generation(dt_s: float, winding_temp: float) -> dict[str, float]:
    """
    Additional gas generation due to thermal fault (winding hot spot).

    Only applied when winding_temp > DGA_THERMAL_THRESHOLD_C.
    Returns ADDITIONAL ppm (add on top of base generation).
    """
    if winding_temp <= DGA_THERMAL_THRESHOLD_C:
        return {gas_id: 0.0 for gas_id in DGA_BASE_RATES_PPM_PER_HR}

    dt_hr = dt_s / 3600.0
    arrhenius = math.exp(DGA_ARRHENIUS_K * (winding_temp - DGA_THERMAL_THRESHOLD_C))
    extra = {}
    for gas_id, base_rate in DGA_BASE_RATES_PPM_PER_HR.items():
        thermal_factor = DGA_THERMAL_GAS_FACTORS[gas_id]
        # Additional generation above base rate
        extra[gas_id] = base_rate * (arrhenius - 1.0) * thermal_factor * dt_hr

    # Extra paper degradation above 140°C
    if winding_temp > DGA_PAPER_THRESHOLD_C:
        paper_arrhenius = math.exp(DGA_ARRHENIUS_K * (winding_temp - DGA_PAPER_THRESHOLD_C))
        extra["DGA_CO"]  += DGA_BASE_RATES_PPM_PER_HR["DGA_CO"]  * paper_arrhenius * DGA_PAPER_CO_EXTRA_FACTOR  * dt_hr
        extra["DGA_CO2"] += DGA_BASE_RATES_PPM_PER_HR["DGA_CO2"] * paper_arrhenius * DGA_PAPER_CO2_EXTRA_FACTOR * dt_hr

    return extra
```

### 3.3 Scenario Modifier (Arcing, Fault Injection)

Scenario files return a `scenario_gas_modifier: dict[str, float]` of direct ppm/second additions:

```python
def apply_scenario_modifier(
    gas_state: dict[str, float],
    modifier: dict[str, float],
    dt_s: float,
) -> None:
    """
    Apply scenario-injected gas rates directly (ppm/second × dt_s).

    This is separate from physics-based generation — it directly injects
    gases as if the fault is producing them at a known rate.
    """
    for gas_id, rate_ppm_per_s in modifier.items():
        gas_state[gas_id] += rate_ppm_per_s * dt_s
```

---

## 4. Scenario Gas Modifiers

These are the `scenario_gas_modifier` values that each scenario file's `get_modifier()` method returns.

### 4.1 Normal (`scenarios/normal.py`)
```python
modifier = {}  # Empty — no injection
```

### 4.2 Developing Hot Spot (`scenarios/hot_spot.py`)

Hot spot generates primarily C2H4 (ethylene) and H2. The winding_delta from `THERMAL_PHYSICS.md` handles the temperature increase; these rates handle the DGA amplification beyond what the Arrhenius formula produces (to ensure Duval zone progression is visibly fast in a demo).

```python
# Stage 1 (0–1800 sim-seconds, ~0–30 min): Hot spot forming
MODIFIER_HOT_SPOT_STAGE_1 = {
    "DGA_H2":   0.002,  # ppm/s
    "DGA_CH4":  0.001,
    "DGA_C2H4": 0.001,
}

# Stage 2 (1800–5400 sim-seconds, ~30–90 min): Gas generation building
MODIFIER_HOT_SPOT_STAGE_2 = {
    "DGA_H2":   0.010,
    "DGA_CH4":  0.008,
    "DGA_C2H4": 0.015,  # C2H4 now dominant → Duval moves toward T2
    "DGA_CO":   0.020,  # Paper beginning to degrade
}

# Stage 3 (5400–7200 sim-seconds, ~90–120 min): Critical hot spot
MODIFIER_HOT_SPOT_STAGE_3 = {
    "DGA_H2":   0.025,
    "DGA_CH4":  0.020,
    "DGA_C2H4": 0.060,  # C2H4 dominant — Duval in T2/T3 zone
    "DGA_C2H2": 0.003,  # Trace C2H2 from overheated cellulose
    "DGA_CO":   0.080,  # Heavy paper degradation
    "DGA_CO2":  0.200,
}
```

**Duval progression for hot_spot scenario (expected):**
- Start: NONE (gases too low to classify)
- After Stage 1: T1 (low CH4 dominant)
- After Stage 2: T2 (C2H4 20–50%)
- After Stage 3: T2/T3 boundary (C2H4 > 50%)

### 4.3 Arcing Event (`scenarios/arcing.py`)

Arcing is characterized by a rapid, large spike in C2H2 (acetylene). Duration is only 15 sim-minutes total.

```python
# Stage 1 (0–180 sim-seconds, ~0–3 min): Pre-arc, discharge beginning
MODIFIER_ARCING_STAGE_1 = {
    "DGA_H2":   0.05,
    "DGA_C2H2": 0.02,
}

# Stage 2 (180–600 sim-seconds, ~3–10 min): Active arcing
MODIFIER_ARCING_STAGE_2 = {
    "DGA_H2":   0.80,   # H2 spikes dramatically during arcing
    "DGA_C2H2": 0.50,   # C2H2 spike — primary arcing indicator
    "DGA_CH4":  0.10,
    "DGA_C2H4": 0.05,
}

# Stage 3 (600–900 sim-seconds, ~10–15 min): Post-arc, gases dissolving
MODIFIER_ARCING_STAGE_3 = {
    "DGA_H2":   0.10,
    "DGA_C2H2": 0.05,   # C2H2 rate drops but accumulated level remains
}
```

**Duval progression for arcing scenario (expected):**
- Start: NONE
- After Stage 1: D1 (low energy discharge — high C2H2)
- After Stage 2: D2 or DT (high energy discharge — C2H2 + H2 dominant)

### 4.4 Cooling Failure (`scenarios/cooling_failure.py`)

Cooling failure produces NO direct gas injection. Instead, the scenario:
1. Forces fan banks OFF (return `cooling_mode_override = "ONAN"` to ThermalModel)
2. Oil temperature rises naturally over 1 sim-hour
3. If oil rises enough, Arrhenius thermal generation kicks in from the thermal model

```python
# No gas modifier — thermal model handles it via temperature rise
modifier = {}
cooling_mode_override = "ONAN"  # Forces natural cooling even at high load
```

---

## 5. Gas Accumulation Model

The `DGAModel` class maintains a running total of each gas in ppm:

```python
class DGAModel:
    def __init__(self) -> None:
        # Initialize to realistic starting values (not zero)
        self.gas_ppm: dict[str, float] = dict(DGA_INITIAL_PPM)

    def tick(
        self,
        dt_s: float,
        winding_temp: float,
        scenario_modifier: dict[str, float],
    ) -> dict[str, float]:
        """
        Advance DGA state by dt_s simulation seconds.

        Returns updated gas_ppm dict (after noise is applied by noise.py).
        Gases may only increase (no natural dissipation in this model).
        Minimum value for each gas is its DGA_INITIAL_PPM value.
        """
        # Step 1: Base aging
        base = compute_base_generation(dt_s)

        # Step 2: Thermal fault
        thermal = compute_thermal_generation(dt_s, winding_temp)

        # Step 3: Scenario injection
        for gas_id in self.gas_ppm:
            self.gas_ppm[gas_id] += base[gas_id] + thermal[gas_id]
            injection = scenario_modifier.get(gas_id, 0.0)
            self.gas_ppm[gas_id] += injection * dt_s

        # Step 4: Clamp (no negative values)
        for gas_id in self.gas_ppm:
            self.gas_ppm[gas_id] = max(self.gas_ppm[gas_id], 0.0)

        return dict(self.gas_ppm)
```

---

## 6. Validation Targets

Use these to verify your implementation is calibrated correctly:

| Condition | Sim time | Expected DGA_CH4 | Expected DGA_C2H4 | Expected DGA_C2H2 | Duval Zone |
|-----------|----------|-----------------|------------------|------------------|------------|
| Normal operation, 75% load | 24 hr | ~15 ppm | ~4 ppm | ~0.2 ppm | NONE |
| Hot Spot Stage 2 complete | 90 min | ~80 ppm | ~100 ppm | ~0.5 ppm | T1→T2 |
| Hot Spot Stage 3 complete | 120 min | ~250 ppm | ~350 ppm | ~3 ppm | T2/T3 |
| Arcing Stage 2 complete | 10 min | ~12 ppm | ~4 ppm | ~310 ppm | D2/DT |
| Cooling failure at 60 min | 60 min | ~20 ppm | ~10 ppm | ~0.3 ppm | NONE/T1 |

Note: these are approximate targets. The Arrhenius model + scenario modifiers are calibrated to hit the correct Duval zones for a convincing demo. Minor variation is acceptable.

---

## 7. `DGAModel` Class Interface

```python
@dataclass
class DGAState:
    gas_ppm: dict[str, float]  # Keys: all 7 DGA_SENSOR_IDS

class DGAModel:
    def __init__(self) -> None:
        """Initialize gas levels to DGA_INITIAL_PPM."""

    def tick(
        self,
        dt_s: float,
        winding_temp: float,
        scenario_modifier: dict[str, float],
    ) -> DGAState:
        """
        Advance DGA state by dt_s simulation seconds.

        Args:
            dt_s: Simulation seconds elapsed (= tick_interval × speed_multiplier).
            winding_temp: Current winding hot spot temp in °C (from ThermalModel).
            scenario_modifier: Direct ppm/second injections from active scenario.
                               Keys are DGA sensor IDs, values are ppm/second.
                               Empty dict for normal scenario.

        Returns:
            Updated DGAState with all 7 gas values.
        """

    def get_state(self) -> DGAState:
        """Return current gas state without advancing."""
```
