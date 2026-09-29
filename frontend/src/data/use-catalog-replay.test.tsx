import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCatalog } from './use-catalog.js';

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

const AT_MS = Date.UTC(2026, 8, 20, 12);

function record(norad: string, epoch: string) {
  return {
    OBJECT_NAME: `ORCAS-REPLAY-${norad}`,
    OBJECT_ID: '1998-999Z',
    EPOCH: epoch,
    MEAN_MOTION: 15.5,
    ECCENTRICITY: 0.0001,
    INCLINATION: 51.6,
    RA_OF_ASC_NODE: 0,
    ARG_OF_PERICENTER: 0,
    MEAN_ANOMALY: 0,
    EPHEMERIS_TYPE: 0,
    CLASSIFICATION_TYPE: 'U',
    NORAD_CAT_ID: norad,
    ELEMENT_SET_NO: 999,
    REV_AT_EPOCH: 1,
    BSTAR: 0,
    MEAN_MOTION_DOT: 0,
    MEAN_MOTION_DDOT: 0,
  };
}

function ReplayProbe() {
  const catalog = useCatalog();
  return (
    <div
      data-loading={catalog.loading}
      data-origin={catalog.origin}
      data-replay={catalog.replayAtMs ?? 'none'}
      data-count={catalog.snapshot?.objects.length ?? 'none'}
      data-replay-error={catalog.replayError ?? 'none'}
      data-fetched={catalog.snapshot?.fetchedAtMs ?? 'none'}
    >
      <button onClick={() => void catalog.startReplay(AT_MS)}>replay</button>
      <button onClick={catalog.endReplay}>live</button>
    </div>
  );
}

const probe = () => document.querySelector('[data-origin]') as HTMLElement;

beforeEach(() => {
  fetchCatalogSnapshot.mockReset();
  fetchCatalogReplay.mockReset();
  persistSnapshot.mockClear();
  fetchCatalogSnapshot.mockResolvedValue([record('90001', new Date().toISOString())]);
});

describe('useCatalog — historical replay', () => {
  it('serves the catalogue as it stood at the replay moment, and never persists it', async () => {
    fetchCatalogReplay.mockResolvedValue([
      record('90001', '2026-09-20T00:00:00Z'),
      record('90002', '2026-09-19T00:00:00Z'),
    ]);
    const { getByText } = render(<ReplayProbe />);
    await waitFor(() => expect(probe().dataset.origin).toBe('live'));

    fireEvent.click(getByText('replay'));

    await waitFor(() => expect(probe().dataset.origin).toBe('replay'));
    expect(fetchCatalogReplay).toHaveBeenCalledWith(AT_MS);
    expect(probe().dataset.replay).toBe(String(AT_MS));
    expect(probe().dataset.count).toBe('2');
    expect(persistSnapshot).toHaveBeenCalledTimes(1); // the live load only
    // Validated against the replay instant, but fetched just now.
    expect(Number(probe().dataset.fetched)).toBeGreaterThan(Date.now() - 60_000);
  });

  it("keeps what is on screen and reports the backend's reason when replay fails", async () => {
    fetchCatalogReplay.mockRejectedValue(new Error('no element sets stored - the earliest is 2026-08-01'));
    const { getByText } = render(<ReplayProbe />);
    await waitFor(() => expect(probe().dataset.origin).toBe('live'));

    fireEvent.click(getByText('replay'));

    await waitFor(() => expect(probe().dataset.replayError).toContain('earliest'));
    expect(probe().dataset.origin).toBe('live');
    expect(probe().dataset.count).toBe('1');
  });

  it('returns to live data', async () => {
    fetchCatalogReplay.mockResolvedValue([record('90001', '2026-09-20T00:00:00Z')]);
    const { getByText } = render(<ReplayProbe />);
    await waitFor(() => expect(probe().dataset.origin).toBe('live'));
    fireEvent.click(getByText('replay'));
    await waitFor(() => expect(probe().dataset.origin).toBe('replay'));

    fireEvent.click(getByText('live'));

    await waitFor(() => expect(probe().dataset.origin).toBe('live'));
    expect(probe().dataset.replay).toBe('none');
    expect(fetchCatalogSnapshot).toHaveBeenCalledTimes(2);
  });
});
