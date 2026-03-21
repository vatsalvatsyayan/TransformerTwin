"""
TransformerTwin — Global Constants and Configuration.

Every magic number lives here with a comment explaining WHY that value was chosen.
No inline literals in business logic — always reference a named constant.
"""

# ---------------------------------------------------------------------------
# Simulation timing
# ---------------------------------------------------------------------------

# Wall-clock seconds between simulator ticks (1 real second = 1 sim second at 1×)
TICK_INTERVAL_SECONDS: float = 1.0

# Minimum speed multiplier (real-time)
MIN_SPEED_MULTIPLIER: int = 1

# Maximum speed multiplier (60 sim-minutes per real minute)
MAX_SPEED_MULTIPLIER: int = 60

# ---------------------------------------------------------------------------
# Sensor update intervals (in simulation seconds)
# Defined in Integration Contract Section 1.2
# ---------------------------------------------------------------------------

# Thermal sensors update every 5 sim-seconds — fast enough to catch transients
THERMAL_UPDATE_INTERVAL_SIM_S: int = 5

# Equipment sensors (fans, pump, tap) update every 10 sim-seconds
EQUIPMENT_UPDATE_INTERVAL_SIM_S: int = 10

# DGA sensors update every 5 sim-minutes — gas generation is slow
DGA_UPDATE_INTERVAL_SIM_S: int = 300

# Diagnostic sensors (oil, bushing) update every 1 sim-hour — very slow degradation
DIAGNOSTIC_UPDATE_INTERVAL_SIM_S: int = 3600

# ---------------------------------------------------------------------------
# Sensor IDs (canonical set from Integration Contract Section 1.1)
# ---------------------------------------------------------------------------

THERMAL_SENSOR_IDS: tuple[str, ...] = (
    "TOP_OIL_TEMP",
    "BOT_OIL_TEMP",
    "WINDING_TEMP",
    "LOAD_CURRENT",
    "AMBIENT_TEMP",
)

DGA_SENSOR_IDS: tuple[str, ...] = (
    "DGA_H2",
    "DGA_CH4",
    "DGA_C2H6",
    "DGA_C2H4",
    "DGA_C2H2",
    "DGA_CO",
    "DGA_CO2",
)

EQUIPMENT_SENSOR_IDS: tuple[str, ...] = (
    "FAN_BANK_1",
    "FAN_BANK_2",
    "OIL_PUMP_1",
    "TAP_POSITION",
    "TAP_OP_COUNT",
)

DIAGNOSTIC_SENSOR_IDS: tuple[str, ...] = (
    "OIL_MOISTURE",
    "OIL_DIELECTRIC",
    "BUSHING_CAP_HV",
    "BUSHING_CAP_LV",
)

ALL_SENSOR_IDS: tuple[str, ...] = (
    THERMAL_SENSOR_IDS
    + DGA_SENSOR_IDS
    + EQUIPMENT_SENSOR_IDS
    + DIAGNOSTIC_SENSOR_IDS
)

# Sensor units (canonical, used in all API responses)
SENSOR_UNITS: dict[str, str] = {
    "TOP_OIL_TEMP":    "°C",
    "BOT_OIL_TEMP":    "°C",
    "WINDING_TEMP":    "°C",
    "LOAD_CURRENT":    "%",
    "AMBIENT_TEMP":    "°C",
    "DGA_H2":          "ppm",
    "DGA_CH4":         "ppm",
    "DGA_C2H6":        "ppm",
    "DGA_C2H4":        "ppm",
    "DGA_C2H2":        "ppm",
    "DGA_CO":          "ppm",
    "DGA_CO2":         "ppm",
    "FAN_BANK_1":      "boolean",
    "FAN_BANK_2":      "boolean",
    "OIL_PUMP_1":      "boolean",
    "TAP_POSITION":    "position",
    "TAP_OP_COUNT":    "count",
    "OIL_MOISTURE":    "ppm",
    "OIL_DIELECTRIC":  "kV",
    "BUSHING_CAP_HV":  "pF",
    "BUSHING_CAP_LV":  "pF",
}

# ---------------------------------------------------------------------------
# Sensor thresholds (CAUTION / WARNING / CRITICAL)
# Based on IEEE C57.91 and IEC 60599 standards
# ---------------------------------------------------------------------------

# Format: (caution, warning, critical) — values above critical trigger CRITICAL status
SENSOR_THRESHOLDS: dict[str, tuple[float, float, float]] = {
    # Winding hot spot: IEC 60076-7 limit is 98°C continuous, 140°C emergency
    "WINDING_TEMP":   (90.0,  105.0, 120.0),
    # Top oil temperature limits per IEEE C57.91
    "TOP_OIL_TEMP":   (75.0,   85.0,  95.0),
    # Bottom oil is cooler; threshold offsets from top oil
    "BOT_OIL_TEMP":   (60.0,   70.0,  80.0),
    # DGA thresholds per IEEE C57.104 Table 1 (typical CAUTION values)
    "DGA_H2":         (100.0, 700.0, 1800.0),
    "DGA_CH4":        (75.0,  200.0,  600.0),
    "DGA_C2H6":       (75.0,  150.0,  400.0),
    "DGA_C2H4":       (50.0,  200.0,  600.0),
    "DGA_C2H2":        (1.0,   35.0,  200.0),
    "DGA_CO":        (350.0,  900.0, 1800.0),
    "DGA_CO2":      (2500.0, 4000.0, 9000.0),
    # Oil moisture: >20 ppm risks reduced dielectric; >35 ppm is critical
    "OIL_MOISTURE":   (15.0,   25.0,  35.0),
    # Oil dielectric strength: <40 kV is WARNING, <30 kV is CRITICAL
    "OIL_DIELECTRIC": (45.0,   40.0,  30.0),  # NOTE: reversed — lower is worse
    # Bushing capacitance drift: ±5% caution, ±10% warning, ±20% critical
    # Absolute thresholds (pF) below are approximate for a 100 MVA transformer
    "BUSHING_CAP_HV": (525.0, 550.0, 600.0),  # Nominal ~500 pF
    "BUSHING_CAP_LV": (440.0, 462.0, 504.0),  # Nominal ~420 pF
}

# TDCG thresholds (IEEE C57.104 Table 2)
# Total Dissolved Combustible Gas
TDCG_CAUTION_PPM: int = 720     # Condition 2: monitor more frequently
TDCG_WARNING_PPM: int = 1920    # Condition 3: investigate
TDCG_CRITICAL_PPM: int = 4630   # Condition 4: immediate action

# CO2/CO ratio: normal paper aging is 5–13; outside this range indicates paper fault
CO2_CO_RATIO_LOW: float = 5.0
CO2_CO_RATIO_HIGH: float = 13.0

# ---------------------------------------------------------------------------
# Health score component weights (must sum to 1.0)
# Weights reflect criticality of each subsystem to transformer reliability
# ---------------------------------------------------------------------------

HEALTH_WEIGHTS: dict[str, float] = {
    "dga":          0.30,  # DGA is the primary early-warning indicator
    "winding_temp": 0.25,  # Winding insulation degradation is irreversible
    "oil_temp":     0.15,  # Oil temperature affects all subsystems
    "cooling":      0.10,  # Cooling failure is detectable and remediable
    "oil_quality":  0.10,  # Oil contamination affects insulation
    "bushing":      0.10,  # Bushing failure is sudden and catastrophic
}

# Health score status labels (Integration Contract Section 3.4)
HEALTH_STATUS_GOOD: float = 80.0     # ≥ 80 → GOOD
HEALTH_STATUS_FAIR: float = 60.0     # 60–79 → FAIR
HEALTH_STATUS_POOR: float = 40.0     # 40–59 → POOR
# < 40 → CRITICAL

# Health score penalty points per status level
HEALTH_PENALTY_CAUTION: int = 25
HEALTH_PENALTY_WARNING: int = 50
HEALTH_PENALTY_CRITICAL: int = 100

# Minimum health score change to emit a health_update WebSocket message
HEALTH_UPDATE_THRESHOLD: float = 0.5

# ---------------------------------------------------------------------------
# Transformer static configuration (Integration Contract Section 3.1)
# ---------------------------------------------------------------------------

TRANSFORMER_ID: str = "TRF-001"
TRANSFORMER_NAME: str = "Main Power Transformer Unit 1"
TRANSFORMER_MANUFACTURER: str = "GE Vernova"
TRANSFORMER_RATING_MVA: float = 100.0
TRANSFORMER_VOLTAGE_HV_KV: float = 230.0
TRANSFORMER_VOLTAGE_LV_KV: float = 69.0
TRANSFORMER_COOLING_TYPE: str = "ONAN/ONAF/OFAF"
TRANSFORMER_YEAR_MANUFACTURED: int = 2005
TRANSFORMER_OIL_VOLUME_LITERS: float = 45000.0
TRANSFORMER_LOCATION: str = "Substation Alpha, Bay 3"

# ---------------------------------------------------------------------------
# Tap changer
# ---------------------------------------------------------------------------

TAP_MIN_POSITION: int = 1
TAP_MAX_POSITION: int = 33
TAP_NOMINAL_POSITION: int = 17  # Center tap = nominal voltage ratio

# ---------------------------------------------------------------------------
# WebSocket settings
# ---------------------------------------------------------------------------

WS_ENDPOINT: str = "/ws"

# Heartbeat interval (wall-clock seconds) — Integration Contract Section 2.2
WS_PING_INTERVAL_S: int = 30

# Time to wait for pong before considering client dead
WS_PONG_TIMEOUT_S: int = 60

# Drop thermal/equipment updates if WS send buffer exceeds this size
WS_MAX_BUFFER_MESSAGES: int = 50

# ---------------------------------------------------------------------------
# REST API settings
# ---------------------------------------------------------------------------

# Allowed CORS origin (Vite dev server) — Integration Contract Section 3
CORS_ALLOWED_ORIGIN: str = "http://localhost:5173"

API_PREFIX: str = "/api"

# Default query limits
SENSOR_HISTORY_DEFAULT_LIMIT: int = 1000
SENSOR_HISTORY_MAX_LIMIT: int = 10000
ALERTS_DEFAULT_LIMIT: int = 50
HEALTH_HISTORY_DEFAULT_HOURS: int = 2

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

DB_PATH: str = "transformer_twin.db"

# ---------------------------------------------------------------------------
# Scenario IDs (Integration Contract Section 1.5)
# ---------------------------------------------------------------------------

SCENARIO_NORMAL: str = "normal"
SCENARIO_HOT_SPOT: str = "hot_spot"
SCENARIO_ARCING: str = "arcing"
SCENARIO_COOLING_FAILURE: str = "cooling_failure"

VALID_SCENARIO_IDS: tuple[str, ...] = (
    SCENARIO_NORMAL,
    SCENARIO_HOT_SPOT,
    SCENARIO_ARCING,
    SCENARIO_COOLING_FAILURE,
)

# Scenario durations in simulation seconds
SCENARIO_HOT_SPOT_DURATION_S: int = 7200    # 2 sim-hours
SCENARIO_ARCING_DURATION_S: int = 900        # 15 sim-minutes
SCENARIO_COOLING_FAILURE_DURATION_S: int = 3600  # 1 sim-hour

# ---------------------------------------------------------------------------
# FMEA failure mode IDs (Integration Contract Section 1.7)
# ---------------------------------------------------------------------------

VALID_FAILURE_MODE_IDS: tuple[str, ...] = (
    "FM-001",  # Winding Hot Spot
    "FM-002",  # Paper Insulation Degradation
    "FM-003",  # Arcing Event
    "FM-004",  # Partial Discharge
    "FM-005",  # Oil Degradation
    "FM-006",  # Cooling System Failure
    "FM-007",  # OLTC Wear
    "FM-008",  # Bushing Deterioration
)

# FMEA confidence thresholds (Integration Contract Section 1.8)
FMEA_CONFIDENCE_POSSIBLE: float = 0.4   # 0.4–0.7 → "Possible"
FMEA_CONFIDENCE_PROBABLE: float = 0.7   # > 0.7 → "Probable"
FMEA_MIN_REPORT_SCORE: float = 0.3      # Only report modes above this threshold

# ---------------------------------------------------------------------------
# Anomaly detection
# ---------------------------------------------------------------------------

# Rolling baseline window (in thermal ticks = 5 sim-sec each)
# 360 ticks × 5s = 1800 sim-seconds = 30 sim-minutes of baseline
ANOMALY_BASELINE_WINDOW: int = 360

# Z-score thresholds for classification
ANOMALY_Z_CAUTION: float = 2.0
ANOMALY_Z_WARNING: float = 3.5
ANOMALY_Z_CRITICAL: float = 5.0
