import React, { useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { useOrbit } from "../../context/OrbitContext";
import GeocentricScene from "./GeocentricScene";
import HeliocentricScene from "./HeliocentricScene";
import * as THREE from "three";

// Bug-free CameraRig component directly embedded in this file to manage camera interpolation
function CameraRig({ focusTarget, viewMode }) {
  const controlsRef = useRef();
  const [isAnimating, setIsAnimating] = useState(false);
  const previousTarget = useRef(null);

  // Trigger animation when the focus target changes
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
      let targetVec = new THREE.Vector3(0, 0, 0);

      // Find the object's 3D position dynamically in the scene if it is moving (like planets or satellites)
      if (focusTarget.id !== "sun" && focusTarget.id !== "earth") {
        const obj = state.scene.getObjectByName(focusTarget.name);
        if (obj) {
          obj.getWorldPosition(targetVec);
        } else {
          // Fallback to predefined/static position vector
          targetVec.set(...(focusTarget.position || [0, 0, 0]));
        }
      } else {
        targetVec.set(...(focusTarget.position || [0, 0, 0]));
      }

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
    } else if (focusTarget) {
      // If we are not animating but still locked on a target (e.g. tracking a moving target),
      // we update the target vector dynamically without modifying camera position to allow OrbitControls zoom/rotation
      let targetVec = new THREE.Vector3(0, 0, 0);
      if (focusTarget.id !== "sun" && focusTarget.id !== "earth") {
        const obj = state.scene.getObjectByName(focusTarget.name);
        if (obj) {
          obj.getWorldPosition(targetVec);
          controlsRef.current.target.copy(targetVec);
          controlsRef.current.update();
        }
      }
    }
  });

  return <OrbitControls ref={controlsRef} makeDefault dampingFactor={0.05} enableDamping />;
}

export default function StageCanvas() {
  const { viewMode, selectedTarget } = useOrbit();

  // Render scene based on viewMode using a switch statement
  const renderScene = () => {
    switch (viewMode) {
      case "geocentric":
        return <GeocentricScene />;
      case "heliocentric":
        return <HeliocentricScene />;
      default:
        return <GeocentricScene />;
    }
  };

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", backgroundColor: "#020617" }}>
      <Canvas
        camera={{ position: [0, -10, 8], fov: 45, near: 0.01, far: 1000 }}
        gl={{ antialias: true, logarithmicDepthBuffer: true }}
      >
        <color attach="background" args={["#020617"]} />
        <ambientLight intensity={0.15} />
        <pointLight position={[0, 0, 0]} intensity={3.0} color="#fff8e7" />
        
        {/* Decorative directional light for Earth/planetary shading */}
        <directionalLight position={[5, 3, 5]} intensity={1.5} color="#e0f2fe" />

        {/* Shared starry backdrop with specified parameters */}
        <Stars
          radius={300}
          depth={60}
          count={2000}
          factor={7}
          saturation={0}
          fade
          speed={1}
        />

        {renderScene()}

        {/* Embedded CameraRig with current selectedTarget */}
        <CameraRig focusTarget={selectedTarget} viewMode={viewMode} />
      </Canvas>
    </div>
  );
}
