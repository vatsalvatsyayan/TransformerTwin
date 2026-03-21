"""
TransformerTwin — Equipment model: fans, pump, and tap changer.

Manages the on/off state of cooling equipment (fan banks, oil pump)
and simulates tap changer operation.

Skeleton only — logic implemented in Phase 1.3.
"""

import logging

logger = logging.getLogger(__name__)


class EquipmentModel:
    """Models auxiliary equipment state based on thermal conditions.

    Fan banks activate at configurable temperature thresholds.
    Oil pump activates when fan banks alone are insufficient.
    Tap changer position follows a slow-drift pattern.
    """

    # Top-oil temperature at which fan bank 1 activates (°C)
    FAN_1_ON_THRESHOLD_C: float = 65.0
    FAN_1_OFF_THRESHOLD_C: float = 60.0  # Hysteresis prevents rapid cycling

    # Top-oil temperature at which fan bank 2 activates (°C)
    FAN_2_ON_THRESHOLD_C: float = 75.0
    FAN_2_OFF_THRESHOLD_C: float = 70.0

    # Top-oil temperature at which oil pump activates (°C)
    PUMP_ON_THRESHOLD_C: float = 80.0
    PUMP_OFF_THRESHOLD_C: float = 75.0

    def update(
        self,
        top_oil_temp: float,
        fan_bank_1: bool,
        fan_bank_2: bool,
        oil_pump_1: bool,
        tap_position: int,
        tap_op_count: int,
        sim_time: float,
    ) -> dict:
        """Compute updated equipment states from thermal inputs.

        Args:
            top_oil_temp: Current top-oil temperature (°C).
            fan_bank_1: Current fan bank 1 state.
            fan_bank_2: Current fan bank 2 state.
            oil_pump_1: Current oil pump state.
            tap_position: Current tap position (1–33).
            tap_op_count: Cumulative tap operations.
            sim_time: Current simulation time (seconds).

        Returns:
            Dict with keys: fan_bank_1, fan_bank_2, oil_pump_1,
                            tap_position, tap_op_count, cooling_mode.
        """
        # TODO (Phase 1.3): implement hysteresis-based equipment control
        return {
            "fan_bank_1": fan_bank_1,
            "fan_bank_2": fan_bank_2,
            "oil_pump_1": oil_pump_1,
            "tap_position": tap_position,
            "tap_op_count": tap_op_count,
            "cooling_mode": "ONAF",
        }
