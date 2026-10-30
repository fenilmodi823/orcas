import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PUBLISHED_TRUST_MS, isPastPublishedWindow, isStaticSite, presentMs, readSiteFile, resetSiteMode, setDataAsOf,
} from './site-mode.js';

const gzip = async (text: string): Promise<Uint8Array<ArrayBuffer>> => {
  const stream = new Response(text).body?.pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetSiteMode();
});

describe('isStaticSite', () => {
  it('is false unless built with VITE_DATA_MODE=static', () => {
    expect(isStaticSite()).toBe(false);
    vi.stubEnv('VITE_DATA_MODE', 'static');
    expect(isStaticSite()).toBe(true);
  });
});

describe('presentMs — safe when stale (spec §4)', () => {
  const asOf = Date.parse('2026-10-27T06:29:07Z');
  it('is the wall clock locally, whatever the data', () => {
    setDataAsOf(asOf);
    expect(presentMs(asOf + 30 * 86_400_000)).toBe(asOf + 30 * 86_400_000);
  });
  it('is the wall clock on the static site inside the trust window', () => {
    vi.stubEnv('VITE_DATA_MODE', 'static');
    setDataAsOf(asOf);
    expect(presentMs(asOf + 86_400_000)).toBe(asOf + 86_400_000);
    expect(isPastPublishedWindow(asOf + 86_400_000)).toBe(false);
  });
  it('stops at data_as_of + 5 days once the window has passed', () => {
    vi.stubEnv('VITE_DATA_MODE', 'static');
    setDataAsOf(asOf);
    expect(PUBLISHED_TRUST_MS).toBe(5 * 86_400_000);
    expect(presentMs(asOf + 9 * 86_400_000)).toBe(asOf + PUBLISHED_TRUST_MS);
    expect(isPastPublishedWindow(asOf + 9 * 86_400_000)).toBe(true);
  });
  it('is the wall clock when no catalogue file has loaded', () => {
    vi.stubEnv('VITE_DATA_MODE', 'static');
    expect(presentMs(123)).toBe(123);
  });
});

describe('readSiteFile', () => {
  it('unpacks a gzip file', async () => {
    const body = await gzip('{"attribution":"x"}');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body)));
    expect(await readSiteFile('a.json.gz')).toEqual({ attribution: 'x' });
  });
  it('accepts plain JSON when the host already decoded it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"attribution":"y"}')));
    expect(await readSiteFile('a.json.gz')).toEqual({ attribution: 'y' });
  });
  it('fetches each file once per page load', async () => {
    const fetchMock = vi.fn(async () => new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    await readSiteFile('b.json.gz');
    await readSiteFile('b.json.gz');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/data/b.json.gz');
  });
  it('rejects a missing file, and tries again next time', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(readSiteFile('c.json.gz')).rejects.toThrow('404');
    await expect(readSiteFile('c.json.gz')).rejects.toThrow('404');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('rejects JSON that is not an object', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('[1]')));
    await expect(readSiteFile('d.json.gz')).rejects.toThrow('not a JSON object');
  });
});
