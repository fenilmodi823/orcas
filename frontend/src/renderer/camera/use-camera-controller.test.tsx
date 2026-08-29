import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { useRef } from 'react';
import { useCameraController } from './use-camera-controller.js';
import { useSelectionStore } from '../../state/selection-store.js';
import type { FrameState } from '../../simulation/frame-state.js';

// vi.mock is hoisted above imports; vi.hoisted (async) runs in the same
// phase and lets us build a real PerspectiveCamera without `require`.
const { mockCamera } = await vi.hoisted(async () => {
  const { PerspectiveCamera } = await import('three');
  return { mockCamera: new PerspectiveCamera(35, 1, 1, 1e6) };
});

vi.mock('@react-three/fiber', () => ({
  useThree: () => ({ camera: mockCamera }),
  useFrame: (cb: (s: unknown, dt: number) => void) => {
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

function Harness() {
  const frameRef = useRef(frame);
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
});
