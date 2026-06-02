import React, { useMemo } from "react";
import * as THREE from "three";

export default function OrbitPath({
  radius,
  color = "#475569",
  segments = 120,
  width = 1,
}) {
  const points = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      pts.push(
        new THREE.Vector3(
          Math.cos(theta) * radius,
          0,
          Math.sin(theta) * radius,
        ),
      );
    }
    return pts;
  }, [radius, segments]);

  const lineGeometry = useMemo(() => {
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [points]);

  return (
    <line geometry={lineGeometry}>
      <lineBasicMaterial
        color={color}
        linewidth={width}
        transparent
        opacity={0.3}
      />
    </line>
  );
}
