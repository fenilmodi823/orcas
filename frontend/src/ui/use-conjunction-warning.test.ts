import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Conjunction, ConjunctionReport } from '../data/conjunction-client.js';
import type { ConjunctionView } from './conjunction-detail.js';

const fetchTop = vi.fn<() => Promise<ConjunctionReport>>();
vi.mock('../data/conjunction-client.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/conjunction-client.js')>()),
  fetchTopConjunctions: () => fetchTop(),
}));
let selectedView: ConjunctionView | null = null;
vi.mock('./use-conjunctions.js', () => ({ useConjunctions: () => selectedView }));

const { useConjunctionWarning } = await import('./use-conjunction-warning.js');
const { warningKey } = await import('./conjunction-warning.js');

const T0 = Date.parse('2026-09-30T02:51:56Z');
const RUN = { completedAtMs: T0 - 1e8, windowStartMs: T0 - 6e7, windowEndMs: T0 + 2.6e7, reportingDistanceKm: 5 };
const pass = (tcaMs: number, maximumPc: number | null = 0.3): Conjunction => ({
  tcaMs, missDistanceKm: 0.03, relativeSpeedKmS: 13, maximumPc, aspectRatio: 3, hardBodyRadiusKm: 0.02,
  dilutionSigmaKm: 0.01, valid2d: maximumPc !== null, validityReason: null, method: 'm',
  primary: { noradId: '1', name: 'A', elementSetEpochMs: T0 - 1e7 },
  secondary: { noradId: '2', name: 'B', elementSetEpochMs: T0 - 1e7 },
});

afterEach(() => { fetchTop.mockReset(); selectedView = null; });

describe('useConjunctionWarning', () => {
  it('is loading, then idle with the run when nothing is due', async () => {
    fetchTop.mockResolvedValue({ run: RUN, items: [pass(T0)], rejected: 0 });
    const { result } = renderHook(() => useConjunctionWarning(null, T0 - 3_600_000, 1));
    expect(result.current.view.kind).toBe('loading');
    await waitFor(() => expect(result.current.view).toEqual({ kind: 'idle', run: RUN }));
  });

  it('shows a due pass from the top 10, and one from the selected object', async () => {
    const own = pass(T0 + 60_000);
    fetchTop.mockResolvedValue({ run: RUN, items: [], rejected: 0 });
    selectedView = { kind: 'report', report: { run: RUN, items: [own], rejected: 0 } };
    const { result } = renderHook(() => useConjunctionWarning('1', T0, 1));
    await waitFor(() => expect(result.current.view.kind).toBe('message'));
    const view = result.current.view;
    expect(view.kind === 'message' && view.pick.conjunction).toBe(own);
  });

  it('keeps a shown pass as passed, and dismiss hides it', async () => {
    const a = pass(T0);
    fetchTop.mockResolvedValue({ run: RUN, items: [a], rejected: 0 });
    const { result, rerender } = renderHook(({ now }) => useConjunctionWarning(null, now, 1), { initialProps: { now: T0 - 1000 } });
    await waitFor(() => expect(result.current.view.kind).toBe('message'));
    rerender({ now: T0 + 5000 });
    const view = result.current.view;
    expect(view.kind === 'message' && view.pick.phase).toBe('passed');
    act(() => result.current.dismiss(warningKey(a)));
    expect(result.current.view).toEqual({ kind: 'idle', run: RUN });
  });

  it('says unavailable when the top-10 fetch fails, and not-screened with no run', async () => {
    fetchTop.mockRejectedValueOnce(new Error('down'));
    const failed = renderHook(() => useConjunctionWarning(null, T0, 1));
    await waitFor(() => expect(failed.result.current.view).toEqual({ kind: 'unavailable' }));
    fetchTop.mockResolvedValueOnce({ run: null, items: [], rejected: 0 });
    const empty = renderHook(() => useConjunctionWarning(null, T0, 1));
    await waitFor(() => expect(empty.result.current.view).toEqual({ kind: 'not-screened' }));
  });
});
