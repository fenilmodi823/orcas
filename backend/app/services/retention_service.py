"""Historical element-set retention: the latest element_set per object is
kept forever; everything else older than the retention window is archived
to Parquet on local disk, then dropped from Postgres. See Data-Strategy.md
§7 — this is what turns "no storage ceiling locally" into a policy rather
than an unbounded table.
"""

import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.db.models import ElementSet

logger = logging.getLogger(__name__)

# Every element_set column — archived as-is so the Parquet file alone
# preserves provenance (Architecture.md: "append-only... enables historical
# replay") without needing a live database to interpret it.
ARCHIVE_COLUMNS = (
    "id",
    "object_id",
    "epoch",
    "mean_motion",
    "eccentricity",
    "inclination",
    "ra_of_asc_node",
    "arg_of_pericenter",
    "mean_anomaly",
    "bstar",
    "mean_motion_dot",
    "mean_motion_ddot",
    "ephemeris_type",
    "classification_type",
    "element_set_no",
    "rev_at_epoch",
    "source",
    "source_format",
    "source_type",
    "ingested_at",
)


@dataclass(frozen=True)
class RetentionResult:
    archived: int
    deleted: int


async def _find_archival_candidates(session: AsyncSession, cutoff: datetime) -> list[ElementSet]:
    """Rows older than `cutoff`, excluding each object's single latest row —
    that one is kept forever regardless of age (Data-Strategy.md §7: "Latest
    element set per object — Forever").
    """
    latest_ids = (
        select(ElementSet.id)
        .distinct(ElementSet.object_id)
        .order_by(ElementSet.object_id, ElementSet.epoch.desc())
    ).scalar_subquery()

    stmt = select(ElementSet).where(ElementSet.epoch < cutoff, ElementSet.id.not_in(latest_ids))
    return list((await session.execute(stmt)).scalars().all())


def _archive_to_parquet(rows: list[ElementSet], archive_dir: str, run_at: datetime) -> Path:
    # ponytail: one Parquet file per retention run, not a merged/partitioned
    # dataset — fine for cold storage; upgrade to pyarrow.dataset if the
    # archive ever needs to be queried rather than just kept.
    directory = Path(archive_dir)
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"element_set_archive_{run_at.strftime('%Y%m%dT%H%M%SZ')}.parquet"

    table = pa.table({col: [getattr(row, col) for row in rows] for col in ARCHIVE_COLUMNS})
    pq.write_table(table, path)
    return path


async def archive_and_purge_old_element_sets(
    session: AsyncSession, retention_days: int, archive_dir: str
) -> RetentionResult:
    """Caller owns the transaction (see infra/db/base.get_session) — this
    function only reads and deletes within it.
    """
    cutoff = datetime.now(UTC) - timedelta(days=retention_days)
    candidates = await _find_archival_candidates(session, cutoff)
    if not candidates:
        return RetentionResult(archived=0, deleted=0)

    _archive_to_parquet(candidates, archive_dir, datetime.now(UTC))

    ids = [row.id for row in candidates]
    await session.execute(delete(ElementSet).where(ElementSet.id.in_(ids)))

    logger.info(
        "retention run complete", extra={"archived": len(ids), "cutoff": cutoff.isoformat()}
    )
    return RetentionResult(archived=len(ids), deleted=len(ids))
