"""Validates raw CelesTrak SATCAT CSV rows into the canonical SatcatRecord
shape. Malformed rows are rejected here and never reach the database — same
boundary rule as celestrak/schema.py. OBJECT_TYPE/OPS_STATUS_CODE/
DATA_STATUS_CODE have no documented enum (RA-14 §3) — unseen values are
logged, never hardcoded as a closed set (RA14.D8).
"""

import logging
from collections.abc import Mapping
from datetime import date

from pydantic import BaseModel, Field, ValidationError, field_validator

from app.domain.types import SatcatRecord

logger = logging.getLogger(__name__)

_SEEN_OBJECT_TYPES: set[str] = set()
_SEEN_OPS_STATUS_CODES: set[str] = set()
_SEEN_DATA_STATUS_CODES: set[str] = set()

_OBJECT_TYPE_NORMALIZE = {
    "PAY": "PAYLOAD",
    "R/B": "ROCKET BODY",
    "DEB": "DEBRIS",
}


def _normalize_object_type(value: str | None) -> str | None:
    """Map SATCAT's short OBJECT_TYPE codes onto the long-form vocabulary
    the rest of the system (frontend catalog-validate.ts's OBJECT_TYPE_MAP)
    already expects. Anything not in this map (e.g. UNK, TBA) passes
    through unchanged — never invent a mapping for an undocumented code
    (RA14.D8): the frontend already treats an unrecognized value as Unknown,
    which is the honest outcome for a genuinely unknown type.
    """
    if value is None:
        return value
    return _OBJECT_TYPE_NORMALIZE.get(value, value)


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
    OBJECT_TYPE: str | None = Field(default=None, max_length=32)
    OPS_STATUS_CODE: str | None = Field(default=None, max_length=4)
    OWNER: str | None = Field(default=None, max_length=8)
    LAUNCH_DATE: str | None = None
    LAUNCH_SITE: str | None = Field(default=None, max_length=16)
    DECAY_DATE: str | None = None
    RCS: float | None = None
    DATA_STATUS_CODE: str | None = Field(default=None, max_length=4)

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

    @field_validator("LAUNCH_DATE", "DECAY_DATE")
    @classmethod
    def _validate_iso_date(cls, value: str | None) -> str | None:
        """SATCAT dates are bare ISO dates ('1958-03-17') — reject anything
        else here, at the validation boundary, rather than letting a bad
        row reach datetime.fromisoformat() deep inside the DB write loop
        and roll back the whole batch.
        """
        if value is not None:
            date.fromisoformat(value)
        return value

    def to_satcat_record(self) -> SatcatRecord:
        _log_if_unseen(_SEEN_OBJECT_TYPES, self.OBJECT_TYPE, "OBJECT_TYPE")
        _log_if_unseen(_SEEN_OPS_STATUS_CODES, self.OPS_STATUS_CODE, "OPS_STATUS_CODE")
        _log_if_unseen(_SEEN_DATA_STATUS_CODES, self.DATA_STATUS_CODE, "DATA_STATUS_CODE")
        return SatcatRecord(
            OBJECT_NAME=self.OBJECT_NAME,
            OBJECT_ID=self.OBJECT_ID,
            NORAD_CAT_ID=str(self.NORAD_CAT_ID),
            OBJECT_TYPE=_normalize_object_type(self.OBJECT_TYPE),
            OPS_STATUS_CODE=self.OPS_STATUS_CODE,
            OWNER=self.OWNER,
            LAUNCH_DATE=self.LAUNCH_DATE,
            LAUNCH_SITE=self.LAUNCH_SITE,
            DECAY_DATE=self.DECAY_DATE,
            RCS=self.RCS,
            DATA_STATUS_CODE=self.DATA_STATUS_CODE,
        )


def validate_satcat_row(raw: Mapping[str, object]) -> SatcatRecord:
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
