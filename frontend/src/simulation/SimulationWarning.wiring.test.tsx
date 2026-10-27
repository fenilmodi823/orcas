import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveSceneState } from '../renderer/live/use-live-scene.js';
import type { CatalogProvenance } from '../data/catalog-provenance.js';
import { useSimulationStore } from '../state/simulation-store.js';
import type { WarningView } from '../ui/use-conjunction-warning.js';

const T0 = Date.parse('2026-09-30T02:51:56Z');
const RUN = { completedAtMs: 0, windowStartMs: T0 - 6e7, windowEndMs: T0 + 2.6e7, reportingDistanceKm: 5 };
const warningRates: number[] = [];
vi.mock('./use-simulation-clock.js', () => ({ useSimulationClock: () => ({ getTime: () => T0 + 1e9 }) }));
vi.mock('../ui/use-conjunction-warning.js', () => ({
  useConjunctionWarning: (_n: string | null, _ms: number, rate: number) => {
    warningRates.push(rate);
    const view: WarningView = { kind: 'idle', run: RUN, selectionCovered: false };
    return { view, dismiss: vi.fn() };
  },
}));
const { SimulationWarning } = await import('./SimulationWarning.js');

beforeEach(() => {
  warningRates.length = 0;
  useSimulationStore.setState({ playing: false, rate: 3600, reversed: false });
});

describe('SimulationWarning while paused (spec §3.3)', () => {
  it('Go there keeps the stored rate, and the warning still sees 0', () => {
    const requestView = vi.fn(async () => true);
    render(
      <SimulationWarning
        scene={{ loop: {} } as unknown as LiveSceneState}
        provenance={{ nowMs: T0 } as unknown as CatalogProvenance}
        replay={{ atMs: null, error: null, start: vi.fn(), end: vi.fn() }}
        requestView={requestView}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Go there' }));
    expect(requestView).toHaveBeenCalledWith(expect.objectContaining({ rate: 3600, epochMs: RUN.windowStartMs }), RUN.windowStartMs);
    expect(new Set(warningRates)).toEqual(new Set([0]));
  });
});
