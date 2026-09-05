import { describe, expect, it, beforeEach, vi } from 'vitest';
import { useViewStore } from './view-store.js';

beforeEach(() => {
  useViewStore.setState({
    activeFilters: new Set(),
    density: 100,
    panelCollapsed: false,
    regimeLegendDismissed: false,
  });
});

describe('useViewStore — density and panel collapse (M1.7b stage 4)', () => {
  it('starts at density 100 (the full catalogue) and an expanded panel', () => {
    const state = useViewStore.getState();
    expect(state.density).toBe(100);
    expect(state.panelCollapsed).toBe(false);
  });

  it('setDensity stores the raw percentage', () => {
    useViewStore.getState().setDensity(42);
    expect(useViewStore.getState().density).toBe(42);
  });

  it('togglePanel flips panelCollapsed and survives a fresh read of state', () => {
    useViewStore.getState().togglePanel();
    expect(useViewStore.getState().panelCollapsed).toBe(true);
    useViewStore.getState().togglePanel();
    expect(useViewStore.getState().panelCollapsed).toBe(false);
  });

  it('never touches localStorage — session state only, per the M1.7b design doc', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    useViewStore.getState().setDensity(10);
    useViewStore.getState().togglePanel();
    expect(setItemSpy).not.toHaveBeenCalled();
    setItemSpy.mockRestore();
  });
});

describe('useViewStore — regime legend dismiss (M1.7c)', () => {
  it('starts shown', () => {
    expect(useViewStore.getState().regimeLegendDismissed).toBe(false);
  });

  it('toggleRegimeLegend flips the dismissed state and survives a fresh read', () => {
    useViewStore.getState().toggleRegimeLegend();
    expect(useViewStore.getState().regimeLegendDismissed).toBe(true);
    useViewStore.getState().toggleRegimeLegend();
    expect(useViewStore.getState().regimeLegendDismissed).toBe(false);
  });

  it('never touches localStorage', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    useViewStore.getState().toggleRegimeLegend();
    expect(setItemSpy).not.toHaveBeenCalled();
    setItemSpy.mockRestore();
  });
});
