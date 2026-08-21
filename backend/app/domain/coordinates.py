"""ECI/ECEF/geodetic frame conversions. GMST-based rotation — this is the
same J (GMST Jacobian) the covariance pipeline uses to rotate C_ECI into
C_ECEF, so propagation and covariance stay on one consistent frame model.
Algorithm: Vallado, "Fundamentals of Astrodynamics and Applications" —
the same IAU-82 GMST + iterative WGS84 geodetic conversion satellite.js
uses on the frontend.
"""

import math
from datetime import UTC, datetime

from app.domain.types import GeodeticPosition, Vec3

_WGS84_A_KM = 6378.137  # semi-major axis
_WGS84_F = 1 / 298.257223563  # flattening
_WGS84_E2 = _WGS84_F * (2 - _WGS84_F)  # eccentricity squared
_WGS84_B_KM = _WGS84_A_KM * (1 - _WGS84_F)  # semi-minor axis, 6356.752314245 km


def gmst_rad(at: datetime) -> float:
    """Greenwich Mean Sidereal Time. Input: UTC datetime. Output: radians, [0, 2pi)."""
    jd = _julian_date(at)
    t = (jd - 2451545.0) / 36525.0
    gmst_deg = (
        280.46061837
        + 360.98564736629 * (jd - 2451545.0)
        + 0.000387933 * t * t
        - t * t * t / 38710000.0
    )
    return math.radians(gmst_deg % 360.0)


def _julian_date(at: datetime) -> float:
    at = at.astimezone(UTC)
    year, month = at.year, at.month
    if month <= 2:
        year -= 1
        month += 12
    a = year // 100
    b = 2 - a + a // 4
    day_frac = at.day + (
        (at.hour + (at.minute + (at.second + at.microsecond / 1e6) / 60.0) / 60.0) / 24.0
    )
    return (
        math.floor(365.25 * (year + 4716))
        + math.floor(30.6001 * (month + 1))
        + day_frac
        + b
        - 1524.5
    )


def eci_to_ecef_km(position_km_eci: Vec3, gmst: float) -> Vec3:
    """Rotate an ECI (TEME) position vector into ECEF by -GMST about Z. Input/output km."""
    cos_g, sin_g = math.cos(gmst), math.sin(gmst)
    return Vec3(
        x=position_km_eci.x * cos_g + position_km_eci.y * sin_g,
        y=-position_km_eci.x * sin_g + position_km_eci.y * cos_g,
        z=position_km_eci.z,
    )


def ecef_to_geodetic_deg(position_km_ecef: Vec3) -> GeodeticPosition:
    """WGS84 ECEF to geodetic via Bowring's closed-form parametric-latitude
    method — no iteration. ~9.6x faster than the previous fixed-iteration
    loop and pole-safe; the old loop returned -6399.59 km instead of
    +443.25 km at x=y=0 (r/cos(lat) singular at the pole) — see ORCAS
    Vault Phase-4 Engineering Brief Part 3.3 (Bug 2). Input km, output
    deg/deg/km. Accuracy vs a 60-iteration reference: ~5 cm on the
    ground, ~0.31 m height.
    """
    x, y, z = position_km_ecef.x, position_km_ecef.y, position_km_ecef.z
    lon = math.atan2(y, x)
    r = math.hypot(x, y)

    if r < 1e-9:  # on the spin axis — atan2(y, x) above and the Bowring
        # step below are both singular here; handle the pole directly.
        sign = 1.0 if z >= 0 else -1.0
        return GeodeticPosition(
            latitude_deg=90.0 * sign,
            longitude_deg=0.0,
            altitude_km=abs(z) - _WGS84_B_KM,
        )

    ep2 = _WGS84_E2 / (1 - _WGS84_E2)  # second eccentricity squared
    th = math.atan2(_WGS84_A_KM * z, _WGS84_B_KM * r)
    st, ct = math.sin(th), math.cos(th)
    lat = math.atan2(
        z + ep2 * _WGS84_B_KM * st**3,
        r - _WGS84_E2 * _WGS84_A_KM * ct**3,
    )

    sin_lat = math.sin(lat)
    n = _WGS84_A_KM / math.sqrt(1 - _WGS84_E2 * sin_lat * sin_lat)
    # near the poles, r/cos(lat) is ill-conditioned; switch height branch
    # at |lat| > 30 deg (|sin(lat)| > 0.5), same trick as the pole guard.
    alt = (
        z / sin_lat - n * (1 - _WGS84_E2)
        if abs(sin_lat) > 0.5
        else r / math.cos(lat) - n
    )
    return GeodeticPosition(
        latitude_deg=math.degrees(lat), longitude_deg=math.degrees(lon), altitude_km=alt
    )


def eci_to_geodetic_deg(position_km_eci: Vec3, at: datetime) -> GeodeticPosition:
    """ECI (TEME) position -> geodetic. Input: km, UTC datetime. Output: deg/deg/km above WGS84."""
    return ecef_to_geodetic_deg(eci_to_ecef_km(position_km_eci, gmst_rad(at)))
