# Assets and data sources

Every data file and image ORCAS ships, where it came from, and the credit or terms attached.
Each entry is taken from the notes already in the repository (linked in the last column); where
the repository records no source, the row says so.

Paths are under `frontend/public/` unless stated.

| Asset | What it is | Source | Terms / credit | Recorded in |
| --- | --- | --- | --- | --- |
| `textures/earth-day-4096.jpg` | Earth day map | NASA Visible Earth, Blue Marble Next Generation with topography and bathymetry, December 2004 | NASA imagery, credited; use must not imply endorsement. Credit line: "Earth and Moon imagery: NASA (Blue Marble, Black Marble, LRO)." | `textures/ASSETS.md`; `src/renderer/earth/earth-materials.ts:28` |
| `textures/earth-night-3600.jpg` | Earth night lights | NASA Earth Observatory, Black Marble 2016 (Suomi NPP VIIRS) | As above | `textures/ASSETS.md` |
| `textures/earth-clouds-2048.jpg` | Cloud layer | NASA Visible Earth, Blue Marble clouds | As above. A fixed composite, not current weather | `textures/ASSETS.md`; `earth-materials.ts:28` |
| `textures/moon-2048.jpg` | Moon map | NASA Scientific Visualization Studio, CGI Moon Kit (LRO LROC colour mosaic) | As above | `textures/ASSETS.md` |
| `textures/mercury-2048.jpg`, `mars-2048.jpg` | Planet maps | USGS Astrogeology: MESSENGER MDIS basemap (NASA/JHU APL/Carnegie Institution/ACT); Viking colourised global mosaic (MDIM 2.1, NASA Ames) | "Planet maps: NASA/USGS (MESSENGER, Viking)" | `textures/ASSETS.md`; `src/renderer/solar/planet-maps.ts:48` |
| `textures/jupiter-3600.jpg`, `saturn-1800.jpg`, `uranus-720.jpg`, `neptune-720.jpg` | Planet maps | NASA/ESA Hubble OPAL (PI A. Simon), Cycle 32 | CC BY 4.0, with OPAL's acknowledgement text (quoted in `textures/ASSETS.md`). Credit line: "NASA/ESA Hubble OPAL (Simon et al., CC BY 4.0)" | `textures/ASSETS.md`; `planet-maps.ts:48` |
| `textures/saturn-rings-transmission.png`, `saturn-rings-albedo.png` | Saturn's rings | Cassini UVIS solar occultation (Jarmak et al. 2022, *Icarus* 388, 115237; PDS); NASA/JPL/SSI Cassini PIA11142 | "Saturn's rings: NASA/JPL/SSI Cassini colour, Cassini UVIS optical depth (PDS)" | `textures/ASSETS.md`; `planet-maps.ts:48` |
| `textures/phobos-1024.jpg`, `io-2048.jpg`, `europa-2048.jpg`, `ganymede-2048.jpg`, `callisto-2048.jpg`, `enceladus-1024.jpg`, `tethys-1024.jpg`, `dione-1024.jpg`, `rhea-1024.jpg`, `iapetus-1024.jpg`, `triton-1024.jpg` | Moon maps | USGS Astrogeology mosaics (Viking, Voyager, Galileo, Cassini) | "Moon maps: NASA/JPL/USGS (Viking, Voyager, Galileo, Cassini)" | `textures/ASSETS.md`; `src/renderer/solar/moon-maps.ts:66` |
| `textures/mimas-1024.jpg` | Mimas map | NASA Photojournal PIA14926 | "Mimas: NASA PIA14926" | `textures/ASSETS.md`; `moon-maps.ts:66` |
| `textures/miranda-1024.jpg`, `ariel-1024.jpg`, `umbriel-1024.jpg`, `titania-1024.jpg`, `oberon-1024.jpg` | Uranus moon maps | Voyager 2 mosaics (Caltech/JPL/USGS) as hosted by JPL's Solar System Simulator | As the moon maps above | `textures/ASSETS.md`; `moon-maps.ts:66` |
| (none; drawn flat) | Titan's colour | NASA/JPL/Space Science Institute, Cassini PIA06230 | "Titan's haze colour: NASA/JPL/Space Science Institute PIA06230" | `textures/ASSETS.md`; `moon-maps.ts:66` |
| `sky/gaia-dr3-stars.bin` | Background star sky | ESA Gaia Data Release 3, `gaiadr3.gaia_source`, via the archive's TAP endpoint; built by `scripts/data/fetch_gaia_sky.py` | ESA's acknowledgement, shown in the UI: "ESA/Gaia/DPAC — Gaia Data Release 3. Processed by the Gaia Data Processing and Analysis Consortium." | `scripts/data/fetch_gaia_sky.py` docstring; `src/renderer/sky/star-sky.ts:19` |
| `ephemeris/planets-de421.bin` | Sun and planet positions | JPL planetary ephemeris DE421, baked by `scripts/data/bake_planets.py` | "Sun and planets: JPL DE421, interpolated to within 1″ ..." | `ephemeris/ASSETS.md`; `src/renderer/solar/planets.ts:68` |
| `ephemeris/horizons/*` (`spacecraft.bin`, `moons-*.bin`, `manifest.json`, `headers.txt`) | 25 spacecraft, 19 major moons, outer planets' centres | JPL Horizons web form, 194 requests exported 2026-10-06 UTC | NASA states no licence for Horizons; committed with attribution. Credit line: "JPL Horizons, exported 2026-10-06 UTC, static." | `ephemeris/horizons/README.md`; `src/renderer/solar/moons.ts:70` |
| `data/site/catalog.json.gz` (baked at refresh; at the repository root, not under `frontend/public/`) | Public site's catalogue | CelesTrak GP; Space-Track.org, via a local database | "Space-Track.org, courtesy of USSPACECOM (18th Space Defense Squadron), GP catalogue." Redistributed under USSPACECOM's blanket approval for basic SSA data (OMM records and SATCAT), conditioned on this citation | `data/site/NOTICE.txt`; `src/data/catalog-provenance.ts` (`SOURCE_CREDITS`) |
| `data/site/conjunctions/` (baked at refresh; same location) | Public site's close-approach screening | ORCAS screening analysis based on USSPACECOM data | "A screening result, not an operational warning." | `data/site/NOTICE.txt` |
| `brand/*` | ORCAS logo, icons and social card | ORCAS's own mark, traced from a reference image (`ORCAS Vault/02 - Design/Branding.md`) | licence not recorded in the repository | `ORCAS Vault/02 - Design/Branding.md` |

JPL Horizons paths are static exports; the NAIF/JPL email about their terms is deferred (Questions R3 A.4).
