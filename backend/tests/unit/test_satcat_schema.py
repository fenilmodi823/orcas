import logging

import pytest

from app.infra.celestrak.satcat_schema import (
    SatcatValidationError,
    _log_if_unseen,
    validate_satcat_row,
)

VALID_RAW = {
    "OBJECT_NAME": "VANGUARD 1",
    "OBJECT_ID": "1958-002B",
    "NORAD_CAT_ID": "5",
    "OBJECT_TYPE": "PAY",
    "OPS_STATUS_CODE": "",
    "OWNER": "US",
    "LAUNCH_DATE": "1958-03-17",
    "LAUNCH_SITE": "AFETR",
    "DECAY_DATE": "",
    "RCS": "0.1220",
    "DATA_STATUS_CODE": "",
}


def test_valid_row_round_trips_and_empty_strings_become_none() -> None:
    record = validate_satcat_row(VALID_RAW)
    assert record["NORAD_CAT_ID"] == "5"
    assert record["OBJECT_TYPE"] == "PAY"
    assert record["OPS_STATUS_CODE"] is None
    assert record["DECAY_DATE"] is None
    assert record["RCS"] == 0.1220


def test_norad_cat_id_as_json_int_is_coerced_to_str() -> None:
    record = validate_satcat_row({**VALID_RAW, "NORAD_CAT_ID": 5})
    assert record["NORAD_CAT_ID"] == "5"
    assert isinstance(record["NORAD_CAT_ID"], str)


def test_missing_required_field_is_rejected() -> None:
    bad = dict(VALID_RAW)
    del bad["NORAD_CAT_ID"]
    with pytest.raises(SatcatValidationError):
        validate_satcat_row(bad)


def test_non_numeric_rcs_is_rejected() -> None:
    bad = {**VALID_RAW, "RCS": "not-a-number"}
    with pytest.raises(SatcatValidationError):
        validate_satcat_row(bad)


def test_unseen_enum_value_is_logged_once(caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.WARNING)
    seen: set[str] = set()

    _log_if_unseen(seen, "NEW_TYPE", "OBJECT_TYPE")
    _log_if_unseen(seen, "NEW_TYPE", "OBJECT_TYPE")

    warnings = [r for r in caplog.records if "unseen SATCAT" in r.message]
    assert len(warnings) == 1


def test_log_if_unseen_ignores_none() -> None:
    seen: set[str] = set()
    _log_if_unseen(seen, None, "OBJECT_TYPE")
    assert seen == set()
