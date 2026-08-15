"""Drives the real ASGI app end to end for /api/v1/catalog. Overrides
settings/cache dependencies to point at a tmp_path snapshot_dir instead of
touching Postgres — these endpoints only ever read pre-baked files from
disk (see workers/tasks/bake_snapshot.py, which is what actually builds
them from the database).
"""

import gzip
import json
from datetime import UTC, datetime

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_cache, get_settings
from app.infra.cache.memory import MemoryCache
from app.main import app
from app.services.snapshot_service import SnapshotObject, SnapshotResult, write_snapshot
from app.settings import Settings

SAMPLE_OBJECT: SnapshotObject = {
    "OBJECT_NAME": "ORCAS-CATALOG-TEST",
    "OBJECT_ID": "2026-900A",
    "EPOCH": "2026-01-01T00:00:00+00:00",
    "MEAN_MOTION": 15.5,
    "ECCENTRICITY": 0.001,
    "INCLINATION": 51.6,
    "RA_OF_ASC_NODE": 120.0,
    "ARG_OF_PERICENTER": 45.0,
    "MEAN_ANOMALY": 200.0,
    "EPHEMERIS_TYPE": 0,
    "CLASSIFICATION_TYPE": "U",
    "NORAD_CAT_ID": "900001",
    "ELEMENT_SET_NO": 1,
    "REV_AT_EPOCH": 100,
    "BSTAR": 0.0001,
    "MEAN_MOTION_DOT": 0.0,
    "MEAN_MOTION_DDOT": 0.0,
    "OBJECT_TYPE": None,
    "IS_ACTIVE": True,
    "SOURCE_TYPE": "real",
}


@pytest.fixture(autouse=True)
def _override_deps(tmp_path):  # type: ignore[no-untyped-def]
    test_settings = Settings(snapshot_dir=str(tmp_path))
    cache = MemoryCache()  # one instance — see test_objects_api_caching.py's note
    app.dependency_overrides[get_settings] = lambda: test_settings
    app.dependency_overrides[get_cache] = lambda: cache

    yield tmp_path

    app.dependency_overrides.pop(get_settings, None)
    app.dependency_overrides.pop(get_cache, None)


async def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_snapshot_endpoint_503s_when_not_yet_generated() -> None:
    async with await _client() as client:
        response = await client.get("/api/v1/catalog/snapshot")
    assert response.status_code == 503


@pytest.mark.asyncio
async def test_meta_endpoint_503s_when_not_yet_generated() -> None:
    async with await _client() as client:
        response = await client.get("/api/v1/catalog/meta")
    assert response.status_code == 503


@pytest.mark.asyncio
async def test_snapshot_and_meta_endpoints_serve_the_baked_bundle(_override_deps) -> None:  # type: ignore[no-untyped-def]
    tmp_path = _override_deps
    result = SnapshotResult(
        objects=[SAMPLE_OBJECT], newest_epoch=datetime(2026, 1, 1, tzinfo=UTC), source="celestrak"
    )
    write_snapshot(result, str(tmp_path))

    async with await _client() as client:
        snapshot_response = await client.get("/api/v1/catalog/snapshot")
        meta_response = await client.get("/api/v1/catalog/meta")

    assert snapshot_response.status_code == 200
    body = snapshot_response.content
    try:
        payload = json.loads(gzip.decompress(body))
    except OSError:
        # httpx transparently decoded the Content-Encoding: gzip response —
        # .content is already the plain JSON bytes, same as a browser would see.
        payload = json.loads(body)
    assert payload[0]["NORAD_CAT_ID"] == "900001"

    assert meta_response.status_code == 200
    meta = meta_response.json()
    assert meta["object_count"] == 1
    assert meta["source"] == "celestrak"
