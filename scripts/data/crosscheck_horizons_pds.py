"""Cross-check the S6 Horizons export against mission-era ephemerides in NASA's PDS (S6a done-when).

Three Saturn flybys, each archived by the PDS Planetary Plasma Interactions node
(https://pds-ppi.igpp.ucla.edu), independent of Horizons' trajectory files:

- Voyager 1 and Voyager 2: SEDR ephemerides by the Voyager MAG team, volume
  VG_1601, 96 s steps. Positions relative to Saturn in Saturn radii (the radius
  is not stated in the files) and heliocentric positions in AU.
- Pioneer 11: the Saturn-encounter trajectory, volume PN_6001, 1 min steps,
  "not part of an official PDS data set" by its own label. Distance from Saturn
  in Saturn radii, and the one-way light time to the Earth.

Only frame-free quantities are compared: distance from Saturn (with the radius
fitted, since the files do not state it), the time of closest approach,
heliocentric range, and Earth range from the light time. Positions on the ORCAS
side come from the raw export (`data/horizons/raw`, through the four-state
curve); the bake is held to the export by the TypeScript test. The Sun, Saturn
and the Earth come from DE421 (`de421_reference.py`).

Time scales: Pioneer 11's spacecraft times are ET (its ground-received time
equals them plus the light time minus 50.18 s). The Voyager files do not say;
they are read as UTC (TT - UTC = 51.184 s in 1980, 52.184 s in 1981), and the
closest-approach difference is also given as if they were ET.

Run from the repo root:  python scripts/data/crosscheck_horizons_pds.py
"""

from __future__ import annotations

import urllib.request
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
from de421_reference import KERNEL, read_segments
from horizons_export import merge_series, read_all
from horizons_hermite import hermite_window

CACHE = Path("data/pds")
PPI = "https://pds-ppi.igpp.ucla.edu/volume"
AU_KM = 149_597_870.7
C_KM_S = 299_792.458
J2000 = datetime(2000, 1, 1, 12, tzinfo=UTC)
SATURN, SUN, EARTH = [(6, 0)], [(10, 0)], [(3, 0), (399, 3)]
# name, NAIF id, Saturn-relative file and its time/radius columns, heliocentric file, TT - UTC (s)
OBJECTS = [
    (
        "Voyager 1",
        "-31",
        "VG_1601/VG1/EPHEM/SEDR_L1.TAB",
        10,
        "VG_1601/VG1/EPHEM/SEDR_HG.TAB",
        51.184,
    ),
    (
        "Voyager 2",
        "-32",
        "VG_1601/VG2/EPHEM/SEDR_L1.TAB",
        10,
        "VG_1601/VG2/EPHEM/SEDR_HG.TAB",
        52.184,
    ),
    ("Pioneer 11", "-24", "PN_6001/DATA/TRAJ/P11_SAT_TRAJ_NEAR_ENC_1MIN.TAB", 12, None, 0.0),
]


def rows(path: str) -> list[list[str]]:
    """A PDS table, downloaded once into the gitignored cache."""
    local = CACHE / path.replace("/", "_")
    if not local.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(f"{PPI}/{path}", local)  # a fixed https host
    return [line.split() for line in local.read_text(encoding="ascii").splitlines() if line.strip()]


def et_of(label: str, tt_minus_utc_s: float) -> float:
    """A PDS time label as ET seconds past J2000 (TDB - TT, under 2 ms, ignored)."""
    at = datetime.fromisoformat(label.replace("Z", "+00:00"))
    return (at - J2000).total_seconds() + tt_minus_utc_s


def state_at(series: dict, et: float) -> np.ndarray:
    """Exported position at ET, four-state curve. Output: km, ICRF, relative to centre."""
    u = (et - series["et"][0]) / series["exportStepS"]
    lo = min(max(int(u) - 1, 0), len(series["et"]) - 4)
    idx = np.arange(lo, lo + 4)[None, :]
    st, h = series["state"], series["exportStepS"]
    return hermite_window(idx.astype(float), st[idx, :3], st[idx, 3:] * h, np.array([u]))[0]


def closest_time(t: np.ndarray, r: np.ndarray) -> float:
    """Time of minimum range, refined by a parabola through the three nearest samples."""
    i = int(np.argmin(r))
    a, b, c = r[i - 1], r[i], r[i + 1]
    return float(t[i] + (t[i + 1] - t[i]) * (a - c) / (2 * (a - 2 * b + c)))


def main() -> None:
    seg = read_segments(KERNEL)

    def ssb(chain: list[tuple[int, int]], et: float) -> np.ndarray:
        return sum(seg[key].position_km(et) for key in chain)

    series = merge_series(read_all())
    saturn = next(s for s in series if s["target"] == "699" and s["centre"] == "6")
    for name, naif, rel_path, r_col, helio_path, tt_utc in OBJECTS:
        craft = next(s for s in series if s["target"] == naif and s["centre"] == "6")
        table = [r for r in rows(rel_path) if 0 < float(r[r_col]) < 20]  # within 20 radii of Saturn
        t = np.array([et_of(r[0], tt_utc) for r in table])
        r_pds = np.array([float(r[r_col]) for r in table])
        r_orc = np.array([np.linalg.norm(state_at(craft, x) - state_at(saturn, x)) for x in t])
        radius = float(np.median(r_orc / r_pds))
        resid = np.abs(r_orc - radius * r_pds)
        dt = closest_time(t, r_orc) - closest_time(t, r_pds)
        print(f"\n{name}: {len(t)} samples within 20 Saturn radii")
        print(f"  Saturn radius implied by the PDS file: {radius:,.1f} km")
        print(
            f"  distance from Saturn, ORCAS - PDS x that radius: median {np.median(resid):,.0f} km,"
            f" 95th percentile {np.percentile(resid, 95):,.0f} km"
        )
        print(
            f"  closest approach: ORCAS {r_orc.min():,.0f} km, PDS {r_pds.min():.4f} radii;"
            f" ORCAS - PDS {dt:+.1f} s"
            + (f" ({dt - tt_utc:+.1f} s if the PDS times are ET)" if tt_utc else "")
        )
        if helio_path:
            helio = rows(helio_path)[::200]
            d = [
                np.linalg.norm(state_at(craft, et) + ssb(SATURN, et) - ssb(SUN, et))
                - float(r[10]) * AU_KM
                for r in helio
                for et in [et_of(r[0], tt_utc)]
            ]
            print(
                f"  heliocentric range, ORCAS - PDS ({len(d)} epochs): {min(d):,.0f}"
                f" to {max(d):,.0f} km"
            )
        else:
            light = table[:: max(1, len(table) // 20)]
            d = []
            for r in light:
                et, owlt = et_of(r[0], 0.0), float(r[2])
                craft_ssb = state_at(craft, et) + ssb(SATURN, et)
                d.append(np.linalg.norm(ssb(EARTH, et + owlt) - craft_ssb) - owlt * C_KM_S)
            print(
                f"  Earth range, ORCAS - c x light time ({len(d)} epochs): {min(d):,.0f}"
                f" to {max(d):,.0f} km"
            )


if __name__ == "__main__":
    main()
