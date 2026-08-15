"""Touches a real Postgres — see .github/workflows/ci.yml's postgres
service. Uses obviously-fake NORAD_CAT_IDs so this can never collide with
real ingested data, and cleans up after itself.
"""

from datetime import UTC, datetime, timedelta

import pyarrow.parquet as pq
import pytest
import pytest_asyncio
from sqlalchemy import delete, select

from app.infra.db.base import get_session
from app.infra.db.models import ElementSet, SpaceObject
from app.services.retention_service import archive_and_purge_old_element_sets

TEST_NORAD_IDS = ["986101", "986102"]
RETENTION_DAYS = 90
NOW = datetime.now(UTC)


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
        ingested_at=NOW,
    )


@pytest_asyncio.fixture(autouse=True)
async def _seed_and_cleanup():
    async with get_session() as session:
        with_history = SpaceObject(
            norad_id="986101", intl_designator="2026-986A", name="ORCAS-RETENTION-HISTORY"
        )
        # Object with only one (ancient) element set — must survive despite
        # being far older than the retention window: it is its own latest.
        only_old = SpaceObject(
            norad_id="986102", intl_designator="2026-986B", name="ORCAS-RETENTION-ONLY-OLD"
        )
        session.add_all([with_history, only_old])
        await session.flush()

        session.add(ElementSet(**_element_set_kwargs(with_history.id, NOW - timedelta(days=200))))
        session.add(ElementSet(**_element_set_kwargs(with_history.id, NOW - timedelta(days=100))))
        session.add(ElementSet(**_element_set_kwargs(with_history.id, NOW - timedelta(days=1))))
        session.add(ElementSet(**_element_set_kwargs(only_old.id, NOW - timedelta(days=500))))

    yield

    async with get_session() as session:
        stmt = select(SpaceObject).where(SpaceObject.norad_id.in_(TEST_NORAD_IDS))
        rows = (await session.execute(stmt)).scalars().all()
        for obj in rows:
            await session.execute(delete(ElementSet).where(ElementSet.object_id == obj.id))
            await session.execute(delete(SpaceObject).where(SpaceObject.id == obj.id))


async def _remaining_epochs(session, norad_id: str) -> list[datetime]:  # type: ignore[no-untyped-def]
    obj_stmt = select(SpaceObject).where(SpaceObject.norad_id == norad_id)
    obj = (await session.execute(obj_stmt)).scalar_one()
    rows_stmt = select(ElementSet).where(ElementSet.object_id == obj.id)
    rows = (await session.execute(rows_stmt)).scalars().all()
    return [row.epoch for row in rows]


@pytest.mark.asyncio
async def test_archives_old_rows_but_always_keeps_each_objects_latest(tmp_path) -> None:  # type: ignore[no-untyped-def]
    async with get_session() as session:
        result = await archive_and_purge_old_element_sets(
            session, retention_days=RETENTION_DAYS, archive_dir=str(tmp_path)
        )

    assert result.archived == 2  # the two old rows on ORCAS-RETENTION-HISTORY
    assert result.deleted == 2

    async with get_session() as session:
        history_epochs = await _remaining_epochs(session, "986101")
        assert history_epochs == [NOW - timedelta(days=1)]  # only the latest survives

        only_old_epochs = await _remaining_epochs(session, "986102")
        assert only_old_epochs == [NOW - timedelta(days=500)]  # kept: it's its own latest

    archive_files = list(tmp_path.glob("element_set_archive_*.parquet"))
    assert len(archive_files) == 1
    table = pq.read_table(archive_files[0])
    assert table.num_rows == 2
    async with get_session() as session:
        history_obj = (
            await session.execute(select(SpaceObject).where(SpaceObject.norad_id == "986101"))
        ).scalar_one()
    assert set(table.column("object_id").to_pylist()) == {history_obj.id}
    assert set(table.column("epoch").to_pylist()) == {
        NOW - timedelta(days=200),
        NOW - timedelta(days=100),
    }


@pytest.mark.asyncio
async def test_no_candidates_returns_zero_without_writing_a_file(tmp_path) -> None:  # type: ignore[no-untyped-def]
    async with get_session() as session:
        # A retention window longer than any seeded epoch's age means
        # nothing is old enough to archive.
        result = await archive_and_purge_old_element_sets(
            session, retention_days=100_000, archive_dir=str(tmp_path)
        )

    assert result.archived == 0
    assert result.deleted == 0
    assert list(tmp_path.glob("*.parquet")) == []
