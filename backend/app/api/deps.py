from collections.abc import AsyncIterator
from functools import lru_cache

from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.cache.base import CacheService
from app.infra.cache.memory import MemoryCache
from app.infra.db.base import get_session
from app.settings import Settings, settings


def get_settings() -> Settings:
    return settings


async def get_db_session() -> AsyncIterator[AsyncSession]:
    async with get_session() as session:
        yield session


@lru_cache
def _cache_singleton() -> CacheService:
    return MemoryCache()


def get_cache() -> CacheService:
    return _cache_singleton()
