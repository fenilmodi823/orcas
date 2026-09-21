import { beforeEach, describe, expect, it } from 'vitest';
import { effectiveRate, useSimulationStore } from './simulation-store.js';

beforeEach(() => {
  useSimulationStore.setState({ rate: 1, reversed: false, playing: true });
});

describe('simulation store', () => {
  it('opens playing, in real time, as NASA Eyes does', () => {
    expect(useSimulationStore.getInitialState().playing).toBe(true);
    expect(useSimulationStore.getInitialState().rate).toBe(1);
    expect(useSimulationStore.getInitialState().reversed).toBe(false);
  });

  it('signs the rate the loop consumes when time runs backwards', () => {
    useSimulationStore.setState({ rate: 100 });
    expect(effectiveRate(useSimulationStore.getState())).toBe(100);

    useSimulationStore.getState().toggleDirection();
    expect(effectiveRate(useSimulationStore.getState())).toBe(-100);
  });

  it('returns to real time — forwards at 1x — on NOW', () => {
    useSimulationStore.setState({ rate: 1000, reversed: true });

    useSimulationStore.getState().jumpToNow();

    expect(effectiveRate(useSimulationStore.getState())).toBe(1);
  });
});
