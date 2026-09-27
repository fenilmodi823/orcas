"""GET /api/v1/conjunctions. HTTP layer only - the screening worker computes
and stores conjunctions; this reads the latest run (Architecture.md:
"Conjunctions are computed and stored by the worker, not per request").
"""

from typing import cast

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_cache, get_db_session
from app.infra.cache.base import CacheService
from app.infra.db.models import Conjunction, ScreeningRun
from app.schemas.conjunctions import (
    ConjunctionItem,
    ConjunctionListResponse,
    ConjunctionParty,
    ScreeningRunInfo,
)
from app.services.screening_service import latest_run, list_conjunctions

router = APIRouter(prefix="/conjunctions", tags=["conjunctions"])

_CACHE_TTL_SECONDS = 60  # results change only when the worker completes a run


def _method(aspect_ratio: float) -> str:
    return (
        f"Upper bound over uncertainty ellipses of {aspect_ratio:g}:1 aspect ratio "
        "(Alfano 2005) - public element sets carry no covariance."
    )


def _item(c: Conjunction, run: ScreeningRun) -> ConjunctionItem:
    return ConjunctionItem(
        tca=c.tca,
        miss_distance_km=c.miss_distance_km,
        relative_speed_km_s=c.relative_speed_km_s,
        maximum_pc=c.maximum_pc,
        pc_method=c.pc_method,
        aspect_ratio=run.aspect_ratio,
        hard_body_radius_km=run.hard_body_radius_km,
        dilution_sigma_km=c.dilution_sigma_km,
        valid_2d=c.valid_2d,
        validity_reason=c.validity_reason,
        encounter_duration_s=c.encounter_duration_s,
        method=_method(run.aspect_ratio),
        primary=ConjunctionParty(
            norad_id=c.primary.norad_id,
            name=c.primary.name,
            object_type=c.primary.object_type,
            element_set_epoch=c.primary_epoch,
        ),
        secondary=ConjunctionParty(
            norad_id=c.secondary.norad_id,
            name=c.secondary.name,
            object_type=c.secondary.object_type,
            element_set_epoch=c.secondary_epoch,
        ),
    )


@router.get(
    "",
    response_model=ConjunctionListResponse,
    summary="Close approaches from the latest screening run, with maximum P_c",
)
async def list_conjunctions_endpoint(
    norad_id: str | None = Query(None, description="Only encounters involving this object"),
    limit: int = Query(50, ge=1, le=500),
    session: AsyncSession = Depends(get_db_session),
    cache: CacheService = Depends(get_cache),
) -> ConjunctionListResponse:
    cache_key = f"conjunctions:{norad_id or '*'}:{limit}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cast(ConjunctionListResponse, cached)

    run = await latest_run(session)
    if run is None:
        response = ConjunctionListResponse(run=None, items=[])
    else:
        rows = await list_conjunctions(session, run.id, norad_id, limit)
        response = ConjunctionListResponse(
            run=ScreeningRunInfo.model_validate(run, from_attributes=True),
            items=[_item(c, run) for c in rows],
        )
    await cache.set(cache_key, response, ttl_seconds=_CACHE_TTL_SECONDS)
    return response
