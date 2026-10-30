"""CLI entrypoint for one static-site bake (Stage 2 spec §3).

    docker compose run --rm worker uv run python -m app.workers.tasks.bake_site --once

Run straight after a screen; reads the local database only.
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

from app.infra.db.base import get_session
from app.infra.logging import configure_logging
from app.services.site_bake_service import BakeGuardError, bake_site
from app.settings import settings

logger = logging.getLogger(__name__)


async def _run() -> int:
    try:
        async with get_session() as session:
            sizes = await bake_site(session, Path(settings.site_dir))
    except BakeGuardError as err:
        logger.error("site bake refused: %s", err)
        return 1
    total = sum(sizes.values())
    logger.info("site bake complete", extra={"files": len(sizes), "bytes": total})
    print(f"site bake: {len(sizes)} files, {total:,} bytes -> {settings.site_dir}")
    return 0


def main() -> None:
    configure_logging()
    parser = argparse.ArgumentParser(description="Bake the public site's data files.")
    parser.add_argument("--once", action="store_true", required=True, help="run once and exit")
    parser.parse_args()
    sys.exit(asyncio.run(_run()))


if __name__ == "__main__":
    main()
