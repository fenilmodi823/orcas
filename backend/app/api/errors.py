import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger("orcas.api")


class OrcasError(Exception):
    """Base for typed application errors. Never leak a stack trace to a client."""

    status_code = 500
    detail = "Internal error"


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(OrcasError)
    async def handle_orcas_error(_: Request, exc: OrcasError) -> JSONResponse:
        logger.warning("orcas_error", extra={"detail": exc.detail})
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    @app.exception_handler(Exception)
    async def handle_unexpected(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled_error", exc_info=exc)
        return JSONResponse(status_code=500, content={"detail": "Internal error"})
