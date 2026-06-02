import React, { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

export default function CelestialBody({
  name,
  radius,
  color,
  position,
  onClick,
  emissive = false,
}) {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);

  // Subtle rotation for planetary realism
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.005;
    }
  });

  return (
    <group position={position} name={name}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          if (onClick) onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={(e) => setHovered(false)}
        style={{ cursor: hovered ? "pointer" : "auto" }}
      >
        <sphereGeometry args={[radius, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive ? color : hovered ? color : "#000000"}
          emissiveIntensity={emissive ? 1.5 : hovered ? 0.6 : 0}
          roughness={0.6}
          metalness={0.1}
        />
      </mesh>

      {/* HTML label rendered in 3D canvas */}
      {(hovered || emissive || radius > 0.5) && (
        <Html distanceFactor={10} position={[0, radius + 0.3, 0]} center>
          <div
            style={{
              background: "rgba(15, 23, 42, 0.85)",
              backdropFilter: "blur(4px)",
              border: `1px solid ${color}`,
              borderRadius: "4px",
              padding: "4px 8px",
              color: "#fff",
              fontSize: "11px",
              fontWeight: "bold",
              fontFamily: '"Outfit", sans-serif',
              whiteSpace: "nowrap",
              pointerEvents: "none",
              boxShadow: `0 0 10px ${color}44`,
            }}
          >
            {name}
          </div>
        </Html>
      )}
    </group>
  );
}
