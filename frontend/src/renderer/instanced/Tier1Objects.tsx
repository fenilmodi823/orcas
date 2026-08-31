import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { InstancedMesh, PerspectiveCamera } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { FrameState } from '../../simulation/frame-state.js';
import { PLACEHOLDER_RADIUS_KM } from '../object-extents.js';
import { readCyanToken } from '../scene-colors.js';
import { useSelectionStore } from '../../state/selection-store.js';
import { buildActiveSet, createActiveSetBuffer } from '../../simulation/active-set.js';
import { createTier1Buffer, selectTier1, TIER1_CAP } from '../lod/tier1-select.js';
import { writeTier1Instances } from './tier1-write.js';

interface Props {
  readonly frameStateRef: MutableRefObject<FrameState>;
  /** norad → catalogue index, for resolving selection and hover. */
  readonly byNorad: Readonly<Record<string, number>>;
  /** Written each frame so the debug panel can read membership. */
  readonly memberCountRef?: MutableRefObject<number>;
  /** Written each frame: the size of the active set (brief §G.6). */
  readonly activeCountRef?: MutableRefObject<number>;
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
export function Tier1Objects({
  frameStateRef,
  byNorad,
  memberCountRef,
  activeCountRef,
}: Props): React.ReactElement {
  const { camera, size } = useThree();
  const meshRef = useRef<InstancedMesh>(null);
  const members = useMemo(() => createTier1Buffer(), []);
  const activeSet = useMemo(() => createActiveSetBuffer(), []);
  // Selection and hover reach the frame loop through refs, kept current by a
  // vanilla subscribe outside React's render cycle — the same pattern
  // use-camera-controller.tsx uses, and the reason this component never
  // re-renders on a selection change.
  const selectedIndexRef = useRef(-1);
  const hoveredIndexRef = useRef(-1);
  // Read once — the cyan token, like every other colour in the renderer.
  const tint = useMemo(() => readCyanToken(), []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (mesh) mesh.count = 0; // nothing promoted until the first frame says so
  }, []);

  useEffect(() => {
    const resolve = (norad: string | null): number =>
      norad === null ? -1 : byNorad[norad] ?? -1;
    const read = (state: { selectedNorad: string | null; hoveredNorad: string | null }) => {
      selectedIndexRef.current = resolve(state.selectedNorad);
      hoveredIndexRef.current = resolve(state.hoveredNorad);
    };
    read(useSelectionStore.getState());
    return useSelectionStore.subscribe(read);
  }, [byNorad]);

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

    // ACTIVE SET = selected ∪ hovered ∪ tier 1 (brief §G.6). Its consumers
    // (trails, orbit paths) arrive in M1.7b; building it here now means it
    // runs every frame under real membership rather than shipping untested.
    const activeCount = buildActiveSet(
      {
        tier1: members,
        tier1Count: memberCount,
        selectedIndex: selectedIndexRef.current,
        hoveredIndex: hoveredIndexRef.current,
      },
      activeSet,
    );
    if (activeCountRef) activeCountRef.current = activeCount;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, TIER1_CAP]} frustumCulled={false}>
      <octahedronGeometry args={[1, 0]} />
      <meshStandardMaterial roughness={0.6} />
    </instancedMesh>
  );
}
