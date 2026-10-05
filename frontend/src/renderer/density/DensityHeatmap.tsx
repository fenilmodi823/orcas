import { useEffect, useMemo } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Points } from 'three';
import { useViewStore } from '../../state/view-store.js';
import { createDensityHeatmap } from './density-heatmap.js';

/**
 * The density layer, drawn from Tier 0's own geometry — the same live
 * positions and filter flags, so it can never disagree with the points.
 * Mount after TierZeroPoints: it reads that object's geometry.
 */
export function DensityHeatmap({ pointsObjectRef }: { pointsObjectRef: MutableRefObject<Points | null> }) {
  const { gl } = useThree();
  const heatmap = useMemo(() => createDensityHeatmap(), []);
  useEffect(() => () => heatmap.dispose(), [heatmap]);

  useFrame(({ camera, size }) => {
    // Tier 0 goes invisible once the shell has faded out (S4); so does its heatmap.
    const geometry = pointsObjectRef.current?.visible ? pointsObjectRef.current.geometry : null;
    const ready = useViewStore.getState().showHeatmap && geometry?.getAttribute('position') ? geometry : null;
    const dpr = gl.getPixelRatio();
    heatmap.update(gl, camera, ready, size.width * dpr, size.height * dpr);
  });

  return <primitive object={heatmap.overlay} />;
}
