"""SGP4 propagation from OMM. Wraps python-sgp4's Satrec directly — OMM is
this project's canonical orbital-data format, TLE is a legacy import adapter
only. See ORCAS Vault/01 - Product/Data-Strategy.md.
"""

from datetime import UTC, datetime

from sgp4 import omm
from sgp4.api import SGP4_ERRORS, WGS72, Satrec, jday

from app.domain.types import OmmRecord, SatState, Vec3


class PropagationFailedError(Exception):
    """SGP4 returned a nonzero error code — decayed orbit, bad elements, etc.
    Never silently render a garbage position; callers must handle this.
    """

    def __init__(self, norad_id: str, at: datetime, sgp4_error: int) -> None:
        self.norad_id = norad_id
        self.at = at
        self.sgp4_error = sgp4_error
        reason = SGP4_ERRORS.get(sgp4_error, "unknown error")
        super().__init__(f"SGP4 propagation failed for {norad_id} at {at.isoformat()}: {reason}")


def satrec_from_omm(record: OmmRecord) -> Satrec:
    """Build an SGP4 propagator from a canonical OMM record.
    Input: CCSDS OMM fields (deg, rev/day). Output: initialised Satrec.
    """
    sat = Satrec()
    omm.initialize(sat, record, WGS72)
    return sat


def propagate(satrec: Satrec, at: datetime, norad_id: str) -> SatState:
    """Propagate a Satrec to a given time.
    Input: Satrec (built from OMM), UTC datetime. Output: ECI (TEME) position
    (km) and velocity (km/s) at that time.
    """
    at = at.astimezone(UTC)
    jd, fr = jday(at.year, at.month, at.day, at.hour, at.minute, at.second + at.microsecond / 1e6)
    error, position, velocity = satrec.sgp4(jd, fr)
    if error != 0:
        raise PropagationFailedError(norad_id, at, error)
    return SatState(position_km_eci=Vec3(*position), velocity_km_s_eci=Vec3(*velocity), at=at)
