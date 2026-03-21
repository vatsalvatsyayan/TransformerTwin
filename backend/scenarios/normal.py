"""
TransformerTwin — Normal operation scenario (no fault).
"""

from scenarios.base import BaseScenario


class NormalScenario(BaseScenario):
    """Normal transformer operation. No fault modifiers applied."""

    scenario_id = "normal"
    name = "Normal Operation"
    description = "Transformer operating within all normal parameters."
    duration_sim_s = 0  # Runs indefinitely; progress stays at 0

    def get_current_stage(self) -> str:
        """Return stage label for normal operation."""
        return "Normal operation"

    def get_thermal_modifiers(self) -> dict[str, float]:
        """No thermal modifications during normal operation."""
        return {}

    def get_dga_modifiers(self) -> dict[str, float]:
        """No DGA rate modifications during normal operation."""
        return {}
