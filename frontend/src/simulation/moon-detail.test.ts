import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseHorizonsManifest } from '../data/horizons-manifest.js';
import { requestMoonSystem, resetMoonSystems } from '../data/moon-systems.js';
import { bodyById } from '../renderer/solar/bodies.js';
import { formatTelemetryValue } from '../ui/telemetry-format.js';
import { moonDetailGroups, moonPendingNote } from './moon-detail.js';

const manifest = parseHorizonsManifest(JSON.parse(readFileSync(resolve(process.cwd(), 'public/ephemeris/horizons/manifest.json'), 'utf8')) as unknown);
afterEach(() => resetMoonSystems());

describe("a moon's panel (S6b)", () => {
  it('names its planet, its IAU radii and the ellipsoid it is drawn as', () => {
    const body = moonDetailGroups(bodyById('phobos')!, manifest).find((g) => g.id === 'identity');
    expect(body?.fields).toEqual(
      expect.arrayContaining([
        { label: 'Moon of', value: 'Mars' },
        { label: 'Radii', value: '13 × 11.4 × 9.1', unit: 'km', wide: true },
      ]),
    );
    expect(body?.note).toContain('irregular');
    expect(body?.note).toContain('turned by its IAU pole and prime meridian');
    expect(body?.note).not.toContain('sphere');
  });

  it('names its map, says it is greyscale and where the data stops (S6b2)', () => {
    const map = (id: string) => moonDetailGroups(bodyById(id)!, manifest).find((g) => g.id === 'map');
    expect(map('io')?.fields[0]?.value).toBe('Galileo SSI, Voyager');
    expect(map('io')?.note).toContain('greyscale');
    expect(map('io')?.note).toContain('colour version is enhanced');
    expect(map('umbriel')?.note).toContain('southern hemisphere only');
    expect(map('iapetus')?.note).toContain('far darker than it looks here'); // mapping mosaics flatten the dichotomy
  });

  it('says why Deimos and Titan have no map, rather than leaving it out (S6b2)', () => {
    const map = (id: string) => moonDetailGroups(bodyById(id)!, manifest).find((g) => g.id === 'map');
    expect(map('deimos')?.fields[0]?.value).toBe('None');
    expect(map('deimos')?.note).toContain('airbrushed');
    expect(map('titan')?.fields[0]?.value).toBe('None');
    expect(map('titan')?.note).toContain('PIA06230');
  });

  it('cites the export: source, date, trajectory, spans and accuracy, in its own words', () => {
    const position = moonDetailGroups(bodyById('io')!, manifest).find((g) => g.id === 'provenance');
    expect(position?.fields).toEqual(
      expect.arrayContaining([
        { label: 'Source', value: 'JPL Horizons' },
        { label: 'Exported', value: '2026-10-06 UTC' },
        { label: 'Trajectory', value: 'jup365_merged' },
      ]),
    );
    expect(position?.note).toContain('Jupiter system’s barycentre');
    expect(position?.fields.find((f) => f.label === 'Requested (TDB)')?.wide).toBe(true);
  });

  it('shows the measured worst error as measured, never rounded up to the 1 × 10⁻⁴ target', () => {
    const fields = moonDetailGroups(bodyById('io')!, manifest).find((g) => g.id === 'provenance')?.fields ?? [];
    const worst = fields.find((f) => f.label === 'Worst error, measured');
    expect(typeof worst?.value).toBe('number');
    expect(formatTelemetryValue(worst!.value as number, worst!.precision)).toBe('9.997 × 10⁻⁵');
  });

  it('says the export details are missing, rather than invent them, if the manifest did not load', () => {
    const position = moonDetailGroups(bodyById('io')!, null).find((g) => g.id === 'provenance');
    expect(position?.note).toContain('could not be loaded');
  });

  it('says the export details are loading while the manifest loads, not that they failed', () => {
    const position = moonDetailGroups(bodyById('io')!, undefined).find((g) => g.id === 'provenance');
    expect(position?.note).toBe('Loading the export’s details…');
  });

  it('states the time scales as they are: TT − UTC exact, TDB within 2 ms of TT', () => {
    const note = moonDetailGroups(bodyById('io')!, manifest).find((g) => g.id === 'provenance')?.note ?? '';
    expect(note).toContain('TT = UTC + 69.184 s exactly since 2017; TDB stays within 2 ms of TT.');
    expect(note).not.toContain('TDB = UTC');
  });

  it('says why there is no position yet', async () => {
    expect(moonPendingNote(bodyById('io')!, false)).toBe('Computing position…');
    expect(moonPendingNote(bodyById('io')!, true)).toBe('Loading this moon’s trajectory…');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    requestMoonSystem('jupiter', () => Promise.resolve({ ok: false, status: 500, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) }));
    await vi.waitFor(() => expect(moonPendingNote(bodyById('io')!, true)).toBe('Position unavailable: this moon’s data did not load.'));
    warn.mockRestore();
  });
});
