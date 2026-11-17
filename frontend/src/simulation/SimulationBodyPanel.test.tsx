import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { isUnderChrome } from '../state/chrome-rects.js';
import { bodyById } from '../renderer/solar/bodies.js';
import type { LiveSceneState } from '../renderer/live/use-live-scene.js';
import { SimulationBodyPanel } from './SimulationBodyPanel.js';

const rect = { x: 16, y: 16, width: 340, height: 600, left: 16, top: 16, right: 356, bottom: 616, toJSON: () => ({}) } as DOMRectReadOnly;

describe('SimulationBodyPanel', () => {
  const original = HTMLElement.prototype.getBoundingClientRect;
  afterEach(() => { HTMLElement.prototype.getBoundingClientRect = original; });

  it('registers its glass as chrome, so labels hide under it', () => {
    HTMLElement.prototype.getBoundingClientRect = () => rect;
    const scene = { loop: { frameStateRef: { current: { epochMs: 0 } }, startEpochMs: Date.parse('2026-11-01T00:00:00Z') } } as unknown as LiveSceneState;
    const body = bodyById('jupiter');
    if (!body) throw new Error('no jupiter');
    const { unmount } = render(<SimulationBodyPanel scene={scene} body={body} />);
    expect(isUnderChrome(100, 100)).toBe(true);
    unmount();
    expect(isUnderChrome(100, 100)).toBe(false);
  });
});
