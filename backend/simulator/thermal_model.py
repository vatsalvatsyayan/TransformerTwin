"""
TransformerTwin — Thermal physics model.

Implements the IEC 60076-7 two-stage exponential lag thermal model:
  - Top oil temperature (first-order lag toward steady-state)
  - Winding hot spot temperature (second first-order lag above top oil)
  - Bottom oil temperature (linear interpolation)
"""

import math
import logging
from dataclasses import dataclass

from config import (
    THERMAL_TOP_OIL_RISE_RATED_C,
    THERMAL_WINDING_GRADIENT_C,
    THERMAL_HOT_SPOT_FACTOR_H,
    THERMAL_OIL_EXPONENT_N,
    THERMAL_WINDING_EXPONENT_M,
    THERMAL_TAU_OIL_S,
    THERMAL_TAU_WINDING_S,
    THERMAL_BOTTOM_OIL_FRACTION,
    COOLING_PARAMS,
)

logger = logging.getLogger(__name__)


@dataclass
class ThermalState:
    """Output of ThermalModel.tick() — all three temperatures and cooling mode."""

    top_oil_temp: float    # °C
    bot_oil_temp: float    # °C
    winding_temp: float    # °C
    cooling_mode: str      # "ONAN" | "ONAF" | "OFAF"


def _compute_steady_top_oil_rise(load_fraction: float, cooling_mode: str) -> float:
    """Steady-state top oil temperature rise above ambient.

    Formula: IEC 60076-7 Equation (1)
        ΔΘ_TO_steady = ΔΘ_TO_rated × rise_factor × K^(2n)

    Args:
        load_fraction: Per-unit load (e.g., 0.75 = 75%). Range 0.0–1.2.
        cooling_mode: One of "ONAN", "ONAF", "OFAF".

    Returns:
        Temperature rise in °C above ambient.
    """
    rise_factor = COOLING_PARAMS[cooling_mode]["rise_factor"]
    return THERMAL_TOP_OIL_RISE_RATED_C * rise_factor * (load_fraction ** (2.0 * THERMAL_OIL_EXPONENT_N))


def _update_top_oil_temp(
    prev_top_oil: float,
    ambient_temp: float,
    load_fraction: float,
    cooling_mode: str,
    dt_s: float,
) -> float:
    """Top oil temperature after one time step (exponential lag).

    Formula: IEC 60076-7 Equation (3)
        θ_TO(t) = θ_TO_steady + (θ_TO_prev - θ_TO_steady) × exp(-dt / τ_TO)

    Args:
        prev_top_oil: Top oil temperature at previous tick (°C).
        ambient_temp: Current ambient temperature (°C).
        load_fraction: Per-unit load.
        cooling_mode: Cooling mode string.
        dt_s: Simulation seconds elapsed.

    Returns:
        Updated top oil temperature (°C).
    """
    tau = THERMAL_TAU_OIL_S * COOLING_PARAMS[cooling_mode]["tau_factor"]
    steady = ambient_temp + _compute_steady_top_oil_rise(load_fraction, cooling_mode)
    return steady + (prev_top_oil - steady) * math.exp(-dt_s / tau)


def _compute_steady_winding_rise(load_fraction: float) -> float:
    """Steady-state winding hot spot rise above top oil temperature.

    Formula: IEC 60076-7 Equation (2)
        ΔΘ_winding_steady = H × ΔΘ_winding_rated × K^(2m)

    Args:
        load_fraction: Per-unit load.

    Returns:
        Winding rise above top oil in °C.
    """
    return (
        THERMAL_HOT_SPOT_FACTOR_H
        * THERMAL_WINDING_GRADIENT_C
        * (load_fraction ** (2.0 * THERMAL_WINDING_EXPONENT_M))
    )


def _update_winding_temp(
    prev_winding: float,
    top_oil_temp: float,
    load_fraction: float,
    dt_s: float,
) -> float:
    """Winding hot spot temperature after one time step (exponential lag).

    Formula: IEC 60076-7 Equation (4)
        θ_winding(t) = θ_winding_steady + (θ_winding_prev - θ_winding_steady) × exp(-dt / τ_w)

    Args:
        prev_winding: Winding temperature at previous tick (°C).
        top_oil_temp: Current top oil temperature (°C).
        load_fraction: Per-unit load.
        dt_s: Simulation seconds elapsed.

    Returns:
        Updated winding hot spot temperature (°C).
    """
    steady = top_oil_temp + _compute_steady_winding_rise(load_fraction)
    return steady + (prev_winding - steady) * math.exp(-dt_s / THERMAL_TAU_WINDING_S)


def _compute_bot_oil_temp(ambient_temp: float, top_oil_temp: float) -> float:
    """Bottom oil temperature via linear interpolation between ambient and top oil.

    Simplification of IEC 60076-7 Section 6.4.
    BOT_OIL = ambient + (TOP_OIL - ambient) × THERMAL_BOTTOM_OIL_FRACTION

    Args:
        ambient_temp: Ambient temperature (°C).
        top_oil_temp: Top oil temperature (°C).

    Returns:
        Bottom oil temperature (°C).
    """
    return ambient_temp + (top_oil_temp - ambient_temp) * THERMAL_BOTTOM_OIL_FRACTION


class ThermalModel:
    """IEC 60076-7 top-oil and winding hot-spot thermal model.

    Maintains internal state (top_oil, winding temperatures) across ticks.
    Initialise to steady state for a given load/ambient so there is no
    unrealistic cold-start temperature spike.
    """

    def __init__(self) -> None:
        """Initialise with placeholder state; first tick sets real values."""
        # Will be overwritten on first tick; cold start with ambient-like values
        self._top_oil: float = 55.0   # °C — warm-start approximation
        self._winding: float = 75.0   # °C — warm-start approximation

    def initialize_steady_state(
        self, load_fraction: float, ambient_temp: float, cooling_mode: str
    ) -> None:
        """Set internal state to IEC 60076-7 steady-state for given conditions.

        Call this once at simulator startup to avoid the cold-start spike.

        Args:
            load_fraction: Initial per-unit load.
            ambient_temp: Initial ambient temperature (°C).
            cooling_mode: Initial cooling mode.
        """
        top_oil_rise = _compute_steady_top_oil_rise(load_fraction, cooling_mode)
        self._top_oil = ambient_temp + top_oil_rise
        winding_rise = _compute_steady_winding_rise(load_fraction)
        self._winding = self._top_oil + winding_rise
        logger.debug(
            "ThermalModel initialized: top_oil=%.1f°C, winding=%.1f°C",
            self._top_oil,
            self._winding,
        )

    def tick(
        self,
        dt_s: float,
        load_fraction: float,
        ambient_temp: float,
        cooling_mode: str,
        winding_delta: float = 0.0,
    ) -> ThermalState:
        """Advance thermal state by dt_s simulation seconds.

        Args:
            dt_s: Simulation seconds elapsed (= tick_interval × speed_multiplier).
            load_fraction: Per-unit load, 0.0–1.2.
            ambient_temp: Ambient temperature in °C.
            cooling_mode: "ONAN", "ONAF", or "OFAF".
            winding_delta: Scenario additive offset to winding temp in °C.

        Returns:
            Updated ThermalState.
        """
        new_top_oil = _update_top_oil_temp(
            self._top_oil, ambient_temp, load_fraction, cooling_mode, dt_s
        )
        # Compute pure physics winding (no scenario delta)
        new_winding_physics = _update_winding_temp(
            self._winding, new_top_oil, load_fraction, dt_s
        )
        bot_oil = _compute_bot_oil_temp(ambient_temp, new_top_oil)

        # Store PURE physics values — scenario delta must NOT feed back into
        # the lag calculation, or the temperature diverges to infinity
        # (delta/dt * tau_winding seconds of accumulation).
        self._top_oil = new_top_oil
        self._winding = new_winding_physics

        return ThermalState(
            top_oil_temp=round(new_top_oil, 2),
            bot_oil_temp=round(bot_oil, 2),
            # Scenario delta is added to the OBSERVED output only
            winding_temp=round(new_winding_physics + winding_delta, 2),
            cooling_mode=cooling_mode,
        )
