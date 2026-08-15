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
from app.services.snapshot_service import (
    META_FILENAME,
    SNAPSHOT_FILENAME,
    build_snapshot,
    write_snapshot,
)

TEST_NORAD_IDS = ["987001", "987002"]


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
        source="celestrak",
        source_format="omm_json",
        source_type="real",
        ingested_at=datetime.now(UTC),
    )


@pytest_asyncio.fixture(autouse=True)
async def _seed_and_cleanup():
    async with get_session() as session:
        objects = [
            SpaceObject(norad_id="987001", intl_designator="2026-987A", name="ORCAS-SNAP-ALPHA"),
            SpaceObject(norad_id="987002", intl_designator="2026-987B", name="ORCAS-SNAP-BETA"),
        ]
        session.add_all(objects)
        await session.flush()
        jan1, jan2 = datetime(2026, 1, 1, tzinfo=UTC), datetime(2026, 1, 2, tzinfo=UTC)
        # Object 0 has two element sets — snapshot must pick jan2, not jan1.
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
async def test_build_snapshot_picks_latest_element_set_per_object() -> None:
    async with get_session() as session:
        result = await build_snapshot(session)

    by_id = {
        obj["NORAD_CAT_ID"]: obj for obj in result.objects if obj["NORAD_CAT_ID"] in TEST_NORAD_IDS
    }
    assert set(by_id) == set(TEST_NORAD_IDS)
    assert by_id["987001"]["EPOCH"] == datetime(2026, 1, 2, tzinfo=UTC).isoformat()
    assert by_id["987001"]["OBJECT_NAME"] == "ORCAS-SNAP-ALPHA"
    assert by_id["987001"]["OBJECT_TYPE"] is None  # SATCAT not ingested yet
    assert by_id["987001"]["IS_ACTIVE"] is True
    assert result.newest_epoch is not None
    assert result.newest_epoch >= datetime(2026, 1, 2, tzinfo=UTC)


@pytest.mark.asyncio
async def test_write_snapshot_round_trips_through_gzip(tmp_path) -> None:  # type: ignore[no-untyped-def]
    async with get_session() as session:
        result = await build_snapshot(session)

    write_snapshot(result, str(tmp_path))

    import gzip
    import json

    raw = gzip.decompress((tmp_path / SNAPSHOT_FILENAME).read_bytes())
    objects = json.loads(raw)
    assert any(obj["NORAD_CAT_ID"] == "987001" for obj in objects)

    meta = json.loads((tmp_path / META_FILENAME).read_text(encoding="utf-8"))
    assert meta["object_count"] == len(result.objects)
    assert meta["source"] == "celestrak"
