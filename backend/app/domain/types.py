"""Domain value types for orbital propagation. Pure — no I/O, no framework imports."""

from dataclasses import dataclass
from datetime import datetime
from typing import TypedDict


class OmmRecord(TypedDict):
    """Canonical OMM record, CCSDS fields as used by CelesTrak GP JSON and
    python-sgp4's omm.initialize(). Units: degrees, rev/day — NOT sgp4's
    internal radian/minute units, which omm.initialize() converts at init time.
    Keep in sync with packages/orcas-physics/src/types.ts OmmRecord.
    """

    OBJECT_NAME: str
    OBJECT_ID: str
    EPOCH: str
    MEAN_MOTION: float
    ECCENTRICITY: float
    INCLINATION: float
    RA_OF_ASC_NODE: float
    ARG_OF_PERICENTER: float
    MEAN_ANOMALY: float
    EPHEMERIS_TYPE: int
    CLASSIFICATION_TYPE: str
    NORAD_CAT_ID: str  # VARCHAR — 6-digit and Alpha-5 catalog numbers are not integers.
    ELEMENT_SET_NO: int
    REV_AT_EPOCH: int
    BSTAR: float
    MEAN_MOTION_DOT: float
    MEAN_MOTION_DDOT: float


class SatcatRecord(TypedDict):
    """CelesTrak SATCAT row — catalogue metadata (type, status, size,
    decay), not orbital elements. Field set confirmed live 2026-09-15
    against https://celestrak.org/pub/satcat.csv.
    """

    OBJECT_NAME: str
    OBJECT_ID: str
    NORAD_CAT_ID: str  # VARCHAR — same rule as OmmRecord.
    OBJECT_TYPE: str | None
    OPS_STATUS_CODE: str | None
    OWNER: str | None  # country/agency code, e.g. "US", "CIS" — not a company name.
    LAUNCH_DATE: str | None  # bare ISO date, e.g. "1958-03-17"
    LAUNCH_SITE: str | None
    DECAY_DATE: str | None  # bare ISO date, or None if still on-orbit
    RCS: float | None  # m^2, radar cross-section — NOT a physical radius (RA-14 §3.1)
    DATA_STATUS_CODE: str | None


@dataclass(frozen=True)
class Vec3:
    x: float
    y: float
    z: float


@dataclass(frozen=True)
class SatState:
    """Position and velocity in the ECI (TEME) frame, km and km/s."""

    position_km_eci: Vec3
    velocity_km_s_eci: Vec3
    at: datetime


@dataclass(frozen=True)
class GeodeticPosition:
    """Geodetic position: degrees, degrees, km above the WGS84 ellipsoid."""

    latitude_deg: float
    longitude_deg: float
    altitude_km: float
