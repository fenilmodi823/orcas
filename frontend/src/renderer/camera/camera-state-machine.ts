/**
 * The camera state machine (brief §C.1). HOVER is deliberately NOT a state —
 * hover changes the renderer and the UI, never the camera (§C.1 [ORCAS]
 * note). `followOrbit` is deferred to M1.7.
 */
export type CameraState =
  | { readonly kind: 'freeOrbit' }
  | { readonly kind: 'focusFlight'; readonly targetIndex: number; readonly returnTo: 'freeOrbit' | 'object' }
  | { readonly kind: 'object'; readonly targetIndex: number }
  | { readonly kind: 'exit' };

export type CameraEvent =
  | { readonly type: 'select'; readonly index: number }
  | { readonly type: 'deselect' }
  | { readonly type: 'flightArrived' }
  | { readonly type: 'grabInput' };

export const INITIAL_CAMERA_STATE: CameraState = { kind: 'freeOrbit' };

export function reduceCameraState(state: CameraState, event: CameraEvent): CameraState {
  switch (event.type) {
    case 'select': {
      if (state.kind === 'object' && state.targetIndex === event.index) return state;
      const returnTo = state.kind === 'object' ? 'object' : 'freeOrbit';
      return { kind: 'focusFlight', targetIndex: event.index, returnTo };
    }
    case 'deselect':
      return state.kind === 'object' ? { kind: 'exit' } : state;
    case 'flightArrived':
      if (state.kind === 'focusFlight') return { kind: 'object', targetIndex: state.targetIndex };
      if (state.kind === 'exit') return { kind: 'freeOrbit' };
      return state;
    case 'grabInput':
      // A grab means "I want to look around", not "never mind" — the state
      // machine drops to freeOrbit but does NOT clear selection (brief §C.11).
      return state.kind === 'focusFlight' || state.kind === 'exit' ? { kind: 'freeOrbit' } : state;
  }
}
