"""Golden-file reconstruction of the 2009 Iridium 33 / Cosmos 2251 collision.

Two separate claims, verified separately — see data/sample/README.md and
memory.md issue #18 for the full story:

1. KINEMATICS — exact, no tuning. Propagating the real Space-Track element
   sets (data/sample/iridium33_cosmos2251_2009_spacetrack.tle) to the
   paper's own T0 = 2009-02-10 16:56:00 UTC reproduces the paper's Table I
   altitude, latitude and longitude.

2. CLASSIFICATION — an honest, independent reconstruction, not a
   reproduction. The paper's own covariance matrices for this event were
   hand-picked for the demo, not derived from a formula tied to real
   tracking data — confirmed directly (there is no second real incident to
   calibrate against), not assumed. Reverse-engineering the paper's own
   listed covariance numbers against these real orbital states does not
   reproduce D_M = 1.84 / P_c = 4.2e-3 either. This test uses its own
   explicit, order-of-magnitude-realistic covariance assumption instead,
   and checks that the same CRITICAL classification is reached — never
   that the exact numbers match.
"""

from datetime import UTC, datetime, timedelta
from pathlib import Path

import numpy as np
import pytest
from sgp4.api import Satrec

from app.domain.conjunction import P_C_ALERT_THRESHOLD
from app.domain.coordinates import eci_to_geodetic_deg
from app.domain.propagation import propagate, satrec_from_omm
from app.domain.tle import omm_record_from_tle
from app.services.conjunction_service import assess_conjunction
from app.settings import settings

FIXTURE = Path(settings.data_sample_dir) / "iridium33_cosmos2251_2009_spacetrack.tle"

T0 = datetime(2009, 2, 10, 16, 56, 0, tzinfo=UTC)


def _parse_tle_triplets(path: Path) -> dict[str, tuple[str, str]]:
    """Minimal 3-line-TLE reader. The fixture lists each object's epochs in
    chronological order — the last occurrence of a name is its epoch
    closest to the collision, which is what data/sample/README.md says to
    use, so later entries intentionally overwrite earlier ones here.
    """
    lines = [line for line in path.read_text().splitlines() if line.strip()]
    result: dict[str, tuple[str, str]] = {}
    for i in range(0, len(lines), 3):
        name, line1, line2 = lines[i], lines[i + 1], lines[i + 2]
        result[name] = (line1, line2)
    return result


def _load_satrecs() -> tuple[Satrec, Satrec]:
    tles = _parse_tle_triplets(FIXTURE)
    iridium = satrec_from_omm(omm_record_from_tle(*tles["IRIDIUM 33"], object_name="IRIDIUM 33"))
    cosmos = satrec_from_omm(omm_record_from_tle(*tles["COSMOS 2251"], object_name="COSMOS 2251"))
    return iridium, cosmos


def test_real_2009_elements_reproduce_the_papers_kinematic_state() -> None:
    """No assumptions, no tuning — just real elements through real SGP4."""
    iridium, cosmos = _load_satrecs()
    state_i = propagate(iridium, T0, "24946")
    state_c = propagate(cosmos, T0, "22675")
    geo_i = eci_to_geodetic_deg(state_i.position_km_eci, T0)
    geo_c = eci_to_geodetic_deg(state_c.position_km_eci, T0)

    # Paper's Table I: altitude 788.6/788.6 km, lat 72.51N/72.51N, lon 97.90E/97.90E
    assert geo_i.altitude_km == pytest.approx(788.6, abs=0.5)
    assert geo_c.altitude_km == pytest.approx(788.6, abs=0.5)
    assert geo_i.latitude_deg == pytest.approx(72.51, abs=0.1)
    assert geo_c.latitude_deg == pytest.approx(72.51, abs=0.1)
    assert geo_i.longitude_deg == pytest.approx(97.90, abs=0.1)
    assert geo_c.longitude_deg == pytest.approx(97.90, abs=0.1)


def test_reconstruction_reaches_critical_classification() -> None:
    """The paper's own conclusion, reached independently: deterministic
    screening said "safe", probabilistic screening correctly flags danger.

    Covariance below is this test's own explicit assumption, not the
    paper's (which is undocumented and confirmed hand-picked — see the
    module docstring): isotropic 1-sigma position uncertainty, 500 m for
    the actively-tracked Iridium 33 and 800 m for the longer-derelict
    Cosmos 2251 (worse tracking is the standard expectation for older
    debris) — both well within the range reported for era-appropriate LEO
    catalog tracking. Combined hard-body radius 20 m, a round
    order-of-magnitude figure for two medium-sized satellites, not a
    measurement of either spacecraft.
    """
    iridium, cosmos = _load_satrecs()
    c_p = np.eye(3) * 0.5**2  # km^2, isotropic, sigma = 500 m
    c_s = np.eye(3) * 0.8**2  # km^2, isotropic, sigma = 800 m
    combined_hard_body_radius_km = 0.02  # 20 m

    result = assess_conjunction(
        iridium,
        cosmos,
        "24946",
        "22675",
        c_p,
        c_s,
        combined_hard_body_radius_km,
        search_start=T0 - timedelta(minutes=10),
        search_end=T0 + timedelta(minutes=10),
    )

    assert result.probability_pc > P_C_ALERT_THRESHOLD
    assert result.is_critical is True
