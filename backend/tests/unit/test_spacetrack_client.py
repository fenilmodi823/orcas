"""No real network calls — httpx.MockTransport stands in for Space-Track."""

import httpx
import pytest

from app.infra.spacetrack.client import SpaceTrackFetchError, fetch_spacetrack_gp


@pytest.mark.asyncio
async def test_fetch_spacetrack_gp_logs_in_then_fetches(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        if request.url.path == "/ajaxauth/login":
            assert request.method == "POST"
            return httpx.Response(
                200, text="", headers={"set-cookie": "chocolatechip=abc123; Path=/"}
            )
        assert "/basicspacedata/query/class/gp/" in str(request.url)
        return httpx.Response(200, json=[{"OBJECT_NAME": "TEST"}])

    _patch_client(monkeypatch, handler)

    records = await fetch_spacetrack_gp()
    assert records == [{"OBJECT_NAME": "TEST"}]
    assert len(calls) == 2
    assert calls[0].url.path == "/ajaxauth/login"
    assert "chocolatechip=abc123" in calls[1].headers.get("cookie", "")


@pytest.mark.asyncio
async def test_fetch_spacetrack_gp_raises_on_login_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/ajaxauth/login":
            return httpx.Response(401, text="unauthorized")
        return httpx.Response(200, json=[])

    _patch_client(monkeypatch, handler)

    with pytest.raises(SpaceTrackFetchError):
        await fetch_spacetrack_gp()


@pytest.mark.asyncio
async def test_fetch_spacetrack_gp_raises_on_query_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/ajaxauth/login":
            return httpx.Response(200, text="")
        return httpx.Response(503, text="service unavailable")

    _patch_client(monkeypatch, handler)

    with pytest.raises(SpaceTrackFetchError):
        await fetch_spacetrack_gp()


@pytest.mark.asyncio
async def test_fetch_spacetrack_gp_raises_on_non_array_response(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/ajaxauth/login":
            return httpx.Response(200, text="")
        return httpx.Response(200, json={"error": "no results"})

    _patch_client(monkeypatch, handler)

    with pytest.raises(SpaceTrackFetchError):
        await fetch_spacetrack_gp()


@pytest.mark.asyncio
async def test_fetch_spacetrack_gp_raises_on_non_json_response(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Space-Track's login can return HTTP 200 even on bad credentials,
    with the subsequent gp query then returning an HTML error page instead
    of JSON — this must still surface as SpaceTrackFetchError, not a raw
    JSONDecodeError escaping the documented contract.
    """

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/ajaxauth/login":
            return httpx.Response(200, text="")
        return httpx.Response(200, text="<html>please log in</html>")

    _patch_client(monkeypatch, handler)

    with pytest.raises(SpaceTrackFetchError):
        await fetch_spacetrack_gp()


def _patch_client(monkeypatch: pytest.MonkeyPatch, handler) -> None:  # type: ignore[no-untyped-def]
    real_client = httpx.AsyncClient

    def mock_client(*args: object, **kwargs: object) -> httpx.AsyncClient:
        kwargs["transport"] = httpx.MockTransport(handler)
        return real_client(*args, **kwargs)  # type: ignore[arg-type]

    monkeypatch.setattr("app.infra.spacetrack.client.httpx.AsyncClient", mock_client)
