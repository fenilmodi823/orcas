"""Bake Saturn's rings (S5b) into two radial profiles, from Cassini's own measurements.

Writes into `frontend/public/textures/` (sources and steps in its `ASSETS.md`):

- `saturn-rings-transmission.png`: 2048 x 1, RING_INNER_KM to RING_OUTER_KM, exp(-tau) at
  normal incidence, linear, from a Cassini UVIS solar occultation.
- `saturn-rings-albedo.png`: PIA11142's natural colour on the same radius scale, divided by
  the single-scattering brightness at the geometry Cassini saw it from, in linear light,
  scaled so its brightest bin is 1; the printed gain restores it (`saturn-rings.ts`).

Run from the repo root, after or without bake_planet_textures.py:
  python scripts/data/bake_saturn_rings.py
"""

from __future__ import annotations

from datetime import UTC, datetime

import numpy as np
from bake_planet_textures import OUT, fetch
from de421_reference import J2000_TT, KERNEL, TT_MINUS_UTC_S, read_segments
from PIL import Image

RING_INNER_KM, RING_OUTER_KM, RING_BINS = 74_500.0, 141_000.0, 2048
UVIS_URL = (
    "https://pds-rings.seti.org/pds4/bundles/cassini_uvis_solarocc_beckerjarmak2023/"
    "cassini_uvis_solarocc_beckerjarmak2023_v1.0/data/uvis_euv_2017_046_solar_time_series_egress.tab"
)
PIA_URL = "https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia11/pia11142/PIA11142.tif"
PIA_UTC = datetime(2008, 11, 26, 12, tzinfo=UTC)  # "November 26, 2008", over about four hours
PIA_VIEW_ELEVATION_DEG = 10.0  # "10 degrees below the illuminated side of the rings"
# PIA11142 column (centre rows) -> ring radius, km, at features both profiles show, measured
# from them on 2026-10-06: C ring inner edge, Colombo gap, Maxwell gap, B ring inner and outer
# edges, A ring inner edge, Encke gap, Keeler gap, A ring outer edge, F ring. The mosaic's
# scale is not uniform (5.5 to 13.6 km/px), so it is placed piece by piece between them.
PIA_TIES = [
    (1113, 74824.6),
    (1680, 77670.3),
    (3318, 87868.3),
    (3785, 92076.6),
    (8102, 117244.5),
    (8479, 121909.2),
    (10576, 133469.0),
    (11022, 136696.5),
    (11062, 136914.9),
    (11634, 140668.4),
]
SATURN_POLE = (40.589, -0.036, 83.537, -0.004)  # pck00011 BODY699_POLE_RA/DEC: deg, deg per century


def sun_elevation_on_rings_deg(at: datetime) -> float:
    """The Sun's elevation over Saturn's ring plane (its IAU equator), from DE421. Output: deg."""
    seg = read_segments(KERNEL)
    et = (at - J2000_TT).total_seconds() + TT_MINUS_UTC_S
    to_sun = seg[(10, 0)].position_km(et) - seg[(6, 0)].position_km(et)
    t = et / 86_400 / 36525
    ra, dec = (
        np.radians(SATURN_POLE[0] + SATURN_POLE[1] * t),
        np.radians(SATURN_POLE[2] + SATURN_POLE[3] * t),
    )
    pole = np.array([np.cos(dec) * np.cos(ra), np.cos(dec) * np.sin(ra), np.sin(dec)])
    return float(np.degrees(np.arcsin(pole @ to_sun / np.linalg.norm(to_sun))))


def bake_rings() -> None:
    edges = np.linspace(RING_INNER_KM, RING_OUTER_KM, RING_BINS + 1)
    table = np.genfromtxt(fetch(UVIS_URL), delimiter=",")
    r_km, tau = table[:, 6], table[:, 21]
    ok = np.isfinite(r_km) & np.isfinite(tau) & (tau > -1000)
    trans = np.exp(-np.clip(tau[ok], 0, None))
    which = np.digitize(r_km[ok], edges) - 1
    t_bin = np.array(
        [trans[which == i].mean() if (which == i).any() else np.nan for i in range(RING_BINS)]
    )
    t_bin = np.interp(
        np.arange(RING_BINS), np.flatnonzero(~np.isnan(t_bin)), t_bin[~np.isnan(t_bin)]
    )

    pia = np.asarray(Image.open(fetch(PIA_URL)).convert("RGB"), dtype=np.float32)
    mid = pia.shape[0] // 2
    strip = np.median(pia[mid - 40 : mid + 40], axis=0) / 255
    linear = np.where(strip <= 0.04045, strip / 12.92, ((strip + 0.055) / 1.055) ** 2.4)
    cols = np.arange(PIA_TIES[0][0], PIA_TIES[-1][0] + 1)
    radius = np.interp(cols, *zip(*PIA_TIES, strict=True))
    which = np.digitize(radius, edges) - 1
    seen = np.array(
        [
            linear[cols[which == i]].mean(axis=0) if (which == i).any() else [0, 0, 0]
            for i in range(RING_BINS)
        ]
    )

    mu0 = np.sin(np.radians(abs(sun_elevation_on_rings_deg(PIA_UTC))))
    mu = np.sin(np.radians(PIA_VIEW_ELEVATION_DEG))
    tau_bin = -np.log(np.clip(t_bin, 1e-4, 1))
    lit = (
        mu0 / (mu + mu0) * (1 - np.exp(-tau_bin * (1 / mu + 1 / mu0)))
    )  # single scattering, lit side
    albedo = np.where(lit[:, None] > 0.05, seen / np.maximum(lit, 1e-6)[:, None], 0)
    gain = albedo.max()
    encoded = albedo / gain
    encoded = np.where(encoded <= 0.0031308, encoded * 12.92, 1.055 * encoded ** (1 / 2.4) - 0.055)
    Image.fromarray((encoded * 255).round().clip(0, 255).astype(np.uint8)[None]).save(
        OUT / "saturn-rings-albedo.png"
    )
    Image.fromarray((t_bin * 255).round().clip(0, 255).astype(np.uint8)[None]).save(
        OUT / "saturn-rings-transmission.png"
    )
    print(
        f"rings: Sun {np.degrees(np.arcsin(mu0)):.2f} deg over the rings at PIA11142's epoch; "
        f"albedo gain {gain:.4f}; transmission {t_bin.min():.3f} to {t_bin.max():.3f}"
    )


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    bake_rings()
