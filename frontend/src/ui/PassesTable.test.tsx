import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Conjunction } from '../data/conjunction-client.js';
import { setChromeRect } from '../state/chrome-rects.js';
import { PassesTable } from './PassesTable.js';

const T0 = Date.parse('2026-09-30T02:51:56Z');
const RUN = { completedAtMs: T0, windowStartMs: T0 - 3_600_000, windowEndMs: T0 + 3_600_000, reportingDistanceKm: 5 };
const C: Conjunction = {
  tcaMs: T0, missDistanceKm: 0.028, relativeSpeedKmS: 13.07, maximumPc: 0.313, aspectRatio: 3, hardBodyRadiusKm: 0.02,
  dilutionSigmaKm: 0.0114, valid2d: true, validityReason: null, method: 'm',
  primary: { noradId: '53252', name: 'STARLINK-4158', elementSetEpochMs: T0 },
  secondary: { noradId: '58000', name: 'PELICAN-6', elementSetEpochMs: T0 },
};
const rect = (top: number, bottom: number) => ({ x: 0, y: top, width: 100, height: bottom - top, left: 0, top, right: 100, bottom, toJSON: () => ({}) }) as DOMRectReadOnly;

afterEach(() => { cleanup(); setChromeRect('bottom', null); vi.restoreAllMocks(); });

describe('the open passes table stops above the bottom stack', () => {
  it('caps its height so its bottom clears the measured stack top by a gap', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect(112, 737));
    setChromeRect('bottom', rect(667, 892));
    const { container } = render(<PassesTable run={RUN} passes={[C]} wallNowMs={T0} onWatch={vi.fn()} onHide={vi.fn()} />);
    const table = container.querySelector<HTMLElement>('.passes-table');
    const cap = parseFloat(table?.style.getPropertyValue('--passes-max-h') ?? '');
    expect(112 + cap).toBeLessThanOrEqual(667 - 8);
  });
});
