"""CLI entrypoint for one SATCAT backfill run.

    docker compose run --rm worker uv run python -m app.workers.tasks.ingest_satcat --once

Backfills OBJECT_TYPE/RCS/decay date/etc onto space_object rows already
created by the GP worker (RA-14 §6 steps 2-3). No recurring cadence is
wired up yet — CelesTrak updates SATCAT once or twice daily (RA-14 §4);
this module only runs a single pass, same as ingest_gp.py.
"""

import argparse
import asyncio
import logging
import sys

from app.infra.celestrak.client import CelesTrakFetchError
from app.infra.logging import configure_logging
from app.services.satcat_service import ingest_satcat

logger = logging.getLogger(__name__)


async def _run() -> int:
    try:
        result = await ingest_satcat()
    except CelesTrakFetchError as exc:
        logger.error("SATCAT ingestion aborted: %s", exc)
        return 1

    logger.info(
        "SATCAT ingestion complete",
        extra={
            "fetched": result.fetched,
            "validated": result.validated,
            "rejected": result.rejected,
            "updated": result.updated,
            "skipped_no_match": result.skipped_no_match,
        },
    )
    return 0


def main() -> None:
    configure_logging()
    parser = argparse.ArgumentParser(description="Run one CelesTrak SATCAT backfill pass.")
    parser.add_argument("--once", action="store_true", required=True, help="run once and exit")
    parser.parse_args()

    exit_code = asyncio.run(_run())
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
