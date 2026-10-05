import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { useEffect, type MutableRefObject } from 'react';
import { useLiveScene } from './use-live-scene.js';
import { useSimulationStore } from '../../state/simulation-store.js';

const captured = vi.hoisted(() => ({ playingRef: null as MutableRefObject<boolean> | null }));

vi.mock('../../simulation/use-simulation-loop.js', async () => {
  const { useRef } = await import('react');
  return {
    useSimulationLoop: (_objects: unknown, playingRef: MutableRefObject<boolean>) => {
      captured.playingRef = playingRef;
      return {
        frameStateRef: useRef({ positions: new Float32Array(0), velocities: new Float32Array(0) }),
        ringRef: useRef(null),
        scrubGenerationRef: useRef(0),
        scrubTo: () => {},
      };
    },
  };
});

/** Stands in for the dock: applies an opened link (`rate=0`) in a mount effect. */
function PausesOnMount() {
  useEffect(() => useSimulationStore.getState().pause(), []);
  return null;
}

function Scene() {
  useLiveScene([], {});
  return <PausesOnMount />;
}

describe('useLiveScene', () => {
  it('hands the loop a pause made by a child before the scene subscribed', () => {
    useSimulationStore.setState({ playing: true });
    // React runs a child's effects before its parent's, so the dock's
    // link-applying effect pauses the store before the scene subscribes.
    render(<Scene />);
    expect(captured.playingRef?.current).toBe(false);
  });
});
