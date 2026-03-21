# TransformerTwin — Demo Script

**Total time**: ~10 minutes
**Audience**: Technical stakeholders, potential users, evaluators
**Goal**: Show real-time digital twin capabilities from startup through fault diagnosis

---

## Pre-Demo Checklist

Before starting, ensure:
- Backend running: `cd backend && .venv/bin/python -m uvicorn main:app --reload --port 8001`
- Frontend running: `cd frontend && npm run dev` (opens at http://localhost:5173)
- Browser tab open, devtools closed, screen resolution comfortable for sharing
- Both terminal windows visible in case you need to show logs
- Scenario is set to `normal` (default on fresh start)

---

## Segment 1 — Introduction (0:00–1:00)

**Say:**
> "This is TransformerTwin — a real-time digital twin of a 100 MVA power transformer. The idea is simple: instead of waiting for a field inspection or a lab gas test result that takes days, you get a live, continuously updated model of what's happening inside your transformer right now."

**Do:** Point to the overall layout — 3D model center, panels around it.

**Say:**
> "Everything you see is driven by physics-based simulation conforming to IEC 60076-7 — the same thermal aging standard used in the industry. The backend is a FastAPI service streaming sensor data over WebSocket at roughly one tick per second. The frontend is a React/TypeScript app that consumes that stream and updates every panel simultaneously."

> TALKING POINT: The backend runs a full IEC 60076-7 thermal model plus an Arrhenius DGA aging model. This isn't dashboard interpolation — it's actual coupled physics.

---

## Segment 2 — Normal Operation Tour (1:00–3:00)

### 3D Model (1:00–1:30)

**Do:** Rotate the 3D transformer model slowly with mouse drag.

**Say:**
> "The 3D model uses React Three Fiber. The color overlay maps to winding hot-spot temperature — blue is cool, shifting toward red as temperature rises. You can orbit to inspect different angles."

> TALKING POINT: Thermal color is derived live from the `HOT_SPOT_TEMP` sensor feed, not a static texture. It updates every tick.

### Sensor Panel (1:30–2:15)

**Do:** Point to the sensor panel. Scroll through the sensor list.

**Say:**
> "We have 21 sensors organized into four groups: thermal, DGA gases, equipment, and diagnostics. Each sensor shows its current value, unit, and a colored status dot — green for normal, yellow for caution, orange for warning, red for critical."

**Do:** Point out a few specific sensors:
- `TOP_OIL_TEMP` — top oil temperature in °C
- `HOT_SPOT_TEMP` — winding hot-spot
- `DGA_H2`, `DGA_C2H2` — dissolved gas concentrations in ppm

**Say:**
> "The dissolved gas analysis sensors — hydrogen, methane, ethylene, acetylene, and others — are the early warning system for internal faults. We'll see those move shortly."

### Health Score Gauge (2:15–2:30)

**Do:** Point to the health score gauge.

**Say:**
> "The health score runs from 0 to 100. It's a weighted composite of six components: thermal, DGA, equipment, insulation, loading, and diagnostics. Under normal operation at moderate load, we're sitting in the high 80s to low 90s — healthy."

> TALKING POINT: The health score uses a penalty model, not a simple average. A single severe fault in one component can pull the overall score down sharply, which reflects how transformers actually fail.

### Alert Panel (2:30–3:00)

**Do:** Point to the alert panel — it should be quiet under normal conditions.

**Say:**
> "The alert panel is silent right now. Alerts have four severity levels: INFO, CAUTION, WARNING, and CRITICAL. Each alert can be acknowledged to confirm an operator has seen it. We'll generate some alerts in the next segment."

---

## Segment 3 — Hot Spot Fault at 10x Speed (3:00–5:30)

### Set Speed and Trigger Scenario (3:00–3:30)

**Do:** Find the simulation speed control. Set it to **10×**.

**Say:**
> "I'm going to speed the simulation up to 10× so we can watch a fault develop in real time without waiting. In a real deployment you'd run at 1× or faster during an actual event."

**Do:** Find the scenario selector. Select **hot_spot**.

**Say:**
> "I'm triggering the hot-spot scenario. This injects a localized winding overtemperature fault — temperature rises in stages: +15°C initially, escalating to +40°C, then +80°C above normal winding temperature. It also injects ethylene and hydrogen as the insulation paper begins to thermally degrade."

### Watch Sensors Rise (3:30–4:15)

**Do:** Watch the sensor panel. Point out as values change:
- `HOT_SPOT_TEMP` climbing
- `TOP_OIL_TEMP` following more slowly (thermal lag)
- `DGA_H2` and `DGA_C2H2` beginning to rise
- 3D model color shifting toward orange/red in the winding area

**Say:**
> "Notice the thermal lag — top oil temperature rises more slowly than the winding hot-spot. This is the IEC 60076-7 oil thermal model: the winding responds fast to load changes, the oil mass has thermal inertia. That distinction matters for real transformer protection."

> TALKING POINT: The simulator couples thermal and DGA models. As temperature rises, the Arrhenius DGA model accelerates gas generation — so you see the gas sensors respond to the thermal event, not independently.

### Duval Triangle Movement (4:15–4:45)

**Do:** Point to the Duval Triangle panel.

**Say:**
> "The Duval Triangle is a standardized IEC 60599 diagnostic tool. It plots the relative proportions of three gases — methane, ethylene, and acetylene — to classify the type of fault. The triangle is divided into seven zones: PD for partial discharge, T1, T2, T3 for thermal faults of increasing severity, D1 and D2 for low and high-energy electrical discharge, and DT for a combined fault."

**Do:** Point to the live point moving on the triangle, and the 20-point trail behind it.

**Say:**
> "You can see the live point moving as gas ratios shift. The trail shows the recent history of that point — it's traveling through the T1 and T2 thermal fault zones, which is exactly what we'd expect from a hot-spot developing in paper insulation."

> TALKING POINT: Most DGA tools give you a static snapshot after a lab sample. This shows the fault trajectory in real time — you can see it evolving, not just where it ended up.

### Alert and Health Drop (4:45–5:30)

**Do:** Point to the alert panel — WARNING or CRITICAL alerts should be appearing.

**Say:**
> "Alerts are firing. We have warnings on hot-spot temperature and DGA gas levels. The FMEA engine is correlating these signals and raising a CRITICAL on thermal fault."

**Do:** Point to the health score gauge — it should be dropping visibly.

**Say:**
> "Watch the health score drop. The thermal and DGA penalty components are both being hit. This is the compounding effect — a winding hot-spot doesn't just affect the thermal score, it degrades insulation and triggers DGA, so multiple health components fall together."

---

## Segment 4 — Acknowledge Alert (5:30–6:00)

**Do:** Click the **Acknowledge** button on the most critical alert.

**Say:**
> "An operator acknowledges the alert — confirming they've seen it and are acting on it. The alert is marked acknowledged and won't re-notify, but it stays in the log. This is the basic alarm management workflow."

---

## Segment 5 — Arcing Scenario and FMEA Cards (6:00–7:30)

### Switch Scenario (6:00–6:20)

**Do:** Switch the scenario selector to **arcing**.

**Say:**
> "Now let's switch to an arcing fault — an electrical discharge fault, which is the most dangerous failure mode for a transformer. The simulator injects a sharp spike in acetylene and hydrogen, which are the signature gases for high-energy arcing."

### Watch Duval Triangle Jump (6:20–6:40)

**Do:** Watch the Duval Triangle.

**Say:**
> "Notice the Duval point jumps sharply — acetylene dominates the gas ratio, so the point moves toward the D1/D2 discharge zone. This is a completely different fault signature from the thermal hot-spot we just saw."

> TALKING POINT: Distinguishing a thermal fault from an electrical discharge fault is one of the hardest problems in transformer diagnostics. The Duval Triangle makes the distinction visually immediate.

### FMEA Diagnostic Cards (6:40–7:30)

**Do:** Point to the FMEA panel. Walk through the top cards.

**Say:**
> "The FMEA panel runs eight failure mode analyses — FM-001 through FM-008 — covering winding faults, core faults, insulation degradation, bushing faults, cooling failures, and more. Each card shows the failure mode name, current risk level, and the contributing sensor signals."

**Do:** Point to the active high-risk card (likely FM-003 or FM-004 for arcing).

**Say:**
> "FM-003 is flagging high risk for internal arcing — it's looking at the combination of acetylene concentration, hydrogen level, and the Duval zone classification. The FMEA engine correlates multiple signals rather than acting on any single threshold."

> TALKING POINT: Single-sensor threshold alerting misses the patterns. The FMEA engine uses multi-signal correlation based on IEEE C57.104 gas limits — this is closer to how a diagnostic engineer actually reasons about transformer health.

---

## Segment 6 — What-If Simulation (7:30–8:30)

**Do:** Find the what-if simulation panel. Reset scenario to **normal** first.

**Say:**
> "One of the most useful features for asset managers is the what-if simulation. You can project future transformer aging and health under different operating conditions without running the live scenario."

**Do:** Set parameters:
- Load: **110%** (overload condition)
- Ambient temperature: **40°C** (hot summer environment)
- Cooling mode: leave as default
- Time horizon: **30 days**

**Do:** Click **Run Simulation**.

**Say:**
> "I'm projecting 30 days of operation at 110% load in a 40°C ambient — a summer overload scenario. The backend runs the IEC 60076-7 Arrhenius aging model day by day and returns a timeline."

**Do:** Point to the simulation result chart when it appears.

**Say:**
> "The chart shows projected health score and cumulative insulation aging over 30 days. Under these conditions, insulation aging rate is roughly three times the normal rate — the Arrhenius equation is exponential in temperature. An asset manager can use this to decide whether to curtail load or add supplemental cooling before the summer heat arrives."

> TALKING POINT: This is actionable planning data, not just monitoring. You can run multiple scenarios — normal load vs. overload vs. cooling failure — and compare the aging trajectories before committing to an operating decision.

---

## Segment 7 — Historical Playback (8:30–9:30)

**Do:** Find the **LIVE** badge at the bottom timeline. Click it.

**Say:**
> "The LIVE badge switches the dashboard into historical playback mode. A scrubber appears that lets you navigate back through the session history."

**Do:** Drag the scrubber back to when the hot-spot fault was active.

**Say:**
> "I can scrub back to when the hot-spot was running. All panels update to reflect that point in time — the sensor values, the health score, the Duval Triangle position. Live WebSocket updates are suppressed during playback so the scrubber position is authoritative."

**Do:** Point to a sensor value that is elevated compared to the current normal state.

**Say:**
> "This is useful for post-incident review — an engineer can replay exactly what the transformer was doing during an event, step through it at any granularity, and correlate the sensor evolution with what actions were taken."

> TALKING POINT: Most SCADA systems require a separate historian query tool. Having the playback integrated in the same UI, with the same visualizations, removes the context switch that slows down incident analysis.

**Do:** Click the LIVE badge again to return to live mode.

---

## Segment 8 — Wrap-Up (9:30–10:00)

**Say:**
> "To summarize what you've seen in ten minutes: real-time physics-based simulation conforming to IEC standards, live Duval Triangle diagnostics with fault trajectory tracking, FMEA correlation across eight failure modes, a what-if planning tool for load and thermal projections, and integrated historical playback — all in a single web application."

> "The backend is a FastAPI Python service — easy to replace the simulator with a real sensor feed from a substation data concentrator or SCADA historian. The frontend is a standard React app deployable anywhere."

> "The next steps are Phase 5 polish — error handling, loading states, and a production-ready README for deployment."

---

## Key Technical Differentiators (Quick Reference)

| Differentiator | Details |
|---|---|
| Physics-based model | IEC 60076-7 thermal + Arrhenius DGA, not interpolated thresholds |
| Coupled thermal-DGA | Gas generation rate driven by temperature state |
| Duval Triangle trajectory | Real-time point + 20-point trail showing fault evolution |
| Multi-signal FMEA | 8 failure modes using IEEE C57.104 gas correlation |
| What-if aging projection | Day-by-day Arrhenius aging timeline for planning scenarios |
| Integrated playback | Scrubber in same UI as live monitoring, no separate historian tool |
| WebSocket streaming | ~1 Hz sensor updates, all panels update simultaneously |

---

## Troubleshooting During Demo

**Backend not responding / sensors frozen:**
- Check backend terminal for errors
- Restart: `cd backend && .venv/bin/python -m uvicorn main:app --reload --port 8001`
- Confirm `api.ts` and `useWebSocket.ts` target port 8001

**No alerts firing on hot_spot:**
- Allow 30–60 seconds at 10× speed for fault to escalate
- Confirm scenario selector shows `hot_spot` (not still `normal`)

**Duval Triangle point not moving:**
- DGA sensors update more slowly than thermal sensors — give it 60 seconds at 10×
- Check `DGA_H2` and `DGA_C2H2` values are rising in the sensor panel

**What-if simulation returns no chart:**
- Check backend terminal for simulation endpoint errors
- Ensure time horizon is set to a non-zero value before clicking Run
