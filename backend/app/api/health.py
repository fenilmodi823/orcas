from fastapi import APIRouter, Response

from app.infra.db.base import ping

router = APIRouter(tags=["health"])


@router.get("/health/live")
async def live() -> dict[str, str]:
    """Process is up. No dependency checks."""
    return {"status": "live"}


@router.get("/health/ready")
async def ready(response: Response) -> dict[str, str]:
    """Database reachable. Never 500s — an unreachable DB is a 200 with
    status "not_ready" plus a non-2xx status code, per Rules.md error
    handling ("Database unreachable -> /health/ready fails; no 500s").
    """
    if await ping():
        return {"status": "ready"}
    response.status_code = 503
    return {"status": "not_ready"}
