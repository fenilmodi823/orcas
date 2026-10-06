"""Bake the planets' maps (S5b) from their published sources. Saturn's rings: bake_saturn_rings.py.

Each source is downloaded once into `data/textures-src/` (gitignored). Writes into
`frontend/public/textures/`, whose `ASSETS.md` records every source and step:

- `<planet>-<width>.jpg`: an equirectangular map, longitude -180 deg E at the left
  edge and increasing east, the same as the Earth's maps. Rows are uniform in the
  ellipsoid's parametric latitude, so a unit UV sphere scaled to the IAU radii
  (a, a, c) samples it exactly. Where a source has no data (black pixels, or rows
  too smeared to trust) the row is filled flat with the mean colour of the nearest
  clean rows: featureless, so nothing is drawn that was not measured.

Pillow comes with matplotlib in backend/uv.lock, so nothing new is installed.
Run from the repo root:  python scripts/data/bake_planet_textures.py
"""

from __future__ import annotations

import urllib.request
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None  # the Mars and Mercury mosaics are 2 x 10^8 pixels
SRC = Path("data/textures-src")
OUT = Path("frontend/public/textures")
OPAL = "https://archive.stsci.edu/missions/hlsp/opal/cycle32"
NO_DATA_MAX = 2  # a pixel whose channels are all at or below this is empty
ROUGH_FACTOR = 2.0  # a row is an edge artefact past this multiple of the map's median roughness
DARK_FACTOR = 0.5  # or below this fraction of its median brightness


@dataclass(frozen=True)
class MapSource:
    planet: str
    url: str
    width: int
    left_lon_e_deg: float  # east longitude at the source's left edge
    east_to_right: bool
    planetographic: bool  # else planetocentric
    a_km: float  # IAU 2015 equatorial and polar radii (pck00011)
    c_km: float
    channel: int | None = None  # keep one channel as grey
    crop_rough_rows: bool = False  # OPAL: trim the smeared rows at the edge of coverage


MAPS = [
    MapSource(
        "mercury",
        "https://planetarymaps.usgs.gov/mosaic/Mercury_MESSENGER_MDIS_Basemap_MD3Color_Mosaic_Global_665m.tif",
        2048,
        -180,
        True,
        False,
        2440.53,
        2438.26,
        channel=1,
    ),  # green = the 750 nm filter
    MapSource(
        "mars",
        "https://astrogeology.usgs.gov/ckan/dataset/7131d503-cdc9-45a5-8f83-5126c0fd397e/resource/"
        "5ea881c6-01b3-41fa-a7af-42d2131b54f1/download/mars_viking_mdim21_clrmosaic_1km.jpg",
        2048,
        -180,
        True,
        False,
        3396.19,
        3376.20,
    ),
    MapSource(
        "jupiter",
        f"{OPAL}/jupiter/hlsp_opal_hst_wfc3-uvis_jupiter-2025a_f395n-f502n-f631n_v1_globalmap.tif",
        3600,
        0,
        True,
        True,
        71492,
        66854,
        crop_rough_rows=True,
    ),
    MapSource(
        "saturn",
        f"{OPAL}/saturn/hlsp_opal_hst_wfc3-uvis_saturn-2025a_f395n-f502n-f631n_v1_globalmap.tif",
        1800,
        0,
        True,
        True,
        60268,
        54364,
        crop_rough_rows=True,
    ),
    MapSource(
        "uranus",
        f"{OPAL}/uranus/hlsp_opal_hst_wfc3-uvis_uranus-2024a_f657n-f547m-f467m_v1_globalmap.tif",
        720,
        360,
        False,
        True,
        25559,
        24973,
        crop_rough_rows=True,
    ),
    MapSource(
        "neptune",
        f"{OPAL}/neptune/hlsp_opal_hst_wfc3-uvis_neptune-2025b_f467m-f547m-f657n_v1_globalmap.tif",
        720,
        0,
        True,
        True,
        24764,
        24341,
        crop_rough_rows=True,
    ),
]


def fetch(url: str) -> Path:
    path = SRC / url.rsplit("/", 1)[-1]
    if not path.exists():
        SRC.mkdir(parents=True, exist_ok=True)
        print(f"downloading {url}")
        urllib.request.urlretrieve(url, path)
    return path


def load(src: MapSource) -> np.ndarray:
    """The source as float RGB, reduced to at most twice the output width first."""
    image = Image.open(fetch(src.url))
    image = image.reduce(max(1, image.width // (2 * src.width)))
    rgb = np.asarray(image.convert("RGB"), dtype=np.float32)
    if src.channel is not None:
        rgb = np.repeat(rgb[:, :, src.channel : src.channel + 1], 3, axis=2)
    if rgb.shape[1] % 2 == 1:  # OPAL's 721 columns repeat 0 deg at 360 deg
        rgb = rgb[:, :-1]
    return rgb


def bad_rows(rgb: np.ndarray, empty_px: np.ndarray) -> np.ndarray:
    """Rows that are mostly empty, rougher than ROUGH_FACTOR x the map's median row, or
    darker than DARK_FACTOR x it, grown by 2 deg either side: the smeared and limb-darkened
    edges of coverage, and the shaded rows beside Saturn's band behind its rings. Roughness
    is the mean step between neighbouring pixels that both hold data."""
    pairs = ~empty_px[:, 1:] & ~empty_px[:, :-1]
    counted = pairs.sum(axis=1) > 0.5 * pairs.shape[1]
    rough = (np.abs(np.diff(rgb, axis=1)).mean(axis=2) * pairs).sum(axis=1) / np.maximum(
        pairs.sum(axis=1), 1
    )
    level = (rgb.mean(axis=2) * ~empty_px).sum(axis=1) / np.maximum((~empty_px).sum(axis=1), 1)
    bad = (
        ~counted
        | (rough > ROUGH_FACTOR * np.median(rough[counted]))
        | (level < DARK_FACTOR * np.median(level[counted]))
    )
    grow = round(2 * len(bad) / 180)
    return np.convolve(bad, np.ones(2 * grow + 1), mode="same") > 0


def bake_map(src: MapSource) -> None:
    rgb = load(src)
    empty = rgb.max(axis=2) <= NO_DATA_MAX
    if src.crop_rough_rows:
        empty |= bad_rows(rgb, empty)[:, None]
    clean = np.flatnonzero(empty.mean(axis=1) < 0.5)
    mean = np.array([rgb[i][~empty[i]].mean(axis=0) for i in clean])
    rows = np.arange(len(rgb))
    fill = np.stack(
        [np.interp(rows, clean, mean[:, ch]) for ch in range(3)], axis=1
    )  # held flat past the last
    rgb = np.where(empty[:, :, None], fill[:, None, :], rgb)
    lat = lambda i: 90 - (i + 0.5) * 180 / len(rows)  # noqa: E731
    print(
        f"{src.planet}: clean rows from {lat(clean.min()):.1f} to {lat(clean.max()):.1f} deg, "
        f"{empty.mean() * 100:.1f} % of pixels filled"
    )

    w, h = src.width, src.width // 2
    small = np.asarray(
        Image.fromarray(rgb.clip(0, 255).astype(np.uint8)).resize((w, h), Image.LANCZOS), np.float32
    )
    beta = np.radians(90 - (np.arange(h) + 0.5) * 180 / h)  # output rows: parametric latitude
    k = src.a_km / src.c_km if src.planetographic else src.c_km / src.a_km
    phi = np.degrees(np.arctan2(k * np.sin(beta), np.cos(beta)))
    y = np.clip((90 - phi) / 180 * h - 0.5, 0, h - 1)
    lon_e = -180 + (np.arange(w) + 0.5) * 360 / w
    turn = (lon_e - src.left_lon_e_deg) if src.east_to_right else (src.left_lon_e_deg - lon_e)
    x = (turn / 360 % 1) * w - 0.5
    y0, x0 = np.floor(y).astype(int), np.floor(x).astype(int)
    fy, fx = (y - y0)[:, None, None], (x - x0)[None, :, None]
    y1, x1 = np.minimum(y0 + 1, h - 1), (x0 + 1) % w
    x0 %= w
    out = (1 - fy) * ((1 - fx) * small[y0][:, x0] + fx * small[y0][:, x1]) + fy * (
        (1 - fx) * small[y1][:, x0] + fx * small[y1][:, x1]
    )
    Image.fromarray(out.round().clip(0, 255).astype(np.uint8)).save(
        OUT / f"{src.planet}-{w}.jpg", quality=88
    )


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for src in MAPS:
        bake_map(src)


if __name__ == "__main__":
    main()
