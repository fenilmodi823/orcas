import pytest
from httpx import ASGITransport, AsyncClient

import app.api.health as health
from app.main import app


@pytest.mark.asyncio
async def test_health_live() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "live"}


@pytest.mark.asyncio
async def test_health_ready_when_db_reachable(monkeypatch: pytest.MonkeyPatch) -> None:
    # No real Postgres in this test environment — exercise the endpoint's
    # own logic, not infra.db.base.ping()'s network behaviour (that's what
    # test_ingestion_service.py's DB-touching tests are for).
    monkeypatch.setattr(health, "ping", _fake_ping(True))
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


@pytest.mark.asyncio
async def test_health_ready_when_db_unreachable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(health, "ping", _fake_ping(False))
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health/ready")
    assert response.status_code == 503
    assert response.json() == {"status": "not_ready"}


def _fake_ping(result: bool) -> object:
    async def fake() -> bool:
        return result

    return fake
