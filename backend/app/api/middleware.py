"""Per-request ID: read from an inbound X-Request-ID header if the caller
supplied one, otherwise generate one. Set on infra.logging's contextvar for
the duration of the request so every log line in that request carries it,
and echoed back on the response so a client can correlate its own logs.
"""

import uuid
from collections.abc import Awaitable, Callable

from fastapi import Request, Response

from app.infra.logging import request_id_var

REQUEST_ID_HEADER = "X-Request-ID"


async def request_id_middleware(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    request_id = request.headers.get(REQUEST_ID_HEADER) or str(uuid.uuid4())
    token = request_id_var.set(request_id)
    try:
        response = await call_next(request)
    finally:
        request_id_var.reset(token)
    response.headers[REQUEST_ID_HEADER] = request_id
    return response
