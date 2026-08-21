"""Legacy two-line element (TLE) import adapter. TLE is never the primary
ingestion format — see Rules.md and Data-Strategy.md "TLE is a legacy
import adapter only." This module's only job is producing the same
canonical OmmRecord that CelesTrak's OMM JSON produces, so nothing
downstream can tell which format an object arrived in.

python-sgp4's Satrec.twoline2rv() parses into SGP4's internal working
units (radians, rad/min) rather than the CCSDS OMM units (degrees,
rev/day) — every conversion here undoes that, verified empirically
against a known TLE rather than assumed from the TLE spec alone.
"""

import math

from sgp4.api import SGP4_ERRORS, WGS72, Satrec
from sgp4.conveniences import sat_epoch_datetime

from app.domain.types import OmmRecord

_RAD_TO_DEG = 180.0 / math.pi
_RAD_PER_MIN_TO_REV_PER_DAY = 1440.0 / (2.0 * math.pi)  # rad/min -> rev/day


class TleParseError(Exception):
    """The two lines don't form a usable element set — Satrec.twoline2rv()
    sets a nonzero .error rather than raising, so this checks it explicitly
    (same convention as PropagationFailedError).
    """

    def __init__(self, sgp4_error: int) -> None:
        self.sgp4_error = sgp4_error
        reason = SGP4_ERRORS.get(sgp4_error, "unknown error")
        super().__init__(f"TLE parse failed: {reason}")


def _object_id_from_intldesg(intldesg: str) -> str:
    """'98067A' -> '1998-067A'. Pivot year 57 is the standard NORAD/Space-Track
    convention (Sputnik launched 1957) — not a project invention.
    """
    year_2d = int(intldesg[:2])
    year = 1900 + year_2d if year_2d >= 57 else 2000 + year_2d
    return f"{year}-{intldesg[2:]}"


def omm_record_from_tle(line1: str, line2: str, object_name: str = "UNKNOWN") -> OmmRecord:
    """Parse a legacy two-line element set into the canonical OmmRecord.
    Input: raw TLE text (line 1 and 2, no header line). Output: the same
    shape CelesTrak's OMM JSON produces — deg, rev/day.
    """
    sat = Satrec.twoline2rv(line1, line2, WGS72)
    if sat.error != 0:
        raise TleParseError(sat.error)

    return OmmRecord(
        OBJECT_NAME=object_name,
        OBJECT_ID=_object_id_from_intldesg(sat.intldesg),
        EPOCH=sat_epoch_datetime(sat).strftime("%Y-%m-%dT%H:%M:%S.%f"),
        MEAN_MOTION=sat.no_kozai * _RAD_PER_MIN_TO_REV_PER_DAY,
        ECCENTRICITY=sat.ecco,
        INCLINATION=sat.inclo * _RAD_TO_DEG,
        RA_OF_ASC_NODE=sat.nodeo * _RAD_TO_DEG,
        ARG_OF_PERICENTER=sat.argpo * _RAD_TO_DEG,
        MEAN_ANOMALY=sat.mo * _RAD_TO_DEG,
        EPHEMERIS_TYPE=sat.ephtype,
        CLASSIFICATION_TYPE=sat.classification,
        NORAD_CAT_ID=str(sat.satnum),  # decimal string — sat.satnum_str is
        # Alpha-5-encoded ('E8493' for 148493), not decimal; see ORCAS Vault
        # Phase-4 Engineering Brief Part 4.1.
        ELEMENT_SET_NO=sat.elnum,
        REV_AT_EPOCH=sat.revnum,
        BSTAR=sat.bstar,
        MEAN_MOTION_DOT=sat.ndot * (1440.0**2) / (2.0 * math.pi),
        MEAN_MOTION_DDOT=sat.nddot * (1440.0**3) / (2.0 * math.pi),
    )
