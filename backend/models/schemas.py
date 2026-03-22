"""
TransformerTwin — Pydantic schemas for all API requests, responses, and internal types.

All field names, enum values, and structures match the Integration Contract exactly.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Canonical string literal types (mirroring Integration Contract Section 1)
# ---------------------------------------------------------------------------

SensorId = Literal[
    "TOP_OIL_TEMP",
    "BOT_OIL_TEMP",
    "WINDING_TEMP",
    "LOAD_CURRENT",
    "AMBIENT_TEMP",
    "DGA_H2",
    "DGA_CH4",
    "DGA_C2H6",
    "DGA_C2H4",
    "DGA_C2H2",
    "DGA_CO",
    "DGA_CO2",
    "FAN_BANK_1",
    "FAN_BANK_2",
    "OIL_PUMP_1",
    "TAP_POSITION",
    "TAP_OP_COUNT",
    "OIL_MOISTURE",
    "OIL_DIELECTRIC",
    "BUSHING_CAP_HV",
    "BUSHING_CAP_LV",
]

SensorGroup = Literal["thermal", "dga", "equipment", "diagnostic"]

SensorStatus = Literal["NORMAL", "CAUTION", "WARNING", "CRITICAL"]

AlertSeverity = Literal["INFO", "WARNING", "CRITICAL"]

AlertSource = Literal["ANOMALY_ENGINE", "FMEA_ENGINE", "THRESHOLD"]

CoolingMode = Literal["ONAN", "ONAF", "OFAF"]

ScenarioId = Literal["normal", "hot_spot", "arcing", "cooling_failure", "partial_discharge", "paper_degradation", "thermal_runaway"]

DuvalZone = Literal["PD", "T1", "T2", "T3", "D1", "D2", "DT", "NONE"]

FailureModeId = Literal[
    "FM-001", "FM-002", "FM-003", "FM-004",
    "FM-005", "FM-006", "FM-007", "FM-008",
]

FMEAConfidence = Literal["Monitoring", "Possible", "Probable"]

GasRateTrend = Literal["RISING", "STABLE", "FALLING"]

HealthComponentKey = Literal[
    "dga", "winding_temp", "oil_temp", "cooling", "oil_quality", "bushing"
]

HealthStatusLabel = Literal["GOOD", "FAIR", "POOR", "CRITICAL"]


# ---------------------------------------------------------------------------
# Internal state model (not serialized to API directly)
# ---------------------------------------------------------------------------

class TransformerState(BaseModel):
    """Mutable simulation state carried between ticks.

    Physics-based "expected" fields (expected_*) hold the IEC 60076-7 model
    prediction for current load/ambient/cooling without any fault modifier.
    The gap between actual and expected is the core digital-twin anomaly signal.
    """

    sim_time: float = 0.0
    top_oil_temp: float = 55.0
    bot_oil_temp: float = 45.0
    winding_temp: float = 75.0
    load_current: float = 60.0
    ambient_temp: float = 25.0
    # DGA defaults match DGA_INITIAL_PPM in config.py (aged-transformer baseline)
    dga_h2: float = 25.0
    dga_ch4: float = 12.0
    dga_c2h6: float = 15.0
    dga_c2h4: float = 4.0
    dga_c2h2: float = 0.5
    dga_co: float = 120.0
    dga_co2: float = 900.0
    fan_bank_1: bool = True
    fan_bank_2: bool = False
    oil_pump_1: bool = True
    tap_position: int = 17
    tap_op_count: int = 0
    oil_moisture: float = 8.0
    oil_dielectric: float = 55.0
    bushing_cap_hv: float = 500.0
    bushing_cap_lv: float = 420.0
    cooling_mode: str = "ONAF"

    # --- Physics-based model predictions (IEC 60076-7 without fault modifiers) ---
    # These represent what the thermal model says temperatures SHOULD be at the
    # current load, ambient, and cooling mode — the digital-twin "expected value".
    # The deviation (actual - expected) is the fault signature.
    expected_top_oil_temp: float = 0.0
    expected_winding_temp: float = 0.0
    expected_bot_oil_temp: float = 0.0


# ---------------------------------------------------------------------------
# Sensor reading (used in sensor_update WS message and REST responses)
# ---------------------------------------------------------------------------

class SensorReadingSchema(BaseModel):
    """A single sensor reading at a point in time."""

    value: float
    unit: str
    status: str  # SensorStatus or "ON"/"OFF" for equipment
    expected: float | None = None  # Only for thermal sensors


class SensorHistoryPointSchema(BaseModel):
    """One row in sensor history."""

    timestamp: str
    value: float
    sim_time: float


# ---------------------------------------------------------------------------
# REST: GET /api/transformer
# ---------------------------------------------------------------------------

class TransformerInfoSchema(BaseModel):
    """Static transformer nameplate data."""

    id: str
    name: str
    manufacturer: str
    rating_mva: float
    voltage_hv_kv: float
    voltage_lv_kv: float
    cooling_type: str
    year_manufactured: int
    oil_volume_liters: float
    location: str


# ---------------------------------------------------------------------------
# REST: GET /api/sensors/current
# ---------------------------------------------------------------------------

class SensorsCurrentResponseSchema(BaseModel):
    """All 21 sensor readings at the latest sim tick."""

    timestamp: str
    sim_time: float
    sensors: dict[str, SensorReadingSchema]


# ---------------------------------------------------------------------------
# REST: GET /api/sensors/history
# ---------------------------------------------------------------------------

class SensorHistoryResponseSchema(BaseModel):
    """History for a single sensor."""

    sensor_id: str
    unit: str
    readings: list[SensorHistoryPointSchema]


# ---------------------------------------------------------------------------
# REST: GET /api/health
# ---------------------------------------------------------------------------

class HealthComponentDetailSchema(BaseModel):
    """Per-component health breakdown (REST response — full detail)."""

    status: SensorStatus
    penalty: int
    weight: float
    contribution: float


class HealthResponseSchema(BaseModel):
    """Current transformer health score."""

    timestamp: str
    overall_score: float
    status: HealthStatusLabel
    components: dict[HealthComponentKey, HealthComponentDetailSchema]


# ---------------------------------------------------------------------------
# REST: GET /api/health/history
# ---------------------------------------------------------------------------

class HealthHistoryPointSchema(BaseModel):
    timestamp: str
    overall_score: float
    sim_time: float


class HealthHistoryResponseSchema(BaseModel):
    scores: list[HealthHistoryPointSchema]


# ---------------------------------------------------------------------------
# REST: GET /api/dga/analysis
# ---------------------------------------------------------------------------

class DuvalPointSchema(BaseModel):
    x: float  # pct_ch4 / 100
    y: float  # pct_c2h4 / 100
    z: float  # pct_c2h2 / 100


class DuvalResultSchema(BaseModel):
    pct_ch4: float
    pct_c2h4: float
    pct_c2h2: float
    zone: DuvalZone
    zone_label: str
    point: DuvalPointSchema


class TDCGSchema(BaseModel):
    value: int
    unit: str = "ppm"
    status: SensorStatus


class CO2CORatioSchema(BaseModel):
    value: float
    interpretation: str


class GasRateSchema(BaseModel):
    rate_ppm_per_day: float
    trend: GasRateTrend


class DGAAnalysisResponseSchema(BaseModel):
    timestamp: str
    duval: DuvalResultSchema
    tdcg: TDCGSchema
    co2_co_ratio: CO2CORatioSchema
    gas_rates: dict[str, GasRateSchema]


# ---------------------------------------------------------------------------
# REST: GET /api/fmea
# ---------------------------------------------------------------------------

class FMEAEvidenceSchema(BaseModel):
    condition: str
    matched: bool
    value: str


class FMEAActiveModeSchema(BaseModel):
    id: str  # FailureModeId
    name: str
    match_score: float
    confidence_label: FMEAConfidence
    severity: int
    affected_components: list[str]
    evidence: list[FMEAEvidenceSchema]
    recommended_actions: list[str]
    development_time: str


class FMEAResponseSchema(BaseModel):
    timestamp: str
    active_modes: list[FMEAActiveModeSchema]


# ---------------------------------------------------------------------------
# REST: GET /api/alerts  &  WebSocket alert message body
# ---------------------------------------------------------------------------

class AlertSchema(BaseModel):
    id: int
    timestamp: str
    severity: AlertSeverity
    title: str
    description: str
    source: AlertSource
    sensor_ids: list[str]
    failure_mode_id: str | None = None
    recommended_actions: list[str]
    acknowledged: bool
    acknowledged_at: str | None = None
    sim_time: float


class AlertsListResponseSchema(BaseModel):
    alerts: list[AlertSchema]
    total_count: int
    active_count: int


class AlertAckResponseSchema(BaseModel):
    id: int
    acknowledged: bool
    acknowledged_at: str


# ---------------------------------------------------------------------------
# REST: POST /api/simulation
# ---------------------------------------------------------------------------

class SimulationRequestSchema(BaseModel):
    load_percent: float = Field(ge=0.0, le=150.0)
    ambient_temp_c: float = Field(ge=-10.0, le=50.0)
    cooling_mode: CoolingMode
    time_horizon_days: int = Field(ge=1, le=30)


class ProjectionDaySchema(BaseModel):
    day: int
    hotspot_temp_c: float
    top_oil_temp_c: float
    aging_factor: float


class SimulationResponseSchema(BaseModel):
    projected_hotspot_temp_c: float
    projected_top_oil_temp_c: float
    aging_acceleration_factor: float
    aging_interpretation: str
    estimated_days_to_warning: float | None
    cooling_energy_impact_percent: float
    cooling_energy_interpretation: str
    projection_timeline: list[ProjectionDaySchema]


# ---------------------------------------------------------------------------
# REST: POST /api/scenario/{scenario_id}/trigger
# ---------------------------------------------------------------------------

class ScenarioTriggerResponseSchema(BaseModel):
    scenario_id: ScenarioId
    name: str
    status: str  # "TRIGGERED"
    description: str
    started_at: str


# ---------------------------------------------------------------------------
# REST: GET /api/scenario/status
# ---------------------------------------------------------------------------

class ScenarioStatusResponseSchema(BaseModel):
    active_scenario: ScenarioId
    name: str
    started_at: str
    elapsed_sim_time: float
    progress_percent: float
    stage: str


# ---------------------------------------------------------------------------
# REST: PUT /api/simulation/speed
# ---------------------------------------------------------------------------

class SpeedUpdateRequestSchema(BaseModel):
    speed_multiplier: int = Field(ge=1, le=200)


class SpeedEffectiveIntervalsSchema(BaseModel):
    thermal_ms: int
    dga_ms: int
    equipment_ms: int
    diagnostic_ms: int


class SpeedUpdateResponseSchema(BaseModel):
    speed_multiplier: int
    effective_intervals: SpeedEffectiveIntervalsSchema


# ---------------------------------------------------------------------------
# REST: Operator action control
# ---------------------------------------------------------------------------

OperatorActionType = Literal[
    "REDUCE_LOAD_70",       # Override load to 70% rated
    "REDUCE_LOAD_40",       # Emergency: override load to 40% rated
    "RESTORE_LOAD",         # Clear load override — return to normal profile
    "UPGRADE_COOLING_ONAF", # Force ONAF cooling mode (forced air)
    "UPGRADE_COOLING_OFAF", # Force OFAF cooling mode (forced oil + forced air)
    "RESTORE_COOLING",      # Clear cooling override — return to automatic control
    "CLEAR_ALL",            # Clear all operator overrides
]


class OperatorActionRequestSchema(BaseModel):
    action: OperatorActionType


class OperatorStatusResponseSchema(BaseModel):
    load_override_pct: int | None = None
    cooling_override: str | None = None
    active_overrides: bool
    message: str


# ---------------------------------------------------------------------------
# WebSocket message schemas (server → client)
# ---------------------------------------------------------------------------

class WSConnectionAckSchema(BaseModel):
    type: Literal["connection_ack"] = "connection_ack"
    timestamp: str
    sim_time: float
    speed_multiplier: int
    active_scenario: ScenarioId


class WSSensorUpdateSchema(BaseModel):
    type: Literal["sensor_update"] = "sensor_update"
    timestamp: str
    sim_time: float
    group: SensorGroup
    sensors: dict[str, SensorReadingSchema]


class WSHealthComponentStatusSchema(BaseModel):
    status: SensorStatus
    contribution: float


class WSHealthUpdateSchema(BaseModel):
    type: Literal["health_update"] = "health_update"
    timestamp: str
    sim_time: float
    overall_score: float
    previous_score: float
    components: dict[HealthComponentKey, WSHealthComponentStatusSchema]


class WSAlertMessageSchema(BaseModel):
    type: Literal["alert"] = "alert"
    alert: AlertSchema


class WSScenarioUpdateSchema(BaseModel):
    type: Literal["scenario_update"] = "scenario_update"
    scenario_id: ScenarioId
    name: str
    stage: str
    progress_percent: float
    elapsed_sim_time: float
    terminal_failure: bool = False   # True when Stage 6 (relay trip) is active


class WSPingSchema(BaseModel):
    type: Literal["ping"] = "ping"
    timestamp: str


class WSErrorSchema(BaseModel):
    type: Literal["error"] = "error"
    code: str
    message: str


# ---------------------------------------------------------------------------
# WebSocket message schemas (client → server)
# ---------------------------------------------------------------------------

class WSPongSchema(BaseModel):
    type: Literal["pong"] = "pong"


class WSSetSpeedSchema(BaseModel):
    type: Literal["set_speed"] = "set_speed"
    speed_multiplier: int = Field(ge=1, le=200)


class WSTriggerScenarioSchema(BaseModel):
    type: Literal["trigger_scenario"] = "trigger_scenario"
    scenario_id: ScenarioId


class WSAcknowledgeAlertSchema(BaseModel):
    type: Literal["acknowledge_alert"] = "acknowledge_alert"
    alert_id: int
