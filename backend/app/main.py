from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.errors import register_error_handlers
from app.api.health import router as health_router
from app.api.middleware import request_id_middleware
from app.api.v1.router import router as v1_router
from app.infra.logging import configure_logging
from app.settings import settings


def create_app() -> FastAPI:
    configure_logging()
    app = FastAPI(title="ORCAS Backend", version="0.1.0")

    app.middleware("http")(request_id_middleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_error_handlers(app)
    app.include_router(health_router)
    app.include_router(v1_router)

    return app


app = create_app()
