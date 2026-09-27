"""CLI entrypoint for one catalogue conjunction-screening run.

    docker compose run --rm worker uv run python -m app.workers.tasks.screen_conjunctions --once

Screens every object's latest real element set against every other over the
next --hours (default 24) from now, and replaces the stored conjunctions.
About 38 minutes per simulated day on the full ~32,000-object catalogue at
the default 10 s step (measured 2026-09-27). Run after an ingest, so the
screen uses the newest elements.
"""

import argparse
import asyncio
import logging
import sys
from datetime import UTC, datetime, timedelta

from app.domain.screening import ScreeningConfig
from app.infra.db.base import get_session
from app.infra.logging import configure_logging
from app.services.screening_service import run_screening

logger = logging.getLogger(__name__)


async def _run(hours: float, step_s: float) -> int:
    start = datetime.now(UTC).replace(microsecond=0)
    async with get_session() as session:
        result = await run_screening(
            session, start, timedelta(hours=hours), ScreeningConfig(step_s=step_s)
        )
    logger.info(
        "screening complete",
        extra={
            "run_id": result.run_id,
            "objects_screened": result.objects_screened,
            "objects_skipped": result.objects_skipped,
            "colocated_excluded": result.colocated_excluded,
            "encounters": result.encounters,
        },
    )
    return 0 if result.objects_screened else 1


def main() -> None:
    configure_logging()
    parser = argparse.ArgumentParser(description="Screen the catalogue for close approaches.")
    parser.add_argument("--once", action="store_true", required=True, help="run once and exit")
    parser.add_argument("--hours", type=float, default=24.0, help="window length from now")
    parser.add_argument("--step", type=float, default=10.0, help="sampling step, seconds")
    args = parser.parse_args()

    sys.exit(asyncio.run(_run(args.hours, args.step)))


if __name__ == "__main__":
    main()
