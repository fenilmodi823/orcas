import { describe, expect, it, beforeEach } from 'vitest';
import { pinnedLabelNorad, useSelectionStore, type WatchPair } from './selection-store.js';
import type { NoradId } from '../data/catalog-types.js';

const NORAD_A = '25544' as NoradId;
const NORAD_B = '90000' as NoradId;

beforeEach(() => {
  useSelectionStore.setState({ selectedNorad: null, hoveredNorad: null, selectedBody: null, hoveredBody: null, watchPair: null });
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

  it('keeps one thing selected: a body clears a satellite, and a satellite a body (S5a)', () => {
    const store = useSelectionStore.getState();
    store.setSelected(NORAD_A);
    store.setSelectedBody('jupiter');
    expect(useSelectionStore.getState()).toMatchObject({ selectedNorad: null, selectedBody: 'jupiter' });
    store.setSelected(NORAD_B);
    expect(useSelectionStore.getState()).toMatchObject({ selectedNorad: NORAD_B, selectedBody: null });
  });

  it('clearing one never clears the other', () => {
    const store = useSelectionStore.getState();
    store.setSelectedBody('moon');
    store.setSelected(null);
    expect(useSelectionStore.getState().selectedBody).toBe('moon');
  });
});

describe('the Watch pair (spec §4: cleared by any other selection change)', () => {
  const pair: WatchPair = { follow: NORAD_A, counterpart: NORAD_B };
  const watching = () => {
    useSelectionStore.setState({ selectedNorad: NORAD_A, watchPair: pair });
    return useSelectionStore.getState();
  };

  it('survives re-selecting the followed object', () => {
    watching().setSelected(NORAD_A);
    expect(useSelectionStore.getState().watchPair).toBe(pair);
  });

  it('is cleared by selecting anything else, a body, or nothing', () => {
    watching().setSelected(NORAD_B);
    expect(useSelectionStore.getState().watchPair).toBeNull();
    watching().setSelected(null);
    expect(useSelectionStore.getState().watchPair).toBeNull();
    watching().setSelectedBody('moon');
    expect(useSelectionStore.getState().watchPair).toBeNull();
    watching().clearSelection();
    expect(useSelectionStore.getState().watchPair).toBeNull();
  });

  it('is kept when a body is deselected', () => {
    watching().setSelectedBody(null);
    expect(useSelectionStore.getState().watchPair).toBe(pair);
  });
});

describe('pinnedLabelNorad', () => {
  const pair: WatchPair = { follow: '1' as NoradId, counterpart: '2' as NoradId };
  it('pins the counterpart only while the followed object is selected', () => {
    expect(pinnedLabelNorad({ selectedNorad: '1' as NoradId, watchPair: pair })).toBe('2');
    expect(pinnedLabelNorad({ selectedNorad: '3' as NoradId, watchPair: pair })).toBeNull();
    expect(pinnedLabelNorad({ selectedNorad: '1' as NoradId, watchPair: null })).toBeNull();
  });
});
