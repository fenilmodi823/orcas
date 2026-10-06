/**
 * The camera state machine (brief §C.1). HOVER is deliberately NOT a state —
 * hover changes the renderer and the UI, never the camera (§C.1 [ORCAS]
 * note). `followOrbit` is deferred to M1.7.
 */
/** What the camera is aimed at: a catalogue index, or a body's id (S5a, `renderer/solar/bodies.ts`). */
export type CameraTargetKey = number | string;

export type CameraState =
  | { readonly kind: 'freeOrbit' }
  | { readonly kind: 'focusFlight'; readonly target: CameraTargetKey; readonly returnTo: 'freeOrbit' | 'object' }
  | { readonly kind: 'object'; readonly target: CameraTargetKey }
  | { readonly kind: 'exit' };

export type CameraEvent =
  | { readonly type: 'select'; readonly target: CameraTargetKey }
  | { readonly type: 'deselect' }
  | { readonly type: 'flightArrived' }
  | { readonly type: 'grabInput' };

export const INITIAL_CAMERA_STATE: CameraState = { kind: 'freeOrbit' };

export function reduceCameraState(state: CameraState, event: CameraEvent): CameraState {
  switch (event.type) {
    case 'select': {
      if (state.kind === 'object' && state.target === event.target) return state;
      const returnTo = state.kind === 'object' ? 'object' : 'freeOrbit';
      return { kind: 'focusFlight', target: event.target, returnTo };
    }
    case 'deselect':
      return state.kind === 'object' ? { kind: 'exit' } : state;
    case 'flightArrived':
      if (state.kind === 'focusFlight') return { kind: 'object', target: state.target };
      if (state.kind === 'exit') return { kind: 'freeOrbit' };
      return state;
    case 'grabInput':
      // A grab means "I want to look around", not "never mind" — the state
      // machine drops to freeOrbit but does NOT clear selection (brief §C.11).
      return state.kind === 'focusFlight' || state.kind === 'exit' ? { kind: 'freeOrbit' } : state;
  }
}
