import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReducedMotion } from './use-reduced-motion.js';
import { selectReducedMotion, useViewStore } from './view-store.js';

type Listener = (event: MediaQueryListEvent) => void;

/** A controllable `matchMedia` so the OS preference can be toggled mid-test,
 * which is the behaviour this hook exists for. */
function installMatchMedia(initial: boolean) {
  const listeners = new Set<Listener>();
  const media = {
    matches: initial,
    addEventListener: (_: string, fn: Listener) => void listeners.add(fn),
    removeEventListener: (_: string, fn: Listener) => void listeners.delete(fn),
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => media),
  );
  return {
    media,
    emit(matches: boolean) {
      media.matches = matches;
      for (const fn of listeners) fn({ matches } as MediaQueryListEvent);
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

beforeEach(() => {
  vi.unstubAllGlobals();
  useViewStore.setState({ osPrefersReducedMotion: false, reducedMotionOverride: null });
});

describe('useReducedMotion', () => {
  it('reports the OS preference at mount', () => {
    installMatchMedia(true);
    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(true);
  });

  it('follows the OS preference when it changes mid-session', () => {
    // The whole reason this is a subscription rather than a one-shot read.
    const mm = installMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    act(() => mm.emit(true));

    expect(result.current).toBe(true);
  });

  it('lets an in-app override win over the OS, in both directions', () => {
    // The OS setting is global; respect it as a default, never as a lock.
    installMatchMedia(true);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);

    act(() => useViewStore.getState().setReducedMotionOverride(false));
    expect(result.current).toBe(false);

    act(() => useViewStore.getState().setReducedMotionOverride(true));
    expect(result.current).toBe(true);
  });

  it('falls back to the OS when the override is cleared', () => {
    installMatchMedia(true);
    const { result } = renderHook(() => useReducedMotion());

    act(() => useViewStore.getState().setReducedMotionOverride(false));
    act(() => useViewStore.getState().setReducedMotionOverride(null));

    expect(result.current).toBe(true);
  });

  it('treats a missing matchMedia as "no preference" rather than crashing', () => {
    vi.stubGlobal('matchMedia', undefined);

    expect(() => renderHook(() => useReducedMotion())).not.toThrow();
  });

  it('unsubscribes on unmount', () => {
    const mm = installMatchMedia(false);
    const { unmount } = renderHook(() => useReducedMotion());
    expect(mm.listenerCount).toBe(1);

    unmount();

    expect(mm.listenerCount).toBe(0);
  });
});

describe('selectReducedMotion', () => {
  it('is one source for the camera and the renderer alike', () => {
    expect(selectReducedMotion({ osPrefersReducedMotion: true, reducedMotionOverride: null } as never)).toBe(true);
    expect(selectReducedMotion({ osPrefersReducedMotion: true, reducedMotionOverride: false } as never)).toBe(false);
    expect(selectReducedMotion({ osPrefersReducedMotion: false, reducedMotionOverride: true } as never)).toBe(true);
  });
});
