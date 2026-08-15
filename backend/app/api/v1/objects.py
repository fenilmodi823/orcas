"""GET /api/v1/objects, /objects/{id}, /objects/{id}/ephemeris. HTTP layer
only — no physics, no SQL directly. Orchestration lives in services/. See
Rules.md layering.
"""

from datetime import datetime
from typing import cast

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_cache, get_db_session
from app.api.errors import OrcasError
from app.infra.cache.base import CacheService
from app.schemas.objects import (
    EphemerisPoint,
    EphemerisResponse,
    LatestElementSet,
    ObjectListResponse,
    SpaceObjectDetail,
    SpaceObjectSummary,
)
from app.services.catalog_service import get_latest_element_set, get_object, list_objects
from app.services.propagation_service import NoElementSetError, propagate_ephemeris

router = APIRouter(prefix="/objects", tags=["objects"])

MAX_EPHEMERIS_POINTS = 5000

# Data-Strategy.md §3 "Dynamic" TTL table.
_LIST_CACHE_TTL_SECONDS = 60
_DETAIL_CACHE_TTL_SECONDS = 300
_EPHEMERIS_CACHE_TTL_SECONDS = 300


class ObjectNotFoundError(OrcasError):
    status_code = 404

    def __init__(self, norad_id: str) -> None:
        self.detail = f"object {norad_id} not found"
        super().__init__(self.detail)


class InvalidEphemerisWindowError(OrcasError):
    status_code = 400

    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(self.detail)


class NoEphemerisDataError(OrcasError):
    status_code = 404

    def __init__(self, norad_id: str) -> None:
        self.detail = f"no element set has ever been ingested for {norad_id}"
        super().__init__(self.detail)


@router.get("", response_model=ObjectListResponse, summary="List the catalogue, paginated")
async def list_objects_endpoint(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    search: str | None = Query(
        None, description="Matches object name (substring) or exact NORAD ID"
    ),
    session: AsyncSession = Depends(get_db_session),
    cache: CacheService = Depends(get_cache),
) -> ObjectListResponse:
    cache_key = f"objects:list:{limit}:{offset}:{search or ''}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cast(ObjectListResponse, cached)

    rows, total = await list_objects(session, limit=limit, offset=offset, search=search)
    response = ObjectListResponse(
        items=[SpaceObjectSummary.model_validate(row) for row in rows],
        total=total,
        limit=limit,
        offset=offset,
    )
    await cache.set(cache_key, response, ttl_seconds=_LIST_CACHE_TTL_SECONDS)
    return response


@router.get("/{norad_id}", response_model=SpaceObjectDetail, summary="Full detail for one object")
async def get_object_endpoint(
    norad_id: str,
    session: AsyncSession = Depends(get_db_session),
    cache: CacheService = Depends(get_cache),
) -> SpaceObjectDetail:
    cache_key = f"objects:detail:{norad_id}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cast(SpaceObjectDetail, cached)

    space_object = await get_object(session, norad_id)
    if space_object is None:
        raise ObjectNotFoundError(norad_id)

    latest = await get_latest_element_set(session, space_object.id)
    response = SpaceObjectDetail(
        **SpaceObjectSummary.model_validate(space_object).model_dump(),
        latest_element_set=LatestElementSet.model_validate(latest) if latest else None,
    )
    await cache.set(cache_key, response, ttl_seconds=_DETAIL_CACHE_TTL_SECONDS)
    return response


@router.get(
    "/{norad_id}/ephemeris",
    response_model=EphemerisResponse,
    summary="Propagated track over a window",
)
async def get_ephemeris_endpoint(
    norad_id: str,
    start: datetime,
    end: datetime,
    step_seconds: float = Query(60.0, gt=0),
    session: AsyncSession = Depends(get_db_session),
    cache: CacheService = Depends(get_cache),
) -> EphemerisResponse:
    cache_key = f"objects:ephemeris:{norad_id}:{start.isoformat()}:{end.isoformat()}:{step_seconds}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cast(EphemerisResponse, cached)

    space_object = await get_object(session, norad_id)
    if space_object is None:
        raise ObjectNotFoundError(norad_id)

    if end < start:
        raise InvalidEphemerisWindowError("end must not be before start")

    estimated_points = int((end - start).total_seconds() / step_seconds) + 1
    if estimated_points > MAX_EPHEMERIS_POINTS:
        raise InvalidEphemerisWindowError(
            f"requested window would produce {estimated_points} points, "
            f"max is {MAX_EPHEMERIS_POINTS}"
        )

    try:
        result = await propagate_ephemeris(
            session,
            norad_id=norad_id,
            object_id=space_object.id,
            object_name=space_object.name,
            intl_designator=space_object.intl_designator,
            start=start,
            end=end,
            step_seconds=step_seconds,
        )
    except NoElementSetError as exc:
        raise NoEphemerisDataError(norad_id) from exc

    response = EphemerisResponse(
        norad_id=norad_id,
        element_set_epoch=result.element_set_epoch,
        points=[
            EphemerisPoint(
                at=p.at,
                latitude_deg=p.position.latitude_deg,
                longitude_deg=p.position.longitude_deg,
                altitude_km=p.position.altitude_km,
            )
            for p in result.points
        ],
    )
    await cache.set(cache_key, response, ttl_seconds=_EPHEMERIS_CACHE_TTL_SECONDS)
    return response
