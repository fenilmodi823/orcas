"""Pydantic response models for /api/v1/conjunctions. HTTP-facing shapes only.

Every item carries what RA-12 section 7 requires beside a probability: the
quantity (a maximum), the aspect ratio it is maximised over, the hard-body
radius, the dilution sigma, both element-set epochs, the 2D-validity verdict
and the one-line method statement. There is no bare P_c field.
"""

from datetime import datetime

from pydantic import BaseModel

from app.infra.db.models import Conjunction, ScreeningRun


class ConjunctionParty(BaseModel):
    norad_id: str
    name: str
    object_type: str | None
    element_set_epoch: datetime


class ConjunctionItem(BaseModel):
    tca: datetime
    miss_distance_km: float
    relative_speed_km_s: float
    #: Upper bound over ellipses of `aspect_ratio`; None when the 2D model does not apply.
    maximum_pc: float | None
    pc_method: str | None
    aspect_ratio: float
    hard_body_radius_km: float
    dilution_sigma_km: float
    valid_2d: bool
    validity_reason: str | None
    encounter_duration_s: float
    method: str
    primary: ConjunctionParty
    secondary: ConjunctionParty


class ScreeningRunInfo(BaseModel):
    completed_at: datetime
    window_start: datetime
    window_end: datetime
    step_s: float
    reporting_distance_km: float
    hard_body_radius_km: float
    aspect_ratio: float
    objects_screened: int
    objects_skipped: int
    colocated_excluded: int
    encounters: int


class ConjunctionListResponse(BaseModel):
    #: None until a screening run has completed - "not screened", not "clear".
    run: ScreeningRunInfo | None
    items: list[ConjunctionItem]


def _method(aspect_ratio: float) -> str:
    return (
        f"Upper bound over uncertainty ellipses of {aspect_ratio:g}:1 aspect ratio "
        "(Alfano 2005) - public element sets carry no covariance."
    )


def conjunction_item(c: Conjunction, run: ScreeningRun) -> ConjunctionItem:
    """One stored conjunction in the API's item shape. Shared by the endpoint
    and the static-site bake, so the two can never drift apart."""
    return ConjunctionItem(
        tca=c.tca,
        miss_distance_km=c.miss_distance_km,
        relative_speed_km_s=c.relative_speed_km_s,
        maximum_pc=c.maximum_pc,
        pc_method=c.pc_method,
        aspect_ratio=run.aspect_ratio,
        hard_body_radius_km=run.hard_body_radius_km,
        dilution_sigma_km=c.dilution_sigma_km,
        valid_2d=c.valid_2d,
        validity_reason=c.validity_reason,
        encounter_duration_s=c.encounter_duration_s,
        method=_method(run.aspect_ratio),
        primary=ConjunctionParty(
            norad_id=c.primary.norad_id,
            name=c.primary.name,
            object_type=c.primary.object_type,
            element_set_epoch=c.primary_epoch,
        ),
        secondary=ConjunctionParty(
            norad_id=c.secondary.norad_id,
            name=c.secondary.name,
            object_type=c.secondary.object_type,
            element_set_epoch=c.secondary_epoch,
        ),
    )
