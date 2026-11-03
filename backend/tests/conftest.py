"""The test suite never touches the database the app uses.

On 2026-11-03 a retention test, run in the dev container, purged real
element sets from the live `orcas` database: the integration tests shared
the app's DATABASE_URL, and some services act on whole tables. So before
any test module imports app.infra.db, point the settings at `<name>_test`,
create that database if it is missing, and migrate it to head.
"""

import asyncio
import os
import warnings
from pathlib import Path

import asyncpg
from alembic.config import Config
from sqlalchemy.engine import make_url

from alembic import command
from app.settings import settings

_live = make_url(settings.database_url)
_test = (
    _live
    if (_live.database or "").endswith("_test")
    else _live.set(database=f"{_live.database}_test")
)
settings.database_url = _test.render_as_string(hide_password=False)
os.environ["DATABASE_URL"] = settings.database_url


async def _create_if_missing() -> None:
    conn = await asyncpg.connect(
        user=_live.username,
        password=_live.password,
        host=_live.host,
        port=_live.port or 5432,
        database=_live.database,
    )
    try:
        exists = await conn.fetchval("SELECT 1 FROM pg_database WHERE datname = $1", _test.database)
        if not exists:
            await conn.execute(f'CREATE DATABASE "{_test.database}"')
    finally:
        await conn.close()


try:
    asyncio.run(_create_if_missing())
except OSError as exc:
    # No Postgres here (a domain-only run on the host): unit tests still run,
    # database tests fail with their own connection errors.
    warnings.warn(f"test database not prepared, Postgres unreachable: {exc}", stacklevel=1)
else:
    command.upgrade(Config(str(Path(__file__).parent.parent / "alembic.ini")), "head")
