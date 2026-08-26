import { describe, expect, it, beforeEach } from 'vitest';
import { useSelectionStore } from './selection-store.js';
import type { NoradId } from '../data/catalog-types.js';

const NORAD_A = '25544' as NoradId;
const NORAD_B = '90000' as NoradId;

beforeEach(() => {
  useSelectionStore.setState({ selectedNorad: null, hoveredNorad: null });
});

describe('useSelectionStore', () => {
  it('starts with nothing selected or hovered', () => {
    const state = useSelectionStore.getState();
    expect(state.selectedNorad).toBeNull();
    expect(state.hoveredNorad).toBeNull();
  });

  it('setSelected stores the NORAD id, not an object', () => {
    useSelectionStore.getState().setSelected(NORAD_A);
    expect(useSelectionStore.getState().selectedNorad).toBe(NORAD_A);
  });

  it('setHover and setSelected are independent', () => {
    useSelectionStore.getState().setSelected(NORAD_A);
    useSelectionStore.getState().setHover(NORAD_B);
    expect(useSelectionStore.getState().selectedNorad).toBe(NORAD_A);
    expect(useSelectionStore.getState().hoveredNorad).toBe(NORAD_B);
  });

  it('setSelected(null) clears the selection', () => {
    useSelectionStore.getState().setSelected(NORAD_A);
    useSelectionStore.getState().setSelected(null);
    expect(useSelectionStore.getState().selectedNorad).toBeNull();
  });
});
