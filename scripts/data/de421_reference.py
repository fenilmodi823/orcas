"""Geocentric Sun and Moon positions from JPL DE421, as a test reference.

Reads `data/ephemeris/de421.bsp` directly — a DAF/SPK file whose Sun, Moon,
Earth and Earth-Moon-barycentre segments are all SPK type 2 (Chebyshev
position polynomials) — with numpy and nothing else, so the reference adds
no dependency. Writes `packages/orcas-physics/test/fixtures/de421-sun-moon.json`,
which the TypeScript analytic Sun/Moon are tested against.

Frame: ICRF (DE421's native frame, J2000 to milliarcseconds). Units: km.
Time: each UTC epoch is converted with TT - UTC = 69.184 s (leap seconds
since 2017-01-01); TDB - TT (< 2 ms) is ignored.

Run from the repo root:  python scripts/data/de421_reference.py
"""

from __future__ import annotations

import json
import struct
from datetime import UTC, datetime
from pathlib import Path

import numpy as np

KERNEL = Path("data/ephemeris/de421.bsp")
OUT = Path("packages/orcas-physics/test/fixtures/de421-sun-moon.json")
TT_MINUS_UTC_S = 69.184
J2000_TT = datetime(2000, 1, 1, 12, tzinfo=UTC)  # a TT label, subtracted from TT labels

EPOCHS_UTC = [
    "1992-04-12T00:00:00Z",  # Meeus example 47.a date
    "2009-02-10T16:56:00Z",  # the Iridium 33 / Cosmos 2251 collision
    "2024-01-01T00:00:00Z",
    "2025-06-21T12:00:00Z",
    "2026-03-03T11:33:00Z",  # a total lunar eclipse
    "2026-09-26T18:00:00Z",
    "2027-08-02T10:07:00Z",  # a total solar eclipse
    "2028-12-31T23:59:00Z",
]


class Segment:
    """One SPK type-2 segment: target relative to centre, Chebyshev records."""

    def __init__(self, words: np.ndarray, start: int, end: int) -> None:
        data = words[start - 1 : end]
        self.init, self.intlen, rsize, n = data[-4:]
        self.n = int(n)
        self.records = data[: self.n * int(rsize)].reshape(self.n, int(rsize))
        self.ncoef = (int(rsize) - 2) // 3

    def position_km(self, et: float) -> np.ndarray:
        """Position at ET (TDB seconds past J2000). Output: km, ICRF."""
        return self.state_km(et)[0]

    def state_km(self, et: float) -> tuple[np.ndarray, np.ndarray]:
        """Position and velocity at ET (TDB seconds past J2000). Velocity is the
        exact derivative of the same Chebyshev series. Output: km and km/s, ICRF."""
        i = min(int((et - self.init) // self.intlen), self.n - 1)
        record = self.records[i]
        mid, radius = record[0], record[1]
        s = (et - mid) / radius
        cheb = np.zeros(self.ncoef)
        dcheb = np.zeros(self.ncoef)  # d T_k / d s
        cheb[0] = 1.0
        if self.ncoef > 1:
            cheb[1], dcheb[1] = s, 1.0
        for k in range(2, self.ncoef):
            cheb[k] = 2 * s * cheb[k - 1] - cheb[k - 2]
            dcheb[k] = 2 * cheb[k - 1] + 2 * s * dcheb[k - 1] - dcheb[k - 2]
        coeffs = record[2:].reshape(3, self.ncoef)
        return coeffs @ cheb, (coeffs @ dcheb) / radius


def read_segments(path: Path) -> dict[tuple[int, int], Segment]:
    """Every type-2 segment in the kernel, keyed by (target, centre)."""
    raw = path.read_bytes()
    if raw[88:96] != b"LTL-IEEE":
        raise ValueError("expected a little-endian DAF")
    nd, ni = struct.unpack_from("<ii", raw, 8)
    fward = struct.unpack_from("<i", raw, 76)[0]
    words = np.frombuffer(raw, dtype="<f8")
    summary_doubles = nd + (ni + 1) // 2
    segments: dict[tuple[int, int], Segment] = {}
    record = fward
    while record:
        offset = (record - 1) * 1024
        next_record, _prev, nsum = struct.unpack_from("<ddd", raw, offset)
        for k in range(int(nsum)):
            base = offset + 24 + k * summary_doubles * 8
            target, centre, _frame, data_type, start, end = struct.unpack_from("<6i", raw, base + nd * 8)
            if data_type != 2:
                raise ValueError(f"segment {target}/{centre} is type {data_type}, not 2")
            segments[(target, centre)] = Segment(words, start, end)
        record = int(next_record)
    return segments


def main() -> None:
    seg = read_segments(KERNEL)
    rows = []
    for utc in EPOCHS_UTC:
        at = datetime.fromisoformat(utc.replace("Z", "+00:00"))
        # TT has no leap seconds, so TT-label arithmetic is exact. Before 2017
        # TT - UTC was smaller (58.184 s in 1992); the TypeScript side makes
        # the same approximation, so the comparison isolates the series error.
        et = (at - J2000_TT).total_seconds() + TT_MINUS_UTC_S
        earth = seg[(399, 3)].position_km(et)  # Earth relative to the Earth-Moon barycentre
        moon = seg[(301, 3)].position_km(et) - earth
        sun = seg[(10, 0)].position_km(et) - seg[(3, 0)].position_km(et) - earth
        rows.append({"utc": utc, "moonKm": moon.round(3).tolist(), "sunKm": sun.round(1).tolist()})
    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": "JPL DE421 (data/ephemeris/de421.bsp), read by scripts/data/de421_reference.py",
        "frame": "ICRF, geocentric, geometric (no light-time)",
        "units": "km",
        "timeScale": "UTC epochs; ET = UTC + 69.184 s",
        "epochs": rows,
    }
    OUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(rows)} epochs to {OUT}")


if __name__ == "__main__":
    main()
