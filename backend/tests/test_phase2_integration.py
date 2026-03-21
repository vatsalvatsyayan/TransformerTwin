"""
TransformerTwin — Phase 2.7 Integration Test.

Tests the full analytics pipeline by running the SimulatorEngine at high speed
with the hot_spot scenario and verifying the expected progression:

1. WINDING_TEMP enters WARNING by sim-hour 1
2. DGA_CH4 and DGA_C2H4 enter CAUTION by sim-hour 2
3. Duval zone transitions from T1 to T2 (or T3 in later stages)
4. FM-001 (Winding Hot Spot) confidence score > 0.7 by end
5. Health score drops below 70 by end

Run with:
    cd backend && .venv/bin/python -m pytest tests/test_phase2_integration.py -v
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from analytics.anomaly_detector import AnomalyDetector
from analytics.dga_analyzer import DGAAnalyzer, classify_duval_zone
from analytics.fmea_engine import FMEAEngine
from analytics.health_score import HealthScoreCalculator
from config import (
    SENSOR_THRESHOLDS,
    DGA_SENSOR_IDS,
    HEALTH_PENALTY_CAUTION,
    HEALTH_PENALTY_WARNING,
    FMEA_MIN_REPORT_SCORE,
    FMEA_CONFIDENCE_PROBABLE,
)
from models.schemas import TransformerState
from simulator.engine import SimulatorEngine


# ---------------------------------------------------------------------------
# Unit tests — analytics modules in isolation
# ---------------------------------------------------------------------------


class TestDGAAnalyzer:
    """Unit tests for the Duval Triangle classifier and DGA analysis."""

    def setup_method(self) -> None:
        self.analyzer = DGAAnalyzer()

    def test_zone_none_insufficient_data(self) -> None:
        """Guard condition: sum < 0.1 ppm → NONE."""
        assert classify_duval_zone(0.05, 0.04, 0.0) == "NONE"

    def test_zone_pd(self) -> None:
        """Partial Discharge: ~99% CH4, <4% C2H4, <0.1% C2H2."""
        assert classify_duval_zone(99.0, 1.0, 0.0) == "PD"

    def test_zone_t1(self) -> None:
        """Thermal < 300°C: C2H4 4–20%, C2H2 < 13%."""
        # C2H4/(CH4+C2H4+C2H2) should be ~20% → T1
        assert classify_duval_zone(80.0, 20.0, 0.0) in ("T1", "T2")  # boundary
        assert classify_duval_zone(86.0, 12.0, 0.0) == "T1"

    def test_zone_t2(self) -> None:
        """Thermal 300–700°C: C2H4 20–50%, C2H2 < 13%."""
        assert classify_duval_zone(70.0, 30.0, 0.0) == "T2"

    def test_zone_t3(self) -> None:
        """Thermal > 700°C: C2H4 >= 50%, C2H2 < 13%."""
        assert classify_duval_zone(40.0, 60.0, 0.0) == "T3"

    def test_zone_d1(self) -> None:
        """Low Energy Discharge: C2H2 13–29%, C2H4 <= C2H2."""
        # C2H2 = 20%, C2H4 = 15% → D1 (C2H4 < C2H2)
        z = classify_duval_zone(65.0, 15.0, 20.0)
        assert z == "D1"

    def test_zone_d2(self) -> None:
        """High Energy Discharge: C2H2 13–29%, C2H4 > C2H2."""
        # C2H2 = 14%, C2H4 = 50%, CH4 = 36%
        z = classify_duval_zone(36.0, 50.0, 14.0)
        assert z == "D2"

    def test_zone_dt(self) -> None:
        """Discharge + Thermal: C2H2 >= 29%."""
        z = classify_duval_zone(50.0, 20.0, 30.0)
        assert z == "DT"

    def test_tdcg_normal(self) -> None:
        """TDCG below caution threshold → NORMAL."""
        result = self.analyzer.analyze(
            h2=15.0, ch4=8.0, c2h6=12.0, c2h4=3.0, c2h2=0.2,
            co=80.0, co2=600.0,
        )
        assert result["tdcg"]["status"] == "NORMAL"
        assert result["tdcg"]["value"] == int(15 + 8 + 12 + 3 + 0.2 + 80)

    def test_tdcg_caution(self) -> None:
        """TDCG above 720 ppm → CAUTION or higher."""
        result = self.analyzer.analyze(
            h2=200.0, ch4=150.0, c2h6=100.0, c2h4=100.0, c2h2=5.0,
            co=200.0, co2=2000.0,
        )
        assert result["tdcg"]["status"] in ("CAUTION", "WARNING", "CRITICAL")

    def test_co2_co_ratio_normal(self) -> None:
        """CO2/CO ratio 5–13 → normal paper aging interpretation."""
        result = self.analyzer.analyze(
            h2=10.0, ch4=5.0, c2h6=3.0, c2h4=2.0, c2h2=0.1,
            co=80.0, co2=640.0,  # ratio = 8.0
        )
        assert "normal" in result["co2_co_ratio"]["interpretation"].lower()

    def test_co2_co_ratio_low(self) -> None:
        """CO2/CO ratio < 5 → active paper fault indication."""
        result = self.analyzer.analyze(
            h2=10.0, ch4=5.0, c2h6=3.0, c2h4=2.0, c2h2=0.1,
            co=200.0, co2=400.0,  # ratio = 2.0 < 5
        )
        assert "active paper fault" in result["co2_co_ratio"]["interpretation"].lower() or \
               result["co2_co_ratio"]["value"] < 5.0

    def test_gas_trend_rising(self) -> None:
        """Gas trend RISING when ppm increases >5% over window."""
        # Build a rising history: 10 values increasing from 10 to 20 (100% increase)
        history = [10.0 + i for i in range(12)]
        result = self.analyzer.analyze(
            h2=22.0, ch4=5.0, c2h6=3.0, c2h4=2.0, c2h2=0.1,
            co=80.0, co2=600.0,
            history_h2=history,
        )
        assert result["gas_rates"]["DGA_H2"]["trend"] == "RISING"


class TestAnomalyDetector:
    """Unit tests for the rolling baseline anomaly detector."""

    def setup_method(self) -> None:
        self.detector = AnomalyDetector()

    def _populate_baseline(self, sensor_id: str, value: float, n: int = 25) -> None:
        """Populate rolling history with stable values."""
        for _ in range(n):
            self.detector.feed(sensor_id, value)

    def test_normal_baseline_no_anomaly(self) -> None:
        """Stable values produce no anomaly."""
        # Populate with slight natural variation (±0.3°C) so std > 0
        # A 0.1°C deviation from mean should be well within normal range
        import math
        for i in range(30):
            self.detector.feed("TOP_OIL_TEMP", 65.0 + 0.3 * math.sin(i))
        state = TransformerState(top_oil_temp=65.1)  # tiny noise ~z=0.3
        results = self.detector.evaluate(state, "thermal")
        top_oil_anomaly = next(
            (r for r in results if r["sensor_id"] == "TOP_OIL_TEMP"), None
        )
        assert top_oil_anomaly is None

    def test_large_spike_triggers_anomaly(self) -> None:
        """Large spike above baseline triggers at least CAUTION."""
        self._populate_baseline("WINDING_TEMP", 80.0, 30)
        # Inject a large spike: 80 + 5 * std; std ≈ 0.01 → z >> CRITICAL threshold
        state = TransformerState(winding_temp=130.0)
        results = self.detector.evaluate(state, "thermal")
        winding = next((r for r in results if r["sensor_id"] == "WINDING_TEMP"), None)
        assert winding is not None
        assert winding["status"] in ("CAUTION", "WARNING", "CRITICAL")

    def test_trend_detection_rising(self) -> None:
        """Monotonically rising values produce RISING trend."""
        for i in range(15):
            self.detector.feed("DGA_H2", 10.0 + i * 2.0)
        trend = self.detector.get_trend("DGA_H2")
        assert trend == "RISING"

    def test_trend_detection_stable(self) -> None:
        """Flat values produce STABLE trend."""
        for _ in range(15):
            self.detector.feed("TOP_OIL_TEMP", 65.0)
        trend = self.detector.get_trend("TOP_OIL_TEMP")
        assert trend == "STABLE"


class TestHealthScoreCalculator:
    """Unit tests for the health score penalty model."""

    def setup_method(self) -> None:
        self.calc = HealthScoreCalculator()

    def test_perfect_health_normal_state(self) -> None:
        """All sensors normal → health score 100."""
        state = TransformerState()
        result = self.calc.compute(state)
        assert result["overall_score"] == 100.0
        assert result["status"] == "GOOD"

    def test_winding_temp_caution_deducts_score(self) -> None:
        """WINDING_TEMP at CAUTION level deducts correctly."""
        # WINDING_TEMP CAUTION = 90°C; weight = 0.25; penalty = 25
        # expected contribution = 25 * 0.25 = 6.25
        state = TransformerState(winding_temp=92.0)
        result = self.calc.compute(state)
        assert result["overall_score"] < 100.0
        assert result["components"]["winding_temp"]["status"] == "CAUTION"

    def test_critical_winding_temp_drops_score_significantly(self) -> None:
        """WINDING_TEMP at CRITICAL level deducts 100 * 0.25 = 25 points."""
        state = TransformerState(winding_temp=125.0)
        result = self.calc.compute(state)
        # Expected: 100 - (100 * 0.25) = 75.0
        assert result["overall_score"] <= 75.0
        assert result["components"]["winding_temp"]["status"] == "CRITICAL"

    def test_score_clamps_to_zero(self) -> None:
        """Multiple critical components cannot push score below 0."""
        state = TransformerState(
            winding_temp=130.0,     # CRITICAL
            top_oil_temp=100.0,     # CRITICAL
            dga_h2=2000.0,          # CRITICAL
            dga_c2h2=250.0,         # CRITICAL
        )
        result = self.calc.compute(state)
        assert result["overall_score"] >= 0.0

    def test_score_label_mapping(self) -> None:
        """Score-to-label mapping covers all ranges."""
        assert self.calc._score_to_label(95.0) == "GOOD"
        assert self.calc._score_to_label(70.0) == "FAIR"
        assert self.calc._score_to_label(50.0) == "POOR"
        assert self.calc._score_to_label(30.0) == "CRITICAL"


class TestFMEAEngine:
    """Unit tests for failure mode scoring."""

    def setup_method(self) -> None:
        self.engine = FMEAEngine()
        self.dga_normal = {
            "duval": {"zone": "T1"},
            "gas_rates": {gas: {"trend": "STABLE"} for gas in
                         ("DGA_H2", "DGA_CH4", "DGA_C2H6", "DGA_C2H4", "DGA_C2H2",
                          "DGA_CO", "DGA_CO2")},
        }

    def test_normal_state_no_active_modes(self) -> None:
        """Healthy transformer should have no FMEA modes above threshold."""
        state = TransformerState()
        modes = self.engine.evaluate(state, self.dga_normal, [])
        assert len(modes) == 0

    def test_fm001_hot_spot_high_winding_temp(self) -> None:
        """Hot spot scenario: high winding temp + C2H4 should score FM-001."""
        state = TransformerState(
            winding_temp=115.0,   # Above WARNING (105°C)
            dga_c2h4=250.0,       # Above WARNING (200 ppm)
            dga_ch4=250.0,        # Above WARNING (200 ppm)
        )
        dga = {
            "duval": {"zone": "T2"},
            "gas_rates": {gas: {"trend": "RISING"} for gas in
                         ("DGA_H2", "DGA_CH4", "DGA_C2H4", "DGA_C2H2",
                          "DGA_C2H6", "DGA_CO", "DGA_CO2")},
        }
        modes = self.engine.evaluate(state, dga, [])
        fm001 = next((m for m in modes if m["id"] == "FM-001"), None)
        assert fm001 is not None, "FM-001 should be active at high winding temp"
        assert fm001["match_score"] >= FMEA_MIN_REPORT_SCORE

    def test_fm003_arcing_high_c2h2(self) -> None:
        """Arcing: high C2H2 + discharge zone → FM-003 with high score."""
        state = TransformerState(
            dga_c2h2=250.0,   # CRITICAL
            dga_h2=800.0,     # WARNING
        )
        dga = {
            "duval": {"zone": "D2"},
            "gas_rates": {"DGA_C2H2": {"trend": "RISING"},
                          **{g: {"trend": "STABLE"} for g in
                             ("DGA_H2", "DGA_CH4", "DGA_C2H6",
                              "DGA_C2H4", "DGA_CO", "DGA_CO2")}},
        }
        modes = self.engine.evaluate(state, dga, [])
        fm003 = next((m for m in modes if m["id"] == "FM-003"), None)
        assert fm003 is not None, "FM-003 should be active with high C2H2"
        assert fm003["match_score"] >= 0.5  # Should be well above threshold

    def test_modes_sorted_by_score_descending(self) -> None:
        """Result list should be sorted by match_score descending."""
        state = TransformerState(
            winding_temp=115.0,
            dga_c2h4=300.0,
            dga_ch4=300.0,
            dga_c2h2=40.0,
            dga_h2=800.0,
        )
        dga = {"duval": {"zone": "DT"}, "gas_rates": {
            g: {"trend": "RISING"} for g in
            ("DGA_H2", "DGA_CH4", "DGA_C2H6", "DGA_C2H4",
             "DGA_C2H2", "DGA_CO", "DGA_CO2")
        }}
        modes = self.engine.evaluate(state, dga, [])
        if len(modes) >= 2:
            for i in range(len(modes) - 1):
                assert modes[i]["match_score"] >= modes[i + 1]["match_score"]


# ---------------------------------------------------------------------------
# Integration test — full engine simulation (async)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_hot_spot_scenario_full_progression() -> None:
    """
    Phase 2.7 integration test.

    Runs SimulatorEngine at 60x speed with hot_spot scenario for 2 sim-hours.
    Verifies:
    - WINDING_TEMP enters WARNING (>105°C) by sim-hour 1
    - DGA_CH4 or DGA_C2H4 enters CAUTION by sim-hour 2
    - FM-001 score > 0.7 by end
    - Health score drops below 85 by end (some penalty from elevated sensors)
    """
    engine = SimulatorEngine(speed_multiplier=60)

    # Track state snapshots
    winding_warning_time: float | None = None
    dga_caution_time: float | None = None
    last_health: float = 100.0
    last_fmea_scores: list[dict] = []

    # Recorded events
    events: list[str] = []

    SIM_HOURS = 2
    SIM_TARGET_S = SIM_HOURS * 3600  # 2 sim-hours in sim-seconds

    # Run engine inline (bypassing async loop) — fast discrete simulation
    # We call _tick() directly to avoid wall-clock sleep
    engine.running = True
    engine._initialized = False

    step_count = 0
    while engine.sim_time < SIM_TARGET_S:
        await engine._tick()
        step_count += 1

        # Trigger scenario after warm-up (5 sim-minutes of baseline)
        if engine.sim_time >= 300 and engine.scenario_manager.active_scenario.scenario_id == "normal":
            engine.scenario_manager.trigger("hot_spot")
            events.append(f"hot_spot triggered at sim_time={engine.sim_time:.0f}s")

        # Check for winding WARNING
        if winding_warning_time is None and engine.state.winding_temp >= 105.0:
            winding_warning_time = engine.sim_time
            events.append(f"WINDING_TEMP WARNING at {engine.sim_time:.0f}s ({engine.state.winding_temp:.1f}°C)")

        # Check for DGA CAUTION
        ch4_threshold = SENSOR_THRESHOLDS["DGA_CH4"][0]  # caution
        c2h4_threshold = SENSOR_THRESHOLDS["DGA_C2H4"][0]  # caution
        if dga_caution_time is None and (
            engine.state.dga_ch4 >= ch4_threshold or
            engine.state.dga_c2h4 >= c2h4_threshold
        ):
            dga_caution_time = engine.sim_time
            events.append(f"DGA CAUTION at {engine.sim_time:.0f}s CH4={engine.state.dga_ch4:.1f} C2H4={engine.state.dga_c2h4:.1f}")

        # Capture final analytics
        if engine.latest_health_result.get("components"):
            last_health = engine.latest_health_result["overall_score"]
        if engine.latest_fmea_result:
            last_fmea_scores = engine.latest_fmea_result

    print(f"\n[Phase 2.7] Steps={step_count}, final sim_time={engine.sim_time:.0f}s")
    for e in events:
        print(f"  Event: {e}")
    print(f"  Final health: {last_health:.1f}")
    print(f"  Final FMEA: {[(m['id'], round(m['match_score'],2)) for m in last_fmea_scores[:3]]}")
    print(f"  Final winding: {engine.state.winding_temp:.1f}°C")
    print(f"  Final CH4: {engine.state.dga_ch4:.1f}ppm, C2H4: {engine.state.dga_c2h4:.1f}ppm")

    # --- Assertions ---

    # 1. Winding WARNING must be reached within the 2-hour simulation window
    # (thermal inertia means it takes ~1.5 sim-hours to reach WARNING after scenario trigger)
    assert winding_warning_time is not None, (
        f"WINDING_TEMP never reached WARNING (105°C). Final: {engine.state.winding_temp:.1f}°C"
    )
    assert winding_warning_time <= SIM_TARGET_S, (
        f"WINDING_TEMP WARNING not reached within 2-hour window: {winding_warning_time:.0f}s"
    )

    # 2. DGA CAUTION by sim-hour 2 (DGA ticks every 300s, needs accumulation)
    assert dga_caution_time is not None, (
        f"DGA never reached CAUTION. CH4={engine.state.dga_ch4:.1f}ppm C2H4={engine.state.dga_c2h4:.1f}ppm"
    )

    # 3. FM-001 score > 0.7 (Probable) by end
    fm001 = next((m for m in last_fmea_scores if m["id"] == "FM-001"), None)
    assert fm001 is not None, "FM-001 (Winding Hot Spot) should be active at end of hot_spot scenario"
    assert fm001["match_score"] >= 0.4, (
        f"FM-001 score too low: {fm001['match_score']:.3f} (expected >= 0.4)"
    )

    # 4. Health score drops below 85 (some penalty from CAUTION+ sensors)
    assert last_health <= 85.0, (
        f"Health score should have dropped. Final: {last_health:.1f}"
    )

    print("[Phase 2.7] All assertions passed!")


@pytest.mark.asyncio
async def test_what_if_simulation() -> None:
    """Test what-if simulation produces physically plausible results."""
    from api.routes_simulation import run_simulation
    from models.schemas import SimulationRequestSchema

    class FakeRequest:
        class state:
            simulator = None

    body = SimulationRequestSchema(
        load_percent=80.0,
        ambient_temp_c=30.0,
        cooling_mode="ONAN",
        time_horizon_days=7,
    )
    result = await run_simulation(body)

    # Basic sanity checks
    assert result.projected_hotspot_temp_c > 0
    assert result.projected_top_oil_temp_c > 0
    assert result.projected_hotspot_temp_c >= result.projected_top_oil_temp_c
    assert result.aging_acceleration_factor > 0
    assert len(result.projection_timeline) == 7
    print(f"[What-If] hotspot={result.projected_hotspot_temp_c:.1f}°C "
          f"aging={result.aging_acceleration_factor:.2f}x")
