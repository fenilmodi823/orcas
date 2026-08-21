import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCatalog } from './use-catalog.js';

const { fetchCatalogSnapshot } = vi.hoisted(() => ({ fetchCatalogSnapshot: vi.fn() }));
vi.mock('./catalog-client.js', () => ({ fetchCatalogSnapshot }));

const { loadPersistedSnapshot, persistSnapshot } = vi.hoisted(() => ({
  loadPersistedSnapshot: vi.fn(),
  persistSnapshot: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./catalog-db.js', () => ({ loadPersistedSnapshot, persistSnapshot }));

function CatalogProbe() {
  const state = useCatalog();
  return (
    <div
      data-loading={state.loading}
      data-origin={state.origin}
      data-count={state.snapshot?.objects.length ?? 'none'}
      data-error={state.error ?? 'none'}
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

  it('reports unavailable when both the live fetch and the cache fail', async () => {
    fetchCatalogSnapshot.mockRejectedValue(new Error('network down'));
    loadPersistedSnapshot.mockResolvedValue(null);

    render(<CatalogProbe />);

    await waitFor(() => expect(readProbe().dataset.loading).toBe('false'));
    expect(readProbe().dataset.origin).toBe('unavailable');
    expect(readProbe().dataset.error).toBe('network down');
  });
});
