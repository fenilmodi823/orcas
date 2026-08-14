import pytest

from app.infra.celestrak.schema import OmmValidationError, validate_omm_record

VALID_RAW = {
    "OBJECT_NAME": "ISS (ZARYA)",
    "OBJECT_ID": "1998-067A",
    "EPOCH": "2026-08-13T12:00:00.000000",
    "MEAN_MOTION": 15.5,
    "ECCENTRICITY": 0.001,
    "INCLINATION": 51.6,
    "RA_OF_ASC_NODE": 120.0,
    "ARG_OF_PERICENTER": 45.0,
    "MEAN_ANOMALY": 200.0,
    "EPHEMERIS_TYPE": 0,
    "CLASSIFICATION_TYPE": "U",
    "NORAD_CAT_ID": 25544,  # CelesTrak sends this as a JSON number
    "ELEMENT_SET_NO": 999,
    "REV_AT_EPOCH": 12345,
    "BSTAR": 0.0001,
    "MEAN_MOTION_DOT": 0.00001,
    "MEAN_MOTION_DDOT": 0.0,
}


def test_valid_record_round_trips_and_coerces_norad_id_to_str() -> None:
    record = validate_omm_record(VALID_RAW)
    assert record["NORAD_CAT_ID"] == "25544"
    assert isinstance(record["NORAD_CAT_ID"], str)
    assert record["OBJECT_NAME"] == "ISS (ZARYA)"
    assert record["MEAN_MOTION"] == 15.5


def test_missing_field_is_rejected() -> None:
    bad = dict(VALID_RAW)
    del bad["MEAN_MOTION"]
    with pytest.raises(OmmValidationError):
        validate_omm_record(bad)


def test_wrong_type_is_rejected() -> None:
    bad = dict(VALID_RAW)
    bad["ECCENTRICITY"] = "not-a-number"
    with pytest.raises(OmmValidationError):
        validate_omm_record(bad)


def test_alpha5_style_string_norad_id_is_accepted() -> None:
    # 6-digit+ catalog numbers arrive as plain numeric strings too (CLAUDE.md
    # fact #5) — the schema must not assume int is the only wire shape.
    record = validate_omm_record({**VALID_RAW, "NORAD_CAT_ID": "100147"})
    assert record["NORAD_CAT_ID"] == "100147"
