import { useMemo, useRef } from 'react';
import { InstancedMesh, Object3D } from 'three';
import { useFrame } from '@react-three/fiber';

export interface SatellitePoint {
  id: string;
  /** Scene-unit position, not km — see Earth.tsx note. */
  position: readonly [number, number, number];
}

interface SatellitesProps {
  points: readonly SatellitePoint[];
  color?: string;
}

const dummy = new Object3D();

/**
 * Instanced satellite markers. Tier-2/3 rendering per Architecture.md LOD
 * table — one draw call regardless of count. Positions are refs updated in
 * useFrame, never React state, per Rules.md ("React state updated every frame").
 */
export function Satellites({ points, color = '#00E5FF' }: SatellitesProps) {
  const meshRef = useRef<InstancedMesh>(null);
  const count = points.length;

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    points.forEach((point, i) => {
      dummy.position.set(...point.position);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  const geometryArgs = useMemo<[number, number]>(() => [0.01, 8], []);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={geometryArgs} />
      <meshBasicMaterial color={color} />
    </instancedMesh>
  );
}
