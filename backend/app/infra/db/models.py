"""ORM models — see Architecture.md §4 "Data model". `norad_id` is VARCHAR,
never INTEGER: 6-digit and Alpha-5 catalog numbers already exist (Rules.md).

Only space_object and element_set exist here — the tables step 4's OMM
ingestion worker needs. conjunction and asset land with the services that
populate them (screening in a later Phase 1 step, the asset pipeline in P2).
"""

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infra.db.base import Base


class SpaceObject(Base):
    """Identity, slow-changing. Populated from the CelesTrak GP feed on
    first sighting; object_type/operator/country/launch_date/rcs_size are
    SATCAT fields, not in GP OMM — nullable here, filled by a later SATCAT
    ingestion pass, not this worker.
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
    __table_args__ = (Index("ix_element_set_object_epoch", "object_id", "epoch"),)

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
