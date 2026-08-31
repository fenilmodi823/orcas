import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { InstancedMesh, PerspectiveCamera } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { FrameState } from '../../simulation/frame-state.js';
import { PLACEHOLDER_RADIUS_KM } from '../object-extents.js';
import { readCyanToken } from '../scene-colors.js';
import { createTier1Buffer, selectTier1, TIER1_CAP } from '../lod/tier1-select.js';
import { writeTier1Instances } from './tier1-write.js';

interface Props {
  readonly frameStateRef: MutableRefObject<FrameState>;
  /** Written each frame so the debug panel can read membership. */
  readonly memberCountRef?: MutableRefObject<number>;
}

/**
 * Tier 1 (brief §B.4): objects large enough on screen that a point sprite
 * reads as a dot rather than an object are drawn as low-poly octahedra,
 * nadir-aligned, cross-faded against Tier 0 across a shared band.
 *
 * A raw InstancedMesh, not drei's <Instances> — §6.1 notes <Instances>
 * needs one React element per instance, and our cap is 2,000 against a
 * realistic membership of 0–2. `mesh.count` is set per frame so the GPU
 * draws only live members; the buffer is allocated once at the cap.
 *
 * ponytail: with a 10 m assumed radius an object only reaches the 3 px
 * threshold at ~4 km, so today this tier is effectively "the object you
 * flew to". The machinery is size-driven and correct; the visual payoff
 * arrives with real per-object sizes.
 */
export function Tier1Objects({ frameStateRef, memberCountRef }: Props): React.ReactElement {
  const { camera, size } = useThree();
  const meshRef = useRef<InstancedMesh>(null);
  const members = useMemo(() => createTier1Buffer(), []);
  // Read once — the cyan token, like every other colour in the renderer.
  const tint = useMemo(() => readCyanToken(), []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (mesh) mesh.count = 0; // nothing promoted until the first frame says so
  }, []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh || !(camera instanceof PerspectiveCamera)) return;
    const frame = frameStateRef.current;
    const pixelsPerRadian = size.height / ((camera.fov * Math.PI) / 180);

    const memberCount = selectTier1(
      {
        positions: frame.positions,
        flags: frame.flags,
        count: frame.count,
        camPosKm: camera.position,
        pixelsPerRadian,
        radiusKm: PLACEHOLDER_RADIUS_KM,
      },
      members,
    );

    mesh.count = writeTier1Instances({
      mesh,
      frame,
      members,
      memberCount,
      camPosKm: camera.position,
      pixelsPerRadian,
      tint,
    });
    if (memberCountRef) memberCountRef.current = memberCount;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, TIER1_CAP]} frustumCulled={false}>
      <octahedronGeometry args={[1, 0]} />
      <meshStandardMaterial roughness={0.6} />
    </instancedMesh>
  );
}
