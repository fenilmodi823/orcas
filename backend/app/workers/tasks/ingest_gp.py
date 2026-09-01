"""CLI entrypoint for one GP ingestion run.

    docker compose run --rm worker uv run python -m app.workers.tasks.ingest_gp --once

Recurring cadence is GitHub Actions cron in production (Data-Strategy.md
§6) or the dev-only AsyncIOScheduler (workers/scheduler.py) — this module
only runs a single pass.
"""

import argparse
import asyncio
import logging
import sys

from app.infra.celestrak.client import CelesTrakFetchError
from app.infra.logging import configure_logging
from app.services.ingestion_service import ingest_gp

logger = logging.getLogger(__name__)


async def _run(group: str | None) -> int:
    try:
        result = await ingest_gp(group)
    except CelesTrakFetchError as exc:
        logger.error("ingestion aborted: %s", exc)
        return 1

    logger.info(
        "ingestion complete",
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
    parser = argparse.ArgumentParser(description="Run one CelesTrak GP OMM ingestion pass.")
    parser.add_argument("--once", action="store_true", required=True, help="run once and exit")
    parser.add_argument("--group", default=None, help="CelesTrak GP group (default: settings)")
    args = parser.parse_args()

    exit_code = asyncio.run(_run(args.group))
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
