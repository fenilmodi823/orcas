from app.domain.types import OmmRecord
from app.services.classification_service import classify_object

RECORD: OmmRecord = {
    "OBJECT_NAME": "ORCAS-TEST-SAT",
    "OBJECT_ID": "1998-999Z",
    "EPOCH": "2026-01-01T00:00:00.000000",
    "MEAN_MOTION": 14.34,
    "ECCENTRICITY": 0.0011,
    "INCLINATION": 86.4,
    "RA_OF_ASC_NODE": 0,
    "ARG_OF_PERICENTER": 0,
    "MEAN_ANOMALY": 0,
    "EPHEMERIS_TYPE": 0,
    "CLASSIFICATION_TYPE": "U",
    "NORAD_CAT_ID": "90001",
    "ELEMENT_SET_NO": 999,
    "REV_AT_EPOCH": 1,
    "BSTAR": 0.0001,
    "MEAN_MOTION_DOT": 0,
    "MEAN_MOTION_DDOT": 0,
}


def test_classify_object_end_to_end() -> None:
    result = classify_object(RECORD)
    assert result.predicted_class in {"Debris", "Payload", "Rocket Body"}
    assert len(result.class_probabilities) == 3
