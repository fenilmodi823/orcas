"""Bake the Sun and the eight planets from JPL DE421 into Hermite keyframes (S3).

Reads `data/ephemeris/de421.bsp` with the numpy-only reader in
`de421_reference.py` (B.16: no new dependency) and writes:

- `frontend/public/ephemeris/planets-de421.bin`: per body, position and
  velocity at a fixed step over DE421's whole span, read from the file's own
  segment headers. The client interpolates between keyframes with the same
  cubic Hermite as the satellites (M1.1).
- `frontend/src/data/fixtures/de421-planets.json`: positions evaluated directly
  from DE421's Chebyshev series at epochs between keyframes, which the
  TypeScript test checks the baked file against.

Frame: ICRF, Solar System barycentre. Units: km, km/s. Time: keyframes are on
an ET (TDB seconds past J2000) grid. Jupiter to Neptune are system barycentres:
DE421 carries no planet-centre segment for them.

The step per body keeps the Hermite error at or below MAX_ERROR_ARCSEC as seen
from the Earth. The script measures that error at every interval midpoint,
where a cubic's error peaks, and fails if any body exceeds it.

Binary layout, little-endian:
  header   8s magic "ORCASPL1", u32 body count
  per body i32 NAIF id, u32 keyframe count, f64 first ET (s), f64 step (s), u32 data offset (bytes)
  data     f32 [x, y, z, vx, vy, vz] per keyframe, km and km/s

Run from the repo root:  python scripts/data/bake_planets.py
"""

from __future__ import annotations

import json
import struct
from datetime import datetime
from pathlib import Path

import numpy as np
from de421_reference import J2000_TT, KERNEL, TT_MINUS_UTC_S, Segment, read_segments

OUT_BIN = Path("frontend/public/ephemeris/planets-de421.bin")
OUT_FIXTURE = Path("frontend/src/data/fixtures/de421-planets.json")
MAGIC = b"ORCASPL1"
DAY_S = 86_400.0
MAX_ERROR_ARCSEC = 1.0
# The nearest any planet comes to the Earth (Venus, ~0.26 AU, rounded down).
# An error in the Earth's own position is judged at this distance.
NEAREST_PLANET_KM = 3.8e7

# NAIF id -> (chain of segments summed from the Solar System barycentre, step in days)
BODIES: dict[int, tuple[list[tuple[int, int]], float]] = {
    10: ([(10, 0)], 32),
    199: ([(1, 0), (199, 1)], 1),
    299: ([(2, 0), (299, 2)], 4),
    399: ([(3, 0), (399, 3)], 4),
    499: ([(4, 0), (499, 4)], 8),
    5: ([(5, 0)], 32),
    6: ([(6, 0)], 32),
    7: ([(7, 0)], 32),
    8: ([(8, 0)], 32),
}

FIXTURE_EPOCHS_UTC = [
    "1899-08-01T03:17:00Z",  # three days into DE421
    "1969-07-20T20:17:40Z",  # Apollo 11 lands
    "2009-02-10T16:56:00Z",  # the Iridium 33 / Cosmos 2251 collision
    "2026-10-05T12:34:56Z",
    "2053-10-06T21:40:00Z",  # three days before DE421 ends
]


def ssb_state(seg: dict[tuple[int, int], Segment], chain: list[tuple[int, int]], et: float) -> np.ndarray:
    """[x, y, z, vx, vy, vz] relative to the Solar System barycentre. Output: km, km/s, ICRF."""
    state = np.zeros(6)
    for key in chain:
        p, v = seg[key].state_km(et)
        state[:3] += p
        state[3:] += v
    return state


def hermite_position(s0: np.ndarray, s1: np.ndarray, h: float, s: float) -> np.ndarray:
    """Cubic Hermite position at fraction s of a step of h seconds, as the client evaluates it."""
    h00, h10, h01, h11 = 2 * s**3 - 3 * s**2 + 1, s**3 - 2 * s**2 + s, -2 * s**3 + 3 * s**2, s**3 - s**2
    return h00 * s0[:3] + h10 * h * s0[3:] + h01 * s1[:3] + h11 * h * s1[3:]


def span_et(seg: dict[tuple[int, int], Segment]) -> tuple[float, float]:
    """The span every segment covers, from the segments' own headers. Output: ET seconds."""
    start = max(float(s.init) for s in seg.values())
    end = min(float(s.init + s.intlen * s.n) for s in seg.values())
    return start, end


def main() -> None:
    seg = read_segments(KERNEL)
    start, end = span_et(seg)
    keyframes: dict[int, np.ndarray] = {}
    for naif, (chain, step_days) in BODIES.items():
        step = step_days * DAY_S
        count = int((end - start) // step) + 1
        keyframes[naif] = np.array([ssb_state(seg, chain, start + k * step) for k in range(count)])

    earth_chain = BODIES[399][0]
    for naif, (chain, step_days) in BODIES.items():
        frames, step = keyframes[naif], step_days * DAY_S
        worst = 0.0
        for k in range(len(frames) - 1):
            et = start + (k + 0.5) * step
            error_km = np.linalg.norm(
                hermite_position(frames[k], frames[k + 1], step, 0.5) - ssb_state(seg, chain, et)[:3]
            )
            if naif == 399:
                distance_km = NEAREST_PLANET_KM
            else:
                distance_km = np.linalg.norm(ssb_state(seg, chain, et)[:3] - ssb_state(seg, earth_chain, et)[:3])
            worst = max(worst, np.degrees(error_km / distance_km) * 3600)
        print(f"NAIF {naif:>3}: step {step_days:>2} d, {len(frames):>6} keyframes, worst {worst:.4f} arcsec")
        if worst > MAX_ERROR_ARCSEC:
            raise SystemExit(f"NAIF {naif} exceeds {MAX_ERROR_ARCSEC} arcsec; shorten its step")

    header = struct.pack("<8sI", MAGIC, len(BODIES))
    entry_size = struct.calcsize("<iIddI")
    offset = len(header) + entry_size * len(BODIES)
    entries, blobs = b"", b""
    for naif, (_chain, step_days) in BODIES.items():
        frames = keyframes[naif]
        entries += struct.pack("<iIddI", naif, len(frames), start, step_days * DAY_S, offset + len(blobs))
        blobs += frames.astype("<f4").tobytes()
    OUT_BIN.parent.mkdir(parents=True, exist_ok=True)
    OUT_BIN.write_bytes(header + entries + blobs)
    print(f"wrote {OUT_BIN} ({OUT_BIN.stat().st_size:,} bytes)")

    rows = []
    for utc in FIXTURE_EPOCHS_UTC:
        at = datetime.fromisoformat(utc.replace("Z", "+00:00"))
        et = (at - J2000_TT).total_seconds() + TT_MINUS_UTC_S
        positions = {str(naif): ssb_state(seg, chain, et)[:3].round(3).tolist() for naif, (chain, _) in BODIES.items()}
        rows.append({"utc": utc, "positionsKm": positions})
    OUT_FIXTURE.parent.mkdir(parents=True, exist_ok=True)
    fixture = {
        "source": "JPL DE421 (data/ephemeris/de421.bsp), its Chebyshev series evaluated directly by bake_planets.py",
        "frame": "ICRF, Solar System barycentre",
        "units": "km",
        "timeScale": f"UTC epochs; ET = UTC + {TT_MINUS_UTC_S} s",
        "epochs": rows,
    }
    OUT_FIXTURE.write_text(json.dumps(fixture, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(rows)} epochs to {OUT_FIXTURE}")


if __name__ == "__main__":
    main()
