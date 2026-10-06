import { SRGBColorSpace, TextureLoader, type Texture } from 'three';

/** A planet's global map (S5b) and what it is worth, said where it is used (Rules §7). Detail: textures/ASSETS.md. */
export interface PlanetMap {
  readonly url: string;
  /** The panel's one-line source. */
  readonly source: string;
  readonly note: string;
}

// Latitudes are where the bake (scripts/data/bake_planet_textures.py) found clean rows, run 2026-10-06.
const opal = (date: string, cover: string): string =>
  `NASA/ESA Hubble, OPAL programme (Simon et al., CC BY 4.0), ${date}: the OPAL team's three-filter colour, ` +
  `slightly contrast-enhanced. It covers ${cover}; the rest is filled flat with the nearest band's colour. ` +
  'The clouds have moved since, so no feature is where the map puts it today.';

/** Keyed by body id. Venus has none: see `NO_MAP_NOTE`. */
export const PLANET_MAPS: Readonly<Record<string, PlanetMap>> = {
  mercury: {
    url: '/textures/mercury-2048.jpg',
    source: 'MESSENGER MDIS',
    note:
      'MESSENGER global mosaic (NASA/JHU APL/Carnegie Institution, via USGS), its 750 nm filter alone, so grey. ' +
      'It covers 86.7° N to 87.1° S; small gaps are filled flat with their band’s colour.',
  },
  mars: {
    url: '/textures/mars-2048.jpg',
    source: 'Viking orbiters',
    note: 'Viking orbiter global mosaic, colourised (MDIM 2.1, NASA Ames, via USGS, 2009): pole to pole.',
  },
  jupiter: { url: '/textures/jupiter-3600.jpg', source: 'Hubble OPAL, Dec 2025', note: opal('11 December 2025', '82.5° N to 79.2° S') },
  saturn: {
    url: '/textures/saturn-1800.jpg',
    source: 'Hubble OPAL, Aug 2025',
    note: opal('29 August 2025', '77.1° N to 82.7° S, except a band from 2.1° S to 6.7° N that the rings hid'),
  },
  uranus: { url: '/textures/uranus-720.jpg', source: 'Hubble OPAL, Nov 2024', note: opal('9 November 2024', '89.8° N to 1.5° S') },
  neptune: { url: '/textures/neptune-720.jpg', source: 'Hubble OPAL, Aug 2025', note: opal('24–25 August 2025', '39.9° N to 89.8° S') },
};

export const NO_MAP_NOTE: Readonly<Record<string, string>> = {
  venus:
    'No visible-light global map exists: to the eye Venus is unbroken cloud, and Magellan’s global map is radar. ' +
    'Drawn in a flat colour.',
};

/** Said on screen with the other credits. */
export const PLANET_MAP_CREDIT =
  'Planet maps: NASA/USGS (MESSENGER, Viking); NASA/ESA Hubble OPAL (Simon et al., CC BY 4.0). ' +
  'Saturn’s rings: NASA/JPL/SSI Cassini colour, Cassini UVIS optical depth (PDS).';

/** Load one map. A failure leaves the planet in its flat colour, never broken. */
export function loadPlanetMap(url: string, anisotropy: number, onLoad: (texture: Texture) => void): void {
  new TextureLoader().load(
    url,
    (texture) => {
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = anisotropy;
      onLoad(texture);
    },
    undefined,
    () => console.warn(`[planets] map failed to load, drawing the flat colour: ${url}`),
  );
}
