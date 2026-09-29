"""GET /api/v1/catalog/snapshot, /catalog/meta, /catalog/replay. HTTP layer only.

/snapshot and /meta serve the pre-baked files from disk and never build
the snapshot (that is the worker's job, see workers/tasks/bake_snapshot.py)
— the scene boots from them and never waits on the backend. /replay is
the exception: a deliberate user action, built from element_set history
on request through the snapshot service. See Rules.md layering.
"""

import gzip
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import cast

from fastapi import APIRouter, Depends, Query, Response
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_cache, get_db_session, get_settings
from app.api.errors import OrcasError
from app.infra.cache.base import CacheService
from app.schemas.catalog import CatalogMeta
from app.services.catalog_service import earliest_epoch
from app.services.snapshot_service import (
    META_FILENAME,
    SNAPSHOT_FILENAME,
    SnapshotObject,
    build_snapshot,
)
from app.settings import Settings

router = APIRouter(prefix="/catalog", tags=["catalog"])

# Data-Strategy.md §3 "Catalogue metadata (count, newest epoch): 1 min" —
# the snapshot bytes get the same TTL since both only change when the
# worker rebakes (every 6 h in production).
_CACHE_TTL_SECONDS = 60
_SNAPSHOT_CACHE_KEY = "catalog:snapshot:bytes"
_META_CACHE_KEY = "catalog:meta"


class SnapshotNotAvailableError(OrcasError):
    status_code = 503

    def __init__(self) -> None:
        self.detail = "catalogue snapshot not yet generated — run the bake_snapshot worker"
        super().__init__(self.detail)


class ReplayNeedsOffsetError(OrcasError):
    status_code = 422

    def __init__(self) -> None:
        self.detail = "at must carry an explicit UTC offset, e.g. 2026-09-20T12:00:00Z"
        super().__init__(self.detail)


class ReplayInFutureError(OrcasError):
    status_code = 422

    def __init__(self) -> None:
        self.detail = "replay needs a moment in the past - the future has no element sets yet"
        super().__init__(self.detail)


class ReplayBeforeHistoryError(OrcasError):
    status_code = 404

    def __init__(self, earliest: datetime | None) -> None:
        self.detail = (
            "no element sets stored at or before that moment - "
            f"the earliest is {earliest.isoformat()}"
            if earliest
            else "no element sets stored yet - run an ingest first"
        )
        super().__init__(self.detail)


# History only changes when an ingest adds rows, and an ingest adds current
# epochs, not past ones — so a replay built for one moment stays right.
_REPLAY_CACHE_TTL_SECONDS = 600


def _gzip_json(objects: list[SnapshotObject]) -> bytes:
    return gzip.compress(json.dumps(objects).encode("utf-8"))


@router.get(
    "/replay",
    response_class=Response,
    summary="The catalogue as it stood at a past moment, gzip-compressed",
)
async def get_replay_endpoint(
    at: datetime = Query(description="A past instant, ISO 8601 with an explicit UTC offset"),
    session: AsyncSession = Depends(get_db_session),
    cache: CacheService = Depends(get_cache),
) -> Response:
    """Historical replay (Phase 5): each object's newest element set at or
    before `at`, in the same format as /snapshot. Built from the database on
    request, unlike /snapshot — replay is a deliberate user action, never
    the scene's boot path, so it may wait on the backend.
    """
    if at.tzinfo is None:
        raise ReplayNeedsOffsetError()
    at = at.astimezone(UTC)
    if at > datetime.now(UTC):
        raise ReplayInFutureError()

    cache_key = f"catalog:replay:{at.isoformat()}"
    body = await cache.get(cache_key)
    if body is None:
        result = await build_snapshot(session, at=at)
        if not result.objects:
            raise ReplayBeforeHistoryError(await earliest_epoch(session))
        # ponytail: the ~32k-row build itself runs on the event loop; only the
        # serialisation is off-loaded. Fine for one user replaying locally.
        body = await run_in_threadpool(_gzip_json, result.objects)
        await cache.set(cache_key, body, ttl_seconds=_REPLAY_CACHE_TTL_SECONDS)

    return Response(
        content=body,
        media_type="application/json",
        headers={"Content-Encoding": "gzip", "X-Replay-At": at.isoformat()},
    )


@router.get(
    "/snapshot",
    response_class=Response,
    summary="Full client catalogue bundle, gzip-compressed",
)
async def get_snapshot_endpoint(
    settings: Settings = Depends(get_settings),
    cache: CacheService = Depends(get_cache),
) -> Response:
    cached_bytes = await cache.get(_SNAPSHOT_CACHE_KEY)
    if cached_bytes is None:
        path = Path(settings.snapshot_dir) / SNAPSHOT_FILENAME
        if not path.exists():
            raise SnapshotNotAvailableError()
        cached_bytes = path.read_bytes()
        await cache.set(_SNAPSHOT_CACHE_KEY, cached_bytes, ttl_seconds=_CACHE_TTL_SECONDS)

    return Response(
        content=cached_bytes,
        media_type="application/json",
        headers={"Content-Encoding": "gzip"},
    )


@router.get("/meta", response_model=CatalogMeta, summary="Object count, newest epoch, source")
async def get_meta_endpoint(
    settings: Settings = Depends(get_settings),
    cache: CacheService = Depends(get_cache),
) -> CatalogMeta:
    cached_meta = await cache.get(_META_CACHE_KEY)
    if cached_meta is not None:
        return cast(CatalogMeta, cached_meta)

    path = Path(settings.snapshot_dir) / META_FILENAME
    if not path.exists():
        raise SnapshotNotAvailableError()

    meta = CatalogMeta.model_validate_json(path.read_text(encoding="utf-8"))
    await cache.set(_META_CACHE_KEY, meta, ttl_seconds=_CACHE_TTL_SECONDS)
    return meta
