import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  moonSystem,
  moonSystemStatus,
  moonSystemUrl,
  requestMoonSystem,
  resetMoonSystems,
  subscribeMoonSystems,
  whenMoonSystemSettles,
} from './moon-systems.js';

function bytes(name: string): ArrayBuffer {
  const file = readFileSync(resolve(process.cwd(), `public/ephemeris/horizons/${name}.bin`));
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
}
const ok = (buffer: ArrayBuffer) => ({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(buffer) });

afterEach(() => resetMoonSystems());

describe('moon systems (S6b)', () => {
  it('fetches a system once, however often it is asked for', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const fetcher = vi.fn((_url: string) => Promise.resolve(ok(bytes('moons-mars'))));
    requestMoonSystem('mars', fetcher);
    requestMoonSystem('mars', fetcher);
    expect(moonSystemStatus('mars')).toBe('loading');
    await vi.waitFor(() => expect(moonSystemStatus('mars')).toBe('ready'));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith('/ephemeris/horizons/moons-mars.bin');
    expect(moonSystem('mars')?.targets).toEqual(expect.arrayContaining([401, 402]));
  });

  it('gives up for the page on a failed fetch, and says why in the console', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    requestMoonSystem('neptune', () => Promise.resolve({ ok: false, status: 404, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) }));
    await vi.waitFor(() => expect(moonSystemStatus('neptune')).toBe('failed'));
    expect(moonSystem('neptune')).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('/ephemeris/horizons/moons-neptune.bin'), expect.any(Error));
    requestMoonSystem('neptune', () => Promise.reject(new Error('never asked again')));
    expect(moonSystemStatus('neptune')).toBe('failed');
    warn.mockRestore();
  });

  it('treats a malformed file as a failure, never as data', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    requestMoonSystem('uranus', () => Promise.resolve(ok(new ArrayBuffer(4))));
    await vi.waitFor(() => expect(moonSystemStatus('uranus')).toBe('failed'));
    warn.mockRestore();
  });

  it('tells subscribers when a system settles, and runs a waiting action then', async () => {
    const listener = vi.fn();
    const off = subscribeMoonSystems(listener);
    const ran = vi.fn();
    whenMoonSystemSettles('jupiter', ran, () => Promise.resolve(ok(bytes('moons-jupiter'))));
    expect(ran).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(ran).toHaveBeenCalledTimes(1));
    expect(listener).toHaveBeenCalled();
    whenMoonSystemSettles('jupiter', ran); // already ready: runs at once
    expect(ran).toHaveBeenCalledTimes(2);
    off();
  });

  it('isolates throwing listeners: one throws → state is not corrupted, other subscribers still hear it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const thrower = vi.fn(() => {
      throw new Error('subscriber error');
    });
    const other = vi.fn();
    subscribeMoonSystems(thrower);
    subscribeMoonSystems(other);
    requestMoonSystem('saturn', () => Promise.resolve(ok(bytes('moons-saturn'))));
    await vi.waitFor(() => expect(moonSystemStatus('saturn')).toBe('ready'));
    expect(moonSystem('saturn')).not.toBeNull();
    expect(other).toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('Listener threw during moon system notification:', expect.any(Error));
    warn.mockRestore();
  });
});

describe('the spacecraft file (S6c)', () => {
  it('serves the spacecraft file from its own URL', () => {
    expect(moonSystemUrl('spacecraft')).toBe('/ephemeris/horizons/spacecraft.bin');
  });

  it('a failed spacecraft file is final for the page and says so', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetcher = vi.fn(() => Promise.resolve({ ok: false, status: 404, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) }));
    requestMoonSystem('spacecraft', fetcher);
    await vi.waitFor(() => expect(moonSystemStatus('spacecraft')).toBe('failed'));
    requestMoonSystem('spacecraft', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('Spacecraft not drawn');
    warn.mockRestore();
  });
});
