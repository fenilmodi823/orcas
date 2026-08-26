"""Touches a real Postgres. Reuses the exact fixture values already
verified in tests/unit/test_propagation.py (a synthetic 417 km LEO orbit)
rather than inventing new expected numbers — same known ECI/geodetic
result, now round-tripped through a DB row instead of a literal OmmRecord.
"""

from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from sqlalchemy import delete, select

from app.infra.db.base import get_session
from app.infra.db.models import ElementSet, SpaceObject
from app.services.propagation_service import NoElementSetError, propagate_ephemeris

TEST_NORAD_ID = "300001"  # under sgp4's 339999 cap (memory.md #17) — real catalog isn't near this
EMPTY_NORAD_ID = "300002"
EPOCH = datetime(2026, 1, 1, tzinfo=UTC)


@pytest_asyncio.fixture(autouse=True)
async def _seed_and_cleanup():
    async with get_session() as session:
        with_elements = SpaceObject(
            norad_id=TEST_NORAD_ID, intl_designator="1998-999Z", name="ORCAS-TEST-SAT"
        )
        without_elements = SpaceObject(
            norad_id=EMPTY_NORAD_ID, intl_designator="1998-999Y", name="ORCAS-NEVER-INGESTED"
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
        rows = (
            (
                await session.execute(
                    select(SpaceObject).where(
                        SpaceObject.norad_id.in_([TEST_NORAD_ID, EMPTY_NORAD_ID])
                    )
                )
            )
            .scalars()
            .all()
        )
        for obj in rows:
            await session.execute(delete(ElementSet).where(ElementSet.object_id == obj.id))
            await session.execute(delete(SpaceObject).where(SpaceObject.id == obj.id))


async def _get_id(session, norad_id: str) -> int:
    obj = (
        await session.execute(select(SpaceObject).where(SpaceObject.norad_id == norad_id))
    ).scalar_one()
    return obj.id


@pytest.mark.asyncio
async def test_propagate_ephemeris_matches_known_verified_position() -> None:
    async with get_session() as session:
        object_id = await _get_id(session, TEST_NORAD_ID)
        result = await propagate_ephemeris(
            session,
            norad_id=TEST_NORAD_ID,
            object_id=object_id,
            object_name="ORCAS-TEST-SAT",
            intl_designator="1998-999Z",
            start=EPOCH,
            end=EPOCH,
            step_seconds=60.0,
        )

    assert result.element_set_epoch == EPOCH
    assert len(result.points) == 1
    point = result.points[0]
    # Same values as test_propagate_rotates_to_geodetic_consistent_with_417km_circular_orbit
    assert point.position.altitude_km == pytest.approx(416.79, abs=0.1)
    assert point.position.latitude_deg == pytest.approx(-0.078, abs=0.01)
    assert point.position.longitude_deg == pytest.approx(-100.72, abs=0.1)


@pytest.mark.asyncio
async def test_propagate_ephemeris_raises_when_never_ingested() -> None:
    async with get_session() as session:
        object_id = await _get_id(session, EMPTY_NORAD_ID)
        with pytest.raises(NoElementSetError):
            await propagate_ephemeris(
                session,
                norad_id=EMPTY_NORAD_ID,
                object_id=object_id,
                object_name="ORCAS-NEVER-INGESTED",
                intl_designator="1998-999Y",
                start=EPOCH,
                end=EPOCH,
                step_seconds=60.0,
            )


@pytest.mark.asyncio
async def test_propagate_ephemeris_rejects_nonpositive_step() -> None:
    async with get_session() as session:
        object_id = await _get_id(session, TEST_NORAD_ID)
        with pytest.raises(ValueError, match="step_seconds"):
            await propagate_ephemeris(
                session,
                norad_id=TEST_NORAD_ID,
                object_id=object_id,
                object_name="ORCAS-TEST-SAT",
                intl_designator="1998-999Z",
                start=EPOCH,
                end=EPOCH,
                step_seconds=0.0,
            )


@pytest.mark.asyncio
async def test_propagate_ephemeris_rejects_end_before_start() -> None:
    async with get_session() as session:
        object_id = await _get_id(session, TEST_NORAD_ID)
        with pytest.raises(ValueError, match="end must not be before start"):
            await propagate_ephemeris(
                session,
                norad_id=TEST_NORAD_ID,
                object_id=object_id,
                object_name="ORCAS-TEST-SAT",
                intl_designator="1998-999Z",
                start=EPOCH,
                end=EPOCH - timedelta(hours=1),
                step_seconds=60.0,
            )
