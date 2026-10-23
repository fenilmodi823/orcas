"""Bake the major moons' maps (S6b2, B.29) from their published mosaics.

Each source is downloaded once into `data/textures-src/moons/` (gitignored). Writes into
`frontend/public/textures/` and records every source in its `ASSETS.md`:

- `<moon>-<width>.jpg`: greyscale, longitude -180 deg E at the left edge and increasing east, as
  the planets' maps. Rows are uniform in the triaxial ellipsoid's parametric latitude and columns
  in its parametric longitude, so a unit sphere scaled to the IAU radii (a, b, c) along the body
  axes samples the map exactly: the bake, not the shader, does the ellipsoid's maths.
- Where a source has no data, the pixel is filled flat with the mean of the nearest clean rows
  (S5b's rule): featureless, so nothing is drawn that was not measured.

Every USGS source carries an ISIS label; the left edge's east longitude is read from it as the
centre longitude plus the upper-left corner's projected x over the radius (x grows eastward).
Each map is then checked by eye: `data/textures-src/moons/checks/<moon>.png` draws a cross at
IAU Gazetteer features' coordinates (planetocentric, east) on the baked map.

Titan and Deimos are not baked: Titan's haze hides its surface in visible light and Deimos has
no photomosaic (B.29). Titan's flat colour is measured here from PIA06230, Cassini's natural-
colour composite, and printed for `tokens.css`.

Pillow comes with matplotlib in backend/uv.lock, so nothing new is installed.
Run from the repo root:  python scripts/data/bake_moon_textures.py
"""

from __future__ import annotations

import math
import re
import urllib.request
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

Image.MAX_IMAGE_PIXELS = None  # Dione's mosaic is 2.7 x 10^8 pixels
SRC = Path("data/textures-src/moons")
OUT = Path("frontend/public/textures")
USGS = "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic"
JPL = "https://space.jpl.nasa.gov/tmaps/pix"
PHOTOJOURNAL = "https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia"
NO_DATA_MAX = 2  # a pixel at or below this is empty


@dataclass(frozen=True)
class MoonMap:
    moon: str  # body id
    url: str
    width: int  # output width; height is half
    radii_km: tuple[float, float, float]  # IAU 2015 a >= b >= c (pck00011)
    checks: tuple[tuple[str, float, float], ...]  # Gazetteer: name, planetocentric lat, east lon
    left_lon_e_deg: float | None = None  # None: read from the source's ISIS label
    band: int | None = None  # keep one band of a colour source as grey


MAPS = [
    MoonMap(
        "phobos",
        f"{USGS}/Phobos_Viking_Mosaic_40ppd_DLRcontrol.tif",
        1024,
        (13.0, 11.4, 9.1),
        (("Stickney", 1.0, 311.0), ("Hall", -80.0, 150.0)),
    ),
    MoonMap(
        "io",
        f"{USGS}/Io_GalileoSSI-Voyager_Global_Mosaic_1km.tif",
        2048,
        (1829.4, 1819.4, 1815.7),
        (("Loki Patera", 13.0083, 51.2136), ("Prometheus", -1.5244, 206.061)),
    ),
    MoonMap(
        "europa",
        f"{USGS}/Europa_Voyager_GalileoSSI_global_mosaic_500m.tif",
        2048,
        (1562.6, 1560.3, 1559.5),
        (("Pwyll", -25.2, 88.6), ("Tyre", 33.6, 213.4)),
    ),
    MoonMap(
        "ganymede",
        f"{USGS}/Ganymede_Voyager_GalileoSSI_global_mosaic_1km.tif",
        2048,
        (2631.2, 2631.2, 2631.2),
        (("Osiris", -38.0006, 193.6917), ("Tros", 11.1418, 332.7368)),
    ),
    MoonMap(
        "callisto",
        f"{USGS}/Callisto_Voyager_GalileoSSI_global_mosaic_1km.tif",
        2048,
        (2410.3, 2410.3, 2410.3),
        (("Valhalla", 14.7, 304.0), ("Asgard", 32.2, 220.1)),
    ),
    MoonMap(
        "mimas",
        f"{PHOTOJOURNAL}/pia14/pia14926/PIA14926.tif",
        1024,
        (207.8, 196.7, 190.6),
        (("Herschel", -1.38, 248.24),),
        # PIA14926 has no label: Herschel (248.24 deg E) lands at 19 %, as the check sheet shows
        left_lon_e_deg=-180.0,
    ),
    MoonMap(
        "enceladus",
        f"{USGS}/Enceladus_Cassini_mosaic_global_110m.tif",
        1024,
        (256.6, 251.4, 248.3),
        (("Ali Baba", 56.8353, 342.4852), ("Dunyazad", 41.5132, 157.9627)),
    ),
    MoonMap(
        "tethys",
        f"{USGS}/Tethys_Cassini_mosaic_global_293m.tif",
        1024,
        (538.4, 528.3, 526.3),
        (("Odysseus", 32.82, 231.11), ("Penelope", -10.83, 110.78)),
    ),
    MoonMap(
        "dione",
        f"{USGS}/Dione_Cassini_Voyager_mosaic_global_154m.tif",
        1024,
        (563.4, 561.3, 559.6),
        (("Evander", -57.0, 215.0), ("Aeneas", 25.89, 313.73)),
    ),
    MoonMap(
        "rhea",
        f"{USGS}/Rhea_Cassini_Voyager_mosaic_global_417m.tif",
        1024,
        (765.0, 763.1, 762.4),
        (("Inktomi", -14.1, 247.9), ("Mamaldi", 14.0, 176.0)),
    ),
    MoonMap(
        "iapetus",
        f"{USGS}/Iapetus_Cassini_Voyager_mosaic_global_783m.tif",
        1024,
        (745.7, 745.7, 712.1),
        (("Turgis", 16.9, 331.6), ("Engelier", -40.5, 95.3)),
    ),
    MoonMap(
        "miranda",
        f"{JPL}/ura5vuu2.tif",
        1024,
        (240.4, 234.2, 232.9),
        (("Elsinore Corona", -24.8, 257.1), ("Arden Corona", -29.1, 73.7)),
        left_lon_e_deg=-180.0,  # JPL's maps: Umbriel's bright Wunda (273.6 deg E) lands at 26 %
    ),
    MoonMap(
        "ariel",
        f"{JPL}/ura1vuu2.tif",
        1024,
        (581.1, 577.9, 577.7),
        (("Yangoor", -68.7, 279.7), ("Kachina Chasmata", -33.7, 246.0)),
        left_lon_e_deg=-180.0,
    ),
    MoonMap(
        "umbriel",
        f"{JPL}/ura2vuu2.tif",
        1024,
        (584.7, 584.7, 584.7),
        (("Wunda", -7.9, 273.6), ("Vuver", -4.7, 311.6)),
        left_lon_e_deg=-180.0,
    ),
    MoonMap(
        "titania",
        f"{JPL}/ura3vuu2.tif",
        1024,
        (788.9, 788.9, 788.9),
        (("Gertrude", -15.8, 287.1), ("Ursula", -12.4, 45.2)),
        left_lon_e_deg=-180.0,
    ),
    MoonMap(
        "oberon",
        f"{JPL}/ura4vuu2.tif",
        1024,
        (761.4, 761.4, 761.4),
        (("Hamlet", -46.1, 44.4), ("Mommur Chasma", -16.3, 323.5)),
        left_lon_e_deg=-180.0,
    ),
    MoonMap(
        "triton",
        f"{USGS}/Triton_Voyager2_ClrMosaic_GlobalFill_600m.tif",
        1024,
        (1352.6, 1352.6, 1352.6),
        (("Mazomba", -18.5, 63.5), ("Ruach Planitia", 28.0, 24.0)),
        band=0,  # the orange filter (Smith et al. 1989): the colour mosaic is orange/violet/UV
    ),
]


def fetch(url: str) -> Path:
    path = SRC / url.rsplit("/", 1)[-1]
    if not path.exists():
        SRC.mkdir(parents=True, exist_ok=True)
        print(f"downloading {url}")
        urllib.request.urlretrieve(url, path)
    return path


def label_left_lon_e(tif: Path) -> float:
    """The source's left edge, east longitude, from its ISIS label (x grows eastward)."""
    text = tif.with_suffix(".lbl").read_text(encoding="utf8", errors="replace")
    num = lambda key: float(re.search(rf"\b{key}\s*=\s*([-0-9.Ee+]+)", text).group(1))  # noqa: E731
    east = re.search(r"LongitudeDirection\s*=\s*(\w+)", text).group(1) == "PositiveEast"
    centre = num("CenterLongitude") * (1 if east else -1)
    return centre + math.degrees(num("UpperLeftCornerX") / num("EquatorialRadius"))


def load(src: MoonMap) -> np.ndarray:
    """The source as float grey, reduced to at most twice the output width first."""
    path = fetch(src.url)
    if "asc-pds-services" in src.url and not path.with_suffix(".lbl").exists():
        urllib.request.urlretrieve(
            src.url.replace(".tif", ".lbl"), path.with_suffix(".lbl")
        )
    image = Image.open(path)
    image = image.reduce(max(1, image.width // (2 * src.width)))
    if src.band is not None:
        image = image.getchannel(src.band)
    return np.asarray(image.convert("L"), dtype=np.float32)


def fill_empty(grey: np.ndarray, moon: str) -> np.ndarray:
    """S5b's rule: empty pixels take the mean of the nearest clean rows, held flat past the last."""
    empty = grey <= NO_DATA_MAX
    clean = np.flatnonzero(empty.mean(axis=1) < 0.5)
    mean = np.array([grey[i][~empty[i]].mean() for i in clean])
    fill = np.interp(np.arange(len(grey)), clean, mean)
    lat = lambda i: 90 - (i + 0.5) * 180 / len(grey)  # noqa: E731
    print(
        f"{moon}: clean rows from {lat(clean.min()):.1f} to {lat(clean.max()):.1f} deg, "
        f"{empty.mean() * 100:.1f} % of pixels filled"
    )
    return np.where(empty, fill[:, None], grey)


def planetocentric(
    w: int, radii: tuple[float, float, float]
) -> tuple[np.ndarray, np.ndarray]:
    """For each output pixel, the planetocentric latitude and east longitude, degrees, of the
    ellipsoid point at its parametric latitude (rows) and longitude (columns)."""
    a, b, c = radii
    h = w // 2
    beta = np.radians(90 - (np.arange(h) + 0.5) * 180 / h)[:, None]
    lam = np.radians(-180 + (np.arange(w) + 0.5) * 360 / w)[None, :]
    x, y, z = (
        a * np.cos(beta) * np.cos(lam),
        b * np.cos(beta) * np.sin(lam),
        c * np.sin(beta),
    )
    return np.degrees(np.arctan2(z, np.hypot(x, y))), np.degrees(np.arctan2(y, x))


def parametric_px(lat: float, lon_e: float, w: int, radii: tuple[float, float, float]):
    """The output pixel of a planetocentric point: the inverse of `planetocentric`."""
    a, b, c = radii
    phi, lam = math.radians(lat), math.radians(lon_e)
    d = (
        math.cos(phi) * math.cos(lam) / a,
        math.cos(phi) * math.sin(lam) / b,
        math.sin(phi) / c,
    )
    n = math.sqrt(sum(v * v for v in d))
    beta, lam_p = math.asin(d[2] / n), math.atan2(d[1], d[0])
    return ((math.degrees(lam_p) + 180) / 360 * w) % w, (
        90 - math.degrees(beta)
    ) / 180 * (w // 2)


def bake_map(src: MoonMap) -> None:
    grey = fill_empty(load(src), src.moon)
    left = (
        src.left_lon_e_deg
        if src.left_lon_e_deg is not None
        else label_left_lon_e(fetch(src.url))
    )
    hs, ws = grey.shape
    lat, lon = planetocentric(src.width, src.radii_km)
    y = np.clip((90 - lat) / 180 * hs - 0.5, 0, hs - 1)
    x = ((lon - left) / 360 % 1) * ws - 0.5
    y0, x0 = np.floor(y).astype(int), np.floor(x).astype(int)
    fy, fx = y - y0, x - x0
    y1, x1 = np.minimum(y0 + 1, hs - 1), (x0 + 1) % ws
    x0 %= ws
    out = (1 - fy) * ((1 - fx) * grey[y0, x0] + fx * grey[y0, x1]) + fy * (
        (1 - fx) * grey[y1, x0] + fx * grey[y1, x1]
    )
    image = Image.fromarray(out.round().clip(0, 255).astype(np.uint8), "L")
    image.save(OUT / f"{src.moon}-{src.width}.jpg", quality=88)
    check_sheet(image, src)


def check_sheet(image: Image.Image, src: MoonMap) -> None:
    """The baked map at 1024 px with a cross at each Gazetteer feature, to check by eye."""
    sheet = image.convert("RGB").resize((1024, 512))
    draw = ImageDraw.Draw(sheet)
    for name, lat, lon in src.checks:
        px, py = parametric_px(lat, lon, 1024, src.radii_km)
        draw.line([(px - 14, py), (px + 14, py)], fill=(255, 40, 40), width=2)
        draw.line([(px, py - 14), (px, py + 14)], fill=(255, 40, 40), width=2)
        draw.text((px + 8, py + 6), name, fill=(255, 220, 0))
    (SRC / "checks").mkdir(parents=True, exist_ok=True)
    sheet.save(SRC / "checks" / f"{src.moon}.png")


def titan_haze_colour() -> str:
    """The median colour of the middle of Titan's disc in PIA06230 (natural colour), as hex."""
    rgb = np.asarray(
        Image.open(
            fetch(f"{PHOTOJOURNAL}/pia06/pia06230/PIA06230.tif")
        ).convert("RGB")
    )
    lit = rgb.max(axis=2) > 40
    ys, xs = np.nonzero(lit)
    cy, cx, r = ys.mean(), xs.mean(), math.sqrt(lit.sum() / math.pi)
    yy, xx = np.ogrid[: rgb.shape[0], : rgb.shape[1]]
    core = lit & ((yy - cy) ** 2 + (xx - cx) ** 2 < (0.5 * r) ** 2)
    med = np.median(rgb[core], axis=0).round().astype(int)
    return "#{:02X}{:02X}{:02X}".format(*med)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for src in MAPS:
        bake_map(src)
    print(
        f"titan haze colour (PIA06230, median of the inner half of the disc): {titan_haze_colour()}"
    )


if __name__ == "__main__":
    main()
