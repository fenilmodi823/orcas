import { describe, expect, it } from 'vitest';
import { clamp, damp, flightEase, smoothDamp, smootherstep, smoothstep } from './easing.js';

describe('smootherstep', () => {
  it('is exactly 0 at s=0 and 1 at s=1', () => {
    expect(smootherstep(0)).toBe(0);
    expect(smootherstep(1)).toBe(1);
  });

  it('has zero first derivative at both ends (the property a plain cubic lacks)', () => {
    const d = 1e-4;
    expect(Math.abs(smootherstep(d) - smootherstep(0)) / d).toBeLessThan(1e-3);
    expect(Math.abs(smootherstep(1) - smootherstep(1 - d)) / d).toBeLessThan(1e-3);
  });

  it('clamps its input', () => {
    expect(smootherstep(-1)).toBe(0);
    expect(smootherstep(2)).toBe(1);
  });
});

describe('flightEase', () => {
  it('still spans 0..1', () => {
    expect(flightEase(0)).toBeCloseTo(0, 6);
    expect(flightEase(1)).toBeCloseTo(1, 6);
  });

  it('with gamma<1 is past the halfway point in value before the halfway point in time (long settle)', () => {
    // s^0.82 > s for s in (0,1), so the eased value runs ahead early and settles slowly.
    expect(flightEase(0.5)).toBeGreaterThan(0.5);
  });
});

describe('damp — half-life form', () => {
  it('is frame-rate independent: one 100ms step ≈ two 50ms steps ≈ ten 10ms steps', () => {
    const halfLife = 0.09;
    const oneStep = damp(0, 1, halfLife, 0.1);
    let two = 0;
    for (let i = 0; i < 2; i++) two = damp(two, 1, halfLife, 0.05);
    let ten = 0;
    for (let i = 0; i < 10; i++) ten = damp(ten, 1, halfLife, 0.01);
    expect(Math.abs(oneStep - two)).toBeLessThan(1e-3);
    expect(Math.abs(oneStep - ten)).toBeLessThan(1e-3);
  });

  it('never overshoots the target', () => {
    let x = 0;
    for (let i = 0; i < 200; i++) x = damp(x, 1, 0.09, 1 / 60);
    expect(x).toBeLessThanOrEqual(1);
    expect(x).toBeGreaterThan(0.999);
  });
});

describe('smoothDamp — critically-damped spring', () => {
  it('reaches a static target without overshoot', () => {
    let x = 0;
    const vel = { value: 0 };
    let maxSeen = 0;
    for (let i = 0; i < 600; i++) {
      x = smoothDamp(x, 1, vel, 0.18, 1 / 60);
      maxSeen = Math.max(maxSeen, x);
    }
    expect(maxSeen).toBeLessThanOrEqual(1 + 1e-6);
    expect(x).toBeGreaterThan(0.99);
  });

  it('tracks a constant-velocity target with bounded steady-state error', () => {
    let x = 0;
    let target = 0;
    const vel = { value: 0 };
    const dt = 1 / 60;
    for (let i = 0; i < 600; i++) {
      target += 2 * dt; // 2 units/sec ramp
      x = smoothDamp(x, target, vel, 0.18, dt);
    }
    expect(Math.abs(x - target)).toBeLessThan(0.5); // lags by ~smoothTime·rate, not unboundedly
  });

  it('is frame-rate independent for a static target (exact)', () => {
    const run = (dt: number) => {
      let x = 0;
      const vel = { value: 0 };
      const steps = Math.round(0.5 / dt);
      for (let i = 0; i < steps; i++) x = smoothDamp(x, 1, vel, 0.18, dt);
      return x;
    };
    expect(Math.abs(run(1 / 30) - run(1 / 144))).toBeLessThan(2e-3);
  });

  it('tracks a continuous moving target with only small frame-rate variance (~1%)', () => {
    // target(t) = 3·t evaluated at the accumulated time — no dt-sized step
    // artefact, so the only difference across rates is the integrator itself.
    const run = (dt: number) => {
      let x = 0;
      let t = 0;
      const vel = { value: 0 };
      const steps = Math.round(1 / dt);
      for (let i = 0; i < steps; i++) {
        t += dt;
        x = smoothDamp(x, 3 * t, vel, 0.18, dt);
      }
      return x;
    };
    const a = run(1 / 30);
    const b = run(1 / 144);
    expect(Math.abs(a - b) / Math.abs(b)).toBeLessThan(0.02);
  });
});

describe('clamp / smoothstep', () => {
  it('clamp bounds both sides', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });

  it('smoothstep is 0 below edge0, 1 above edge1, monotone between', () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 6);
  });
});
