import React, { useMemo, useState, useRef } from "react";
import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";

export default function CelestialBody({
  name,
  currentPosition,
  orbitalPath,
  onFocus,
  threatStatus,
}) {
  const [hovered, setHovered] = useState(false);

  // Determine color and size
  const isAsteroid = ["apophis", "bennu", "ryugu"].includes(name.toLowerCase());
  const color = isAsteroid ? "#ff3333" : "#44aaff";
  const radius = isAsteroid ? 0.015 : 0.05;

  const displayColor = threatStatus === "CRITICAL" ? "#ff0000" : color;
  const displayEmissive = threatStatus === "CRITICAL" ? "#ff0000" : color;

  const materialRef = useRef();

  useFrame((state) => {
    if (!materialRef.current) return;
    if (threatStatus === "CRITICAL") {
      const time = state.clock.getElapsedTime();
      materialRef.current.emissiveIntensity = 1.05 + 0.75 * Math.sin(time * 6);
    } else {
      materialRef.current.emissiveIntensity = hovered ? 0.5 : 0;
    }
  });

  const points = useMemo(() => {
    return orbitalPath.map((pos) => [pos[0], pos[1], pos[2]]);
  }, [orbitalPath]);

  // When clicked, pass the position and size back up to the Scene so the camera knows where to go
  const handleClick = (e) => {
    e.stopPropagation(); // Prevents the click from passing through the planet into the void
    onFocus({ position: currentPosition, radius: radius });
  };

  return (
    <group>
      {/* 1. The Interactive Mesh */}
      <mesh
        position={currentPosition}
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        // Make the cursor a pointer when hovering to indicate interactivity
        style={{ cursor: hovered ? "pointer" : "auto" }}
      >
        <sphereGeometry args={[radius, 32, 32]} />
        {/* Slightly brighten the planet when hovered */}
        <meshStandardMaterial
          ref={materialRef}
          color={displayColor}
          emissive={displayEmissive}
          emissiveIntensity={threatStatus === "CRITICAL" ? 1.0 : (hovered ? 0.5 : 0)}
        />
      </mesh>

      {/* 2. The Orbital Trail */}
      {points.length > 0 && (
        <Line
          points={points}
          color={color}
          lineWidth={1.5}
          opacity={0.4}
          transparent
        />
      )}
    </group>
  );
}
