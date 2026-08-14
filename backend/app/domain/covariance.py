"""Covariance propagation and combination for conjunction assessment.
C_ECI -> C_ECEF (rotate with the Earth) -> C_c = C_p + C_s (combine at TCA).
See ORCAS Vault/04 - Research/ORCAS Research Paper.md#Method chain.
"""

from datetime import datetime

import numpy as np
from numpy.typing import NDArray

from app.domain.coordinates import gmst_rad

Mat3 = NDArray[np.float64]


def gmst_jacobian(at: datetime) -> Mat3:
    """J: the 3x3 rotation that carries an ECI covariance into ECEF, i.e.
    C_ECEF = J @ C_ECI @ J.T. Same rotation as coordinates.eci_to_ecef_km,
    expressed as a matrix for propagating a covariance rather than a point.
    """
    gmst = gmst_rad(at)
    cos_g, sin_g = np.cos(gmst), np.sin(gmst)
    return np.array(
        [
            [cos_g, sin_g, 0.0],
            [-sin_g, cos_g, 0.0],
            [0.0, 0.0, 1.0],
        ]
    )


def eci_to_ecef_covariance(c_eci: Mat3, at: datetime) -> Mat3:
    """Rotate a positional covariance matrix from ECI into ECEF: C_ECEF = J C_ECI J^T."""
    j = gmst_jacobian(at)
    return j @ c_eci @ j.T


def combine_covariance(c_primary: Mat3, c_secondary: Mat3) -> Mat3:
    """C_c = C_p + C_s — combined covariance of two independent objects at TCA."""
    return c_primary + c_secondary
