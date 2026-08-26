import { describe, expect, it } from 'vitest';
import { isClickNotDrag, shouldIssuePick } from './points-pick-schedule.js';

describe('shouldIssuePick', () => {
  it('issues a pick on the first request, with no prior position', () => {
    expect(shouldIssuePick({ px: 100, py: 100, lastRequested: null, inFlight: false, suppressed: false })).toBe(true);
  });

  it('does not re-issue if the cursor moved 2px or less (brief §D.3)', () => {
    const lastRequested = { px: 100, py: 100 };
    expect(shouldIssuePick({ px: 101, py: 101, lastRequested, inFlight: false, suppressed: false })).toBe(false);
    expect(shouldIssuePick({ px: 102, py: 100, lastRequested, inFlight: false, suppressed: false })).toBe(false);
  });

  it('issues again once the cursor moved more than 2px', () => {
    const lastRequested = { px: 100, py: 100 };
    expect(shouldIssuePick({ px: 103, py: 100, lastRequested, inFlight: false, suppressed: false })).toBe(true);
  });

  it('never issues while a pick is already in flight — at most one per frame', () => {
    expect(shouldIssuePick({ px: 500, py: 500, lastRequested: null, inFlight: true, suppressed: false })).toBe(false);
  });

  it('never issues while suppressed (reserved for camera-flight suppression, M1.6)', () => {
    expect(shouldIssuePick({ px: 500, py: 500, lastRequested: null, inFlight: false, suppressed: true })).toBe(false);
  });
});

describe('isClickNotDrag', () => {
  it('treats a pointerup within 4px of pointerdown as a click (brief §D.5)', () => {
    expect(isClickNotDrag(100, 100, 102, 101)).toBe(true);
  });

  it('treats a pointerup 4px or more away as a drag, not a click', () => {
    expect(isClickNotDrag(100, 100, 104, 100)).toBe(false);
  });
});
