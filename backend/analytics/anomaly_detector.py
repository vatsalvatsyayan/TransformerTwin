"""
TransformerTwin — Anomaly detection engine.

Computes expected values from the physics model and flags deviations
using a rolling baseline and z-score classification.

Skeleton only — implemented in Phase 2.1.
"""

import logging

from models.schemas import TransformerState

logger = logging.getLogger(__name__)


class AnomalyDetector:
    """Detects sensor deviations from physics-model expectations.

    Uses a rolling window of recent readings as the baseline and
    computes z-scores to classify CAUTION / WARNING / CRITICAL deviations.
    """

    def __init__(self) -> None:
        # Rolling history buffers — implemented in Phase 2.1
        self._history: dict[str, list[float]] = {}

    def evaluate(
        self,
        state: TransformerState,
        group: str,
    ) -> list[dict]:
        """Evaluate all sensors in a group for anomalies.

        Args:
            state: Current transformer simulation state.
            group: Sensor group ("thermal", "dga", "equipment", "diagnostic").

        Returns:
            List of anomaly dicts with keys: sensor_id, actual, expected,
            deviation_pct, status. Empty list if no anomalies.
        """
        # TODO (Phase 2.1): implement rolling baseline + z-score detection
        return []
