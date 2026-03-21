"""
TransformerTwin — Load and ambient temperature profile generators.

Produces realistic 24-hour sinusoidal load curves and diurnal ambient
temperature variations for the simulation.

Skeleton only — equations implemented in Phase 1.3.
"""

import logging
import math

logger = logging.getLogger(__name__)


class LoadProfile:
    """Generates a realistic daily load current profile.

    Load follows a sine wave: peak load at 14:00 (2 PM), trough at 03:00 (3 AM).
    Weekends have ~20% lower peak load (not yet simulated — Phase 1.3).
    """

    # Nominal base load (%)
    BASE_LOAD_PCT: float = 60.0

    # Peak load amplitude above base (%)
    LOAD_AMPLITUDE_PCT: float = 25.0

    # Hour of peak load (14 = 2 PM)
    PEAK_HOUR: float = 14.0

    def get_load_pct(self, sim_time: float) -> float:
        """Return load current (%) for a given simulation time.

        Args:
            sim_time: Simulation seconds since start.

        Returns:
            Load current as percentage (0–150), rounded to 1 decimal.
        """
        # TODO (Phase 1.3): implement sinusoidal daily + weekend pattern
        return round(self.BASE_LOAD_PCT, 1)


class AmbientProfile:
    """Generates a realistic diurnal ambient temperature cycle.

    Ambient follows a sine wave: peak at 15:00 (3 PM), trough at 05:00 (5 AM).
    """

    # Average ambient temperature (°C) — typical substation climate
    AMBIENT_MEAN_C: float = 25.0

    # Daily temperature swing (°C) — difference from mean to peak
    AMBIENT_AMPLITUDE_C: float = 8.0

    # Hour of peak ambient temperature (15 = 3 PM)
    PEAK_HOUR: float = 15.0

    def get_ambient_temp(self, sim_time: float) -> float:
        """Return ambient temperature (°C) for a given simulation time.

        Args:
            sim_time: Simulation seconds since start.

        Returns:
            Ambient temperature (°C), rounded to 1 decimal.
        """
        # TODO (Phase 1.3): implement sinusoidal daily ambient pattern
        return round(self.AMBIENT_MEAN_C, 1)
