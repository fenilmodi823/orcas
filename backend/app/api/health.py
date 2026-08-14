from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health/live")
async def live() -> dict[str, str]:
    """Process is up. No dependency checks."""
    return {"status": "live"}


@router.get("/health/ready")
async def ready() -> dict[str, str]:
    """Dependencies reachable. No DB/cache wired yet in this scaffold — always ready."""
    return {"status": "ready"}
