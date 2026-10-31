"""The static site's bake: pure shaping, no database (Stage 2 spec §3)."""

import gzip
import json
from pathlib import Path
from typing import Any

import pytest

from app.services.site_bake_service import (
    PER_OBJECT_LIMIT,
    BakeGuardError,
    attribution_for,
    check_epochs,
    passes_by_shard,
    shard_of,
    write_gz_json,
)


def _item(a: str, b: str, tca: str, epoch: str = "2026-10-27T01:00:00Z") -> dict[str, Any]:
    def party(n: str) -> dict[str, Any]:
        return {"norad_id": n, "name": f"OBJ {n}", "object_type": None, "element_set_epoch": epoch}

    return {"tca": tca, "primary": party(a), "secondary": party(b)}


def test_attribution_names_usspacecom_and_every_source() -> None:
    text = attribution_for("celestrak+spacetrack-gp")
    assert "Space-Track.org, courtesy of USSPACECOM (18th Space Defense Squadron)" in text
    assert "CelesTrak GP" in text
    assert "Object types and decay dates: CelesTrak SATCAT." in text
    assert "not an operational warning" in text
    assert "SGP4 propagations, not observations" in text


def test_attribution_keeps_an_unknown_source_by_its_raw_id() -> None:
    assert "mystery-feed" in attribution_for("mystery-feed")


@pytest.mark.parametrize(
    ("norad", "shard"),
    [("25544", "44"), ("5", "05"), ("12", "12"), ("100123", "23"), ("A0001", "01")],
)
def test_shard_is_the_last_two_characters_padded(norad: str, shard: str) -> None:
    assert shard_of(norad) == shard


def test_every_pass_is_listed_under_both_parties_in_tca_order() -> None:
    items = [
        _item("25544", "11144", "2026-10-27T09:00:00Z"),
        # Pydantic drops zero microseconds, so string order is not time order.
        _item("25544", "22244", "2026-10-27T08:59:59.500000Z"),
    ]
    shards = passes_by_shard(items)
    tcas = [i["tca"] for i in shards["44"]["25544"]]
    assert tcas == ["2026-10-27T08:59:59.500000Z", "2026-10-27T09:00:00Z"]
    assert shards["44"]["11144"] == [items[0]]
    assert shards["44"]["22244"] == [items[1]]


def test_one_object_keeps_at_most_the_panels_limit() -> None:
    items = [
        _item("25544", str(10000 + i), f"2026-10-27T{i // 60 % 24:02}:{i % 60:02}:00Z")
        for i in range(PER_OBJECT_LIMIT + 5)
    ]
    assert len(passes_by_shard(items)["44"]["25544"]) == PER_OBJECT_LIMIT


def test_guard_passes_when_every_party_matches_the_catalogue() -> None:
    records = [
        {"NORAD_CAT_ID": "25544", "EPOCH": "2026-10-27T01:00:00+00:00"},
        {"NORAD_CAT_ID": "11144", "EPOCH": "2026-10-27T01:00:00+00:00"},
    ]
    check_epochs([_item("25544", "11144", "2026-10-27T09:00:00Z")], records)


def test_guard_fails_when_an_ingest_ran_after_the_screen() -> None:
    records = [
        {"NORAD_CAT_ID": "25544", "EPOCH": "2026-10-28T01:00:00+00:00"},
        {"NORAD_CAT_ID": "11144", "EPOCH": "2026-10-27T01:00:00+00:00"},
    ]
    with pytest.raises(BakeGuardError, match="25544") as caught:
        check_epochs([_item("25544", "11144", "2026-10-27T09:00:00Z")], records)
    assert "Re-screen" in str(caught.value)


def test_guard_fails_when_a_party_is_missing_from_the_catalogue() -> None:
    records = [{"NORAD_CAT_ID": "25544", "EPOCH": "2026-10-27T01:00:00+00:00"}]
    with pytest.raises(BakeGuardError, match="11144"):
        check_epochs([_item("25544", "11144", "2026-10-27T09:00:00Z")], records)


def test_written_file_is_gzip_json_that_round_trips(tmp_path: Path) -> None:
    path = tmp_path / "a" / "b.json.gz"
    size = write_gz_json(path, {"attribution": "x", "records": [1, 2]})
    raw = path.read_bytes()
    assert raw[:2] == b"\x1f\x8b" and size == len(raw)
    assert json.loads(gzip.decompress(raw)) == {"attribution": "x", "records": [1, 2]}
