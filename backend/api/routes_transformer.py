"""
TransformerTwin — GET /api/transformer route.

Returns static transformer nameplate configuration.
"""

import logging

from fastapi import APIRouter

from config import (
    TRANSFORMER_COOLING_TYPE,
    TRANSFORMER_ID,
    TRANSFORMER_LOCATION,
    TRANSFORMER_MANUFACTURER,
    TRANSFORMER_NAME,
    TRANSFORMER_OIL_VOLUME_LITERS,
    TRANSFORMER_RATING_MVA,
    TRANSFORMER_VOLTAGE_HV_KV,
    TRANSFORMER_VOLTAGE_LV_KV,
    TRANSFORMER_YEAR_MANUFACTURED,
)
from models.schemas import TransformerInfoSchema

logger = logging.getLogger(__name__)

router = APIRouter()

_TRANSFORMER_INFO = TransformerInfoSchema(
    id=TRANSFORMER_ID,
    name=TRANSFORMER_NAME,
    manufacturer=TRANSFORMER_MANUFACTURER,
    rating_mva=TRANSFORMER_RATING_MVA,
    voltage_hv_kv=TRANSFORMER_VOLTAGE_HV_KV,
    voltage_lv_kv=TRANSFORMER_VOLTAGE_LV_KV,
    cooling_type=TRANSFORMER_COOLING_TYPE,
    year_manufactured=TRANSFORMER_YEAR_MANUFACTURED,
    oil_volume_liters=TRANSFORMER_OIL_VOLUME_LITERS,
    location=TRANSFORMER_LOCATION,
)


@router.get("/transformer", response_model=TransformerInfoSchema)
async def get_transformer() -> TransformerInfoSchema:
    """Return static transformer nameplate configuration.

    Returns:
        TransformerInfoSchema with all nameplate fields.
    """
    return _TRANSFORMER_INFO
