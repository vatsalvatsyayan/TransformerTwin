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

# Maximum speed multiplier (200× = full 6-hour fault scenario in ~2 real minutes)
MAX_SPEED_MULTIPLIER: int = 200

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
SCENARIO_PARTIAL_DISCHARGE: str = "partial_discharge"
SCENARIO_PAPER_DEGRADATION: str = "paper_degradation"

VALID_SCENARIO_IDS: tuple[str, ...] = (
    SCENARIO_NORMAL,
    SCENARIO_HOT_SPOT,
    SCENARIO_ARCING,
    SCENARIO_COOLING_FAILURE,
    SCENARIO_PARTIAL_DISCHARGE,
    SCENARIO_PAPER_DEGRADATION,
)

# Scenario durations in simulation seconds
SCENARIO_HOT_SPOT_DURATION_S: int = 7200    # 2 sim-hours
SCENARIO_ARCING_DURATION_S: int = 900        # 15 sim-minutes
SCENARIO_COOLING_FAILURE_DURATION_S: int = 3600  # 1 sim-hour
# Partial discharge: slow build over 2 sim-hours — CH4/H2 accumulate into PD zone
SCENARIO_PARTIAL_DISCHARGE_DURATION_S: int = 7200
# Paper degradation: long 3 sim-hour arc of CO/CO2 imbalance
SCENARIO_PAPER_DEGRADATION_DURATION_S: int = 10800

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
# Simplification of IEC 60076-7 bottom-oil model.
# BOT_OIL_TEMP = ambient + (TOP_OIL_TEMP - ambient) * THERMAL_BOTTOM_OIL_FRACTION
THERMAL_BOTTOM_OIL_FRACTION: float = 0.5

# Cooling mode parameters: (top_oil_rise_factor, tau_oil_factor)
# rise_factor: scales THERMAL_TOP_OIL_RISE_RATED_C (fans reduce steady-state rise)
# tau_factor:  scales THERMAL_TAU_OIL_S (fans also speed up thermal response)
# Calibrated so ONAN=55°C rise, ONAF≈40°C rise, OFAF≈30°C rise.
COOLING_PARAMS: dict[str, dict[str, float]] = {
    "ONAN": {"rise_factor": 1.000, "tau_factor": 1.000},  # Natural oil, natural air
    "ONAF": {"rise_factor": 0.727, "tau_factor": 0.667},  # Natural oil, forced air (fans)
    "OFAF": {"rise_factor": 0.545, "tau_factor": 0.500},  # Forced oil, forced air (pump + fans)
}

# Arrhenius aging constants for insulation (used in what-if simulation, Phase 2.5).
# IEC 60076-7 Annex A: relative aging rate doubles every 6°C above 98°C reference.
# k = ln(2) / 6 ≈ 0.1155
AGING_REFERENCE_TEMP_C: float = 98.0  # IEC 60076-7 reference hot spot temperature
AGING_ARRHENIUS_K: float = 0.1155     # ln(2)/6 — aging doubles every 6°C

# ---------------------------------------------------------------------------
# DGA gas generation constants — IEC 60599, IEEE C57.104
# ---------------------------------------------------------------------------

# Base gas generation rates under normal operation (no fault).
# Units: ppm per simulation HOUR of transformer operation.
# Calibrated so that after 24 sim-hours of normal operation at 75% load,
# all gas levels remain well within CAUTION thresholds.
DGA_BASE_RATES_PPM_PER_HR: dict[str, float] = {
    "DGA_H2":   0.50,   # Background partial discharge and oil ionisation
    "DGA_CH4":  0.30,   # Low-temperature thermal decomposition of oil
    "DGA_C2H6": 0.20,   # Thermal aging of oil (most stable under normal conditions)
    "DGA_C2H4": 0.05,   # Minimal at normal temperatures
    "DGA_C2H2": 0.001,  # Essentially zero — any significant C2H2 indicates arcing
    "DGA_CO":   2.00,   # Slow cellulose (paper) aging at normal temps
    "DGA_CO2":  15.00,  # Slow paper aging (CO2/CO ≈ 7.5 under normal paper aging)
}

# Winding temperature threshold above which accelerated thermal generation begins.
# 120°C is where thermal degradation of oil begins to accelerate measurably.
DGA_THERMAL_THRESHOLD_C: float = 120.0

# Arrhenius rate constant for thermal fault gas generation.
# At T > DGA_THERMAL_THRESHOLD_C:
#   multiplier = exp(DGA_ARRHENIUS_K × (winding_temp - DGA_THERMAL_THRESHOLD_C))
# Calibration: at winding_temp=300°C, multiplier ≈ 1339×.
DGA_ARRHENIUS_K: float = 0.04

# Per-gas thermal sensitivity multipliers (relative to CH4 at 1.0).
# At high temperatures, C2H4 becomes dominant — drives Duval T2/T3 zone.
DGA_THERMAL_GAS_FACTORS: dict[str, float] = {
    "DGA_H2":   0.8,   # H2 rises with temperature but less than CH4
    "DGA_CH4":  1.0,   # Reference
    "DGA_C2H6": 0.3,   # C2H6 increases less at higher temps (more stable)
    "DGA_C2H4": 2.5,   # C2H4 dominates at high temps — drives T2/T3 Duval zone
    "DGA_C2H2": 0.02,  # C2H2 remains low in thermal faults (not electrical)
    "DGA_CO":   3.0,   # Paper degradation accelerates strongly with temp
    "DGA_CO2":  8.0,   # CO2 from paper increases even faster than CO at high temp
}

# Winding temperature above which paper (CO/CO2) degradation accelerates.
DGA_PAPER_THRESHOLD_C: float = 140.0

# Additional CO/CO2 generation multiplier for paper degradation above 140°C.
DGA_PAPER_CO_EXTRA_FACTOR: float = 5.0
DGA_PAPER_CO2_EXTRA_FACTOR: float = 3.0

# Starting (initial) gas levels for a well-maintained transformer.
# Mid-range of IEC 60599 "typical" values for a healthy 20-year-old transformer.
DGA_INITIAL_PPM: dict[str, float] = {
    "DGA_H2":   15.0,
    "DGA_CH4":   8.0,
    "DGA_C2H6": 12.0,
    "DGA_C2H4":  3.0,
    "DGA_C2H2":  0.2,
    "DGA_CO":   80.0,
    "DGA_CO2":  600.0,
}

# ---------------------------------------------------------------------------
# Load profile constants
# ---------------------------------------------------------------------------

# Weekday load: sinusoidal between LOAD_MIN_FRACTION and LOAD_MAX_FRACTION
# Peak at 14:00 local (50400 sim-seconds into the day)
LOAD_MIN_FRACTION: float = 0.35   # 35% minimum load (night trough)
LOAD_MAX_FRACTION: float = 0.85   # 85% maximum load (afternoon peak)
LOAD_PEAK_HOUR: float = 14.0      # Hour of day at peak load (2 PM)

# Weekend load reduces peak by ~20 percentage points
LOAD_WEEKEND_MAX_FRACTION: float = 0.65  # 65% max on weekends

# Ambient temperature: sinusoidal between AMBIENT_MIN_C and AMBIENT_MAX_C
# Peak at 15:00 local
AMBIENT_MIN_C: float = 15.0   # °C at night trough
AMBIENT_MAX_C: float = 35.0   # °C at afternoon peak
AMBIENT_PEAK_HOUR: float = 15.0  # Hour of day at peak ambient (3 PM)

# ---------------------------------------------------------------------------
# Economic impact constants — Decision Engine
# Based on industry averages for large power transformers (≥100 MVA)
# Sources: CIGRE WG A2.34, NERC Reliability Standards, utility case studies
# ---------------------------------------------------------------------------

# Transformer replacement cost (USD).
# Large 100 MVA autotransformer: $2.5M–$5M. Using $3.2M as representative value.
ECONOMIC_TRANSFORMER_REPLACEMENT_USD: float = 3_200_000.0

# Unplanned outage cost per day (USD).
# Combines: lost energy revenue (~$50k/day at typical wholesale rates),
# regulatory penalties ($15k/day), emergency crew dispatch ($5k/day),
# and customer compensation costs (~$15k/day average for industrial utility).
ECONOMIC_OUTAGE_COST_PER_DAY_USD: float = 85_000.0

# Planned maintenance cost (USD).
# Scheduled 2–4 hour maintenance window: crew ($3k), oil sampling ($1k),
# inspection labor ($5k), parts/consumables ($3k). Total ≈ $12k.
ECONOMIC_PLANNED_MAINTENANCE_USD: float = 12_000.0

# Production loss per planned maintenance hour (USD).
# Planned outage at off-peak can be as low as $2.1k/hr (vs $85k/day unplanned).
# 2-hour maintenance window = $4,200 typical.
ECONOMIC_MAINTENANCE_PRODUCTION_LOSS_PER_HR_USD: float = 2_100.0

# Planned maintenance window duration (hours) — typical for this class of work.
ECONOMIC_MAINTENANCE_WINDOW_HRS: float = 2.0

# Fault escalation factor for "act later" scenario.
# At 14-day delay probability of requiring emergency repair vs planned is ~3×.
ECONOMIC_DELAYED_ESCALATION_FACTOR: float = 3.5

# Expected outage duration for emergency repair (hours).
# Emergency repair without spare unit: typically 18–36 hours.
ECONOMIC_EMERGENCY_REPAIR_HRS: float = 24.0

# Expected outage duration if transformer requires replacement (days).
# Average wait for a spare large transformer: 7–14 days.
ECONOMIC_REPLACEMENT_OUTAGE_DAYS: float = 7.0

# Risk thresholds for Decision Engine
# Composite risk score (0.0–1.0) mapping to risk levels
DECISION_RISK_LOW: float = 0.25
DECISION_RISK_MEDIUM: float = 0.50
DECISION_RISK_HIGH: float = 0.70

# Hours of remaining useful life below which "act now" recommendation fires
DECISION_ACT_NOW_THRESHOLD_HRS: float = 72.0
