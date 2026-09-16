"""Validates raw CelesTrak SATCAT CSV rows into the canonical SatcatRecord
shape. Malformed rows are rejected here and never reach the database — same
boundary rule as celestrak/schema.py. OBJECT_TYPE/OPS_STATUS_CODE/
DATA_STATUS_CODE have no documented enum (RA-14 §3) — unseen values are
logged, never hardcoded as a closed set (RA14.D8).
"""

import logging

from pydantic import BaseModel, ValidationError, field_validator

from app.domain.types import SatcatRecord

logger = logging.getLogger(__name__)

_SEEN_OBJECT_TYPES: set[str] = set()
_SEEN_OPS_STATUS_CODES: set[str] = set()
_SEEN_DATA_STATUS_CODES: set[str] = set()


class SatcatValidationError(Exception):
    """A single SATCAT row didn't match the expected shape."""


def _log_if_unseen(seen: set[str], value: str | None, field_name: str) -> None:
    """Log the first sighting of a value this process hasn't seen for this
    field. No enum is hardcoded — CelesTrak documents field names but not
    valid values (RA-14 §3).
    """
    if value is None or value in seen:
        return
    seen.add(value)
    logger.warning("unseen SATCAT %s value: %r", field_name, value)


class _CelesTrakSatcatRow(BaseModel):
    """Field-for-field mirror of CelesTrak's SATCAT CSV row."""

    OBJECT_NAME: str
    OBJECT_ID: str
    NORAD_CAT_ID: int | str
    OBJECT_TYPE: str | None = None
    OPS_STATUS_CODE: str | None = None
    OWNER: str | None = None
    LAUNCH_DATE: str | None = None
    LAUNCH_SITE: str | None = None
    DECAY_DATE: str | None = None
    RCS: float | None = None
    DATA_STATUS_CODE: str | None = None

    @field_validator(
        "OBJECT_TYPE",
        "OPS_STATUS_CODE",
        "OWNER",
        "LAUNCH_DATE",
        "LAUNCH_SITE",
        "DECAY_DATE",
        "DATA_STATUS_CODE",
        "RCS",
        mode="before",
    )
    @classmethod
    def _empty_string_to_none(cls, value: object) -> object:
        """csv.DictReader yields '' for empty cells, never a bare None."""
        return None if value == "" else value

    def to_satcat_record(self) -> SatcatRecord:
        _log_if_unseen(_SEEN_OBJECT_TYPES, self.OBJECT_TYPE, "OBJECT_TYPE")
        _log_if_unseen(_SEEN_OPS_STATUS_CODES, self.OPS_STATUS_CODE, "OPS_STATUS_CODE")
        _log_if_unseen(_SEEN_DATA_STATUS_CODES, self.DATA_STATUS_CODE, "DATA_STATUS_CODE")
        return SatcatRecord(
            OBJECT_NAME=self.OBJECT_NAME,
            OBJECT_ID=self.OBJECT_ID,
            NORAD_CAT_ID=str(self.NORAD_CAT_ID),
            OBJECT_TYPE=self.OBJECT_TYPE,
            OPS_STATUS_CODE=self.OPS_STATUS_CODE,
            OWNER=self.OWNER,
            LAUNCH_DATE=self.LAUNCH_DATE,
            LAUNCH_SITE=self.LAUNCH_SITE,
            DECAY_DATE=self.DECAY_DATE,
            RCS=self.RCS,
            DATA_STATUS_CODE=self.DATA_STATUS_CODE,
        )


def validate_satcat_row(raw: dict[str, object]) -> SatcatRecord:
    """Validate one raw SATCAT CSV row (already dict-shaped by
    csv.DictReader). Raises SatcatValidationError — never returns a
    partially-valid record.
    """
    try:
        return _CelesTrakSatcatRow.model_validate(raw).to_satcat_record()
    except ValidationError as exc:
        norad_id = raw.get("NORAD_CAT_ID", "?")
        raise SatcatValidationError(
            f"SATCAT row NORAD_CAT_ID={norad_id} failed validation: {exc}"
        ) from exc
