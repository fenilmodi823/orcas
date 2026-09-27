"""Catalogue conjunction screening: latest element sets -> broad-phase
screening -> maximum P_c and the 2D-validity gate per encounter -> the
`conjunction` table. Runs in the worker, never in a request handler.

What a stored conjunction claims, and does not (RA-12 section 7): the miss
distance and TCA are SGP4 geometry from public element sets; the only
probability is a MAXIMUM over uncertainty ellipses of a stated aspect ratio,
because public element sets carry no covariance. It is a labelled screening
result, never an operational warning.
"""

import asyncio
import logging
from collections.abc import Collection, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sgp4.api import Satrec
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.maximum_pc import SOCRATES_ASPECT_RATIO, assess_2d_validity, maximum_pc
from app.domain.propagation import satrec_from_omm
from app.domain.screening import Encounter, ScreeningConfig, screen_catalogue
from app.infra.db.models import Conjunction, ElementSet, ScreeningRun, SpaceObject
from app.services.propagation_service import omm_record_from_element_set

logger = logging.getLogger(__name__)

#: Combined hard-body radius, km. A stated default, not a measurement of any
#: object: SATCAT RCS is a radar cross-section, not a size (RA14.D7). It is the
#: figure RA-12's worked numbers and the golden test use, and it is shown with
#: every result (Questions - Round 3, B.1).
DEFAULT_HARD_BODY_RADIUS_KM = 0.020

#: A pair this close and this slow is one complex, not an encounter: docked
#: vehicles (the ISS modules share one element set) or formation flight.
COLOCATED_MAX_MISS_KM = 0.1
COLOCATED_MAX_SPEED_KM_S = 0.010


@dataclass(frozen=True)
class _Screened:
    object_id: int
    epoch: datetime


@dataclass(frozen=True)
class ScreeningRunResult:
    run_id: int
    objects_screened: int
    objects_skipped: int
    colocated_excluded: int
    encounters: int


def is_colocated(encounter: Encounter) -> bool:
    """Docked or formation-flying: excluded from conjunctions, but counted."""
    return (
        encounter.miss_distance_km <= COLOCATED_MAX_MISS_KM
        and encounter.relative_speed_km_s < COLOCATED_MAX_SPEED_KM_S
    )


async def _load_catalogue(
    session: AsyncSession, norad_ids: Collection[str] | None
) -> tuple[list[Satrec], list[_Screened], int]:
    """Latest real element set per object as Satrecs. Simulation objects never
    enter screening (Rules.md hard ban); objects SGP4 cannot initialise are
    skipped and counted rather than failing the run.
    """
    stmt = (
        select(SpaceObject, ElementSet)
        .join(ElementSet, ElementSet.object_id == SpaceObject.id)
        .where(ElementSet.source_type != "simulation")
        .distinct(ElementSet.object_id)
        .order_by(ElementSet.object_id, ElementSet.epoch.desc(), ElementSet.id.desc())
    )
    if norad_ids is not None:
        stmt = stmt.where(SpaceObject.norad_id.in_(list(norad_ids)))
    satrecs: list[Satrec] = []
    screened: list[_Screened] = []
    skipped = 0
    for space_object, element_set in (await session.execute(stmt)).all():
        record = omm_record_from_element_set(
            element_set, space_object.name, space_object.norad_id, space_object.intl_designator
        )
        try:
            satrecs.append(satrec_from_omm(record))
        except ValueError:
            # python-sgp4 cannot hold NORAD IDs above 339999 (memory.md #17),
            # and rejects malformed elements; neither is screenable today.
            skipped += 1
            continue
        screened.append(_Screened(space_object.id, element_set.epoch))
    return satrecs, screened, skipped


def _to_row(encounter: Encounter, screened: list[_Screened], hbr_km: float) -> Conjunction:
    validity = assess_2d_validity(encounter.miss_distance_km, encounter.relative_speed_km_s)
    bound = maximum_pc(encounter.miss_distance_km, hbr_km, SOCRATES_ASPECT_RATIO)
    primary, secondary = screened[encounter.primary], screened[encounter.secondary]
    return Conjunction(
        primary_object_id=primary.object_id,
        secondary_object_id=secondary.object_id,
        tca=encounter.tca,
        miss_distance_km=encounter.miss_distance_km,
        relative_speed_km_s=encounter.relative_speed_km_s,
        maximum_pc=bound.value if validity.is_valid else None,
        pc_method=bound.method if validity.is_valid else None,
        dilution_sigma_km=bound.dilution_sigma_km,
        valid_2d=validity.is_valid,
        validity_reason=validity.reason,
        encounter_duration_s=validity.encounter_duration_s,
        primary_epoch=primary.epoch,
        secondary_epoch=secondary.epoch,
    )


async def run_screening(
    session: AsyncSession,
    window_start: datetime,
    window: timedelta,
    config: ScreeningConfig | None = None,
    hard_body_radius_km: float = DEFAULT_HARD_BODY_RADIUS_KM,
    norad_ids: Collection[str] | None = None,
    replace_existing: bool = True,
) -> ScreeningRunResult:
    """Screen the catalogue (or just `norad_ids`) over [window_start,
    window_start + window] and, by default, replace the stored conjunctions
    with this run's. The screening itself is CPU-bound, so it runs on a
    worker thread, off the event loop.
    """
    config = config or ScreeningConfig()
    started_at = datetime.now(UTC)
    satrecs, screened, skipped = await _load_catalogue(session, norad_ids)
    encounters = await asyncio.to_thread(
        screen_catalogue, satrecs, window_start, window_start + window, config
    )
    colocated = [e for e in encounters if is_colocated(e)]
    rows = [_to_row(e, screened, hard_body_radius_km) for e in encounters if not is_colocated(e)]

    run = ScreeningRun(
        started_at=started_at,
        completed_at=datetime.now(UTC),
        window_start=window_start,
        window_end=window_start + window,
        step_s=config.step_s,
        reporting_distance_km=config.reporting_distance_km,
        hard_body_radius_km=hard_body_radius_km,
        aspect_ratio=SOCRATES_ASPECT_RATIO,
        objects_screened=len(satrecs),
        objects_skipped=skipped,
        colocated_excluded=len(colocated),
        encounters=len(rows),
        conjunctions=rows,
    )
    # One transaction: the previous run's results stay visible until this
    # run's are committed, and a failure leaves them untouched.
    if replace_existing:
        await session.execute(delete(ScreeningRun))
    session.add(run)
    await session.commit()
    logger.info(
        "screening run complete",
        extra={"run_id": run.id, "encounters": len(rows), "screened": len(satrecs)},
    )
    return ScreeningRunResult(run.id, len(satrecs), skipped, len(colocated), len(rows))


async def latest_run(session: AsyncSession) -> ScreeningRun | None:
    """The most recent completed screening run, if any has ever finished."""
    stmt = select(ScreeningRun).order_by(ScreeningRun.completed_at.desc()).limit(1)
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_conjunctions(
    session: AsyncSession, run_id: int, norad_id: str | None, limit: int
) -> Sequence[Conjunction]:
    """One run's conjunctions. For one object: its encounters in TCA order,
    soonest first. For the catalogue: highest maximum P_c first, encounters
    outside 2D validity (no number) after them by miss distance.
    """
    stmt = (
        select(Conjunction)
        .where(Conjunction.run_id == run_id)
        .options(selectinload(Conjunction.primary), selectinload(Conjunction.secondary))
    )
    if norad_id is not None:
        party = select(SpaceObject.id).where(SpaceObject.norad_id == norad_id)
        stmt = stmt.where(
            Conjunction.primary_object_id.in_(party) | Conjunction.secondary_object_id.in_(party)
        ).order_by(Conjunction.tca)
    else:
        stmt = stmt.order_by(
            Conjunction.maximum_pc.desc().nulls_last(), Conjunction.miss_distance_km
        )
    return (await session.execute(stmt.limit(limit))).scalars().all()
