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
