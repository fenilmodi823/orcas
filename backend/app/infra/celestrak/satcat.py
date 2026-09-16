"""CelesTrak SATCAT bulk fetch — the full catalogue in one request, verified
live 2026-09-15 as https://celestrak.org/pub/satcat.csv (CSV; RA14.D4: never
the legacy fixed-field format, which stops at catalog number 70000). Called
only from the ingestion worker/service — same layering as celestrak/client.py.
"""

import httpx

from app.infra.celestrak.client import CelesTrakFetchError
from app.settings import settings

SATCAT_URL = "https://celestrak.org/pub/satcat.csv"


async def fetch_satcat_csv() -> str:
    """Fetch the entire SATCAT as CSV text. Raises CelesTrakFetchError on
    any failure — callers keep whatever they already had rather than
    propagate a partial result (Data-Strategy.md: "stale data with an
    honest epoch beats no data").
    """
    headers = {"User-Agent": settings.celestrak_user_agent}
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(SATCAT_URL, headers=headers)
            response.raise_for_status()
            return response.text
    except httpx.HTTPError as exc:
        raise CelesTrakFetchError(f"SATCAT fetch failed: {exc}") from exc
