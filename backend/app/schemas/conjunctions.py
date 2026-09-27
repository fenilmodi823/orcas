"""Pydantic response models for /api/v1/conjunctions. HTTP-facing shapes only.

Every item carries what RA-12 section 7 requires beside a probability: the
quantity (a maximum), the aspect ratio it is maximised over, the hard-body
radius, the dilution sigma, both element-set epochs, the 2D-validity verdict
and the one-line method statement. There is no bare P_c field.
"""

from datetime import datetime

from pydantic import BaseModel


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
