from functools import lru_cache

from app.infra.cache.base import CacheService
from app.infra.cache.memory import MemoryCache
from app.settings import Settings, settings


def get_settings() -> Settings:
    return settings


@lru_cache
def _cache_singleton() -> CacheService:
    return MemoryCache()


def get_cache() -> CacheService:
    return _cache_singleton()
