from fastapi import APIRouter

from app.api.v1.catalog import router as catalog_router
from app.api.v1.conjunctions import router as conjunctions_router
from app.api.v1.objects import router as objects_router

router = APIRouter(prefix="/api/v1")
router.include_router(objects_router)
router.include_router(catalog_router)
router.include_router(conjunctions_router)
