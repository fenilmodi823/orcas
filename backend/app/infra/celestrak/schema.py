"""Validates raw CelesTrak GP JSON into the canonical OmmRecord shape.
Malformed upstream records are rejected here and never reach the database —
see Rules.md "Malformed upstream data" and Data-Strategy.md §6 "reject
malformed records at this boundary."
"""

from pydantic import BaseModel, ValidationError

from app.domain.types import OmmRecord


class OmmValidationError(Exception):
    """A single upstream record didn't match the expected OMM shape."""


class _CelesTrakOmmJson(BaseModel):
    """Field-for-field mirror of CelesTrak's GP JSON. NORAD_CAT_ID accepts
    int or str because CelesTrak sends it as a JSON number — this project
    stores it as VARCHAR (Rules.md: 6-digit and Alpha-5 catalog numbers
    already exist), so the str conversion happens once, here, at the
    boundary — never left for a downstream consumer to guess at.
    """

    OBJECT_NAME: str
    OBJECT_ID: str
    EPOCH: str
    MEAN_MOTION: float
    ECCENTRICITY: float
    INCLINATION: float
    RA_OF_ASC_NODE: float
    ARG_OF_PERICENTER: float
    MEAN_ANOMALY: float
    EPHEMERIS_TYPE: int
    CLASSIFICATION_TYPE: str
    NORAD_CAT_ID: int | str
    ELEMENT_SET_NO: int
    REV_AT_EPOCH: int
    BSTAR: float
    MEAN_MOTION_DOT: float
    MEAN_MOTION_DDOT: float

    def to_omm_record(self) -> OmmRecord:
        return OmmRecord(
            OBJECT_NAME=self.OBJECT_NAME,
            OBJECT_ID=self.OBJECT_ID,
            EPOCH=self.EPOCH,
            MEAN_MOTION=self.MEAN_MOTION,
            ECCENTRICITY=self.ECCENTRICITY,
            INCLINATION=self.INCLINATION,
            RA_OF_ASC_NODE=self.RA_OF_ASC_NODE,
            ARG_OF_PERICENTER=self.ARG_OF_PERICENTER,
            MEAN_ANOMALY=self.MEAN_ANOMALY,
            EPHEMERIS_TYPE=self.EPHEMERIS_TYPE,
            CLASSIFICATION_TYPE=self.CLASSIFICATION_TYPE,
            NORAD_CAT_ID=str(self.NORAD_CAT_ID),
            ELEMENT_SET_NO=self.ELEMENT_SET_NO,
            REV_AT_EPOCH=self.REV_AT_EPOCH,
            BSTAR=self.BSTAR,
            MEAN_MOTION_DOT=self.MEAN_MOTION_DOT,
            MEAN_MOTION_DDOT=self.MEAN_MOTION_DDOT,
        )


def validate_omm_record(raw: dict[str, object]) -> OmmRecord:
    """Validate one raw GP JSON object. Raises OmmValidationError — never
    returns a partially-valid record.
    """
    try:
        return _CelesTrakOmmJson.model_validate(raw).to_omm_record()
    except ValidationError as exc:
        object_id = raw.get("OBJECT_ID", "?")
        norad_id = raw.get("NORAD_CAT_ID", "?")
        raise OmmValidationError(
            f"record NORAD_CAT_ID={norad_id} OBJECT_ID={object_id} failed validation: {exc}"
        ) from exc
