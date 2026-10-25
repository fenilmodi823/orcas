import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Conjunction } from '../data/conjunction-client.js';
import { ConjunctionWarning, type ConjunctionWarningProps } from './ConjunctionWarning.js';

const T0 = Date.parse('2026-09-30T02:51:56Z');
const RUN = { completedAtMs: Date.parse('2026-09-29T10:37:29Z'), windowStartMs: Date.parse('2026-09-29T10:02:05Z'), windowEndMs: Date.parse('2026-09-30T10:02:05Z'), reportingDistanceKm: 5 };
const C: Conjunction = {
  tcaMs: T0, missDistanceKm: 0.028, relativeSpeedKmS: 13.07, maximumPc: 0.313, aspectRatio: 3, hardBodyRadiusKm: 0.02,
  dilutionSigmaKm: 0.0114, valid2d: true, validityReason: null, method: 'm',
  primary: { noradId: '53252', name: 'STARLINK-4158', elementSetEpochMs: T0 - 85_536_000 },
  secondary: { noradId: '58000', name: 'PELICAN-6', elementSetEpochMs: T0 - 43_200_000 },
};
function setup(overrides: Partial<ConjunctionWarningProps> = {}) {
  const props: ConjunctionWarningProps = {
    view: { kind: 'message', run: RUN, pick: { conjunction: C, phase: 'upcoming' } },
    simulationMs: T0 - 252_000, wallNowMs: Date.parse('2026-10-23T14:00:00Z'),
    onWatch: vi.fn(), onGoThere: vi.fn(), onDismiss: vi.fn(), error: null, ...overrides,
  };
  return { props, ...render(<ConjunctionWarning {...props} />) };
}

describe('ConjunctionWarning', () => {
  it('shows the headline, the numbers in mono, and every stated assumption', () => {
    const { container } = setup();
    expect(screen.getByText('Close approach')).toBeTruthy();
    expect(screen.getByText('in 04:12')).toBeTruthy();
    for (const n of ['28 m', '13.07 km/s', '0.31', '3:1', '20 m', '0.99 days']) {
      expect(screen.getByText(n).className).toContain('conjunction-warning__num');
    }
    expect(container.textContent).toContain('Without real uncertainty data, this maximum comes from the miss distance alone.');
    expect(container.textContent).toContain('A screening result, not an operational warning.');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('calls Watch with the pass and dismiss with its key', () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Watch' }));
    expect(props.onWatch).toHaveBeenCalledWith(C);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss this close approach' }));
    expect(props.onDismiss).toHaveBeenCalledWith(`${C.tcaMs}|53252|58000`);
  });

  it('announces a pass once: the countdown is not in the live region', () => {
    const { container, rerender, props } = setup();
    const region = container.querySelector('[aria-live="polite"]');
    const before = region?.textContent;
    rerender(<ConjunctionWarning {...props} simulationMs={T0 - 100_000} />);
    expect(region?.textContent).toBe(before);
    expect(before).toBe('Close approach: STARLINK-4158 and PELICAN-6, 28 m apart, maximum P_c 0.31.');
  });

  it('shows the quiet line with Go there outside the window', () => {
    const { props } = setup({ view: { kind: 'idle', run: RUN }, simulationMs: Date.parse('2026-10-23T14:00:00Z') });
    expect(screen.getByText(/Close-approach warnings cover/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Go there' }));
    expect(props.onGoThere).toHaveBeenCalled();
  });

  it('renders nothing while loading, and the failure text when a replay failed', () => {
    const loading = setup({ view: { kind: 'loading' } });
    expect(loading.container.querySelector('.conjunction-warning')).toBeNull();
    loading.unmount();
    setup({ view: { kind: 'unavailable' }, error: 'history starts at 2026-08-01' });
    expect(screen.getByText('history starts at 2026-08-01')).toBeTruthy();
  });
});
