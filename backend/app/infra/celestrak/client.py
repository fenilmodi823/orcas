"""CelesTrak GP (OMM JSON) fetch — the first real network I/O in the new
backend. Called only from the ingestion worker/service, never from api/ —
see Rules.md "Network I/O inside a request handler" (the old backend's
fatal flaw). Cadence is the scheduler's job (every 6h, workers/scheduler.py);
this module only does one fetch.
"""

from typing import Any

import httpx

from app.settings import settings


class CelesTrakFetchError(Exception):
    """The GP endpoint was unreachable or returned something unusable."""


async def fetch_gp_omm(group: str | None = None) -> list[dict[str, Any]]:
    """Fetch one GP group as OMM JSON. Raises CelesTrakFetchError on any
    failure — callers keep the previous snapshot rather than propagate a
    partial result (Data-Strategy.md: "stale data with an honest epoch
    beats no data").
    """
    params = {"GROUP": group or settings.celestrak_group, "FORMAT": "json"}
    headers = {"User-Agent": settings.celestrak_user_agent}
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(settings.celestrak_base_url, params=params, headers=headers)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPError as exc:
        raise CelesTrakFetchError(f"GP fetch failed for group={group}: {exc}") from exc

    if not isinstance(data, list):
        raise CelesTrakFetchError(f"GP response for group={group} was not a JSON array")
    return data
