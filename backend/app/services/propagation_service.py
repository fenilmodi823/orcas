"""Orchestrates ephemeris generation: latest element_set (infra) -> Satrec
(domain) -> propagated positions over a time window (domain). One DB
lookup, then pure propagation — see Rules.md layering.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.coordinates import eci_to_geodetic_deg
from app.domain.propagation import propagate, satrec_from_omm
from app.domain.types import GeodeticPosition, OmmRecord
from app.infra.db.models import ElementSet
from app.services.catalog_service import get_latest_element_set


class NoElementSetError(Exception):
    """The object exists but has never been ingested — nothing to propagate from."""


@dataclass(frozen=True)
class EphemerisPoint:
    at: datetime
    position: GeodeticPosition


@dataclass(frozen=True)
class PropagatedEphemeris:
    element_set_epoch: datetime
    points: list[EphemerisPoint]


def _omm_record_from_element_set(
    element_set: ElementSet, object_name: str, norad_id: str, intl_designator: str
) -> OmmRecord:
    """Reverses ingestion_service's write-side mapping — one row back into
    the shape satrec_from_omm() expects. Field-for-field with
    domain.types.OmmRecord, same as the write side.
    """
    return OmmRecord(
        OBJECT_NAME=object_name,
        OBJECT_ID=intl_designator,
        EPOCH=element_set.epoch.strftime("%Y-%m-%dT%H:%M:%S.%f"),
        MEAN_MOTION=element_set.mean_motion,
        ECCENTRICITY=element_set.eccentricity,
        INCLINATION=element_set.inclination,
        RA_OF_ASC_NODE=element_set.ra_of_asc_node,
        ARG_OF_PERICENTER=element_set.arg_of_pericenter,
        MEAN_ANOMALY=element_set.mean_anomaly,
        EPHEMERIS_TYPE=element_set.ephemeris_type,
        CLASSIFICATION_TYPE=element_set.classification_type,
        NORAD_CAT_ID=norad_id,
        ELEMENT_SET_NO=element_set.element_set_no,
        REV_AT_EPOCH=element_set.rev_at_epoch,
        BSTAR=element_set.bstar,
        MEAN_MOTION_DOT=element_set.mean_motion_dot,
        MEAN_MOTION_DDOT=element_set.mean_motion_ddot,
    )


async def propagate_ephemeris(
    session: AsyncSession,
    norad_id: str,
    object_id: int,
    object_name: str,
    intl_designator: str,
    start: datetime,
    end: datetime,
    step_seconds: float,
) -> PropagatedEphemeris:
    if step_seconds <= 0:
        raise ValueError("step_seconds must be positive")
    if end < start:
        raise ValueError("end must not be before start")

    element_set = await get_latest_element_set(session, object_id)
    if element_set is None:
        raise NoElementSetError(f"no element set ingested for {norad_id}")

    satrec = satrec_from_omm(
        _omm_record_from_element_set(element_set, object_name, norad_id, intl_designator)
    )

    points: list[EphemerisPoint] = []
    at = start
    while at <= end:
        state = propagate(satrec, at, norad_id)
        geodetic = eci_to_geodetic_deg(state.position_km_eci, at)
        points.append(EphemerisPoint(at=at, position=geodetic))
        at += timedelta(seconds=step_seconds)

    return PropagatedEphemeris(element_set_epoch=element_set.epoch, points=points)
