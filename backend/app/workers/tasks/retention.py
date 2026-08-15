"""CLI entrypoint for one retention run.

    docker compose run --rm worker python -m app.workers.tasks.retention --once

Recurring cadence is GitHub Actions cron in production (Data-Strategy.md
§6) or the dev-only AsyncIOScheduler (workers/scheduler.py) — this module
only runs a single pass.
"""

import argparse
import asyncio
import logging
import sys

from app.infra.db.base import get_session
from app.infra.logging import configure_logging
from app.services.retention_service import archive_and_purge_old_element_sets
from app.settings import settings

logger = logging.getLogger(__name__)


async def _run() -> int:
    async with get_session() as session:
        result = await archive_and_purge_old_element_sets(
            session, retention_days=settings.retention_days, archive_dir=settings.archive_dir
        )

    logger.info(
        "retention complete", extra={"archived": result.archived, "deleted": result.deleted}
    )
    return 0


def main() -> None:
    configure_logging()
    parser = argparse.ArgumentParser(description="Run one retention archive+purge pass.")
    parser.add_argument("--once", action="store_true", required=True, help="run once and exit")
    parser.parse_args()

    exit_code = asyncio.run(_run())
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
