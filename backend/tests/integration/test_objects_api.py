"""Touches a real Postgres. Drives the real ASGI app end to end — routing,
DI, service, DB — not just the service layer directly.
"""

from datetime import UTC, datetime

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, select

from app.infra.db.base import get_session
from app.infra.db.models import ElementSet, SpaceObject
from app.main import app

WITH_ELEMENTS = "300101"
WITHOUT_ELEMENTS = "300102"
UNKNOWN = "300199"
EPOCH = datetime(2026, 1, 1, tzinfo=UTC)


@pytest_asyncio.fixture(autouse=True)
async def _seed_and_cleanup():
    async with get_session() as session:
        with_elements = SpaceObject(
            norad_id=WITH_ELEMENTS, intl_designator="1998-999Z", name="ORCAS-API-TEST-SAT"
        )
        without_elements = SpaceObject(
            norad_id=WITHOUT_ELEMENTS, intl_designator="1998-999Y", name="ORCAS-API-NEVER-INGESTED"
        )
        session.add_all([with_elements, without_elements])
        await session.flush()
        session.add(
            ElementSet(
                object_id=with_elements.id,
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

    async with get_session() as session:
        norad_ids = [WITH_ELEMENTS, WITHOUT_ELEMENTS]
        stmt = select(SpaceObject).where(SpaceObject.norad_id.in_(norad_ids))
        rows = (await session.execute(stmt)).scalars().all()
        for obj in rows:
            await session.execute(delete(ElementSet).where(ElementSet.object_id == obj.id))
            await session.execute(delete(SpaceObject).where(SpaceObject.id == obj.id))


async def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_list_objects_finds_seeded_object() -> None:
    async with await _client() as client:
        response = await client.get("/api/v1/objects", params={"search": "ORCAS-API-TEST-SAT"})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["norad_id"] == WITH_ELEMENTS


@pytest.mark.asyncio
async def test_get_object_returns_404_for_unknown() -> None:
    async with await _client() as client:
        response = await client.get(f"/api/v1/objects/{UNKNOWN}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_object_returns_detail_with_latest_element_set() -> None:
    async with await _client() as client:
        response = await client.get(f"/api/v1/objects/{WITH_ELEMENTS}")
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "ORCAS-API-TEST-SAT"
    assert body["latest_element_set"]["mean_motion"] == pytest.approx(15.5)


@pytest.mark.asyncio
async def test_get_object_detail_has_null_element_set_when_never_ingested() -> None:
    async with await _client() as client:
        response = await client.get(f"/api/v1/objects/{WITHOUT_ELEMENTS}")
    assert response.status_code == 200
    assert response.json()["latest_element_set"] is None


@pytest.mark.asyncio
async def test_ephemeris_returns_propagated_points() -> None:
    async with await _client() as client:
        response = await client.get(
            f"/api/v1/objects/{WITH_ELEMENTS}/ephemeris",
            params={"start": EPOCH.isoformat(), "end": EPOCH.isoformat(), "step_seconds": 60},
        )
    assert response.status_code == 200
    body = response.json()
    assert len(body["points"]) == 1
    assert body["points"][0]["altitude_km"] == pytest.approx(416.79, abs=0.1)


@pytest.mark.asyncio
async def test_ephemeris_404s_when_never_ingested() -> None:
    async with await _client() as client:
        response = await client.get(
            f"/api/v1/objects/{WITHOUT_ELEMENTS}/ephemeris",
            params={"start": EPOCH.isoformat(), "end": EPOCH.isoformat()},
        )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_ephemeris_400s_on_end_before_start() -> None:
    later = EPOCH.replace(hour=1)
    async with await _client() as client:
        response = await client.get(
            f"/api/v1/objects/{WITH_ELEMENTS}/ephemeris",
            params={"start": later.isoformat(), "end": EPOCH.isoformat()},
        )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_ephemeris_400s_when_window_too_large() -> None:
    far_future = EPOCH.replace(year=2027)
    async with await _client() as client:
        response = await client.get(
            f"/api/v1/objects/{WITH_ELEMENTS}/ephemeris",
            params={"start": EPOCH.isoformat(), "end": far_future.isoformat(), "step_seconds": 1},
        )
    assert response.status_code == 400
