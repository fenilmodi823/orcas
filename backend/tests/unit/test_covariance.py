"""Regression tests for app.domain.covariance — analytic, not paper-derived
numbers. A rotation must preserve trace and determinant; that's the check."""

from datetime import UTC, datetime

import numpy as np
import pytest

from app.domain.coordinates import gmst_rad
from app.domain.covariance import combine_covariance, eci_to_ecef_covariance, gmst_jacobian

AT = datetime(2026, 1, 1, 6, 0, 0, tzinfo=UTC)


def test_gmst_jacobian_is_a_rotation() -> None:
    j = gmst_jacobian(AT)
    identity = np.eye(3)
    assert j @ j.T == pytest.approx(identity, abs=1e-9)
    assert np.linalg.det(j) == pytest.approx(1.0, abs=1e-9)


def test_eci_to_ecef_covariance_preserves_trace_and_determinant() -> None:
    c_eci = np.array(
        [
            [4.0, 0.5, 0.0],
            [0.5, 9.0, 0.2],
            [0.0, 0.2, 1.0],
        ]
    )
    c_ecef = eci_to_ecef_covariance(c_eci, AT)

    assert np.trace(c_ecef) == pytest.approx(np.trace(c_eci), abs=1e-9)
    assert np.linalg.det(c_ecef) == pytest.approx(np.linalg.det(c_eci), abs=1e-9)
    # A rotation must keep the matrix symmetric.
    assert c_ecef == pytest.approx(c_ecef.T, abs=1e-12)


def test_gmst_jacobian_matches_gmst_rad() -> None:
    gmst = gmst_rad(AT)
    j = gmst_jacobian(AT)
    expected = np.array(
        [
            [np.cos(gmst), np.sin(gmst), 0.0],
            [-np.sin(gmst), np.cos(gmst), 0.0],
            [0.0, 0.0, 1.0],
        ]
    )
    assert j == pytest.approx(expected, abs=1e-12)


def test_combine_covariance_is_additive() -> None:
    c_p = np.diag([1.0, 2.0, 3.0])
    c_s = np.diag([4.0, 5.0, 6.0])
    assert combine_covariance(c_p, c_s) == pytest.approx(np.diag([5.0, 7.0, 9.0]))
