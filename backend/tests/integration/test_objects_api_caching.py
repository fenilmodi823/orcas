"""Proves the CacheService wiring in api/v1/objects.py actually caches —
a repeat request within the TTL must not reflect a DB change made in
between. Overrides get_cache with a fresh MemoryCache per test so this
never collides with the process-wide singleton other tests may also hit.
"""

from datetime import UTC, datetime

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, select

from app.api.deps import get_cache
from app.infra.cache.memory import MemoryCache
from app.infra.db.base import get_session
from app.infra.db.models import ElementSet, SpaceObject
from app.main import app

NORAD_ID = "300301"
EXTRA_NORAD_ID = "300302"  # created mid-test by the list-caching test below
ALL_NORAD_IDS = [NORAD_ID, EXTRA_NORAD_ID]
EPOCH = datetime(2026, 1, 1, tzinfo=UTC)


@pytest.fixture(autouse=True)
def _override_cache():
    # One instance reused across the fixture's lifetime — FastAPI calls the
    # override callable fresh per request, so `lambda: MemoryCache()` would
    # hand every request its own empty cache and never actually hit.
    cache = MemoryCache()
    app.dependency_overrides[get_cache] = lambda: cache
    yield
    app.dependency_overrides.pop(get_cache, None)


@pytest_asyncio.fixture(autouse=True)
async def _seed_and_cleanup():
    async with get_session() as session:
        space_object = SpaceObject(
            norad_id=NORAD_ID, intl_designator="1998-999X", name="ORCAS-CACHE-TEST-ORIGINAL"
        )
        session.add(space_object)
        await session.flush()
        session.add(
            ElementSet(
                object_id=space_object.id,
                epoch=EPOCH,
                mean_motion=15.5,
                eccentricity=0.0001,
                inclination=51.6,
                ra_of_asc_node=0.0,
                arg_of_pericenter=0.0,
                mean_anomaly=0.0,
                bstar=0.0,
                mean_motion_dot=0.0,
                mean_motion_ddot=0.0,
                ephemeris_type=0,
                classification_type="U",
                element_set_no=999,
                rev_at_epoch=1,
                source="test",
                source_format="omm_json",
                source_type="simulation",
                ingested_at=datetime.now(UTC),
            )
        )

    yield

    # Runs on pytest fixture teardown, which fires even if the test body's
    # assertions fail — unlike cleanup written inline after an assert.
    async with get_session() as session:
        stmt = select(SpaceObject).where(SpaceObject.norad_id.in_(ALL_NORAD_IDS))
        rows = (await session.execute(stmt)).scalars().all()
        for space_object in rows:
            await session.execute(delete(ElementSet).where(ElementSet.object_id == space_object.id))
            await session.execute(delete(SpaceObject).where(SpaceObject.id == space_object.id))


async def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_detail_endpoint_serves_cached_response_after_db_changes() -> None:
    async with await _client() as client:
        first = await client.get(f"/api/v1/objects/{NORAD_ID}")
    assert first.json()["name"] == "ORCAS-CACHE-TEST-ORIGINAL"

    async with get_session() as session:
        space_object = (
            await session.execute(select(SpaceObject).where(SpaceObject.norad_id == NORAD_ID))
        ).scalar_one()
        space_object.name = "ORCAS-CACHE-TEST-CHANGED"

    async with await _client() as client:
        second = await client.get(f"/api/v1/objects/{NORAD_ID}")
    # Still the pre-change name: the second request hit the cache, not the DB.
    assert second.json()["name"] == "ORCAS-CACHE-TEST-ORIGINAL"


@pytest.mark.asyncio
async def test_list_endpoint_serves_cached_response_after_db_changes() -> None:
    params = {"search": "ORCAS-CACHE-TEST"}
    async with await _client() as client:
        first = await client.get("/api/v1/objects", params=params)
    assert first.json()["total"] == 1

    async with get_session() as session:
        extra = SpaceObject(
            norad_id=EXTRA_NORAD_ID, intl_designator="1998-999W", name="ORCAS-CACHE-TEST-EXTRA"
        )
        session.add(extra)

    async with await _client() as client:
        second = await client.get("/api/v1/objects", params=params)
    assert second.json()["total"] == 1  # cache hit — the new row isn't reflected yet

    async with get_session() as session:
        await session.execute(delete(SpaceObject).where(SpaceObject.norad_id == "300302"))
