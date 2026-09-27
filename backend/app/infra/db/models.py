"""ORM models — see Architecture.md §4 "Data model". `norad_id` is VARCHAR,
never INTEGER: 6-digit and Alpha-5 catalog numbers already exist (Rules.md).

space_object and element_set feed everything; screening_run and conjunction
are written by the screening worker (services/screening_service.py). asset
lands with the P2 asset pipeline.
"""

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infra.db.base import Base


class SpaceObject(Base):
    """Identity, slow-changing. Populated from the CelesTrak GP feed on
    first sighting; object_type/operator/country/launch_date/rcs_size/rcs/
    decay_date/ops_status_code/data_status_code/launch_site are SATCAT
    fields, not in GP OMM — nullable here, filled by the SATCAT ingestion
    pass (app/services/satcat_service.py), not this worker.
    """

    __tablename__ = "space_object"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    norad_id: Mapped[str] = mapped_column(String(16), unique=True, index=True, nullable=False)
    intl_designator: Mapped[str] = mapped_column(String(16), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    object_type: Mapped[str | None] = mapped_column(String(32))
    operator: Mapped[str | None] = mapped_column(String(128))
    country: Mapped[str | None] = mapped_column(String(8))
    launch_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rcs_size: Mapped[str | None] = mapped_column(String(16))
    rcs: Mapped[float | None] = mapped_column(Float)  # m^2, raw radar cross-section (SATCAT RCS)
    decay_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ops_status_code: Mapped[str | None] = mapped_column(String(4))
    data_status_code: Mapped[str | None] = mapped_column(String(4))
    launch_site: Mapped[str | None] = mapped_column(String(16))
    analyst: Mapped[bool] = mapped_column(default=False)
    # SATCAT-specific provenance — distinct from element_set.source/ingested_at,
    # since SATCAT updates on its own cadence (RA14.D6: snapshot age and
    # element-set epoch are two separate facts, never merged into one).
    satcat_source: Mapped[str | None] = mapped_column(String(32))
    satcat_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(default=True)

    element_sets: Mapped[list["ElementSet"]] = relationship(back_populates="space_object")


class ElementSet(Base):
    """Orbital elements, time-series, append-only — never update a row,
    insert a new one (Architecture.md: preserves provenance, enables
    historical replay). Units follow the CCSDS OMM spec exactly, matching
    domain.types.OmmRecord field-for-field so a row round-trips straight
    into satrec_from_omm() with no unit conversion at this boundary.
    """

    __tablename__ = "element_set"
    __table_args__ = (
        Index("ix_element_set_object_epoch", "object_id", "epoch"),
        # One stored row per (object, epoch, source); ingest skips repeats and this enforces it.
        Index("uq_element_set_object_epoch_source", "object_id", "epoch", "source", unique=True),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    object_id: Mapped[int] = mapped_column(ForeignKey("space_object.id"), nullable=False)
    epoch: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    mean_motion: Mapped[float] = mapped_column(Float, nullable=False)  # rev/day
    eccentricity: Mapped[float] = mapped_column(Float, nullable=False)  # dimensionless
    inclination: Mapped[float] = mapped_column(Float, nullable=False)  # deg
    ra_of_asc_node: Mapped[float] = mapped_column(Float, nullable=False)  # deg
    arg_of_pericenter: Mapped[float] = mapped_column(Float, nullable=False)  # deg
    mean_anomaly: Mapped[float] = mapped_column(Float, nullable=False)  # deg
    bstar: Mapped[float] = mapped_column(Float, nullable=False)  # 1/earth-radii
    mean_motion_dot: Mapped[float] = mapped_column(Float, nullable=False)  # rev/day^2
    mean_motion_ddot: Mapped[float] = mapped_column(Float, nullable=False)  # rev/day^3
    ephemeris_type: Mapped[int] = mapped_column(Integer, nullable=False)
    classification_type: Mapped[str] = mapped_column(String(1), nullable=False)
    element_set_no: Mapped[int] = mapped_column(Integer, nullable=False)
    rev_at_epoch: Mapped[int] = mapped_column(Integer, nullable=False)

    source: Mapped[str] = mapped_column(String(32), nullable=False)  # e.g. "celestrak"
    source_format: Mapped[str] = mapped_column(String(16), nullable=False)  # omm_json | tle_legacy
    source_type: Mapped[str] = mapped_column(String(16), nullable=False)  # "real" | "simulation"
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    space_object: Mapped[SpaceObject] = relationship(back_populates="element_sets")


class ScreeningRun(Base):
    """One catalogue screening pass and the settings it ran with, so every
    conjunction can say how it was found. Only the latest completed run is
    kept; its conjunctions replace the previous run's.
    """

    __tablename__ = "screening_run"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    window_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    step_s: Mapped[float] = mapped_column(Float, nullable=False)
    reporting_distance_km: Mapped[float] = mapped_column(Float, nullable=False)
    hard_body_radius_km: Mapped[float] = mapped_column(Float, nullable=False)  # combined
    aspect_ratio: Mapped[float] = mapped_column(Float, nullable=False)
    objects_screened: Mapped[int] = mapped_column(Integer, nullable=False)
    objects_skipped: Mapped[int] = mapped_column(Integer, nullable=False)  # no usable Satrec
    colocated_excluded: Mapped[int] = mapped_column(Integer, nullable=False)  # docked/formation
    encounters: Mapped[int] = mapped_column(Integer, nullable=False)

    conjunctions: Mapped[list["Conjunction"]] = relationship(
        back_populates="run", cascade="all, delete-orphan", passive_deletes=True
    )


class Conjunction(Base):
    """One close approach from a screening run, with everything RA-12 section 7
    requires to show it honestly. There is no bare P_c column: public element
    sets carry no covariance, so the only probability stored is the MAXIMUM
    over ellipses of `aspect_ratio`, and it is NULL when the 2D model is not
    valid for the encounter (RA12.D6) — the UI then shows the miss distance
    and the reason, never a number.
    """

    __tablename__ = "conjunction"
    __table_args__ = (
        Index("ix_conjunction_primary_tca", "primary_object_id", "tca"),
        Index("ix_conjunction_secondary_tca", "secondary_object_id", "tca"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[int] = mapped_column(
        ForeignKey("screening_run.id", ondelete="CASCADE"), nullable=False, index=True
    )
    primary_object_id: Mapped[int] = mapped_column(ForeignKey("space_object.id"), nullable=False)
    secondary_object_id: Mapped[int] = mapped_column(ForeignKey("space_object.id"), nullable=False)
    tca: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    miss_distance_km: Mapped[float] = mapped_column(Float, nullable=False)
    relative_speed_km_s: Mapped[float] = mapped_column(Float, nullable=False)
    maximum_pc: Mapped[float | None] = mapped_column(Float)  # NULL outside 2D validity
    pc_method: Mapped[str | None] = mapped_column(String(16))  # closed_form | numerical | contact
    dilution_sigma_km: Mapped[float] = mapped_column(Float, nullable=False)
    valid_2d: Mapped[bool] = mapped_column(nullable=False)
    validity_reason: Mapped[str | None] = mapped_column(Text)
    encounter_duration_s: Mapped[float] = mapped_column(Float, nullable=False)  # ORCAS's definition
    primary_epoch: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    secondary_epoch: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    run: Mapped[ScreeningRun] = relationship(back_populates="conjunctions")
    primary: Mapped[SpaceObject] = relationship(foreign_keys=[primary_object_id])
    secondary: Mapped[SpaceObject] = relationship(foreign_keys=[secondary_object_id])
