"""Regression tests for app.domain.conjunction — analytic cases, not
paper-derived numbers. probability_of_collision is cross-checked against
scipy.stats.ncx2 (an independent formula for the same integral: for an
isotropic 2D Gaussian, P(||X|| <= R) is a noncentral chi-square CDF), not
against a value copied from anywhere.
"""

from datetime import UTC, datetime

import numpy as np
import pytest
from scipy.stats import ncx2

from app.domain.conjunction import (
    P_C_ALERT_THRESHOLD,
    b_plane_projection,
    is_critical,
    mahalanobis_distance,
    probability_of_collision,
    project_to_b_plane,
    time_of_closest_approach,
)
from app.domain.types import Vec3


def test_b_plane_projection_is_orthonormal_and_perpendicular_to_velocity() -> None:
    v = Vec3(x=7.5, y=0.0, z=0.0)
    p = b_plane_projection(v)

    assert p.shape == (2, 3)
    assert p @ p.T == pytest.approx(np.eye(2), abs=1e-9)
    v_hat = np.array([1.0, 0.0, 0.0])
    assert p @ v_hat == pytest.approx(np.zeros(2), abs=1e-9)


def test_b_plane_projection_rejects_zero_velocity() -> None:
    with pytest.raises(ValueError, match="zero"):
        b_plane_projection(Vec3(x=0.0, y=0.0, z=0.0))


def test_project_to_b_plane_extracts_expected_submatrix() -> None:
    # Relative velocity along x — B-plane is the y-z plane, so C_B should be
    # exactly the y-z block of the combined 3x3 covariance.
    c_combined = np.diag([9.0, 4.0, 1.0])
    p = b_plane_projection(Vec3(x=3.0, y=0.0, z=0.0))
    c_b = project_to_b_plane(c_combined, p)
    assert c_b == pytest.approx(np.diag([4.0, 1.0]), abs=1e-9)


def test_mahalanobis_distance_isotropic_case() -> None:
    sigma = 2.0
    c_b = np.eye(2) * sigma**2
    r = np.array([3.0, 4.0])  # |r| = 5
    assert mahalanobis_distance(r, c_b) == pytest.approx(5.0 / sigma, abs=1e-9)


def test_probability_of_collision_zero_miss_isotropic_closed_form() -> None:
    # For an isotropic 2D Gaussian centred on the collision disk, the exact
    # closed form is P_c = 1 - exp(-R^2 / (2*sigma^2)).
    sigma, radius = 1.0, 1.0
    c_b = np.eye(2) * sigma**2
    r = np.array([0.0, 0.0])
    p_c = probability_of_collision(r, c_b, radius)
    assert p_c == pytest.approx(1 - np.exp(-(radius**2) / (2 * sigma**2)), abs=1e-6)


def test_probability_of_collision_matches_noncentral_chi_square() -> None:
    # General isotropic cross-check: P(||X|| <= R) for X ~ N(r, sigma^2 I)
    # is ncx2.cdf(R^2/sigma^2, df=2, nc=(|r|/sigma)^2) — an independent
    # derivation of the same integral, computed by a different scipy function.
    sigma, radius = 0.5, 0.3
    c_b = np.eye(2) * sigma**2
    r = np.array([0.4, 0.1])
    p_c = probability_of_collision(r, c_b, radius)

    r_norm = float(np.linalg.norm(r))
    expected = ncx2.cdf((radius / sigma) ** 2, df=2, nc=(r_norm / sigma) ** 2)
    assert p_c == pytest.approx(expected, abs=1e-6)


def test_probability_of_collision_rejects_nonpositive_radius() -> None:
    with pytest.raises(ValueError, match="positive"):
        probability_of_collision(np.zeros(2), np.eye(2), 0.0)


def test_probability_of_collision_rejects_non_positive_definite_covariance() -> None:
    singular_c_b = np.array([[1.0, 1.0], [1.0, 1.0]])  # det = 0
    with pytest.raises(ValueError, match="positive definite"):
        probability_of_collision(np.zeros(2), singular_c_b, 0.1)


def test_is_critical_threshold() -> None:
    assert P_C_ALERT_THRESHOLD == 1.0e-4
    assert is_critical(4.2e-3) is True  # the paper's Iridium/Cosmos value
    assert is_critical(1.0e-5) is False


def test_time_of_closest_approach_straight_line_crossing() -> None:
    epoch = datetime(2026, 1, 1, tzinfo=UTC)

    def primary(at: datetime) -> Vec3:
        t = (at - epoch).total_seconds()
        return Vec3(x=t, y=0.0, z=0.0)

    def secondary(at: datetime) -> Vec3:
        t = (at - epoch).total_seconds()
        return Vec3(x=5.0 - t, y=10.0, z=0.0)

    start = epoch
    end = datetime(2026, 1, 1, 0, 0, 5, tzinfo=UTC)
    tca = time_of_closest_approach(primary, secondary, start, end)

    assert (tca - epoch).total_seconds() == pytest.approx(2.5, abs=1e-2)
