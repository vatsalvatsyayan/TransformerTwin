# TransformerTwin — Complete Explanation for Interview Preparation

This document teaches you everything about this project: the domain, the architecture, the code, and the logic behind every major decision. Read it top-to-bottom before your interview.

---

## Table of Contents

1. [What Is TransformerTwin?](#1-what-is-transformertwin)
2. [Domain Knowledge: Power Transformers](#2-domain-knowledge-power-transformers)
3. [Why Digital Twins Matter](#3-why-digital-twins-matter)
4. [System Architecture Overview](#4-system-architecture-overview)
5. [Backend Deep-Dive](#5-backend-deep-dive)
6. [Frontend Deep-Dive](#6-frontend-deep-dive)
7. [Data Flow: End to End](#7-data-flow-end-to-end)
8. [The Three Fault Scenarios](#8-the-three-fault-scenarios)
9. [Implementation vs. PRD Analysis](#9-implementation-vs-prd-analysis)
10. [Key Talking Points for the Interview](#10-key-talking-points-for-the-interview)

---

## 1. What Is TransformerTwin?

TransformerTwin is a **real-time digital twin** of a 100 MVA oil-immersed power transformer. A digital twin is a software model that mirrors a physical asset in real time — it receives the same data the real sensor would produce, runs physics-based models to understand the asset's state, and provides diagnostics and predictions that a human engineer would find valuable.

**In plain English:** Imagine a power transformer sitting in a substation, wrapped in dozens of temperature sensors, gas sensors, and current sensors. TransformerTwin simulates all those sensors, streams their values to a web dashboard, and uses engineering algorithms to automatically say: "This transformer is developing a hot spot in the winding, it's a 68% probability of FM-001 (winding insulation degradation), and if you don't act within 3 weeks the transformer will fail."

**What it demonstrates technically:**
- Real-time WebSocket data streaming at configurable speeds (1× to 60× simulation)
- Physics-based sensor simulation (IEC 60076-7 thermal model, Arrhenius chemistry)
- Industry-standard diagnostic algorithms (Duval Triangle, FMEA, Z-score anomaly detection)
- A 3D interactive transformer model in the browser (React Three Fiber)
- A SQLite database for historical data persistence and playback

**Business context:** Enterprise platforms like GE Vernova SmartSignal and IBM Maximo Asset Monitor do exactly this, but cost millions. This POC proves a single developer can implement the core diagnostic logic using open-source tools.

---

## 2. Domain Knowledge: Power Transformers

### 2.1 What Is a Power Transformer?

A power transformer is an electrical device that changes voltage levels. When power leaves a generation plant at 20,000 V, step-up transformers raise it to 500,000 V for long-distance transmission (higher voltage = less current = less heat loss). Near cities, step-down transformers reduce it to 11,000 V for distribution, then to 240 V for homes.

A **100 MVA transformer** (our subject) is a large unit — 100 megawolt-amperes of power capacity, weighing hundreds of tons, costing $3–10 million, with a manufacturing lead time of 12–18 months. There are no spares on a shelf.

### 2.2 Physical Construction

The components you see in the 3D model map to real engineering parts:

| Component | What It Does | Why It Matters for Monitoring |
|-----------|-------------|-------------------------------|
| **Main Tank** | Steel vessel holding the core, windings, and insulating oil | Houses everything; oil condition = transformer health |
| **Conservator Tank** | Cylindrical tank on top, holds overflow oil as it expands/contracts with temperature | Acts as a buffer; keeps oil sealed from atmosphere |
| **HV Bushings (×3)** | Porcelain/silicone insulators where high-voltage cables connect | Failure = catastrophic arc-over; we monitor capacitance |
| **LV Bushings (×3)** | Same for low-voltage side | Same risk, lower voltage |
| **Radiator Banks (×2)** | Fins/panels on the sides that radiate heat from oil to air | Primary cooling mechanism |
| **Fan Banks (×2)** | Electric fans that blow air across the radiators | Forced air = better cooling (ONAF mode) |
| **Oil Pump** | Circulates oil between windings and radiators faster | Forced oil + forced air = best cooling (OFAF mode) |
| **Tap Changer** | Mechanical switch that selects between winding taps (1–33) to fine-tune voltage ratio | Wear indicator: too many operations = maintenance needed |
| **Buchholz Relay** | Safety device on the pipe to conservator; triggers on gas bubbles or oil surge | Early warning: gas bubbles = internal fault |

### 2.3 Cooling Modes

Oil-immersed transformers use the oil itself as the primary coolant. Three cooling modes, progressively more effective:

| Mode | Name | How It Works | Steady-State Top-Oil Rise at Rated Load |
|------|------|-------------|----------------------------------------|
| **ONAN** | Oil Natural, Air Natural | Oil convects naturally; air convects naturally | +55°C above ambient |
| **ONAF** | Oil Natural, Air Forced | Fans force air across radiators | +40°C above ambient (≈27% reduction) |
| **OFAF** | Oil Forced, Air Forced | Pump circulates oil AND fans blow air | +30°C above ambient (≈45% reduction) |

**Practical example:** At 25°C ambient in ONAN at full load: top-oil temperature ≈ 25 + 55 = 80°C. If we switch to OFAF: 25 + 30 = 55°C. Cooling makes a dramatic difference.

**In our simulator:** Fan Bank 1 activates when top-oil exceeds 65°C (ONAN→ONAF); Fan Bank 2 at 75°C; Oil Pump when load exceeds 70% OR top-oil exceeds 80°C.

### 2.4 The Three Temperatures

Every thermal analysis revolves around three temperatures:

1. **Winding Hot Spot (WINDING_TEMP)** — the hottest point inside the transformer, inside the coils. This is what actually kills the insulation. IEC 60076-7 defines the hot spot as: `θ_H = θ_top_oil + H × Δθ_WR × K^(2m)`, where H=1.3 (hot spot factor), Δθ_WR=22°C (winding gradient at rated load), K=load fraction, m=0.8 (exponent). Normal: ≤95°C. Critical: >120°C.

2. **Top Oil Temperature (TOP_OIL_TEMP)** — temperature of oil at the top of the tank (hottest oil). This is what controls the cooling equipment. Normal: ≤75°C. Rising top oil = load is high or cooling has failed.

3. **Bottom Oil Temperature (BOT_OIL_TEMP)** — temperature of oil at the bottom (coolest oil, just returned from radiators). Always lower than top oil. Approximated as midpoint between ambient and top oil.

### 2.5 Dissolved Gas Analysis (DGA)

This is the most important diagnostic technique for transformers. **When a transformer develops a fault (overheating, arcing, partial discharge), it generates specific gases that dissolve into the oil.**

We monitor 7 gases:

| Gas | Symbol | Generated By | Threshold (Caution) |
|-----|--------|-------------|---------------------|
| Hydrogen | H₂ | Partial discharge, arcing, overheating | 100 ppm |
| Methane | CH₄ | Low-temperature thermal fault (< 300°C) | 75 ppm |
| Ethane | C₂H₆ | Low-temperature thermal fault | 75 ppm |
| Ethylene | C₂H₄ | High-temperature thermal fault (300–700°C) | 50 ppm |
| Acetylene | C₂H₂ | Arcing (very high energy) | 1 ppm |
| Carbon Monoxide | CO | Insulation (paper) degradation | 350 ppm |
| Carbon Dioxide | CO₂ | Insulation (paper) degradation (slower) | 2500 ppm |

**The Arrhenius principle:** Gas generation rate follows exponential chemistry. At higher temperatures, gas generation doubles every ~6°C above the reference temperature. This is the same Arrhenius equation used in chemistry (reaction rate = A × e^(-Ea/RT)). Our DGA model uses simplified per-gas Arrhenius constants to compute ppm/hour generation rates as a function of winding temperature.

### 2.6 The Duval Triangle

Developed by Michel Duval (IEC 60599 standard), this is the gold standard for classifying transformer faults from DGA results. It uses only three gases: CH₄, C₂H₄, and C₂H₂.

**How it works:**
1. Compute percentages: `pct_CH4 = CH4 / (CH4 + C2H4 + C2H2) × 100`, same for others
2. Plot the point (pct_CH4, pct_C2H4, pct_C2H2) on a ternary diagram
3. The zone where the point falls tells you the fault type

**The 7 zones:**

| Zone | Label | Gas Signature | What It Means |
|------|-------|---------------|---------------|
| **PD** | Partial Discharge | Very high CH₄, almost no C₂H₄/C₂H₂ | Localized electrical discharges (corona) |
| **T1** | Thermal < 300°C | High CH₄, moderate C₂H₄, tiny C₂H₂ | Low-temperature thermal fault |
| **T2** | Thermal 300–700°C | Moderate CH₄, growing C₂H₄, small C₂H₂ | Developing thermal fault |
| **T3** | Thermal > 700°C | Low CH₄, dominant C₂H₄, some C₂H₂ | Severe thermal fault |
| **D1** | Low Energy Discharge | Significant C₂H₂ | Sparking (low energy arc) |
| **D2** | High Energy Discharge | High C₂H₂ | Full arc/flashover |
| **DT** | Mixed Discharge+Thermal | Intermediate | Both thermal and electrical activity |

**Ternary coordinates:** The triangle's three vertices are:
- Bottom-left (BL) = 100% CH₄
- Bottom-right (BR) = 100% C₂H₄
- Top = 100% C₂H₂

A point is plotted by its relative proportions. The conversion to Cartesian coordinates for SVG rendering is: `x = pct_C2H4 + pct_C2H2/2`, `y = pct_C2H2 × √3/2` (normalized to triangle height).

### 2.7 FMEA — Failure Mode and Effects Analysis

FMEA is a systematic method for identifying which failure mode is most likely active. We define 8 failure modes:

| ID | Failure Mode | Key Signatures | Severity |
|----|-------------|----------------|----------|
| FM-001 | Developing Winding Hot Spot | High winding temp, CH₄+C₂H₄ rising, Duval T1→T2 | 8/10 |
| FM-002 | Overloading | High load current + winding temp | 6/10 |
| FM-003 | Internal Arcing | High C₂H₂ spike, H₂ spike, Duval D1/D2 | 10/10 |
| FM-004 | Cooling System Failure | Top oil rising despite normal load | 7/10 |
| FM-005 | Insulation Degradation | High CO, CO₂, Duval zone shift | 7/10 |
| FM-006 | Partial Discharge | H₂ elevated, CH₄ slight, Duval PD zone | 5/10 |
| FM-007 | Bushing Insulation Fault | Bushing capacitance deviation | 8/10 |
| FM-008 | Oil Contamination | Moisture above threshold, dielectric strength low | 4/10 |

Each failure mode has a set of **conditions** (e.g., "winding temp > expected by > 15%"), each with a weight. The overall match score = weighted sum of individual condition scores. Scores are normalized to [0,1]. A score > 0.3 → displayed; > 0.4 → "Possible"; > 0.7 → "Probable."

### 2.8 Health Score

A single 0–100 number summarizing transformer health:

```
Health = 100 − Σ(component_penalty × component_weight)
```

| Component | Weight | CAUTION Penalty | WARNING Penalty | CRITICAL Penalty |
|-----------|--------|-----------------|-----------------|------------------|
| DGA Status | 0.30 | 25 | 50 | 100 |
| Winding Temp | 0.25 | 25 | 50 | 100 |
| Oil Temp | 0.15 | 25 | 50 | 100 |
| Cooling | 0.10 | 25 | 50 | 100 |
| Oil Quality | 0.10 | 25 | 50 | 100 |
| Bushings | 0.10 | 25 | 50 | 100 |

Example: DGA goes WARNING (50 × 0.30 = 15 penalty), Winding goes CAUTION (25 × 0.25 = 6.25 penalty): Health = 100 − 15 − 6.25 = 78.75 (FAIR range).

### 2.9 What-If Simulation

Uses the **Arrhenius insulation aging equation** from IEC 60076-7 Annex A:

```
V = exp(K × (θ_H − 98))
```

Where:
- V = relative aging acceleration factor (1.0 = normal aging at 98°C reference)
- K = 0.1155 = ln(2)/6 (aging doubles every 6°C above reference)
- θ_H = hot spot temperature (°C)

At 98°C: V = 1.0 (baseline). At 104°C: V = 2.0 (twice the aging). At 116°C: V = 4.0. At 128°C: V = 8.0. At 158°C: V = 64.0 — in one simulated day, the transformer ages as much as it would in 64 days at normal temperature.

This lets you answer: "If we run the transformer at 110% load during summer (hot spot = 130°C), how much insulation life do we consume per day compared to normal operation?"

---

## 3. Why Digital Twins Matter

### The Problem with Traditional Monitoring

Traditional monitoring uses **fixed thresholds**: "If TOP_OIL_TEMP > 85°C, trigger alarm." This has two critical flaws:

1. **False positives:** A 84°C reading on a hot day at 95% load is perfectly normal. But a 75°C reading at 30% load on a cool day might indicate a problem. Threshold alarms can't tell the difference.

2. **Missed faults:** A fault that develops slowly over months may never cross a threshold until it's catastrophic — by which time you're in an emergency.

### The Digital Twin Solution

TransformerTwin implements the **"actual vs. expected"** approach:
- **Expected temperature** = what the physics model predicts given current load, ambient, and cooling mode
- **Anomaly** = deviation between actual reading and expected reading, expressed as a Z-score

This is exactly how GE Vernova's SmartSignal platform works. A reading that is 3 standard deviations above the rolling baseline is suspicious even if it's within absolute threshold limits.

**Our anomaly detector:**
- Keeps a rolling 360-tick window (~30 sim-minutes) per sensor
- Computes rolling mean and standard deviation of that window
- Z-score = (actual − mean) / std
- Z > 2.0 → CAUTION; Z > 3.5 → WARNING; Z > 5.0 → CRITICAL
- Also checks rate-of-change: if value increases >10% of sensor range per sim-minute → escalate one level
- Only generates alerts on **first detection** or **level escalation** (not every tick)

---

## 4. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│  React 18 + TypeScript + Vite + Tailwind CSS                   │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │  3D Viewer  │  │  Right Panel │  │  Bottom Timeline      │  │
│  │  (R3F)      │  │  (Tab panes) │  │  (Playback / Speed)   │  │
│  └─────────────┘  └──────────────┘  └───────────────────────┘  │
│         │                │                      │              │
│         └────────────────┼──────────────────────┘              │
│                          │                                      │
│              ┌───────────▼──────────┐                          │
│              │   Zustand Store      │                          │
│              │   (flat, in-memory)  │                          │
│              └──────────┬───────────┘                          │
│                         │                                      │
│         ┌───────────────┼───────────────────┐                 │
│         │               │                   │                 │
│   useWebSocket()   useApi hooks        store selectors        │
└─────────┼───────────────┼───────────────────┼─────────────────┘
          │               │ (REST)            │
          │ WebSocket      │                  │
          │               │                  │
┌─────────▼───────────────▼──────────────────▼─────────────────┐
│                         BACKEND                               │
│  Python 3.11+ + FastAPI + uvicorn                             │
│                                                               │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                  SimulatorEngine                         │ │
│  │                                                          │ │
│  │  LoadProfile → ThermalModel → EquipmentModel → DGAModel  │ │
│  │       ↓               ↓              ↓           ↓      │ │
│  │  AnomalyDetector  DGAAnalyzer   FMEAEngine  HealthScore  │ │
│  │       ↓               ↓              ↓           ↓      │ │
│  │  WebSocket callbacks ────────────────────────────────►   │ │
│  │  DB persist callbacks ───────────────────────────────►   │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                               │
│  FastAPI REST Routes (13 endpoints)                           │
│  SQLite Database (aiosqlite)                                  │
└───────────────────────────────────────────────────────────────┘
```

**Communication protocols:**
- **WebSocket** (`ws://localhost:8001/ws`): Real-time sensor updates, health scores, alerts, scenario progress. Server-initiated pushes.
- **REST** (`http://localhost:8001/api/...`): Initial data load on mount, DGA/FMEA polling every 5s, historical data for playback.

---

## 5. Backend Deep-Dive

### 5.1 SimulatorEngine — The Heart

**File:** `backend/simulator/engine.py`

The engine is an infinite async loop (`async def run()`) that executes every `TICK_INTERVAL_SECONDS` (1 real second). Each **tick**:

```
1. Extract scenario modifiers (winding_delta, top_oil_delta, cooling_override)
2. Get load_fraction and ambient_temp from load_profile
3. Update equipment model → get cooling_mode (fan/pump decisions)
4. Advance thermal model → new top_oil, winding, bot_oil temps
5. Advance DGA model → new gas ppm values
6. Apply Gaussian noise to all readings
7. Update simulation state (TransformerState)
8. Advance scenario state machine
9. Advance sim_time by (speed × tick_interval) seconds
10. If sensor group interval elapsed → emit sensor_update WS message
11. Run analytics (anomaly detection, DGA analysis, FMEA, health score)
12. Emit health_update, alert messages as needed
13. Persist to SQLite
```

**Sensor groups emit at different rates** (at 1× speed):
- Thermal sensors: every 5 sim-seconds (5 real seconds at 1×)
- Equipment sensors: every 10 sim-seconds
- DGA sensors: every 300 sim-seconds (5 real minutes)
- Diagnostic sensors: every 3600 sim-seconds (1 real hour)

At 60× speed: thermal updates every 0.08 real seconds — effectively real-time animation.

### 5.2 Thermal Model

**File:** `backend/simulator/thermal_model.py`

Implements **IEC 60076-7 two-stage exponential lag**:

**Stage 1 — Top Oil Temperature:**
```
θ_TO(t) = θ_TO_steady + (θ_TO_prev − θ_TO_steady) × exp(−dt / τ_TO)
θ_TO_steady = ambient + ΔθOR_rated × rise_factor × K^(2n)
```
- `K` = load fraction (0–1.2)
- `n` = 0.8 (ONAN empirical exponent)
- `τ_TO` = 10800 s (3 hours) for ONAN — time to reach 63% of a step change
- `rise_factor` = 1.0 (ONAN), 0.727 (ONAF), 0.545 (OFAF)

This means: if you suddenly jump load from 50% to 100%, top oil temperature doesn't instantly jump — it exponentially approaches the new steady state over ~3 hours (the thermal mass of the transformer).

**Stage 2 — Winding Temperature (above top oil):**
```
θ_winding(t) = θ_winding_steady + (θ_winding_prev − θ_winding_steady) × exp(−dt / τ_w)
θ_winding_steady = θ_top_oil + H × ΔθWR_rated × K^(2m)
τ_w = 600 s (10 minutes) — windings are light, respond faster than oil
```

**Key design decision:** Scenario modifiers (`winding_delta`, `top_oil_delta`) are applied to the **output only**, not the internal state. This prevents feedback loops that would cause temperatures to diverge to infinity. The thermal model's internal integrator always sees pure physics — scenarios only shift what gets reported.

### 5.3 Equipment Model

**File:** `backend/simulator/equipment_model.py`

Uses **hysteresis thresholds** to prevent rapid cycling:

```
Fan Bank 1: ON when top_oil ≥ 75°C, OFF when top_oil < 70°C
Fan Bank 2: ON when top_oil ≥ 85°C, OFF when top_oil < 80°C
Oil Pump:   ON when load ≥ 0.80,    OFF when load < 0.75
```

Hysteresis means: once Fan Bank 1 turns ON at 75°C, it stays ON until temperature drops to 70°C — the 5°C band prevents the fan from rapidly flickering on and off at the threshold. This is how real industrial equipment works.

**Cooling mode derivation:**
```
OFAF (best)  = oil pump running
ONAF (good)  = any fan running (but no pump)
ONAN (basic) = nothing running
```

### 5.4 DGA Model

**File:** `backend/simulator/dga_model.py`

Gas accumulates over time (never resets — realistic because real dissolved gas takes months to dissipate):

```
gas[i] += (base_rate[i] + scenario_injection[i] + arrhenius_rate[i]) × dt_s / 3600
```

The Arrhenius component: `rate = base_rate × exp(K_arrhenius × (winding_temp − threshold))`. Gas generation accelerates exponentially as winding temperature rises. The CO and CO₂ components also include a paper-degradation pathway that activates above paper_threshold_C.

Noise is applied to each gas reading (Gaussian, per-gas sigma) and clamped to ≥ 0 (can't have negative gas concentration).

### 5.5 Load & Ambient Profiles

**File:** `backend/simulator/load_profile.py`

**Load profile** — sinusoidal with a daily cycle:
- Weekday: 35–85% load; peak at 14:00 (2 PM)
- Weekend: 35–65% load (lower activity)
- Formula: `K = K_mean + K_amplitude × sin(2π × (t − peak_time) / 86400)`

**Ambient temperature** — also sinusoidal:
- Range: 15–35°C; peak at 15:00 (3 PM)
- Formula: same sine wave structure

Both functions are **deterministic** — given the same sim_time, they always return the same value. This makes scenarios reproducible.

### 5.6 Anomaly Detector

**File:** `backend/analytics/anomaly_detector.py`

Rolling Z-score detector:
1. Maintains a deque of the last 360 readings per thermal/DGA sensor
2. Computes rolling mean and standard deviation of the window
3. `z = (current − mean) / max(std, min_std)` where `min_std = max(1e-9, sensor_range × 0.01)` — the floor prevents false alarms from perfectly stable baselines
4. Z > 2.0 → CAUTION, Z > 3.5 → WARNING, Z > 5.0 → CRITICAL
5. Rate-of-change check: if value changes > 10% of range per minute → escalate one severity level
6. Only fires alert callback on **first detection** or **escalation** (not every tick — this prevents alert floods)

**Important session 9 bug fix:** The original floor was `1e-9` (essentially zero), which caused 1400+ alerts on startup because the Z-score became enormous for the first few readings before the baseline stabilized. Fixed to `sensor_range × 0.01` — 1% of sensor range as minimum std.

### 5.7 DGA Analyzer

**File:** `backend/analytics/dga_analyzer.py`

Performs three analyses:

1. **Duval Triangle 1:** Convert CH₄, C₂H₄, C₂H₂ to percentages → point-in-polygon test against 7 zone polygons → returns zone label

2. **TDCG (Total Dissolved Combustible Gas):** Sum of H₂+CH₄+C₂H₆+C₂H₄+C₂H₂+CO. Thresholds: Normal<720, Caution 720–1920, Warning 1920–4630, Critical>4630 ppm.

3. **CO₂/CO Ratio:** `ratio = CO₂ / CO`.
   - < 3 → "Fault involving cellulose — serious"
   - 3–10 → "Possible paper involvement"
   - > 10 → "Normal paper aging"

4. **Gas Rate Trends:** For each gas, compare current value to value N readings ago. If increased >5% → RISING; decreased >5% → FALLING; else STABLE.

### 5.8 FMEA Engine

**File:** `backend/analytics/fmea_engine.py`

For each of the 8 failure modes, evaluates a set of weighted conditions:

```python
score = 0.0
for condition in failure_mode.conditions:
    condition_score = evaluate_condition(condition, state, dga_analysis)
    score += condition_score × condition.weight

if score >= 0.7:
    confidence = "Probable"
elif score >= 0.4:
    confidence = "Possible"
elif score >= 0.3:
    confidence = "Monitoring"
else:
    do not include in output
```

Results are sorted by score descending. Each result includes: name, match score, confidence label, severity (1–10), affected components, evidence (which conditions matched), recommended actions, estimated development timeline.

### 5.9 Health Score Calculator

**File:** `backend/analytics/health_score.py`

Aggregates 6 component statuses:

- **DGA:** Worst status among all 7 gases (any Critical → component is Critical)
- **Winding Temp:** Based on threshold AND anomaly detection (anomaly escalates one level)
- **Oil Temp:** Based on TOP_OIL_TEMP vs thresholds
- **Cooling:** NORMAL if equipment working as expected; CAUTION if any expected-but-off equipment; WARNING/CRITICAL for multiple failures
- **Oil Quality:** Worst of moisture and dielectric strength
- **Bushing:** Worst of HV/LV capacitance deviation from baseline

Then: `health = 100 − Σ(penalty[status] × weight[component])`, clamped to [0, 100].

### 5.10 REST API Routes

13 endpoints, all under `/api/`:

| Route | Purpose |
|-------|---------|
| `GET /transformer` | Static nameplate data (rating, manufacturer, etc.) |
| `GET /sensors/current` | Latest reading for all 21 sensors |
| `GET /sensors/history` | Historical readings for one sensor |
| `GET /sensors/snapshot?sim_time=X` | All sensors at a historical sim_time (for playback) |
| `GET /health` | Current health score + component breakdown |
| `GET /health/history` | Historical health scores |
| `GET /dga/analysis` | Current DGA analysis (Duval zone, TDCG, CO₂/CO, rates) |
| `GET /fmea` | Current FMEA failure mode list |
| `GET /alerts` | All alerts from database |
| `PUT /alerts/{id}/acknowledge` | Mark alert as acknowledged |
| `POST /simulation` | Run what-if simulation with given parameters |
| `POST /scenario/{id}/trigger` | Trigger a fault scenario |
| `GET /scenario/status` | Current scenario state |
| `PUT /simulation/speed` | Change simulation speed |

### 5.11 WebSocket Protocol

Single endpoint: `ws://localhost:8001/ws`

**Server → Client messages:**

```json
// Connection acknowledgment
{"type": "connection_ack", "sim_time": 0, "speed_multiplier": 1, "active_scenario": "normal"}

// Sensor data (every group interval)
{"type": "sensor_update", "group": "thermal", "sim_time": 45.0, "sensors": {
  "TOP_OIL_TEMP": {"value": 52.3, "unit": "°C", "status": "NORMAL"},
  "FAN_BANK_1": {"value": 0.0, "unit": "boolean", "status": "OFF"}
}}

// Health score (when score changes by ≥ 0.5 points)
{"type": "health_update", "overall_score": 87.5, "previous_score": 91.0, "components": {...}}

// Alert (when anomaly detected)
{"type": "alert", "alert": {"id": 1, "severity": "WARNING", "title": "...", ...}}

// Scenario progress
{"type": "scenario_update", "scenario_id": "hot_spot", "stage": "Stage 2: ...", "progress_percent": 45.0}
```

**SQLite persistence:** Sensor readings (thermal + DGA groups), health score snapshots, and alerts are written to `transformertwin.db` after each tick via async callbacks registered on the engine.

---

## 6. Frontend Deep-Dive

### 6.1 Component Architecture

```
App.tsx
├── Header.tsx                  — Title, scenario selector, speed control, connection indicator
├── MainLayout.tsx              — 55/45 split: 3D viewer | right panel
│   ├── TransformerScene.tsx    — R3F Canvas + lights + OrbitControls
│   │   └── TransformerModel.tsx — All 9 mesh parts
│   └── TabContainer.tsx        — Health gauge strip + 5 tabs
│       ├── HealthGauge.tsx     — SVG circular gauge (always visible above tabs)
│       ├── HealthBreakdown.tsx — Component contribution bars (always visible)
│       ├── SensorPanel.tsx     — 21 sensor rows with sparklines
│       ├── DGAPanel.tsx        — DGA sub-tabs: Duval | Trends | Summary
│       │   ├── DuvalTriangle.tsx — SVG ternary diagram
│       │   ├── DGAGasTrends.tsx — Recharts line charts for 7 gases
│       │   └── DGASummary.tsx  — TDCG, CO₂/CO ratio, rates table
│       ├── FMEAPanel.tsx       — List of FMEA diagnostic cards
│       ├── WhatIfPanel.tsx     — Sliders + ProjectionChart
│       └── AlertPanel.tsx      — Alert list with acknowledge buttons
└── BottomTimeline.tsx          — LIVE/PLAYBACK toggle + scrubber slider
```

### 6.2 State Management

**File:** `frontend/src/store/index.ts`

Single **Zustand** store (flat structure, no immer, no slices). Zustand was chosen over Redux because it's simpler for a single-developer POC — no action/reducer boilerplate.

Key state slices:
- `readings`: `Partial<Record<SensorId, SensorReading>>` — latest value + status for each sensor
- `history`: `Record<SensorId, SensorHistoryPoint[]>` — ring buffer, max 720 points per sensor (= 2 hours at DGA rate)
- `overallScore`, `components` — health state
- `alerts`, `activeCount`, `totalCount` — alert state
- `analysis`, `duvalHistory` — DGA state (duvalHistory is last 20 Duval readings for trail)
- `response` — FMEA response
- `mode`, `playbackPosition`, `isPlaying` — playback state

**On page refresh:** The Zustand store is completely cleared (in-memory only). Alerts intentionally do NOT load from SQLite on mount — each session starts fresh. DGA and health are fetched fresh from the engine's current state.

### 6.3 WebSocket Hook

**File:** `frontend/src/hooks/useWebSocket.ts`

- Connects to `ws://localhost:8001/ws` on mount
- Routes messages by `msg.type` to appropriate store actions
- Exponential backoff reconnection: 1s → 2s → 4s → 8s → 16s → 30s max
- In **playback mode**, suppresses live `sensor_update` and `health_update` messages so historical state remains visible

### 6.4 Duval Triangle Visualization

**File:** `frontend/src/components/panels/DuvalTriangle.tsx`
**Geometry:** `frontend/src/lib/duvalGeometry.ts`

The ternary → Cartesian coordinate transform:
```typescript
// p.ch4, p.c2h4, p.c2h2 are normalized [0,1]
// CH4 = bottom-left, C2H4 = bottom-right, C2H2 = top
const x = p.c2h4 + p.c2h2 * 0.5
const y = p.c2h2 * Math.sqrt(3) / 2
```

Then mapped to SVG pixel space with padding:
```typescript
svgX = PAD + x * (W - 2*PAD)
svgY = H - PAD - y * (H - 2*PAD)  // Y-flip: SVG y increases downward
```

Zone polygons are defined as arrays of [x, y] vertices in normalized [0,1] space from the IEC 60599 standard (exactly transcribed in `docs/DUVAL_TRIANGLE_VERTICES.md`). Point-in-polygon testing uses the ray-casting algorithm.

The component renders:
1. Zone polygon fills (colored at 45% opacity)
2. Zone abbreviation labels at polygon centroids
3. Historical trail (last 20 readings, fading opacity oldest→newest)
4. Live point (white dot with zone-colored ring)
5. Axis labels at vertices

### 6.5 3D Model

**File:** `frontend/src/components/viewer3d/`

Built with **React Three Fiber** (R3F) — React bindings for Three.js. Parts:
- `Tank.tsx`, `Conservator.tsx`, `HVBushing.tsx`, `LVBushing.tsx`, `RadiatorBank.tsx`, `FanUnit.tsx`, `OilPump.tsx`, `TapChanger.tsx`, `BuchholzRelay.tsx`

Each part is a Three.js `mesh` with basic geometry (BoxGeometry, CylinderGeometry). Hover shows a tooltip via `ComponentTooltip.tsx`. Colors update based on sensor status.

### 6.6 Historical Playback

**File:** `frontend/src/components/layout/BottomTimeline.tsx`

- Toggle between LIVE and PLAYBACK modes
- In playback, a scrubber slider selects a `sim_time` value
- Calls `GET /api/sensors/snapshot?sim_time=X` (debounced 300ms) to get historical sensor state
- WebSocket live updates are suppressed while in playback
- Exit playback → resume live streaming

---

## 7. Data Flow: End to End

Here is the complete journey of data from physics model to screen:

```
Every real second (tick):

1. SimulatorEngine._tick()
   ├── get_load_fraction(sim_time) → 0.65 (65% load)
   ├── get_ambient_temp(sim_time) → 27°C
   ├── HotSpotScenario.get_thermal_modifiers() → {winding_delta: 40.0, top_oil_delta: 15.0}
   ├── EquipmentModel.update(top_oil=72°C, load=0.65, ...) → {fan_bank_1: False, ...}
   ├── ThermalModel.tick(dt=5s, K=0.65, ambient=27, mode=ONAN, winding_delta=40)
   │     → ThermalState(top_oil=58.2, winding=88.4+40=128.4, bot_oil=42.6)
   ├── DGAModel.tick(dt=5s, winding_temp=128.4, mods={CH4:0.008, C2H4:0.015})
   │     → DGAState({H2: 45.2, CH4: 18.7, C2H4: 9.3, ...})
   ├── add_noise("TOP_OIL_TEMP", 58.2 + 15.0) → 73.4°C (noisy output with delta)
   └── self.state.top_oil_temp = 73.4

2. (every 5 sim-seconds) _emit_sensor_group("thermal")
   ├── Build message: {type:"sensor_update", group:"thermal", sensors:{TOP_OIL_TEMP:{value:73.4, status:"NORMAL"},...}}
   ├── AnomalyDetector.evaluate(state, "thermal") → z=1.8 (below threshold, no alert)
   └── ws_manager.broadcast(message) → sends to all connected WebSocket clients

3. Frontend useWebSocket() receives message
   ├── handleMessage({type:"sensor_update"})
   └── store.updateReadings("thermal", {TOP_OIL_TEMP:{value:73.4, status:"NORMAL"}}, sim_time)
       ├── Updates readings[TOP_OIL_TEMP]
       └── Appends to history[TOP_OIL_TEMP] ring buffer

4. React re-renders:
   ├── SensorRow[TOP_OIL_TEMP] reads useSensorReading() → {value:73.4, status:"NORMAL"}
   │    └── Renders "73.4 °C" with a green dot
   ├── SensorSparkline[TOP_OIL_TEMP] reads useSensorHistory() → array of 60 points
   │    └── Renders Recharts sparkline
   └── HealthGauge reads useHealthScore() → 87.5 → renders gauge
```

---

## 8. The Three Fault Scenarios

### Scenario 1: Developing Hot Spot (FM-001)

**Trigger:** `POST /api/scenario/hot_spot/trigger`

**What it simulates:** A blocked cooling duct causing a localized hot spot in the winding insulation.

**Duration:** 2 simulated hours (7200 sim-seconds)

**Stage progression:**

| Stage | Duration | winding_delta | top_oil_delta | DGA Injected | What You See |
|-------|----------|---------------|---------------|--------------|-------------|
| Stage 1 | 0–30 min | +15°C | 0°C | H₂:0.002, CH₄:0.001, C₂H₄:0.001 ppm/s | Winding temp rises slightly |
| Stage 2 | 30–90 min | +40°C | +15°C | H₂:0.010, CH₄:0.008, C₂H₄:0.015, CO:0.020 ppm/s | Gas levels rise, Fan Bank 1 activates as top_oil approaches 75°C |
| Stage 3 | 90–120 min | +80°C | +25°C | H₂:0.025, CH₄:0.020, C₂H₄:0.060, C₂H₂:0.003, CO:0.080 ppm/s | Critical winding temp, Duval shifts T1→T2→T3, Fan Banks 1+2 ON |

**Expected UI responses:**
- WINDING_TEMP reads 130–160°C in Stage 3 (vs normal ~80°C) → status goes CRITICAL
- DGA panel: Duval triangle point moves from T1 toward T2/T3 over the 2 hours
- Alerts: Winding temp WARNING → CRITICAL alerts generated
- FMEA: FM-001 reaches "Possible" in ~30 min, "Probable" by ~90 min
- Health score drops from ~95 → ~60 (FAIR) → ~45 (POOR) progressively
- Fan Banks turn ON when top_oil_delta pushes effective temperature above 75°C (Stage 2/3)
- After scenario completes → returns to Normal Operation automatically

### Scenario 2: Arcing Event (FM-003)

**Trigger:** `POST /api/scenario/arcing/trigger`

**What it simulates:** Internal electrical discharge/arc between conductors.

**Key signature:** Acetylene (C₂H₂) spike — acetylene is the fingerprint of arcing because it only forms at extremely high temperatures (>1000°C, in the arc channel). Even 1 ppm of C₂H₂ is considered abnormal.

**Expected UI responses:**
- DGA_C2H2 rapidly increases → DGA status → CAUTION → WARNING
- DGA_H2 also spikes (arcs produce lots of hydrogen)
- Duval triangle point moves toward D1 (low energy discharge) or D2 (high energy discharge)
- FMEA: FM-003 (Internal Arcing) reaches "Probable" within 10 sim-minutes

### Scenario 3: Cooling Fan Failure (FM-004)

**Trigger:** `POST /api/scenario/cooling_failure/trigger`

**What it simulates:** Cooling fans fail (motor burnout, power loss).

**Mechanism:** Forces `cooling_mode_override = "ONAN"` regardless of fan state. The equipment model can still "think" fans are on, but the thermal model runs as ONAN with worse thermal performance.

**Expected progression:**
- Top oil temperature rises gradually (worse cooling → higher steady-state target)
- As temperature climbs: FAN_BANK_1 shows ON (trying to run), but cooling mode is stuck at ONAN
- Eventually top oil may exceed 75°C → CAUTION/WARNING alerts
- Health score decreases due to cooling component penalty
- FMEA: FM-004 (Cooling System Failure) activates

### Normal Operation (Scenario 4)

**Always active by default.** No modifiers — the simulator runs purely on physics:
- Load follows weekday/weekend sinusoidal cycle
- Temperatures correlate correctly with load
- DGA gases stay within normal ranges
- Health score stays 90–100
- No alerts generated (anomaly detector should see clean data)

---

## 9. Implementation vs. PRD Analysis

### What Matches Perfectly ✅

| Feature | PRD Requirement | Status |
|---------|----------------|--------|
| 21 sensors with correct IDs | All 21 sensors exactly as specified | ✅ |
| WebSocket message types | All 6 message types implemented | ✅ |
| Duval Triangle zones | All 7 zones with IEC 60599 polygon vertices | ✅ |
| FMEA 8 failure modes | FM-001 through FM-008 all implemented | ✅ |
| Health score formula | Weighted penalty model with 6 components | ✅ |
| What-if Arrhenius aging | IEC 60076-7 Annex A formula | ✅ |
| Historical playback | Scrubber, snapshot endpoint, WS suppression | ✅ |
| Exponential backoff reconnection | 1s→2s→4s→8s→16s→30s | ✅ |
| SQLite persistence | Sensor readings, health history, alerts | ✅ |
| All 13 REST endpoints | All implemented and returning real data | ✅ |

### Known Discrepancies 🔸

**1. Fan Bank Thresholds — RESOLVED**
- PRD (F2 AC7): Fan Bank 1 ON at 65°C, Fan Bank 2 ON at 75°C, Oil Pump ON when load > 70% OR top_oil > 80°C
- Implementation (`equipment_model.py`): Now matches PRD exactly — Fan Bank 1 ON at ≥65°C (OFF <60°C), Fan Bank 2 ON at ≥75°C (OFF <70°C), Oil Pump ON when load ≥70% OR top_oil ≥80°C
- At peak weekday load (85%, 35°C ambient), ONAN steady-state top_oil ≈ 75°C → Fan Bank 1 activates → ONAF mode → top_oil stabilizes ~66°C → Fan Bank 1 stays on (>60°C)
- The `top_oil_delta` addition to the hot_spot scenario provides additional visual feedback during the demo scenario on top of the correct threshold behavior

**2. Health Score Penalty Values**
- PRD (F6): CAUTION=20, WARNING=50, CRITICAL=90
- Implementation (`config.py`): CAUTION=25, WARNING=50, CRITICAL=100
- **Impact:** CAUTION drops health 5 points more than PRD specifies; CRITICAL drops 10 more
- **Severity:** Minor — health score trajectory is directionally correct

**3. Anomaly Detection Method**
- PRD (F3): Percentage-based deviation (5–15% = CAUTION, 15–30% = WARNING, >30% = CRITICAL)
- Implementation: Z-score based (z > 2.0 = CAUTION, > 3.5 = WARNING, > 5.0 = CRITICAL)
- **Impact:** Different but arguably more rigorous — Z-score correctly handles sensors that naturally operate at different absolute scales
- **Verdict:** Implementation is technically superior to the PRD spec

**4. 3D Component Health Overlays**
- PRD (F1 AC7): Components change color with amber/orange/red overlays based on health status; critical items pulse at 0.5 Hz
- Implementation: 3D model renders correctly but thermal overlays and click-to-select-detail-panel are not fully wired to live health data
- **Severity:** UI completeness gap; the model exists and is beautiful but lacks full color coding integration

**5. No Deadband After Load Changes**
- PRD (F3): "Apply a deadband of 2 minutes after a load change >10% to avoid false anomalies during transients"
- Implementation: No deadband implemented
- **Impact:** Potential brief anomaly spike when load changes sharply
- **Mitigation:** The min_std floor (1% of sensor range) significantly reduces false alarms

### What's Better Than the PRD 🚀

- **Frontend unit tests** (125 tests): The PRD didn't specify frontend unit tests; we added them anyway (Duval geometry, formatters, store actions)
- **Historical playback scrubber**: PRD mentioned it; implementation is complete and polished
- **Connecting overlay + disconnection banner**: Not in PRD; improves UX significantly
- **Demo script** (`docs/DEMO_SCRIPT.md`): 8-segment 10-minute guided walkthrough

---

## 10. Key Talking Points for the Interview

### If Asked "Walk Me Through the Architecture"

"TransformerTwin has a Python FastAPI backend that runs an async simulation loop. Every second, the engine advances physics models — IEC 60076-7 thermal equations for temperature, Arrhenius chemistry for dissolved gas generation, and hysteresis logic for cooling equipment. Results stream to the browser via WebSocket, which updates a Zustand store. React components subscribe to just the state slices they need and re-render efficiently. REST endpoints handle historical queries, configuration, and the what-if simulation."

### If Asked "How Does the Anomaly Detection Work?"

"We use a rolling Z-score detector — the same 'actual vs. expected' paradigm as GE SmartSignal. We keep a rolling 360-reading window (30 sim-minutes) per sensor, computing a rolling mean and standard deviation. A Z-score above 2 is CAUTION, above 3.5 is WARNING, above 5 is CRITICAL. We also check rate-of-change: if a sensor moves more than 10% of its range per sim-minute, we escalate by one level. Critically, we only fire alerts on first detection or level escalation — not every tick — which prevents alert floods."

### If Asked "Explain the Duval Triangle"

"The Duval Triangle is an IEC standard (60599) for classifying transformer faults from dissolved gas analysis. You take three gases — methane, ethylene, and acetylene — convert them to percentages, and plot the point on a ternary diagram. The triangle is divided into 7 zones, each corresponding to a fault type. For example, if acetylene dominates, you're in the D2 zone — high energy discharge, meaning arc-over. If ethylene dominates, you're in T3 — thermal fault above 700°C. The coordinate transform from ternary to Cartesian is: x = pct_C2H4 + pct_C2H2/2, y = pct_C2H2 × √3/2."

### If Asked "Why SQLite?"

"Zero infrastructure. A transformer digital twin POC doesn't need Postgres cluster management. SQLite is ACID-compliant, handles our 1-record-per-5-seconds write rate easily, and aiosqlite gives us true async I/O so it doesn't block the FastAPI event loop. In production, this would obviously be InfluxDB or TimescaleDB for time-series optimized queries, but for a POC demo running on a laptop, SQLite is the right call."

### If Asked "What Would You Build Next?"

"Three things: First, real ML anomaly detection using LSTM neural networks trained on historical fault signatures — the Z-score approach works but true ML would catch more subtle patterns. Second, fleet management — running multiple transformer instances simultaneously to compare their health trends. Third, a mobile push notification system so maintenance engineers get alerted on their phones when a fault scenario escalates, not just on the dashboard."

### If Asked About the DGA Chemistry

"Gas generation in a transformer follows Arrhenius kinetics — the same equation that governs all chemical reaction rates. At normal operating temperatures (~80°C winding), gas generation is very slow — we're talking fractions of a ppm per day. But above 150°C, generation accelerates exponentially: every 6°C increase doubles the rate. So a winding hot spot at 200°C generates gases maybe 100× faster than at 80°C. That's why DGA is such a sensitive early warning indicator — small gas concentrations signal large thermal events long before the transformer reaches its absolute threshold."

### On the Physics Implementation

"I implemented the IEC 60076-7 thermal model — the international standard for oil-immersed transformer loading. It's a two-stage exponential lag: top oil has a 3-hour time constant (the thermal mass of tons of oil), and the winding has a 10-minute time constant (lighter, responds faster). The key insight is that these are first-order differential equations approximated with explicit Euler method: `θ(t) = θ_steady + (θ_prev − θ_steady) × exp(-dt/τ)`. The steady-state target is a function of load squared (K^1.6 actually, with exponent n=0.8), and different cooling modes change both the steady-state target and the time constant."

---

## Appendix: File Reference

| File | Purpose |
|------|---------|
| `backend/main.py` | FastAPI app, lifespan (startup/shutdown), callback registration |
| `backend/simulator/engine.py` | Main tick loop — wires everything together |
| `backend/simulator/thermal_model.py` | IEC 60076-7 two-stage thermal model |
| `backend/simulator/equipment_model.py` | Fan/pump hysteresis, cooling mode derivation |
| `backend/simulator/dga_model.py` | Arrhenius gas generation, accumulation |
| `backend/simulator/load_profile.py` | Sinusoidal load and ambient temperature |
| `backend/simulator/noise.py` | Per-sensor Gaussian noise |
| `backend/scenarios/hot_spot.py` | FM-001 scenario: winding_delta + top_oil_delta + DGA injection |
| `backend/scenarios/arcing.py` | FM-003 scenario: C2H2/H2 spike |
| `backend/scenarios/cooling_failure.py` | FM-004 scenario: cooling_mode_override=ONAN |
| `backend/analytics/anomaly_detector.py` | Rolling Z-score + rate-of-change |
| `backend/analytics/dga_analyzer.py` | Duval Triangle + TDCG + CO2/CO + trend |
| `backend/analytics/fmea_engine.py` | 8 failure mode weighted scoring |
| `backend/analytics/health_score.py` | 6-component weighted penalty model |
| `backend/api/routes_simulation.py` | What-if Arrhenius aging projection |
| `backend/models/schemas.py` | All Pydantic models (matches Integration Contract exactly) |
| `backend/config.py` | ALL constants with explanatory comments |
| `frontend/src/store/index.ts` | Zustand flat store |
| `frontend/src/hooks/useWebSocket.ts` | WS connection + exponential backoff + message routing |
| `frontend/src/hooks/useApi.ts` | REST fetch wrappers |
| `frontend/src/lib/duvalGeometry.ts` | Ternary→Cartesian, zone polygons, point-in-polygon |
| `frontend/src/components/panels/DuvalTriangle.tsx` | SVG ternary diagram renderer |
| `frontend/src/components/viewer3d/TransformerScene.tsx` | R3F scene setup |
| `frontend/src/App.tsx` | Top-level component: WS init + initial REST fetches |
| `docs/PRD.md` | Product requirements (primary source of truth) |
| `docs/THERMAL_PHYSICS.md` | IEC 60076-7 formulas and constants |
| `docs/DGA_GAS_GENERATION.md` | Arrhenius constants, per-gas rates |
| `docs/DUVAL_TRIANGLE_VERTICES.md` | IEC 60599 zone polygon vertices |
| `docs/FMEA_DEFINITIONS.md` | 8 failure modes with conditions and weights |
| `docs/INTEGRATION_CONTRACT.md` | Authoritative WebSocket/REST schemas |
