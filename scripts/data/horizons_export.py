"""Read the S6 Horizons web-form exports (B.26) saved in `data/horizons/raw/*.json`.

Each file holds one request: what was asked of the form, the export time, the
exact batch settings the form generated, and Horizons' text result. Rows are
VEC_TABLE 2 CSV: JDTDB, calendar date, delta-T, X, Y, Z, VX, VY, VZ.

Frame: ICRF, relative to the request's centre. Units: km, km/s. Time: TDB,
converted to ET (seconds past J2000).
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from pathlib import Path

import numpy as np

RAW = Path("data/horizons/raw")
J2000_JD = 2451545.0
UNIT_S = {"MINUTES": 60, "HOURS": 3600, "DAYS": 86400}


def read_export(path: Path) -> dict:
    """One saved web-form export: its request, header and rows. Output: ET s, km, km/s."""
    raw = json.loads(path.read_text(encoding="utf-8"))
    res = raw["result"]
    soe, eoe = res.index("$$SOE"), res.index("$$EOE")
    rows = np.array(
        [
            [float(v) for v in ln.split(",")[:1] + ln.split(",")[3:9]]
            for ln in res[soe + 5 : eoe].splitlines()
            if ln.strip()
        ]
    )
    head = res[res.index("Ephemeris /") : soe]
    source = re.search(r"Target body name: .*\{source: (.*)\}", res)
    req = raw["request"]
    return {
        "n": req["n"],
        "target": req["id"],
        "centre": req["c"],
        "start": req["a"],
        "stop": req["b"],
        "step": req["step"],
        "unit": req["unit"],
        "exportedUtc": raw["exportedUtc"],
        "source": source.group(1) if source else None,
        "header": head[: head.index("JDTDB")].rstrip("* \n"),
        "batch": raw["batch"].strip(),
        "et": (rows[:, 0] - J2000_JD) * 86_400.0,
        "state": rows[:, 1:7],
    }


def read_all() -> list[dict]:
    return [read_export(p) for p in sorted(RAW.glob("*.json"))]


def merge_series(exports: list[dict]) -> list[dict]:
    """Join the requests of one series (same target, centre, step) that share a boundary epoch."""
    series: dict[tuple, list[dict]] = defaultdict(list)
    for e in exports:
        series[(e["target"], e["centre"], e["step"] * UNIT_S[e["unit"]])].append(e)
    merged = []
    for (target, centre, step), parts in series.items():
        current = None
        for e in sorted(parts, key=lambda e: e["et"][0]):
            if current is not None and abs(e["et"][0] - current["et"][-1]) < 1.0:
                gap = np.abs(e["state"][0, :3] - current["state"][-1, :3]).max()
                assert gap < 1e-3, f"{target}@{centre}: requests disagree by {gap} km"
                current["et"] = np.concatenate([current["et"], e["et"][1:]])
                current["state"] = np.concatenate([current["state"], e["state"][1:]])
                current["requests"].append(e["n"])
            else:
                current = {
                    "target": target,
                    "centre": centre,
                    "exportStepS": step,
                    "et": e["et"].copy(),
                    "state": e["state"].copy(),
                    "requests": [e["n"]],
                }
                merged.append(current)
    for s in merged:
        steps = np.diff(s["et"])
        assert np.allclose(steps, s["exportStepS"], atol=1e-3), f"{s['target']}: uneven grid"
    return merged


def iso(et: float) -> str:
    """ET seconds past J2000 as a TDB calendar label, to the minute."""
    j2000 = datetime(2000, 1, 1, 12, tzinfo=UTC)  # a TDB label, as de421_reference.py does
    return (j2000 + timedelta(seconds=float(et))).strftime("%Y-%m-%d %H:%M")
