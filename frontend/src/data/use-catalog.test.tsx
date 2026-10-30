import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCatalog } from './use-catalog.js';
import { resetSiteMode, setDataAsOf } from './site-mode.js';

const { fetchCatalogSnapshot, fetchCatalogReplay } = vi.hoisted(() => ({
  fetchCatalogSnapshot: vi.fn(),
  fetchCatalogReplay: vi.fn(),
}));
vi.mock('./catalog-client.js', () => ({ fetchCatalogSnapshot, fetchCatalogReplay }));

const { loadPersistedSnapshot, persistSnapshot } = vi.hoisted(() => ({
  loadPersistedSnapshot: vi.fn(),
  persistSnapshot: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./catalog-db.js', () => ({ loadPersistedSnapshot, persistSnapshot }));

const { fallbackRecords } = vi.hoisted(() => ({
  fallbackRecords: [
    {
      OBJECT_NAME: 'ORCAS-FALLBACK-01',
      OBJECT_ID: '2026-999A',
      EPOCH: new Date().toISOString(),
      MEAN_MOTION: 14.5,
      ECCENTRICITY: 0.0001,
      INCLINATION: 51.6,
      RA_OF_ASC_NODE: 0,
      ARG_OF_PERICENTER: 0,
      MEAN_ANOMALY: 0,
      EPHEMERIS_TYPE: 0,
      CLASSIFICATION_TYPE: 'U',
      NORAD_CAT_ID: '90999',
      ELEMENT_SET_NO: 999,
      REV_AT_EPOCH: 1,
      BSTAR: 0,
      MEAN_MOTION_DOT: 0,
      MEAN_MOTION_DDOT: 0,
    },
  ],
}));
vi.mock('./fallback-snapshot.js', () => ({ fallbackRecords }));

function CatalogProbe() {
  const state = useCatalog();
  return (
    <div
      data-loading={state.loading}
      data-origin={state.origin}
      data-count={state.snapshot?.objects.length ?? 'none'}
      data-error={state.error ?? 'none'}
      data-rejected={state.snapshot?.rejected.length ?? 'none'}
    />
  );
}

function readProbe(): HTMLElement {
  return document.querySelector('[data-origin]') as HTMLElement;
}

beforeEach(() => {
  fetchCatalogSnapshot.mockReset();
  loadPersistedSnapshot.mockReset();
  persistSnapshot.mockClear();
});

describe('useCatalog', () => {
  it('serves a live snapshot and persists it', async () => {
    fetchCatalogSnapshot.mockResolvedValue([
      {
        OBJECT_NAME: 'ORCAS-TEST-SAT',
        OBJECT_ID: '1998-999Z',
        EPOCH: new Date().toISOString(),
        MEAN_MOTION: 15.5,
        ECCENTRICITY: 0.0001,
        INCLINATION: 51.6,
        RA_OF_ASC_NODE: 0,
        ARG_OF_PERICENTER: 0,
        MEAN_ANOMALY: 0,
        EPHEMERIS_TYPE: 0,
        CLASSIFICATION_TYPE: 'U',
        NORAD_CAT_ID: '90001',
        ELEMENT_SET_NO: 999,
        REV_AT_EPOCH: 1,
        BSTAR: 0,
        MEAN_MOTION_DOT: 0,
        MEAN_MOTION_DDOT: 0,
      },
    ]);

    render(<CatalogProbe />);

    await waitFor(() => expect(readProbe().dataset.loading).toBe('false'));
    expect(readProbe().dataset.origin).toBe('live');
    expect(readProbe().dataset.count).toBe('1');
    expect(persistSnapshot).toHaveBeenCalledTimes(1);
  });

  it('falls back to the persisted snapshot when the live fetch fails', async () => {
    fetchCatalogSnapshot.mockRejectedValue(new Error('network down'));
    const cached = {
      version: 1,
      fetchedAtMs: Date.now() - 60_000,
      objects: [],
      byNorad: {},
      rejected: [],
    };
    loadPersistedSnapshot.mockResolvedValue(cached);

    render(<CatalogProbe />);

    await waitFor(() => expect(readProbe().dataset.loading).toBe('false'));
    expect(readProbe().dataset.origin).toBe('cached');
    expect(readProbe().dataset.count).toBe('0');
  });

  it('falls back to the bundled sample snapshot when both the live fetch and the cache fail', async () => {
    fetchCatalogSnapshot.mockRejectedValue(new Error('network down'));
    loadPersistedSnapshot.mockResolvedValue(null);

    render(<CatalogProbe />);

    await waitFor(() => expect(readProbe().dataset.loading).toBe('false'));
    expect(readProbe().dataset.origin).toBe('bundled');
    expect(readProbe().dataset.count).toBe('1');
    // Never blank (Rules.md §4): the bundled snapshot is not persisted —
    // it's a last resort, not something that should overwrite a real
    // cached snapshot on a later visit.
    expect(persistSnapshot).not.toHaveBeenCalled();
  });

  describe('on the static site', () => {
    const DAY = 86_400_000;
    const AS_OF = Date.parse('2026-10-27T06:29:07Z');
    const good = { ...fallbackRecords[0], EPOCH: new Date(AS_OF).toISOString() };

    afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllEnvs();
      resetSiteMode();
    });

    it('reports the published origin', async () => {
      vi.stubEnv('VITE_DATA_MODE', 'static');
      fetchCatalogSnapshot.mockImplementation(async () => {
        setDataAsOf(Date.now());
        return [{ ...good, EPOCH: new Date().toISOString() }];
      });
      render(<CatalogProbe />);
      await waitFor(() => expect(readProbe().dataset.loading).toBe('false'));
      expect(readProbe().dataset.origin).toBe('published');
    });

    it('validates against the clamped present and counts a record that cannot reach it', async () => {
      vi.stubEnv('VITE_DATA_MODE', 'static');
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(AS_OF + 9 * DAY);
      const doomed = {
        ...good,
        NORAD_CAT_ID: '90002',
        EPOCH: new Date(AS_OF - 60 * DAY).toISOString(),
        MEAN_MOTION: 16.4,
        ECCENTRICITY: 0.05,
        BSTAR: 0.5,
      };
      fetchCatalogSnapshot.mockImplementation(async () => {
        setDataAsOf(AS_OF);
        return [good, doomed];
      });
      render(<CatalogProbe />);
      await waitFor(() => expect(readProbe().dataset.loading).toBe('false'));
      expect(readProbe().dataset.origin).toBe('published');
      expect(readProbe().dataset.count).toBe('1');
      expect(readProbe().dataset.rejected).toBe('1');
    });
  });
});
