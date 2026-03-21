# TransformerTwin

A real-time Digital Twin for a 100 MVA power transformer — condition monitoring, dissolved gas analysis (DGA), FMEA diagnostics, predictive simulation, and fault scenario playback.

Built as a production-grade proof-of-concept that mirrors the architecture of enterprise platforms (GE Vernova SmartSignal, ABB Ability). Runs entirely on a local machine.

---

## Features

| Feature | Details |
|---------|---------|
| **Live Sensor Streaming** | 21 sensors across thermal, DGA, equipment, and diagnostic groups streamed over WebSocket |
| **3D Transformer Model** | Interactive React Three Fiber model with 9 component meshes (tank, bushings, radiators, conservator, etc.) |
| **DGA / Duval Triangle** | Real-time CH₄/C₂H₄/C₂H₂ Duval Triangle with IEC 60599 zone classification (PD, T1, T2, T3, D1, D2, DT) + TDCG trending |
| **FMEA Diagnostics** | 8 failure mode cards (FM-001–FM-008) with weighted evidence scoring and confidence labels |
| **Health Score** | 0–100 weighted penalty score with 6 component breakdown (thermal, DGA, equipment, insulation, loading, diagnostics) |
| **Fault Scenarios** | 3 pre-programmed fault scenarios: Developing Hot Spot, Arcing Event, Cooling Fan Failure |
| **What-If Simulation** | IEC 60076-7 Arrhenius aging projection — enter load%, ambient°C, cooling mode, horizon days |
| **Historical Playback** | Scrub through stored sensor history with LIVE ↔ PLAYBACK toggle |
| **Simulation Speed** | 1× / 5× / 10× / 50× real-time simulation multiplier |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11+, FastAPI, WebSockets, aiosqlite, NumPy, Pydantic, uvicorn |
| Frontend | React 18, TypeScript (strict), Vite, React Three Fiber, Recharts, Tailwind CSS, Zustand |
| Physics | IEC 60076-7 thermal model, DGA Arrhenius gas generation, IEC 60599 Duval classification |
| Storage | SQLite (sensor readings, health history, alerts — zero infrastructure required) |

---

## Prerequisites

- **Python 3.11+** (tested on 3.13)
- **Node.js 18+** with npm
- macOS, Linux, or WSL2

---

## Quick Start

### 1. Clone and set up

```bash
git clone <repo-url>
cd TransformerTwin
```

### 2. Start the backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8001
```

Backend starts at **http://localhost:8001**. API docs at http://localhost:8001/docs.

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend starts at **http://localhost:5173**. Open in browser.

> **Note:** Port 8000 may be in use on some machines. The backend is pre-configured for 8001 and the frontend already points to 8001.

---

## Project Structure

```
TransformerTwin/
├── backend/
│   ├── main.py                  # FastAPI app, lifespan, CORS
│   ├── config.py                # All constants (physics, thresholds, sensor IDs)
│   ├── models/schemas.py        # Pydantic schemas (WebSocket + REST)
│   ├── simulator/
│   │   ├── engine.py            # Tick loop — wires all physics + analytics
│   │   ├── thermal_model.py     # IEC 60076-7 exponential lag thermal model
│   │   ├── dga_model.py         # Arrhenius DGA gas generation
│   │   ├── equipment_model.py   # Fan/pump hysteresis, tap position
│   │   ├── load_profile.py      # Sinusoidal daily load + ambient profiles
│   │   └── noise.py             # Per-sensor Gaussian noise
│   ├── scenarios/
│   │   ├── hot_spot.py          # 3-stage developing hot spot
│   │   ├── arcing.py            # Acetylene/hydrogen arcing event
│   │   └── cooling_failure.py   # Fan bank failure → oil temp rise
│   ├── analytics/
│   │   ├── anomaly_detector.py  # Rolling Z-score anomaly detection
│   │   ├── dga_analyzer.py      # Duval Triangle + TDCG + CO₂/CO
│   │   ├── fmea_engine.py       # 8 failure mode evidence scoring
│   │   └── health_score.py      # Weighted penalty health calculator
│   ├── api/                     # 13 REST routes + WebSocket handler
│   ├── database/                # SQLite schema, migrations, queries
│   └── tests/
│       └── test_phase2_integration.py  # 28 integration tests
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── viewer3d/        # React Three Fiber 3D model
│       │   ├── panels/          # Sensor, DGA, FMEA, Alerts, WhatIf tabs
│       │   ├── charts/          # Sparklines, line charts, projection chart
│       │   ├── health/          # Health gauge + breakdown
│       │   └── layout/          # Header, MainLayout, BottomTimeline
│       ├── hooks/               # useWebSocket, useApi, useSensorHistory, usePlayback
│       ├── store/               # Zustand flat store + selectors
│       ├── lib/                 # api.ts, duvalGeometry.ts, constants.ts, formatters.ts
│       └── types/               # TypeScript interfaces matching Integration Contract
└── docs/
    ├── PRD.md                   # Product requirements
    ├── INTEGRATION_CONTRACT.md  # Authoritative WebSocket + REST schemas
    ├── BACKEND_ARCHITECTURE.md
    ├── FRONTEND_ARCHITECTURE.md
    ├── THERMAL_PHYSICS.md       # IEC 60076-7 formulas + constants
    ├── DGA_GAS_GENERATION.md    # Arrhenius model + per-gas parameters
    ├── DUVAL_TRIANGLE_VERTICES.md
    ├── FMEA_DEFINITIONS.md
    └── DEMO_SCRIPT.md           # 10-minute demo walkthrough
```

---

## Running Tests

```bash
cd backend
source .venv/bin/activate
python -m pytest tests/ -v
```

28 integration tests covering: DGA analyzer (all 7 Duval zones), anomaly detector, health score, FMEA engine, hot-spot scenario progression, and what-if simulation plausibility.

---

## Fault Scenarios

Trigger from the **Scenario** dropdown in the header or via REST:

```bash
# Hot spot — winding temperature rises over 3 stages, DGA gases escalate
curl -X POST http://localhost:8001/api/scenario/hot_spot/trigger

# Arcing — C₂H₂ and H₂ spike rapidly
curl -X POST http://localhost:8001/api/scenario/arcing/trigger

# Cooling failure — fan banks offline, oil temperature climbs
curl -X POST http://localhost:8001/api/scenario/cooling_failure/trigger

# Return to normal
curl -X POST http://localhost:8001/api/scenario/normal/trigger
```

Set speed to 10× for faster scenario progression:
```bash
curl -X PUT http://localhost:8001/api/simulation/speed \
  -H "Content-Type: application/json" \
  -d '{"speed_multiplier": 10}'
```

---

## REST API

Full OpenAPI docs at **http://localhost:8001/docs**. Key endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sensors/current` | All 21 current sensor readings + statuses |
| GET | `/api/sensors/history` | Time-series history for a sensor |
| GET | `/api/sensors/snapshot?sim_time=X` | Historical snapshot at sim time X |
| GET | `/api/health` | Current health score + 6 component breakdown |
| GET | `/api/dga/analysis` | Duval zone, TDCG level, CO₂/CO ratio, gas trends |
| GET | `/api/fmea` | Active failure mode cards with evidence |
| GET | `/api/alerts` | Alert history with acknowledge status |
| PUT | `/api/alerts/{id}/acknowledge` | Acknowledge an alert |
| POST | `/api/simulation` | Run what-if projection |
| POST | `/api/scenario/{id}/trigger` | Start a fault scenario |
| PUT | `/api/simulation/speed` | Set speed multiplier |

---

## WebSocket Protocol

Connect to `ws://localhost:8001/ws`. Message types:

- `connection_ack` — initial handshake with sim_time and speed
- `sensor_update` — batch of sensor readings (thermal every 5s, DGA every 300s sim-time)
- `health_update` — health score when delta ≥ 0.5 points
- `alert` — new or escalated anomaly alert
- `scenario_update` — scenario progress during active fault
- `ping` / `pong` — keepalive

---

## Architecture Notes

- **Physics**: IEC 60076-7 exponential lag thermal model; Arrhenius DGA gas generation calibrated to hit correct Duval zones at scenario peaks
- **Anomaly Detection**: Rolling Z-score (360-tick / 30 sim-min window) + rate-of-change check. Only fires on first detection and level escalation — not every tick
- **Duval Triangle**: IEC 60599 ternary-to-Cartesian coordinate transform. CH₄→bottom-left vertex, C₂H₄→bottom-right, C₂H₂→top
- **FMEA**: Weighted evidence scoring across 8 failure modes. Threshold 0.3 to appear, labels at 0.4 (Possible) and 0.7 (Probable)
- **SQLite Persistence**: Sensor readings, health scores, and alerts written on every engine tick via async callback
- **Playback**: Historical scrubber calls `GET /api/sensors/snapshot?sim_time=X` and suppresses live WebSocket updates while in playback mode

See [docs/INTEGRATION_CONTRACT.md](docs/INTEGRATION_CONTRACT.md) for complete field-level schema specification.
