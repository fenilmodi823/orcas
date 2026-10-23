# Texture sources and licences

Every file here is NASA imagery. NASA material is not protected by copyright in the
United States unless noted otherwise; NASA asks that it be credited and that its use not
imply endorsement. The scene's credit line names NASA for Earth and Moon imagery.

Fetched 2026-09-27. The credit wording on each source page is authoritative — re-read it
before quoting a producer's name anywhere public.

| File | Source (as downloaded) | What was done |
| --- | --- | --- |
| `earth-day-4096.jpg` | NASA Visible Earth, Blue Marble Next Generation with topography and bathymetry, December 2004 — `https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg` | Lanczos-resized 5400×2700 → 4096×2048, JPEG q88 |
| `earth-night-3600.jpg` | NASA Earth Observatory, Black Marble 2016 (Suomi NPP VIIRS) — `https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg` | Converted to greyscale, JPEG q90, size unchanged |
| `earth-clouds-2048.jpg` | NASA Visible Earth, Blue Marble clouds — `https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_2048.jpg` | Converted to greyscale, JPEG q90, size unchanged |
| `moon-2048.jpg` | NASA Scientific Visualization Studio, CGI Moon Kit (LRO LROC colour mosaic) — `https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_2k.tif` | TIFF → JPEG q88, size unchanged |

All four are equirectangular: longitude −180° at the left edge, 0° at the centre, north up.
The clouds are a composite from one period, not today's weather — the scene says so nowhere
yet, and must before clouds are presented as current.

## Planet maps and Saturn's rings (S5b, 2026-10-06)

Made by `scripts/data/bake_planet_textures.py` from the sources below, which it downloads into
`data/textures-src/` (gitignored). Re-run it to rebuild every file here from the same sources.
Fetched 2026-10-06.

Every map is equirectangular like the four above (−180° E at the left edge, east to the right, north
up), but its rows are uniform in the ellipsoid's *parametric* latitude, so the scene's unit sphere,
scaled to the IAU 2015 radii, samples it exactly. The bake converts each source's latitude
(planetographic for Hubble OPAL, planetocentric for USGS) and longitude convention to that. Where a
source has no data — black pixels, rows that are mostly empty, or rows whose pixel-to-pixel roughness
is over 2× the map's median row or whose brightness is under half of it, each grown by 2° — the row
is filled flat with the mean colour of the nearest clean rows. Nothing is drawn there that was not
measured. Latitudes below are the clean rows the bake reported.

| File | Source (as downloaded) | What was done |
| --- | --- | --- |
| `mercury-2048.jpg` | USGS Astrogeology, Mercury MESSENGER MDIS Basemap MD3 Color Global Mosaic 665 m (NASA/JHU APL/Carnegie Institution/ACT) — `https://planetarymaps.usgs.gov/mosaic/Mercury_MESSENGER_MDIS_Basemap_MD3Color_Mosaic_Global_665m.tif` | Green channel only, the 750 nm filter (red is 1000 nm, blue 430 nm), so grey. Planetocentric. Clean 86.7° N to 87.1° S; 4.7 % of pixels filled. JPEG q88 |
| `mars-2048.jpg` | USGS Astrogeology, Mars Viking Colorized Global Mosaic 232 m (MDIM 2.1, NASA Ames, 2009), the 1 km JPEG — `https://astrogeology.usgs.gov/ckan/dataset/7131d503-cdc9-45a5-8f83-5126c0fd397e/resource/5ea881c6-01b3-41fa-a7af-42d2131b54f1/download/mars_viking_mdim21_clrmosaic_1km.jpg` | Planetocentric, −180° E at the left. Nothing filled. JPEG q88 |
| `jupiter-3600.jpg` | NASA/ESA Hubble, OPAL (PI A. Simon), Cycle 32, rotation 2025a, F631N/F502N/F395N colour map, 11 December 2025 — `https://archive.stsci.edu/missions/hlsp/opal/cycle32/jupiter/hlsp_opal_hst_wfc3-uvis_jupiter-2025a_f395n-f502n-f631n_v1_globalmap.tif` | Planetographic, left edge 0° System III W, W decreasing to the right. Clean 82.5° N to 79.2° S; 10.1 % filled. JPEG q88 |
| `saturn-1800.jpg` | Hubble OPAL, Cycle 32, rotation 2025a, F631N/F502N/F395N, 29 August 2025 — `https://archive.stsci.edu/missions/hlsp/opal/cycle32/saturn/hlsp_opal_hst_wfc3-uvis_saturn-2025a_f395n-f502n-f631n_v1_globalmap.tif` | Planetographic, left edge 360° System III W, W decreasing to the right. Clean 77.1° N to 82.7° S, less 2.1° S to 6.7° N, which the edge-on rings hid; 16.1 % filled. Moons and their shadows cross the map (OPAL readme). JPEG q88 |
| `uranus-720.jpg` | Hubble OPAL, Cycle 32, rotation 2024a, F657N/F547M/F467M, 9 November 2024 — `https://archive.stsci.edu/missions/hlsp/opal/cycle32/uranus/hlsp_opal_hst_wfc3-uvis_uranus-2024a_f657n-f547m-f467m_v1_globalmap.tif` | Planetographic; right edge 0° E, E increasing to the left, placed as the readme states. Clean 89.8° N to 1.5° S; 49.0 % filled. The duplicated 360° column dropped; its half-pixel grid offset (0.25°) ignored. JPEG q88 |
| `neptune-720.jpg` | Hubble OPAL, Cycle 32, rotation 2025b, F657N/F547M/F467M, 24–25 August 2025 — `https://archive.stsci.edu/missions/hlsp/opal/cycle32/neptune/hlsp_opal_hst_wfc3-uvis_neptune-2025b_f467m-f547m-f657n_v1_globalmap.tif` | Planetographic, left edge 360° W, W decreasing to the right. Clean 39.9° N to 89.8° S; 27.7 % filled. Faint tips of the smeared edge survive just south of 39.9° N in a few longitudes: they are too narrow for the row test, and a per-pixel test would also remove real storms. Duplicated column and half-pixel offset as Uranus. JPEG q88 |
| `saturn-rings-transmission.png` | Cassini UVIS solar occultation, 2017-046 egress (Jarmak et al. 2022, *Icarus* 388, 115237; PDS bundle `cassini_uvis_solarocc_beckerjarmak2023`) — `https://pds-rings.seti.org/pds4/bundles/cassini_uvis_solarocc_beckerjarmak2023/cassini_uvis_solarocc_beckerjarmak2023_v1.0/data/uvis_euv_2017_046_solar_time_series_egress.tab` | 2048 × 1, 74,500 to 141,000 km (32.5 km a bin), from 8.4 km samples: the mean of exp(−τ), τ the normal optical depth, linear 8-bit. Measured at 57–117 nm; τ is taken as the same in visible light, which holds for the large particles of the main rings, not the dusty F and D rings. The B ring's core reads τ ≈ 3.2, the occultation's limit: opaque either way |
| `saturn-rings-albedo.png` | NASA/JPL/SSI Cassini, PIA11142 "A Full Sweep of Saturn's Rings", natural colour, 26 November 2008 — `https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia11/pia11142/PIA11142.tif` | The median of its 80 centre rows, in linear light, placed on the UVIS radius scale by piecewise-linear interpolation through ten features both show (C ring inner edge, Colombo and Maxwell gaps, B ring inner and outer edges, A ring inner edge, Encke and Keeler gaps, A ring outer edge, F ring): the mosaic's own scale runs 5.5 to 13.6 km/px. Divided by the single-scattering brightness at PIA11142's geometry (viewed 10° above the lit face; the Sun 3.97° above the rings, from DE421 and the IAU pole), scaled so the brightest bin is 1 (gain 3.5051), sRGB-encoded |

OPAL is licensed CC BY 4.0 and asks for this acknowledgement in any publication: "This work used data
acquired from the NASA/ESA HST Space Telescope, associated with OPAL program (PI: Simon, GO13937), and
archived by the Space Telescope Science Institute, which is operated by the Association of Universities
for Research in Astronomy, Inc., under NASA contract NAS 5-26555. All maps are available at
<http://dx.doi.org/10.17909/T9G593>." The colour maps are the OPAL team's own, "with slight contrast
enhancement" (Neptune: "some"); ORCAS does not regrade them. The giants' clouds move, so a map shows
them as they were on its date. Venus has no visible-light global map and is drawn in its flat colour.

## The major moons' maps (S6b2, 2026-10-22)

Made by `scripts/data/bake_moon_textures.py` from the sources below, which it downloads into
`data/textures-src/moons/` (gitignored). Fetched 2026-10-22; rebuilt from the same files 2026-10-23,
same coverage. Layout as the planets' maps: −180° E at the left edge, east to the right, north up,
rows uniform in the IAU 2015 triaxial ellipsoid's parametric latitude. USGS sources are placed from
their ISIS labels; the others by hand, as noted. Every map is greyscale, one visible-light filter
(B.29): where a colour version exists it is enhanced colour. Where a source has no data the pixel is
filled flat with the mean of the nearest clean rows. Latitudes are the rows the bake found at least
half measured. Each map was checked by eye against two IAU Gazetteer features per moon
(`data/textures-src/moons/checks/`, Mimas one).

| File | Source (as downloaded) | What was done |
| --- | --- | --- |
| `phobos-1024.jpg` | USGS Astrogeology, Phobos Viking Mosaic 40 ppd, DLR control — `https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Phobos_Viking_Mosaic_40ppd_DLRcontrol.tif` | Pole to pole; 0.0 % filled. Checked: Stickney, Hall |
| `io-2048.jpg` | USGS, Io Galileo SSI–Voyager Global Mosaic 1 km — `…/mosaic/Io_GalileoSSI-Voyager_Global_Mosaic_1km.tif` | Pole to pole; 0.0 % filled. Its `ClrMerge` version is enhanced (red 756 nm/green, blue violet/green). Checked: Loki Patera, Prometheus |
| `europa-2048.jpg` | USGS, Europa Voyager–Galileo SSI global mosaic 500 m — `…/mosaic/Europa_Voyager_GalileoSSI_global_mosaic_500m.tif` | 90.0° N to 82.7° S; 4.3 % filled. Checked: Pwyll, Tyre |
| `ganymede-2048.jpg` | USGS, Ganymede Voyager–Galileo SSI global mosaic 1 km — `…/mosaic/Ganymede_Voyager_GalileoSSI_global_mosaic_1km.tif` | 86.0° N to 89.9° S; 3.5 % filled. Checked: Osiris, Tros |
| `callisto-2048.jpg` | USGS, Callisto Voyager–Galileo SSI global mosaic 1 km — `…/mosaic/Callisto_Voyager_GalileoSSI_global_mosaic_1km.tif` | 89.8° N to 90.0° S; 3.8 % filled. Checked: Valhalla, Asgard |
| `mimas-1024.jpg` | NASA Photojournal PIA14926, “Map of Mimas, June 2012” (Cassini, Voyager filling gaps) — `https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia14/pia14926/PIA14926.tif` | No label: left edge set to −180° E by eye, Herschel (248.24° E) landing on its crater. Pole to pole. USGS's own Mimas maps are airbrushed |
| `enceladus-1024.jpg` | USGS, Enceladus Cassini mosaic global 110 m — `…/mosaic/Enceladus_Cassini_mosaic_global_110m.tif` | Not the `HPF` version, whose high-pass filter removes real brightness differences. Pole to pole. Checked: Ali Baba, Dunyazad |
| `tethys-1024.jpg` | USGS, Tethys Cassini mosaic global 293 m — `…/mosaic/Tethys_Cassini_mosaic_global_293m.tif` | Pole to pole. Checked: Odysseus, Penelope |
| `dione-1024.jpg` | USGS, Dione Cassini–Voyager mosaic global 154 m — `…/mosaic/Dione_Cassini_Voyager_mosaic_global_154m.tif` | Pole to pole; 0.1 % filled. Checked: Evander, Aeneas |
| `rhea-1024.jpg` | USGS, Rhea Cassini–Voyager mosaic global 417 m — `…/mosaic/Rhea_Cassini_Voyager_mosaic_global_417m.tif` | Pole to pole. Checked: Inktomi, Mamaldi |
| `iapetus-1024.jpg` | USGS, Iapetus Cassini–Voyager mosaic global 783 m — `…/mosaic/Iapetus_Cassini_Voyager_mosaic_global_783m.tif` | Pole to pole. Checked: Turgis, Engelier. ⚠️ Brightness is evened out between images for mapping: across the equator the leading half averages 86.5 and the trailing 111.4 (8-bit), so Cassini Regio is far darker in reality than here. The Cassini team's own map, PIA11116 (May 2008), measured 2026-10-23, is flattened the same way |
| `miranda-1024.jpg` | Voyager 2 mosaic (Caltech/JPL/USGS) as JPL's Solar System Simulator hosts it — `https://space.jpl.nasa.gov/tmaps/pix/ura5vuu2.tif` | No label: left edge −180° E, set by the check sheets (Umbriel's bright Wunda, 273.6° E, at 26 %). South pole to 11.4° S; 56.7 % filled. Checked: Elsinore and Arden Coronae |
| `ariel-1024.jpg` | As Miranda — `…/tmaps/pix/ura1vuu2.tif` | South pole to 12.4° S; 61.1 % filled. Checked: Yangoor, Kachina Chasmata |
| `umbriel-1024.jpg` | As Miranda — `…/tmaps/pix/ura2vuu2.tif` | South pole to 12.4° S; 58.7 % filled. Checked: Wunda, Vuver |
| `titania-1024.jpg` | As Miranda — `…/tmaps/pix/ura3vuu2.tif` | South pole to 17.1° S; 62.2 % filled. Checked: Gertrude, Ursula |
| `oberon-1024.jpg` | As Miranda — `…/tmaps/pix/ura4vuu2.tif` | South pole to 13.4° S; 61.0 % filled. Checked: Hamlet, Mommur Chasma |
| `triton-1024.jpg` | USGS, Triton Voyager 2 colour mosaic, global fill, 600 m — `…/mosaic/Triton_Voyager2_ClrMosaic_GlobalFill_600m.tif` | Its first band alone, the orange filter (the mosaic is orange, violet and ultraviolet, so enhanced). 13.3° N to the south pole; 38.5 % filled. Checked: Mazomba, Ruach Planitia |

Voyager 2 saw Uranus's moons in January 1986 with only their southern hemispheres lit. In 2026 the Sun
stands over their north (72.85° N on Ariel, 2026-08-14), so the lit face is the flat fill and the mapped
south is mostly on the night side. **Deimos** has no map: its only global map is an airbrushed drawing
from Viking images. **Titan** has none in visible light: it is drawn flat in `--titan`, #C09D3C, the
median of the inner half of its disc in NASA/JPL/Space Science Institute's natural-colour Cassini
composite PIA06230 — `https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia06/pia06230/PIA06230.tif`.
