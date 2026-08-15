"""Pydantic response models for /api/v1/objects. HTTP-facing shapes only —
no physics, no SQL. See Rules.md "api/ contains no physics and no SQL."
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SpaceObjectSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    norad_id: str
    intl_designator: str
    name: str
    object_type: str | None
    is_active: bool


class LatestElementSet(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    epoch: datetime
    mean_motion: float
    eccentricity: float
    inclination: float
    ra_of_asc_node: float
    arg_of_pericenter: float
    mean_anomaly: float
    bstar: float
    source: str
    source_type: str


class SpaceObjectDetail(SpaceObjectSummary):
    latest_element_set: LatestElementSet | None  # None if never ingested


class ObjectListResponse(BaseModel):
    items: list[SpaceObjectSummary]
    total: int
    limit: int
    offset: int


class EphemerisPoint(BaseModel):
    at: datetime
    latitude_deg: float
    longitude_deg: float
    altitude_km: float


class EphemerisResponse(BaseModel):
    norad_id: str
    element_set_epoch: datetime  # which element set this was propagated from
    points: list[EphemerisPoint]
