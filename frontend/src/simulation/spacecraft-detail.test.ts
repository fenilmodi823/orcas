import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseHorizonsEphemeris } from '../data/horizons-ephemeris.js';
import { createHorizonsIndex } from '../data/horizons-index.js';
import { parseHorizonsManifest } from '../data/horizons-manifest.js';
import { requestMoonSystem, resetMoonSystems } from '../data/moon-systems.js';
import { parsePlanetEphemeris } from '../data/planet-ephemeris.js';
import { bodyById } from '../renderer/solar/bodies.js';
import { bodyReadouts } from './body-detail.js';
import { spacecraftCentreName, spacecraftDetailGroups, spacecraftPendingNote } from './spacecraft-detail.js';

const read = (p: string) => readFileSync(resolve(process.cwd(), p));
const manifest = parseHorizonsManifest(JSON.parse(read('public/ephemeris/horizons/manifest.json').toString('utf8')) as unknown);
const pe = read('public/ephemeris/planets-de421.bin');
const ephemeris = parsePlanetEphemeris(pe.buffer.slice(pe.byteOffset, pe.byteOffset + pe.byteLength));
const body = (id: string) => {
  const b = bodyById(id);
  if (!b) throw new Error(id);
  return b;
};
const groups = (id: string) => spacecraftDetailGroups(body(id), manifest);
const group = (id: string, gid: string) => groups(id).find((g) => g.id === gid);
const value = (id: string, gid: string, label: string) => group(id, gid)?.fields.find((f) => f.label === label)?.value;

afterEach(() => resetMoonSystems());

describe("a spacecraft's panel (S6c1)", () => {
  it('names its type, designator and years', () => {
    const f = group('voyager-1', 'identity')?.fields;
    expect(f).toEqual([
      { label: 'Type', value: 'Spacecraft', text: true },
      { label: 'Designator', value: '1977-084A', text: true },
      { label: 'Data', value: '1977 – 2053', text: true },
    ]);
  });

  it('says where its position comes from, with the export date', () => {
    expect(value('juno', 'provenance', 'Source')).toBe('JPL Horizons');
    expect(value('juno', 'provenance', 'Exported')).toBe('2026-10-06 UTC');
    expect(value('juno', 'provenance', 'Trajectory')).toBe('Juno_merged');
    expect(group('juno', 'provenance')?.note).toContain('Shown only within the requested spans');
  });

  it("quotes Voyager 1's data sheet and its rough years against the mission record", () => {
    expect(value('voyager-1', 'flown', 'Flown until')).toBe('1992-04-24');
    expect(value('voyager-1', 'flown', 'Basis')).toBe('Data sheet: fit');
    expect(group('voyager-1', 'flown')?.note).toContain('“1992-Apr-24 Final two-way tracking measurements”');
    expect(value('voyager-1', 'rough', 'Rough years')).toBe('Before 1981');
    expect(group('voyager-1', 'rough')?.note).toContain('differs from the mission record (NASA PDS) by 43,587 to 46,656 km.');
    expect(group('voyager-1', 'rough')?.note).toContain('“a patched conic mission-design type trajectory … providing a rough accuracy”');
  });

  it("gives Voyager 2 its own range and date", () => {
    expect(value('voyager-2', 'rough', 'Rough years')).toBe('Before 1989-08-29');
    expect(group('voyager-2', 'rough')?.note).toContain('38,859 to 42,032 km');
    expect(group('juno', 'rough')).toBeUndefined();
  });

  it("bases Pioneer 10's boundary on last contact and keeps its caveat", () => {
    expect(value('pioneer-10', 'flown', 'Basis')).toBe('Data sheet: last contact');
    expect(group('pioneer-10', 'flown')?.note).toContain('suitable for general historical purposes');
    expect(group('pioneer-10', 'flown')?.note).toContain('“The last fully successful acquisition of signal was March 3, 2002.”');
  });

  it("bases OSIRIS-REx's boundary on the export date and Artemis II's note says what the sheet omits", () => {
    expect(value('osiris-rex', 'flown', 'Basis')).toBe('Export date (the sheet states none)');
    expect(value('osiris-rex', 'flown', 'Flown until')).toBe('2026-10-06');
    expect(group('artemis-2', 'flown')?.note).toContain('does not say which segments are reconstructions');
  });

  it('says what is missing when the manifest has not loaded or failed', () => {
    const g = spacecraftDetailGroups(body('juno'), undefined);
    expect(g.find((x) => x.id === 'provenance')?.note).toContain('Loading');
    expect(g.some((x) => x.id === 'flown')).toBe(false);
    expect(spacecraftDetailGroups(body('juno'), null).find((x) => x.id === 'provenance')?.note).toContain('could not be loaded');
  });

  it('names the centre bodies', () => {
    expect([0, 399, 301, 5, 8].map(spacecraftCentreName)).toEqual(['Sun (barycentre)', 'Earth', 'Moon', 'Jupiter (barycentre)', 'Neptune (barycentre)']);
    expect(spacecraftCentreName(-999)).toBe('NAIF -999');
  });

  it('puts the distance from the centre first, and skips the Earth row near the Earth', () => {
    const f = read('public/ephemeris/horizons/spacecraft.bin');
    resetMoonSystems({ spacecraft: createHorizonsIndex(parseHorizonsEphemeris(f.buffer.slice(f.byteOffset, f.byteOffset + f.byteLength))) });
    const at = Date.UTC(2026, 9, 6, 12);
    expect(bodyReadouts(body('juno'), at, ephemeris)?.[0]?.label).toBe('Jupiter (barycentre)');
    const jwst = bodyReadouts(body('jwst'), at, ephemeris)?.map((r) => r.label);
    expect(jwst?.[0]).toBe('Earth'); // its centre, so no second Earth row
    expect(jwst?.filter((l) => l === 'Earth')).toHaveLength(1);
  });

  it('has three pending notes, each honest', async () => {
    const b = body('juno');
    expect(spacecraftPendingNote(b, true, manifest)).toBe('Loading the spacecraft trajectories…');
    const f = read('public/ephemeris/horizons/spacecraft.bin');
    const ok = { ok: true, status: 200, arrayBuffer: () => Promise.resolve(f.buffer.slice(f.byteOffset, f.byteOffset + f.byteLength)) };
    requestMoonSystem('spacecraft', () => Promise.resolve(ok));
    await vi.waitFor(() => expect(spacecraftPendingNote(b, true, manifest)).toMatch(/^No data at this time\. The export covers: 2011-/));
    expect(spacecraftPendingNote(b, true, undefined)).toBe('No data at this time.');
    expect(spacecraftPendingNote(b, true, null)).toContain('The export’s details could not be loaded, so its flown and predicted dates are not shown, and its path is not drawn.');
    resetMoonSystems();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    requestMoonSystem('spacecraft', () => Promise.resolve({ ok: false, status: 500, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) }));
    await vi.waitFor(() => expect(spacecraftPendingNote(b, true, manifest)).toBe('Position unavailable: the spacecraft data did not load.'));
    warn.mockRestore();
  });
});
