import type { PlanetMap } from './planet-maps.js';

// Coverage is where the bake (scripts/data/bake_moon_textures.py, run 2026-10-23) found rows at least half
// measured; every map is greyscale, one visible-light filter (B.29). Detail: textures/ASSETS.md.
const usgs = (mosaic: string, cover: string): string =>
  `${mosaic} (via USGS Astrogeology), greyscale. It covers ${cover}; gaps are filled flat with their band’s mean.`;
const voyagerUranus = (cover: string): string =>
  'Voyager 2 mosaic (NASA/JPL/USGS, as JPL’s Solar System Simulator hosts it), greyscale. Voyager saw only the ' +
  `southern hemisphere in January 1986: data from the south pole to ${cover} at most longitudes. ` +
  'The north is filled flat, featureless: southern hemisphere only.';

/** Keyed by body id. Deimos and Titan have none: see `MOON_NO_MAP_NOTE`. */
export const MOON_MAPS: Readonly<Record<string, PlanetMap>> = {
  phobos: { url: '/textures/phobos-1024.jpg', source: 'Viking orbiters', note: usgs('Viking orbiter mosaic, DLR control network', 'pole to pole') },
  io: {
    url: '/textures/io-2048.jpg',
    source: 'Galileo SSI, Voyager',
    note: usgs('Galileo SSI and Voyager global mosaic', 'pole to pole') + ' Its colour version is enhanced: red is 756 nm over green, blue violet over green.',
  },
  europa: { url: '/textures/europa-2048.jpg', source: 'Voyager, Galileo SSI', note: usgs('Voyager and Galileo SSI global mosaic', '90.0° N to 82.7° S') },
  ganymede: {
    url: '/textures/ganymede-2048.jpg',
    source: 'Voyager, Galileo SSI',
    note: usgs('Voyager and Galileo SSI global mosaic', '86.0° N to 89.9° S') + ' Its colour version is enhanced.',
  },
  callisto: { url: '/textures/callisto-2048.jpg', source: 'Voyager, Galileo SSI', note: usgs('Voyager and Galileo SSI global mosaic', '89.8° N to 90.0° S') },
  mimas: {
    url: '/textures/mimas-1024.jpg',
    source: 'Cassini, Voyager (PIA14926)',
    note: 'NASA Photojournal PIA14926, “Map of Mimas, June 2012”: Cassini, with Voyager filling the gaps. Pole to pole.',
  },
  enceladus: { url: '/textures/enceladus-1024.jpg', source: 'Cassini ISS', note: usgs('Cassini global mosaic', 'pole to pole') },
  tethys: { url: '/textures/tethys-1024.jpg', source: 'Cassini ISS', note: usgs('Cassini global mosaic', 'pole to pole') },
  dione: { url: '/textures/dione-1024.jpg', source: 'Cassini ISS, Voyager', note: usgs('Cassini and Voyager global mosaic', 'pole to pole') },
  rhea: { url: '/textures/rhea-1024.jpg', source: 'Cassini ISS, Voyager', note: usgs('Cassini and Voyager global mosaic', 'pole to pole') },
  iapetus: {
    url: '/textures/iapetus-1024.jpg',
    source: 'Cassini ISS, Voyager',
    note: usgs('Cassini and Voyager global mosaic', 'pole to pole') + ' Its brightness is evened out between images for mapping, as in the Cassini team’s own map (PIA11116), so ' +
      'the dark leading half is far darker than it looks here.',
  },
  miranda: { url: '/textures/miranda-1024.jpg', source: 'Voyager 2', note: voyagerUranus('11.4° S') },
  ariel: { url: '/textures/ariel-1024.jpg', source: 'Voyager 2', note: voyagerUranus('12.4° S') },
  umbriel: { url: '/textures/umbriel-1024.jpg', source: 'Voyager 2', note: voyagerUranus('12.4° S') },
  titania: { url: '/textures/titania-1024.jpg', source: 'Voyager 2', note: voyagerUranus('17.1° S') },
  oberon: { url: '/textures/oberon-1024.jpg', source: 'Voyager 2', note: voyagerUranus('13.4° S') },
  triton: {
    url: '/textures/triton-1024.jpg',
    source: 'Voyager 2',
    note:
      'Voyager 2 global colour mosaic (via USGS Astrogeology), its orange filter alone, so grey; the colour version is ' +
      'enhanced (orange, violet and ultraviolet). Data from 13.3° N to the south pole at most longitudes; the north is ' +
      'filled flat, featureless.',
  },
};

export const MOON_NO_MAP_NOTE: Readonly<Record<string, string>> = {
  deimos:
    'Its only global map is an airbrushed drawing from Viking images, not a photomosaic, so it is drawn in one flat colour.',
  titan:
    'Haze hides its surface in visible light, and its surface maps are infrared. Drawn flat in the haze’s colour, ' +
    'measured from Cassini’s natural-colour view (PIA06230).',
};

/** Said on screen with the other credits. */
export const MOON_MAP_CREDIT =
  'Moon maps: NASA/JPL/USGS (Viking, Voyager, Galileo, Cassini); Mimas: NASA PIA14926; ' +
  'Titan’s haze colour: NASA/JPL/Space Science Institute PIA06230.';
