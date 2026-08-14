"""B-plane projection, time of closest approach, Mahalanobis distance and
probability of collision (P_c). See
ORCAS Vault/04 - Research/ORCAS Research Paper.md#Method chain.

P_c is computed by direct 2D numerical quadrature (scipy.integrate.dblquad)
rather than a real-time approximation (Foster/Patera/Alfriend-style closed
forms) — this is server-side batch analysis, not the 60 FPS client scene, so
there's no reason to trade accuracy for speed. This evaluates the paper's own
stated integral exactly rather than guessing which approximation the original
reconstruction used internally. See Rules.md "Never invent a number."
"""

import math
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

import numpy as np
from numpy.typing import NDArray
from scipy import integrate
from scipy.optimize import minimize_scalar

from app.domain.covariance import Mat3
from app.domain.types import Vec3

Mat2 = NDArray[np.float64]
Vec2 = NDArray[np.float64]

#: P_c above this is a critical conjunction. Verified 2009 Iridium 33 /
#: Cosmos 2251 case: P_c = 4.2e-3, two orders of magnitude above threshold.
P_C_ALERT_THRESHOLD = 1.0e-4


def is_critical(p_c: float) -> bool:
    return p_c > P_C_ALERT_THRESHOLD


def b_plane_projection(relative_velocity_km_s: Vec3) -> NDArray[np.float64]:
    """P: 2x3 orthographic projection onto the plane perpendicular to the
    relative velocity vector (the B-plane / encounter plane). Rows are an
    orthonormal basis of that plane. Input km/s, output dimensionless.
    """
    v = np.array([relative_velocity_km_s.x, relative_velocity_km_s.y, relative_velocity_km_s.z])
    speed = float(np.linalg.norm(v))
    if speed == 0.0:
        raise ValueError("relative velocity is zero — no defined encounter plane")
    v_hat = v / speed

    seed = np.array([1.0, 0.0, 0.0]) if abs(v_hat[0]) < 0.9 else np.array([0.0, 1.0, 0.0])
    e1 = seed - np.dot(seed, v_hat) * v_hat
    e1 /= np.linalg.norm(e1)
    e2 = np.cross(v_hat, e1)
    return np.vstack([e1, e2]).astype(np.float64)


def project_to_b_plane(c_combined: Mat3, projection: NDArray[np.float64]) -> Mat2:
    """C_B = P C_c P^T — project the combined 3x3 covariance onto the 2D B-plane."""
    result: Mat2 = (projection @ c_combined @ projection.T).astype(np.float64)
    return result


def mahalanobis_distance(miss_vector_b_plane_km: Vec2, c_b: Mat2) -> float:
    """D_M = sqrt(r^T C_B^-1 r) — separation at TCA in standard deviations, not km."""
    c_b_inv = np.linalg.inv(c_b)
    return float(np.sqrt(miss_vector_b_plane_km @ c_b_inv @ miss_vector_b_plane_km))


def probability_of_collision(
    miss_vector_b_plane_km: Vec2,
    c_b: Mat2,
    combined_hard_body_radius_km: float,
) -> float:
    """P_c = 1/(2*pi*sqrt(det(C_B))) * double-integral, over the disk of the
    combined hard-body radius centred on the miss vector, of
    exp(-1/2 x^T C_B^-1 x) dx dy.
    """
    if combined_hard_body_radius_km <= 0:
        raise ValueError("combined_hard_body_radius_km must be positive")

    det_c_b = np.linalg.det(c_b)
    if det_c_b <= 0:
        raise ValueError("C_B is not positive definite — invalid covariance")
    c_b_inv = np.linalg.inv(c_b)
    prefactor = 1.0 / (2.0 * math.pi * math.sqrt(det_c_b))
    mx, my = float(miss_vector_b_plane_km[0]), float(miss_vector_b_plane_km[1])
    r = combined_hard_body_radius_km

    def integrand(y: float, x: float) -> float:
        v = np.array([x, y])
        return float(np.exp(-0.5 * v @ c_b_inv @ v))

    def y_lower(x: float) -> float:
        return my - math.sqrt(max(r * r - (x - mx) ** 2, 0.0))

    def y_upper(x: float) -> float:
        return my + math.sqrt(max(r * r - (x - mx) ** 2, 0.0))

    # Indexed rather than unpacked: dblquad's stub return type is a union of
    # tuple sizes (2- vs 3-tuple, depending on full_output), so `a, b = ...`
    # trips a tuple-arity mismatch under strict type checkers.
    integral = float(integrate.dblquad(integrand, mx - r, mx + r, y_lower, y_upper)[0])
    return prefactor * integral


def time_of_closest_approach(
    position_primary: Callable[[datetime], Vec3],
    position_secondary: Callable[[datetime], Vec3],
    search_start: datetime,
    search_end: datetime,
) -> datetime:
    """Find TCA by minimizing relative distance over [search_start, search_end].
    Callers pass closures around propagation.propagate() bound to each
    object's Satrec — this function only does the 1D minimisation.
    """
    start = search_start.astimezone(UTC)
    window_s = (search_end.astimezone(UTC) - start).total_seconds()

    def relative_distance(offset_s: float) -> float:
        at = start + timedelta(seconds=offset_s)
        p1 = position_primary(at)
        p2 = position_secondary(at)
        return math.dist((p1.x, p1.y, p1.z), (p2.x, p2.y, p2.z))

    result = minimize_scalar(relative_distance, bounds=(0.0, window_s), method="bounded")
    return start + timedelta(seconds=result.x)
