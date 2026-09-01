"""CLI entrypoint for one snapshot-bake run.

    docker compose run --rm worker uv run python -m app.workers.tasks.bake_snapshot --once

Recurring cadence is GitHub Actions cron in production (Data-Strategy.md
§6, every 6 h) or the dev-only AsyncIOScheduler (workers/scheduler.py) —
this module only runs a single pass.
"""

import argparse
import asyncio
import logging
import sys

from app.infra.db.base import get_session
from app.infra.logging import configure_logging
from app.services.snapshot_service import build_snapshot, write_snapshot
from app.settings import settings

logger = logging.getLogger(__name__)


async def _run() -> int:
    async with get_session() as session:
        result = await build_snapshot(session)

    if not result.objects:
        logger.warning("snapshot skipped: no element sets in the database yet")
        return 1

    write_snapshot(result, settings.snapshot_dir)
    logger.info(
        "snapshot bake complete",
        extra={"object_count": len(result.objects), "newest_epoch": str(result.newest_epoch)},
    )
    return 0


def main() -> None:
    configure_logging()
    parser = argparse.ArgumentParser(description="Bake one catalogue snapshot.")
    parser.add_argument("--once", action="store_true", required=True, help="run once and exit")
    parser.parse_args()

    exit_code = asyncio.run(_run())
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
