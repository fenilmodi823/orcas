"""Maximum probability of collision for objects with no covariance, and the
2D-validity gate that decides whether a 2D P_c may be shown at all.

Why this module exists. Public element sets carry no covariance and SGP4
produces none, so a P_c computed for a catalogue object rests on an invented
uncertainty. ORCAS does not do that. It reports instead the *maximum*
probability over a stated family of uncertainty ellipses - the method
CelesTrak's SOCRATES uses on exactly this data (Alfano 2005), at a fixed 3:1
aspect ratio. See ORCAS Vault RA-12.

The distinction is the whole point: "probability" is a claim about this
encounter; "maximum probability over 3:1 ellipses" is a claim about every
encounter of this geometry whose uncertainty has that shape. Only the second
is supportable from public data, and it is meaningless without its aspect
ratio attached - which is why UncertaintySource travels with the number.

Units: kilometres and km/s throughout, matching the rest of domain/.

Not built here: RA-12 section 8's four-provider CovarianceProvider hierarchy.
Nothing consumes it until Phase 5, and UncertaintySource alone carries the
provenance that keeps a bare number off a screen.
"""

import math
from dataclasses import dataclass
from typing import Literal

import numpy as np
from scipy.optimize import minimize_scalar

from app.domain.conjunction import probability_of_collision

#: CARA's criterion: below this relative speed a 2D P_c is inadequate.
MIN_RELATIVE_SPEED_KM_S = 0.010
#: CARA's criterion: above this encounter length a 2D P_c is inadequate.
MAX_ENCOUNTER_DURATION_S = 500.0
#: CelesTrak SOCRATES's convention - radial/in-track/cross-track 100/300/100 m.
SOCRATES_ASPECT_RATIO = 3.0
#: Below this miss-to-hard-body ratio the closed form is not accurate enough
#: and the maximum is computed numerically instead (RA12.D12).
CLOSED_FORM_MIN_MISS_RATIO = 5.0


@dataclass(frozen=True)
class UncertaintySource:
    """Where a B-plane uncertainty came from. Travels with every P_c-shaped
    number to the UI so a bare probability can never reach a screen
    (RA-12 section 7).

    `kind="none"` is not an error: it is the normal, correct state for a
    public-catalogue object, and it is what selects the maximum-P_c display.
    """

    kind: Literal["none", "assumed_regime", "cdm", "differenced"]
    label: str
    aspect_ratio: float | None = None
    dilution_sigma_km: float | None = None
    citation: str | None = None
    sigma_rtn_km: tuple[float, float, float] | None = None

    def __post_init__(self) -> None:
        # A maximum without its family is not a bound - RA-12 section 7.
        if self.kind == "none" and self.aspect_ratio is None:
            raise ValueError(
                "aspect_ratio is required when kind='none': a maximum P_c is "
                "meaningless without the covariance family it maximises over"
            )


@dataclass(frozen=True)
class TwoDValidity:
    """Verdict of the 2D-model validity gate, with the inputs that produced
    it so the UI can explain itself rather than just refusing.
    """

    is_valid: bool
    relative_speed_km_s: float
    encounter_duration_s: float
    reason: str | None = None


@dataclass(frozen=True)
class MaximumPc:
    """A maximum probability of collision and everything needed to display it
    honestly.
    """

    value: float
    aspect_ratio: float
    hard_body_radius_km: float
    miss_distance_km: float
    dilution_sigma_km: float
    method: Literal["closed_form", "numerical", "contact"]
    source: UncertaintySource


def dilution_sigma_km(miss_distance_km: float, aspect_ratio: float) -> float:
    """sigma*_geo = d / sqrt(2*AR) - the uncertainty at which the maximum is
    attained. SOCRATES publishes this as its DILUTION column; it lets a reader
    judge whether real tracking is better or worse than the worst case.
    """
    _require_positive(miss_distance_km=miss_distance_km, aspect_ratio=aspect_ratio)
    return miss_distance_km / math.sqrt(2.0 * aspect_ratio)


def screening_cut_km(
    hard_body_radius_km: float,
    aspect_ratio: float,
    probability_threshold: float,
) -> float:
    """d_cut = HBR * sqrt(AR / (e * P_thr)) - the miss distance beyond which no
    covariance of this aspect ratio can push P_c above the threshold.

    The cut is only as broad as the family: 1,213 m circular but 2,101 m at
    SOCRATES's 3:1 (HBR 20 m, threshold 1e-4). Quoting the circular number
    while assuming 3:1 would under-screen, so the aspect ratio is required.
    """
    _require_positive(
        hard_body_radius_km=hard_body_radius_km,
        aspect_ratio=aspect_ratio,
        probability_threshold=probability_threshold,
    )
    return hard_body_radius_km * math.sqrt(aspect_ratio / (math.e * probability_threshold))


def encounter_duration_s(miss_distance_km: float, relative_speed_km_s: float) -> float:
    """ORCAS's own encounter-duration definition, ~4.243 * d / v_rel.

    CARA derives duration from the covariance - the time the relative
    trajectory spends inside the combined uncertainty ellipsoid - and ORCAS
    has no covariance, so CARA's test has no input as written. Under the
    maximum-P_c convention the B-plane extent is not unknown: the maximising
    major axis is d/sqrt(2) regardless of aspect ratio, and a 3-sigma crossing
    of it at constant relative speed gives 2*3*(d/sqrt(2))/v_rel = 3*sqrt(2)*d/v_rel.

    This is ORCAS's definition standing in for CARA's, and it is labelled as
    ORCAS's wherever it appears (RA-12 section 6).
    """
    _require_positive(miss_distance_km=miss_distance_km)
    if relative_speed_km_s <= 0.0:
        raise ValueError("relative_speed_km_s must be positive")
    return 3.0 * math.sqrt(2.0) * miss_distance_km / relative_speed_km_s


def assess_2d_validity(miss_distance_km: float, relative_speed_km_s: float) -> TwoDValidity:
    """Whether a 2D P_c may be shown for this encounter at all.

    2D P_c assumes straight-line relative motion over a short encounter. Where
    that fails - slow GEO/HEO drift-bys, leader-follower pairs - it under-reports
    Alfano's Monte Carlo truth by up to 2.53x. When this gate fails the UI shows
    the miss distance and "outside the 2D model's validity", never a number.
    """
    duration = encounter_duration_s(miss_distance_km, relative_speed_km_s)

    if relative_speed_km_s < MIN_RELATIVE_SPEED_KM_S:
        reason = (
            f"relative speed {relative_speed_km_s * 1000:.1f} m/s is below the "
            f"{MIN_RELATIVE_SPEED_KM_S * 1000:.0f} m/s floor for the 2D model"
        )
        return TwoDValidity(False, relative_speed_km_s, duration, reason)

    if duration > MAX_ENCOUNTER_DURATION_S:
        reason = (
            f"encounter lasts {duration:.0f} s, beyond the "
            f"{MAX_ENCOUNTER_DURATION_S:.0f} s limit for the 2D model "
            f"(ORCAS's duration definition)"
        )
        return TwoDValidity(False, relative_speed_km_s, duration, reason)

    return TwoDValidity(True, relative_speed_km_s, duration)


def maximum_pc(
    miss_distance_km: float,
    hard_body_radius_km: float,
    aspect_ratio: float = SOCRATES_ASPECT_RATIO,
) -> MaximumPc:
    """P_max = AR * HBR^2 / (e * d^2) - the largest 2D P_c attainable by any
    uncertainty ellipse of this aspect ratio, maximised over both scale and
    orientation (the maximum sits with the major axis along the miss vector).

    Three regimes, per RA12.D12:
      * d >= 5*HBR - the closed form, accurate to 7e-5 relative or better.
      * HBR < d < 5*HBR - the closed form's HBR << sigma assumption is breaking
        down, so the maximum is found numerically against the exact integral.
      * d <= HBR - the hard bodies already intersect at TCA. That is a
        predicted contact, not a probability, and the caller must say so
        rather than print a number.
    """
    _require_positive(
        miss_distance_km=miss_distance_km,
        hard_body_radius_km=hard_body_radius_km,
        aspect_ratio=aspect_ratio,
    )

    sigma = dilution_sigma_km(miss_distance_km, aspect_ratio)
    source = UncertaintySource(
        kind="none",
        label=(
            f"upper bound over uncertainty ellipses of {aspect_ratio:g}:1 "
            f"aspect ratio (Alfano 2005) - public element sets carry no covariance"
        ),
        aspect_ratio=aspect_ratio,
        dilution_sigma_km=sigma,
        citation="Alfano (2005); CelesTrak SOCRATES",
    )

    def result(value: float, method: Literal["closed_form", "numerical", "contact"]) -> MaximumPc:
        return MaximumPc(
            value=value,
            aspect_ratio=aspect_ratio,
            hard_body_radius_km=hard_body_radius_km,
            miss_distance_km=miss_distance_km,
            dilution_sigma_km=sigma,
            method=method,
            source=source,
        )

    if miss_distance_km <= hard_body_radius_km:
        return result(1.0, "contact")

    closed_form = aspect_ratio * hard_body_radius_km**2 / (math.e * miss_distance_km**2)
    if miss_distance_km >= CLOSED_FORM_MIN_MISS_RATIO * hard_body_radius_km:
        return result(closed_form, "closed_form")

    return result(
        _maximise_numerically(miss_distance_km, hard_body_radius_km, aspect_ratio),
        "numerical",
    )


def _maximise_numerically(
    miss_distance_km: float, hard_body_radius_km: float, aspect_ratio: float
) -> float:
    """Maximise the exact 2D integral over the ellipse's scale, with the major
    axis along the miss vector (the maximising orientation) and the aspect
    ratio held fixed.
    """
    miss = np.array([miss_distance_km, 0.0])

    def negative_pc(log_sigma_major: float) -> float:
        sigma_major = math.exp(log_sigma_major)
        c_b = np.diag([sigma_major**2, (sigma_major / aspect_ratio) ** 2])
        return -probability_of_collision(miss, c_b, hard_body_radius_km)

    # The closed form's sigma* = d/sqrt(2) is the right neighbourhood even
    # where its value is off; search a wide bracket around it in log-space so
    # the optimiser cannot wander to a non-positive width.
    guess = math.log(miss_distance_km / math.sqrt(2.0))
    outcome = minimize_scalar(negative_pc, bounds=(guess - 3.0, guess + 3.0), method="bounded")
    return float(-outcome.fun)


def _require_positive(**values: float) -> None:
    for name, value in values.items():
        if value <= 0.0:
            raise ValueError(f"{name} must be positive, got {value}")
