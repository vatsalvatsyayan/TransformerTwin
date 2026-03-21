"""
TransformerTwin — Equipment model: fans, pump, and tap changer.

Manages cooling equipment state using hysteresis thresholds and derives
the effective cooling mode (ONAN/ONAF/OFAF) from equipment state.
"""

import logging

from config import TAP_MIN_POSITION, TAP_MAX_POSITION, TAP_NOMINAL_POSITION

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Equipment thresholds — Phase 1.3d spec (docs/PROGRESS.md)
# ---------------------------------------------------------------------------

# Fan bank 1: activates at 75°C top oil, deactivates at 70°C (hysteresis prevents cycling)
FAN1_ON_THRESHOLD_C: float = 75.0
FAN1_OFF_THRESHOLD_C: float = 70.0

# Fan bank 2: activates at 85°C top oil, deactivates at 80°C
FAN2_ON_THRESHOLD_C: float = 85.0
FAN2_OFF_THRESHOLD_C: float = 80.0

# Oil pump: activates when load > 80%, deactivates when load < 75%
PUMP_ON_LOAD_FRACTION: float = 0.80
PUMP_OFF_LOAD_FRACTION: float = 0.75

# Tap changer: follows load, ±3 taps around nominal (17) over 0–100% load range
TAP_LOAD_RANGE_TAPS: int = 3  # ±3 taps from nominal


class EquipmentModel:
    """Models auxiliary equipment state based on thermal conditions.

    Fan banks and oil pump are controlled via hysteresis thresholds to
    prevent rapid on/off cycling. Cooling mode is derived from equipment state.
    """

    def update(
        self,
        top_oil_temp: float,
        load_fraction: float,
        fan_bank_1: bool,
        fan_bank_2: bool,
        oil_pump_1: bool,
        tap_position: int,
        tap_op_count: int,
        cooling_mode_override: str | None = None,
    ) -> dict:
        """Compute updated equipment states from thermal inputs.

        Applies hysteresis: a device only turns ON when temp exceeds the ON
        threshold, and only turns OFF when temp drops below the OFF threshold.
        This prevents rapid cycling around a single setpoint.

        Args:
            top_oil_temp: Current top-oil temperature (°C).
            load_fraction: Current per-unit load (0.0–1.2).
            fan_bank_1: Current fan bank 1 state (True = running).
            fan_bank_2: Current fan bank 2 state (True = running).
            oil_pump_1: Current oil pump state (True = running).
            tap_position: Current tap position (1–33).
            tap_op_count: Cumulative tap operation count.
            cooling_mode_override: If set, force this cooling mode (used by
                cooling_failure scenario to simulate fan failure).

        Returns:
            Dict with keys: fan_bank_1, fan_bank_2, oil_pump_1,
                            tap_position, tap_op_count, cooling_mode.
        """
        # --- Fan bank 1 (hysteresis on top oil temp) ---
        if not fan_bank_1 and top_oil_temp >= FAN1_ON_THRESHOLD_C:
            fan_bank_1 = True
            logger.debug("Fan bank 1 ON (top_oil=%.1f°C)", top_oil_temp)
        elif fan_bank_1 and top_oil_temp < FAN1_OFF_THRESHOLD_C:
            fan_bank_1 = False
            logger.debug("Fan bank 1 OFF (top_oil=%.1f°C)", top_oil_temp)

        # --- Fan bank 2 (hysteresis on top oil temp) ---
        if not fan_bank_2 and top_oil_temp >= FAN2_ON_THRESHOLD_C:
            fan_bank_2 = True
            logger.debug("Fan bank 2 ON (top_oil=%.1f°C)", top_oil_temp)
        elif fan_bank_2 and top_oil_temp < FAN2_OFF_THRESHOLD_C:
            fan_bank_2 = False
            logger.debug("Fan bank 2 OFF (top_oil=%.1f°C)", top_oil_temp)

        # --- Oil pump (hysteresis on load fraction) ---
        if not oil_pump_1 and load_fraction >= PUMP_ON_LOAD_FRACTION:
            oil_pump_1 = True
            logger.debug("Oil pump ON (load=%.2f)", load_fraction)
        elif oil_pump_1 and load_fraction < PUMP_OFF_LOAD_FRACTION:
            oil_pump_1 = False
            logger.debug("Oil pump OFF (load=%.2f)", load_fraction)

        # --- Tap position: tracks load, ±TAP_LOAD_RANGE_TAPS around nominal ---
        # Map load fraction 0.0→1.0 to tap offset -TAP_LOAD_RANGE_TAPS→+TAP_LOAD_RANGE_TAPS
        tap_offset = round((load_fraction - 0.5) * 2.0 * TAP_LOAD_RANGE_TAPS)
        new_tap = TAP_NOMINAL_POSITION + tap_offset
        new_tap = max(TAP_MIN_POSITION, min(TAP_MAX_POSITION, new_tap))

        if new_tap != tap_position:
            tap_op_count += 1
            tap_position = new_tap

        # --- Determine cooling mode ---
        if cooling_mode_override is not None:
            cooling_mode = cooling_mode_override
        elif oil_pump_1:
            cooling_mode = "OFAF"   # Forced oil, forced air
        elif fan_bank_1 or fan_bank_2:
            cooling_mode = "ONAF"   # Natural oil, forced air
        else:
            cooling_mode = "ONAN"   # Natural oil, natural air

        return {
            "fan_bank_1": fan_bank_1,
            "fan_bank_2": fan_bank_2,
            "oil_pump_1": oil_pump_1,
            "tap_position": tap_position,
            "tap_op_count": tap_op_count,
            "cooling_mode": cooling_mode,
        }
