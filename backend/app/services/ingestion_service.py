"""Orchestrates OMM ingestion: fetch (infra) -> validate (infra) -> upsert
(infra db). No physics of its own — see Rules.md layering. Malformed
records are skipped and counted, never allowed to abort the whole batch
(Data-Strategy.md: "a malformed upstream response must not corrupt the
catalogue"). Two sources share this pipeline — CelesTrak GP and Space-Track
gp (RA14.D1) — tagged distinctly via ElementSet.source (RA14.D5).
"""

import logging
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.types import OmmRecord
from app.infra.celestrak.client import fetch_gp_omm
from app.infra.celestrak.schema import OmmValidationError, validate_omm_record
from app.infra.db.base import get_session
from app.infra.db.models import ElementSet, SpaceObject
from app.infra.spacetrack.client import fetch_spacetrack_gp
from app.settings import settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class IngestionResult:
    fetched: int
    validated: int
    rejected: int
    element_sets_inserted: int


def _parse_epoch(epoch: str) -> datetime:
    """OMM EPOCH is CCSDS-format UTC, e.g. '2026-08-13T12:00:00.000000' —
    no offset suffix, but always UTC by convention.
    """
    parsed = datetime.fromisoformat(epoch)
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


async def _upsert_space_object(
    session: AsyncSession, record: OmmRecord, group: str | None
) -> SpaceObject:
    stmt = select(SpaceObject).where(SpaceObject.norad_id == record["NORAD_CAT_ID"])
    space_object = (await session.execute(stmt)).scalar_one_or_none()
    if space_object is None:
        space_object = SpaceObject(
            norad_id=record["NORAD_CAT_ID"],
            intl_designator=record["OBJECT_ID"],
            name=record["OBJECT_NAME"],
            analyst=(group == "analyst"),
        )
        session.add(space_object)
        await session.flush()  # assigns space_object.id for the element_set FK below
    elif space_object.name != record["OBJECT_NAME"]:
        space_object.name = record["OBJECT_NAME"]  # CelesTrak names change (renames, deployments)
    if group == "analyst":
        space_object.analyst = True  # one-way: once seen via the analyst group, stays flagged
    return space_object


async def _ingest_omm_records(
    raw_records: list[dict[str, object]], source: str, group: str | None = None
) -> IngestionResult:
    """Shared validate -> upsert -> insert pipeline for any OMM-shaped
    source. `group` only matters for CelesTrak's analyst-flag path
    (RA14.D10); Space-Track's gp class has no group concept, so it always
    passes None.
    """
    validated: list[OmmRecord] = []
    rejected = 0
    for raw in raw_records:
        try:
            validated.append(validate_omm_record(raw))
        except OmmValidationError:
            rejected += 1
            logger.warning("rejected malformed OMM record (source=%s)", source, exc_info=True)

    ingested_at = datetime.now(UTC)
    inserted = 0
    async with get_session() as session:
        for record in validated:
            space_object = await _upsert_space_object(session, record, group)
            epoch = _parse_epoch(record["EPOCH"])
            # Idempotent per (object, epoch, source): re-running an ingest before the
            # upstream publishes a new element set must not append a duplicate row.
            # ponytail: one indexed SELECT per record, same shape as the upsert above;
            # batch it into a single query if ingest time ever becomes a problem.
            already_stored = await session.scalar(
                select(ElementSet.id)
                .where(
                    ElementSet.object_id == space_object.id,
                    ElementSet.epoch == epoch,
                    ElementSet.source == source,
                )
                .limit(1)
            )
            if already_stored is not None:
                continue
            session.add(
                ElementSet(
                    object_id=space_object.id,
                    epoch=epoch,
                    mean_motion=record["MEAN_MOTION"],
                    eccentricity=record["ECCENTRICITY"],
                    inclination=record["INCLINATION"],
                    ra_of_asc_node=record["RA_OF_ASC_NODE"],
                    arg_of_pericenter=record["ARG_OF_PERICENTER"],
                    mean_anomaly=record["MEAN_ANOMALY"],
                    bstar=record["BSTAR"],
                    mean_motion_dot=record["MEAN_MOTION_DOT"],
                    mean_motion_ddot=record["MEAN_MOTION_DDOT"],
                    ephemeris_type=record["EPHEMERIS_TYPE"],
                    classification_type=record["CLASSIFICATION_TYPE"],
                    element_set_no=record["ELEMENT_SET_NO"],
                    rev_at_epoch=record["REV_AT_EPOCH"],
                    source=source,
                    source_format="omm_json",
                    source_type="real",
                    ingested_at=ingested_at,
                )
            )
            inserted += 1

    return IngestionResult(
        fetched=len(raw_records),
        validated=len(validated),
        rejected=rejected,
        element_sets_inserted=inserted,
    )


async def ingest_gp(group: str | None = None) -> IngestionResult:
    effective_group = group or settings.celestrak_group
    raw_records = await fetch_gp_omm(group)
    return await _ingest_omm_records(raw_records, source="celestrak", group=effective_group)


async def ingest_spacetrack_gp() -> IngestionResult:
    """Full on-orbit catalogue including unnamed debris (RA-14 §1.2) —
    every object Space-Track returns is ingested, not diffed against what
    CelesTrak already supplied, tagged source="spacetrack-gp" so the two
    origins stay distinguishable (RA14.D5).
    """
    raw_records = await fetch_spacetrack_gp()
    return await _ingest_omm_records(raw_records, source="spacetrack-gp")
