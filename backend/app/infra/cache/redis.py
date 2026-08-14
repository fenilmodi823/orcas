from typing import Any

from app.infra.cache.base import CacheService


class RedisCache(CacheService):
    """Not implemented in v1. See Data-Strategy.md §4 swap-in criteria before adding this.

    Introduce only when the backend runs more than one process/replica (in-process
    cache stops being coherent), or when cache-miss latency on hot paths is measured
    to be the bottleneck — not speculatively.
    """

    async def get(self, key: str) -> Any | None:
        raise NotImplementedError("RedisCache is not implemented in v1 — see Data-Strategy.md §4")

    async def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        raise NotImplementedError("RedisCache is not implemented in v1 — see Data-Strategy.md §4")

    async def delete(self, key: str) -> None:
        raise NotImplementedError("RedisCache is not implemented in v1 — see Data-Strategy.md §4")
