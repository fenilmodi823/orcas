import { afterEach, describe, expect, it, vi } from 'vitest';
import { CatalogFetchError } from './catalog-client.js';
import { fetchConjunctions, fetchTopConjunctions, parseConjunction, shardOf } from './conjunction-client.js';
import { resetSiteMode } from './site-mode.js';

const party = (norad: string) => ({ norad_id: norad, name: `OBJ ${norad}`, object_type: 'PAYLOAD', element_set_epoch: '2026-09-27T01:00:00+00:00' });
const raw = {
  tca: '2026-09-27T18:00:00+00:00',
  miss_distance_km: 0.698,
  relative_speed_km_s: 11.647,
  maximum_pc: 9.06e-4,
  pc_method: 'closed_form',
  aspect_ratio: 3,
  hard_body_radius_km: 0.02,
  dilution_sigma_km: 0.285,
  valid_2d: true,
  validity_reason: null,
  encounter_duration_s: 0.25,
  method: 'Upper bound over uncertainty ellipses of 3:1 aspect ratio (Alfano 2005).',
  primary: party('24946'),
  secondary: party('22675'),
};

describe('parseConjunction — the trust boundary', () => {
  it('accepts a well-formed item', () => {
    expect(parseConjunction(raw)?.maximumPc).toBe(9.06e-4);
  });

  it('rejects a number where the 2D model does not apply', () => {
    expect(parseConjunction({ ...raw, valid_2d: false, validity_reason: 'too slow' })).toBeUndefined();
  });

  it('rejects an item missing the aspect ratio a maximum is meaningless without', () => {
    const withoutFamily: Record<string, unknown> = { ...raw };
    delete withoutFamily.aspect_ratio;
    expect(parseConjunction(withoutFamily)).toBeUndefined();
  });

  it('rejects an unparseable TCA', () => {
    expect(parseConjunction({ ...raw, tca: 'not a time' })).toBeUndefined();
  });
});

const rawRun = {
  completed_at: '2026-09-29T10:37:29+00:00',
  window_start: '2026-09-29T10:02:05+00:00',
  window_end: '2026-09-30T10:02:05+00:00',
  reporting_distance_km: 5,
};

describe('fetchTopConjunctions', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubFetch(body: unknown, status = 200) {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify(body), { status }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it("asks for the run's top 10 with no object filter", async () => {
    const fetchMock = stubFetch({ run: null, items: [] });
    const report = await fetchTopConjunctions();
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/v1\/conjunctions\?limit=10$/);
    expect(report).toEqual({ run: null, items: [], rejected: 0 });
  });

  it('keeps the run and drops a malformed item, counting it', async () => {
    stubFetch({ run: rawRun, items: [raw, { tca: 'not a date' }] });
    const report = await fetchTopConjunctions();
    expect(report.run?.windowStartMs).toBe(Date.parse('2026-09-29T10:02:05Z'));
    expect(report.items).toHaveLength(1);
    expect(report.rejected).toBe(1);
  });

  it('throws CatalogFetchError on a non-OK status', async () => {
    stubFetch({ detail: 'boom' }, 500);
    await expect(fetchTopConjunctions()).rejects.toBeInstanceOf(CatalogFetchError);
  });
});

describe('static site (spec §4)', () => {
  const run = {
    completed_at: '2026-10-27T07:03:21Z', window_start: '2026-10-27T06:29:07Z', window_end: '2026-10-28T06:29:07Z',
    reporting_distance_km: 5,
  };
  const file = (body: unknown) => vi.fn(async (url: string) =>
    url.endsWith('.json.gz') ? new Response(JSON.stringify(body)) : new Response('', { status: 500 }));
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); resetSiteMode(); });

  it('shards by the last two characters, padded', () => {
    expect(shardOf('25544')).toBe('44');
    expect(shardOf('5')).toBe('05');
  });

  it('reads the top 10 from the baked file, never /api', async () => {
    vi.stubEnv('VITE_DATA_MODE', 'static');
    const fetchMock = file({ attribution: 'a', run, items: [raw] });
    vi.stubGlobal('fetch', fetchMock);
    const report = await fetchTopConjunctions();
    expect(report.items).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith('/data/conjunctions/top.json.gz');
  });

  it("reads one object's passes from its shard", async () => {
    vi.stubEnv('VITE_DATA_MODE', 'static');
    const fetchMock = file({ attribution: 'a', run, objects: { '24946': [raw] } });
    vi.stubGlobal('fetch', fetchMock);
    expect((await fetchConjunctions('24946')).items).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith('/data/conjunctions/by-object/46.json.gz');
  });

  it('an object absent from its shard has no passes (not an error)', async () => {
    vi.stubEnv('VITE_DATA_MODE', 'static');
    vi.stubGlobal('fetch', file({ attribution: 'a', run, objects: {} }));
    expect((await fetchConjunctions('11146')).items).toEqual([]);
  });

  it('a missing shard is an error, never an empty list', async () => {
    vi.stubEnv('VITE_DATA_MODE', 'static');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
    await expect(fetchConjunctions('24946')).rejects.toBeInstanceOf(CatalogFetchError);
  });

  it('an aborted request does not resolve with a stale list', async () => {
    vi.stubEnv('VITE_DATA_MODE', 'static');
    vi.stubGlobal('fetch', file({ attribution: 'a', run, objects: { '24946': [raw] } }));
    const controller = new AbortController();
    const pending = fetchConjunctions('24946', controller.signal);
    controller.abort();
    await expect(pending).rejects.toThrow();
  });
});
