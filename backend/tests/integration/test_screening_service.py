"""Screening end to end against a real Postgres, on the real 2009 elements
under obviously-fake NORAD IDs so nothing can collide with ingested data.
Scoped to its own objects and run with replace_existing=False, so the
database's real screening results are never touched; cleans up after itself.
"""

import math
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, select

from app.domain.tle import omm_record_from_tle
from app.infra.db.base import get_session
from app.infra.db.models import Conjunction, ElementSet, ScreeningRun, SpaceObject
from app.main import app
from app.services.screening_service import run_screening
from app.settings import settings

FIXTURE = Path(settings.data_sample_dir) / "iridium33_cosmos2251_2009_spacetrack.tle"
T0 = datetime(2009, 2, 10, 16, 56, 0, tzinfo=UTC)
# Just under python-sgp4's 339999 ceiling (memory.md #17), far above the live catalogue.
IRIDIUM, COSMOS, TWIN = "339901", "339902", "339903"
TEST_IDS = [IRIDIUM, COSMOS, TWIN]


def _pre_event_rows() -> dict[str, dict[str, Any]]:
    """Latest pre-event element set for each object, as element_set kwargs."""
    lines = [line for line in FIXTURE.read_text().splitlines() if line.strip()]
    best: dict[str, dict[str, Any]] = {}
    for i in range(0, len(lines), 3):
        name = lines[i]
        record = omm_record_from_tle(lines[i + 1], lines[i + 2], object_name=name)
        epoch = datetime.fromisoformat(record["EPOCH"]).replace(tzinfo=UTC)
        if epoch >= T0 or (name in best and best[name]["epoch"] > epoch):
            continue
        best[name] = {
            "epoch": epoch,
            "mean_motion": record["MEAN_MOTION"],
            "eccentricity": record["ECCENTRICITY"],
            "inclination": record["INCLINATION"],
            "ra_of_asc_node": record["RA_OF_ASC_NODE"],
            "arg_of_pericenter": record["ARG_OF_PERICENTER"],
            "mean_anomaly": record["MEAN_ANOMALY"],
            "bstar": record["BSTAR"],
            "mean_motion_dot": record["MEAN_MOTION_DOT"],
            "mean_motion_ddot": record["MEAN_MOTION_DDOT"],
            "ephemeris_type": 0,
            "classification_type": "U",
            "element_set_no": record["ELEMENT_SET_NO"],
            "rev_at_epoch": record["REV_AT_EPOCH"],
            "source": "test",
            "source_format": "tle_legacy",
            "source_type": "real",
            "ingested_at": datetime.now(UTC),
        }
    return best


async def _cleanup() -> None:
    async with get_session() as session:
        ids = select(SpaceObject.id).where(SpaceObject.norad_id.in_(TEST_IDS))
        run_ids = select(Conjunction.run_id).where(Conjunction.primary_object_id.in_(ids))
        await session.execute(delete(ScreeningRun).where(ScreeningRun.id.in_(run_ids)))
        await session.execute(delete(ElementSet).where(ElementSet.object_id.in_(ids)))
        await session.execute(delete(SpaceObject).where(SpaceObject.norad_id.in_(TEST_IDS)))
        await session.commit()


@pytest_asyncio.fixture
async def seeded() -> AsyncIterator[None]:
    await _cleanup()
    rows = _pre_event_rows()
    async with get_session() as session:
        # TWIN is Iridium 33 again: one element set shared by two catalogue
        # entries, the way docked ISS modules share one - co-located.
        for norad, name, row in [
            (IRIDIUM, "TEST IRIDIUM 33", rows["IRIDIUM 33"]),
            (COSMOS, "TEST COSMOS 2251", rows["COSMOS 2251"]),
            (TWIN, "TEST DOCKED TWIN", rows["IRIDIUM 33"]),
        ]:
            obj = SpaceObject(norad_id=norad, intl_designator=f"TEST-{norad}", name=name)
            session.add(obj)
            await session.flush()
            session.add(ElementSet(object_id=obj.id, **row))
        await session.commit()
    yield
    await _cleanup()


@pytest.mark.asyncio
async def test_screening_stores_the_2009_encounter_with_its_provenance(seeded: None) -> None:
    async with get_session() as session:
        result = await run_screening(
            session,
            T0 - timedelta(hours=1),
            timedelta(hours=2),
            norad_ids=TEST_IDS,
            replace_existing=False,
        )
        stmt = select(Conjunction).where(Conjunction.run_id == result.run_id)
        stored = (await session.execute(stmt)).scalars().all()
        run = await session.get(ScreeningRun, result.run_id)
        # Delete this run now, even if an assertion below fails: a run with no
        # conjunctions is not reachable from the fixture's cleanup.
        await session.execute(delete(ScreeningRun).where(ScreeningRun.id == result.run_id))
        await session.commit()

    assert result.objects_screened == 3
    # The twin sits on Iridium: excluded as co-located, and counted as such.
    assert result.colocated_excluded == 1
    # Iridium x Cosmos, and the twin x Cosmos (the same geometry).
    assert result.encounters == 2
    assert len(stored) == 2
    for c in stored:
        assert c.miss_distance_km * 1000 == pytest.approx(698.0, abs=0.5)
        assert c.valid_2d is True
        assert c.validity_reason is None
        # P_max = AR * HBR^2 / (e * d^2) at AR 3, HBR 20 m.
        expected = 3 * 0.020**2 / (math.e * c.miss_distance_km**2)
        assert c.maximum_pc == pytest.approx(expected, rel=1e-9)
        assert c.pc_method == "closed_form"
        assert c.dilution_sigma_km == pytest.approx(c.miss_distance_km / math.sqrt(6), rel=1e-9)
        assert c.primary_epoch < T0
        assert c.secondary_epoch < T0
    assert run is not None
    assert run.hard_body_radius_km == 0.020
    assert run.aspect_ratio == 3.0
    assert run.reporting_distance_km == 5.0


@pytest.mark.asyncio
async def test_api_returns_the_encounter_with_everything_needed_to_show_it(
    seeded: None,
) -> None:
    async with get_session() as session:
        result = await run_screening(
            session,
            T0 - timedelta(hours=1),
            timedelta(hours=2),
            norad_ids=TEST_IDS,
            replace_existing=False,
        )
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/v1/conjunctions", params={"norad_id": COSMOS})
        assert response.status_code == 200
        body = response.json()
        assert body["run"]["hard_body_radius_km"] == 0.020
        assert body["run"]["colocated_excluded"] == 1
        assert len(body["items"]) == 2
        item = body["items"][0]
        assert COSMOS in (item["primary"]["norad_id"], item["secondary"]["norad_id"])
        assert item["maximum_pc"] is not None
        assert item["aspect_ratio"] == 3.0
        assert "Alfano 2005" in item["method"]
        assert "probability" not in item  # no bare P_c, anywhere
        assert item["primary"]["element_set_epoch"] and item["secondary"]["element_set_epoch"]
    finally:
        async with get_session() as session:
            await session.execute(delete(ScreeningRun).where(ScreeningRun.id == result.run_id))
            await session.commit()
