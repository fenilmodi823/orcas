import { useMemo } from 'react';
import { Vector3 } from 'three';
import { Line } from '@react-three/drei';

interface OrbitPathProps {
  /** Scene-unit points tracing one orbit, not km — see Earth.tsx note. */
  points: readonly (readonly [number, number, number])[];
  color?: string;
}

/** One orbit trace. Orbit-class colour comes from the caller — see Design.md §3. */
export function OrbitPath({ points, color = '#00E5FF' }: OrbitPathProps) {
  const vectors = useMemo(() => points.map(([x, y, z]) => new Vector3(x, y, z)), [points]);
  if (vectors.length < 2) return null;
  return <Line points={vectors} color={color} lineWidth={1} transparent opacity={0.6} />;
}
