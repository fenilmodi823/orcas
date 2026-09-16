"""No real network calls — httpx.MockTransport stands in for CelesTrak."""

import httpx
import pytest

from app.infra.celestrak.client import CelesTrakFetchError
from app.infra.celestrak.satcat import fetch_satcat_csv


@pytest.mark.asyncio
async def test_fetch_satcat_csv_returns_text(monkeypatch: pytest.MonkeyPatch) -> None:
    csv_body = "OBJECT_NAME,OBJECT_ID,NORAD_CAT_ID\nVANGUARD 1,1958-002B,5\n"

    def handler(request: httpx.Request) -> httpx.Response:
        assert "User-Agent" in request.headers
        return httpx.Response(200, text=csv_body)

    _patch_client(monkeypatch, handler)

    body = await fetch_satcat_csv()
    assert body == csv_body


@pytest.mark.asyncio
async def test_fetch_satcat_csv_raises_on_http_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, text="service unavailable")

    _patch_client(monkeypatch, handler)

    with pytest.raises(CelesTrakFetchError):
        await fetch_satcat_csv()


def _patch_client(monkeypatch: pytest.MonkeyPatch, handler) -> None:  # type: ignore[no-untyped-def]
    real_client = httpx.AsyncClient

    def mock_client(*args: object, **kwargs: object) -> httpx.AsyncClient:
        kwargs["transport"] = httpx.MockTransport(handler)
        return real_client(*args, **kwargs)  # type: ignore[arg-type]

    monkeypatch.setattr("app.infra.celestrak.satcat.httpx.AsyncClient", mock_client)
