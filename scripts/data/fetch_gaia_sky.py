"""Fetch a real all-sky star set from the ESA Gaia DR3 archive and pack it
for the frontend's background sky.

Source
------
ESA Gaia Data Release 3, table ``gaiadr3.gaia_source``, queried live over the
archive's public TAP/ADQL endpoint:

    https://gea.esac.esa.int/tap-server/tap/sync

Release page: https://www.cosmos.esa.int/web/gaia/dr3

Every value written by this script is a value the archive returned. Nothing
here is generated, modelled, interpolated or invented — the only
transformations are a unit change (degrees to radians is done on the client)
and the quantisation documented under "Format" below, whose error bounds are
stated exactly.

Acknowledgement required by ESA's data policy, reproduced in the frontend and
in the README::

    This work has made use of data from the European Space Agency (ESA)
    mission Gaia (https://www.cosmos.esa.int/gaia), processed by the Gaia
    Data Processing and Analysis Consortium (DPAC,
    https://www.cosmos.esa.int/web/gaia/dpac/consortium).

Known limits of the data, stated so nobody has to rediscover them
-----------------------------------------------------------------
1. **The bright end is incomplete.** Gaia saturates around G = 3, and the
   very brightest naked-eye stars are either missing or carry degraded
   photometry. This is a property of the mission, not of this script. A sky
   built from Gaia alone is missing some of the stars a person would name
   first.
2. **``bp_rp`` is null for some sources.** Those are written with the colour
   sentinel and rendered neutral rather than dropped — dropping them would
   bias the sky against the reddest and faintest objects.
3. **Frame.** Positions are ICRS, which agrees with J2000 to well under a
   milliarcsecond. ORCAS propagates satellites in TEME; TEME and J2000
   differ by precession and nutation, currently uncorrected. See
   ``star-sky.ts`` for what that means on screen.

Format (little-endian, ``.bin``)
--------------------------------
Header, 28 bytes::

    magic      8s   b"ORCASKY1"
    count      u32  number of stars
    mag_min    f32  brightest phot_g_mean_mag in the set
    mag_max    f32  faintest phot_g_mean_mag in the set (the cut)
    colour_min f32  bp_rp mapped to byte 0
    colour_max f32  bp_rp mapped to byte 254

Then ``count`` records of 10 bytes::

    ra    f32  degrees, ICRS, as returned
    dec   f32  degrees, ICRS, as returned
    mag   u8   phot_g_mean_mag quantised over [mag_min, mag_max]
    col   u8   bp_rp quantised over [colour_min, colour_max]; 255 = null

Quantisation error, exactly:

* ``ra``/``dec`` in float32 degrees resolve to ~2e-5 deg = **0.08 arcsec**.
  One pixel at this app's widest view is ~126 arcsec, so the stored position
  is over a thousand times finer than a pixel.
* ``mag`` resolves to (mag_max - mag_min) / 254, about **0.05 mag** for the
  default cut. It drives point size and alpha only.
* ``col`` resolves to about **0.02 mag** in BP-RP. It drives hue only.

Usage
-----
    python scripts/data/fetch_gaia_sky.py --max-g 9.0
    python scripts/data/fetch_gaia_sky.py --max-g 10.5 --out some/other.bin
"""

from __future__ import annotations

import argparse
import csv
import io
import struct
import sys
import urllib.parse
import urllib.request
from pathlib import Path

TAP_SYNC_URL = "https://gea.esac.esa.int/tap-server/tap/sync"
MAGIC = b"ORCASKY1"
COLOUR_NULL = 255
DEFAULT_OUT = Path("frontend/public/sky/gaia-dr3-stars.bin")

# BP-RP quantisation window. Chosen to cover the physical range of stellar
# colour indices rather than the extremes of the query result, so the byte
# scale means the same thing whatever magnitude cut is used. Sources outside
# it are clamped, not dropped.
COLOUR_MIN = -0.6
COLOUR_MAX = 5.0


def build_query(max_g: float) -> str:
    """The ADQL sent to the archive. Kept in one place so the exact selection
    is auditable — this string IS the provenance of the shipped file."""
    return (
        "SELECT ra, dec, phot_g_mean_mag, bp_rp "
        "FROM gaiadr3.gaia_source "
        f"WHERE phot_g_mean_mag < {max_g}"
    )


def fetch_csv(max_g: float, max_rows: int, timeout_s: int) -> str:
    params = {
        "REQUEST": "doQuery",
        "LANG": "ADQL",
        "FORMAT": "csv",
        "MAXREC": str(max_rows),
        "QUERY": build_query(max_g),
    }
    url = f"{TAP_SYNC_URL}?{urllib.parse.urlencode(params)}"
    print(f"querying Gaia DR3 for phot_g_mean_mag < {max_g} ...", file=sys.stderr)
    with urllib.request.urlopen(url, timeout=timeout_s) as response:  # noqa: S310 - fixed ESA host
        if response.status != 200:
            raise RuntimeError(f"Gaia archive returned HTTP {response.status}")
        return response.read().decode("utf-8")


def pack(csv_text: str, out_path: Path) -> int:
    """Pack the archive's CSV into the binary the frontend loads.

    Rows with an unparseable ra/dec/magnitude are skipped and counted rather
    than guessed at — a star whose position we cannot read is not a star we
    may place.
    """
    reader = csv.DictReader(io.StringIO(csv_text))
    rows: list[tuple[float, float, float, float | None]] = []
    skipped = 0

    for row in reader:
        try:
            ra = float(row["ra"])
            dec = float(row["dec"])
            mag = float(row["phot_g_mean_mag"])
        except (KeyError, TypeError, ValueError):
            skipped += 1
            continue
        raw_colour = (row.get("bp_rp") or "").strip()
        try:
            colour: float | None = float(raw_colour) if raw_colour else None
        except ValueError:
            colour = None
        rows.append((ra, dec, mag, colour))

    if not rows:
        raise RuntimeError("Gaia archive returned no usable rows")

    mag_min = min(r[2] for r in rows)
    mag_max = max(r[2] for r in rows)
    mag_span = (mag_max - mag_min) or 1.0
    colour_span = COLOUR_MAX - COLOUR_MIN

    buffer = bytearray()
    buffer += struct.pack(
        "<8sIffff", MAGIC, len(rows), mag_min, mag_max, COLOUR_MIN, COLOUR_MAX
    )
    for ra, dec, mag, colour in rows:
        mag_byte = round((mag - mag_min) / mag_span * 254)
        if colour is None:
            colour_byte = COLOUR_NULL
        else:
            clamped = min(max(colour, COLOUR_MIN), COLOUR_MAX)
            colour_byte = round((clamped - COLOUR_MIN) / colour_span * 254)
        buffer += struct.pack("<ffBB", ra, dec, mag_byte, colour_byte)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(buffer)

    print(
        f"wrote {len(rows):,} stars to {out_path} "
        f"({len(buffer) / 1_048_576:.2f} MiB), G {mag_min:.3f}..{mag_max:.3f}"
        + (f", skipped {skipped} unreadable rows" if skipped else ""),
        file=sys.stderr,
    )
    return len(rows)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--max-g",
        type=float,
        default=9.0,
        help="phot_g_mean_mag cut. 8 -> ~63k stars, 9 -> ~177k, 10 -> ~482k.",
    )
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--max-rows", type=int, default=2_000_000)
    parser.add_argument("--timeout", type=int, default=900)
    args = parser.parse_args()

    pack(fetch_csv(args.max_g, args.max_rows, args.timeout), args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
