import React, { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import { useSolarSystem } from "../../hooks/useSolarSystem";
import CelestialBody from "./CelestialBody";
import { EffectComposer, Bloom } from "@react-three/postprocessing";

// --- THE MATHEMATICAL CAMERA ENGINE (UPGRADED) ---
function CameraRig({ focusTarget }) {
  const controlsRef = useRef();
  const [isAnimating, setIsAnimating] = useState(false);
  const previousTarget = useRef(null);

  // Trigger animation when a new focus target is selected
  useEffect(() => {
    if (focusTarget) {
      setIsAnimating(true);
    } else {
      setIsAnimating(false);
    }
  }, [focusTarget]);

  useFrame((state) => {
    if (!controlsRef.current) return;

    // Safety fallback: if focusTarget changes reference and wasn't caught by useEffect
    if (focusTarget !== previousTarget.current) {
      previousTarget.current = focusTarget;
      setIsAnimating(true);
    }

    if (isAnimating && focusTarget) {
      const targetVec = new THREE.Vector3(...focusTarget.position);

      // Structurally aligned with Geocentric view angle [0, -12, 8]
      // Preserves original viewing angle by scaling relative Y and Z offsets
      const offsetY = -focusTarget.radius * 8;
      const offsetZ = focusTarget.radius * (16 / 3);
      const idealCameraPos = targetVec.clone().add(new THREE.Vector3(0, offsetY, offsetZ));

      // Linearly interpolate both the camera position and the OrbitControls target
      state.camera.position.lerp(idealCameraPos, 0.05);
      controlsRef.current.target.lerp(targetVec, 0.05);

      // Check distance from current positions to their destinations
      const distToCamera = state.camera.position.distanceTo(idealCameraPos);
      const distToTarget = controlsRef.current.target.distanceTo(targetVec);

      // Stop programmatic camera movement when within the explicit 0.01 threshold
      if (distToCamera < 0.01 && distToTarget < 0.01) {
        setIsAnimating(false);
      }

      controlsRef.current.update();
    }
  });

  return <OrbitControls ref={controlsRef} makeDefault />;
}

// --- THE SCENE COMPONENT ---
export default function InterplanetaryScene() {
  // STATE: The "Time Machine" anchor
  const [simDate, setSimDate] = useState(new Date());
  const [focusTarget, setFocusTarget] = useState(null);

  // The hook now accepts the simulation date!
  const { orbitData, loading, error } = useSolarSystem(simDate);

  // Memoize threats currently in CRITICAL or WARNING status
  const threats = useMemo(() => {
    if (!orbitData) return [];
    return Object.entries(orbitData)
      .filter(([_, data]) => {
        const threat = data.threat_assessment;
        return threat && (threat.status === "CRITICAL" || threat.status === "WARNING");
      })
      .map(([name, data]) => ({
        name: name,
        status: data.threat_assessment.status,
        distance_km: data.threat_assessment.distance_km,
      }));
  }, [orbitData]);

  const hasCriticalThreat = useMemo(() => {
    return threats.some((t) => t.status === "CRITICAL");
  }, [threats]);

  // Helper to format the JS Date for the HTML input field
  const formatDateForInput = (date) => {
    // Adjust for local time zone offset so the date picker doesn't jump a day backward
    const offset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - offset);
    return localDate.toISOString().split("T")[0];
  };

  const handleDateChange = (e) => {
    const newDate = new Date(e.target.value);
    if (!isNaN(newDate)) {
      setSimDate(newDate);
      // Optional: uncomment the line below to reset the camera to the Sun when time jumping
      // setFocusTarget(null);
    }
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        backgroundColor: "black",
        position: "relative",
      }}
    >
      {/* --- THE TIME MACHINE UI --- */}
      <div
        style={{
          position: "absolute",
          bottom: 30,
          left: 30,
          zIndex: 10,
          backgroundColor: "rgba(10,10,15,0.85)",
          padding: "15px 25px",
          borderRadius: "8px",
          border: "1px solid #333",
          color: "white",
          fontFamily: "sans-serif",
          boxShadow: "0 4px 15px rgba(0,0,0,0.5)",
        }}
      >
        <h3
          style={{
            margin: "0 0 10px 0",
            color: "#00ffcc",
            fontSize: "14px",
            textTransform: "uppercase",
          }}
        >
          Temporal Control
        </h3>
        <input
          type="date"
          value={formatDateForInput(simDate)}
          onChange={handleDateChange}
          style={{
            padding: "8px",
            backgroundColor: "#222",
            color: "white",
            border: "1px solid #555",
            borderRadius: "4px",
            cursor: "pointer",
            fontFamily: "monospace",
          }}
        />
        <div
          style={{
            marginTop: "10px",
            fontSize: "12px",
            color: loading ? "#ffcc00" : "#00ffcc",
            fontWeight: "bold",
          }}
        >
          {loading ? "Calculating Ephemeris..." : "Telemetry Synced"}
        </div>
      </div>

      {/* Reset Button overlay */}
      {focusTarget && (
        <button
          onClick={() => setFocusTarget({ position: [0, 0, 0], radius: 1.5 })}
          style={{
            position: "absolute",
            bottom: 30,
            right: 30,
            zIndex: 10,
            padding: "10px 20px",
            background: "rgba(255,0,0,0.7)",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          RESET CAMERA TO SUN
        </button>
      )}

      {/* Error overlay (if the backend crashes) */}
      {error && (
        <div
          style={{
            position: "absolute",
            top: 20,
            right: 200,
            color: "red",
            zIndex: 10,
            backgroundColor: "rgba(0,0,0,0.8)",
            padding: "10px",
          }}
        >
          Telemetry Failure: {error}
        </div>
      )}

      {/* --- THREAT DETECTION ALERT SYSTEM HUD --- */}
      {threats.length > 0 && (
        <>
          <style>
            {`
              @keyframes threat-pulse {
                0% { opacity: 0.65; box-shadow: 0 0 10px rgba(255, 0, 0, 0.4); }
                50% { opacity: 1.0; box-shadow: 0 0 25px rgba(255, 0, 0, 0.8); }
                100% { opacity: 0.65; box-shadow: 0 0 10px rgba(255, 0, 0, 0.4); }
              }
              .threat-critical-flash {
                animation: threat-pulse 1.2s infinite ease-in-out;
              }
            `}
          </style>
          <div
            className={hasCriticalThreat ? "threat-critical-flash" : ""}
            style={{
              position: "absolute",
              top: 25,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 100,
              backgroundColor: hasCriticalThreat ? "rgba(220, 38, 38, 0.95)" : "rgba(217, 119, 6, 0.95)",
              color: "white",
              padding: "14px 28px",
              borderRadius: "8px",
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: "14px",
              fontWeight: "bold",
              textAlign: "center",
              boxShadow: hasCriticalThreat
                ? "0 0 20px rgba(220, 38, 38, 0.6)"
                : "0 0 20px rgba(217, 119, 6, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.25)",
              pointerEvents: "none",
              letterSpacing: "1px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            {threats.map((threat) => {
              const displayDistance = Math.round(threat.distance_km).toLocaleString();
              const capitalizedName = threat.name.toUpperCase();
              if (threat.status === "CRITICAL") {
                return (
                  <div key={threat.name} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                    <span>⚠</span> PROXIMITY ALERT: {capitalizedName} INTERCEPT BOUNDARY CROSSED ({displayDistance} KM)
                  </div>
                );
              } else {
                return (
                  <div key={threat.name} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                    <span>⚠</span> PHA WARNING: {capitalizedName} APPROACHING ({displayDistance} KM)
                  </div>
                );
              }
            })}
          </div>
        </>
      )}

      {/* 3D Canvas Context */}
      <Canvas
        camera={{ position: [0, -12, 8], fov: 45, near: 0.001, far: 1000 }}
        gl={{ logarithmicDepthBuffer: true }}
      >
        <color attach="background" args={["#050505"]} />
        <ambientLight intensity={0.2} />
        <pointLight position={[0, 0, 0]} intensity={2} color="#fffcf2" />
        <Stars
          radius={100}
          depth={50}
          count={5000}
          factor={4}
          saturation={0}
          fade
          speed={1}
        />

        <Suspense fallback={null}>
          {/* The Sun (Clickable!) */}
          <mesh
            position={[0, 0, 0]}
            onClick={(e) => {
              e.stopPropagation();
              setFocusTarget({ position: [0, 0, 0], radius: 0.2 });
            }}
            style={{ cursor: "pointer" }}
          >
            <sphereGeometry args={[0.2, 32, 32]} />
            <meshStandardMaterial
              color="#ffcc00"
              emissive="#ffaa00"
              emissiveIntensity={4}
            />
          </mesh>

          {/* Loop through API payload ONLY if we have data */}
          {orbitData &&
            Object.entries(orbitData).map(([name, data]) => (
              <CelestialBody
                key={name}
                name={name}
                currentPosition={data.current_position}
                orbitalPath={data.orbital_path}
                onFocus={setFocusTarget}
                threatStatus={data.threat_assessment?.status}
              />
            ))}
        </Suspense>

        {/* The new math engine controlling the view */}
        <CameraRig focusTarget={focusTarget} />

        <EffectComposer disableNormalPass>
          <Bloom luminanceThreshold={1} mipmapBlur intensity={2.0} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
