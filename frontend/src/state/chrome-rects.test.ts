import { afterEach, describe, expect, it } from 'vitest';
import { isUnderChrome, setChromeRect } from './chrome-rects.js';

const rect = (x: number, y: number, w: number, h: number) => ({ x, y, width: w, height: h, left: x, top: y, right: x + w, bottom: y + h, toJSON: () => ({}) }) as DOMRectReadOnly;

afterEach(() => { setChromeRect('a', null); setChromeRect('b', null); });

describe('labels under the chrome (Stage B §5.1)', () => {
  it('is under a registered rectangle', () => {
    setChromeRect('a', rect(1500, 56, 400, 300));
    expect(isUnderChrome(1600, 100)).toBe(true);
    expect(isUnderChrome(1400, 100)).toBe(false);
  });
  it('forgets a rectangle once its owner unmounts', () => {
    setChromeRect('a', rect(0, 0, 100, 100));
    setChromeRect('a', null);
    expect(isUnderChrome(50, 50)).toBe(false);
  });
  it('checks every rectangle', () => {
    setChromeRect('a', rect(0, 0, 10, 10));
    setChromeRect('b', rect(100, 100, 10, 10));
    expect(isUnderChrome(105, 105)).toBe(true);
  });
});
