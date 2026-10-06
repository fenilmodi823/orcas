import { Vector3 } from 'three';
import type { PlanetEphemeris } from '../data/planet-ephemeris.js';
import type { DetailGroup } from '../ui/object-detail-model.js';
import { BODY_KIND_LABEL, bodyById, bodyPositionKm, type Body } from '../renderer/solar/bodies.js';

const AU_KM = 149_597_870.7; // IAU 2012, exact
const C_KM_S = 299_792.458; // exact
/** Under this a distance reads in km (the Moon); over it, in AU (the Sun and the planets). */
const KM_LIMIT = 1e7;

export interface BodyReadout {
  readonly label: string;
  readonly value: number;
  readonly unit: string;
  readonly precision: number;
}

const distance = (label: string, km: number): BodyReadout =>
  km < KM_LIMIT ? { label, value: km, unit: 'km', precision: 0 } : { label, value: km / AU_KM, unit: 'AU', precision: 4 };

const lightTime = (km: number): BodyReadout => {
  const s = km / C_KM_S;
  return s < 120 ? { label: 'Light', value: s, unit: 's', precision: 2 } : { label: 'Light', value: s / 60, unit: 'min', precision: 1 };
};

const SUN = bodyById('sun');
const _body = new Vector3();
const _sun = new Vector3();

/**
 * A body's live numbers at an instant (S5a): its distance from the Earth and from the Sun, and the light time
 * from it to the Earth, never measuring a body from itself. NASA's panel shows none for a planet (Reference §4.4);
 * ORCAS keeps them, as it does for satellites. Null while the body has no position (a planet before its bake).
 */
export function bodyReadouts(body: Body, epochMs: number, ephemeris: PlanetEphemeris | null): BodyReadout[] | null {
  const at = bodyPositionKm(body, epochMs, ephemeris, _body);
  const sun = SUN && bodyPositionKm(SUN, epochMs, ephemeris, _sun);
  if (!at || !sun) return null;
  const fromEarthKm = at.length();
  const rows: BodyReadout[] = [];
  if (body.id !== 'earth') rows.push(distance('Earth', fromEarthKm));
  if (body.id !== 'sun') rows.push(distance('Sun', at.distanceTo(sun)));
  rows.push(lightTime(body.id === 'earth' ? at.distanceTo(sun) : fromEarthKm));
  return rows;
}

/** Where a body's position comes from, and what it is worth (Rules §7: every number carries its source). */
function provenanceNote(body: Body, ephemerisLoaded: boolean): string {
  if (body.id === 'earth') return 'The scene’s origin: every position here is geocentric, in J2000 axes.';
  if (body.id === 'moon') {
    return 'Meeus, Astronomical Algorithms ch. 47, truncated: within 0.0127° and 22.3 km of JPL DE421 at the tested epochs.';
  }
  const de421 = 'JPL DE421, interpolated to within 1″ as seen from the Earth.';
  if (body.id === 'sun' && !ephemerisLoaded) return `${de421} Until it loads, an analytic Sun good to about 0.01°.`;
  if (body.ephemerisNaifId !== null && body.ephemerisNaifId < 10) {
    return `${de421} The position is the ${body.name} system’s barycentre, not the planet’s centre.`;
  }
  return de421;
}

/** The panel's groups for a body. There is no description: none is written until one is sourced from NASA (B.23). */
export function bodyDetailGroups(body: Body, ephemerisLoaded: boolean): DetailGroup[] {
  return [
    {
      id: 'identity',
      title: 'Body',
      fields: [
        { label: 'Type', value: BODY_KIND_LABEL[body.kind] },
        { label: 'Equatorial radius', value: body.equatorialRadiusKm, unit: 'km', precision: body.equatorialRadiusKm < 1e4 ? 1 : 0 },
      ],
      note: 'Radius: IAU 2015 (Archinal et al. 2018), as NAIF’s pck00011 carries it.',
    },
    {
      id: 'provenance',
      title: 'Position',
      fields: [{ label: 'Source', value: body.id === 'moon' ? 'Meeus ch. 47' : body.id === 'earth' ? 'Origin' : 'JPL DE421' }],
      note: provenanceNote(body, ephemerisLoaded),
    },
  ];
}
