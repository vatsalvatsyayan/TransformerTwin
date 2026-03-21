"""
TransformerTwin — Load and ambient temperature profile generators.

Produces realistic 24-hour sinusoidal load curves and diurnal ambient
temperature variations for the simulation.
"""

import math
import logging

from config import (
    LOAD_MIN_FRACTION,
    LOAD_MAX_FRACTION,
    LOAD_PEAK_HOUR,
    LOAD_WEEKEND_MAX_FRACTION,
    AMBIENT_MIN_C,
    AMBIENT_MAX_C,
    AMBIENT_PEAK_HOUR,
)

logger = logging.getLogger(__name__)

# Seconds in a full day — period of all sinusoidal profiles
_SECONDS_PER_DAY: float = 86400.0


def get_load_fraction(sim_time_s: float) -> float:
    """Return load as a per-unit fraction for a given simulation time.

    Weekday: sinusoidal between LOAD_MIN_FRACTION (35%) and LOAD_MAX_FRACTION (85%),
    peak at LOAD_PEAK_HOUR (14:00 local).
    Weekend: same shape but capped at LOAD_WEEKEND_MAX_FRACTION (65%).

    Both are pure functions — no side effects, deterministic.

    Args:
        sim_time_s: Simulation seconds since start (0 = midnight Monday).

    Returns:
        Per-unit load fraction in [0.0, 1.2]. Typically 0.35–0.85.
    """
    # Determine day of week (0=Monday … 6=Sunday)
    day_of_week = int(sim_time_s // _SECONDS_PER_DAY) % 7
    is_weekend = day_of_week >= 5  # Saturday or Sunday

    # Time within the current day (seconds)
    time_of_day_s = sim_time_s % _SECONDS_PER_DAY

    # Sinusoidal curve: cos(0) = 1 at peak, cos(π) = -1 at trough
    # Phase shift so cos peaks at LOAD_PEAK_HOUR
    peak_s = LOAD_PEAK_HOUR * 3600.0
    angle = 2.0 * math.pi * (time_of_day_s - peak_s) / _SECONDS_PER_DAY

    # Normalised cosine in [0, 1]: 1 at peak, 0 at trough
    norm = (1.0 - math.cos(angle)) / 2.0  # 0 at peak, 1 at trough → invert
    norm = 1.0 - norm  # 1 at peak, 0 at trough

    lo = LOAD_MIN_FRACTION
    hi = LOAD_WEEKEND_MAX_FRACTION if is_weekend else LOAD_MAX_FRACTION
    return round(lo + norm * (hi - lo), 4)


def get_ambient_temp(sim_time_s: float) -> float:
    """Return ambient temperature (°C) for a given simulation time.

    Sinusoidal between AMBIENT_MIN_C (15°C) and AMBIENT_MAX_C (35°C),
    peak at AMBIENT_PEAK_HOUR (15:00 local).

    Args:
        sim_time_s: Simulation seconds since start.

    Returns:
        Ambient temperature in °C. Typically 15–35°C.
    """
    time_of_day_s = sim_time_s % _SECONDS_PER_DAY

    peak_s = AMBIENT_PEAK_HOUR * 3600.0
    angle = 2.0 * math.pi * (time_of_day_s - peak_s) / _SECONDS_PER_DAY

    # 1 at peak, 0 at trough
    norm = 1.0 - (1.0 - math.cos(angle)) / 2.0

    return round(AMBIENT_MIN_C + norm * (AMBIENT_MAX_C - AMBIENT_MIN_C), 2)


# ---------------------------------------------------------------------------
# Legacy class wrappers — kept for backwards compatibility with older callers
# ---------------------------------------------------------------------------

class LoadProfile:
    """Thin wrapper around module-level get_load_fraction for legacy callers."""

    def get_load_pct(self, sim_time: float) -> float:
        """Return load current (%) for a given simulation time.

        Args:
            sim_time: Simulation seconds since start.

        Returns:
            Load current as percentage (0–150), rounded to 1 decimal.
        """
        return round(get_load_fraction(sim_time) * 100.0, 1)


class AmbientProfile:
    """Thin wrapper around module-level get_ambient_temp for legacy callers."""

    def get_ambient_temp(self, sim_time: float) -> float:
        """Return ambient temperature (°C) for a given simulation time.

        Args:
            sim_time: Simulation seconds since start.

        Returns:
            Ambient temperature (°C), rounded to 1 decimal.
        """
        return round(get_ambient_temp(sim_time), 1)
