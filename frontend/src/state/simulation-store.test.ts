import { beforeEach, describe, expect, it } from 'vitest';
import { effectiveRate, useSimulationStore } from './simulation-store.js';

beforeEach(() => {
  useSimulationStore.setState({ rate: 1, reversed: false, playing: true, live: true });
});

describe('simulation store', () => {
  it('opens playing, in real time, as NASA Eyes does', () => {
    expect(useSimulationStore.getInitialState().playing).toBe(true);
    expect(useSimulationStore.getInitialState().rate).toBe(1);
    expect(useSimulationStore.getInitialState().reversed).toBe(false);
  });

  it("steps NASA Eyes' ladder: ▶▶ from real time goes to 3 s/s", () => {
    useSimulationStore.getState().stepRate(1);
    expect(effectiveRate(useSimulationStore.getState())).toBe(3);
  });

  it('runs time backwards with ◀◀ from real time, and the loop sees the rate signed', () => {
    useSimulationStore.getState().stepRate(-1);
    expect(useSimulationStore.getState().reversed).toBe(true);
    expect(effectiveRate(useSimulationStore.getState())).toBe(-1);
    useSimulationStore.getState().stepRate(-1);
    expect(effectiveRate(useSimulationStore.getState())).toBe(-3);
  });

  it("stays live until the time or rate is changed by hand, as NASA Eyes' LIVE does", () => {
    expect(useSimulationStore.getInitialState().live).toBe(true);
    useSimulationStore.getState().stepRate(1);
    expect(useSimulationStore.getState().live).toBe(false);
    useSimulationStore.getState().jumpToNow();
    expect(useSimulationStore.getState().live).toBe(true);
    useSimulationStore.getState().pause();
    expect(useSimulationStore.getState().live).toBe(false);
    useSimulationStore.getState().jumpToNow();
    useSimulationStore.getState().leaveLive();
    expect(useSimulationStore.getState().live).toBe(false);
  });

  it('returns to real time — forwards at 1x — on NOW', () => {
    useSimulationStore.setState({ rate: 1000, reversed: true });

    useSimulationStore.getState().jumpToNow();

    expect(effectiveRate(useSimulationStore.getState())).toBe(1);
  });
});
