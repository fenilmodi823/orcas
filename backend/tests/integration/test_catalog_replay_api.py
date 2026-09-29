"""GET /api/v1/catalog/replay — the catalogue as it stood at a past moment,
built from the append-only element_set history. Touches the real dev
Postgres with obviously-fake NORAD IDs and cleans up after itself.
"""

import json
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

NORAD = "987101"


@pytest_asyncio.fixture(autouse=True)
async def _seed_and_cleanup():
    cache = MemoryCache()
    app.dependency_overrides[get_cache] = lambda: cache
    async with get_session() as session:
        obj = SpaceObject(norad_id=NORAD, intl_designator="2026-987C", name="ORCAS-REPLAY-TEST")
        session.add(obj)
        await session.flush()
        for day in (1, 3):
            session.add(
                ElementSet(
                    object_id=obj.id,
                    epoch=datetime(2026, 1, day, tzinfo=UTC),
                    mean_motion=15.5,
                    eccentricity=0.001,
                    inclination=51.6,
                    ra_of_asc_node=120.0,
                    arg_of_pericenter=45.0,
                    mean_anomaly=200.0,
                    bstar=0.0001,
                    mean_motion_dot=0.0,
                    mean_motion_ddot=0.0,
                    ephemeris_type=0,
                    classification_type="U",
                    element_set_no=day,
                    rev_at_epoch=100,
                    source="spacetrack-gp",
                    source_format="omm_json",
                    source_type="real",
                    ingested_at=datetime.now(UTC),
                )
            )
    yield
    app.dependency_overrides.clear()
    async with get_session() as session:
        stmt = select(SpaceObject).where(SpaceObject.norad_id == NORAD)
        rows = (await session.execute(stmt)).scalars().all()
        for row in rows:
            await session.execute(delete(ElementSet).where(ElementSet.object_id == row.id))
            await session.execute(delete(SpaceObject).where(SpaceObject.id == row.id))


async def _get(path: str):  # type: ignore[no-untyped-def]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        return await client.get(path)


@pytest.mark.asyncio
async def test_replay_serves_the_elements_that_existed_at_that_moment() -> None:
    response = await _get("/api/v1/catalog/replay?at=2026-01-02T00:00:00Z")

    assert response.status_code == 200
    assert response.headers["content-encoding"] == "gzip"
    # httpx undoes Content-Encoding: gzip itself, so .content is already JSON.
    objects = json.loads(response.content)
    mine = [o for o in objects if o["NORAD_CAT_ID"] == NORAD]
    assert len(mine) == 1
    assert mine[0]["EPOCH"] == datetime(2026, 1, 1, tzinfo=UTC).isoformat()
    assert response.headers["x-replay-at"] == "2026-01-02T00:00:00+00:00"


@pytest.mark.asyncio
async def test_replay_rejects_a_moment_in_the_future() -> None:
    response = await _get("/api/v1/catalog/replay?at=2099-01-01T00:00:00Z")

    assert response.status_code == 422
    assert "future" in response.json()["detail"]


@pytest.mark.asyncio
async def test_replay_before_any_stored_history_is_404_and_says_how_far_back_it_goes() -> None:
    response = await _get("/api/v1/catalog/replay?at=1990-01-01T00:00:00Z")

    assert response.status_code == 404
    assert "earliest" in response.json()["detail"]


@pytest.mark.asyncio
async def test_replay_requires_an_explicit_utc_offset() -> None:
    response = await _get("/api/v1/catalog/replay?at=2026-01-02T00:00:00")

    assert response.status_code == 422
