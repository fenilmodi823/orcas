import { afterEach, describe, expect, it, vi } from 'vitest';
import { CatalogFetchError, fetchCatalogMeta, fetchCatalogReplay, fetchCatalogSnapshot, REPLAY_LOCAL_ONLY } from './catalog-client.js';
import { dataAsOf, resetSiteMode } from './site-mode.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchCatalogSnapshot', () => {
  it('returns the parsed JSON array on success', async () => {
    const records = [{ OBJECT_NAME: 'ISS' }];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(records) }),
    );
    await expect(fetchCatalogSnapshot()).resolves.toEqual(records);
  });

  it('throws CatalogFetchError on a non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(fetchCatalogSnapshot()).rejects.toBeInstanceOf(CatalogFetchError);
  });

  it('throws CatalogFetchError if the body is not an array', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ not: 'an array' }) }),
    );
    await expect(fetchCatalogSnapshot()).rejects.toBeInstanceOf(CatalogFetchError);
  });

  it('throws CatalogFetchError if the network call itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(fetchCatalogSnapshot()).rejects.toBeInstanceOf(CatalogFetchError);
  });
});

describe('fetchCatalogMeta', () => {
  it('maps snake_case backend fields to camelCase', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            object_count: 22,
            newest_epoch: '2026-08-15T00:00:00Z',
            source: 'celestrak',
            generated_at: '2026-08-15T00:51:00Z',
          }),
      }),
    );
    await expect(fetchCatalogMeta()).resolves.toEqual({
      objectCount: 22,
      newestEpoch: '2026-08-15T00:00:00Z',
      source: 'celestrak',
      generatedAt: '2026-08-15T00:51:00Z',
    });
  });

  it('throws CatalogFetchError on a non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(fetchCatalogMeta()).rejects.toBeInstanceOf(CatalogFetchError);
  });
});

describe('fetchCatalogReplay', () => {
  it('asks for the catalogue at the given instant, in UTC', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
    vi.stubGlobal('fetch', fetchMock);
    await fetchCatalogReplay(Date.UTC(2026, 8, 20, 12));
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/v1/catalog/replay?at=2026-09-20T12%3A00%3A00.000Z');
  });

  it("carries the backend's reason when there is no history that far back", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ detail: 'no element sets stored - the earliest is 2026-08-01' }),
      }),
    );
    await expect(fetchCatalogReplay(0)).rejects.toThrow(/earliest is 2026-08-01/);
  });
});

describe('static site (spec §4)', () => {
  const top = {
    attribution: 'a',
    run: { completed_at: '2026-10-27T07:03:21Z', window_start: '2026-10-27T06:29:07Z', window_end: '2026-10-28T06:29:07Z', reporting_distance_km: 5 },
    items: [],
  };
  const catalog = { attribution: 'a', generated_at: '2026-10-27T07:40:00Z', data_as_of: '2026-10-27T06:29:07Z', source: 'spacetrack-gp', records: [{ NORAD_CAT_ID: '25544' }] };
  const files = () => vi.fn(async (url: string) =>
    new Response(JSON.stringify(url.includes('top') ? top : catalog)));
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); resetSiteMode(); });

  it('reads the baked catalogue and records the instant its data stands for', async () => {
    vi.stubEnv('VITE_DATA_MODE', 'static');
    vi.stubGlobal('fetch', files());
    expect(await fetchCatalogSnapshot()).toEqual(catalog.records);
    expect(dataAsOf()).toBe(Date.parse('2026-10-27T06:29:07Z'));
  });

  it('a replay inside the screened day is the baked catalogue, with no server', async () => {
    vi.stubEnv('VITE_DATA_MODE', 'static');
    const fetchMock = files();
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchCatalogReplay(Date.parse('2026-10-27T06:29:07Z'))).toEqual(catalog.records);
    expect(fetchMock.mock.calls.every(([url]) => String(url).startsWith('/data/'))).toBe(true);
  });

  it('a replay of any other day is refused with the local-version line', async () => {
    vi.stubEnv('VITE_DATA_MODE', 'static');
    vi.stubGlobal('fetch', files());
    await expect(fetchCatalogReplay(Date.parse('2026-10-20T00:00:00Z'))).rejects.toThrow(REPLAY_LOCAL_ONLY);
  });

  it('a catalogue file without records is rejected', async () => {
    vi.stubEnv('VITE_DATA_MODE', 'static');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"attribution":"a"}')));
    await expect(fetchCatalogSnapshot()).rejects.toBeInstanceOf(CatalogFetchError);
  });
});
