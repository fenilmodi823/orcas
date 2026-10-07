"""Bake the S6 Horizons export into Hermite keyframes (S6a, B.26, B.27).

Reads every web-form export in `data/horizons/raw/` (gitignored, like
`de421.bsp`) with `horizons_export.py` and writes, beside the planet bake:

- `frontend/public/ephemeris/horizons/<group>.bin`: segments of position and
  velocity keyframes at a fixed step, relative to each segment's centre.
- `.../horizons/manifest.json`: every object (name, Horizons trajectory source,
  the fit/prediction boundary its data sheet states, from
  `scripts/data/horizons_objects.json`), every series with its error, and every
  request (target, centre, span, step, export time, rows).
- `.../horizons/headers.txt`: each request's Horizons header and the exact
  web-form settings, so the export can be repeated by hand.
- `frontend/src/data/fixtures/horizons-samples.json`: exported states between
  keyframes, which the TypeScript test checks the baked files against.

Each series is cut into segments of CHUNK export steps; `horizons_hermite.py`
chooses each segment's step and interpolation window (SPK type 13). Per target,
segments are written finest export step first: the first that covers an
instant is the one to use. Frame: ICRF. Units: km, km/s. Time: TDB, ET seconds
past J2000.

Binary layout, little-endian:
  header   8s magic "ORCASHZ1", u32 segment count
  segment  i32 target, i32 centre, u32 keyframe count, f64 first ET (s), f64 step (s),
           u32 window W, u32 data offset
  data     f32 [x, y, z, vx, vy, vz] per keyframe, km and km/s

Run from the repo root:  python scripts/data/bake_horizons.py
"""

from __future__ import annotations

import json
import struct
from collections import defaultdict
from pathlib import Path

import numpy as np
from horizons_export import iso, merge_series, read_all
from horizons_hermite import MAX_RELATIVE_ERROR, bake_chunk

OBJECTS = Path("scripts/data/horizons_objects.json")
OUT = Path("frontend/public/ephemeris/horizons")
OUT_FIXTURE = Path("frontend/src/data/fixtures/horizons-samples.json")
MAGIC = b"ORCASHZ1"
ENTRY = "<iiIddII"
CHUNK = 256
MOON_FILE = {"499": "moons-mars", "5": "moons-jupiter", "6": "moons-saturn"}
MOON_FILE |= {"7": "moons-uranus", "8": "moons-neptune"}
# IAU 2015 equatorial radii: a planet centre's offset from its barycentre is judged against these.
PLANET_RADIUS_KM = {"599": 71_492.0, "699": 60_268.0, "799": 25_559.0, "899": 24_764.0}


def file_of(target: str, centre: str) -> str:
    return "spacecraft" if target.startswith("-") else MOON_FILE[centre]


def write_file(path: Path, segments: list[dict]) -> None:
    head = struct.pack("<8sI", MAGIC, len(segments))
    offset = len(head) + struct.calcsize(ENTRY) * len(segments)
    entries, blobs = b"", b""
    for s in segments:
        target, centre, frames = int(s["target"]), int(s["centre"]), s["frames"]
        at = offset + len(blobs)
        entries += struct.pack(
            ENTRY, target, centre, len(frames), s["firstEt"], s["stepS"], s["w"], at
        )
        blobs += frames.astype("<f4").tobytes()
    path.write_bytes(head + entries + blobs)


def bake_series(s: dict, files: dict[str, list[dict]], samples: list[dict]) -> dict:
    """Cut one series into segments, append them to `files`, and return its manifest row."""
    h, state, radius = s["exportStepS"], s["state"], PLANET_RADIUS_KM.get(s["target"])
    starts = range(0, len(state) - 1, CHUNK)
    chunks, keyframes, thinned_at = [], 0, []
    for a in starts:
        c = state[a : min(a + CHUNK, len(state) - 1) + 1]
        b = bake_chunk(c, h, radius)
        chunks.append(b)
        frames = c[:: b["m"]]
        keyframes += len(frames)
        segment = {**s, "firstEt": s["et"][a], "stepS": b["m"] * h, "w": b["w"], "frames": frames}
        files[file_of(s["target"], s["centre"])].append(segment)
        if b["m"] > 1:  # the dropped sample nearest the chunk's middle
            thinned_at.append(a + b["m"] // 2 + b["m"] * ((len(c) - 1) // b["m"] // 2))
    for i in thinned_at[:: max(1, len(thinned_at) // 3)][:3]:
        samples.append(
            {
                "target": int(s["target"]),
                "centre": int(s["centre"]),
                "et": float(s["et"][i]),
                "positionKm": state[i, :3].round(4).tolist(),
                "scaleKm": radius or float(np.linalg.norm(state[i, :3])),
            }
        )
    last = len(state) - 1
    jumps = [
        [iso(s["et"][a]), iso(s["et"][min(a + CHUNK, last)])]
        for a, c in zip(starts, chunks, strict=True)
        if c.get("jump")
    ]
    measured = [c["error"] for c in chunks if c["error"] is not None]
    estimated = [c["estimated"] for c in chunks if "estimated" in c]
    return {
        "file": f"{file_of(s['target'], s['centre'])}.bin",
        "target": int(s["target"]),
        "centre": int(s["centre"]),
        "start": iso(s["et"][0]),
        "stop": iso(s["et"][-1]),
        "exportStepS": h,
        "segments": len(chunks),
        "keyframes": keyframes,
        "fourStateSegments": sum(c["w"] == 4 for c in chunks),
        "worstErrorMeasured": max(measured, default=None),
        "segmentsAtExportStep": sum(c["m"] == 1 for c in chunks),
        "worstErrorAtExportStepEstimated": max(estimated, default=None),
        "jumpsInTheData": jumps,
        "requests": s["requests"],
    }


def main() -> None:
    exports = read_all()
    objects = json.loads(OBJECTS.read_text(encoding="utf-8"))
    merged = sorted(
        merge_series(exports), key=lambda s: (int(s["target"]), s["exportStepS"], s["et"][0])
    )
    files: dict[str, list[dict]] = defaultdict(list)
    samples: list[dict] = []
    series = []
    for s in merged:
        row = bake_series(s, files, samples)
        series.append(row)
        print(
            f"{row['target']:>6} @{row['centre']:<4} {row['exportStepS']:>6.0f}s"
            f" {row['segments']:>5} segs, {row['segmentsAtExportStep']:>4} at export step,"
            f" measured {row['worstErrorMeasured'] or 0:.1e},"
            f" estimated {row['worstErrorAtExportStepEstimated'] or 0:.1e},"
            f" {len(row['jumpsInTheData'])} jumps"
        )
    OUT.mkdir(parents=True, exist_ok=True)
    for name, segs in sorted(files.items()):
        write_file(OUT / f"{name}.bin", segs)
        print(f"{name}.bin: {len(segs)} segments, {(OUT / f'{name}.bin').stat().st_size:,} bytes")

    sources = {e["target"]: e["source"] for e in exports}
    request_keys = ("n", "target", "centre", "start", "stop", "step", "unit", "exportedUtc")
    manifest = {
        "source": "JPL Horizons (https://ssd.jpl.nasa.gov/horizons/), web form, by hand",
        "licence": "None stated by NASA for Horizons; committed with attribution (B.17)",
        "frame": "ICRF; positions relative to each segment's centre",
        "units": "km, km/s; time ET (TDB seconds past J2000)",
        "interpolation": "Hermite through W states (SPK type 13); W per segment in the .bin",
        "maxRelativeError": MAX_RELATIVE_ERROR,
        "objects": {t: {**objects.get(t, {}), "horizonsSource": sources[t]} for t in sources},
        "series": series,
        "requests": [{k: e[k] for k in request_keys} | {"rows": len(e["et"])} for e in exports],
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=1) + "\n", encoding="utf-8")
    headers = "".join(
        f"######## {e['n']}  exported {e['exportedUtc']}\n{e['header']}\n\n{e['batch']}\n\n"
        for e in exports
    )
    (OUT / "headers.txt").write_text(headers, encoding="utf-8")
    fixture = {
        "source": "JPL Horizons web-form exports (data/horizons/raw): states between keyframes",
        "frame": "ICRF, relative to centre",
        "units": "km; et = TDB seconds past J2000",
        "maxRelativeError": MAX_RELATIVE_ERROR,
        "samples": samples,
    }
    OUT_FIXTURE.write_text(json.dumps(fixture, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {len(samples)} fixture samples")


if __name__ == "__main__":
    main()
