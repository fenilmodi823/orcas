import { useRef } from 'react';
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { isUnderChrome, setChromeRect } from '../state/chrome-rects.js';
import { useChromeRect } from './use-chrome-rect.js';

const rect = (x: number, y: number, w: number, h: number) => ({ x, y, width: w, height: h, left: x, top: y, right: x + w, bottom: y + h, toJSON: () => ({}) }) as DOMRectReadOnly;

let now = rect(0, 0, 100, 100);
function Probe({ layoutKey }: { layoutKey: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useChromeRect(ref, 'probe', layoutKey);
  return <div ref={ref} />;
}

afterEach(() => setChromeRect('probe', null));

describe('useChromeRect', () => {
  it('re-measures when the layout key changes, though nothing resized', () => {
    const spy = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'getBoundingClientRect');
    HTMLElement.prototype.getBoundingClientRect = () => now;
    try {
      const { rerender } = render(<Probe layoutKey={false} />);
      expect(isUnderChrome(50, 50)).toBe(true);
      now = rect(500, 0, 100, 100);
      rerender(<Probe layoutKey />);
      expect(isUnderChrome(50, 50)).toBe(false);
      expect(isUnderChrome(550, 50)).toBe(true);
    } finally {
      if (spy) Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', spy);
    }
  });
});
