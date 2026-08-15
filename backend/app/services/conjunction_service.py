"""Orchestrates the paper's full method chain — TCA search, covariance
combination, B-plane projection, D_M, P_c — for one object pair. No SQL of
its own; callers supply Satrecs and covariances.

This deliberately does NOT estimate C_p/C_s. TLEs/OMM carry no covariance
information at all, and the paper's own exact modeling assumption for the
2009 reconstruction isn't preserved anywhere in this repo (memory.md issue
#18) — inventing one here would silently paper over that gap instead of
leaving it visible. Callers supply covariance explicitly.
"""

import math
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime

import numpy as np
from sgp4.api import Satrec

from app.domain.conjunction import (
    b_plane_projection,
    is_critical,
    mahalanobis_distance,
    probability_of_collision,
    project_to_b_plane,
    time_of_closest_approach,
)
from app.domain.coordinates import eci_to_ecef_km, gmst_rad
from app.domain.covariance import Mat3, combine_covariance, eci_to_ecef_covariance
from app.domain.propagation import propagate
from app.domain.types import Vec3


@dataclass(frozen=True)
class ConjunctionAssessment:
    tca: datetime
    miss_distance_km: float
    mahalanobis_d: float
    probability_pc: float
    is_critical: bool


def _position_fn(satrec: Satrec, norad_id: str) -> Callable[[datetime], Vec3]:
    def position(at: datetime) -> Vec3:
        return propagate(satrec, at, norad_id).position_km_eci

    return position


def _eci_to_ecef_velocity(velocity_km_s_eci: Vec3, gmst: float) -> Vec3:
    # ponytail: same pure Z-rotation as eci_to_ecef_km, no Earth-rotation-rate
    # (omega x r) correction term. Only valid for the RELATIVE velocity of a
    # close encounter — both objects share nearly the same position, so the
    # omega x r term is nearly identical for each and cancels in the
    # difference. Would need the full correction if reused for a large-
    # separation pair. See conjunction_service.py, not coordinates.py, on
    # purpose — this caveat shouldn't travel with a general-purpose utility.
    cos_g, sin_g = math.cos(gmst), math.sin(gmst)
    return Vec3(
        x=velocity_km_s_eci.x * cos_g + velocity_km_s_eci.y * sin_g,
        y=-velocity_km_s_eci.x * sin_g + velocity_km_s_eci.y * cos_g,
        z=velocity_km_s_eci.z,
    )


def assess_conjunction(
    primary_satrec: Satrec,
    secondary_satrec: Satrec,
    primary_norad_id: str,
    secondary_norad_id: str,
    primary_covariance_eci_km2: Mat3,
    secondary_covariance_eci_km2: Mat3,
    combined_hard_body_radius_km: float,
    search_start: datetime,
    search_end: datetime,
) -> ConjunctionAssessment:
    """Full pipeline for one pair over [search_start, search_end]. Positional
    covariance only — TLEs/OMM carry none of the velocity-uncertainty terms
    a full 6x6 state covariance would need (see Presentation Script Q2).
    """
    tca = time_of_closest_approach(
        _position_fn(primary_satrec, primary_norad_id),
        _position_fn(secondary_satrec, secondary_norad_id),
        search_start,
        search_end,
    )

    state_p = propagate(primary_satrec, tca, primary_norad_id)
    state_s = propagate(secondary_satrec, tca, secondary_norad_id)

    gmst = gmst_rad(tca)
    pos_p_ecef = eci_to_ecef_km(state_p.position_km_eci, gmst)
    pos_s_ecef = eci_to_ecef_km(state_s.position_km_eci, gmst)
    vel_p_ecef = _eci_to_ecef_velocity(state_p.velocity_km_s_eci, gmst)
    vel_s_ecef = _eci_to_ecef_velocity(state_s.velocity_km_s_eci, gmst)

    relative_position = np.array(
        [pos_p_ecef.x - pos_s_ecef.x, pos_p_ecef.y - pos_s_ecef.y, pos_p_ecef.z - pos_s_ecef.z]
    )
    relative_velocity = Vec3(
        x=vel_p_ecef.x - vel_s_ecef.x,
        y=vel_p_ecef.y - vel_s_ecef.y,
        z=vel_p_ecef.z - vel_s_ecef.z,
    )

    c_combined = combine_covariance(
        eci_to_ecef_covariance(primary_covariance_eci_km2, tca),
        eci_to_ecef_covariance(secondary_covariance_eci_km2, tca),
    )
    projection = b_plane_projection(relative_velocity)
    c_b = project_to_b_plane(c_combined, projection)
    miss_vector = projection @ relative_position

    d_m = mahalanobis_distance(miss_vector, c_b)
    p_c = probability_of_collision(miss_vector, c_b, combined_hard_body_radius_km)

    return ConjunctionAssessment(
        tca=tca,
        miss_distance_km=float(np.linalg.norm(relative_position)),
        mahalanobis_d=d_m,
        probability_pc=p_c,
        is_critical=is_critical(p_c),
    )
