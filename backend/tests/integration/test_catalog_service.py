"""Touches a real Postgres — see .github/workflows/ci.yml's postgres
service. Uses obviously-fake NORAD_CAT_IDs so this can never collide with
real ingested data, and cleans up after itself.
"""

from datetime import UTC, datetime

import pytest
import pytest_asyncio
from sqlalchemy import delete, select

from app.infra.db.base import get_session
from app.infra.db.models import ElementSet, SpaceObject
from app.services.catalog_service import get_latest_element_set, get_object, list_objects

TEST_NORAD_IDS = ["988001", "988002", "988003"]


def _element_set_kwargs(object_id: int, epoch: datetime) -> dict:
    return dict(
        object_id=object_id,
        epoch=epoch,
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
        element_set_no=1,
        rev_at_epoch=100,
        source="test",
        source_format="omm_json",
        source_type="simulation",
        ingested_at=datetime.now(UTC),
    )


@pytest_asyncio.fixture(autouse=True)
async def _seed_and_cleanup():
    async with get_session() as session:
        objects = [
            SpaceObject(norad_id="988001", intl_designator="2026-988A", name="ORCAS-ALPHA"),
            SpaceObject(norad_id="988002", intl_designator="2026-988B", name="ORCAS-BETA"),
            SpaceObject(norad_id="988003", intl_designator="2026-988C", name="OTHER-OBJECT"),
        ]
        session.add_all(objects)
        await session.flush()
        jan1, jan2 = datetime(2026, 1, 1, tzinfo=UTC), datetime(2026, 1, 2, tzinfo=UTC)
        session.add(ElementSet(**_element_set_kwargs(objects[0].id, jan1)))
        session.add(ElementSet(**_element_set_kwargs(objects[0].id, jan2)))
        session.add(ElementSet(**_element_set_kwargs(objects[1].id, jan1)))

    yield

    async with get_session() as session:
        stmt = select(SpaceObject).where(SpaceObject.norad_id.in_(TEST_NORAD_IDS))
        rows = (await session.execute(stmt)).scalars().all()
        for obj in rows:
            await session.execute(delete(ElementSet).where(ElementSet.object_id == obj.id))
            await session.execute(delete(SpaceObject).where(SpaceObject.id == obj.id))


@pytest.mark.asyncio
async def test_list_objects_paginates_and_searches_by_name() -> None:
    async with get_session() as session:
        rows, total = await list_objects(session, limit=10, offset=0, search="ORCAS-")
        assert total == 2
        assert {row.norad_id for row in rows} == {"988001", "988002"}

        page, total = await list_objects(session, limit=1, offset=0, search="ORCAS-")
        assert total == 2
        assert len(page) == 1


@pytest.mark.asyncio
async def test_list_objects_searches_by_exact_norad_id() -> None:
    async with get_session() as session:
        rows, total = await list_objects(session, limit=10, offset=0, search="988003")
        assert total == 1
        assert rows[0].name == "OTHER-OBJECT"


@pytest.mark.asyncio
async def test_get_object_returns_none_for_unknown_norad_id() -> None:
    async with get_session() as session:
        assert await get_object(session, "000000") is None
        found = await get_object(session, "988002")
        assert found is not None
        assert found.name == "ORCAS-BETA"


@pytest.mark.asyncio
async def test_get_latest_element_set_returns_newest_epoch() -> None:
    async with get_session() as session:
        obj = await get_object(session, "988001")
        assert obj is not None
        latest = await get_latest_element_set(session, obj.id)
        assert latest is not None
        assert latest.epoch == datetime(2026, 1, 2, tzinfo=UTC)


@pytest.mark.asyncio
async def test_get_latest_element_set_returns_none_when_never_ingested() -> None:
    async with get_session() as session:
        obj = await get_object(session, "988003")
        assert obj is not None
        assert await get_latest_element_set(session, obj.id) is None
