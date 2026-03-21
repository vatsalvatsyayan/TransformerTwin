"""
TransformerTwin — DGA gas generation model.

Tracks 7 dissolved gases (ppm) that accumulate over simulation time.
Three generation mechanisms: normal aging, thermal fault (Arrhenius), and
scenario injection (direct ppm/s).

Gases never reset — they reflect real dissolved-gas behaviour in transformer oil.
"""

import math
import logging
from dataclasses import dataclass, field

from config import (
    DGA_BASE_RATES_PPM_PER_HR,
    DGA_THERMAL_THRESHOLD_C,
    DGA_ARRHENIUS_K,
    DGA_THERMAL_GAS_FACTORS,
    DGA_PAPER_THRESHOLD_C,
    DGA_PAPER_CO_EXTRA_FACTOR,
    DGA_PAPER_CO2_EXTRA_FACTOR,
    DGA_INITIAL_PPM,
)

logger = logging.getLogger(__name__)


@dataclass
class DGAState:
    """Snapshot of all 7 dissolved gas concentrations."""

    gas_ppm: dict[str, float] = field(default_factory=dict)


def _compute_base_generation(dt_s: float) -> dict[str, float]:
    """Gas generation from normal aging over dt_s simulation seconds.

    Args:
        dt_s: Simulation seconds elapsed.

    Returns:
        Dict of {gas_id: ppm_increment} from normal aging.
    """
    dt_hr = dt_s / 3600.0
    return {gas_id: rate * dt_hr for gas_id, rate in DGA_BASE_RATES_PPM_PER_HR.items()}


def _compute_thermal_generation(dt_s: float, winding_temp: float) -> dict[str, float]:
    """Additional gas generation due to thermal fault (winding hot spot).

    Only applied when winding_temp > DGA_THERMAL_THRESHOLD_C.
    Returns ADDITIONAL ppm on top of base generation.

    Args:
        dt_s: Simulation seconds elapsed.
        winding_temp: Current winding hot spot temperature (°C).

    Returns:
        Dict of {gas_id: additional_ppm} from thermal fault.
    """
    zero = {gas_id: 0.0 for gas_id in DGA_BASE_RATES_PPM_PER_HR}

    if winding_temp <= DGA_THERMAL_THRESHOLD_C:
        return zero

    dt_hr = dt_s / 3600.0
    arrhenius = math.exp(DGA_ARRHENIUS_K * (winding_temp - DGA_THERMAL_THRESHOLD_C))

    extra: dict[str, float] = {}
    for gas_id, base_rate in DGA_BASE_RATES_PPM_PER_HR.items():
        thermal_factor = DGA_THERMAL_GAS_FACTORS[gas_id]
        # Additional generation above base rate (arrhenius - 1 = excess multiplier)
        extra[gas_id] = base_rate * (arrhenius - 1.0) * thermal_factor * dt_hr

    # Extra paper degradation above 140°C
    if winding_temp > DGA_PAPER_THRESHOLD_C:
        paper_arr = math.exp(DGA_ARRHENIUS_K * (winding_temp - DGA_PAPER_THRESHOLD_C))
        extra["DGA_CO"] += (
            DGA_BASE_RATES_PPM_PER_HR["DGA_CO"] * paper_arr * DGA_PAPER_CO_EXTRA_FACTOR * dt_hr
        )
        extra["DGA_CO2"] += (
            DGA_BASE_RATES_PPM_PER_HR["DGA_CO2"] * paper_arr * DGA_PAPER_CO2_EXTRA_FACTOR * dt_hr
        )

    return extra


class DGAModel:
    """Gas generation model for dissolved gas analysis simulation.

    Maintains a running total of each gas in ppm. Gases accumulate over
    the simulation lifetime and are never reset — this models real dissolved
    gas behaviour where accumulated gas remains in the oil.
    """

    def __init__(self) -> None:
        """Initialize gas levels to DGA_INITIAL_PPM (not zero — realistic start)."""
        self.gas_ppm: dict[str, float] = dict(DGA_INITIAL_PPM)

    def tick(
        self,
        dt_s: float,
        winding_temp: float,
        scenario_modifier: dict[str, float],
    ) -> DGAState:
        """Advance DGA state by dt_s simulation seconds.

        Generation is additive: base_aging + thermal_fault + scenario_injection.
        Gases are clamped to >= 0. They are NOT clamped to initial values (can go
        above but never below zero).

        Args:
            dt_s: Simulation seconds elapsed (= tick_interval × speed_multiplier).
            winding_temp: Current winding hot spot temperature (°C).
            scenario_modifier: Direct ppm/second injections from active scenario.
                               Keys are DGA sensor IDs, values are ppm/second.
                               Empty dict for normal scenario.

        Returns:
            Updated DGAState with all 7 gas values.
        """
        base = _compute_base_generation(dt_s)
        thermal = _compute_thermal_generation(dt_s, winding_temp)

        for gas_id in self.gas_ppm:
            self.gas_ppm[gas_id] += base[gas_id] + thermal[gas_id]
            injection = scenario_modifier.get(gas_id, 0.0)
            self.gas_ppm[gas_id] += injection * dt_s

        # Clamp to non-negative (gas can't go negative)
        for gas_id in self.gas_ppm:
            self.gas_ppm[gas_id] = max(0.0, self.gas_ppm[gas_id])

        return DGAState(gas_ppm=dict(self.gas_ppm))

    def get_state(self) -> DGAState:
        """Return current gas state without advancing.

        Returns:
            DGAState snapshot of current concentrations.
        """
        return DGAState(gas_ppm=dict(self.gas_ppm))
