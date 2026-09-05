import { describe, expect, it } from 'vitest';
import { computeLabelOpacities, distanceFadeFactor, type LabelCandidate } from './object-label-layout.js';

function candidate(xPx: number, yPx: number, rank: number, visible = true): LabelCandidate {
  return { xPx, yPx, rank, visible };
}

describe('distanceFadeFactor', () => {
  it('is 0 well inside object-mode framing', () => {
    expect(distanceFadeFactor(0.0825)).toBe(0);
  });

  it('is 1 at rest (comfortably zoomed out)', () => {
    expect(distanceFadeFactor(42_164)).toBe(1);
  });

  it('is between 0 and 1 partway through the transition', () => {
    const f = distanceFadeFactor(2);
    expect(f).toBeGreaterThan(0);
    expect(f).toBeLessThan(1);
  });
});

describe('computeLabelOpacities', () => {
  const FAR = 42_164; // at rest, distance fade is fully open

  it('dims a candidate crowded by a nearby one, and leaves a lone candidate alone', () => {
    const candidates = [
      candidate(100, 100, 0), // crowded pair
      candidate(110, 105, 1),
      candidate(800, 800, 2), // far from both — alone
    ];
    const opacity = computeLabelOpacities({ candidates, selectedSlot: -1, camRadiusKm: FAR, cap: 10 });
    expect(opacity[0]).toBeLessThan(1);
    expect(opacity[1]).toBeLessThan(1);
    expect(opacity[2]).toBeCloseTo(1, 6);
  });

  it('forces exactly the lowest-rank candidates beyond the cap to 0', () => {
    // Spread far apart so density never enters into it — isolates the cap.
    const candidates = [
      candidate(0, 0, 3),
      candidate(1000, 0, 0),
      candidate(0, 1000, 1),
      candidate(1000, 1000, 2),
    ];
    const opacity = computeLabelOpacities({ candidates, selectedSlot: -1, camRadiusKm: FAR, cap: 2 });
    // Ranks 0 and 1 (indices 1, 2) survive; ranks 2 and 3 (indices 3, 0) don't.
    expect(opacity[1]).toBeCloseTo(1, 6);
    expect(opacity[2]).toBeCloseTo(1, 6);
    expect(opacity[3]).toBe(0);
    expect(opacity[0]).toBe(0);
  });

  it('is always 1 for the selected slot regardless of distance, density or cap', () => {
    const candidates = [
      candidate(100, 100, 5), // selected: worst rank, crowded, would be over any small cap
      candidate(105, 102, 0),
      candidate(108, 98, 1),
    ];
    // Deep object-mode zoom (distance factor 0) and a cap of 0 (nothing else survives).
    const opacity = computeLabelOpacities({ candidates, selectedSlot: 0, camRadiusKm: 0.0825, cap: 0 });
    expect(opacity[0]).toBe(1);
    expect(opacity[1]).toBe(0);
    expect(opacity[2]).toBe(0);
  });

  it('forces an off-screen candidate to 0 even if selected', () => {
    const candidates = [candidate(100, 100, 0, false)];
    const opacity = computeLabelOpacities({ candidates, selectedSlot: 0, camRadiusKm: FAR, cap: 10 });
    expect(opacity[0]).toBe(0);
  });

  it('never shows a non-visible (off-screen) candidate', () => {
    const candidates = [candidate(100, 100, 0, false), candidate(200, 200, 1)];
    const opacity = computeLabelOpacities({ candidates, selectedSlot: -1, camRadiusKm: FAR, cap: 10 });
    expect(opacity[0]).toBe(0);
    expect(opacity[1]).toBeCloseTo(1, 6);
  });
});
