# TransformerTwin — Product Requirements Document

**Version:** 1.0  
**Date:** March 20, 2026  
**Status:** Implementation-Ready  
**Author:** Product Management  

---

## Table of Contents

1. Executive Summary
2. Problem Statement & Business Context
3. User Personas
4. Product Vision & Success Criteria
5. Feature Requirements (F1–F9)
6. Complete Data Model
7. API Contract
8. Fault Scenario Specifications
9. Non-Functional Requirements
10. UI/UX Specification
11. Out of Scope / Future Roadmap
12. Glossary
13. Appendix A: Interview Talking Points
14. Appendix B: Reference Architecture

---

## 1. Executive Summary

TransformerTwin is a real-time digital twin web application for power transformer condition monitoring. It simulates realistic sensor data from a 100 MVA power transformer, performs industry-standard dissolved gas analysis (DGA) with Duval Triangle fault classification, runs FMEA-based failure mode diagnostics, computes a weighted health score, and provides what-if simulation for operational decision-making. The system streams data over WebSockets, renders an interactive 3D transformer model with thermal overlays, and demonstrates pre-programmed fault scenarios that progress in real time. It is a production-grade proof of concept that mirrors the architecture of enterprise platforms such as GE Vernova's SmartSignal and APM, built to run entirely on a local machine with Python/FastAPI backend and React/TypeScript frontend.

---

## 2. Problem Statement & Business Context

Large power transformers (100+ MVA) are the most critical and expensive single assets on the electrical grid. Each unit costs $3–10M, weighs hundreds of tons, and takes 12–18 months to manufacture. There are no quick replacements. A catastrophic transformer failure causes widespread blackouts affecting thousands of customers, environmental damage from oil spills and potential fires, and total economic losses often exceeding $20M when including replacement costs, lost generation, and regulatory penalties.

Traditional transformer monitoring relies on periodic manual oil sampling (quarterly or annual) and threshold-based alarms that trigger only when a parameter exceeds a fixed limit. This approach has two critical weaknesses. First, faults that develop between sampling intervals go undetected. Second, threshold alarms generate excessive false positives (a reading at 86°C triggers whether the transformer is at 30% load on a cool day — genuinely alarming — or at 95% load on a 40°C day — entirely expected). The result is alarm fatigue and missed faults.

Modern digital twin approaches solve this by modeling expected sensor behavior based on operating conditions and flagging deviations between actual readings and physics-based expectations. A winding temperature that is 8°C above what the thermal model predicts at the current load, ambient temperature, and cooling configuration is an anomaly — regardless of whether it has crossed an absolute threshold. This "actual vs. expected" paradigm is the foundation of GE Vernova's SmartSignal platform and is the core diagnostic approach TransformerTwin implements.

---

## 3. User Personas

### Persona 1: Plant/Asset Manager — "Diana"

**Role:** Manages a fleet of 40+ transformers across a regional utility. Reports to VP of Operations.

**Goals:** Maximize asset availability and uptime. Justify maintenance spending to executives with data. Avoid unplanned outages that trigger regulatory scrutiny.

**Pain Points:** Has no single dashboard showing fleet health. Relies on monthly reports from maintenance team that are already stale. Cannot easily answer "which transformer should we prioritize for inspection next quarter?"

**How TransformerTwin Helps:** The Health Score Dashboard (Section 5, F6) gives Diana an instant summary of transformer condition. The What-If Simulation (F7) lets her model scenarios like "what happens if we defer maintenance and run this unit at 110% for the summer peak?" to make data-driven capital planning decisions.

### Persona 2: Maintenance Engineer — "Carlos"

**Role:** Leads the field crew responsible for transformer maintenance and repair.

**Goals:** Know which transformers need attention before they fail. Arrive on-site with the right diagnosis so repair time is minimized. Avoid unnecessary inspections that waste crew hours.

**Pain Points:** Gets called out for alarms that turn out to be nothing. When a real fault develops, he often lacks the diagnostic context to know what to look for inside the transformer.

**How TransformerTwin Helps:** The Alert System (F9) provides severity-ranked, context-rich alerts instead of raw threshold alarms. The FMEA Failure Mode Analysis (F5) tells Carlos not just that something is wrong, but what specific failure mode is developing, which components are affected, and what corrective actions to take.

### Persona 3: Reliability/Condition Monitoring Specialist — "Priya"

**Role:** DGA analyst and condition monitoring expert. Interprets oil sample results and makes go/no-go recommendations.

**Goals:** Catch developing faults early through gas trend analysis. Accurately classify fault types using DGA methods. Build the business case for predictive maintenance investment.

**Pain Points:** Spends hours in spreadsheets manually plotting gas trends and calculating Duval Triangle coordinates. Results are only as current as the last oil sample (weeks or months old). Has difficulty communicating technical findings to non-specialist managers.

**How TransformerTwin Helps:** The DGA Diagnostics & Duval Triangle (F4) automates gas analysis in real time with continuous online monitoring. The interactive Duval Triangle visualization makes fault classification immediately visual and explainable to any stakeholder.

---

## 4. Product Vision & Success Criteria

### Vision Statement

TransformerTwin demonstrates that a single developer can build a functional, domain-accurate digital twin that implements the same diagnostic principles as enterprise platforms costing millions to develop — using open-source tools, physics-based simulation, and modern web architecture.

### Success Criteria

| Criterion | Measurable Target |
|-----------|------------------|
| 3D model renders and is interactive | Model loads in <3 seconds, orbits/zooms smoothly at ≥30 FPS |
| Real-time data streams without interruption | WebSocket delivers sensor updates at defined intervals (5s/300s/10s/3600s) with <200ms end-to-end latency |
| Fault scenario executes visibly | "Developing Hot Spot" scenario progresses from normal to T2 Duval zone within 2 simulated hours; all UI elements (health score, alerts, DGA panel, 3D heat overlay) update accordingly |
| Duval Triangle is accurate | Given known gas inputs, the plotted point falls in the correct fault zone per IEEE C57.104 Triangle 1 definitions |
| Health score responds correctly | Injecting a DGA Warning state drops health score by exactly 15 points (50 × 0.30); injecting DGA Critical + Cooling Warning drops it by exactly 32 points |
| What-if simulation produces credible projections | Doubling load from 50% to 100% produces approximately a 4× increase in winding temperature rise (quadratic relationship) |
| Domain expert finds it credible | An interviewer with transformer industry experience recognizes the DGA analysis, failure modes, and thermal physics as realistic |

---

## 5. Feature Requirements

### F1: 3D Transformer Visualization

**Feature ID:** F1  
**Priority:** P0

**User Story:** As a maintenance engineer, I want to see an interactive 3D model of the transformer with real-time thermal overlays so that I can quickly identify which physical component has a developing issue.

**Detailed Description:**

Render a simplified but recognizable 3D power transformer model using React Three Fiber. The model must include the following identifiable components: main tank (rectangular body), conservator tank (cylindrical, mounted on top), high-voltage bushings (3 tall cylinders on top — three-phase), low-voltage bushings (3 shorter cylinders on top), radiator fins/banks (flat panels on the sides), cooling fans (discs at radiator base), oil pump (cylinder on side near bottom), tap changer housing (box shape on side), and the Buchholz relay (small cylinder on the pipe between main tank and conservator).

Each component must be a distinct 3D mesh that can be independently colored and selected. The model does not need to be photorealistic — clean, geometric industrial shapes in a dark theme are appropriate.

**Acceptance Criteria:**

1. The 3D scene loads within 3 seconds on an M3 Pro MacBook.
2. The model renders at ≥30 FPS during orbit/zoom/pan interactions.
3. OrbitControls allow full rotation, zoom (scroll), and pan (right-click drag).
4. Each of the following components is a distinct, clickable mesh: tank, conservator, HV bushings (×3), LV bushings (×3), radiator bank (×2), fan bank (×2), oil pump, tap changer, Buchholz relay.
5. Hovering over a component shows a tooltip with the component name.
6. Clicking a component highlights it (emissive glow) and opens a detail panel showing sensors associated with that component.
7. Components change color based on health status using the following mapping: Normal = component base color with no overlay; Caution = blend toward amber (#F59E0B) at 30% opacity; Warning = blend toward orange (#F97316) at 50% opacity; Critical = blend toward red (#EF4444) at 70% opacity with a slow pulse animation (0.5 Hz sinusoidal opacity between 50% and 90%).
8. The scene background is transparent, allowing the application's dark background (#0F172A) to show through.
9. Lighting: one ambient light (intensity 0.4), one directional light (intensity 0.8, position [10, 10, 5]), one hemisphere light (sky: #1E3A5F, ground: #0F172A, intensity 0.3).

**UI/UX Requirements:**

The 3D model occupies the center-left panel of the main layout (approximately 55% of viewport width, full height minus header). A small legend in the bottom-left corner of the 3D viewport shows the color-to-status mapping. Camera reset button (icon) in the top-right of the 3D viewport.

**Data Requirements:**

Receives component health status from the Anomaly Detection Engine (F3) and Health Score computation (F6) via React state/context. Updates whenever new sensor data arrives (every 5 seconds for thermal, every 300 seconds for DGA).

**Edge Cases:**

- WebSocket disconnected: Model remains visible with last-known colors; a "DISCONNECTED" badge appears on the 3D viewport.
- All components normal: All components render in their neutral base colors (steel gray #64748B for tank, copper #B87333 for bushings, dark gray #475569 for radiators).

---

### F2: Real-Time Sensor Data Streaming

**Feature ID:** F2  
**Priority:** P0

**User Story:** As a condition monitoring specialist, I want to see live sensor readings updating in real time so that I can monitor transformer behavior as it happens.

**Detailed Description:**

The backend runs a physics-based transformer simulator that generates correlated sensor data at realistic intervals. Data is streamed to the frontend over a single WebSocket connection. The simulator models the physical relationships described in the Domain Knowledge section — load drives winding temperature quadratically, winding temperature drives top oil temperature with a 30-minute thermal lag, ambient temperature follows a daily sinusoidal cycle, and DGA gas generation rates depend exponentially on temperature.

The simulator supports a configurable time acceleration factor (1× = real-time, 10× = 10 seconds of sim time per 1 second of wall time, up to 60×). At 60×, one simulated hour passes in one real minute.

**Sensor update intervals (at 1× speed):**

| Group | Sensors | Interval | WebSocket Message Type |
|-------|---------|----------|----------------------|
| Thermal/Electrical | TOP_OIL_TEMP, BOT_OIL_TEMP, WINDING_TEMP, LOAD_CURRENT, AMBIENT_TEMP | 5 seconds | `sensor_update` |
| DGA | DGA_H2, DGA_CH4, DGA_C2H6, DGA_C2H4, DGA_C2H2, DGA_CO, DGA_CO2 | 300 seconds | `sensor_update` |
| Equipment Status | FAN_BANK_1, FAN_BANK_2, OIL_PUMP_1, TAP_POSITION, TAP_OP_COUNT | 10 seconds | `sensor_update` |
| Slow Diagnostics | OIL_MOISTURE, OIL_DIELECTRIC, BUSHING_CAP_HV, BUSHING_CAP_LV | 3600 seconds | `sensor_update` |

**Acceptance Criteria:**

1. WebSocket connects within 2 seconds of page load.
2. The first `sensor_update` message arrives within 1 second of connection.
3. Sensor values obey the physics correlations defined in Domain Knowledge: winding temperature rise is proportional to load² (within ±5% of the formula `winding_temp_rise = k × load_fraction² × 55`); top oil temperature lags winding temperature with τ ≈ 1800 seconds; top-bottom oil gradient is 15–25°C during normal operation.
4. Load follows the weekday pattern: 35% at 3 AM, ramp to 85% at 2 PM, down to 50% by 10 PM. Weekend load is flat at 50–60%. Random noise of ±5% is added.
5. Ambient temperature follows a daily sinusoidal cycle with low at 5 AM and peak at 3 PM, amplitude 10°C, with a configurable seasonal baseline (summer default: 30°C).
6. DGA gases under normal operation remain within Normal ranges per the sensor table. Gas generation rates increase when hot spot temperature exceeds 150°C.
7. Cooling system activates automatically: Fan Bank 1 ON when TOP_OIL_TEMP > 65°C; Fan Bank 2 ON when TOP_OIL_TEMP > 75°C; Oil Pump ON when LOAD_CURRENT > 70% OR TOP_OIL_TEMP > 80°C.
8. Cooling effect reduces target oil temperature by the cooling factor: ONAN = 1.0, ONAF = 0.7, OFAF = 0.5. Cooling takes 5 minutes (300 seconds) to reach full effect (exponential ramp).
9. If WebSocket disconnects, the frontend retries connection with exponential backoff: 1s, 2s, 4s, 8s, max 30s. A reconnection banner is shown.
10. The backend stores all sensor readings in SQLite for historical playback (F8).

**UI/UX Requirements:**

A compact sensor ticker/panel on the right side of the layout shows current values for all sensors, grouped by category. Each value displays: sensor name, current value with unit, a colored status dot (green/amber/orange/red per the threshold table), and a sparkline showing the last 60 readings. A connection status indicator (green dot = connected, red dot with "Reconnecting…" = disconnected) is always visible in the header.

**Data Requirements:**

The backend simulator is the sole data source. The frontend must not generate or extrapolate sensor data — all values come from the server.

**Edge Cases:**

- Time acceleration change mid-stream: Backend adjusts interval timing; frontend buffers and renders at display rate (max 1 UI update per second regardless of sim speed).
- Browser tab backgrounded: WebSocket stays open. On tab refocus, the latest state is displayed immediately (no backfill of missed frames to the chart — just snap to current).

---

### F3: Anomaly Detection Engine

**Feature ID:** F3  
**Priority:** P0

**User Story:** As a reliability engineer, I want the system to detect when sensor readings deviate from physics-based expectations so that I can identify developing faults before they reach alarm thresholds.

**Detailed Description:**

The anomaly detection engine computes an expected value for each thermal sensor based on current operating conditions and flags readings that deviate beyond a configurable threshold. This is the "actual vs. expected" approach used by GE SmartSignal.

**Expected value calculations:**

- **Expected Winding Temperature:** `expected_winding = ambient + 55 × (load_fraction)² × cooling_factor` where cooling_factor is 1.0 (ONAN), 0.7 (ONAF), 0.5 (OFAF).
- **Expected Top Oil Temperature:** `expected_top_oil = ambient + 40 × (load_fraction)^0.8 × cooling_factor`, with a thermal lag modeled as an exponential moving average with τ = 1800s.
- **Expected Bottom Oil Temperature:** `expected_bot_oil = expected_top_oil - 20` (±5°C normal range for the gradient).
- **Expected DGA gases:** Baseline values established from the first 30 minutes of operation. Anomaly if any gas exceeds baseline + 2× standard deviation of the baseline period, or if the rate of change exceeds 10% per day.

**Anomaly severity classification:**

| Deviation | Severity | Action |
|-----------|----------|--------|
| Actual within ±5% of expected | NORMAL | None |
| Actual 5–15% above expected | CAUTION | Log anomaly, no alert |
| Actual 15–30% above expected | WARNING | Generate warning alert |
| Actual >30% above expected | CRITICAL | Generate critical alert |

For DGA gases, severity is determined by the absolute thresholds in the sensor table (Normal/Caution/Warning/Critical ppm ranges) AND by rate of change.

**Acceptance Criteria:**

1. Expected values are computed on every thermal sensor update (every 5 simulated seconds).
2. A 15% deviation in winding temperature from expected generates a WARNING anomaly within one sensor update cycle.
3. Anomaly events are persisted to SQLite with: timestamp, sensor_id, actual_value, expected_value, deviation_percent, severity.
4. DGA anomalies are evaluated on every DGA update (every 300 simulated seconds) using both absolute thresholds and rate-of-change analysis.
5. The anomaly engine does not generate false positives during the "Normal Operation" scenario (Scenario 4) over a full 24-hour simulated cycle.
6. During the "Developing Hot Spot" scenario, the engine flags winding temperature anomaly within the first simulated hour.

**UI/UX Requirements:**

No dedicated UI panel — anomaly results feed into the Health Score (F6), Alerts (F9), and 3D model overlays (F1).

**Data Requirements:**

Consumes sensor_update messages from the simulator. Writes anomaly_event records to the database.

**Edge Cases:**

- Cold start (no baseline): Use the first 10 minutes of readings to establish baseline. During this window, anomaly detection operates in "learning" mode and generates no alerts.
- Rapid load changes: Apply a deadband of 2 minutes after a load change >10% to avoid false anomalies during transients.

---

### F4: DGA Diagnostics & Duval Triangle

**Feature ID:** F4  
**Priority:** P0

**User Story:** As a DGA analyst, I want to see real-time dissolved gas analysis with Duval Triangle fault classification so that I can identify the type and severity of any developing transformer fault.

**Detailed Description:**

This feature implements three DGA diagnostic methods:

**4a. Individual Gas Trending:**

Display time-series charts for all 7 DGA gases with threshold bands. Each gas chart shows: current value (ppm), threshold zones as colored horizontal bands (Normal = green background, Caution = yellow, Warning = orange, Critical = red), and a trend line over the selected time window.

**4b. Duval Triangle (Triangle 1):**

An interactive ternary diagram that plots the current fault classification based on three gases: CH₄, C₂H₄, and C₂H₂.

Implementation: Convert gas concentrations to percentages:
```
sum = CH4 + C2H4 + C2H2
pct_CH4 = (CH4 / sum) × 100
pct_C2H4 = (C2H4 / sum) × 100
pct_C2H2 = (C2H2 / sum) × 100
```

The triangle is rendered as an SVG or canvas element with these fault zones defined as polygons (vertices in % coordinates [%CH4, %C2H4, %C2H2]):

| Zone | Label | Color | Approximate Vertices |
|------|-------|-------|---------------------|
| PD | Partial Discharge | #3B82F6 (blue) | CH₄>98, C₂H₄<2, C₂H₂≈0 |
| T1 | Thermal <300°C | #22C55E (green) | High CH₄ (76–98), low C₂H₄ (<20), low C₂H₂ (<4) |
| T2 | Thermal 300–700°C | #EAB308 (yellow) | Medium CH₄ (46–76), medium C₂H₄ (20–50), low C₂H₂ (<4) |
| T3 | Thermal >700°C | #F97316 (orange) | Low CH₄ (<50), high C₂H₄ (>50), low C₂H₂ (<15) |
| D1 | Low Energy Discharge | #A855F7 (purple) | Low CH₄ (<23), low C₂H₄ (<23), high C₂H₂ (>13) |
| D2 | High Energy Discharge | #EF4444 (red) | Low CH₄ (<23), medium C₂H₄ (<40), very high C₂H₂ (>29) |
| DT | Mixed Discharge+Thermal | #F59E0B (amber) | Intermediate zone between D and T regions |

For implementation, define each zone as a polygon in the ternary coordinate system and use point-in-polygon testing to classify the current operating point. The exact polygon vertices should be derived from the standard Duval Triangle 1 as published in IEC 60599. A reasonable approximation using the boundaries above is acceptable for the POC.

**4c. Summary Diagnostics:**

- **TDCG (Total Dissolved Combustible Gas):** Sum of H₂ + CH₄ + C₂H₆ + C₂H₄ + C₂H₂ + CO. Status: Normal (<720), Caution (720–1920), Warning (1920–4630), Critical (>4630).
- **CO₂/CO Ratio:** Current ratio displayed with interpretation: <3 = "Fault involving cellulose — serious", 3–10 = "Possible paper involvement", >10 = "Normal paper aging".
- **Gas Generation Rate:** Computed as (current_value − value_24h_ago) / 1 day, expressed in ppm/day for each gas.

**Acceptance Criteria:**

1. Gas trend charts display the last 2 hours of DGA data at minimum, with smooth line rendering (no jagged steps visible).
2. Threshold bands are accurately drawn at the exact ppm values from the sensor specification table.
3. The Duval Triangle renders as an equilateral triangle with all 7 fault zones visually distinguishable.
4. A dot on the Duval Triangle updates its position every time new DGA data arrives (every 300 simulated seconds).
5. The current zone label (e.g., "T1 — Thermal Fault <300°C") is displayed below the triangle.
6. Hovering over the dot shows: %CH₄, %C₂H₄, %C₂H₂, and the zone classification.
7. During normal operation, the Duval Triangle dot is in the PD or T1 zone (or off-chart if sum is near zero). During the "Developing Hot Spot" scenario, the dot transitions from T1 → T2 over 2 simulated hours.
8. TDCG is computed correctly and displayed with its status level.
9. CO₂/CO ratio is displayed with the correct interpretation text.
10. If the sum of the three Duval gases is 0, display "Insufficient data for Duval analysis" instead of plotting.

**UI/UX Requirements:**

The DGA panel is located in a tabbed section of the right sidebar or bottom panel. It has three sub-tabs: "Gas Trends" (time-series charts), "Duval Triangle" (ternary diagram), and "Summary" (TDCG, CO₂/CO ratio, generation rates table). The Duval Triangle should be at least 300×300 pixels for readability.

**Data Requirements:**

Consumes DGA sensor_update messages (every 300 simulated seconds). Requires at least 2 data points to compute generation rates.

**Edge Cases:**

- All DGA gases at 0 ppm: Show "No dissolved gases detected — new oil or recently degassed" message.
- CH₄ + C₂H₄ + C₂H₂ = 0: Do not plot on Duval Triangle; show "Insufficient data."
- Gas value exceeds chart Y-axis range: Auto-scale Y-axis with 20% headroom above the max value.

---

### F5: Failure Mode Analysis (FMEA)

**Feature ID:** F5  
**Priority:** P0

**User Story:** As a maintenance engineer, I want the system to match current sensor patterns against known transformer failure modes so that I receive a specific diagnosis with recommended actions, not just raw alarms.

**Detailed Description:**

The FMEA engine evaluates current sensor data and anomaly states against 8 pre-defined failure modes (FM-001 through FM-008 from Domain Knowledge). Each failure mode has a defined sensor signature. The engine scores the probability of each failure mode being active based on how well the current data matches the signature.

**Matching logic for each failure mode:**

Each failure mode defines a set of conditions. Each condition is evaluated as a boolean (met/not met) or as a match percentage. The failure mode's overall match score is the weighted average of its condition scores.

Example for FM-001 (Winding Hot Spot):
- Condition 1 (weight 0.3): Winding temp > expected by > 15% → match score: (deviation% - 5) / 25, clamped to [0, 1]
- Condition 2 (weight 0.3): CH₄ above Caution threshold (75 ppm) → match score: min(CH₄ / 75, 1)
- Condition 3 (weight 0.2): C₂H₄ above Caution threshold (50 ppm) → match score: min(C₂H₄ / 50, 1)
- Condition 4 (weight 0.1): H₂ above Caution threshold (100 ppm) → match score: min(H₂ / 100, 1)
- Condition 5 (weight 0.1): Duval zone is T1, T2, or T3 → binary 0 or 1

Overall FM-001 score = Σ(condition_score × weight). If score > 0.4, display the failure mode as "Possible." If score > 0.7, display as "Probable."

The system displays failure mode diagnostic cards ranked by match score (highest first). Only failure modes with score > 0.3 are displayed.

**Each diagnostic card shows:**
- Failure mode name and ID
- Match confidence as a percentage and progress bar
- Severity rating (1–10 scale with color)
- Affected components (highlighted on 3D model when card is selected)
- Current sensor evidence (which conditions matched and their values)
- Recommended actions (ordered list)
- Typical development timeline

**Acceptance Criteria:**

1. All 8 failure modes from Domain Knowledge are implemented with scoring logic.
2. During the "Developing Hot Spot" scenario, FM-001 appears as "Possible" (score > 0.4) within 1 simulated hour and "Probable" (score > 0.7) within 1.5 simulated hours.
3. During the "Arcing Event" scenario, FM-003 appears as "Probable" within 10 simulated minutes.
4. During normal operation, no failure mode exceeds a score of 0.3.
5. Clicking a failure mode card highlights the affected components on the 3D model.
6. Failure mode cards display all fields listed above.
7. Cards are sorted by match score descending.

**UI/UX Requirements:**

Failure mode cards are displayed in a scrollable panel, either as a tab in the right sidebar or in a bottom drawer. Each card is collapsible — showing just the name, score, and severity when collapsed, and full details when expanded.

**Data Requirements:**

Consumes anomaly events from F3, DGA analysis from F4, and current sensor values from F2.

**Edge Cases:**

- Multiple failure modes active simultaneously: Display all that exceed the 0.3 threshold, sorted by score.
- No failure modes match: Display "No active failure mode signatures detected — transformer operating normally."

---

### F6: Health Score Dashboard

**Feature ID:** F6  
**Priority:** P0

**User Story:** As a plant manager, I want a single number that summarizes overall transformer health so that I can make quick decisions about which assets need attention.

**Detailed Description:**

Compute a composite health score (0–100) using the weighted formula from Domain Knowledge:

```
Health = 100 - Σ(component_penalty × component_weight)

Component Weights:
  DGA_STATUS:          0.30
  WINDING_TEMP_STATUS: 0.25
  OIL_TEMP_STATUS:     0.15
  COOLING_STATUS:      0.10
  OIL_QUALITY_STATUS:  0.10
  BUSHING_STATUS:      0.10

Penalty Points:
  Normal:    0
  Caution:  20
  Warning:  50
  Critical: 90
```

**Component status determination:**

- **DGA_STATUS:** Worst status among all 7 DGA gases based on their individual thresholds. If any single gas is Critical, DGA_STATUS = Critical.
- **WINDING_TEMP_STATUS:** Based on WINDING_TEMP thresholds (Normal ≤95, Caution 95–110, Critical >110) AND anomaly severity (if anomaly detection flags WARNING or CRITICAL, elevate status by one level).
- **OIL_TEMP_STATUS:** Based on TOP_OIL_TEMP thresholds (Normal ≤75, Caution 75–85, Critical >85).
- **COOLING_STATUS:** Normal if all cooling equipment is functioning as expected (fans/pumps ON when conditions require them). Warning if any equipment is OFF when it should be ON. Critical if multiple equipment failures.
- **OIL_QUALITY_STATUS:** Worst of OIL_MOISTURE status (Normal <20, Warning 20–35, Critical >35) and OIL_DIELECTRIC status (Normal >40, Warning 30–40, Critical <30).
- **BUSHING_STATUS:** Worst of HV and LV bushing capacitance deviation from baseline (Normal <3%, Warning 3–5%, Critical >5%).

**Acceptance Criteria:**

1. Health score displays as a large circular gauge (0–100) with color: green (≥80), amber (60–79), orange (40–59), red (<40).
2. Score updates within 1 second of receiving new sensor data.
3. Verified examples:
   - All Normal → Health = 100. Displayed as 92–96 during simulation due to minor variance deductions.
   - DGA Warning only → Health = 100 - (50 × 0.30) = 85.
   - DGA Critical + Cooling Warning → Health = 100 - (90 × 0.30 + 50 × 0.10) = 68.
   - DGA Critical + Winding Critical → Health = 100 - (90 × 0.30 + 90 × 0.25) = 50.5.
4. A breakdown bar chart shows each component's contribution to the health score.
5. A trend line shows health score over the last 2 hours.
6. The score during the "Normal Operation" scenario stays between 90 and 96 for the full 24-hour cycle.

**UI/UX Requirements:**

The health score gauge is prominently displayed in the top-right area or header of the application. The gauge is at least 150×150 pixels. Below the gauge, a small horizontal stacked bar shows each component's weight and status color. Below that, a compact trend sparkline shows the score over time.

**Data Requirements:**

Consumes: all sensor values (for threshold comparison), anomaly events (for anomaly-adjusted status), equipment status (for cooling evaluation). Produces: health_score_record written to SQLite every time the score changes.

**Edge Cases:**

- Health score exactly 0: Clamp display to 0. This would mean every component is Critical.
- Score increases (fault clears): Score increases smoothly. The gauge animates the change.

---

### F7: What-If Simulation

**Feature ID:** F7  
**Priority:** P1

**User Story:** As a plant manager, I want to model hypothetical operating scenarios so that I can evaluate the impact of operational decisions on transformer health and remaining life.

**Detailed Description:**

The What-If panel allows the user to adjust four input parameters and see projected transformer behavior over a configurable time horizon.

**Input Parameters:**

| Parameter | Control | Range | Default | Step |
|-----------|---------|-------|---------|------|
| Load Level | Slider | 0–150% | Current actual value | 1% |
| Ambient Temperature | Slider | -10 to 50°C | Current actual value | 1°C |
| Cooling Mode | Dropdown | ONAN / ONAF / OFAF | Current actual mode | — |
| Time Horizon | Slider | 1–30 days | 7 days | 1 day |

**Output Projections (computed by backend):**

1. **Projected Hot Spot Temperature:** Using `hotspot = ambient + 55 × (load_fraction)² × cooling_factor`. Displayed as a single number and on a projection chart.
2. **Projected Top Oil Temperature:** Using `top_oil = ambient + 40 × (load_fraction)^0.8 × cooling_factor`. Displayed similarly.
3. **Insulation Aging Acceleration Factor:** `aging_factor = 2^((hotspot - 98) / 6.5)`. Displayed as "Xg aging acceleration" with interpretation: 1× = normal (30-year design life), 2× = 15-year equivalent, 4× = 7.5-year, 10× = emergency.
4. **Estimated Days to Warning:** If current gas generation rates are >0, extrapolate: `days = (warning_threshold - current_value) / daily_generation_rate`. Take the minimum across all gases. If no active generation, display "No active degradation trend."
5. **Cooling Energy Impact:** Relative metric comparing projected cooling mode energy to current: "X% more/less cooling energy." ONAN = 0 (baseline), ONAF = 100% (fans running), OFAF = 250% (fans + pumps). Display difference from current.

**Acceptance Criteria:**

1. Adjusting the Load slider from 50% to 100% produces approximately 4× the winding temperature rise (quadratic relationship: (1.0/0.5)² = 4).
2. At a projected hotspot of 98°C, aging factor = 1.0×. At 111°C, aging factor = 4.0×. At 120°C, aging factor ≈ 10×.
3. Switching cooling from ONAN to OFAF reduces projected top oil temperature by approximately 50% of the oil temperature rise above ambient.
4. Projection chart shows projected temperature trajectories over the selected time horizon with day/night cycles applied to ambient temperature.
5. All four input controls update projections within 500ms (no full page reload).
6. A "Reset to Current" button restores all inputs to actual current values.

**UI/UX Requirements:**

What-If panel is a dedicated tab or collapsible side panel. Inputs are at the top, outputs below. The projection chart takes up the lower half of the panel (at least 400×250 pixels). Results include both numeric values and a time-series projection chart.

**Data Requirements:**

Sends a simulation request to the backend REST API (see Section 7, `POST /api/simulation`). The backend computes projections using the same physics models as the simulator but with the user's adjusted parameters.

**Edge Cases:**

- Load > 100%: Valid scenario (overloading). Aging factor increases dramatically. Display a red warning: "Operating above rated load. Accelerated aging."
- All gases at 0 with no generation rate: "Days to Warning" shows "N/A — no active degradation."
- Extreme inputs (150% load + 50°C ambient + ONAN): Let the model compute; projected hotspot will be extremely high. Display results with prominent warning.

---

### F8: Historical Playback

**Feature ID:** F8  
**Priority:** P1

**User Story:** As a condition monitoring specialist, I want to replay historical data to study how a fault developed over time so that I can refine diagnostic criteria.

**Detailed Description:**

A time slider at the bottom of the application allows the user to scrub back through stored sensor data and replay the system state at any historical point. During playback, all UI components (3D model colors, charts, health score, Duval Triangle, FMEA cards) update to reflect the state at the selected time.

**Acceptance Criteria:**

1. A horizontal time slider spans the bottom of the screen showing the full range of stored data (up to the last 24 simulated hours).
2. Dragging the slider to a past time reconstructs: all sensor values, health score, anomaly states, alert states, Duval Triangle position, and FMEA scores for that timestamp.
3. A "Play" button starts automatic playback from the slider position at a configurable speed (1×, 10×, 30×, 60×).
4. A "Live" button snaps back to real-time streaming.
5. During playback, the live WebSocket stream continues in the background; the display just shows historical state.
6. The time slider shows key events (alerts, scenario triggers) as colored markers on the timeline.

**UI/UX Requirements:**

The time slider is a thin persistent bar at the very bottom of the viewport, above any status bar. It is always visible. When not in playback mode, the slider's handle sits at the far right ("now"). Alert markers on the timeline are small colored triangles (green = info, amber = warning, red = critical).

**Data Requirements:**

Reads historical data from SQLite via the REST API (see Section 7, `GET /api/history`). Requires that F2's data streaming has been writing to the database.

**Edge Cases:**

- No historical data (just started): Slider is empty. Show message "Collecting data…" for the first 5 minutes.
- User scrubs to a time before DGA data exists (DGA updates every 300s): Show "Awaiting DGA sample" for DGA-dependent displays.

---

### F9: Alert System

**Feature ID:** F9  
**Priority:** P0

**User Story:** As a maintenance engineer, I want clear, prioritized alerts with actionable context so that I know exactly what is happening and what to do about it.

**Detailed Description:**

Alerts are generated by the Anomaly Detection Engine (F3) and the FMEA engine (F5). Each alert includes: timestamp, severity (INFO/WARNING/CRITICAL), title, description, affected sensor(s), recommended actions, and acknowledgment status.

**Alert generation rules:**

- Anomaly WARNING → generates WARNING alert with sensor context.
- Anomaly CRITICAL → generates CRITICAL alert.
- FMEA score > 0.7 for any failure mode → generates WARNING or CRITICAL alert (based on the failure mode's severity rating: severity ≥ 8 → CRITICAL, else WARNING).
- Cooling equipment unexpected OFF → generates WARNING alert.
- C₂H₂ (acetylene) > 2 ppm → generates CRITICAL alert immediately (arcing indicator).
- Health score drops below 70 → generates WARNING alert. Below 50 → CRITICAL.

**Alert deduplication:** Do not generate a new alert for the same condition within 5 minutes (simulated time). After 5 minutes, if the condition persists, generate a follow-up alert with updated values.

**Acceptance Criteria:**

1. An alert feed panel displays alerts in reverse chronological order (newest first).
2. Each alert shows: colored severity badge (WARNING = #F59E0B amber, CRITICAL = #EF4444 red, INFO = #3B82F6 blue), timestamp, title, and a truncated description. Clicking expands to show full description, sensor values, and recommended actions.
3. Unacknowledged alerts show a pulsing dot indicator.
4. The header shows an alert count badge (e.g., "3 active alerts") colored by the highest severity.
5. During the "Arcing Event" scenario, a CRITICAL alert is generated within 2 simulated minutes of the acetylene spike.
6. During normal operation (Scenario 4), zero WARNING or CRITICAL alerts are generated over 24 simulated hours.
7. On the 3D model (F1), when a CRITICAL alert is active, the affected component pulses red.
8. Alert history is persisted and available in the Historical Playback (F8).

**UI/UX Requirements:**

The alert feed is in a narrow panel on the right side or as a slide-out drawer triggered by clicking the alert badge in the header. Maximum 50 alerts displayed (oldest auto-purged from the view, not from the database).

**Data Requirements:**

Consumes anomaly events and FMEA results. Writes alert records to SQLite. Sends new alerts to the frontend via a WebSocket `alert` message type.

**Edge Cases:**

- Alert storm (many alerts in quick succession): Apply deduplication. Group related alerts under a single parent alert with a count badge (e.g., "3 related thermal alerts").
- All alerts acknowledged: Show "No active alerts" with a green checkmark.

---

## 6. Complete Data Model

All data is stored in SQLite. Field types use SQLite-compatible types.

### 6.1 Transformer Asset Configuration

```json
{
  "table": "transformer_config",
  "description": "Static configuration for the transformer being monitored",
  "fields": {
    "id": { "type": "TEXT", "pk": true, "example": "TRF-001" },
    "name": { "type": "TEXT", "required": true, "example": "Main Power Transformer Unit 1" },
    "manufacturer": { "type": "TEXT", "example": "GE Vernova" },
    "rating_mva": { "type": "REAL", "required": true, "example": 100.0 },
    "voltage_hv_kv": { "type": "REAL", "example": 230.0 },
    "voltage_lv_kv": { "type": "REAL", "example": 69.0 },
    "cooling_type": { "type": "TEXT", "example": "ONAN/ONAF/OFAF" },
    "year_manufactured": { "type": "INTEGER", "example": 2005 },
    "oil_volume_liters": { "type": "REAL", "example": 45000.0 },
    "location": { "type": "TEXT", "example": "Substation Alpha, Bay 3" }
  }
}
```

### 6.2 Sensor Reading

```json
{
  "table": "sensor_readings",
  "description": "Time-series sensor data from the simulator",
  "fields": {
    "id": { "type": "INTEGER", "pk": true, "autoincrement": true },
    "timestamp": { "type": "TEXT (ISO 8601)", "required": true, "indexed": true, "example": "2026-03-20T14:30:05Z" },
    "sensor_id": { "type": "TEXT", "required": true, "indexed": true, "example": "TOP_OIL_TEMP" },
    "value": { "type": "REAL", "required": true, "example": 72.3 },
    "unit": { "type": "TEXT", "required": true, "example": "°C" },
    "quality": { "type": "TEXT", "default": "GOOD", "example": "GOOD", "description": "GOOD | SUSPECT | BAD" },
    "sim_time": { "type": "REAL", "required": true, "description": "Simulation time in seconds since start", "example": 3605.0 }
  },
  "indexes": ["CREATE INDEX idx_readings_time ON sensor_readings(timestamp)", "CREATE INDEX idx_readings_sensor ON sensor_readings(sensor_id, timestamp)"]
}
```

### 6.3 Anomaly Event

```json
{
  "table": "anomaly_events",
  "description": "Detected deviations from expected values",
  "fields": {
    "id": { "type": "INTEGER", "pk": true, "autoincrement": true },
    "timestamp": { "type": "TEXT (ISO 8601)", "required": true, "example": "2026-03-20T15:02:10Z" },
    "sensor_id": { "type": "TEXT", "required": true, "example": "WINDING_TEMP" },
    "actual_value": { "type": "REAL", "required": true, "example": 108.5 },
    "expected_value": { "type": "REAL", "required": true, "example": 94.2 },
    "deviation_percent": { "type": "REAL", "required": true, "example": 15.2 },
    "severity": { "type": "TEXT", "required": true, "example": "WARNING", "description": "NORMAL | CAUTION | WARNING | CRITICAL" },
    "sim_time": { "type": "REAL", "required": true, "example": 7330.0 }
  }
}
```

### 6.4 Alert

```json
{
  "table": "alerts",
  "description": "Alerts generated by the anomaly and FMEA engines",
  "fields": {
    "id": { "type": "INTEGER", "pk": true, "autoincrement": true },
    "timestamp": { "type": "TEXT (ISO 8601)", "required": true, "example": "2026-03-20T15:02:15Z" },
    "severity": { "type": "TEXT", "required": true, "example": "CRITICAL", "description": "INFO | WARNING | CRITICAL" },
    "title": { "type": "TEXT", "required": true, "example": "Winding Temperature Anomaly Detected" },
    "description": { "type": "TEXT", "required": true, "example": "Winding hot spot temperature is 15.2% above expected value. Actual: 108.5°C, Expected: 94.2°C at current load (78%) and ambient (32°C)." },
    "source": { "type": "TEXT", "required": true, "example": "ANOMALY_ENGINE", "description": "ANOMALY_ENGINE | FMEA_ENGINE | THRESHOLD" },
    "sensor_ids": { "type": "TEXT (JSON array)", "example": "[\"WINDING_TEMP\"]" },
    "failure_mode_id": { "type": "TEXT", "nullable": true, "example": "FM-001" },
    "recommended_actions": { "type": "TEXT (JSON array)", "example": "[\"Reduce load to 70%\", \"Verify cooling system operation\", \"Schedule thermal imaging inspection\"]" },
    "acknowledged": { "type": "INTEGER (boolean)", "default": 0, "example": 0 },
    "acknowledged_at": { "type": "TEXT (ISO 8601)", "nullable": true },
    "sim_time": { "type": "REAL", "required": true, "example": 7335.0 }
  }
}
```

### 6.5 Failure Mode Definition

```json
{
  "table": "failure_modes",
  "description": "Static definitions of known transformer failure modes",
  "fields": {
    "id": { "type": "TEXT", "pk": true, "example": "FM-001" },
    "name": { "type": "TEXT", "required": true, "example": "Winding Hot Spot" },
    "description": { "type": "TEXT", "required": true, "example": "Localized overheating in windings due to blocked cooling ducts, short-circuited turns, or overloading" },
    "affected_components": { "type": "TEXT (JSON array)", "example": "[\"windings\", \"oil\"]" },
    "severity": { "type": "INTEGER", "required": true, "example": 8, "description": "1–10 scale" },
    "development_time": { "type": "TEXT", "example": "Days to weeks" },
    "recommended_actions": { "type": "TEXT (JSON array)", "example": "[\"Reduce load\", \"Check cooling system\", \"Schedule internal inspection\"]" },
    "conditions": { "type": "TEXT (JSON)", "description": "Scoring conditions as JSON. See F5 for structure." }
  }
}
```

### 6.6 Health Score Record

```json
{
  "table": "health_scores",
  "description": "Historical health score snapshots",
  "fields": {
    "id": { "type": "INTEGER", "pk": true, "autoincrement": true },
    "timestamp": { "type": "TEXT (ISO 8601)", "required": true, "example": "2026-03-20T15:05:00Z" },
    "overall_score": { "type": "REAL", "required": true, "example": 85.0 },
    "dga_status": { "type": "TEXT", "required": true, "example": "WARNING" },
    "winding_temp_status": { "type": "TEXT", "required": true, "example": "NORMAL" },
    "oil_temp_status": { "type": "TEXT", "required": true, "example": "NORMAL" },
    "cooling_status": { "type": "TEXT", "required": true, "example": "NORMAL" },
    "oil_quality_status": { "type": "TEXT", "required": true, "example": "NORMAL" },
    "bushing_status": { "type": "TEXT", "required": true, "example": "NORMAL" },
    "component_details": { "type": "TEXT (JSON)", "description": "Full breakdown of each component penalty", "example": "{\"dga\": {\"status\": \"WARNING\", \"penalty\": 50, \"weight\": 0.30, \"contribution\": 15.0}}" },
    "sim_time": { "type": "REAL", "required": true, "example": 9100.0 }
  }
}
```

### 6.7 Simulation Request/Response

These are not stored in the database — they are transient REST API request/response payloads.

**Request:**
```json
{
  "load_percent": 95.0,
  "ambient_temp_c": 35.0,
  "cooling_mode": "ONAF",
  "time_horizon_days": 14
}
```

**Response:**
```json
{
  "projected_hotspot_temp_c": 118.5,
  "projected_top_oil_temp_c": 82.3,
  "aging_acceleration_factor": 8.57,
  "aging_interpretation": "Aging 8.6x faster than normal — significantly reduces remaining life",
  "estimated_days_to_warning": 45.2,
  "cooling_energy_impact_percent": -30.0,
  "cooling_energy_interpretation": "30% less cooling energy than current OFAF mode",
  "projection_timeline": [
    {
      "day": 1,
      "hotspot_temp_c": 118.5,
      "top_oil_temp_c": 82.3,
      "aging_factor": 8.57
    }
  ]
}
```

---

## 7. API Contract

### 7.1 REST API Endpoints

**Base URL:** `http://localhost:8000/api`

#### GET /api/transformer

Returns the transformer configuration.

**Response (200):**
```json
{
  "id": "TRF-001",
  "name": "Main Power Transformer Unit 1",
  "manufacturer": "GE Vernova",
  "rating_mva": 100.0,
  "voltage_hv_kv": 230.0,
  "voltage_lv_kv": 69.0,
  "cooling_type": "ONAN/ONAF/OFAF",
  "year_manufactured": 2005,
  "oil_volume_liters": 45000.0,
  "location": "Substation Alpha, Bay 3"
}
```

#### GET /api/sensors/current

Returns the latest reading for all sensors.

**Response (200):**
```json
{
  "timestamp": "2026-03-20T15:30:05Z",
  "sim_time": 12605.0,
  "sensors": {
    "TOP_OIL_TEMP": { "value": 72.3, "unit": "°C", "status": "NORMAL" },
    "BOT_OIL_TEMP": { "value": 54.1, "unit": "°C", "status": "NORMAL" },
    "WINDING_TEMP": { "value": 91.2, "unit": "°C", "status": "NORMAL" },
    "LOAD_CURRENT": { "value": 78.0, "unit": "%", "status": "NORMAL" },
    "AMBIENT_TEMP": { "value": 30.5, "unit": "°C", "status": "NORMAL" },
    "DGA_H2": { "value": 45.0, "unit": "ppm", "status": "NORMAL" },
    "DGA_CH4": { "value": 22.0, "unit": "ppm", "status": "NORMAL" },
    "DGA_C2H6": { "value": 15.0, "unit": "ppm", "status": "NORMAL" },
    "DGA_C2H4": { "value": 8.0, "unit": "ppm", "status": "NORMAL" },
    "DGA_C2H2": { "value": 0.5, "unit": "ppm", "status": "NORMAL" },
    "DGA_CO": { "value": 200.0, "unit": "ppm", "status": "NORMAL" },
    "DGA_CO2": { "value": 1800.0, "unit": "ppm", "status": "NORMAL" },
    "FAN_BANK_1": { "value": 1, "unit": "boolean", "status": "ON" },
    "FAN_BANK_2": { "value": 0, "unit": "boolean", "status": "OFF" },
    "OIL_PUMP_1": { "value": 1, "unit": "boolean", "status": "ON" },
    "TAP_POSITION": { "value": 17, "unit": "position", "status": "NORMAL" },
    "TAP_OP_COUNT": { "value": 23456, "unit": "count", "status": "NORMAL" },
    "OIL_MOISTURE": { "value": 12.0, "unit": "ppm", "status": "NORMAL" },
    "OIL_DIELECTRIC": { "value": 52.0, "unit": "kV", "status": "NORMAL" },
    "BUSHING_CAP_HV": { "value": 500.2, "unit": "pF", "status": "NORMAL" },
    "BUSHING_CAP_LV": { "value": 420.1, "unit": "pF", "status": "NORMAL" }
  }
}
```

#### GET /api/sensors/history?sensor_id={id}&from={iso}&to={iso}&limit={n}

Returns historical readings for a sensor within a time range.

**Query Parameters:**
- `sensor_id` (required): e.g., "TOP_OIL_TEMP"
- `from` (optional): ISO 8601 start time. Default: 2 hours ago.
- `to` (optional): ISO 8601 end time. Default: now.
- `limit` (optional): Max number of readings. Default: 1000.

**Response (200):**
```json
{
  "sensor_id": "TOP_OIL_TEMP",
  "unit": "°C",
  "readings": [
    { "timestamp": "2026-03-20T13:30:05Z", "value": 68.1, "sim_time": 5405.0 },
    { "timestamp": "2026-03-20T13:30:10Z", "value": 68.3, "sim_time": 5410.0 }
  ]
}
```

#### GET /api/health

Returns current health score and component breakdown.

**Response (200):**
```json
{
  "timestamp": "2026-03-20T15:30:00Z",
  "overall_score": 85.0,
  "status": "GOOD",
  "components": {
    "dga": { "status": "WARNING", "penalty": 50, "weight": 0.30, "contribution": 15.0 },
    "winding_temp": { "status": "NORMAL", "penalty": 0, "weight": 0.25, "contribution": 0.0 },
    "oil_temp": { "status": "NORMAL", "penalty": 0, "weight": 0.15, "contribution": 0.0 },
    "cooling": { "status": "NORMAL", "penalty": 0, "weight": 0.10, "contribution": 0.0 },
    "oil_quality": { "status": "NORMAL", "penalty": 0, "weight": 0.10, "contribution": 0.0 },
    "bushing": { "status": "NORMAL", "penalty": 0, "weight": 0.10, "contribution": 0.0 }
  }
}
```

#### GET /api/health/history?from={iso}&to={iso}

Returns historical health scores.

**Response (200):**
```json
{
  "scores": [
    { "timestamp": "2026-03-20T14:00:00Z", "overall_score": 94.0, "sim_time": 7200.0 },
    { "timestamp": "2026-03-20T14:05:00Z", "overall_score": 93.5, "sim_time": 7500.0 }
  ]
}
```

#### GET /api/dga/analysis

Returns current DGA analysis including Duval Triangle classification, TDCG, and CO₂/CO ratio.

**Response (200):**
```json
{
  "timestamp": "2026-03-20T15:30:00Z",
  "duval": {
    "pct_ch4": 55.0,
    "pct_c2h4": 40.0,
    "pct_c2h2": 5.0,
    "zone": "T2",
    "zone_label": "Thermal Fault 300–700°C",
    "point": { "x": 0.55, "y": 0.40, "z": 0.05 }
  },
  "tdcg": {
    "value": 850,
    "unit": "ppm",
    "status": "CAUTION"
  },
  "co2_co_ratio": {
    "value": 9.0,
    "interpretation": "Normal paper aging"
  },
  "gas_rates": {
    "DGA_H2": { "rate_ppm_per_day": 2.5, "trend": "RISING" },
    "DGA_CH4": { "rate_ppm_per_day": 1.8, "trend": "RISING" },
    "DGA_C2H6": { "rate_ppm_per_day": 0.5, "trend": "STABLE" },
    "DGA_C2H4": { "rate_ppm_per_day": 3.2, "trend": "RISING" },
    "DGA_C2H2": { "rate_ppm_per_day": 0.0, "trend": "STABLE" },
    "DGA_CO": { "rate_ppm_per_day": 0.1, "trend": "STABLE" },
    "DGA_CO2": { "rate_ppm_per_day": 0.3, "trend": "STABLE" }
  }
}
```

#### GET /api/fmea

Returns current failure mode analysis results.

**Response (200):**
```json
{
  "timestamp": "2026-03-20T15:30:00Z",
  "active_modes": [
    {
      "id": "FM-001",
      "name": "Winding Hot Spot",
      "match_score": 0.72,
      "confidence_label": "Probable",
      "severity": 8,
      "affected_components": ["windings", "oil"],
      "evidence": [
        { "condition": "Winding temp > expected by 15%", "matched": true, "value": "108.5°C vs 94.2°C expected" },
        { "condition": "CH₄ above Caution (75 ppm)", "matched": true, "value": "82 ppm" },
        { "condition": "Duval zone is T1/T2/T3", "matched": true, "value": "Zone T2" }
      ],
      "recommended_actions": ["Reduce load to 70%", "Verify cooling system", "Schedule thermal imaging"],
      "development_time": "Days to weeks"
    }
  ]
}
```

#### GET /api/alerts?status={active|acknowledged|all}&limit={n}

Returns alerts, optionally filtered.

**Response (200):**
```json
{
  "alerts": [
    {
      "id": 42,
      "timestamp": "2026-03-20T15:02:15Z",
      "severity": "CRITICAL",
      "title": "Winding Temperature Anomaly Detected",
      "description": "Winding hot spot temperature is 15.2% above expected value...",
      "source": "ANOMALY_ENGINE",
      "sensor_ids": ["WINDING_TEMP"],
      "failure_mode_id": "FM-001",
      "recommended_actions": ["Reduce load to 70%", "Verify cooling system"],
      "acknowledged": false,
      "acknowledged_at": null,
      "sim_time": 7335.0
    }
  ],
  "total_count": 5,
  "active_count": 3
}
```

#### PUT /api/alerts/{id}/acknowledge

Acknowledges an alert.

**Response (200):**
```json
{
  "id": 42,
  "acknowledged": true,
  "acknowledged_at": "2026-03-20T15:10:00Z"
}
```

#### POST /api/simulation

Runs a what-if simulation. See Section 6.7 for request/response schemas.

**Request Body:** Simulation Request (Section 6.7)  
**Response (200):** Simulation Response (Section 6.7)  
**Response (422):** Validation error if parameters out of range.

#### POST /api/scenario/{scenario_id}/trigger

Triggers a pre-programmed fault scenario.

**Path Parameters:**
- `scenario_id`: One of `normal`, `hot_spot`, `arcing`, `cooling_failure`

**Response (200):**
```json
{
  "scenario_id": "hot_spot",
  "name": "Developing Hot Spot",
  "status": "TRIGGERED",
  "description": "Blocked cooling duct causing localized winding overheating. Develops over 2 simulated hours.",
  "started_at": "2026-03-20T15:30:00Z"
}
```

#### GET /api/scenario/status

Returns the current active scenario.

**Response (200):**
```json
{
  "active_scenario": "hot_spot",
  "name": "Developing Hot Spot",
  "started_at": "2026-03-20T15:30:00Z",
  "elapsed_sim_time": 3600.0,
  "progress_percent": 50.0
}
```

#### PUT /api/simulation/speed

Sets the simulation time acceleration factor.

**Request Body:**
```json
{ "speed_multiplier": 30 }
```

**Response (200):**
```json
{ "speed_multiplier": 30, "effective_intervals": { "thermal_ms": 167, "dga_ms": 10000, "equipment_ms": 333, "diagnostic_ms": 120000 } }
```

### 7.2 WebSocket API

**Connection URL:** `ws://localhost:8000/ws`

**Connection Lifecycle:**

1. Client connects to `ws://localhost:8000/ws`.
2. Server sends a `connection_ack` message.
3. Server begins streaming `sensor_update` messages at defined intervals.
4. Server sends `alert` messages when new alerts are generated.
5. Server sends `health_update` messages when the health score changes.
6. Client may send `command` messages (speed change, scenario trigger).
7. Server sends `ping` every 30 seconds; client responds with `pong`.

**Server → Client Message Types:**

**connection_ack:**
```json
{
  "type": "connection_ack",
  "timestamp": "2026-03-20T15:30:00Z",
  "sim_time": 0.0,
  "speed_multiplier": 1,
  "active_scenario": "normal"
}
```

**sensor_update:**
```json
{
  "type": "sensor_update",
  "timestamp": "2026-03-20T15:30:05Z",
  "sim_time": 5.0,
  "group": "thermal",
  "sensors": {
    "TOP_OIL_TEMP": { "value": 72.3, "unit": "°C", "status": "NORMAL", "expected": 71.0 },
    "BOT_OIL_TEMP": { "value": 54.1, "unit": "°C", "status": "NORMAL", "expected": 51.0 },
    "WINDING_TEMP": { "value": 91.2, "unit": "°C", "status": "NORMAL", "expected": 89.5 },
    "LOAD_CURRENT": { "value": 78.0, "unit": "%", "status": "NORMAL" },
    "AMBIENT_TEMP": { "value": 30.5, "unit": "°C", "status": "NORMAL" }
  }
}
```

The `group` field is one of: `"thermal"`, `"dga"`, `"equipment"`, `"diagnostic"`.

**health_update:**
```json
{
  "type": "health_update",
  "timestamp": "2026-03-20T15:30:05Z",
  "sim_time": 5.0,
  "overall_score": 85.0,
  "previous_score": 94.0,
  "components": {
    "dga": { "status": "WARNING", "contribution": 15.0 },
    "winding_temp": { "status": "NORMAL", "contribution": 0.0 },
    "oil_temp": { "status": "NORMAL", "contribution": 0.0 },
    "cooling": { "status": "NORMAL", "contribution": 0.0 },
    "oil_quality": { "status": "NORMAL", "contribution": 0.0 },
    "bushing": { "status": "NORMAL", "contribution": 0.0 }
  }
}
```

**alert:**
```json
{
  "type": "alert",
  "alert": {
    "id": 42,
    "timestamp": "2026-03-20T15:02:15Z",
    "severity": "CRITICAL",
    "title": "Winding Temperature Anomaly Detected",
    "description": "Winding hot spot is 15.2% above expected...",
    "source": "ANOMALY_ENGINE",
    "sensor_ids": ["WINDING_TEMP"],
    "failure_mode_id": "FM-001",
    "recommended_actions": ["Reduce load to 70%", "Verify cooling system"]
  }
}
```

**scenario_update:**
```json
{
  "type": "scenario_update",
  "scenario_id": "hot_spot",
  "name": "Developing Hot Spot",
  "stage": "Stage 2: Gas generation beginning",
  "progress_percent": 35.0,
  "elapsed_sim_time": 2520.0
}
```

**ping:**
```json
{ "type": "ping", "timestamp": "2026-03-20T15:30:30Z" }
```

**Client → Server Message Types:**

**pong:**
```json
{ "type": "pong" }
```

**set_speed:**
```json
{ "type": "set_speed", "speed_multiplier": 30 }
```

**trigger_scenario:**
```json
{ "type": "trigger_scenario", "scenario_id": "hot_spot" }
```

**acknowledge_alert:**
```json
{ "type": "acknowledge_alert", "alert_id": 42 }
```

---

## 8. Fault Scenario Specifications

### Scenario 1: "Developing Hot Spot" (ID: `hot_spot`)

**Trigger:** Manual via UI button or API.  
**Duration:** 2 simulated hours.  

**Timeline (sim_time relative to trigger):**

| Sim Time | Stage | Sensor Changes | System Response |
|----------|-------|---------------|-----------------|
| 0–30 min | Stage 1: Onset | WINDING_TEMP: +0.5°C above expected per reading (cumulative). All DGA stable. | No alerts. Health score stable (92–96). |
| 30–60 min | Stage 2: Gas onset | WINDING_TEMP: now 5–8°C above expected. DGA_CH4: rising 2 ppm per DGA update. DGA_C2H4: rising 1 ppm per update. DGA_H2: rising 1.5 ppm per update. | Anomaly engine flags WINDING_TEMP as CAUTION. FMEA FM-001 score rises to ~0.3. |
| 60–90 min | Stage 3: Anomaly | WINDING_TEMP: 10–15°C above expected. DGA_CH4: crosses 75 ppm (Caution). DGA_C2H4: crosses 50 ppm (Caution). Duval Triangle enters T1 zone. | Anomaly engine flags WARNING. FM-001 score > 0.4 ("Possible"). Health score drops to ~78. Alert generated: "Developing thermal fault." |
| 90–120 min | Stage 4: Progression | WINDING_TEMP: 15–20°C above expected. DGA_C2H4: continues rising toward 100 ppm. Duval moves toward T2 zone. | FM-001 score > 0.7 ("Probable"). Health score drops to ~65. Second alert: "Winding hot spot — probable thermal fault T2." |

**Demo Narrative:**

"Watch the winding temperature — it's starting to creep above where our thermal model says it should be. Now the dissolved gas analysis is picking up methane and ethylene — that's the oil decomposing from the heat. The Duval Triangle just classified this as a T1 thermal fault, and our FMEA engine identified it as a probable winding hot spot. The health score dropped from 94 to 65. In a real plant, this alert would give the maintenance team days or weeks to plan an inspection before this becomes a catastrophic failure."

### Scenario 2: "Arcing Event" (ID: `arcing`)

**Trigger:** Manual.  
**Duration:** 15 simulated minutes.  

| Sim Time | Stage | Sensor Changes | System Response |
|----------|-------|---------------|-----------------|
| 0 min | Normal | All sensors normal. | Health 92–96. |
| 5 min | Arcing onset | DGA_C2H2: jumps from 0.5 to 8 ppm. DGA_H2: jumps from 45 to 150 ppm. | Immediate CRITICAL alert: "Acetylene spike detected — possible arcing." Health drops to ~55. |
| 10 min | Sustained | DGA_C2H2: rises to 15 ppm. DGA_H2: 200 ppm. Duval Triangle snaps to D1/D2. | FM-003 score > 0.8. Health drops to ~35. Alert: "CRITICAL: High-energy discharge detected." |
| 15 min | Recommendation | Values stabilize at elevated levels. | System recommends: "Immediate load reduction. Emergency inspection required. Consider de-energization." |

**Demo Narrative:**

"This is the scenario every utility dreads — an arcing event. See how the acetylene jumped from near-zero to 8 ppm in seconds? Even a few ppm of acetylene is alarming — it only forms from electrical arcing at thousands of degrees. The Duval Triangle immediately classified this as a high-energy discharge, and the system is recommending emergency action. In real life, this would mean pulling the transformer off-line for inspection."

### Scenario 3: "Cooling Degradation" (ID: `cooling_failure`)

**Trigger:** Manual.  
**Duration:** 1 simulated hour.  

| Sim Time | Stage | Sensor Changes | System Response |
|----------|-------|---------------|-----------------|
| 0 min | Failure | FAN_BANK_1: switches from ON to OFF (while LOAD_CURRENT = 80%). Cooling mode effectively drops from ONAF to ONAN. | Equipment alert: "Fan Bank 1 offline." |
| 5–15 min | Heating | TOP_OIL_TEMP: begins rising 0.3°C per minute above expected ONAF baseline. WINDING_TEMP: follows with lag. | Anomaly engine flags TOP_OIL_TEMP as CAUTION. Health drops to ~85. |
| 15–30 min | Accumulation | TOP_OIL_TEMP: now 8°C above expected. BOT_OIL_TEMP: gradient narrowing. | WARNING alert: "Top oil temperature 8°C above model — verify cooling." FM-006 score > 0.5. Health ~75. |
| 30–60 min | Thermal impact | If uncorrected: TOP_OIL_TEMP approaches 85°C. DGA gases show very slight uptick. | DGA_STATUS may shift to CAUTION. Health drops to ~68. |

**Demo Narrative:**

"Here we've simulated a cooling fan failure during a high-load period. The immediate impact is that top oil temperature starts climbing because we've lost forced air cooling. Our model knows what the temperature should be with the fans running, so it catches this deviation within minutes. Without intervention, the transformer would keep heating up, potentially causing oil degradation and eventually insulation damage."

### Scenario 4: "Normal Operation" (ID: `normal`)

**Trigger:** Default on startup. Can be triggered to reset from any other scenario.  
**Duration:** Continuous (24-hour cycle repeats).  

All sensors follow the physics models with normal daily patterns. Load follows weekday/weekend curves. Ambient follows daily sinusoidal. All readings within Normal ranges. Health score oscillates between 90 and 96 due to minor natural variation. Zero WARNING or CRITICAL alerts.

---

## 9. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| WebSocket message latency (server → client) | <200ms at 1× speed |
| REST API response time | <500ms for all endpoints |
| 3D model frame rate | ≥30 FPS during orbit/zoom on M3 Pro |
| 3D scene initial load | <3 seconds |
| Chart render (Recharts) | Smooth animation at 60 FPS for up to 1000 data points |
| SQLite write throughput | Must handle ≥20 writes/second (thermal sensors at 5s intervals = ~5 writes/s, plus anomalies and health scores) |
| Data retention | Store up to 24 hours of simulated data (~200,000 sensor readings). Auto-purge oldest when exceeding 500,000 rows. |
| Memory usage (backend) | <500 MB |
| Memory usage (frontend) | <300 MB |
| Browser support | Chrome 120+, Safari 17+, Firefox 120+ |
| Primary screen resolution | 2560×1440 (1440p desktop) |
| Minimum screen resolution | 1920×1080 (1080p) |
| Concurrent users | 1 (POC scope) |

---

## 10. UI/UX Specification

### 10.1 Overall Layout

The application uses a single-page layout with four zones:

1. **Header Bar** (height: 56px): App logo/name ("TransformerTwin"), transformer ID and name, connection status indicator, simulation speed control, scenario selector dropdown, alert count badge, and health score mini-gauge.

2. **Left Panel — 3D Viewport** (width: 55% of viewport, full height minus header and timeline): The interactive 3D transformer model (F1).

3. **Right Panel — Data & Diagnostics** (width: 45% of viewport, full height minus header and timeline): A tabbed panel with tabs for: "Sensors" (live readings with sparklines), "DGA" (gas charts + Duval Triangle + summary), "FMEA" (failure mode cards), "What-If" (simulation controls), and "Alerts" (alert feed).

4. **Bottom Bar — Timeline** (height: 48px): Historical playback slider (F8) spanning full width.

### 10.2 Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| bg-primary | #0F172A | Main background (slate-900) |
| bg-surface | #1E293B | Cards, panels (slate-800) |
| bg-surface-elevated | #334155 | Hover states, active tabs (slate-700) |
| border-default | #475569 | Dividers, borders (slate-600) |
| text-primary | #F1F5F9 | Primary text (slate-100) |
| text-secondary | #94A3B8 | Secondary text, labels (slate-400) |
| text-muted | #64748B | Disabled, hints (slate-500) |
| accent-primary | #3B82F6 | Primary accent, links (blue-500) |
| accent-hover | #2563EB | Accent hover (blue-600) |
| status-normal | #22C55E | Normal/healthy (green-500) |
| status-caution | #EAB308 | Caution (yellow-500) |
| status-warning | #F97316 | Warning (orange-500) |
| status-critical | #EF4444 | Critical/alarm (red-500) |
| status-info | #3B82F6 | Informational (blue-500) |
| chart-line-1 | #38BDF8 | Primary chart line (sky-400) |
| chart-line-2 | #A78BFA | Secondary chart line (violet-400) |
| chart-line-3 | #FB923C | Tertiary chart line (orange-400) |
| model-tank | #64748B | 3D model tank base (slate-500) |
| model-copper | #B87333 | 3D model bushings/windings |
| model-radiator | #475569 | 3D model radiators (slate-600) |

### 10.3 Typography

| Element | Font | Weight | Size |
|---------|------|--------|------|
| App title | Inter | 700 | 20px |
| Section headings | Inter | 600 | 16px |
| Body text | Inter | 400 | 14px |
| Sensor values | JetBrains Mono | 500 | 14px |
| Small labels | Inter | 400 | 12px |
| Health score number | JetBrains Mono | 700 | 48px |
| Alert titles | Inter | 600 | 14px |

### 10.4 Industrial Design Language

The UI should feel like a modern industrial control room, not a consumer SaaS application. Key principles:

- **Dark backgrounds with high-contrast data.** Data readability is paramount. Never sacrifice legibility for aesthetics.
- **Monospaced numbers.** All sensor readings, timestamps, and scores use JetBrains Mono to maintain column alignment as values change.
- **Subtle grid lines.** Charts use low-contrast grid lines (#334155) that are visible but not distracting.
- **Status colors are semantic, not decorative.** Green, amber, orange, and red appear only in connection with sensor/health status. Never use status colors for non-status UI elements.
- **Minimal animation.** The only animations are: health score gauge transitions (300ms ease), alert pulse (0.5 Hz on critical), and 3D model component pulse for critical status. No decorative transitions, no bounce effects, no gratuitous motion.
- **Data density.** The right panel should show as much relevant data as possible without scrolling for the primary view. Use compact sparklines, tight spacing, and small-but-readable font sizes.
- **No rounded corners on data panels.** Use 2px border-radius maximum for data containers. Rounded corners signal consumer UI, not industrial UI.

### 10.5 Responsive Behavior

The primary target is a 2560×1440 desktop display. At 1920×1080, the layout should still be fully usable with slightly smaller 3D viewport and data panels. Below 1920px width, the 3D viewport stacks above the data panel (vertical layout) instead of side-by-side. Mobile is out of scope.

---

## 11. Out of Scope / Future Roadmap

The following are explicitly not included in this POC but would be discussed in an interview as "what I'd build next":

- **ML-Based Anomaly Detection:** Replace physics-based expected values with learned models (Isolation Forest for multivariate anomaly detection, LSTM networks for time-series prediction). This would catch subtle cross-sensor correlations that physics models miss.
- **MQTT Protocol Support:** Connect to real IoT sensors via MQTT broker (e.g., Mosquitto) instead of the simulated data source.
- **Fleet-Level Multi-Transformer View:** Dashboard showing health scores and alert counts across a fleet of 40+ transformers with drill-down capability.
- **TimescaleDB or InfluxDB Migration:** Replace SQLite with a time-series database optimized for high-frequency sensor data at scale.
- **Role-Based Access Control (RBAC):** Different views and permissions for plant managers, engineers, and analysts.
- **Mobile View:** Responsive design for tablet and phone access to critical alerts and health scores.
- **PDF Report Generation:** Automated monthly condition reports with DGA trend analysis, health score history, and maintenance recommendations.
- **CMMS Integration:** Push work orders and inspection recommendations directly into a Computerized Maintenance Management System (e.g., Maximo, SAP PM).
- **Photorealistic 3D Model:** Import actual transformer CAD models (STEP/IGES) for accurate visual representation.
- **Edge Computing / Offline Mode:** Run the anomaly detection engine on edge hardware near the transformer, with intermittent sync to a central server.

---

## 12. Glossary

| Term | Definition |
|------|-----------|
| APM | Asset Performance Management — enterprise software for monitoring industrial equipment health |
| Arcing | High-energy electrical discharge between conductors, producing extreme temperatures (>3000°C) and acetylene gas |
| Arrhenius Equation | Chemical kinetics equation describing how reaction rates (including insulation aging) increase exponentially with temperature |
| Buchholz Relay | Gas-actuated protection device on transformers that trips when sudden gas generation indicates an internal fault |
| Bushing | Porcelain or composite insulating connector where power conductors enter/exit the transformer tank |
| Cellulose | Paper insulation material wrapped around transformer windings; its condition determines transformer end-of-life |
| CMMS | Computerized Maintenance Management System — software for scheduling and tracking maintenance activities |
| Conservator | Expansion tank mounted above the main transformer tank that accommodates oil volume changes with temperature |
| DGA | Dissolved Gas Analysis — diagnostic method that analyzes gases dissolved in transformer oil to detect internal faults |
| Digital Twin | Virtual representation of a physical asset that mirrors its real-time state and behavior using sensor data and simulation models |
| Duval Triangle | Graphical method using a ternary diagram to classify transformer faults from three key dissolved gas ratios (IEEE C57.104, IEC 60599) |
| FMEA | Failure Mode and Effects Analysis — systematic method for identifying potential failure modes, their causes, effects, and mitigations |
| Hot Spot | The point of highest temperature in the transformer windings — the critical thermal limit |
| IEC 60599 | International standard for interpreting DGA data from oil-filled transformers |
| IEEE C57.104 | IEEE standard guide for the interpretation of gases generated in mineral oil-immersed transformers |
| MVA | Megavolt-Ampere — unit of apparent power; a 100 MVA transformer can handle 100 million volt-amperes |
| ONAN | Oil Natural, Air Natural — cooling mode using natural convection only (no fans or pumps) |
| ONAF | Oil Natural, Air Forced — cooling mode with fans for forced air cooling, natural oil convection |
| OFAF | Oil Forced, Air Forced — cooling mode with both fans and oil pumps running for maximum cooling |
| OLTC | On-Load Tap Changer — mechanical device that adjusts transformer voltage ratio while energized |
| Partial Discharge | Low-energy electrical discharge in gas voids or at sharp points in insulation; a precursor to full insulation breakdown |
| SmartSignal | GE Vernova's predictive analytics platform that uses "actual vs. expected" modeling for industrial equipment monitoring |
| SPC | Statistical Process Control — using statistical methods to monitor and control processes |
| TDCG | Total Dissolved Combustible Gas — sum of all combustible gases dissolved in transformer oil; a general health indicator |
| Thermal Time Constant (τ) | The time required for a thermal system to reach approximately 63% of its final temperature after a step change; ~30 minutes for transformer top oil |
| Ternary Diagram | A triangular chart where three variables that sum to a constant are plotted; used for the Duval Triangle |

---

## 13. Appendix A: Interview Talking Points

### How This Maps to GE Vernova's SmartSignal and APM

SmartSignal uses empirical models (trained on historical data from similar assets) to compute expected sensor values, then flags deviations. TransformerTwin implements the same principle using physics-based expected value models instead of empirical ML models. Both approaches compute an expected value and flag the residual (actual minus expected). The physics approach is viable when the underlying physical relationships are well-understood, as they are for transformers. In production, you'd combine physics-based and data-driven approaches — the physics model provides a strong baseline and interpretability, while ML catches subtle cross-sensor correlations that physics models miss.

APM provides the fleet-level health scoring, risk ranking, and work order integration layer. TransformerTwin's health score and FMEA engine implement the single-asset version of this capability. In production, you'd add a fleet dashboard that ranks all transformers by health score and routes the FMEA recommendations into a CMMS.

### Why "Actual vs. Expected" Beats Threshold-Based Alarms

A fixed threshold alarm (e.g., "alert if winding temp > 95°C") ignores operating context. A transformer at 96°C while running at 100% load on a 40°C summer day is behaving normally — 96°C is the expected hot spot at those conditions. But a transformer at 90°C while running at 50% load on a 20°C day is alarming — the expected hot spot is only 65°C, so 90°C means there's 25°C of unexplained heating. Threshold alarms miss the second case and false-alarm on the first. The "actual vs. expected" approach catches both correctly because it adjusts expectations based on operating conditions.

### How DGA Works and Why the Duval Triangle Is Industry Standard

When oil or cellulose insulation decomposes under electrical or thermal stress, it produces characteristic gases. Low temperatures produce methane and ethane. High temperatures produce ethylene. Electrical arcing produces acetylene. Paper degradation produces carbon monoxide and CO₂. By analyzing the ratios of these gases, you can determine the type and severity of the fault without opening the transformer.

The Duval Triangle (specifically Triangle 1) is the most widely used classification method because it is deterministic (no ambiguous boundaries between "possible" and "probable"), visual (easy to explain to non-specialists), and backed by decades of field validation. It was developed by Michel Duval and is codified in IEEE C57.104 and IEC 60599.

### Architecture Decisions and Trade-offs

- **SQLite over PostgreSQL/TimescaleDB:** For a single-user POC, SQLite eliminates infrastructure setup while providing adequate performance for ~20 writes/second and time-range queries. In production, you'd migrate to TimescaleDB for time-series optimized storage at scale.
- **WebSocket over Server-Sent Events:** WebSocket supports bidirectional communication (client can send commands like scenario triggers and speed changes). SSE is simpler but one-directional.
- **React Three Fiber over raw Three.js:** R3F provides React component-based 3D scene management, making it easier to bind 3D objects to application state (sensor data, health status).
- **Physics-based simulation over recorded data playback:** Generating data from physics models ensures realistic correlations between sensors, supports what-if simulation, and allows infinite runtime without pre-recorded datasets.

### What I'd Do Differently With 3 Months

1. Train ML anomaly detection models (Isolation Forest, LSTM) on the simulated normal data, then validate against fault scenarios.
2. Connect to a real MQTT data source (even a Raspberry Pi running a sensor simulator) to demonstrate real IoT pipeline.
3. Build the fleet-level multi-transformer dashboard.
4. Implement PDF report generation with templated monthly condition reports.
5. Add role-based access so a plant manager sees a different default view than an engineer.
6. Deploy to cloud (AWS) with proper CI/CD, monitoring, and data persistence.

---

## 14. Appendix B: Reference Architecture

### System Components

**Frontend (React + TypeScript + Vite):**
- React Three Fiber scene for 3D visualization
- Recharts for all time-series and gauge charts
- WebSocket client for real-time data consumption
- React Context/Zustand for global state management (sensor data, health score, alerts)
- REST client (fetch/axios) for on-demand queries (history, simulation, scenario control)

**Backend (Python + FastAPI):**
- **Transformer Simulator:** Core physics engine that models thermal behavior, DGA gas generation, equipment states, and load/ambient patterns. Runs in an asyncio loop, producing sensor readings at defined intervals.
- **Anomaly Detection Engine:** Computes expected values for each thermal sensor and evaluates deviations. Runs synchronously on each sensor update.
- **DGA Analyzer:** Computes Duval Triangle classification, TDCG, CO₂/CO ratio, and gas generation rates. Runs on each DGA update.
- **FMEA Engine:** Evaluates all 8 failure modes against current sensor and anomaly data. Runs after each anomaly detection cycle.
- **Health Score Calculator:** Computes the weighted composite score. Runs after each FMEA evaluation.
- **Alert Manager:** Generates, deduplicates, and persists alerts. Runs after health score calculation.
- **Scenario Manager:** Manages pre-programmed fault scenario injection — modifies simulator behavior according to scenario timelines.
- **WebSocket Manager:** Broadcasts sensor_update, health_update, alert, and scenario_update messages to connected clients.
- **REST API Layer:** FastAPI routes for history queries, simulation requests, scenario control, and alert management.
- **SQLite Database (aiosqlite):** Stores sensor readings, anomaly events, alerts, health scores, and transformer configuration.

### Data Flow (per simulation tick)

1. Simulator advances sim_time by the tick interval (adjusted for speed multiplier).
2. Simulator computes new sensor values based on physics models and active scenario modifiers.
3. New readings are written to SQLite and broadcast via WebSocket as `sensor_update`.
4. Anomaly Detection Engine receives the new readings and computes expected vs. actual deviations.
5. Any anomalies are written to SQLite.
6. DGA Analyzer runs (if this tick includes a DGA update) and computes Duval classification.
7. FMEA Engine evaluates failure mode match scores.
8. Health Score Calculator recomputes the composite score.
9. Alert Manager checks for new alert conditions, deduplicates, and persists.
10. Health score and any new alerts are broadcast via WebSocket.

### File Structure (suggested)

```
transformertwin/
├── backend/
│   ├── main.py                  # FastAPI app, WebSocket, REST routes
│   ├── simulator/
│   │   ├── engine.py            # Core physics simulator
│   │   ├── thermal_model.py     # Temperature calculations
│   │   ├── dga_model.py         # Gas generation model
│   │   └── scenarios.py         # Fault scenario definitions
│   ├── analytics/
│   │   ├── anomaly_detector.py  # Actual vs. expected engine
│   │   ├── dga_analyzer.py      # Duval Triangle, TDCG, ratios
│   │   ├── fmea_engine.py       # Failure mode matching
│   │   └── health_score.py      # Composite health calculation
│   ├── models/
│   │   └── schemas.py           # Pydantic models for all data types
│   ├── database/
│   │   └── db.py                # SQLite setup, queries
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Viewer3D/        # React Three Fiber scene
│   │   │   ├── SensorPanel/     # Live sensor readings
│   │   │   ├── DGAPanel/        # DGA charts + Duval Triangle
│   │   │   ├── FMEAPanel/       # Failure mode cards
│   │   │   ├── HealthGauge/     # Health score display
│   │   │   ├── WhatIfPanel/     # Simulation controls
│   │   │   ├── AlertFeed/       # Alert list
│   │   │   └── Timeline/        # Playback slider
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts  # WebSocket connection manager
│   │   │   └── useApi.ts        # REST API hooks
│   │   ├── store/               # State management
│   │   └── types/               # TypeScript interfaces
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

---

*End of Document*