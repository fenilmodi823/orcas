"""Static catalogue snapshot — the bundle the frontend boots from with zero
backend calls after the initial fetch. Built and written to disk by a
scheduled worker run, never inside a request handler. See Data-Strategy.md
§3 "Preprocessed" and Architecture.md §2 "Cold load".
"""

import gzip
import json
import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.types import OmmRecord
from app.infra.db.models import ElementSet, SpaceObject

logger = logging.getLogger(__name__)

SNAPSHOT_FILENAME = "catalog-snapshot.json.gz"
META_FILENAME = "meta.json"


class SnapshotObject(OmmRecord):
    """One catalogue entry: the canonical OMM record (fed straight into
    satellite.js json2satrec() on the client, per Data-Strategy.md §9) plus
    the identity/status fields that live on space_object rather than
    element_set. Extra keys are harmless to json2satrec — it reads only the
    fields it recognises.
    """

    OBJECT_TYPE: str | None
    IS_ACTIVE: bool
    SOURCE_TYPE: str


@dataclass(frozen=True)
class SnapshotResult:
    objects: list[SnapshotObject]
    newest_epoch: datetime | None
    source: str


async def build_snapshot(session: AsyncSession) -> SnapshotResult:
    """Latest element_set per object, joined to identity.

    Postgres-only (DISTINCT ON) — consistent with Architecture.md's "why
    PostgreSQL and not SQLite" (this project never targets another engine).
    """
    stmt = (
        select(SpaceObject, ElementSet)
        .join(ElementSet, ElementSet.object_id == SpaceObject.id)
        .distinct(ElementSet.object_id)
        .order_by(ElementSet.object_id, ElementSet.epoch.desc())
    )
    rows = (await session.execute(stmt)).all()

    objects: list[SnapshotObject] = []
    newest_epoch: datetime | None = None
    source = "celestrak"
    for space_object, element_set in rows:
        objects.append(
            SnapshotObject(
                OBJECT_NAME=space_object.name,
                OBJECT_ID=space_object.intl_designator,
                EPOCH=element_set.epoch.isoformat(),
                MEAN_MOTION=element_set.mean_motion,
                ECCENTRICITY=element_set.eccentricity,
                INCLINATION=element_set.inclination,
                RA_OF_ASC_NODE=element_set.ra_of_asc_node,
                ARG_OF_PERICENTER=element_set.arg_of_pericenter,
                MEAN_ANOMALY=element_set.mean_anomaly,
                EPHEMERIS_TYPE=element_set.ephemeris_type,
                CLASSIFICATION_TYPE=element_set.classification_type,
                NORAD_CAT_ID=space_object.norad_id,
                ELEMENT_SET_NO=element_set.element_set_no,
                REV_AT_EPOCH=element_set.rev_at_epoch,
                BSTAR=element_set.bstar,
                MEAN_MOTION_DOT=element_set.mean_motion_dot,
                MEAN_MOTION_DDOT=element_set.mean_motion_ddot,
                OBJECT_TYPE=space_object.object_type,
                IS_ACTIVE=space_object.is_active,
                SOURCE_TYPE=element_set.source_type,
            )
        )
        if newest_epoch is None or element_set.epoch > newest_epoch:
            newest_epoch = element_set.epoch
        source = element_set.source

    return SnapshotResult(objects=objects, newest_epoch=newest_epoch, source=source)


def write_snapshot(result: SnapshotResult, snapshot_dir: str) -> None:
    """Writes the gzip JSON bundle plus a small uncompressed meta.json
    sidecar, so /catalog/meta can answer without decompressing the bundle.
    """
    directory = Path(snapshot_dir)
    directory.mkdir(parents=True, exist_ok=True)

    payload = json.dumps(result.objects).encode("utf-8")
    (directory / SNAPSHOT_FILENAME).write_bytes(gzip.compress(payload))

    meta = {
        "object_count": len(result.objects),
        "newest_epoch": result.newest_epoch.isoformat() if result.newest_epoch else None,
        "source": result.source,
        "generated_at": datetime.now(UTC).isoformat(),
    }
    (directory / META_FILENAME).write_text(json.dumps(meta), encoding="utf-8")

    logger.info(
        "snapshot written",
        extra={"object_count": len(result.objects), "path": str(directory)},
    )
