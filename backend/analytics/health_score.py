"""
TransformerTwin — Health score calculator.

Computes a weighted composite health score (0–100) from component
status levels using the weights defined in config.py.

Skeleton only — implemented in Phase 2.4.
"""

import logging

from config import HEALTH_WEIGHTS, HEALTH_STATUS_GOOD, HEALTH_STATUS_FAIR, HEALTH_STATUS_POOR
from models.schemas import TransformerState

logger = logging.getLogger(__name__)


class HealthScoreCalculator:
    """Computes composite transformer health score.

    Score starts at 100 and deductions are made based on penalty points
    for each component that is in CAUTION / WARNING / CRITICAL state.
    """

    def compute(
        self,
        state: TransformerState,
        dga_analysis: dict | None = None,
        anomalies: list[dict] | None = None,
    ) -> dict:
        """Compute the overall health score and component breakdown.

        Args:
            state: Current transformer simulation state.
            dga_analysis: DGA analysis result (optional).
            anomalies: Detected anomalies (optional).

        Returns:
            Dict matching HealthResponseSchema structure.
        """
        # TODO (Phase 2.4): implement weighted penalty deduction model
        components = {
            key: {"status": "NORMAL", "penalty": 0, "weight": weight, "contribution": 0.0}
            for key, weight in HEALTH_WEIGHTS.items()
        }
        overall_score = 100.0

        status = self._score_to_label(overall_score)

        return {
            "overall_score": round(overall_score, 1),
            "status": status,
            "components": components,
        }

    def _score_to_label(self, score: float) -> str:
        """Map a numeric score to a health status label.

        Args:
            score: Health score (0–100).

        Returns:
            One of "GOOD", "FAIR", "POOR", "CRITICAL".
        """
        if score >= HEALTH_STATUS_GOOD:
            return "GOOD"
        elif score >= HEALTH_STATUS_FAIR:
            return "FAIR"
        elif score >= HEALTH_STATUS_POOR:
            return "POOR"
        return "CRITICAL"
