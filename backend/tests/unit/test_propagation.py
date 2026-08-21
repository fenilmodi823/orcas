"""Regression tests for app.domain.propagation / app.domain.coordinates.

Uses the same synthetic OMM fixture as packages/orcas-physics/test/propagate.test.ts
(a near-circular ~417 km LEO orbit at 51.6 deg inclination) so both language
implementations can be cross-checked against each other. Expected values below
were computed by actually running this code against the fixture, not hand-derived
or copied from the TS test — this is a regression guard, not a claim about a
real catalogued object.
"""

from datetime import UTC, datetime, timedelta

import pytest
from sgp4.api import WGS72, Satrec
from sgp4.conveniences import sat_epoch_datetime

from app.domain.coordinates import eci_to_geodetic_deg
from app.domain.propagation import PropagationFailedError, propagate, satrec_from_omm
from app.domain.types import OmmRecord

TEST_OMM: OmmRecord = {
    "OBJECT_NAME": "ORCAS-TEST-SAT",
    "OBJECT_ID": "1998-999Z",
    "EPOCH": "2026-01-01T00:00:00.000000",
    "MEAN_MOTION": 15.5,
    "ECCENTRICITY": 0.0001,
    "INCLINATION": 51.6,
    "RA_OF_ASC_NODE": 0,
    "ARG_OF_PERICENTER": 0,
    "MEAN_ANOMALY": 0,
    "EPHEMERIS_TYPE": 0,
    "CLASSIFICATION_TYPE": "U",
    "NORAD_CAT_ID": "90001",
    "ELEMENT_SET_NO": 999,
    "REV_AT_EPOCH": 1,
    "BSTAR": 0,
    "MEAN_MOTION_DOT": 0,
    "MEAN_MOTION_DDOT": 0,
}

AT = datetime(2026, 1, 1, 0, 0, 0, tzinfo=UTC)


def test_propagate_reproduces_recorded_eci_state() -> None:
    satrec = satrec_from_omm(TEST_OMM)
    state = propagate(satrec, AT, TEST_OMM["NORAD_CAT_ID"])

    assert state.position_km_eci.x == pytest.approx(6794.92, abs=0.1)
    assert state.position_km_eci.y == pytest.approx(-7.28, abs=0.1)
    assert state.position_km_eci.z == pytest.approx(-9.18, abs=0.1)

    assert state.velocity_km_s_eci.x == pytest.approx(0.0066, abs=0.01)
    assert state.velocity_km_s_eci.y == pytest.approx(4.7576, abs=0.01)
    assert state.velocity_km_s_eci.z == pytest.approx(6.0069, abs=0.01)


def test_propagate_rotates_to_geodetic_consistent_with_417km_circular_orbit() -> None:
    satrec = satrec_from_omm(TEST_OMM)
    state = propagate(satrec, AT, TEST_OMM["NORAD_CAT_ID"])
    geo = eci_to_geodetic_deg(state.position_km_eci, AT)

    assert geo.altitude_km == pytest.approx(416.79, abs=0.1)
    assert geo.latitude_deg == pytest.approx(-0.078, abs=0.01)
    assert geo.longitude_deg == pytest.approx(-100.72, abs=0.1)


def test_propagate_is_deterministic() -> None:
    satrec = satrec_from_omm(TEST_OMM)
    first = propagate(satrec, AT, TEST_OMM["NORAD_CAT_ID"])
    second = propagate(satrec, AT, TEST_OMM["NORAD_CAT_ID"])
    assert first.position_km_eci == second.position_km_eci
    assert first.velocity_km_s_eci == second.velocity_km_s_eci


def test_propagate_raises_on_decayed_orbit() -> None:
    decayed: OmmRecord = {**TEST_OMM, "NORAD_CAT_ID": "90002", "BSTAR": 0.5, "MEAN_MOTION": 16.5}
    satrec = satrec_from_omm(decayed)
    far_future = datetime(2030, 1, 1, tzinfo=UTC)

    with pytest.raises(PropagationFailedError) as exc_info:
        propagate(satrec, far_future, decayed["NORAD_CAT_ID"])
    assert exc_info.value.norad_id == "90002"


def test_decayed_object_22312_fails_with_error_1_not_error_6() -> None:
    """Vallado's canonical verification case 22312 (real element set,
    bundled with python-sgp4 as SGP4-VER.TLE) is annotated "decayed
    2006-04-04" but reports SGP4 error 1 (mean eccentricity out of
    range), not error 6 ("has decayed") — first failing at t=493 min
    since epoch, confirmed by direct scan and matching the brief's own
    measurement of 494.2 min (Part 3.4). A decay predicate that only
    checks error == 6 would misclassify this as healthy. ORCAS's actual
    behaviour (raise PropagationFailedError on ANY nonzero error) already
    gets this right; this test pins that down against future regressions.
    """
    line1 = "1 22312U 93002D   06094.46235912  .99999999  81888-5  49949-3 0  3953"
    line2 = "2 22312  62.1486  77.4698 0308723 267.9229  88.7392 15.95744531 98783"
    sat = Satrec.twoline2rv(line1, line2, WGS72)
    at = sat_epoch_datetime(sat) + timedelta(minutes=500)  # past the t=493 min failure point

    with pytest.raises(PropagationFailedError) as exc_info:
        propagate(sat, at, "22312")
    assert exc_info.value.sgp4_error == 1
