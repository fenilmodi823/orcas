import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useOrbit } from "../../context/OrbitContext";
import CelestialBody from "../Shared/CelestialBody";
import OrbitPath from "../Shared/OrbitPath";

// Animated Planet Component
function Planet({ data }) {
  const { setSelectedTarget } = useOrbit();
  const planetRef = useRef();

  useFrame(({ clock }) => {
    if (planetRef.current) {
      const elapsed = clock.getElapsedTime();
      const speed = data.speed || 1.0;
      const r = data.orbitalRadius || 2.0;

      // Compute orbital motion
      const x = Math.cos(elapsed * speed) * r;
      const z = Math.sin(elapsed * speed) * r;

      planetRef.current.position.set(x, 0, z);
    }
  });

  return (
    <group ref={planetRef}>
      <CelestialBody
        name={data.name}
        radius={data.radius}
        color={data.color}
        position={[0, 0, 0]}
        onClick={() => setSelectedTarget(data)}
        emissive={true}
      />
    </group>
  );
}

export default function HeliocentricScene() {
  const { targets, setSelectedTarget } = useOrbit();

  // Separate Sun from the planets
  const sun = targets.heliocentric.find((t) => t.id === "sun");
  const planets = targets.heliocentric.filter((t) => t.id !== "sun");

  return (
    <group>
      {/* Sun */}
      {sun && (
        <CelestialBody
          name={sun.name}
          radius={sun.radius}
          color={sun.color}
          position={[0, 0, 0]}
          onClick={() => setSelectedTarget(sun)}
          emissive={true}
        />
      )}

      {/* Orbit Paths and Planets */}
      {planets.map((planet) => (
        <React.Fragment key={planet.id}>
          {planet.orbitalRadius && (
            <OrbitPath
              radius={planet.orbitalRadius}
              color={planet.color}
              width={1.5}
            />
          )}
          <Planet data={planet} />
        </React.Fragment>
      ))}

      {/* Ambient solar space debris / asteroids */}
      <AsteroidBelt count={150} />
    </group>
  );
}

function AsteroidBelt({ count }) {
  const asteroids = React.useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      // Asteroids placed in a ring between Mars and Sun (mock Kepler belt)
      const r = 4.2 + Math.random() * 1.5;
      const theta = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 0.2; // Slight vertical inclination

      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;

      temp.push([x, y, z]);
    }
    return temp;
  }, [count]);

  return (
    <group>
      {asteroids.map((pos, idx) => (
        <mesh key={idx} position={pos}>
          <dodecahedronGeometry args={[0.02, 0]} />
          <meshStandardMaterial color="#64748b" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}
