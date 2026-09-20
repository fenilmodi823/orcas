"""Touches a real Postgres — see .github/workflows/ci.yml's postgres
service and Docker.md. Uses an obviously-fake NORAD_CAT_ID so it can never
collide with real ingested data, and cleans up after itself.
"""

import pytest
import pytest_asyncio
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError

from app.infra.db.base import get_session
from app.infra.db.models import ElementSet, SpaceObject
from app.services.ingestion_service import ingest_gp, ingest_spacetrack_gp

TEST_NORAD_ID = "999999"

BASE_RECORD = {
    "OBJECT_NAME": "ORCAS-TEST-OBJECT",
    "OBJECT_ID": "2026-999A",
    "EPOCH": "2026-08-14T00:00:00.000000",
    "MEAN_MOTION": 15.5,
    "ECCENTRICITY": 0.001,
    "INCLINATION": 51.6,
    "RA_OF_ASC_NODE": 120.0,
    "ARG_OF_PERICENTER": 45.0,
    "MEAN_ANOMALY": 200.0,
    "EPHEMERIS_TYPE": 0,
    "CLASSIFICATION_TYPE": "U",
    "NORAD_CAT_ID": TEST_NORAD_ID,
    "ELEMENT_SET_NO": 1,
    "REV_AT_EPOCH": 100,
    "BSTAR": 0.0001,
    "MEAN_MOTION_DOT": 0.0,
    "MEAN_MOTION_DDOT": 0.0,
}
MALFORMED_RECORD = {**BASE_RECORD, "MEAN_MOTION": "not-a-number"}


@pytest_asyncio.fixture(autouse=True)
async def _cleanup_test_object():
    yield
    async with get_session() as session:
        space_object = (
            await session.execute(select(SpaceObject).where(SpaceObject.norad_id == TEST_NORAD_ID))
        ).scalar_one_or_none()
        if space_object is not None:
            await session.execute(delete(ElementSet).where(ElementSet.object_id == space_object.id))
            await session.execute(delete(SpaceObject).where(SpaceObject.id == space_object.id))


def _fake_fetch(records: list[dict]):  # type: ignore[no-untyped-def]
    async def fetch(group: str | None = None) -> list[dict]:
        return records

    return fetch


@pytest.mark.asyncio
async def test_ingest_gp_creates_object_and_element_set(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.ingestion_service.fetch_gp_omm", _fake_fetch([BASE_RECORD]))

    result = await ingest_gp()

    counts = (result.fetched, result.validated, result.rejected, result.element_sets_inserted)
    assert counts == (1, 1, 0, 1)

    async with get_session() as session:
        space_object = (
            await session.execute(select(SpaceObject).where(SpaceObject.norad_id == TEST_NORAD_ID))
        ).scalar_one()
        assert space_object.name == "ORCAS-TEST-OBJECT"
        rows = (
            (
                await session.execute(
                    select(ElementSet).where(ElementSet.object_id == space_object.id)
                )
            )
            .scalars()
            .all()
        )
        assert len(rows) == 1
        assert rows[0].mean_motion == 15.5


@pytest.mark.asyncio
async def test_ingest_gp_rejects_malformed_record(monkeypatch: pytest.MonkeyPatch) -> None:
    fetch = _fake_fetch([MALFORMED_RECORD])
    monkeypatch.setattr("app.services.ingestion_service.fetch_gp_omm", fetch)

    result = await ingest_gp()

    counts = (result.fetched, result.validated, result.rejected, result.element_sets_inserted)
    assert counts == (1, 0, 1, 0)


@pytest.mark.asyncio
async def test_ingest_gp_is_append_only_on_re_ingestion(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.ingestion_service.fetch_gp_omm", _fake_fetch([BASE_RECORD]))
    await ingest_gp()

    renamed = {
        **BASE_RECORD,
        "OBJECT_NAME": "ORCAS-TEST-OBJECT-RENAMED",
        "EPOCH": "2026-08-14T12:00:00.000000",
    }
    monkeypatch.setattr("app.services.ingestion_service.fetch_gp_omm", _fake_fetch([renamed]))
    await ingest_gp()

    async with get_session() as session:
        space_object = (
            await session.execute(select(SpaceObject).where(SpaceObject.norad_id == TEST_NORAD_ID))
        ).scalar_one()
        # identity updates in place — same row, latest name
        assert space_object.name == "ORCAS-TEST-OBJECT-RENAMED"
        rows = (
            (
                await session.execute(
                    select(ElementSet).where(ElementSet.object_id == space_object.id)
                )
            )
            .scalars()
            .all()
        )
        # but element_set never updates — two epochs, both preserved
        assert len(rows) == 2


async def _element_set_sources() -> list[str]:
    async with get_session() as session:
        space_object = (
            await session.execute(select(SpaceObject).where(SpaceObject.norad_id == TEST_NORAD_ID))
        ).scalar_one()
        return list(
            (
                await session.execute(
                    select(ElementSet.source).where(ElementSet.object_id == space_object.id)
                )
            )
            .scalars()
            .all()
        )


@pytest.mark.asyncio
async def test_ingest_gp_is_idempotent_for_an_already_stored_epoch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.services.ingestion_service.fetch_gp_omm", _fake_fetch([BASE_RECORD]))
    first = await ingest_gp()
    second = await ingest_gp()

    assert (first.element_sets_inserted, second.element_sets_inserted) == (1, 0)
    assert await _element_set_sources() == ["celestrak"]


@pytest.mark.asyncio
async def test_database_rejects_a_duplicate_object_epoch_source(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # The service skips duplicates; the unique index is what makes that a guarantee
    # rather than a habit (a concurrent run, or a future code path, cannot bypass it).
    monkeypatch.setattr("app.services.ingestion_service.fetch_gp_omm", _fake_fetch([BASE_RECORD]))
    await ingest_gp()

    async with get_session() as session:
        stored = (
            await session.execute(
                select(ElementSet)
                .join(SpaceObject, SpaceObject.id == ElementSet.object_id)
                .where(SpaceObject.norad_id == TEST_NORAD_ID)
            )
        ).scalar_one()
        columns = {c.name: getattr(stored, c.name) for c in ElementSet.__table__.columns}
        del columns["id"]
        session.add(ElementSet(**columns))
        with pytest.raises(IntegrityError):
            await session.flush()
        await session.rollback()


@pytest.mark.asyncio
async def test_same_epoch_from_a_different_source_is_kept_separately(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # RA14.D5: the two origins stay distinguishable, so the dedupe key includes source.
    monkeypatch.setattr("app.services.ingestion_service.fetch_gp_omm", _fake_fetch([BASE_RECORD]))
    await ingest_gp()

    async def fetch_spacetrack() -> list[dict]:  # type: ignore[type-arg]
        return [BASE_RECORD]

    monkeypatch.setattr("app.services.ingestion_service.fetch_spacetrack_gp", fetch_spacetrack)
    await ingest_spacetrack_gp()

    assert sorted(await _element_set_sources()) == ["celestrak", "spacetrack-gp"]


@pytest.mark.asyncio
async def test_ingest_gp_flags_analyst_group_objects(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.ingestion_service.fetch_gp_omm", _fake_fetch([BASE_RECORD]))

    await ingest_gp(group="analyst")

    async with get_session() as session:
        space_object = (
            await session.execute(select(SpaceObject).where(SpaceObject.norad_id == TEST_NORAD_ID))
        ).scalar_one()
        assert space_object.analyst is True


@pytest.mark.asyncio
async def test_ingest_gp_does_not_flag_non_analyst_group_objects(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.services.ingestion_service.fetch_gp_omm", _fake_fetch([BASE_RECORD]))

    await ingest_gp(group="active")

    async with get_session() as session:
        space_object = (
            await session.execute(select(SpaceObject).where(SpaceObject.norad_id == TEST_NORAD_ID))
        ).scalar_one()
        assert space_object.analyst is False
