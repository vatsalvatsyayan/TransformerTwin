"""
TransformerTwin — ScenarioManager: state machine for fault scenarios.

Manages the lifecycle of the active scenario: triggering, advancing,
and querying progress.
"""

import logging
from datetime import datetime, timezone

from scenarios.base import BaseScenario
from scenarios.arcing import ArcingScenario
from scenarios.cooling_failure import CoolingFailureScenario
from scenarios.hot_spot import HotSpotScenario
from scenarios.normal import NormalScenario
from scenarios.partial_discharge import PartialDischargeScenario
from scenarios.paper_degradation import PaperDegradationScenario

logger = logging.getLogger(__name__)

# Registry of all available scenarios (keyed by scenario_id)
SCENARIO_REGISTRY: dict[str, type[BaseScenario]] = {
    "normal": NormalScenario,
    "hot_spot": HotSpotScenario,
    "arcing": ArcingScenario,
    "cooling_failure": CoolingFailureScenario,
    "partial_discharge": PartialDischargeScenario,
    "paper_degradation": PaperDegradationScenario,
}


class ScenarioManager:
    """Manages the active fault scenario and its progression.

    Attributes:
        active_scenario: Currently executing BaseScenario instance.
    """

    def __init__(self) -> None:
        self.active_scenario: BaseScenario = NormalScenario()
        self.active_scenario.started_at = (
            datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        )

    def trigger(self, scenario_id: str) -> BaseScenario:
        """Switch to a new scenario, resetting its elapsed time.

        Args:
            scenario_id: One of the 4 canonical ScenarioId values.

        Returns:
            The newly activated BaseScenario instance.

        Raises:
            ValueError: If scenario_id is not in the registry.
        """
        if scenario_id not in SCENARIO_REGISTRY:
            raise ValueError(
                f"Unknown scenario: '{scenario_id}'. "
                f"Valid values: {', '.join(SCENARIO_REGISTRY)}"
            )

        cls = SCENARIO_REGISTRY[scenario_id]
        scenario = cls()
        scenario.elapsed_sim_time = 0.0
        scenario.started_at = (
            datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        )
        self.active_scenario = scenario
        logger.info("Scenario triggered: %s (%s)", scenario_id, scenario.name)
        return scenario

    def advance(self, delta_sim_s: float) -> None:
        """Advance the active scenario by delta_sim_s simulation seconds.

        Args:
            delta_sim_s: Simulation time elapsed since last call.
        """
        self.active_scenario.advance(delta_sim_s)

    def is_complete(self) -> bool:
        """Return True if the active scenario has finished its full duration.

        Returns:
            True when progress_percent >= 100.
        """
        scenario = self.active_scenario
        if scenario.scenario_id == "normal":
            return False
        return scenario.elapsed_sim_time >= scenario.duration_sim_s
