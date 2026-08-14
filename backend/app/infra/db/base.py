"""Async SQLAlchemy engine, session factory, and declarative base. The only
place in the backend that constructs a database connection — see
Rules.md "Layering is absolute": domain/ never imports this module.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.settings import settings


class Base(DeclarativeBase):
    """Declarative base for all ORM models. alembic/env.py imports its
    .metadata as the single source of truth for migrations.
    """


# NullPool, not the default pool: an asyncpg connection is bound to the
# event loop that created it, and pytest-asyncio hands each test function
# its own loop — a reused pooled connection from a prior test's loop fails
# with "Event loop is closed". NullPool opens a fresh connection per
# checkout, which SQLAlchemy's own async docs recommend for exactly this
# case. This app has no traffic volume where pool reuse would matter (a
# local, single-instance research tool, not a high-throughput API) — if
# that ever changes, swap back to the default pool then, not preemptively.
_engine: AsyncEngine = create_async_engine(settings.database_url, poolclass=NullPool)
_session_factory = async_sessionmaker(_engine, expire_on_commit=False)


@asynccontextmanager
async def get_session() -> AsyncIterator[AsyncSession]:
    """One session per unit of work. Commits on success, rolls back on
    exception — callers never manage transaction boundaries themselves.
    """
    async with _session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def ping() -> bool:
    """True if the database is reachable. Used by /health/ready — never
    raises, since a health check that can itself fail is useless.
    """
    try:
        async with _engine.connect() as conn:
            await conn.exec_driver_sql("SELECT 1")
        return True
    except Exception:
        return False
