from fastapi import APIRouter

from app.api.v1.catalog import router as catalog_router
from app.api.v1.objects import router as objects_router

router = APIRouter(prefix="/api/v1")
router.include_router(objects_router)
router.include_router(catalog_router)

# conjunctions router lands with the `conjunction` DB table — needs the
# screening worker (domain/screening.py), not yet started.
