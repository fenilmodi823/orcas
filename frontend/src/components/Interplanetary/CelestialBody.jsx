import React, { useMemo, useState, useRef } from "react";
import { Line, useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";

// Texture dictionary mapping celestial body name to high-res textures hosted on Unpkg
const TEXTURE_MAP = {
  earth: "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg",
  mars: "https://unpkg.com/three-globe/example/img/earth-water.png",
  jupiter: "https://unpkg.com/three-globe/example/img/earth-night.jpg",
  venus: "https://unpkg.com/three-globe/example/img/earth-topology.png",
  mercury: "https://unpkg.com/three-globe/example/img/earth-water.png",
};

// Base colors / color tints to apply to the textures (mars is tinted red)
const COLOR_MAP = {
  mercury: "#888888",
  venus: "#e5c158",
  earth: "#ffffff",
  mars: "#ff5533", // Martian red tint applied to the texture map
  jupiter: "#e5b982",
};

function TexturedBody({ name, currentPosition, radius, threatStatus, hovered, setHovered, materialRef, onClick }) {
  const textureUrl = TEXTURE_MAP[name.toLowerCase()];
  const texture = useTexture(textureUrl);

  const baseColor = COLOR_MAP[name.toLowerCase()] || "#ffffff";
  const displayColor = threatStatus === "CRITICAL" ? "#ff0000" : baseColor;
  const displayEmissive = threatStatus === "CRITICAL" ? "#ff0000" : baseColor;

  return (
    <mesh
      position={currentPosition}
      onClick={onClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      style={{ cursor: hovered ? "pointer" : "auto" }}
    >
      <sphereGeometry args={[radius, 32, 32]} />
      <meshStandardMaterial
        ref={materialRef}
        map={texture}
        color={displayColor}
        emissive={displayEmissive}
        emissiveIntensity={threatStatus === "CRITICAL" ? 1.0 : (hovered ? 0.5 : 0)}
      />
    </mesh>
  );
}

function UntexturedBody({ name, currentPosition, radius, threatStatus, hovered, setHovered, materialRef, onClick }) {
  const isAsteroid = ["apophis", "bennu", "ryugu"].includes(name.toLowerCase());
  const baseColor = isAsteroid ? "#777777" : "#888888";
  const displayColor = threatStatus === "CRITICAL" ? "#ff0000" : baseColor;
  const displayEmissive = threatStatus === "CRITICAL" ? "#ff0000" : baseColor;

  return (
    <mesh
      position={currentPosition}
      onClick={onClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      style={{ cursor: hovered ? "pointer" : "auto" }}
    >
      <sphereGeometry args={[radius, 32, 32]} />
      <meshStandardMaterial
        ref={materialRef}
        color={displayColor}
        emissive={displayEmissive}
        emissiveIntensity={threatStatus === "CRITICAL" ? 1.0 : (hovered ? 0.5 : 0)}
      />
    </mesh>
  );
}

export default function CelestialBody({
  name,
  currentPosition,
  orbitalPath,
  onFocus,
  threatStatus,
}) {
  const [hovered, setHovered] = useState(false);

  const isAsteroid = ["apophis", "bennu", "ryugu"].includes(name.toLowerCase());
  const hasTexture = !!TEXTURE_MAP[name.toLowerCase()];
  const radius = isAsteroid ? 0.015 : 0.05;

  const points = useMemo(() => {
    return orbitalPath.map((pos) => [pos[0], pos[1], pos[2]]);
  }, [orbitalPath]);

  const handleClick = (e) => {
    e.stopPropagation();
    onFocus({ position: currentPosition, radius: radius });
  };

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

  const bodyColor = hasTexture ? (COLOR_MAP[name.toLowerCase()] || "#ffffff") : "#777777";

  return (
    <group>
      {hasTexture ? (
        <TexturedBody
          name={name}
          currentPosition={currentPosition}
          radius={radius}
          threatStatus={threatStatus}
          hovered={hovered}
          setHovered={setHovered}
          materialRef={materialRef}
          onClick={handleClick}
        />
      ) : (
        <UntexturedBody
          name={name}
          currentPosition={currentPosition}
          radius={radius}
          threatStatus={threatStatus}
          hovered={hovered}
          setHovered={setHovered}
          materialRef={materialRef}
          onClick={handleClick}
        />
      )}

      {/* 2. The Orbital Trail */}
      {points.length > 0 && (
        <Line
          points={points}
          color={threatStatus === "CRITICAL" ? "#ff0000" : bodyColor}
          lineWidth={1.5}
          opacity={0.4}
          transparent
        />
      )}
    </group>
  );
}
