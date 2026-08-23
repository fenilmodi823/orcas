import { describe, expect, it } from 'vitest';
import { TICK_HZ, advanceTicks, epochMsToTicks, ticksToEpochMs } from './clock.js';

describe('advanceTicks', () => {
  it('is a pure function: identical inputs always produce identical output', () => {
    const dtSequence = [16.6, 33.3, 16.6, 8.1, 41.9];
    const run = () => dtSequence.reduce((ticks, dt) => advanceTicks(ticks, dt, 60), 0);
    expect(run()).toBe(run());
  });

  it('always returns an integer, regardless of rate or dt', () => {
    expect(Number.isInteger(advanceTicks(12345, 16.6667, 3.7))).toBe(true);
    expect(Number.isInteger(advanceTicks(0, 0.001, -86400))).toBe(true);
  });

  it('forward then backward over the same dt sequence returns to the start — brief §E.4, "the free correctness test for the whole simulation"', () => {
    const dtSequence = [16.6, 33.3, 8.1, 250.7, 16.6, 16.6, 91.2, 4.4];
    const start = epochMsToTicks(Date.parse('2026-08-23T00:00:00.000Z'));
    const rate = 3600;

    let ticks = start;
    for (const dt of dtSequence) ticks = advanceTicks(ticks, dt, rate);
    for (const dt of dtSequence) ticks = advanceTicks(ticks, dt, -rate);

    expect(ticks).toBe(start);
  });

  it('paused (rate 0) never advances the clock', () => {
    expect(advanceTicks(500, 16.6, 0)).toBe(500);
  });
});

describe('epochMsToTicks / ticksToEpochMs', () => {
  it('round-trips whole-second epochs exactly (TICK_HZ=1024 is a multiple of 1000/gcd(1024,1000))', () => {
    const epochMs = Date.parse('2026-08-23T00:00:00.000Z');
    expect(ticksToEpochMs(epochMsToTicks(epochMs))).toBe(epochMs);
  });

  it('TICK_HZ is the brief-specified power of two', () => {
    expect(TICK_HZ).toBe(1024);
  });
});
