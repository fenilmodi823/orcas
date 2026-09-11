"""Golden-file reconstruction of the 2009 Iridium 33 / Cosmos 2251 collision.

Three claims, verified separately — see data/sample/README.md, memory.md
issue #18, and ORCAS Vault RA-11 §5 / RA - Open Questions C.3:

1. KINEMATICS — exact, no tuning. Propagating the real Space-Track element
   sets (data/sample/iridium33_cosmos2251_2009_spacetrack.tle) to the
   paper's own T0 = 2009-02-10 16:56:00 UTC reproduces the paper's Table I
   altitude, latitude and longitude.

2. PREDICTION — from the element sets a screener could actually have had.
   The fixture's last-listed sets have epochs 1.2-1.3 h AFTER the collision,
   so they are hindsight. The latest PRE-event sets (Iridium 33 epoch
   2009-02-09 18:49:39, Cosmos 2251 epoch 2009-02-09 11:57:36) put closest
   approach inside the window CelesTrak's SOCRATES predicted that week —
   16:55:59.670-16:55:59.990 UTC, misses from 117 m to 1.812 km (T.S. Kelso,
   "Analysis of the Iridium 33-Cosmos 2251 Collision", AAS 09-368) — with a
   698.0 m miss.

3. CLASSIFICATION — reached under a documented assumption, never a
   reproduction. The paper's D_M = 1.84 / P_c = 4.2e-3 came from simulated
   covariance matrices it does not state, with a hard-body radius it does
   not state either (memory.md #18, ORCAS Vault RA-12 §3.4). This test uses
   its own explicit covariance assumption, and says how fragile the verdict
   is: P_c lands only ~1.5-1.7x above the threshold, and no circular
   uncertainty of any size could push it past HBR^2 / (e * d^2) (RA-12 §3.1).
"""

import math
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from pathlib import Path

import numpy as np
import pytest
from sgp4.api import Satrec
from sgp4.conveniences import sat_epoch_datetime

from app.domain.conjunction import P_C_ALERT_THRESHOLD
from app.domain.coordinates import eci_to_geodetic_deg
from app.domain.propagation import propagate, satrec_from_omm
from app.domain.tle import omm_record_from_tle
from app.services.conjunction_service import ConjunctionAssessment, assess_conjunction
from app.settings import settings

FIXTURE = Path(settings.data_sample_dir) / "iridium33_cosmos2251_2009_spacetrack.tle"

T0 = datetime(2009, 2, 10, 16, 56, 0, tzinfo=UTC)
IRIDIUM, COSMOS = "IRIDIUM 33", "COSMOS 2251"
NORAD = {IRIDIUM: "24946", COSMOS: "22675"}

#: SOCRATES's predicted-TCA window across its reports of 2009-02-04 to 02-10
#: (T.S. Kelso, AAS 09-368).
SOCRATES_TCA_WINDOW = (
    datetime(2009, 2, 10, 16, 55, 59, 670000, tzinfo=UTC),
    datetime(2009, 2, 10, 16, 55, 59, 990000, tzinfo=UTC),
)

# This test's own covariance assumption — NOT the paper's (see the module
# docstring): isotropic 1-sigma position uncertainty, 500 m for the
# actively-tracked Iridium 33 and 800 m for the long-derelict Cosmos 2251
# (worse tracking is the standard expectation for older debris). Combined
# hard-body radius 20 m, a round order-of-magnitude figure for two
# medium-sized satellites, not a measurement of either spacecraft.
C_PRIMARY = np.eye(3) * 0.5**2  # km^2, sigma = 500 m
C_SECONDARY = np.eye(3) * 0.8**2  # km^2, sigma = 800 m
HARD_BODY_RADIUS_KM = 0.02  # 20 m


def _element_sets(path: Path) -> dict[str, list[tuple[datetime, Satrec]]]:
    """Every (epoch, Satrec) in the 3-line fixture, per object, in file order."""
    lines = [line for line in path.read_text().splitlines() if line.strip()]
    sets: dict[str, list[tuple[datetime, Satrec]]] = {}
    for i in range(0, len(lines), 3):
        name, line1, line2 = lines[i], lines[i + 1], lines[i + 2]
        sat = satrec_from_omm(omm_record_from_tle(line1, line2, object_name=name))
        sets.setdefault(name, []).append((sat_epoch_datetime(sat), sat))
    return sets


def _latest_pre_event(name: str) -> Satrec:
    """The newest set with an epoch before T0 — what a screener could have had."""
    before = [entry for entry in _element_sets(FIXTURE)[name] if entry[0] < T0]
    return max(before, key=lambda entry: entry[0])[1]


def _last_listed(name: str) -> Satrec:
    """The fixture's last set — epochs after the collision, i.e. hindsight."""
    return _element_sets(FIXTURE)[name][-1][1]


Pick = Callable[[str], Satrec]

PICKS = pytest.mark.parametrize(
    "pick", [_latest_pre_event, _last_listed], ids=["pre-event", "post-event"]
)


def _assess(iridium: Satrec, cosmos: Satrec) -> ConjunctionAssessment:
    return assess_conjunction(
        iridium,
        cosmos,
        NORAD[IRIDIUM],
        NORAD[COSMOS],
        C_PRIMARY,
        C_SECONDARY,
        HARD_BODY_RADIUS_KM,
        search_start=T0 - timedelta(minutes=10),
        search_end=T0 + timedelta(minutes=10),
    )


@PICKS
def test_real_2009_elements_reproduce_the_papers_kinematic_state(pick: Pick) -> None:
    """No assumptions, no tuning — just real elements through real SGP4."""
    geo_i = eci_to_geodetic_deg(propagate(pick(IRIDIUM), T0, NORAD[IRIDIUM]).position_km_eci, T0)
    geo_c = eci_to_geodetic_deg(propagate(pick(COSMOS), T0, NORAD[COSMOS]).position_km_eci, T0)

    # Paper's Table I: altitude 788.6/788.6 km, lat 72.51N/72.51N, lon 97.90E/97.90E
    for geo in (geo_i, geo_c):
        assert geo.altitude_km == pytest.approx(788.6, abs=0.5)
        assert geo.latitude_deg == pytest.approx(72.51, abs=0.1)
        assert geo.longitude_deg == pytest.approx(97.90, abs=0.1)


def test_pre_event_elements_predict_the_collision_inside_socrates_window() -> None:
    """Only data a 2009 screener could have had: closest approach inside
    SOCRATES's own predicted window, and a 698.0 m miss — ORCAS's number,
    locked here so a propagation change cannot move it silently.
    """
    result = _assess(_latest_pre_event(IRIDIUM), _latest_pre_event(COSMOS))

    assert SOCRATES_TCA_WINDOW[0] <= result.tca <= SOCRATES_TCA_WINDOW[1]
    assert result.miss_distance_km * 1000 == pytest.approx(698.0, abs=0.5)


@pytest.mark.parametrize(
    ("pick", "miss_m"),
    [(_latest_pre_event, 698.0), (_last_listed, 834.2)],
    ids=["pre-event", "post-event"],
)
def test_critical_only_under_the_documented_assumption(pick: Pick, miss_m: float) -> None:
    """The paper's conclusion — deterministic screening said "safe",
    probabilistic screening flags danger — reached under this test's own
    stated covariance. And bounded: the isotropic assumption can never beat
    the circular maximum HBR^2 / (e * d^2), valid here since d >> HBR.
    """
    result = _assess(pick(IRIDIUM), pick(COSMOS))
    circular_max = HARD_BODY_RADIUS_KM**2 / (math.e * result.miss_distance_km**2)

    assert result.miss_distance_km * 1000 == pytest.approx(miss_m, abs=0.5)
    assert result.is_critical is True
    assert P_C_ALERT_THRESHOLD < result.probability_pc <= circular_max
