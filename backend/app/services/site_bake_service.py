"""The public static site's data files (Stage 2 spec §3): the catalogue and
the latest screening run, baked from the local database into gzip JSON.

Never contacts the network: the account is never shared and visitors never
touch Space-Track (Q22 step 4). Pure shaping functions come first so they
test without a database; `bake_site` wires them to a session.
"""

import gzip
import json
import shutil
from collections import defaultdict
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.conjunctions import ScreeningRunInfo, conjunction_item
from app.services.screening_service import latest_run, list_conjunctions
from app.services.snapshot_service import build_snapshot

#: The frontend's TOP_CONJUNCTION_LIMIT and fetchConjunctions limit.
TOP_LIMIT = 10
PER_OBJECT_LIMIT = 200

#: Mirrors frontend/src/data/catalog-provenance.ts SOURCE_CREDITS (Q22 wording).
SOURCE_CREDITS: Mapping[str, str] = {
    "celestrak": "CelesTrak GP",
    "spacetrack-gp": (
        "Space-Track.org, courtesy of USSPACECOM (18th Space Defense Squadron), GP catalogue"
    ),
}

#: Object types and decay dates come from the SATCAT ingest on every refresh (Q35).
SATCAT_CREDIT = "Object types and decay dates: CelesTrak SATCAT."

Json = dict[str, Any]


class BakeGuardError(Exception):
    """The database cannot produce a consistent site: nothing is written."""


def attribution_for(source: str) -> str:
    """The citation carried inside every baked file (Q22 step 2), from the
    snapshot's '+'-joined source ids. An unknown id is kept, never dropped."""
    credits = [SOURCE_CREDITS.get(s, s) for s in source.split("+") if s]
    return (
        f"Orbital data: {'; '.join(credits)}. "
        f"{SATCAT_CREDIT} "
        "Close approaches: ORCAS screening analysis based on USSPACECOM data; "
        "a screening result, not an operational warning. "
        "Positions are SGP4 propagations, not observations."
    )


def shard_of(norad_id: str) -> str:
    """Which by-object file holds this object's passes. Mirrored exactly by
    frontend/src/data/conjunction-client.ts shardOf."""
    return norad_id[-2:].rjust(2, "0")


def passes_by_shard(items: Sequence[Json]) -> dict[str, dict[str, list[Json]]]:
    """Each object's passes, as the endpoint lists them for `norad_id`: every
    encounter it is a party to, TCA ascending, at most PER_OBJECT_LIMIT."""
    per_object: dict[str, list[Json]] = defaultdict(list)
    for item in items:
        for side in ("primary", "secondary"):
            per_object[item[side]["norad_id"]].append(item)
    shards: dict[str, dict[str, list[Json]]] = defaultdict(dict)
    for norad_id, passes in per_object.items():
        # Parsed, not compared as strings: pydantic drops zero microseconds.
        passes.sort(key=lambda p: datetime.fromisoformat(p["tca"]))
        shards[shard_of(norad_id)][norad_id] = passes[:PER_OBJECT_LIMIT]
    return dict(shards)


def check_epochs(items: Sequence[Json], records: Sequence[Mapping[str, object]]) -> None:
    """Every screened party's element set must be the one in the catalogue,
    or Watch would replay a pass on orbits the screen never used."""
    epochs = {str(r["NORAD_CAT_ID"]): datetime.fromisoformat(str(r["EPOCH"])) for r in records}
    mismatched: set[str] = set()
    for item in items:
        for side in ("primary", "secondary"):
            party = item[side]
            if epochs.get(party["norad_id"]) != datetime.fromisoformat(party["element_set_epoch"]):
                mismatched.add(party["norad_id"])
    if mismatched:
        examples = ", ".join(sorted(mismatched)[:5])
        raise BakeGuardError(
            f"{len(mismatched)} screened objects do not match the catalogue (e.g. {examples}): "
            "an ingest ran after the screen. Re-screen, then bake again."
        )


def write_gz_json(path: Path, payload: Json) -> int:
    """Compact gzip JSON, byte-identical for identical input (mtime 0). Returns its size."""
    path.parent.mkdir(parents=True, exist_ok=True)
    data = gzip.compress(json.dumps(payload, separators=(",", ":")).encode("utf-8"), mtime=0)
    path.write_bytes(data)
    return len(data)


def _notice(attribution: str, generated_at: datetime) -> str:
    return (
        "ORCAS public site data\n\n"
        f"Baked {generated_at.isoformat()} from a local database; not live.\n\n"
        f"{attribution}\n\n"
        "Orbital data from Space-Track.org is redistributed under USSPACECOM's blanket approval "
        "for basic SSA data (OMM records and SATCAT), conditioned on this citation.\n"
    )


async def bake_site(session: AsyncSession, out_dir: Path) -> dict[str, int]:
    """Write the site's data files to `out_dir`; returns each file's size in bytes.
    Raises BakeGuardError, writing nothing, when there is no catalogue or run
    or when the run and the catalogue disagree."""
    snapshot = await build_snapshot(session)
    if not snapshot.objects:
        raise BakeGuardError("no element sets in the database yet")
    run = await latest_run(session)
    if run is None:
        raise BakeGuardError("no screening run yet: screen before baking")
    rows = await list_conjunctions(session, run.id, None, max(run.encounters, 1))
    # Ordered as the endpoint orders the whole catalogue: maximum P_c first.
    items: list[Json] = [conjunction_item(c, run).model_dump(mode="json") for c in rows]
    check_epochs(items, snapshot.objects)

    generated_at = datetime.now(UTC)
    attribution = attribution_for(snapshot.source)
    run_json = ScreeningRunInfo.model_validate(run, from_attributes=True).model_dump(mode="json")
    head: Json = {"attribution": attribution, "generated_at": generated_at.isoformat()}

    # A previous bake's shard must never outlive it.
    shutil.rmtree(out_dir / "conjunctions", ignore_errors=True)
    sizes = {
        "catalog.json.gz": write_gz_json(
            out_dir / "catalog.json.gz",
            {
                **head,
                "data_as_of": run_json["window_start"],
                "source": snapshot.source,
                "records": snapshot.objects,
            },
        ),
        "conjunctions/top.json.gz": write_gz_json(
            out_dir / "conjunctions" / "top.json.gz",
            {**head, "run": run_json, "items": items[:TOP_LIMIT]},
        ),
    }
    for shard, objects in passes_by_shard(items).items():
        name = f"conjunctions/by-object/{shard}.json.gz"
        sizes[name] = write_gz_json(out_dir / name, {**head, "run": run_json, "objects": objects})
    (out_dir / "NOTICE.txt").write_text(_notice(attribution, generated_at), encoding="utf-8")
    return sizes
