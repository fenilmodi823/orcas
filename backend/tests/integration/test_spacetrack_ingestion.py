"""Touches a real Postgres — see .github/workflows/ci.yml's postgres
service. Uses an obviously-fake NORAD_CAT_ID so it can never collide with
real ingested data, and cleans up after itself.
"""

import pytest
import pytest_asyncio
from sqlalchemy import delete, select

from app.infra.db.base import get_session
from app.infra.db.models import ElementSet, SpaceObject
from app.services.ingestion_service import ingest_spacetrack_gp

TEST_NORAD_ID = "999996"

BASE_RECORD = {
    "OBJECT_NAME": "ORCAS-TEST-SPACETRACK-OBJECT",
    "OBJECT_ID": "2026-996A",
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
    async def fetch() -> list[dict]:
        return records

    return fetch


@pytest.mark.asyncio
async def test_ingest_spacetrack_gp_tags_source_correctly(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.ingestion_service.fetch_spacetrack_gp", _fake_fetch([BASE_RECORD])
    )

    result = await ingest_spacetrack_gp()

    counts = (result.fetched, result.validated, result.rejected, result.element_sets_inserted)
    assert counts == (1, 1, 0, 1)

    async with get_session() as session:
        space_object = (
            await session.execute(select(SpaceObject).where(SpaceObject.norad_id == TEST_NORAD_ID))
        ).scalar_one()
        assert space_object.analyst is False  # Space-Track's gp class has no "group" concept
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
        assert rows[0].source == "spacetrack-gp"


@pytest.mark.asyncio
async def test_ingest_spacetrack_gp_rejects_malformed_record(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.services.ingestion_service.fetch_spacetrack_gp", _fake_fetch([MALFORMED_RECORD])
    )

    result = await ingest_spacetrack_gp()

    counts = (result.fetched, result.validated, result.rejected, result.element_sets_inserted)
    assert counts == (1, 0, 1, 0)
