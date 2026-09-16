"""Touches a real Postgres — see .github/workflows/ci.yml's postgres
service. Uses an obviously-fake NORAD_CAT_ID so it can never collide with
real ingested data, and cleans up after itself.
"""

import csv
import io

import pytest
import pytest_asyncio
from sqlalchemy import delete, select

from app.infra.db.base import get_session
from app.infra.db.models import ElementSet, SpaceObject
from app.services.satcat_service import ingest_satcat

TEST_NORAD_ID = "999998"

BASE_ROW = {
    "OBJECT_NAME": "ORCAS-TEST-SATCAT",
    "OBJECT_ID": "2026-998A",
    "NORAD_CAT_ID": TEST_NORAD_ID,
    "OBJECT_TYPE": "PAY",
    "OPS_STATUS_CODE": "+",
    "OWNER": "US",
    "LAUNCH_DATE": "2026-01-01",
    "LAUNCH_SITE": "AFETR",
    "DECAY_DATE": "",
    "RCS": "1.5",
    "DATA_STATUS_CODE": "",
}
MALFORMED_ROW = {**BASE_ROW, "RCS": "not-a-number"}


@pytest_asyncio.fixture(autouse=True)
async def _seed_and_cleanup_test_object():
    async with get_session() as session:
        session.add(
            SpaceObject(
                norad_id=TEST_NORAD_ID,
                intl_designator="2026-998A",
                name="ORCAS-TEST-SATCAT",
            )
        )
    yield
    async with get_session() as session:
        space_object = (
            await session.execute(select(SpaceObject).where(SpaceObject.norad_id == TEST_NORAD_ID))
        ).scalar_one_or_none()
        if space_object is not None:
            await session.execute(delete(ElementSet).where(ElementSet.object_id == space_object.id))
            await session.execute(delete(SpaceObject).where(SpaceObject.id == space_object.id))


def _fake_fetch(csv_text: str):  # type: ignore[no-untyped-def]
    async def fetch() -> str:
        return csv_text

    return fetch


def _csv_from_rows(rows: list[dict]) -> str:  # type: ignore[type-arg]
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue()


@pytest.mark.asyncio
async def test_ingest_satcat_backfills_matching_object(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.satcat_service.fetch_satcat_csv", _fake_fetch(_csv_from_rows([BASE_ROW]))
    )

    result = await ingest_satcat()

    assert (
        result.fetched,
        result.validated,
        result.rejected,
        result.updated,
        result.skipped_no_match,
    ) == (1, 1, 0, 1, 0)
    async with get_session() as session:
        space_object = (
            await session.execute(select(SpaceObject).where(SpaceObject.norad_id == TEST_NORAD_ID))
        ).scalar_one()
        assert space_object.object_type == "PAY"
        assert space_object.country == "US"
        assert space_object.rcs == 1.5
        assert space_object.satcat_source == "celestrak-satcat"
        assert space_object.satcat_updated_at is not None


@pytest.mark.asyncio
async def test_ingest_satcat_skips_row_with_no_matching_object(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    unmatched_row = {**BASE_ROW, "NORAD_CAT_ID": "999997"}
    monkeypatch.setattr(
        "app.services.satcat_service.fetch_satcat_csv", _fake_fetch(_csv_from_rows([unmatched_row]))
    )

    result = await ingest_satcat()

    assert (result.updated, result.skipped_no_match) == (0, 1)


@pytest.mark.asyncio
async def test_ingest_satcat_rejects_malformed_row(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.satcat_service.fetch_satcat_csv", _fake_fetch(_csv_from_rows([MALFORMED_ROW]))
    )

    result = await ingest_satcat()

    assert (result.validated, result.rejected) == (0, 1)
