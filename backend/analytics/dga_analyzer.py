"""
TransformerTwin — DGA analysis module.

Implements:
- Duval Triangle zone classification (IEC 60599)
- TDCG calculation and status (IEEE C57.104)
- CO2/CO ratio analysis
- Gas generation rate trends

Phase 2.2: full implementation from docs/DUVAL_TRIANGLE_VERTICES.md spec.
"""

import logging

from config import (
    TDCG_CAUTION_PPM,
    TDCG_WARNING_PPM,
    TDCG_CRITICAL_PPM,
    CO2_CO_RATIO_LOW,
    CO2_CO_RATIO_HIGH,
)

logger = logging.getLogger(__name__)

DUVAL_ZONE_LABELS: dict[str, str] = {
    "PD":   "Partial Discharge",
    "T1":   "Thermal Fault < 300°C",
    "T2":   "Thermal Fault 300–700°C",
    "T3":   "Thermal Fault > 700°C",
    "D1":   "Low Energy Discharge",
    "D2":   "High Energy Discharge",
    "DT":   "Discharge + Thermal Fault",
    "NONE": "Insufficient data for Duval analysis",
}

# Combustible gases included in TDCG (IEEE C57.104)
# CO is included; CO2 is NOT combustible and excluded
_TDCG_GASES = ("h2", "ch4", "c2h6", "c2h4", "c2h2", "co")


def classify_duval_zone(ch4_ppm: float, c2h4_ppm: float, c2h2_ppm: float) -> str:
    """Classify Duval Triangle zone from raw ppm values.

    Uses rule-based conditions per docs/DUVAL_TRIANGLE_VERTICES.md Section 2.
    Rules checked in priority order (first match wins).

    Args:
        ch4_ppm: Methane concentration (ppm).
        c2h4_ppm: Ethylene concentration (ppm).
        c2h2_ppm: Acetylene concentration (ppm).

    Returns:
        DuvalZone string: "PD", "T1", "T2", "T3", "D1", "D2", "DT", or "NONE".
    """
    total = ch4_ppm + c2h4_ppm + c2h2_ppm
    if total < 0.1:
        return "NONE"

    pct_ch4  = ch4_ppm  / total * 100.0
    pct_c2h4 = c2h4_ppm / total * 100.0
    pct_c2h2 = c2h2_ppm / total * 100.0

    # Priority 2: Partial Discharge — high CH4, essentially no C2H4/C2H2
    if pct_c2h2 < 0.1 and pct_c2h4 < 4.0 and pct_ch4 > 95.0:
        return "PD"

    # Priority 3: Discharge + Thermal — very high C2H2 fraction
    if pct_c2h2 >= 29.0:
        return "DT"

    # Priority 4: Low Energy Discharge — C2H2 dominant, C2H4 ≤ C2H2
    if pct_c2h2 >= 13.0 and pct_c2h4 <= pct_c2h2:
        return "D1"

    # Priority 5: High Energy Discharge — C2H2 dominant, C2H4 > C2H2
    if pct_c2h2 >= 13.0 and pct_c2h4 > pct_c2h2:
        return "D2"

    # Priority 6: Thermal > 700°C — high C2H4 fraction
    if pct_c2h4 >= 50.0 and pct_c2h2 < 13.0:
        return "T3"

    # Priority 7: Thermal 300–700°C — moderate C2H4
    if 20.0 <= pct_c2h4 < 50.0 and pct_c2h2 < 13.0:
        return "T2"

    # Priority 8 + 9: Thermal < 300°C (catch-all for lower C2H4)
    return "T1"


def _compute_tdcg_status(tdcg_ppm: int) -> str:
    """Map TDCG value to SensorStatus string (IEEE C57.104 Table 2).

    Args:
        tdcg_ppm: Total dissolved combustible gas sum (ppm).

    Returns:
        SensorStatus string.
    """
    if tdcg_ppm >= TDCG_CRITICAL_PPM:
        return "CRITICAL"
    if tdcg_ppm >= TDCG_WARNING_PPM:
        return "WARNING"
    if tdcg_ppm >= TDCG_CAUTION_PPM:
        return "CAUTION"
    return "NORMAL"


def _compute_gas_trend(history: list[float] | None, n_readings: int = 10) -> str:
    """Determine gas rate trend from history list.

    RISING if last reading increased >5% vs n_readings ago, FALLING if
    decreased >5%, else STABLE.

    Args:
        history: List of historical ppm readings (newest last).
        n_readings: Comparison window (default 10).

    Returns:
        "RISING", "STABLE", or "FALLING".
    """
    if history is None or len(history) < n_readings + 1:
        return "STABLE"
    older = history[-(n_readings + 1)]
    newer = history[-1]
    if older <= 0.0:
        return "STABLE"
    pct_change = (newer - older) / older
    if pct_change > 0.05:
        return "RISING"
    if pct_change < -0.05:
        return "FALLING"
    return "STABLE"


class DGAAnalyzer:
    """Performs DGA analysis on current gas concentrations.

    Methods correspond directly to the DGA analysis REST endpoint
    (Integration Contract Section 3.6).
    """

    def analyze(
        self,
        h2: float,
        ch4: float,
        c2h6: float,
        c2h4: float,
        c2h2: float,
        co: float,
        co2: float,
        history_h2: list[float] | None = None,
        history_ch4: list[float] | None = None,
        history_c2h4: list[float] | None = None,
        history_c2h2: list[float] | None = None,
        history_co: list[float] | None = None,
        history_co2: list[float] | None = None,
        history_c2h6: list[float] | None = None,
    ) -> dict:
        """Perform full DGA analysis on current gas concentrations.

        Args:
            h2: Hydrogen concentration (ppm).
            ch4: Methane concentration (ppm).
            c2h6: Ethane concentration (ppm).
            c2h4: Ethylene concentration (ppm).
            c2h2: Acetylene concentration (ppm).
            co: Carbon monoxide concentration (ppm).
            co2: Carbon dioxide concentration (ppm).
            history_*: Optional historical readings for trend analysis
                       (list of ppm values, newest last, at least 11 entries
                       for trend detection).

        Returns:
            Dict matching DGAAnalysisResponseSchema structure.
        """
        # --- Duval Triangle ---
        total_duval = ch4 + c2h4 + c2h2
        if total_duval >= 0.1:
            pct_ch4  = round(ch4  / total_duval * 100.0, 1)
            pct_c2h4 = round(c2h4 / total_duval * 100.0, 1)
            pct_c2h2 = round(c2h2 / total_duval * 100.0, 1)
        else:
            pct_ch4 = pct_c2h4 = pct_c2h2 = 0.0

        zone = classify_duval_zone(ch4, c2h4, c2h2)

        # Normalized Cartesian point for SVG renderer
        # x = pct_c2h4/100 + pct_c2h2/100 * 0.5
        # y = pct_c2h2/100 * sqrt(3)/2
        x = round(pct_c2h4 / 100.0 + pct_c2h2 / 100.0 * 0.5, 4)
        y = round(pct_c2h2 / 100.0 * 0.8660, 4)

        duval = {
            "pct_ch4": pct_ch4,
            "pct_c2h4": pct_c2h4,
            "pct_c2h2": pct_c2h2,
            "zone": zone,
            "zone_label": DUVAL_ZONE_LABELS.get(zone, "Unknown"),
            "point": {"x": x, "y": y, "z": 0.0},
        }

        # --- TDCG (Total Dissolved Combustible Gas, IEEE C57.104 Table 2) ---
        # Gases: H2 + CH4 + C2H6 + C2H4 + C2H2 + CO (CO2 excluded)
        tdcg_value = int(h2 + ch4 + c2h6 + c2h4 + c2h2 + co)
        tdcg = {
            "value": tdcg_value,
            "unit": "ppm",
            "status": _compute_tdcg_status(tdcg_value),
        }

        # --- CO2/CO ratio ---
        if co > 0.1:
            ratio = round(co2 / co, 2)
            if ratio < CO2_CO_RATIO_LOW:
                interpretation = (
                    f"Ratio {ratio:.1f} below normal range ({CO2_CO_RATIO_LOW}–"
                    f"{CO2_CO_RATIO_HIGH}): indicates active paper fault or moisture"
                )
            elif ratio > CO2_CO_RATIO_HIGH:
                interpretation = (
                    f"Ratio {ratio:.1f} above normal range ({CO2_CO_RATIO_LOW}–"
                    f"{CO2_CO_RATIO_HIGH}): may indicate oil oxidation"
                )
            else:
                interpretation = (
                    f"Ratio {ratio:.1f} within normal range ({CO2_CO_RATIO_LOW}–"
                    f"{CO2_CO_RATIO_HIGH}): normal paper aging"
                )
        else:
            ratio = 0.0
            interpretation = "Insufficient CO for ratio calculation"

        co2_co_ratio = {"value": ratio, "interpretation": interpretation}

        # --- Gas rate trends ---
        gas_rates: dict[str, dict] = {}

        _gas_history_map: dict[str, list[float] | None] = {
            "DGA_H2":   history_h2,
            "DGA_CH4":  history_ch4,
            "DGA_C2H6": history_c2h6,
            "DGA_C2H4": history_c2h4,
            "DGA_C2H2": history_c2h2,
            "DGA_CO":   history_co,
            "DGA_CO2":  history_co2,
        }
        _current_values: dict[str, float] = {
            "DGA_H2": h2, "DGA_CH4": ch4, "DGA_C2H6": c2h6,
            "DGA_C2H4": c2h4, "DGA_C2H2": c2h2,
            "DGA_CO": co, "DGA_CO2": co2,
        }

        for gas_id, hist in _gas_history_map.items():
            trend = _compute_gas_trend(hist)
            # Estimate rate_ppm_per_day from history slope if available
            if hist and len(hist) >= 2:
                # Approximate: difference between oldest and newest over span
                # Each history entry is one DGA tick (300 sim-seconds)
                # 300 sim-s per tick × len(hist) ticks / 3600 = sim-hours
                span_ticks = len(hist)
                span_sim_hours = span_ticks * 300.0 / 3600.0
                rate_per_hour = (hist[-1] - hist[0]) / max(span_sim_hours, 1.0)
                rate_ppm_per_day = round(rate_per_hour * 24.0, 2)
            else:
                rate_ppm_per_day = 0.0
            gas_rates[gas_id] = {
                "rate_ppm_per_day": rate_ppm_per_day,
                "trend": trend,
            }

        return {
            "duval": duval,
            "tdcg": tdcg,
            "co2_co_ratio": co2_co_ratio,
            "gas_rates": gas_rates,
        }

    def classify_duval_zone(
        self,
        pct_ch4: float,
        pct_c2h4: float,
        pct_c2h2: float,
    ) -> str:
        """Classify Duval Triangle zone from ternary percentages.

        Delegates to module-level classify_duval_zone after converting
        percentages to synthetic ppm values.

        Args:
            pct_ch4: CH4 as percentage of (CH4 + C2H4 + C2H2).
            pct_c2h4: C2H4 as percentage.
            pct_c2h2: C2H2 as percentage.

        Returns:
            DuvalZone string ("PD", "T1", "T2", "T3", "D1", "D2", "DT", "NONE").
        """
        # Convert percentages back to synthetic ppm for classifier (sum = 100)
        return classify_duval_zone(pct_ch4, pct_c2h4, pct_c2h2)
