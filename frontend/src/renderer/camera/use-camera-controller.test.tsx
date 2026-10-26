import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { useRef } from 'react';
import { useCameraController } from './use-camera-controller.js';
import { useSelectionStore } from '../../state/selection-store.js';
import { useCameraStatus } from './camera-status.js';
import type { FrameState } from '../../simulation/frame-state.js';
import type { FlyOpts } from './flight.js';
import { WATCH_FRAMING_KM } from './camera-tunables.js';

// vi.mock is hoisted above imports; vi.hoisted (async) runs in the same
// phase and lets us build a real PerspectiveCamera without `require`.
const { mockCamera, frameCallbacks, flyCalls } = await vi.hoisted(async () => {
  const { PerspectiveCamera } = await import('three');
  return {
    mockCamera: new PerspectiveCamera(35, 1, 1, 1e6),
    frameCallbacks: [] as ((s: unknown, dt: number) => void)[],
    flyCalls: [] as (FlyOpts | undefined)[],
  };
});

// The real camera system, with flyTo's options recorded.
vi.mock('./camera-system.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('./camera-system.js')>();
  return {
    ...real,
    createCameraSystem: (...args: Parameters<typeof real.createCameraSystem>) => {
      const sys = real.createCameraSystem(...args);
      const flyTo = sys.flyTo.bind(sys);
      sys.flyTo = (index, opts) => {
        flyCalls.push(opts);
        return flyTo(index, opts);
      };
      return sys;
    },
  };
});

vi.mock('@react-three/fiber', () => ({
  useThree: () => ({ camera: mockCamera }),
  useFrame: (cb: (s: unknown, dt: number) => void) => {
    frameCallbacks.push(cb);
    setTimeout(() => cb({}, 1 / 60), 0); // one synthetic frame on mount
  },
}));

const frame: FrameState = {
  epochMs: 1_000_000,
  count: 1,
  generation: 0,
  positions: new Float32Array([7000, 0, 0]),
  velocities: new Float32Array([0, 7.6, 0]),
  flags: new Uint8Array(1),
};

function Harness({ state = frame }: { state?: FrameState }) {
  const frameRef = useRef(state);
  const containerRef = useRef<HTMLDivElement>(null);
  useCameraController({ frameStateRef: frameRef, byNorad: { '90000': 0 }, canvasContainerRef: containerRef });
  return <div ref={containerRef} />;
}

describe('useCameraController', () => {
  it('mounts and unmounts without throwing', () => {
    const { unmount } = render(<Harness />);
    unmount();
  });

  it('selecting a NORAD does not throw on the flyTo path', async () => {
    const { unmount } = render(<Harness />);
    useSelectionStore.getState().setSelected('90000' as never);
    await new Promise((r) => setTimeout(r, 10));
    useSelectionStore.getState().setSelected(null);
    await new Promise((r) => setTimeout(r, 10));
    unmount();
    expect(true).toBe(true);
  });

  it("waits for a position before flying, rather than flying to the Earth's centre", async () => {
    useSelectionStore.getState().setSelected(null);
    // A cold start: the loop has not written this object's slot yet.
    const cold: FrameState = { ...frame, positions: new Float32Array(3), velocities: new Float32Array(3) };
    frameCallbacks.length = 0;
    const { unmount } = render(<Harness state={cold} />);
    const runFrame = () => frameCallbacks.at(-1)?.({}, 1 / 60);

    useSelectionStore.getState().setSelected('90000' as never);
    runFrame();
    expect(useCameraStatus.getState().flying).toBe(false);

    cold.positions.set([7000, 0, 0]);
    cold.velocities.set([0, 7.6, 0]);
    runFrame();
    expect(useCameraStatus.getState().flying).toBe(true);

    useSelectionStore.getState().setSelected(null);
    unmount();
  });

  // A link's `object=` is applied by the dock's effect, outside the Canvas,
  // before R3F mounts this hook and subscribes.
  it('follows a selection made before it subscribed', async () => {
    useSelectionStore.getState().setSelected('90000' as never);
    frameCallbacks.length = 0;
    const { unmount } = render(<Harness />);
    frameCallbacks.at(-1)?.({}, 1 / 60);
    expect(useCameraStatus.getState().flying).toBe(true);
    useSelectionStore.getState().setSelected(null);
    unmount();
  });

  describe('Watch framing (Q17)', () => {
    const NORAD = '90000' as never;
    const PAIR = { follow: NORAD, counterpart: '90001' as never };
    const reset = () => {
      useSelectionStore.setState({ selectedNorad: null, selectedBody: null, watchPair: null });
      flyCalls.length = 0;
    };

    it('flies a normal selection with the object framing', () => {
      reset();
      const { unmount } = render(<Harness />);
      useSelectionStore.getState().setSelected(NORAD);
      expect(flyCalls).toEqual([undefined]);
      reset();
      unmount();
    });

    it('flies the Watch follow back at the Watch distance', () => {
      reset();
      const { unmount } = render(<Harness />);
      useSelectionStore.setState({ watchPair: PAIR });
      useSelectionStore.getState().setSelected(NORAD);
      expect(flyCalls).toEqual([{ radiusKm: WATCH_FRAMING_KM }]);
      reset();
      unmount();
    });

    it('re-follows when the pair is set on the object that is already selected', () => {
      reset();
      const { unmount } = render(<Harness />);
      useSelectionStore.getState().setSelected(NORAD);
      flyCalls.length = 0;
      useSelectionStore.getState().setWatchPair(PAIR);
      expect(flyCalls).toEqual([{ radiusKm: WATCH_FRAMING_KM }]);
      reset();
      unmount();
    });

    it('flies nothing when the pair is cleared', () => {
      reset();
      const { unmount } = render(<Harness />);
      useSelectionStore.getState().setSelected(NORAD);
      useSelectionStore.getState().setWatchPair(PAIR);
      flyCalls.length = 0;
      useSelectionStore.getState().setWatchPair(null);
      expect(flyCalls).toEqual([]);
      reset();
      unmount();
    });
  });
});
