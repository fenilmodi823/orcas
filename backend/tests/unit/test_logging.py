import json
import logging

from app.infra.logging import JsonFormatter, request_id_var


def _make_record(**extra: object) -> logging.LogRecord:
    record = logging.LogRecord(
        name="orcas.test",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="something happened",
        args=(),
        exc_info=None,
    )
    for key, value in extra.items():
        setattr(record, key, value)
    return record


def test_formats_as_valid_json_with_core_fields() -> None:
    line = JsonFormatter().format(_make_record())
    payload = json.loads(line)
    assert payload["level"] == "INFO"
    assert payload["logger"] == "orcas.test"
    assert payload["message"] == "something happened"
    assert "request_id" not in payload


def test_includes_request_id_when_set() -> None:
    token = request_id_var.set("abc-123")
    try:
        payload = json.loads(JsonFormatter().format(_make_record()))
    finally:
        request_id_var.reset(token)
    assert payload["request_id"] == "abc-123"


def test_includes_extra_fields() -> None:
    payload = json.loads(JsonFormatter().format(_make_record(fetched=22, rejected=0)))
    assert payload["fetched"] == 22
    assert payload["rejected"] == 0


def test_reserved_attributes_are_not_leaked_as_extra_fields() -> None:
    payload = json.loads(JsonFormatter().format(_make_record()))
    assert "args" not in payload
    assert "pathname" not in payload
    assert "msg" not in payload
