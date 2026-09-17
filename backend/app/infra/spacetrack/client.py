"""Space-Track `gp` class fetch — the only source with the full on-orbit
catalogue including unnamed debris (RA-14 §1.2). Called only from the
ingestion worker/service, never from api/ — see Rules.md "Network I/O
inside a request handler". Cadence and rate limiting (RA-14 §4: <30/min,
<300/hour, random minute offset) are the scheduler's job, not built yet
for either ingestion path (RA-14 §6 step 4); this module only does one
authenticated fetch.
"""

from typing import Any

import httpx

from app.settings import settings

_LOGIN_URL = "https://www.space-track.org/ajaxauth/login"
_GP_QUERY_URL = (
    "https://www.space-track.org/basicspacedata/query/class/gp/"
    "decay_date/null-val/epoch/%3Enow-10/format/json"
)


class SpaceTrackFetchError(Exception):
    """Login failed, or the gp query was unreachable or returned something
    unusable.
    """


async def fetch_spacetrack_gp() -> list[dict[str, Any]]:
    """Log into Space-Track, then fetch the full on-orbit gp catalogue
    (decay_date null, epoch within the last 10 days — Space-Track's own
    documented predicate for "propagable ephemerides for on-orbit
    objects"). Raises SpaceTrackFetchError on any failure — callers keep
    whatever they already had rather than propagate a partial result
    (Data-Strategy.md: "stale data with an honest epoch beats no data").
    """
    credentials = {
        "identity": settings.space_track_username,
        "password": settings.space_track_password,
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            login_response = await client.post(_LOGIN_URL, data=credentials)
            login_response.raise_for_status()
            response = await client.get(_GP_QUERY_URL)
            response.raise_for_status()
            data = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise SpaceTrackFetchError(f"Space-Track gp fetch failed: {exc}") from exc

    if not isinstance(data, list):
        raise SpaceTrackFetchError("Space-Track gp response was not a JSON array")
    return data
