import { describe, expect, it } from 'vitest';
import { INITIAL_CAMERA_STATE, reduceCameraState, type CameraState } from './camera-state-machine.js';

const free: CameraState = { kind: 'freeOrbit' };

describe('reduceCameraState', () => {
  it('freeOrbit + select → focusFlight(returnTo freeOrbit)', () => {
    const s = reduceCameraState(free, { type: 'select', target: 7 });
    expect(s).toEqual({ kind: 'focusFlight', target: 7, returnTo: 'freeOrbit' });
  });

  it('focusFlight + flightArrived → object', () => {
    const flight: CameraState = { kind: 'focusFlight', target: 7, returnTo: 'freeOrbit' };
    expect(reduceCameraState(flight, { type: 'flightArrived' })).toEqual({ kind: 'object', target: 7 });
  });

  it('object + select(other) → focusFlight(returnTo object)', () => {
    const obj: CameraState = { kind: 'object', target: 7 };
    expect(reduceCameraState(obj, { type: 'select', target: 9 })).toEqual({
      kind: 'focusFlight',
      target: 9,
      returnTo: 'object',
    });
  });

  it('object + select(same) is a no-op', () => {
    const obj: CameraState = { kind: 'object', target: 7 };
    expect(reduceCameraState(obj, { type: 'select', target: 7 })).toBe(obj);
  });

  it('tells two bodies apart, and a body from a catalogue index (S5a)', () => {
    const obj: CameraState = { kind: 'object', target: 'jupiter' };
    expect(reduceCameraState(obj, { type: 'select', target: 'jupiter' })).toBe(obj);
    expect(reduceCameraState(obj, { type: 'select', target: 'saturn' })).toMatchObject({ kind: 'focusFlight', target: 'saturn' });
    expect(reduceCameraState({ kind: 'object', target: 7 }, { type: 'select', target: '7' }).kind).toBe('focusFlight');
  });

  it('object + deselect → exit', () => {
    expect(reduceCameraState({ kind: 'object', target: 7 }, { type: 'deselect' })).toEqual({ kind: 'exit' });
  });

  it('exit + flightArrived → freeOrbit', () => {
    expect(reduceCameraState({ kind: 'exit' }, { type: 'flightArrived' })).toEqual({ kind: 'freeOrbit' });
  });

  it('grabInput during a flight drops to freeOrbit — the state machine does NOT clear selection', () => {
    const flight: CameraState = { kind: 'focusFlight', target: 7, returnTo: 'freeOrbit' };
    expect(reduceCameraState(flight, { type: 'grabInput' })).toEqual({ kind: 'freeOrbit' });
  });

  it('grabInput in object mode is a no-op (manual authority handled elsewhere)', () => {
    const obj: CameraState = { kind: 'object', target: 7 };
    expect(reduceCameraState(obj, { type: 'grabInput' })).toBe(obj);
  });

  it('ignores irrelevant events rather than throwing', () => {
    expect(reduceCameraState(free, { type: 'flightArrived' })).toBe(free);
    expect(reduceCameraState(free, { type: 'deselect' })).toBe(free);
  });

  it('the initial state is freeOrbit', () => {
    expect(INITIAL_CAMERA_STATE).toEqual({ kind: 'freeOrbit' });
  });
});
