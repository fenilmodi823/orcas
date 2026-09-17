"""CLI entrypoint for one Space-Track debris/full-catalogue ingestion run.

    docker compose run --rm worker uv run python -m app.workers.tasks.ingest_spacetrack_gp --once

Space-Track's `gp` class with `decay_date/null-val/epoch/>now-10` returns
every on-orbit object the 18th Space Defense Squadron tracks, including
unnamed debris CelesTrak's curated GP groups don't cover (RA-14 §1). Every
object returned is ingested, tagged source="spacetrack-gp" — a second,
separately-labelled source over the same element_set table (RA14.D5), not
a replacement for the CelesTrak GP path. Recurring cadence and the
documented rate limit are not wired up yet — same state as ingest_gp.py
and ingest_satcat.py; this module only runs a single pass.
"""

import argparse
import asyncio
import logging
import sys

from app.infra.logging import configure_logging
from app.infra.spacetrack.client import SpaceTrackFetchError
from app.services.ingestion_service import ingest_spacetrack_gp

logger = logging.getLogger(__name__)


async def _run() -> int:
    try:
        result = await ingest_spacetrack_gp()
    except SpaceTrackFetchError as exc:
        logger.error("Space-Track ingestion aborted: %s", exc)
        return 1

    logger.info(
        "Space-Track ingestion complete",
        extra={
            "fetched": result.fetched,
            "validated": result.validated,
            "rejected": result.rejected,
            "inserted": result.element_sets_inserted,
        },
    )
    return 0


def main() -> None:
    configure_logging()
    parser = argparse.ArgumentParser(description="Run one Space-Track gp ingestion pass.")
    parser.add_argument("--once", action="store_true", required=True, help="run once and exit")
    parser.parse_args()

    exit_code = asyncio.run(_run())
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
