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
