"""Orchestrates SATCAT backfill: fetch (infra) -> validate (infra) -> update
existing space_object rows (infra db). No physics of its own — see
Rules.md layering. Backfill-only: a SATCAT row with no matching
space_object is skipped, never used to create a new identity, since SATCAT
alone carries no orbital elements to propagate (RA-14 §6 step 3).
"""

import csv
import io
import logging
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.types import SatcatRecord
from app.infra.celestrak.satcat import fetch_satcat_csv
from app.infra.celestrak.satcat_schema import SatcatValidationError, validate_satcat_row
from app.infra.db.base import get_session
from app.infra.db.models import SpaceObject

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class SatcatIngestionResult:
    fetched: int
    validated: int
    rejected: int
    updated: int
    skipped_no_match: int


def _parse_satcat_date(value: str | None) -> datetime | None:
    """SATCAT dates are bare ISO dates ('1958-03-17'), no time component."""
    if value is None:
        return None
    return datetime.fromisoformat(value).replace(tzinfo=UTC)


async def _apply_satcat_record(
    session: AsyncSession, record: SatcatRecord, updated_at: datetime
) -> bool:
    """Update the matching space_object in place. Returns False (no-op) if
    no space_object with this norad_id exists yet — SATCAT never creates an
    identity on its own.
    """
    stmt = select(SpaceObject).where(SpaceObject.norad_id == record["NORAD_CAT_ID"])
    space_object = (await session.execute(stmt)).scalar_one_or_none()
    if space_object is None:
        return False

    space_object.object_type = record["OBJECT_TYPE"]
    space_object.ops_status_code = record["OPS_STATUS_CODE"]
    space_object.country = record["OWNER"]
    space_object.launch_date = _parse_satcat_date(record["LAUNCH_DATE"])
    space_object.launch_site = record["LAUNCH_SITE"]
    space_object.decay_date = _parse_satcat_date(record["DECAY_DATE"])
    space_object.rcs = record["RCS"]
    space_object.data_status_code = record["DATA_STATUS_CODE"]
    space_object.satcat_source = "celestrak-satcat"
    space_object.satcat_updated_at = updated_at
    return True


async def ingest_satcat() -> SatcatIngestionResult:
    csv_text = await fetch_satcat_csv()
    rows = list(csv.DictReader(io.StringIO(csv_text)))

    validated: list[SatcatRecord] = []
    rejected = 0
    for raw in rows:
        try:
            validated.append(validate_satcat_row(raw))
        except SatcatValidationError:
            rejected += 1
            logger.warning("rejected malformed SATCAT row", exc_info=True)

    updated_at = datetime.now(UTC)
    updated = 0
    skipped_no_match = 0
    async with get_session() as session:
        for record in validated:
            applied = await _apply_satcat_record(session, record, updated_at)
            if applied:
                updated += 1
            else:
                skipped_no_match += 1

    return SatcatIngestionResult(
        fetched=len(rows),
        validated=len(validated),
        rejected=rejected,
        updated=updated,
        skipped_no_match=skipped_no_match,
    )
