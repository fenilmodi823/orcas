/** A spacecraft of the S6a export (B.17 list): its URL id, its export name and NAIF id, and its data's first and last year. */
export interface Spacecraft {
  readonly id: string;
  readonly name: string;
  readonly naifId: number;
  readonly years: readonly [number, number];
}

const sc = (id: string, name: string, naifId: number, from: number, to: number): Spacecraft => ({ id, name, naifId, years: [from, to] });

/** In the manifest's order; names and years are the manifest's (checked by test). */
export const SPACECRAFT: readonly Spacecraft[] = [
  sc('jwst', 'James Webb Space Telescope', -170, 2021, 2031),
  sc('soho', 'SOHO', -21, 1995, 2026),
  sc('dscovr', 'DSCOVR', -78, 2015, 2026),
  sc('lro', 'Lunar Reconnaissance Orbiter', -85, 2009, 2027),
  sc('chandrayaan-2', 'Chandrayaan-2 orbiter', -152, 2019, 2026),
  sc('artemis-1', 'Artemis I (Orion)', -1023, 2022, 2022),
  sc('artemis-2', 'Artemis II (Orion Integrity)', -1024, 2026, 2026),
  sc('voyager-1', 'Voyager 1', -31, 1977, 2053),
  sc('voyager-2', 'Voyager 2', -32, 1977, 2053),
  sc('pioneer-10', 'Pioneer 10', -23, 1972, 2049),
  sc('pioneer-11', 'Pioneer 11', -24, 1973, 2049),
  sc('new-horizons', 'New Horizons', -98, 2006, 2049),
  sc('cassini', 'Cassini', -82, 1997, 2017),
  sc('galileo', 'Galileo', -77, 1989, 2003),
  sc('juno', 'Juno', -61, 2011, 2028),
  sc('europa-clipper', 'Europa Clipper', -159, 2024, 2034),
  sc('juice', 'JUICE', -28, 2023, 2031),
  sc('parker-solar-probe', 'Parker Solar Probe', -96, 2018, 2029),
  sc('bepicolombo', 'BepiColombo', -121, 2018, 2027),
  sc('psyche', 'Psyche', -255, 2023, 2029),
  sc('lucy', 'Lucy', -49, 2021, 2033),
  sc('osiris-rex', 'OSIRIS-REx / OSIRIS-APEX', -64, 2016, 2030),
  sc('mro', 'Mars Reconnaissance Orbiter', -74, 2005, 2026),
  sc('maven', 'MAVEN', -202, 2013, 2026),
  sc('mangalyaan', 'Mars Orbiter Mission (Mangalyaan)', -3, 2013, 2022),
];

/** What Nearby frames (decision 7): a dot has no size, so the camera arrives a few tens of km out. */
export const SPACECRAFT_FRAME_RADIUS_KM = 10;

/** Said on screen wherever spacecraft are drawn (Rules §7): static paths from a dated export, never live. */
export const SPACECRAFT_CREDIT = 'Spacecraft: JPL Horizons, exported 2026-10-06 UTC, static; solid where flown, dashed where predicted.';

/** The body each Horizons centre (NAIF id) is, for the panel and the System view. */
export const CENTRE_BODY: Readonly<Record<number, { readonly bodyId: string; readonly label: string }>> = {
  0: { bodyId: 'sun', label: 'Sun (barycentre)' },
  399: { bodyId: 'earth', label: 'Earth' },
  301: { bodyId: 'moon', label: 'Moon' },
  199: { bodyId: 'mercury', label: 'Mercury' },
  299: { bodyId: 'venus', label: 'Venus' },
  499: { bodyId: 'mars', label: 'Mars' },
  5: { bodyId: 'jupiter', label: 'Jupiter (barycentre)' },
  6: { bodyId: 'saturn', label: 'Saturn (barycentre)' },
  7: { bodyId: 'uranus', label: 'Uranus (barycentre)' },
  8: { bodyId: 'neptune', label: 'Neptune (barycentre)' },
};
