"""
TransformerTwin — Thermal physics model.

Computes winding hot spot, top oil, and bottom oil temperatures from
load current and ambient temperature using IEC 60076-7 thermal model.

Skeleton only — equations implemented in Phase 1.3.
"""

import logging

logger = logging.getLogger(__name__)


class ThermalModel:
    """IEC 60076-7 top-oil and hot-spot thermal model.

    Attributes:
        tau_oil: Oil thermal time constant (minutes).
        tau_winding: Winding thermal time constant (minutes).
    """

    # IEC 60076-7 Annex G typical values for ONAF transformer
    # Oil time constant: 150 min (average transformer oil thermal inertia)
    TAU_OIL_MINUTES: float = 150.0

    # Winding time constant: 7 min (copper windings heat/cool much faster than oil)
    TAU_WINDING_MINUTES: float = 7.0

    def __init__(self) -> None:
        self.tau_oil = self.TAU_OIL_MINUTES
        self.tau_winding = self.TAU_WINDING_MINUTES

    def compute_top_oil_temp(
        self,
        current_top_oil: float,
        load_pct: float,
        ambient_temp: float,
        delta_t_sim: float,
    ) -> float:
        """Compute new top-oil temperature using first-order thermal model.

        Args:
            current_top_oil: Current top-oil temperature (°C).
            load_pct: Load current as percent (0–150).
            ambient_temp: Ambient temperature (°C).
            delta_t_sim: Simulation time elapsed since last call (seconds).

        Returns:
            Updated top-oil temperature (°C), rounded to 1 decimal.
        """
        # TODO (Phase 1.3): implement IEC 60076-7 Eq. (2)
        return round(current_top_oil, 1)

    def compute_winding_temp(
        self,
        current_winding: float,
        top_oil_temp: float,
        load_pct: float,
        delta_t_sim: float,
    ) -> float:
        """Compute new winding hot spot temperature.

        Args:
            current_winding: Current winding temperature (°C).
            top_oil_temp: Current top-oil temperature (°C).
            load_pct: Load current as percent (0–150).
            delta_t_sim: Simulation time elapsed since last call (seconds).

        Returns:
            Updated winding hot spot temperature (°C), rounded to 1 decimal.
        """
        # TODO (Phase 1.3): implement IEC 60076-7 Eq. (3) hot-spot rise
        return round(current_winding, 1)

    def compute_bot_oil_temp(
        self,
        top_oil_temp: float,
        load_pct: float,
    ) -> float:
        """Estimate bottom-oil temperature from top-oil and load.

        Args:
            top_oil_temp: Current top-oil temperature (°C).
            load_pct: Load current as percent.

        Returns:
            Bottom-oil temperature (°C), rounded to 1 decimal.
        """
        # TODO (Phase 1.3): implement bottom-oil offset model
        return round(top_oil_temp - 15.0, 1)
