"""
TransformerTwin — BaseScenario abstract class.

All fault scenarios extend this class and implement the modifier methods.
"""

from abc import ABC, abstractmethod

from models.schemas import TransformerState


class BaseScenario(ABC):
    """Abstract base for all fault scenarios.

    Attributes:
        scenario_id: Canonical ScenarioId string.
        name: Human-readable scenario name.
        description: Brief description shown on trigger.
        duration_sim_s: Total scenario duration in simulation seconds.
    """

    scenario_id: str
    name: str
    description: str
    duration_sim_s: int

    def __init__(self) -> None:
        self.elapsed_sim_time: float = 0.0
        self.started_at: str = ""

    @property
    def progress_percent(self) -> float:
        """Return progress through the scenario as 0–100%.

        Returns:
            Float between 0.0 and 100.0.
        """
        if self.duration_sim_s <= 0:
            return 0.0
        return round(min(100.0, (self.elapsed_sim_time / self.duration_sim_s) * 100), 1)

    @abstractmethod
    def get_current_stage(self) -> str:
        """Return the human-readable description of the current scenario stage.

        Returns:
            Stage description string (e.g., "Stage 2: Gas generation beginning").
        """

    @abstractmethod
    def get_thermal_modifiers(self) -> dict[str, float]:
        """Return additive temperature offsets to apply to the thermal model.

        Returns:
            Dict with optional keys: winding_temp_offset, top_oil_temp_offset.
        """

    @abstractmethod
    def get_dga_modifiers(self) -> dict[str, float]:
        """Return per-gas generation rate multipliers for the DGA model.

        Returns:
            Dict mapping sensor ID (DGA_*) to rate multiplier (1.0 = normal).
        """

    def advance(self, delta_sim_s: float) -> None:
        """Advance scenario clock by delta_sim_s seconds.

        Args:
            delta_sim_s: Simulation seconds elapsed since last tick.
        """
        self.elapsed_sim_time = round(self.elapsed_sim_time + delta_sim_s, 1)
