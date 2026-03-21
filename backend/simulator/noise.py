"""
TransformerTwin — Gaussian noise generators per sensor type.

Adds realistic measurement noise to all sensor outputs.
Each sensor type has its own noise profile (sigma, bounds).
"""

import logging

import numpy as np

logger = logging.getLogger(__name__)

# Random number generator — seeded for reproducible demos
# Seed is fixed so that fault scenarios look the same every run
_rng = np.random.default_rng(seed=42)

# Noise standard deviations per sensor group
# Values calibrated to typical industrial sensor accuracy specs
NOISE_SIGMA: dict[str, float] = {
    "TOP_OIL_TEMP":   0.3,   # RTD accuracy ±0.3°C
    "BOT_OIL_TEMP":   0.3,
    "WINDING_TEMP":   0.5,   # Fibre-optic hot-spot probe ±0.5°C
    "LOAD_CURRENT":   0.2,   # CT accuracy class 0.2%
    "AMBIENT_TEMP":   0.1,   # Weather station ±0.1°C
    "DGA_H2":         0.5,   # GC/TCD noise ±0.5 ppm
    "DGA_CH4":        0.3,
    "DGA_C2H6":       0.2,
    "DGA_C2H4":       0.3,
    "DGA_C2H2":       0.05,  # Lower absolute noise at low concentrations
    "DGA_CO":         1.0,
    "DGA_CO2":        5.0,
    "OIL_MOISTURE":   0.5,
    "OIL_DIELECTRIC": 0.5,
    "BUSHING_CAP_HV": 0.5,
    "BUSHING_CAP_LV": 0.5,
}


def add_noise(sensor_id: str, clean_value: float) -> float:
    """Add Gaussian noise to a sensor reading.

    Args:
        sensor_id: Canonical sensor identifier (used to look up sigma).
        clean_value: Noiseless physics model output.

    Returns:
        Noisy reading rounded to 1 decimal place.
    """
    sigma = NOISE_SIGMA.get(sensor_id, 0.1)
    noisy = clean_value + float(_rng.normal(0.0, sigma))
    return round(noisy, 1)
