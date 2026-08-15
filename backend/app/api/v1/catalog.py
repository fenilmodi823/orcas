"""GET /api/v1/catalog/snapshot, /catalog/meta. HTTP layer only — serves
the pre-baked snapshot files from disk; never builds the snapshot itself
(that is the worker's job, see workers/tasks/bake_snapshot.py). See
Architecture.md's "the scene never waits on the backend" and Rules.md
layering.
"""

from pathlib import Path
from typing import cast

from fastapi import APIRouter, Depends, Response

from app.api.deps import get_cache, get_settings
from app.api.errors import OrcasError
from app.infra.cache.base import CacheService
from app.schemas.catalog import CatalogMeta
from app.services.snapshot_service import META_FILENAME, SNAPSHOT_FILENAME
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
