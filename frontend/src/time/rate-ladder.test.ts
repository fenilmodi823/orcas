import { describe, expect, it } from 'vitest';
import { RATE_LADDER_S_PER_S, formatRate, stepRate } from './rate-ladder.js';

describe('RATE_LADDER_S_PER_S (NASA Eyes on the Solar System, measured 2026-10-03)', () => {
  it('runs from real time to 3 years per second, strictly rising', () => {
    expect(RATE_LADDER_S_PER_S[0]).toBe(1);
    expect(RATE_LADDER_S_PER_S[RATE_LADDER_S_PER_S.length - 1]).toBe(94_608_000); // 3 × 365 d
    for (let i = 1; i < RATE_LADDER_S_PER_S.length; i++) {
      expect(RATE_LADDER_S_PER_S[i]).toBeGreaterThan(RATE_LADDER_S_PER_S[i - 1]);
    }
  });
});

describe('stepRate', () => {
  it('steps up the ladder', () => {
    expect(stepRate(1, 1)).toBe(3);
    expect(stepRate(50, 1)).toBe(60);
  });

  it('goes straight from real time to −1 s/s going down — zero is never a step', () => {
    expect(stepRate(1, -1)).toBe(-1);
    expect(stepRate(-1, -1)).toBe(-3);
    expect(stepRate(-1, 1)).toBe(1);
  });

  it('stops at the ends of the ladder', () => {
    expect(stepRate(94_608_000, 1)).toBe(94_608_000);
    expect(stepRate(-94_608_000, -1)).toBe(-94_608_000);
  });

  it('steps from a rate that is not on the ladder to its neighbour', () => {
    expect(stepRate(100, 1)).toBe(180); // between 60 and 180
    expect(stepRate(100, -1)).toBe(60);
  });
});

describe('formatRate', () => {
  it('says real time in words', () => {
    expect(formatRate(1)).toBe('Real time');
  });

  it('picks the largest whole unit, as a symbol', () => {
    expect(formatRate(3)).toBe('3 s/s');
    expect(formatRate(60)).toBe('1 min/s');
    expect(formatRate(10_800)).toBe('3 h/s');
    expect(formatRate(259_200)).toBe('3 d/s');
    expect(formatRate(604_800)).toBe('1 wk/s');
    expect(formatRate(2_592_000)).toBe('1 mo/s');
    expect(formatRate(94_608_000)).toBe('3 yr/s');
  });

  it('signs a reverse rate with a true minus sign', () => {
    expect(formatRate(-1)).toBe('−1 s/s');
    expect(formatRate(-21_600)).toBe('−6 h/s');
  });
});
