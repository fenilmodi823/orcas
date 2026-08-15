"""Structured JSON logging, shared by the API process and the worker CLI.
No new dependency — stdlib logging + contextvars are enough for one JSON
object per log line plus a per-request ID threaded through it.
"""

import json
import logging
from contextvars import ContextVar
from typing import Any

request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)

# Attributes every LogRecord carries by default — anything else on a record
# came from a caller's `logger.warning(..., extra={...})` and belongs in the
# JSON payload as a real structured field, not silently dropped.
_RESERVED_ATTRS = set(logging.makeLogRecord({}).__dict__.keys())


class JsonFormatter(logging.Formatter):
    """request_id is included whenever a request is in flight (set by
    app.api.middleware.request_id_middleware), omitted otherwise — worker
    and startup logs have no request to attach one to.
    """

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for key, value in record.__dict__.items():
            if key not in _RESERVED_ATTRS:
                payload[key] = value
        request_id = request_id_var.get()
        if request_id is not None:
            payload["request_id"] = request_id
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def configure_logging(level: int = logging.INFO) -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)
