"""
TransformerTwin — FM-006 Cooling Fan Failure scenario.

Fan bank failure causes progressive oil and winding temperature rise.
Duration: 1 simulated hour (3600 sim-seconds).

No direct gas injection — thermal model handles gas via Arrhenius
acceleration as oil temperature rises (docs/DGA_GAS_GENERATION.md Section 4.4).
"""

from config import SCENARIO_COOLING_FAILURE_DURATION_S
from scenarios.base import BaseScenario

_STAGE_1_END_S: float = 900.0    # 0–15 min
_STAGE_2_END_S: float = 2160.0   # 15–36 min
_STAGE_3_END_S: float = 3060.0   # 36–51 min


class CoolingFailureScenario(BaseScenario):
    """FM-006: Cooling fan failure causing progressive overheating."""

    scenario_id = "cooling_failure"
    name = "Cooling Fan Failure"
    description = (
        "Cooling fan bank failure causing progressive oil temperature rise. "
        "Develops over 1 simulated hour."
    )
    duration_sim_s = SCENARIO_COOLING_FAILURE_DURATION_S

    def get_current_stage(self) -> str:
        """Return current stage description based on elapsed sim time."""
        t = self.elapsed_sim_time
        if t < _STAGE_1_END_S:
            return "Stage 1: Fan bank 1 fails — reduced cooling capacity"
        elif t < _STAGE_2_END_S:
            return "Stage 2: Temperature rising — CAUTION threshold approaching"
        elif t < _STAGE_3_END_S:
            return "Stage 3: Temperature at WARNING — fan bank 2 overloaded"
        else:
            return "Stage 4: Critical overheating"

    def get_thermal_modifiers(self) -> dict[str, float]:
        """Force ONAN cooling throughout the scenario.

        The "cooling_mode_override" key is read by SimulatorEngine._tick()
        and passed to EquipmentModel.update(), overriding fan/pump state.

        Returns:
            Dict with cooling_mode_override set to "ONAN".
        """
        return {
            "winding_delta": 0.0,
            "cooling_mode_override": "ONAN",
        }

    def get_dga_modifiers(self) -> dict[str, float]:
        """No direct gas injection — thermal rise drives Arrhenius generation.

        Returns:
            Empty dict.
        """
        return {}
