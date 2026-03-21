"""
TransformerTwin — DGA analysis REST route.

GET /api/dga/analysis — Duval Triangle, TDCG, CO2/CO ratio, gas rates
"""

import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from fastapi import APIRouter, Request

from analytics.dga_analyzer import DUVAL_ZONE_LABELS, DGAAnalyzer
from models.schemas import DGAAnalysisResponseSchema

if TYPE_CHECKING:
    from simulator.engine import SimulatorEngine

logger = logging.getLogger(__name__)

router = APIRouter()
_analyzer = DGAAnalyzer()


@router.get("/dga/analysis", response_model=DGAAnalysisResponseSchema)
async def get_dga_analysis(request: Request) -> DGAAnalysisResponseSchema:
    """Return full DGA analysis result from live engine state.

    Returns:
        DGAAnalysisResponseSchema with Duval, TDCG, CO2/CO, and gas rates.
    """
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    simulator: SimulatorEngine | None = getattr(request.app.state, "simulator", None)

    if simulator is not None and simulator.latest_dga_analysis:
        result = simulator.latest_dga_analysis
    else:
        # Fallback: analyze live state if engine not yet populated
        state = simulator.get_current_state() if simulator else None
        if state:
            result = _analyzer.analyze(
                h2=state.dga_h2,
                ch4=state.dga_ch4,
                c2h6=state.dga_c2h6,
                c2h4=state.dga_c2h4,
                c2h2=state.dga_c2h2,
                co=state.dga_co,
                co2=state.dga_co2,
            )
        else:
            result = {
                "duval": {
                    "pct_ch4": 0.0,
                    "pct_c2h4": 0.0,
                    "pct_c2h2": 0.0,
                    "zone": "NONE",
                    "zone_label": DUVAL_ZONE_LABELS["NONE"],
                    "point": {"x": 0.0, "y": 0.0, "z": 0.0},
                },
                "tdcg": {"value": 0, "unit": "ppm", "status": "NORMAL"},
                "co2_co_ratio": {"value": 0.0, "interpretation": "Insufficient data"},
                "gas_rates": {},
            }

    return DGAAnalysisResponseSchema(timestamp=now, **result)
