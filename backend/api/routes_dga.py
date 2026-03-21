"""
TransformerTwin — DGA analysis REST route.

GET /api/dga/analysis — Duval Triangle, TDCG, CO2/CO ratio, gas rates
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter

from analytics.dga_analyzer import DUVAL_ZONE_LABELS, DGAAnalyzer
from models.schemas import DGAAnalysisResponseSchema

logger = logging.getLogger(__name__)

router = APIRouter()
_analyzer = DGAAnalyzer()


@router.get("/dga/analysis", response_model=DGAAnalysisResponseSchema)
async def get_dga_analysis() -> DGAAnalysisResponseSchema:
    """Return full DGA analysis result.

    Returns:
        DGAAnalysisResponseSchema with Duval, TDCG, CO2/CO, and gas rates.
    """
    # TODO (Phase 2.2): pass live state from SimulatorEngine
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    result = _analyzer.analyze(
        h2=0.0, ch4=0.0, c2h6=0.0, c2h4=0.0, c2h2=0.0, co=0.0, co2=0.0
    )
    return DGAAnalysisResponseSchema(timestamp=now, **result)
