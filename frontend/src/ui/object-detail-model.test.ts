import { describe, expect, it } from 'vitest';
import { satrecFromOmm } from '@orcas/physics';
import { apsidesKm, buildDetailGroups, periodMinutes } from './object-detail-model.js';
import { makeTestCatalog } from '../simulation/test-fixtures.js';

const { objects } = makeTestCatalog(1);
const leo = objects[0];
const satrec = satrecFromOmm(leo.record);
const EPOCH = leo.epochMs;

function field(groups: ReturnType<typeof buildDetailGroups>, group: string, label: string) {
  return groups.find((g) => g.id === group)?.fields.find((f) => f.label === label)?.value;
}

describe('orbit derivations', () => {
  it('gives a ~92.9 min period for 15.5 rev/day, the ISS band', () => {
    expect(periodMinutes(15.5)).toBeCloseTo(92.903, 3);
  });

  it('puts a geostationary mean motion at the textbook 35,786 km', () => {
    // 1.00273791 rev/day is one sidereal day per revolution.
    const { apogeeKm, perigeeKm } = apsidesKm(1.00273791, 0);

    expect(apogeeKm).toBeCloseTo(35786, -1);
    expect(perigeeKm).toBeCloseTo(apogeeKm, 6);
  });

  it('separates apogee and perigee by the eccentricity', () => {
    const { apogeeKm, perigeeKm } = apsidesKm(15.5, 0.0005);

    // The ISS band: roughly 415 x 422 km.
    expect(perigeeKm).toBeGreaterThan(410);
    expect(apogeeKm).toBeLessThan(425);
    expect(apogeeKm).toBeGreaterThan(perigeeKm);
  });
});

describe('buildDetailGroups', () => {
  it('orders the groups as the brief does: identity, kinematics, orbit, provenance', () => {
    const groups = buildDetailGroups(leo, satrec, EPOCH, EPOCH);

    expect(groups.map((g) => g.id)).toEqual(['identity', 'kinematics', 'orbit', 'provenance']);
  });

  it('collapses a group with no data instead of showing blanks', () => {
    const groups = buildDetailGroups(leo, null, EPOCH, EPOCH);

    expect(groups.map((g) => g.id)).not.toContain('kinematics');
  });

  it('evaluates kinematics at the simulated instant, within the orbit it belongs to', () => {
    const groups = buildDetailGroups(leo, satrec, EPOCH + 20 * 60_000, EPOCH);
    const lat = field(groups, 'kinematics', 'Latitude') as number;
    const alt = field(groups, 'kinematics', 'Altitude') as number;

    // A 51.6-degree orbit never reaches latitudes beyond its inclination.
    expect(Math.abs(lat)).toBeLessThanOrEqual(51.6 + 0.2);
    expect(alt).toBeGreaterThan(300);
    expect(alt).toBeLessThan(500);
  });

  it('always shows the element-set epoch, and says so when it is published ahead', () => {
    const groups = buildDetailGroups(leo, satrec, EPOCH, EPOCH - 3_600_000);

    expect(field(groups, 'provenance', 'Element-set epoch')).toBe('2026-01-01 00:00:00 UTC');
    expect(field(groups, 'provenance', 'Age')).toBe('published ahead of now');
  });

  it('leaves the conjunction group to conjunction-detail.ts', () => {
    expect(buildDetailGroups(leo, satrec, EPOCH, EPOCH).map((g) => g.id)).not.toContain('conjunction');
  });

  // Carried over from the M1.7a review's defect (d): re-parsing record.EPOCH
  // turned the backend's '…+00:00' offset form into an Invalid Date, whose
  // toISOString() threw and tore down the whole route when the dock expanded.
  // The model reads the validated epochMs and never re-derives it.
  it('renders the epoch from the validated epochMs, whatever form record.EPOCH takes', () => {
    const offsetForm = { ...leo, record: { ...leo.record, EPOCH: '2026-01-01T00:00:00.000000+00:00' } };

    expect(() => buildDetailGroups(offsetForm, satrec, EPOCH, EPOCH)).not.toThrow();
    expect(field(buildDetailGroups(offsetForm, satrec, EPOCH, EPOCH), 'provenance', 'Element-set epoch')).toBe(
      '2026-01-01 00:00:00 UTC',
    );
  });
});

