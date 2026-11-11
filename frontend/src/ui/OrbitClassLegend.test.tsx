import { StrictMode } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrbitClassLegend } from './OrbitClassLegend.js';
import { useViewStore } from '../state/view-store.js';

type ChangeListener = (event: { matches: boolean }) => void;

/** Stub `matchMedia` with one controllable query; `fire` plays a `change` event. */
function stubMatchMedia(matches: boolean) {
  const listeners = new Set<ChangeListener>();
  const mql = {
    matches,
    addEventListener: (_type: string, listener: ChangeListener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: ChangeListener) => listeners.delete(listener),
  };
  vi.stubGlobal('matchMedia', () => mql);
  return {
    listeners,
    fire(next: boolean) {
      mql.matches = next;
      listeners.forEach((listener) => listener({ matches: next }));
    },
  };
}

describe('OrbitClassLegend', () => {
  beforeEach(() => useViewStore.setState({ orbitClassLegendDismissed: false }));
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('says the markers are not to scale', () => {
    stubMatchMedia(false);
    render(<OrbitClassLegend />);
    expect(screen.getByText('Markers are not to scale.')).toBeTruthy();
  });

  it('folds on mount when narrow, also in StrictMode', () => {
    stubMatchMedia(true);
    render(
      <StrictMode>
        <OrbitClassLegend />
      </StrictMode>,
    );
    expect(useViewStore.getState().orbitClassLegendDismissed).toBe(true);
    expect(screen.getByLabelText('Show orbit class legend')).toBeTruthy();
  });

  it('stays open on mount when wide', () => {
    stubMatchMedia(false);
    render(<OrbitClassLegend />);
    expect(useViewStore.getState().orbitClassLegendDismissed).toBe(false);
  });

  it('folds when the window narrows, and does not unfold when it widens again', () => {
    const media = stubMatchMedia(false);
    const { unmount } = render(<OrbitClassLegend />);
    act(() => media.fire(true));
    expect(useViewStore.getState().orbitClassLegendDismissed).toBe(true);
    useViewStore.setState({ orbitClassLegendDismissed: false });
    act(() => media.fire(false));
    expect(useViewStore.getState().orbitClassLegendDismissed).toBe(false);
    unmount();
    expect(media.listeners.size).toBe(0);
  });
});
