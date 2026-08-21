"""Regression tests for app.domain.coordinates.ecef_to_geodetic_deg —
the pole singularity (brief Part 3.3, Bug 2) and its Bowring closed-form
fix, milestone M0.2.
"""

import math

import pytest

from app.domain.coordinates import ecef_to_geodetic_deg
from app.domain.types import Vec3

# WGS-84 semi-minor axis, km (a * (1 - f), f = 1/298.257223563). True
# height at the exact pole for a given z is z - b, since R (=hypot(x,y))
# is 0 there. Brief's own worked example: z=6800 -> height 443.247686 km.
_B_KM = 6356.752314245


def test_north_pole_returns_correct_altitude_not_the_iterative_bug_value() -> None:
    geo = ecef_to_geodetic_deg(Vec3(x=0.0, y=0.0, z=6800.0))
    assert geo.altitude_km == pytest.approx(6800.0 - _B_KM, abs=1e-3)
    assert geo.latitude_deg == pytest.approx(90.0, abs=1e-6)


def test_south_pole_is_symmetric() -> None:
    geo = ecef_to_geodetic_deg(Vec3(x=0.0, y=0.0, z=-6800.0))
    assert geo.altitude_km == pytest.approx(6800.0 - _B_KM, abs=1e-3)
    assert geo.latitude_deg == pytest.approx(-90.0, abs=1e-6)


def _geodetic_to_ecef_km(lat_deg: float, lon_deg: float, alt_km: float) -> Vec3:
    """Standard forward WGS-84 formula — test-only, used to build known
    ground-truth points and confirm ecef_to_geodetic_deg recovers them.
    """
    a, f = 6378.137, 1 / 298.257223563
    e2 = f * (2 - f)
    lat, lon = math.radians(lat_deg), math.radians(lon_deg)
    n = a / math.sqrt(1 - e2 * math.sin(lat) ** 2)
    x = (n + alt_km) * math.cos(lat) * math.cos(lon)
    y = (n + alt_km) * math.cos(lat) * math.sin(lon)
    z = (n * (1 - e2) + alt_km) * math.sin(lat)
    return Vec3(x=x, y=y, z=z)


@pytest.mark.parametrize(
    "lat_deg,lon_deg,alt_km",
    [
        (0.0, 0.0, 400.0),
        (0.0, 179.999, 35786.0),
        (45.0, -73.5, 550.0),
        (-51.6, 120.0, 417.0),
        (89.9, 10.0, 800.0),
        (-89.9999, -10.0, 800.0),
    ],
)
def test_round_trips_within_brief_measured_bowring_accuracy(
    lat_deg: float, lon_deg: float, alt_km: float
) -> None:
    """Bowring vs a 60-iteration reference, per the brief's own measurement
    (Part 3.3): max latitude error ~1.7e-3 arcsec (~5.4 cm ground), max
    height error 0.31 m. Use those bounds, not machine precision.
    """
    ecef = _geodetic_to_ecef_km(lat_deg, lon_deg, alt_km)
    geo = ecef_to_geodetic_deg(ecef)
    assert geo.latitude_deg == pytest.approx(lat_deg, abs=1.7e-3 / 3600)
    assert geo.longitude_deg == pytest.approx(lon_deg, abs=1.7e-3 / 3600)
    assert geo.altitude_km == pytest.approx(alt_km, abs=0.001)  # 0.31 m bound, generous
