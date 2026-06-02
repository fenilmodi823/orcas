import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useOrbit } from "../../context/OrbitContext";
import CelestialBody from "../Shared/CelestialBody";
import OrbitPath from "../Shared/OrbitPath";
import { useSGP4Propagator } from "../../hooks/useSGP4Propagator";

// Individual Satellite Component that propagates via SGP4
function Satellite({ data }) {
  const { setSelectedTarget } = useOrbit();
  const { position } = useSGP4Propagator(data);

  return (
    <CelestialBody
      name={data.name}
      radius={data.radius}
      color={data.color}
      position={position}
      onClick={() => setSelectedTarget(data)}
      emissive={true}
    />
  );
}

export default function GeocentricScene() {
  const { targets, debrisFilters, setSelectedTarget } = useOrbit();
  const earthRef = useRef();
  const cloudsRef = useRef();

  // Rotate Earth & Cloud Layer at different speeds
  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    if (earthRef.current) {
      earthRef.current.rotation.y = elapsed * 0.02;
    }
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y = elapsed * 0.03;
      cloudsRef.current.rotation.x = Math.sin(elapsed * 0.01) * 0.05;
    }
  });

  // Filter satellites based on orbital shell selection
  const visibleSatellites = targets.geocentric.filter(
    (sat) => debrisFilters[sat.type] !== false,
  );

  return (
    <group>
      {/* 3D Earth Core */}
      <mesh
        ref={earthRef}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedTarget({
            name: "Earth",
            type: "Planet",
            radius: 2.0,
            color: "#007aff",
            velocity: "0 km/s",
            altitude: "Surface",
          });
        }}
      >
        <sphereGeometry args={[2.0, 64, 64]} />
        <meshStandardMaterial
          color="#0d1e3d"
          roughness={0.5}
          metalness={0.3}
          wireframe={false}
        />

        {/* Holographic grid lines over Earth */}
        <mesh>
          <sphereGeometry args={[2.01, 32, 32]} />
          <meshBasicMaterial
            color="#00ffcc"
            wireframe
            transparent
            opacity={0.06}
          />
        </mesh>
      </mesh>

      {/* Cloud / Atmosphere Layer */}
      <mesh ref={cloudsRef}>
        <sphereGeometry args={[2.05, 64, 64]} />
        <meshStandardMaterial
          color="#ffffff"
          transparent
          opacity={0.12}
          depthWrite={false}
          blending={2} // Additive blending
        />
      </mesh>

      {/* Orbit Shell Paths */}
      {debrisFilters.LEO && <OrbitPath radius={2.4} color="#00ffcc" width={1} />}
      {debrisFilters.MEO && <OrbitPath radius={3.2} color="#ffcc00" width={1} />}
      {debrisFilters.GEO && <OrbitPath radius={4.5} color="#af52de" width={1} />}

      {/* Render Active Propagated Satellites */}
      {visibleSatellites.map((sat) => (
        <Satellite key={sat.id} data={sat} />
      ))}

      {/* Swarm of Debris (Instanced or multiple mini stars) */}
      <DebrisSwarm count={300} />
    </group>
  );
}

// Render a beautiful debris field around Earth
function DebrisSwarm({ count }) {
  const points = React.useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      // Choose random LEO, MEO, GEO shell
      const roll = Math.random();
      const r =
        roll < 0.6
          ? 2.2 + Math.random() * 0.4
          : roll < 0.9
            ? 2.8 + Math.random() * 0.8
            : 4.0 + Math.random() * 1.0;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      temp.push([x, y, z]);
    }
    return temp;
  }, [count]);

  return (
    <group>
      {points.map((pos, idx) => (
        <mesh key={idx} position={pos}>
          <boxGeometry args={[0.015, 0.015, 0.015]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.65} />
        </mesh>
      ))}
    </group>
  );
}
