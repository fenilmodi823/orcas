// frontend/src/renderer/camera/camera-views.test.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { parseHorizonsEphemeris } from '../../data/horizons-ephemeris.js';
import { createHorizonsIndex } from '../../data/horizons-index.js';
import { moonSystemStatus, resetMoonSystems } from '../../data/moon-systems.js';
import { parsePlanetEphemeris } from '../../data/planet-ephemeris.js';
import { useSelectionStore } from '../../state/selection-store.js';
import { bodyById } from '../solar/bodies.js';
import { useCameraStatus } from './camera-status.js';
import { subscribeCameraViews, systemBodyOf } from './camera-views.js';

const read = (path: string) => {
  const f = readFileSync(resolve(process.cwd(), path));
  return f.buffer.slice(f.byteOffset, f.byteOffset + f.byteLength);
};
const ephemerisRef = { current: parsePlanetEphemeris(read('public/ephemeris/planets-de421.bin')) };
const AT = Date.UTC(2026, 9, 12);

function harness(epochMs = AT) {
  const flyToBody = vi.fn<(target: { key: string }, opts: Record<string, unknown>) => Promise<void>>(() => Promise.resolve());
  const followBody = vi.fn();
  const clearSelectionQuietly = vi.fn(() => useSelectionStore.getState().clearSelection());
  const clearPending = vi.fn();
  const camera = new PerspectiveCamera(35, 1.6, 1, 1e12);
  camera.position.set(0, -42_164, 0);
  const off = subscribeCameraViews({
    sys: { flyToBody } as never,
    camera,
    epochMs: () => epochMs,
    ephemerisRef,
    followBody,
    clearSelectionQuietly,
    clearPending,
  });
  return { flyToBody, followBody, clearSelectionQuietly, clearPending, off };
}

beforeEach(() => {
  useSelectionStore.getState().clearSelection();
  useCameraStatus.setState({ view: 'nearby', viewRequests: 0, homeRequests: 0 });
});
afterEach(() => resetMoonSystems());

describe('camera views (S6b, NASA Eyes’ CameraViewBlock)', () => {
  it("frames a moon's planet's system and keeps the moon selected", async () => {
    resetMoonSystems({ jupiter: createHorizonsIndex(parseHorizonsEphemeris(read('public/ephemeris/horizons/moons-jupiter.bin'))) });
    const h = harness();
    useSelectionStore.getState().setSelectedBody('io');
    useCameraStatus.getState().requestView('system');
    await vi.waitFor(() => expect(h.flyToBody).toHaveBeenCalledTimes(1));
    const [target, opts] = h.flyToBody.mock.calls[0]!;
    expect(target.key).toBe('jupiter-system');
    expect(opts).toMatchObject({ aimSec: 1, travelSec: 1, spin: false });
    expect((opts.arrivalOffsetKm as Vector3).length()).toBeGreaterThanOrEqual(7_157_638);
    expect(useSelectionStore.getState().selectedBody).toBe('io');
    expect(useCameraStatus.getState().view).toBe('system');
    h.off();
  });

  it('does not fly while the system is still loading', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined); // the test's relative URL cannot load
    const h = harness();
    useSelectionStore.getState().setSelectedBody('saturn');
    useCameraStatus.getState().requestView('system'); // moons-saturn.bin is asked for now
    expect(h.flyToBody).not.toHaveBeenCalled();
    h.off(); // cancels the wait, so nothing flies after the test
    warn.mockRestore();
  });

  it('a new selection cancels a System view still waiting for its moons', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined); // the relative URL cannot load
    const h = harness();
    useSelectionStore.getState().setSelectedBody('saturn');
    useCameraStatus.getState().requestView('system');
    useSelectionStore.getState().setSelectedBody('mars');
    await vi.waitFor(() => expect(moonSystemStatus('saturn')).toBe('failed')); // the file settles after the change
    expect(h.flyToBody).not.toHaveBeenCalled();
    h.off();
    warn.mockRestore();
  });

  it('flies back to the body for Nearby, and to 10¹⁰ km for the Sun’s Outer', () => {
    const h = harness();
    useSelectionStore.getState().setSelectedBody('io');
    useCameraStatus.getState().requestView('nearby');
    expect(h.followBody).toHaveBeenCalledWith('io');
    useSelectionStore.getState().setSelectedBody('sun');
    useCameraStatus.getState().requestView('outer');
    const [target, opts] = h.flyToBody.mock.calls.at(-1)!;
    expect(target.key).toBe('outer');
    expect((opts.arrivalOffsetKm as Vector3).length()).toBeCloseTo(1e10, 0);
    h.off();
  });

  it('a System view drops a Nearby follow still waiting for its body; Nearby keeps it', () => {
    const h = harness();
    useSelectionStore.getState().setSelectedBody('venus');
    useCameraStatus.getState().requestView('nearby');
    expect(h.clearPending).not.toHaveBeenCalled();
    useCameraStatus.getState().requestView('system');
    expect(h.clearPending).toHaveBeenCalledTimes(1);
    expect(h.flyToBody.mock.calls.at(-1)![0].key).toBe('venus-system');
    h.off();
  });

  it('a view that cannot fly yet falls back to Nearby rather than showing pressed', () => {
    const h = harness(0); // no epoch: no position for any body yet
    useSelectionStore.getState().setSelectedBody('venus');
    useCameraStatus.getState().requestView('system');
    expect(useCameraStatus.getState().view).toBe('nearby');
    useSelectionStore.getState().setSelectedBody('sun');
    useCameraStatus.getState().requestView('outer');
    expect(useCameraStatus.getState().view).toBe('nearby');
    expect(h.flyToBody).not.toHaveBeenCalled();
    h.off();
  });

  it('starts every new selection at Nearby, as NASA’s panel does', () => {
    const h = harness();
    useCameraStatus.getState().requestView('system');
    useSelectionStore.getState().setSelectedBody('mars');
    expect(useCameraStatus.getState().view).toBe('nearby');
    h.off();
  });

  it('flies home NASA’s way, clearing the selection quietly', () => {
    const h = harness();
    useSelectionStore.getState().setSelectedBody('jupiter');
    useCameraStatus.getState().requestHome();
    expect(h.clearSelectionQuietly).toHaveBeenCalledTimes(1);
    const [target, opts] = h.flyToBody.mock.calls.at(-1)!;
    expect(target.key).toBe('home');
    expect(opts).toMatchObject({ aimSec: 1, travelSec: 1, spin: false });
    expect((opts.arrivalOffsetKm as Vector3).length()).toBeCloseTo(7e8, 0);
    h.off();
  });

  it("names each body's system: a moon's planet, a planet itself, none for the Sun", () => {
    expect(systemBodyOf(bodyById('io')!)?.id).toBe('jupiter');
    expect(systemBodyOf(bodyById('moon')!)?.id).toBe('earth');
    expect(systemBodyOf(bodyById('venus')!)?.id).toBe('venus');
    expect(systemBodyOf(bodyById('sun')!)).toBeNull();
  });
});
