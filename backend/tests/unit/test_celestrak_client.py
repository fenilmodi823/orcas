"""No real network calls — httpx.MockTransport stands in for CelesTrak."""

import httpx
import pytest

from app.infra.celestrak.client import CelesTrakFetchError, fetch_gp_omm


@pytest.mark.asyncio
async def test_fetch_gp_omm_returns_parsed_records(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["GROUP"] == "active"
        assert request.url.params["FORMAT"] == "json"
        assert "User-Agent" in request.headers
        return httpx.Response(200, json=[{"OBJECT_NAME": "TEST"}])

    _patch_client(monkeypatch, handler)

    records = await fetch_gp_omm()
    assert records == [{"OBJECT_NAME": "TEST"}]


@pytest.mark.asyncio
async def test_fetch_gp_omm_raises_on_http_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, text="service unavailable")

    _patch_client(monkeypatch, handler)

    with pytest.raises(CelesTrakFetchError):
        await fetch_gp_omm()


@pytest.mark.asyncio
async def test_fetch_gp_omm_raises_on_non_array_response(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"error": "No GP data found"})

    _patch_client(monkeypatch, handler)

    with pytest.raises(CelesTrakFetchError):
        await fetch_gp_omm()


def _patch_client(monkeypatch: pytest.MonkeyPatch, handler) -> None:  # type: ignore[no-untyped-def]
    real_client = httpx.AsyncClient

    def mock_client(*args: object, **kwargs: object) -> httpx.AsyncClient:
        kwargs["transport"] = httpx.MockTransport(handler)
        return real_client(*args, **kwargs)  # type: ignore[arg-type]

    monkeypatch.setattr("app.infra.celestrak.client.httpx.AsyncClient", mock_client)
