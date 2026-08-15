"""Wiring tests: assess_conjunction's orchestration must match the same
domain functions called manually outside it, with consistent frame
handling throughout. Domain-level physics correctness is already covered
by test_conjunction.py / test_covariance.py — this only checks the service
calls them correctly and doesn't scramble frames along the way.
"""

from datetime import UTC, datetime

import numpy as np
import pytest

from app.domain.conjunction import (
    b_plane_projection,
    is_critical,
    mahalanobis_distance,
    probability_of_collision,
    project_to_b_plane,
    time_of_closest_approach,
)
from app.domain.coordinates import eci_to_ecef_km, gmst_rad
from app.domain.covariance import combine_covariance, eci_to_ecef_covariance
from app.domain.propagation import propagate, satrec_from_omm
from app.domain.types import OmmRecord, Vec3
from app.services.conjunction_service import _eci_to_ecef_velocity, assess_conjunction

EPOCH = datetime(2026, 1, 1, tzinfo=UTC)

PRIMARY_OMM: OmmRecord = {
    "OBJECT_NAME": "ORCAS-TEST-PRIMARY",
    "OBJECT_ID": "1998-999A",
    "EPOCH": "2026-01-01T00:00:00.000000",
    "MEAN_MOTION": 15.5,
    "ECCENTRICITY": 0.0001,
    "INCLINATION": 51.6,
    "RA_OF_ASC_NODE": 0.0,
    "ARG_OF_PERICENTER": 0.0,
    "MEAN_ANOMALY": 0.0,
    "EPHEMERIS_TYPE": 0,
    "CLASSIFICATION_TYPE": "U",
    "NORAD_CAT_ID": "90101",
    "ELEMENT_SET_NO": 999,
    "REV_AT_EPOCH": 1,
    "BSTAR": 0.0,
    "MEAN_MOTION_DOT": 0.0,
    "MEAN_MOTION_DDOT": 0.0,
}
SECONDARY_OMM: OmmRecord = {
    **PRIMARY_OMM,
    "NORAD_CAT_ID": "90102",
    "RA_OF_ASC_NODE": 0.05,
    "MEAN_ANOMALY": 0.2,
}

COVARIANCE = np.diag([1.0, 1.0, 1.0])  # km^2 — arbitrary test value, not a real-object claim


def test_assess_conjunction_matches_manual_pipeline() -> None:
    primary_sat = satrec_from_omm(PRIMARY_OMM)
    secondary_sat = satrec_from_omm(SECONDARY_OMM)
    start = EPOCH
    end = datetime(2026, 1, 1, 1, 0, 0, tzinfo=UTC)

    result = assess_conjunction(
        primary_sat,
        secondary_sat,
        "90101",
        "90102",
        COVARIANCE,
        COVARIANCE,
        combined_hard_body_radius_km=0.02,
        search_start=start,
        search_end=end,
    )

    def pos_p(at: datetime) -> Vec3:
        return propagate(primary_sat, at, "90101").position_km_eci

    def pos_s(at: datetime) -> Vec3:
        return propagate(secondary_sat, at, "90102").position_km_eci

    tca = time_of_closest_approach(pos_p, pos_s, start, end)
    assert result.tca == tca

    state_p = propagate(primary_sat, tca, "90101")
    state_s = propagate(secondary_sat, tca, "90102")
    gmst = gmst_rad(tca)
    pos_p_ecef = eci_to_ecef_km(state_p.position_km_eci, gmst)
    pos_s_ecef = eci_to_ecef_km(state_s.position_km_eci, gmst)
    vel_p_ecef = _eci_to_ecef_velocity(state_p.velocity_km_s_eci, gmst)
    vel_s_ecef = _eci_to_ecef_velocity(state_s.velocity_km_s_eci, gmst)

    relative_position = np.array(
        [pos_p_ecef.x - pos_s_ecef.x, pos_p_ecef.y - pos_s_ecef.y, pos_p_ecef.z - pos_s_ecef.z]
    )
    relative_velocity = Vec3(
        x=vel_p_ecef.x - vel_s_ecef.x, y=vel_p_ecef.y - vel_s_ecef.y, z=vel_p_ecef.z - vel_s_ecef.z
    )

    c_combined = combine_covariance(
        eci_to_ecef_covariance(COVARIANCE, tca), eci_to_ecef_covariance(COVARIANCE, tca)
    )
    projection = b_plane_projection(relative_velocity)
    c_b = project_to_b_plane(c_combined, projection)
    miss_vector = projection @ relative_position

    assert result.mahalanobis_d == pytest.approx(mahalanobis_distance(miss_vector, c_b), abs=1e-9)
    expected_pc = probability_of_collision(miss_vector, c_b, 0.02)
    assert result.probability_pc == pytest.approx(expected_pc, abs=1e-12)
    expected_miss = float(np.linalg.norm(relative_position))
    assert result.miss_distance_km == pytest.approx(expected_miss, abs=1e-9)
    assert result.is_critical == is_critical(result.probability_pc)


def test_assess_conjunction_well_separated_pair_is_not_critical() -> None:
    primary_sat = satrec_from_omm(PRIMARY_OMM)
    far_secondary: OmmRecord = {**PRIMARY_OMM, "NORAD_CAT_ID": "90103", "RA_OF_ASC_NODE": 90.0}
    secondary_sat = satrec_from_omm(far_secondary)

    result = assess_conjunction(
        primary_sat,
        secondary_sat,
        "90101",
        "90103",
        COVARIANCE,
        COVARIANCE,
        combined_hard_body_radius_km=0.02,
        search_start=EPOCH,
        search_end=datetime(2026, 1, 1, 0, 5, 0, tzinfo=UTC),
    )
    assert result.mahalanobis_d > 100  # wildly different orbital planes
    assert result.is_critical is False
