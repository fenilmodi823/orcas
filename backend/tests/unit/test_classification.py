"""app.domain.classification is pure OMM -> feature-vector mapping — no
model, no I/O. Field order is asserted against the actual .joblib bundle's
stored feature list in tests/unit/test_classifier.py, not duplicated here."""

from app.domain.classification import CLASSIFIER_FEATURE_ORDER, features_from_omm
from app.domain.types import OmmRecord

RECORD: OmmRecord = {
    "OBJECT_NAME": "ORCAS-TEST-SAT",
    "OBJECT_ID": "1998-999Z",
    "EPOCH": "2026-01-01T00:00:00.000000",
    "MEAN_MOTION": 14.5,
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
    "BSTAR": 0.0002,
    "MEAN_MOTION_DOT": 0,
    "MEAN_MOTION_DDOT": 0,
}


def test_features_from_omm_maps_the_right_fields() -> None:
    features = features_from_omm(RECORD)
    assert features.inc_deg == 86.4
    assert features.ecc == 0.0011
    assert features.mm_rev_day == 14.5
    assert features.bstar == 0.0002


def test_as_vector_matches_classifier_feature_order() -> None:
    features = features_from_omm(RECORD)
    assert CLASSIFIER_FEATURE_ORDER == ("inc_deg", "ecc", "mm_rev_day", "bstar")
    assert features.as_vector() == [86.4, 0.0011, 14.5, 0.0002]
