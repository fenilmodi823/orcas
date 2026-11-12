import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { setChromeRect } from '../state/chrome-rects.js';
import { WarningSlot } from './WarningSlot.js';

afterEach(() => setChromeRect('epoch', null));

describe('the close-approach warning slot', () => {
  it('starts --space-2 below the measured bottom of the epoch block', () => {
    const { container } = render(<WarningSlot>x</WarningSlot>);
    const slot = container.querySelector<HTMLElement>('.simulation__warning');
    act(() => setChromeRect('epoch', new DOMRect(700, 20, 300, 70)));
    expect(parseFloat(slot?.style.getPropertyValue('--warning-top') ?? '')).toBeGreaterThanOrEqual(98);
  });
  it('leaves the CSS fallback until the first measure', () => {
    const { container } = render(<WarningSlot>x</WarningSlot>);
    expect(container.querySelector<HTMLElement>('.simulation__warning')?.style.getPropertyValue('--warning-top')).toBe('');
  });
});
