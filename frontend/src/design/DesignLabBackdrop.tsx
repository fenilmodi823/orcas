import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { Earth, Satellites, Starfield, type SatellitePoint } from '@orcas/scene';

interface MutablePoint {
  id: string;
  position: [number, number, number];
  angle: number;
  radius: number;
  speed: number;
  tilt: number;
}

const OBJECT_COUNT = 140;

function seedPoints(): MutablePoint[] {
  return Array.from({ length: OBJECT_COUNT }, (_, index) => ({
    id: `lab-${index}`,
    position: [0, 0, 0],
    angle: Math.random() * Math.PI * 2,
    radius: 1.4 + Math.random() * 0.9,
    speed: 0.08 + Math.random() * 0.12,
    tilt: (Math.random() - 0.5) * 0.6,
  }));
}

/**
 * The backdrop every design-lab section renders over: real @orcas/scene
 * primitives, a rotating Earth, and a decorative moving field. This is NOT
 * SGP4 — circular motion only, honesty-flagged (Rules.md §7) — the real
 * physics live in `packages/orcas-physics`, untouched by this route.
 */
export function DesignLabBackdrop({ nightSide = false }: { nightSide?: boolean }) {
  const earthRef = useRef<Group>(null);
  const pointsRef = useRef<MutablePoint[] | null>(null);
  if (pointsRef.current === null) {
    pointsRef.current = seedPoints();
  }

  /* eslint-disable react-hooks/refs --
     React Compiler's ref rule assumes DOM-rendered state; it doesn't apply
     to a three.js scene graph. Reading a ref in useFrame and once more to
     hand the same array to <Satellites> is R3F's own mandated pattern
     (Rules.md: "Renderer state lives in refs and useFrame, never React
     state") and is exactly what this package's own Satellites.tsx already
     does — that file just isn't linted (no eslint config under packages/). */
  useFrame((_, delta) => {
    if (earthRef.current) {
      earthRef.current.rotation.y += delta * 0.05;
    }
    const points = pointsRef.current;
    if (!points) return;
    for (const point of points) {
      point.angle += delta * point.speed;
      point.position[0] = Math.cos(point.angle) * point.radius;
      point.position[2] = Math.sin(point.angle) * point.radius;
      point.position[1] = Math.sin(point.angle * 0.5) * point.tilt;
    }
  });

  const points = pointsRef.current as readonly SatellitePoint[];
  /* eslint-enable react-hooks/refs */

  return (
    <>
      <ambientLight intensity={nightSide ? 0.08 : 0.4} />
      <directionalLight position={nightSide ? [-5, -1, -3] : [5, 3, 5]} intensity={nightSide ? 0.25 : 1.2} />
      <Starfield />
      <group ref={earthRef}>
        <Earth />
      </group>
      {/* WebGL material colour, not CSS — cannot consume var(). Matches the
          hex literal already in Satellites.tsx's own default (packages/,
          not modified here); this only overrides it for the night variant. */}
      {nightSide ? <Satellites points={points} color="#5CF2FF" /> : <Satellites points={points} />}
    </>
  );
}
