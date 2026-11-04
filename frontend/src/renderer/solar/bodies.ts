import type { Vector3 } from 'three';
import { moonPositionJ2000Km, sunPositionJ2000Km } from '@orcas/physics';
import { bodyStateKm, type PlanetEphemeris } from '../../data/planet-ephemeris.js';
import type { HorizonsFileId } from '../../data/moon-systems.js';
import { MOONS, type Moon } from './moons.js';
import { applyPlanetCentre, horizonsGeocentricKm } from './system-centres.js';
import { EARTH_NAIF_ID, PLANETS, SUN_NAIF_ID } from './planets.js';
import { SPACECRAFT, SPACECRAFT_FRAME_RADIUS_KM, type Spacecraft } from './spacecraft.js';

export type BodyKind = 'star' | 'planet' | 'moon' | 'spacecraft';

/** NASA Eyes' type chip (Reference §4.4): "Planet", "Moon"; the Sun is a star. */
export const BODY_KIND_LABEL: Readonly<Record<BodyKind, string>> = { star: 'Star', planet: 'Planet', moon: 'Moon', spacecraft: 'Spacecraft' };

/** Something the camera can fly to and the panel can describe (S5a): the Sun, a planet, the Moon or another major moon. */
export interface Body {
  /** Lower-case, URL-safe: `?object=jupiter`, as NASA Eyes' `#/jupiter`. Never all digits, so never a NORAD id. */
  readonly id: string;
  readonly name: string;
  readonly kind: BodyKind;
  /** Equatorial radius, km (IAU 2015, NAIF pck00011): what the arrival distance is framed on. */
  readonly equatorialRadiusKm: number;
  /** NAIF id of the body itself, for its IAU pole. */
  readonly poleNaifId: number;
  /** NAIF id DE421 carries for it: the body, or its system's barycentre. Null for the Moon, which M1.11 places. */
  readonly ephemerisNaifId: number | null;
  /** The body it belongs to in the breadcrumb, as NASA's `#/earth/moons/moon`. */
  readonly parent: string | null;
  /** A major moon or a spacecraft (S6b, S6c): the S6a export file that places it, and its NAIF id there. */
  readonly horizons?: { readonly file: HorizonsFileId; readonly naifId: number };
}

const fromPlanet = (planet: (typeof PLANETS)[number]): Body => ({
  id: planet.name.toLowerCase(),
  name: planet.name,
  kind: 'planet',
  equatorialRadiusKm: planet.equatorialRadiusKm,
  poleNaifId: planet.bodyNaifId,
  ephemerisNaifId: planet.naifId,
  parent: null,
});

const fromMoon = (m: Moon): Body => ({
  id: m.id,
  name: m.name,
  kind: 'moon',
  equatorialRadiusKm: m.radiiKm[0],
  poleNaifId: m.naifId,
  ephemerisNaifId: null,
  parent: m.system,
  horizons: { file: m.system, naifId: m.naifId },
});

const fromSpacecraft = (s: Spacecraft): Body => ({
  id: s.id,
  name: s.name,
  kind: 'spacecraft',
  equatorialRadiusKm: SPACECRAFT_FRAME_RADIUS_KM,
  poleNaifId: s.naifId,
  ephemerisNaifId: null,
  parent: null,
  horizons: { file: 'spacecraft', naifId: s.naifId },
});

// The Sun's and the Moon's radii: NAIF pck00011 BODY10_RADII and BODY301_RADII (IAU 2015), read 2026-10-06.
const SUN: Body = { id: 'sun', name: 'Sun', kind: 'star', equatorialRadiusKm: 695_700, poleNaifId: 10, ephemerisNaifId: SUN_NAIF_ID, parent: null };
const MOON: Body = { id: 'moon', name: 'Moon', kind: 'moon', equatorialRadiusKm: 1737.4, poleNaifId: 301, ephemerisNaifId: null, parent: 'earth' };

/** Inner to outer, each planet's moons after it: the Earth's Moon, then the major moons (S6b); the spacecraft last (S6c). */
export const BODIES: readonly Body[] = [
  SUN,
  ...PLANETS.flatMap((planet) => {
    const body = fromPlanet(planet);
    const moons = planet.naifId === EARTH_NAIF_ID ? [MOON] : MOONS.filter((m) => m.system === body.id).map(fromMoon);
    return [body, ...moons];
  }),
  ...SPACECRAFT.map(fromSpacecraft),
];

const byId = new Map(BODIES.map((body) => [body.id, body]));

export function bodyById(id: string): Body | undefined {
  return byId.get(id);
}

export function isBodyId(id: string): boolean {
  return byId.has(id);
}

/** The export's entry for a spacecraft body; undefined for anything else. */
export function spacecraftOf(body: Body): Spacecraft | undefined {
  return body.kind === 'spacecraft' ? SPACECRAFT.find((s) => s.id === body.id) : undefined;
}

/** NASA Eyes' type chip: "Moon of Jupiter", "Spacecraft · 1977 – 2053" (search and panel). */
export function bodySubtitle(body: Body): string {
  if (body.kind === 'spacecraft') {
    const s = spacecraftOf(body);
    return s ? `Spacecraft · ${s.years[0]} – ${s.years[1]}` : BODY_KIND_LABEL.spacecraft;
  }
  const parent = body.kind === 'moon' && body.parent ? bodyById(body.parent) : undefined;
  return parent ? `Moon of ${parent.name}` : BODY_KIND_LABEL[body.kind];
}

/**
 * A body's centre at a UTC instant, geocentric km, ICRF (≈ J2000): the frame the scene is drawn in. The Sun
 * and the planets come from the DE421 bake, as the scene draws them (S4); before it loads the Sun is the
 * analytic M1.11 one and a planet has no position (null). The Moon is always M1.11's. A major moon or a spacecraft comes from the S6a Horizons export, from the moment its system has loaded; Jupiter to Neptune move to their own centres then.
 */
export function bodyPositionKm(body: Body, epochMs: number, ephemeris: PlanetEphemeris | null, out: Vector3): Vector3 | null {
  if (body.horizons) return horizonsGeocentricKm(body.horizons.file, body.horizons.naifId, epochMs, ephemeris, out);
  if (body.ephemerisNaifId === EARTH_NAIF_ID) return out.set(0, 0, 0);
  if (body.ephemerisNaifId === null) {
    const m = moonPositionJ2000Km(new Date(epochMs));
    return out.set(m.x, m.y, m.z);
  }
  const earth = ephemeris && bodyStateKm(ephemeris, EARTH_NAIF_ID, epochMs);
  const state = ephemeris && bodyStateKm(ephemeris, body.ephemerisNaifId, epochMs);
  if (earth && state) {
    out.set(state.position.x - earth.position.x, state.position.y - earth.position.y, state.position.z - earth.position.z);
    applyPlanetCentre(body.poleNaifId, epochMs, out); // Jupiter to Neptune at their centres where their moons have loaded (S6b)
    return out;
  }
  if (body.ephemerisNaifId !== SUN_NAIF_ID) return null;
  const s = sunPositionJ2000Km(new Date(epochMs));
  return out.set(s.x, s.y, s.z);
}
