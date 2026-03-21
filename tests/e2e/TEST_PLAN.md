# TransformerTwin — Playwright Visual QA Test Plan

> This checklist is used by Claude (with Playwright MCP) to systematically verify the app,
> capture screenshots, and identify issues for improvement.
>
> Screenshots are saved to `/screenshots/` in the project root.
> Run this plan after starting both servers:
>   - Backend:  `cd backend && .venv/bin/python -m uvicorn main:app --reload --port 8001`
>   - Frontend: `cd frontend && npm run dev`

---

## 0. Pre-flight Checks

- [ ] `GET http://localhost:8001/health-check` returns `{"status": "ok"}`
- [ ] `http://localhost:5173` loads (HTML response)
- [ ] WebSocket `ws://localhost:8001/ws` connects and returns `connection_ack`

---

## 1. Initial Load

**Screenshot**: `01-initial-load.png`

- [ ] Page loads without JavaScript errors in console
- [ ] Loading spinner / "Connecting to TransformerTwin backend…" overlay is visible
- [ ] After WebSocket connects: overlay dismisses, full dashboard renders
- [ ] Header, 3D viewer panel, tab container, and bottom timeline all visible

---

## 2. Header Bar

**Screenshot**: `02-header.png`

- [ ] Title "TransformerTwin" visible
- [ ] "TRF-001 | Main Power Transformer Unit 1" identifier visible
- [ ] Health score badge displays with color (should be green GOOD at start)
- [ ] Connection indicator shows green dot + "Live"
- [ ] Speed buttons visible: 1x / 10x / 30x / 60x
- [ ] Scenario dropdown visible and reads "Normal Operation"
- [ ] Alert badge hidden (no active alerts in normal mode)

---

## 3. Sensors Tab (Default)

**Screenshot**: `03-sensors-tab.png`

- [ ] "Sensors" tab is active by default
- [ ] All sensor groups visible (scroll to confirm ~21 rows)
- [ ] Each row shows: colored status dot, sensor name, live numeric value + unit, sparkline
- [ ] Equipment sensors (FAN_BANK_1, FAN_BANK_2, OIL_PUMP_1) show ON/OFF instead of a number
- [ ] All status dots are green (NORMAL) in steady state
- [ ] Sparklines are rendering (not blank)

**Re-screenshot after 5 seconds**: `03b-sensors-updating.png`
- [ ] Sensor values have changed (confirming live WebSocket updates)

---

## 4. DGA Tab — Trends Sub-tab

**Screenshot**: `04-dga-trends.png`

- [ ] Click "DGA" tab to navigate
- [ ] "Trends" sub-tab is active by default
- [ ] 7 individual gas line charts visible: H2, CH4, C2H6, C2H4, C2H2, CO, CO2
- [ ] Each chart has a title, y-axis label with unit (ppm)
- [ ] Caution/Warning/Critical threshold dashed reference lines visible on charts

---

## 5. DGA Tab — Duval Sub-tab

**Screenshot**: `05-duval-triangle.png`

- [ ] Click "Duval" sub-tab
- [ ] SVG equilateral triangle renders
- [ ] All 7 colored zone polygons visible: PD (purple), T1 (orange), T2 (red), T3 (dark red), D1 (blue), D2 (dark blue), DT (violet)
- [ ] Zone labels (PD, T1, T2, T3, D1, D2, DT) visible inside zones
- [ ] Live point visible (white dot with colored ring) in the NONE/T1 area
- [ ] Current zone name displayed (e.g., "Zone: NONE" or "Zone: T1")
- [ ] Gas percentages displayed: CH4 X.X% / C2H4 X.X% / C2H2 X.X%
- [ ] Corner axis labels visible (CH4, C2H4, C2H2)

---

## 6. DGA Tab — Summary Sub-tab

**Screenshot**: `06-dga-summary.png`

- [ ] Click "Summary" sub-tab
- [ ] TDCG card visible with numeric ppm value and NORMAL status
- [ ] CO2/CO Ratio card visible with numeric value and interpretation text
- [ ] Gas Generation Rates table visible
- [ ] Table rows for each of 7 gases: name, ppm/day rate, trend indicator
- [ ] Trend indicators correct: RISING ↑ / FALLING ↓ / STABLE → (or similar visual)

---

## 7. FMEA Tab — Empty State

**Screenshot**: `07-fmea-empty.png`

- [ ] Click "FMEA" tab
- [ ] Empty state message shown (no failure modes in normal operation)
- [ ] No FMEA cards visible
- [ ] Message is informative (e.g., "No active failure modes detected")

---

## 8. What-If Tab — Inputs

**Screenshot**: `08-whatif-panel.png`

- [ ] Click "What-If" tab
- [ ] Load (%) slider visible, default value shown (e.g., "85%")
- [ ] Ambient Temp (°C) slider visible, default value shown
- [ ] Cooling Mode dropdown visible with 3 options: ONAN / ONAF / OFAF
- [ ] Time Horizon (days) slider visible
- [ ] "Run Simulation" button is enabled and styled correctly

**Test: Run simulation**

- [ ] Click "Run Simulation"
- [ ] Screenshot `09-whatif-running.png`: button shows "Running…" and is disabled
- [ ] After response (~1-2s):
- [ ] Screenshot `10-whatif-results.png`: results visible
  - [ ] Hot Spot temp card shows value in °C
  - [ ] Top Oil temp card shows value in °C
  - [ ] Aging interpretation text visible (gray, below cards)
  - [ ] Projection chart renders (line chart with days on x-axis)
  - [ ] Cooling energy impact data visible

---

## 9. Alerts Tab — Empty State

**Screenshot**: `11-alerts-empty.png`

- [ ] Click "Alerts" tab
- [ ] Empty state "No alerts." or similar message shown
- [ ] No alert cards visible
- [ ] Alert count badge NOT shown on tab button (or shows 0)

---

## 10. 3D Viewer

**Screenshot**: `12-3d-viewer.png`

- [ ] React Three Fiber canvas renders (not black/blank)
- [ ] Transformer model visible with recognizable parts (tank body, bushings, radiators)
- [ ] StatusLegend overlay visible at bottom-left: 4 colored dots with labels (Normal/Caution/Warning/Critical)
- [ ] Camera reset button visible (likely top-right of viewer)

**Test interactions**:
- [ ] Drag to rotate model
- [ ] Screenshot `12b-3d-rotated.png`: model shows from different angle
- [ ] Click camera reset button → model returns to default angle

---

## 11. Bottom Timeline — Live Mode

**Screenshot**: `13-timeline-live.png`

- [ ] Green "LIVE" badge visible at bottom
- [ ] Simulation time counter (sim_time) visible and incrementing
- [ ] Wall clock (real time) displayed in live mode
- [ ] No scenario progress bar visible (normal operation)
- [ ] No scrubber slider visible (live mode only shows slider in playback)

---

## 12. Hot Spot Scenario Test

**Setup**: Set speed to 30x, then trigger hot_spot scenario

### 12a. Scenario Trigger
- [ ] Click speed button "30x"
- [ ] Click scenario dropdown → select "Developing Hot Spot"
- [ ] Screenshot `14-scenario-progress.png`:
  - [ ] Orange/colored progress bar appears at bottom timeline
  - [ ] Stage text visible (e.g., "Stage 1: Hot spot forming…")
  - [ ] Scenario dropdown shows "Developing Hot Spot"

### 12b. Sensor Changes (wait ~30s at 30x = ~15 sim-minutes)
- [ ] Screenshot `15-sensor-warning.png`:
  - [ ] WINDING_TEMP row shows CAUTION (yellow) or WARNING (orange) status dot
  - [ ] WINDING_TEMP value is elevated above normal (~90°C+)
  - [ ] TOP_OIL_TEMP may also be elevated
  - [ ] Health score in header has changed color (no longer fully green)

### 12c. Duval Triangle Movement
- [ ] Navigate to DGA → Duval sub-tab
- [ ] Screenshot `16-duval-movement.png`:
  - [ ] Live point has moved from NONE zone toward T1/T2 zone
  - [ ] Historical trail of dots visible behind live point
  - [ ] Zone label shows T1 or T2 (not NONE)
  - [ ] Gas percentages show elevated C2H4 %

### 12d. FMEA Active
- [ ] Click FMEA tab
- [ ] Screenshot `17-fmea-active.png`:
  - [ ] FM-001 card visible (Developing Winding Hot Spot)
  - [ ] Match score shown (should be > 0.3)
  - [ ] Confidence label visible (Monitoring/Possible/Probable)
  - [ ] Severity dot colored appropriately
- [ ] Click FM-001 card header to expand
- [ ] Screenshot `18-fmea-expanded.png`:
  - [ ] Evidence list visible (checkmarks for matched, circles for unmatched)
  - [ ] Matched evidence shows actual sensor values
  - [ ] "Recommended Actions" list visible

### 12e. Alerts Panel
- [ ] Click Alerts tab
- [ ] Screenshot `19-alerts-active.png`:
  - [ ] Alert cards visible (at least 1)
  - [ ] Alert card shows: colored status dot (CAUTION/WARNING), title, timestamp, "Ack" button
  - [ ] Alert tab button shows red count badge

- [ ] Click "Ack" on first alert
- [ ] Screenshot `20-alert-acked.png`:
  - [ ] Acknowledged alert dims to 50% opacity
  - [ ] "Ack" button disappears from that card
  - [ ] Other unacked alerts still show their "Ack" button

### 12f. Health Score Drop
- [ ] Screenshot `21-health-drop.png`:
  - [ ] Header health score shows FAIR or POOR (yellow/orange)
  - [ ] Score value is < 80
  - [ ] Health badge color has changed from green

---

## 13. Historical Playback

**Screenshot**: `22-playback-mode.png`

- [ ] Click the "LIVE" badge in the bottom timeline
- [ ] Scrubber slider appears in the timeline bar
- [ ] "PLAYBACK" badge now visible (different from LIVE)
- [ ] Wall clock display hidden (or replaced with historical timestamp)

**Test: Scrub backwards**
- [ ] Drag scrubber slider to the left (earlier time)
- [ ] Loading indicator shows during fetch (e.g., "…" text)
- [ ] Screenshot `23-playback-snapshot.png`:
  - [ ] Sensor values have changed to historical values
  - [ ] Sim time display shows past timestamp
  - [ ] Duval point may be in a different position

**Return to live**
- [ ] Click "PLAYBACK" badge to exit playback
- [ ] "LIVE" badge returns
- [ ] Scrubber disappears
- [ ] Live sensor values resume updating

---

## 14. Disconnection Banner

- [ ] Stop backend server (Ctrl+C in terminal)
- [ ] Wait 5 seconds
- [ ] Screenshot `24-disconnected.png`:
  - [ ] Red disconnection banner appears at top
  - [ ] Connection indicator shows red dot "Disconnected"
  - [ ] Existing sensor values still visible (stale but not blank)

- [ ] Restart backend server
- [ ] Wait for reconnect
- [ ] Screenshot `25-reconnected.png`:
  - [ ] Banner disappears
  - [ ] Connection indicator back to green "Live"
  - [ ] Sensor values resume updating

---

## 15. Post-Test: Improvements Checklist

After completing all screenshots, Claude should review them and implement the following improvements (prioritized):

### P1 — Fix if broken
- [ ] DGA Summary trend arrows rendering (RISING/FALLING/STABLE)
- [ ] What-If cooling energy impact row visible in results
- [ ] Alert tab badge count updates correctly during scenario
- [ ] FMEA empty state message is informative

### P2 — Visual polish
- [ ] Duval zone labels positioned correctly (no clipping, especially DT zone)
- [ ] Sensor sparklines not clipping at row edges
- [ ] Active speed button highlighted differently from inactive buttons
- [ ] Scenario progress bar text not clipping on narrow views

### P3 — UX enhancements
- [ ] Alerts empty state: add icon + "System nominal — no active alerts" text
- [ ] FMEA empty state: add icon + "No anomalies detected" text
- [ ] Playback mode: show "Viewing: T+Xh Xm" context label near scrubber
- [ ] Health breakdown component bars animate on change

---

## Notes for Claude

When running this test plan:

1. **Speed matters**: Use 30x or 60x simulation speed to see fault scenarios unfold faster
2. **Wait between screenshots**: After triggering a scenario, wait for the simulator to tick (each wall-clock second = `speed_multiplier` sim-seconds)
3. **Save all screenshots**: Use `browser_screenshot` with explicit file path to `screenshots/` dir
4. **Log issues**: Note any visual bugs, missing elements, or UI inconsistencies encountered
5. **Implement improvements**: After QA pass, fix issues found and re-screenshot to verify
