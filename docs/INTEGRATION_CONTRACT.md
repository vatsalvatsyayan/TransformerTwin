# TransformerTwin — Integration Contract

**Version:** 1.0  
**Date:** March 20, 2026  
**Status:** Binding Specification  
**Parties:** Backend (Python/FastAPI) ↔ Frontend (React/TypeScript)  
**Companion Documents:** PRD v1.0, Backend Architecture v1.0, Frontend Architecture v1.0  

**Rule:** If both sides implement to this contract, the system will work on first connection. Any field name, enum value, URL, or JSON structure in this document is authoritative. Where the PRD, Backend Architecture, or Frontend Architecture conflict with this contract, this contract wins.

---

## Table of Contents

1. Shared Type Definitions (Canonical Enums & Constants)
2. WebSocket Protocol Specification
3. REST API Specification
4. Event Flow Diagrams
5. Error Handling Contract
6. Startup Sequence

---

## 1. Shared Type Definitions

These exact string values are used in every WebSocket message, REST response, and internal logic on both sides. Neither side may add, rename, or alias these values.

### 1.1 Sensor IDs

Canonical sensor identifiers. Every `sensor_id` field in every message and database row uses exactly one of these strings.

```typescript
type SensorId =
  // Thermal / Electrical — group: "thermal", interval: 5s
  | "TOP_OIL_TEMP"      // °C
  | "BOT_OIL_TEMP"      // °C
  | "WINDING_TEMP"       // °C
  | "LOAD_CURRENT"       // %
  | "AMBIENT_TEMP"       // °C
  // DGA — group: "dga", interval: 300s
  | "DGA_H2"             // ppm
  | "DGA_CH4"            // ppm
  | "DGA_C2H6"           // ppm
  | "DGA_C2H4"           // ppm
  | "DGA_C2H2"           // ppm
  | "DGA_CO"             // ppm
  | "DGA_CO2"            // ppm
  // Equipment — group: "equipment", interval: 10s
  | "FAN_BANK_1"         // boolean (0 or 1 as number)
  | "FAN_BANK_2"         // boolean (0 or 1 as number)
  | "OIL_PUMP_1"         // boolean (0 or 1 as number)
  | "TAP_POSITION"       // integer 1–33
  | "TAP_OP_COUNT"       // integer
  // Slow Diagnostics — group: "diagnostic", interval: 3600s
  | "OIL_MOISTURE"       // ppm
  | "OIL_DIELECTRIC"     // kV
  | "BUSHING_CAP_HV"     // pF
  | "BUSHING_CAP_LV";    // pF
```

### 1.2 Sensor Group

```typescript
type SensorGroup = "thermal" | "dga" | "equipment" | "diagnostic";
```

**Group → Sensor mapping (immutable):**

| Group | Sensors | Sim-time interval (seconds) |
|-------|---------|---------------------------|
| `thermal` | TOP_OIL_TEMP, BOT_OIL_TEMP, WINDING_TEMP, LOAD_CURRENT, AMBIENT_TEMP | 5 |
| `dga` | DGA_H2, DGA_CH4, DGA_C2H6, DGA_C2H4, DGA_C2H2, DGA_CO, DGA_CO2 | 300 |
| `equipment` | FAN_BANK_1, FAN_BANK_2, OIL_PUMP_1, TAP_POSITION, TAP_OP_COUNT | 10 |
| `diagnostic` | OIL_MOISTURE, OIL_DIELECTRIC, BUSHING_CAP_HV, BUSHING_CAP_LV | 3600 |

### 1.3 Status Enums

```typescript
// Sensor and component health status — 4 levels
type SensorStatus = "NORMAL" | "CAUTION" | "WARNING" | "CRITICAL";

// Alert severity — 3 levels
type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";

// Alert source — identifies which engine generated the alert
type AlertSource = "ANOMALY_ENGINE" | "FMEA_ENGINE" | "THRESHOLD";

// Connection state (frontend-only, not transmitted)
type ConnectionState = "connecting" | "connected" | "disconnected";
```

### 1.4 Cooling Mode

```typescript
type CoolingMode = "ONAN" | "ONAF" | "OFAF";
```

### 1.5 Scenario IDs

```typescript
type ScenarioId = "normal" | "hot_spot" | "arcing" | "cooling_failure";
```

### 1.6 Duval Triangle Zones

```typescript
type DuvalZone = "PD" | "T1" | "T2" | "T3" | "D1" | "D2" | "DT" | "NONE";
```

`"NONE"` is returned when the sum of CH₄ + C₂H₄ + C₂H₂ < 0.1 ppm (insufficient data).

### 1.7 Failure Mode IDs

```typescript
type FailureModeId = "FM-001" | "FM-002" | "FM-003" | "FM-004" | "FM-005" | "FM-006" | "FM-007" | "FM-008";
```

### 1.8 FMEA Confidence Labels

```typescript
type FMEAConfidence = "Monitoring" | "Possible" | "Probable";
// score < 0.4 → "Monitoring"
// score 0.4–0.7 → "Possible"
// score > 0.7 → "Probable"
```

### 1.9 Gas Rate Trend

```typescript
type GasRateTrend = "RISING" | "STABLE" | "FALLING";
```

### 1.10 Health Component Keys

The `components` object in health-related messages always has exactly these 6 keys — no more, no fewer:

```typescript
type HealthComponentKey = "dga" | "winding_temp" | "oil_temp" | "cooling" | "oil_quality" | "bushing";
```

### 1.11 Timestamps

All timestamps in the contract use **ISO 8601 format with UTC timezone and `Z` suffix**:

```
"2026-03-20T15:30:05Z"
```

Both backend (Python `datetime.utcnow().isoformat() + "Z"`) and frontend (`new Date(timestamp)`) must handle this format. No other timestamp format is permitted in API responses or WebSocket messages.

### 1.12 Numeric Precision

- **Temperatures:** 1 decimal place (72.3, not 72.3456).
- **DGA ppm:** 1 decimal place.
- **Percentages (load, deviation, match_score):** 1 decimal place.
- **Health score:** 1 decimal place.
- **sim_time:** 1 decimal place (seconds).
- **Bushing capacitance:** 1 decimal place (pF).

Backend rounds to these precisions before sending. Frontend displays as received — no additional rounding.

---

## 2. WebSocket Protocol Specification

### 2.1 Connection

| Property | Value |
|----------|-------|
| URL | `ws://localhost:8000/ws` |
| Protocol | WebSocket (RFC 6455) |
| Subprotocol | None |
| Authentication | None (single-user POC) |
| Max message size | 64 KB |

### 2.2 Connection Lifecycle

```
1. Frontend opens WebSocket to ws://localhost:8000/ws
2. Backend accepts, sends → connection_ack (within 500ms)
3. Backend begins streaming → sensor_update messages at group intervals
4. Backend sends → health_update whenever score changes by ≥ 0.5 points
5. Backend sends → alert whenever a new alert is generated
6. Backend sends → scenario_update on every thermal tick while a non-normal scenario is active
7. Backend sends → ping every 30 wall-clock seconds
8. Frontend responds with → pong within 10 seconds
9. If no pong received in 60 seconds, backend closes the connection
10. On close: frontend retries with exponential backoff (1s, 2s, 4s, 8s, 16s, max 30s)
```

### 2.3 Message Catalog

#### 2.3.1 Server → Client Messages

**Message: `connection_ack`**

Sent once immediately after WebSocket accept. This is the first message the client receives.

```json
{
  "type": "connection_ack",
  "timestamp": "2026-03-20T15:30:00Z",
  "sim_time": 0.0,
  "speed_multiplier": 1,
  "active_scenario": "normal"
}
```

| Field | Type | Description |
|-------|------|-------------|
| type | `"connection_ack"` | Message discriminator |
| timestamp | string (ISO 8601) | Server wall-clock time |
| sim_time | number | Current simulation time in seconds since start |
| speed_multiplier | integer (1–60) | Current time acceleration factor |
| active_scenario | ScenarioId | Currently active scenario |

---

**Message: `sensor_update`**

Sent at group-specific intervals. Each message contains ALL sensors for exactly one group.

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

| Field | Type | Description |
|-------|------|-------------|
| type | `"sensor_update"` | Message discriminator |
| timestamp | string | Server wall-clock time |
| sim_time | number | Simulation seconds since start |
| group | SensorGroup | Which sensor group this update covers |
| sensors | `Record<SensorId, SensorReading>` | Map of sensor ID → reading |

**SensorReading object:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| value | number | yes | Current reading value |
| unit | string | yes | Unit of measurement |
| status | SensorStatus | yes | Threshold-based status |
| expected | number | no | Expected value from physics model. Present only for thermal sensors (TOP_OIL_TEMP, BOT_OIL_TEMP, WINDING_TEMP). Absent for LOAD_CURRENT, AMBIENT_TEMP, all DGA, equipment, and diagnostic sensors. |

**Frequency contract at 1× speed:**

| Group | Interval (sim-seconds) | Wall-clock interval at 1× | at 10× | at 60× |
|-------|----------------------|--------------------------|--------|--------|
| thermal | 5 | 5.0s | 0.5s | 0.083s |
| equipment | 10 | 10.0s | 1.0s | 0.167s |
| dga | 300 | 300.0s | 30.0s | 5.0s |
| diagnostic | 3600 | 3600.0s | 360.0s | 60.0s |

**Backend guarantee:** At high speed, if the WebSocket send buffer exceeds 50 messages, thermal and equipment `sensor_update` messages may be dropped. The backend always sends the most recent value — never a stale one. DGA, diagnostic, alert, and health_update messages are never dropped.

**Frontend expectation:** The frontend must not assume a fixed arrival rate. It must handle gaps gracefully (display last known value, do not crash on missing updates).

---

**Message: `health_update`**

Sent whenever the computed health score changes by ≥ 0.5 points from the last emitted value. Also sent once on the first computation after startup.

```json
{
  "type": "health_update",
  "timestamp": "2026-03-20T15:30:05Z",
  "sim_time": 5.0,
  "overall_score": 85.0,
  "previous_score": 94.0,
  "components": {
    "dga":          { "status": "WARNING",  "contribution": 15.0 },
    "winding_temp": { "status": "NORMAL",   "contribution": 0.0 },
    "oil_temp":     { "status": "NORMAL",   "contribution": 0.0 },
    "cooling":      { "status": "NORMAL",   "contribution": 0.0 },
    "oil_quality":  { "status": "NORMAL",   "contribution": 0.0 },
    "bushing":      { "status": "NORMAL",   "contribution": 0.0 }
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| type | `"health_update"` | |
| timestamp | string | |
| sim_time | number | |
| overall_score | number | 0.0–100.0, 1 decimal |
| previous_score | number | Score before this change |
| components | `Record<HealthComponentKey, HealthComponentStatus>` | Exactly 6 keys |

**HealthComponentStatus:**

| Field | Type | Description |
|-------|------|-------------|
| status | SensorStatus | Component status |
| contribution | number | Penalty points contributed to score reduction (penalty × weight). 0.0 if NORMAL. |

---

**Message: `alert`**

Sent whenever a new alert is generated. Never batched — one message per alert.

```json
{
  "type": "alert",
  "alert": {
    "id": 42,
    "timestamp": "2026-03-20T15:02:15Z",
    "severity": "CRITICAL",
    "title": "Winding Temperature Anomaly Detected",
    "description": "Winding hot spot temperature is 15.2% above expected value. Actual: 108.5°C, Expected: 94.2°C at current load (78%) and ambient (32°C).",
    "source": "ANOMALY_ENGINE",
    "sensor_ids": ["WINDING_TEMP"],
    "failure_mode_id": "FM-001",
    "recommended_actions": ["Reduce load to 70%", "Verify cooling system operation", "Schedule thermal imaging inspection"],
    "acknowledged": false,
    "acknowledged_at": null,
    "sim_time": 7335.0
  }
}
```

The `alert` object schema is identical to the object returned by `GET /api/alerts` (see Section 3). Fields:

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | integer | no | Auto-incremented database ID |
| timestamp | string | no | When the alert was generated |
| severity | AlertSeverity | no | |
| title | string | no | Human-readable title |
| description | string | no | Full context |
| source | AlertSource | no | |
| sensor_ids | string[] | no | Array of SensorId. May be empty. |
| failure_mode_id | string | yes | FailureModeId or null |
| recommended_actions | string[] | no | May be empty. |
| acknowledged | boolean | no | Always `false` when first sent |
| acknowledged_at | string | yes | Always `null` when first sent |
| sim_time | number | no | |

---

**Message: `scenario_update`**

Sent on every thermal tick (every 5 sim-seconds) while a non-`normal` scenario is active. Not sent during `normal` operation.

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

| Field | Type | Description |
|-------|------|-------------|
| type | `"scenario_update"` | |
| scenario_id | ScenarioId | |
| name | string | Human-readable scenario name |
| stage | string | Current stage description |
| progress_percent | number | 0.0–100.0 |
| elapsed_sim_time | number | Seconds since scenario was triggered |

---

**Message: `ping`**

Heartbeat. Sent every 30 wall-clock seconds.

```json
{ "type": "ping", "timestamp": "2026-03-20T15:30:30Z" }
```

#### 2.3.2 Client → Server Messages

**Message: `pong`**

Response to `ping`. Must be sent within 10 seconds.

```json
{ "type": "pong" }
```

---

**Message: `set_speed`**

Changes simulation time acceleration.

```json
{ "type": "set_speed", "speed_multiplier": 30 }
```

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| type | `"set_speed"` | | |
| speed_multiplier | integer | 1–60 inclusive | New speed factor |

Backend acknowledges by including the new speed in subsequent `connection_ack` if the client reconnects. The speed change takes effect on the next simulation tick (within 1 wall-clock second).

---

**Message: `trigger_scenario`**

Triggers a pre-programmed fault scenario. Replaces any currently active scenario.

```json
{ "type": "trigger_scenario", "scenario_id": "hot_spot" }
```

| Field | Type | Constraints |
|-------|------|-------------|
| type | `"trigger_scenario"` | |
| scenario_id | ScenarioId | Must be one of the 4 defined values |

Backend confirms by sending a `scenario_update` message within 1 thermal tick.

---

**Message: `acknowledge_alert`**

Marks an alert as acknowledged.

```json
{ "type": "acknowledge_alert", "alert_id": 42 }
```

| Field | Type | Constraints |
|-------|------|-------------|
| type | `"acknowledge_alert"` | |
| alert_id | integer | Must be a valid alert ID from a previous `alert` message |

Backend updates the database. No explicit confirmation message is sent. Frontend should optimistically update its local state.

---

### 2.4 WebSocket Error Message

If the server receives a malformed client message or an invalid value, it sends:

```json
{
  "type": "error",
  "code": "INVALID_MESSAGE",
  "message": "Unknown scenario_id: 'invalid_value'. Valid values: normal, hot_spot, arcing, cooling_failure"
}
```

| Field | Type | Values |
|-------|------|--------|
| type | `"error"` | |
| code | string | `"INVALID_MESSAGE"`, `"INVALID_SPEED"`, `"INVALID_SCENARIO"`, `"UNKNOWN_ALERT"` |
| message | string | Human-readable explanation |

The server does NOT close the connection on an error. It logs and continues.

---

## 3. REST API Specification

**Base URL:** `http://localhost:8000`  
**Content-Type:** `application/json` for all request and response bodies.  
**CORS:** Backend allows origin `http://localhost:5173` (Vite dev server) with all methods and headers.

### 3.1 GET /api/transformer

Returns static transformer configuration. Does not change at runtime.

**Request:** No parameters.

**Response 200:**
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

---

### 3.2 GET /api/sensors/current

Returns the latest reading for all 21 sensors in a single response.

**Request:** No parameters.

**Response 200:**
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

**Note:** The `sensors` object always contains all 21 sensors. Equipment sensors use `"ON"` / `"OFF"` for status instead of the 4-level SensorStatus. Frontend should handle this by treating `"ON"` as `"NORMAL"` and `"OFF"` as either `"NORMAL"` (if correctly off) or `"WARNING"` (if unexpectedly off). The context for "unexpected" comes from the health and alert systems, not from this endpoint.

---

### 3.3 GET /api/sensors/history

**Query Parameters:**

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| sensor_id | string | yes | — | One of the 21 SensorId values |
| from | string (ISO 8601) | no | 2 hours ago | Start time |
| to | string (ISO 8601) | no | now | End time |
| limit | integer | no | 1000 | Max readings (1–10000) |

**Example Request:**
```
GET /api/sensors/history?sensor_id=WINDING_TEMP&from=2026-03-20T13:30:00Z&to=2026-03-20T15:30:00Z&limit=500
```

**Response 200:**
```json
{
  "sensor_id": "WINDING_TEMP",
  "unit": "°C",
  "readings": [
    { "timestamp": "2026-03-20T13:30:05Z", "value": 88.1, "sim_time": 5405.0 },
    { "timestamp": "2026-03-20T13:30:10Z", "value": 88.3, "sim_time": 5410.0 }
  ]
}
```

Readings are sorted oldest-first (ascending timestamp). The `readings` array may be empty if no data exists in the range.

**Response 422:** If `sensor_id` is not a valid SensorId.

---

### 3.4 GET /api/health

**Response 200:**
```json
{
  "timestamp": "2026-03-20T15:30:00Z",
  "overall_score": 85.0,
  "status": "GOOD",
  "components": {
    "dga":          { "status": "WARNING",  "penalty": 50, "weight": 0.30, "contribution": 15.0 },
    "winding_temp": { "status": "NORMAL",   "penalty": 0,  "weight": 0.25, "contribution": 0.0 },
    "oil_temp":     { "status": "NORMAL",   "penalty": 0,  "weight": 0.15, "contribution": 0.0 },
    "cooling":      { "status": "NORMAL",   "penalty": 0,  "weight": 0.10, "contribution": 0.0 },
    "oil_quality":  { "status": "NORMAL",   "penalty": 0,  "weight": 0.10, "contribution": 0.0 },
    "bushing":      { "status": "NORMAL",   "penalty": 0,  "weight": 0.10, "contribution": 0.0 }
  }
}
```

The `status` field is a convenience label: `"GOOD"` (score ≥ 80), `"FAIR"` (60–79), `"POOR"` (40–59), `"CRITICAL"` (< 40).

---

### 3.5 GET /api/health/history

**Query Parameters:**

| Param | Type | Required | Default |
|-------|------|----------|---------|
| from | string (ISO 8601) | no | 2 hours ago |
| to | string (ISO 8601) | no | now |

**Response 200:**
```json
{
  "scores": [
    { "timestamp": "2026-03-20T14:00:00Z", "overall_score": 94.0, "sim_time": 7200.0 },
    { "timestamp": "2026-03-20T14:05:00Z", "overall_score": 93.5, "sim_time": 7500.0 }
  ]
}
```

---

### 3.6 GET /api/dga/analysis

**Response 200:**
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
    "DGA_H2":   { "rate_ppm_per_day": 2.5, "trend": "RISING" },
    "DGA_CH4":  { "rate_ppm_per_day": 1.8, "trend": "RISING" },
    "DGA_C2H6": { "rate_ppm_per_day": 0.5, "trend": "STABLE" },
    "DGA_C2H4": { "rate_ppm_per_day": 3.2, "trend": "RISING" },
    "DGA_C2H2": { "rate_ppm_per_day": 0.0, "trend": "STABLE" },
    "DGA_CO":   { "rate_ppm_per_day": 0.1, "trend": "STABLE" },
    "DGA_CO2":  { "rate_ppm_per_day": 0.3, "trend": "STABLE" }
  }
}
```

**Note on `duval.point`:** The `x`, `y`, `z` fields are the fractional ternary coordinates (0–1, summing to 1.0) matching `pct_ch4/100`, `pct_c2h4/100`, `pct_c2h2/100`. The frontend uses these for the SVG ternary→Cartesian transform. The backend provides them for convenience so the frontend does not need to re-normalize.

**Note on `duval.zone`:** When `zone` is `"NONE"`, `zone_label` is `"Insufficient data for Duval analysis"` and `pct_*` values are all 0.

---

### 3.7 GET /api/fmea

**Response 200:**
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
        { "condition": "Winding temp > expected by 15%", "matched": true, "value": "108.5°C vs 94.2°C expected (15.2% deviation)" },
        { "condition": "CH₄ above Caution (75 ppm)", "matched": true, "value": "82.0 ppm (threshold: 75)" },
        { "condition": "C₂H₄ above Caution (50 ppm)", "matched": true, "value": "58.0 ppm (threshold: 50)" },
        { "condition": "H₂ above Caution (100 ppm)", "matched": false, "value": "67.0 ppm (threshold: 100)" },
        { "condition": "Duval zone is T1/T2/T3", "matched": true, "value": "Zone T2" }
      ],
      "recommended_actions": ["Reduce load to 70%", "Check cooling system", "Schedule internal inspection"],
      "development_time": "Days to weeks"
    }
  ]
}
```

`active_modes` is sorted by `match_score` descending. Only modes with score > 0.3 are included. May be an empty array.

**Affected components vocabulary** (used by frontend to highlight 3D model parts):

| String value | 3D component(s) |
|-------------|-----------------|
| `"windings"` | Highlight tank body (windings are inside) |
| `"oil"` | Highlight tank body |
| `"insulation"` | Highlight tank body |
| `"paper insulation"` | Highlight tank body |
| `"cooling system"` | Highlight radiator banks + fan units |
| `"HV bushings"` | Highlight HV bushing meshes |
| `"LV bushings"` | Highlight LV bushing meshes |
| `"OLTC"` | Highlight tap changer mesh |
| `"connections"` | Highlight tank body + bushing meshes |

---

### 3.8 GET /api/alerts

**Query Parameters:**

| Param | Type | Required | Default |
|-------|------|----------|---------|
| status | `"active"` \| `"acknowledged"` \| `"all"` | no | `"all"` |
| limit | integer | no | 50 |

**Response 200:**
```json
{
  "alerts": [ /* array of Alert objects — same schema as WS alert.alert */ ],
  "total_count": 12,
  "active_count": 3
}
```

Sorted newest-first.

---

### 3.9 PUT /api/alerts/{id}/acknowledge

**Path Parameter:** `id` — integer alert ID.

**Request Body:** None.

**Response 200:**
```json
{
  "id": 42,
  "acknowledged": true,
  "acknowledged_at": "2026-03-20T15:10:00Z"
}
```

**Response 404:** `{ "detail": "Alert not found" }`

---

### 3.10 POST /api/simulation

**Request Body:**
```json
{
  "load_percent": 95.0,
  "ambient_temp_c": 35.0,
  "cooling_mode": "ONAF",
  "time_horizon_days": 14
}
```

| Field | Type | Constraints |
|-------|------|-------------|
| load_percent | number | 0.0–150.0 |
| ambient_temp_c | number | -10.0–50.0 |
| cooling_mode | CoolingMode | "ONAN", "ONAF", or "OFAF" |
| time_horizon_days | integer | 1–30 |

**Response 200:**
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
    { "day": 1, "hotspot_temp_c": 118.5, "top_oil_temp_c": 82.3, "aging_factor": 8.57 },
    { "day": 2, "hotspot_temp_c": 118.5, "top_oil_temp_c": 82.3, "aging_factor": 8.57 }
  ]
}
```

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| projected_hotspot_temp_c | number | no | Steady-state winding hot spot |
| projected_top_oil_temp_c | number | no | Steady-state top oil |
| aging_acceleration_factor | number | no | Arrhenius factor (1.0 = normal) |
| aging_interpretation | string | no | Human-readable aging description |
| estimated_days_to_warning | number | yes | `null` if no active gas generation |
| cooling_energy_impact_percent | number | no | Relative to current mode |
| cooling_energy_interpretation | string | no | |
| projection_timeline | array | no | One entry per day of time_horizon_days |

**Response 422:** Validation error.

---

### 3.11 POST /api/scenario/{scenario_id}/trigger

**Path Parameter:** `scenario_id` — one of the 4 ScenarioId values.

**Response 200:**
```json
{
  "scenario_id": "hot_spot",
  "name": "Developing Hot Spot",
  "status": "TRIGGERED",
  "description": "Blocked cooling duct causing localized winding overheating. Develops over 2 simulated hours.",
  "started_at": "2026-03-20T15:30:00Z"
}
```

**Response 422:** `{ "detail": "Unknown scenario: 'invalid'" }`

---

### 3.12 GET /api/scenario/status

**Response 200:**
```json
{
  "active_scenario": "hot_spot",
  "name": "Developing Hot Spot",
  "started_at": "2026-03-20T15:30:00Z",
  "elapsed_sim_time": 3600.0,
  "progress_percent": 50.0,
  "stage": "Stage 2: Gas generation beginning"
}
```

When `normal` is active: `progress_percent` = 0, `stage` = `"Normal operation"`, `elapsed_sim_time` = total sim time since start.

---

### 3.13 PUT /api/simulation/speed

**Request Body:**
```json
{ "speed_multiplier": 30 }
```

| Field | Type | Constraints |
|-------|------|-------------|
| speed_multiplier | integer | 1–60 inclusive |

**Response 200:**
```json
{
  "speed_multiplier": 30,
  "effective_intervals": {
    "thermal_ms": 167,
    "dga_ms": 10000,
    "equipment_ms": 333,
    "diagnostic_ms": 120000
  }
}
```

The `effective_intervals` show the wall-clock milliseconds between messages for each group at the new speed. This is informational for debugging — the frontend does not need to use these values.

---

### 3.14 Error Response Format (All Endpoints)

All REST error responses use this format:

```json
{
  "detail": "Human-readable error message"
}
```

| HTTP Status | Meaning |
|-------------|---------|
| 200 | Success |
| 404 | Resource not found (e.g., invalid alert ID) |
| 422 | Validation error (invalid parameters) |
| 500 | Internal server error |

---

## 4. Event Flow Diagrams

### Flow 1: Normal Sensor Data Update

```
SimulatorEngine.run()
  │
  ├─[every 5 sim-sec]──▶ compute thermal sensors
  │                       │
  │                       ├──▶ AnomalyDetector.evaluate(thermal batch)
  │                       │     └──▶ returns [] (no anomalies in normal operation)
  │                       │
  │                       ├──▶ HealthScoreCalculator.compute()
  │                       │     └──▶ score unchanged (delta < 0.5) → no health_update
  │                       │
  │                       ├──▶ DB: insert_sensor_batch()
  │                       │
  │                       └──▶ WebSocket: broadcast sensor_update
  │                             │
  │                             ▼
  │                        FRONTEND: useWebSocket.onmessage
  │                             │
  │                             ├──▶ Zustand: sensorSlice.handleUpdate()
  │                             │     ├── Update current values
  │                             │     ├── Push to sparklineBuffers (shift if > 60)
  │                             │     └── Push to chartBuffers (shift if > 1440)
  │                             │
  │                             ├──▶ SensorRow re-renders (value + sparkline)
  │                             ├──▶ TransformerModel re-evaluates component status
  │                             └──▶ SensorLineChart re-renders (if DGA tab is active)
```

### Flow 2: Anomaly Detected → Alert Generated

```
SimulatorEngine.run()  [hot_spot scenario active, sim_time = 3600s]
  │
  ├──▶ compute thermal sensors
  │     └── WINDING_TEMP = 108.5°C (offset by scenario)
  │
  ├──▶ AnomalyDetector.evaluate()
  │     ├── expected_winding = 94.2°C
  │     ├── deviation = (108.5 - 94.2) / 94.2 = 15.2%
  │     ├── 15.2% > 15% (ANOMALY_DEVIATION_CAUTION) → severity = WARNING
  │     └── returns [AnomalyResult(WINDING_TEMP, 108.5, 94.2, 15.2, "WARNING")]
  │
  ├──▶ FMEAEngine.evaluate()
  │     └── FM-001 score = 0.72 → confidence = "Probable"
  │
  ├──▶ HealthScoreCalculator.compute()
  │     └── winding_temp status elevated to WARNING → score drops to 78.0
  │         delta = |78.0 - 94.0| = 16.0 > 0.5 → emit health_update
  │
  ├──▶ AlertManager.check_and_generate()
  │     ├── Anomaly WARNING → create alert
  │     ├── Check deduplication (no duplicate within 5 min sim-time)
  │     └── Insert alert to DB (id = 42)
  │
  ├──▶ WebSocket: broadcast sensor_update  (with status: "WARNING", expected: 94.2)
  ├──▶ WebSocket: broadcast health_update  (score: 78.0, previous: 94.0)
  ├──▶ WebSocket: broadcast alert          (id: 42, severity: "WARNING")
  │
  │     ▼  ▼  ▼
  │
  │    FRONTEND receives 3 messages in rapid succession:
  │
  │    sensor_update:
  │     ├── SensorRow(WINDING_TEMP) → value turns amber, sparkline shows spike
  │     └── TransformerModel → tank component emissive shifts to WARNING orange
  │
  │    health_update:
  │     ├── HealthGauge → animates from 94 to 78 (300ms ease)
  │     └── HealthBreakdown → winding_temp bar turns orange
  │
  │    alert:
  │     ├── AlertBadge → count increments, badge turns amber/red
  │     ├── AlertPanel → new card appears at top with pulse dot
  │     └── BottomTimeline → amber/red marker appears at current time
```

### Flow 3: Fault Scenario Triggered

```
User clicks "Hot Spot" in ScenarioSelector dropdown
  │
  ├──▶ FRONTEND: useWebSocket.send({ type: "trigger_scenario", scenario_id: "hot_spot" })
  │         ─── OR ───
  │    FRONTEND: fetch("POST /api/scenario/hot_spot/trigger")
  │         (Either path is valid. WS is preferred for lower latency.)
  │
  │     ▼
  │
  │    BACKEND: ScenarioManager.trigger("hot_spot", sim_time)
  │     ├── Instantiates HotSpotScenario
  │     ├── Sets active_scenario = "hot_spot"
  │     └── scenario.active = true, start_time = sim_time
  │
  │    [Next thermal tick, within 1 wall-second:]
  │     ├──▶ WebSocket: broadcast scenario_update
  │     │     { scenario_id: "hot_spot", stage: "Stage 1: Onset", progress_percent: 0.1 }
  │     │
  │     └──▶ FRONTEND: scenarioSlice updated → ScenarioSelector shows "Hot Spot (0%)"
  │
  │    [Over next 2 simulated hours:]
  │     ├── Simulator applies FaultModifiers: winding_temp_offset ramps 0→20°C
  │     ├── DGA gas rates injected after 25% progress
  │     ├── Anomaly detector begins flagging WINDING_TEMP at ~60 min
  │     ├── FMEA FM-001 crosses 0.4 at ~60 min, 0.7 at ~90 min
  │     ├── Health score degrades: 94 → 85 → 78 → 65
  │     ├── Alerts generated at key thresholds
  │     └── Duval Triangle dot moves from T1 → T2
  │
  │    All of these changes are communicated via the standard
  │    sensor_update / health_update / alert / scenario_update
  │    WebSocket messages. No special "fault" message type exists.
```

### Flow 4: What-If Simulation

```
User adjusts sliders in WhatIfPanel, clicks "Run Simulation"
  │
  ├──▶ FRONTEND: fetch("POST /api/simulation", {
  │       load_percent: 110, ambient_temp_c: 38,
  │       cooling_mode: "ONAF", time_horizon_days: 14
  │     })
  │
  │     ▼
  │
  │    BACKEND: routes_simulation.run_whatif_simulation()
  │     ├── projected_hotspot = 38 + 55 × (1.1)² × 0.7 = 38 + 46.6 = 84.6°C
  │     │   (Wait — at 110% load, load_frac = 1.1, rise = 55 × 1.21 × 0.7 = 46.6)
  │     ├── projected_top_oil = 38 + 40 × (1.1)^0.8 × 0.7 = 38 + 28.9 = 66.9°C
  │     ├── aging_factor = 2^((84.6 - 98) / 6.5) = 2^(-2.06) = 0.24
  │     │   (Below reference temp → aging slower than normal)
  │     ├── Compute timeline for 14 days
  │     └── Return JSON response
  │
  │     ▼
  │
  │    FRONTEND: WhatIfPanel receives response
  │     ├── ResultCard components display projected values
  │     ├── ProjectionChart renders 14-day timeline
  │     └── Aging interpretation text displayed
  │
  │    NOTE: This is a pure computation. It does NOT affect the running
  │    simulation. The simulator continues independently.
```

### Flow 5: Historical Playback

```
User drags BottomTimeline slider to sim_time = 3600 (1 hour ago)
  │
  ├──▶ FRONTEND: playbackSlice.enterPlayback(3600)
  │     ├── Sets isPlayback = true
  │     ├── Sets playbackTime = 3600
  │     └── Live WebSocket continues receiving data (stored but not displayed)
  │
  ├──▶ FRONTEND: parallel REST fetches:
  │     ├── GET /api/sensors/history?sensor_id=WINDING_TEMP&from=...&to=<time_at_3600>
  │     ├── GET /api/sensors/history?sensor_id=TOP_OIL_TEMP&from=...&to=<time_at_3600>
  │     ├── ... (one per sensor being charted — typically 5-7 key sensors, not all 21)
  │     ├── GET /api/health/history?from=...&to=<time_at_3600>
  │     └── GET /api/alerts?status=all&limit=50
  │
  │     ▼
  │
  │    FRONTEND: reconstructs state at sim_time = 3600
  │     ├── Charts show historical data up to playback position
  │     ├── Health gauge shows score at that time
  │     ├── 3D model colors reflect sensor status at that time
  │     ├── Alert panel shows alerts that existed at that time
  │     └── Duval triangle shows DGA state at that time (if DGA data available)
  │
  │    [User clicks "Live" button:]
  │     ├── playbackSlice.exitPlayback()
  │     ├── All components snap to live WebSocket-driven state
  │     └── Ring buffers contain data accumulated during playback period
```

---

## 5. Error Handling Contract

### 5.1 Backend Error Responses

**REST:** All errors return JSON with `"detail"` field and appropriate HTTP status code (see Section 3.14).

**WebSocket:** Malformed client messages receive an `error` message (see Section 2.4). The connection stays open.

### 5.2 WebSocket Disconnect/Recovery

| Event | Backend Behavior | Frontend Behavior |
|-------|-----------------|-------------------|
| Client disconnects | Remove from broadcast list. Simulator continues running. | Detect `onclose`, set state to `"disconnected"`, show red indicator with "Reconnecting…" |
| Client reconnects | Accept new connection, send `connection_ack` with current sim_time. Resume streaming from current state (no backfill of missed messages). | On open, reset retry counter. Process `connection_ack` to sync sim_time and speed. Fetch initial state via REST (see Startup Sequence Section 6). |
| Server crash | N/A | `onclose` triggers. Retry with exponential backoff. Show "Backend unavailable" after 3 failed attempts. |
| Network timeout | No pong in 60s → close connection | `onclose` triggers → retry. `onerror` triggers → close → retry. |

**Backoff schedule:** 1s, 2s, 4s, 8s, 16s, 30s, 30s, 30s… (exponential with 30s cap).

**Frontend during disconnection:**
- 3D model retains last-known component colors.
- Sensor values display last-known values with a "stale" visual indicator (dimmed opacity or strikethrough timestamp).
- Health gauge retains last score.
- Charts stop updating (no extrapolation).
- A banner or overlay reads: "Connection lost — reconnecting…"

### 5.3 Graceful Degradation

| Failure | Degraded Behavior |
|---------|-------------------|
| DGA data not yet available (first 5 min) | Duval Triangle shows "Awaiting DGA data…". DGA panel shows empty charts. FMEA engine produces no DGA-dependent scores. |
| Anomaly detector in learning mode (first 10 min) | No anomaly-based alerts. Health score relies on threshold-only status. FMEA scores are lower (anomaly conditions score 0). |
| Historical data fetch fails | Playback slider is disabled. Show "Historical data unavailable" message. Live mode continues unaffected. |
| REST endpoint returns 500 | Frontend shows "Failed to load [resource]" in the relevant panel. Retry once after 5 seconds. Do not block other panels. |
| WebSocket send buffer full (high speed) | Backend drops thermal/equipment sensor_updates (most recent always kept). Frontend sees irregular update intervals — display remains smooth because it always shows the latest received value. |

---

## 6. Startup Sequence

### 6.1 Backend Startup

```
1. main.py: FastAPI app starts via uvicorn
2. lifespan.startup:
   a. Database.initialize() → create tables, seed transformer config
   b. SimulatorEngine created (speed=1, scenario="normal", sim_time=0)
   c. Simulator does NOT start running yet — waits for first WS connection
3. REST endpoints become available (health check: GET /api/transformer returns 200)
4. WebSocket endpoint ready at ws://localhost:8000/ws
5. [Backend is ready — indicated by uvicorn log: "Application startup complete"]
```

### 6.2 Frontend Startup

```
1. Vite dev server serves index.html → React mounts <App />
2. App.tsx renders layout shell (Header, MainLayout, BottomTimeline) with loading states
3. Zustand store initializes with default values
4. useWebSocket hook fires:
   a. Opens WebSocket to ws://localhost:8000/ws
   b. connectionState → "connecting"
5. On WebSocket open:
   a. connectionState → "connected"
   b. Receive connection_ack → store sim_time, speed, active_scenario
6. Parallel REST bootstrap (fire-and-forget, non-blocking):
   a. GET /api/transformer → populate header with transformer name
   b. GET /api/sensors/current → populate all 21 sensor initial values
   c. GET /api/health → populate health gauge
   d. GET /api/dga/analysis → populate Duval triangle (may return "NONE" initially)
   e. GET /api/fmea → populate FMEA cards (may be empty)
   f. GET /api/alerts?status=all → populate alert feed
7. 3D scene loads in parallel (Canvas mount + geometry creation)
8. First sensor_update arrives via WebSocket → sensors begin live updating
9. [All panels populated — app is fully interactive]
```

### 6.3 Timeline: First Data Display

| Wall-clock time from page load | Event |
|-------------------------------|-------|
| 0–500ms | Layout shell renders, 3D Canvas mounts |
| 500ms–1s | WebSocket connects, connection_ack received |
| 1–2s | REST bootstrap completes, initial values populate all panels |
| 2–3s | 3D model fully rendered with initial component colors |
| 3s | First WebSocket sensor_update arrives → live data begins flowing |
| 5s | Second thermal update → sparklines show first 2 data points |
| 10s | Third thermal update + first equipment update → data density growing |
| 5 min (300s) | First DGA update → Duval Triangle plots first point, FMEA begins evaluating |

**Target: meaningful data visible within 3 seconds of page load.**

### 6.4 Simulator Start Behavior

The simulator begins its main loop when the first WebSocket client connects. If the client disconnects and reconnects, the simulator continues running without interruption (sim_time does not reset). To reset, the frontend triggers the `"normal"` scenario which resets sensor values to baseline but does not reset sim_time.

If no WebSocket client has ever connected, REST endpoints return the initial seed values from the database (transformer config) or empty results (no sensor history, no alerts, health score 100).

---

*End of Document*