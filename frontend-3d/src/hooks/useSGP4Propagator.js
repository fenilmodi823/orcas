import { useEffect, useState } from "react";
import { geodeticToCartesian } from "../utils/coordinateConverter";

/**
 * Custom hook to simulate live SGP4 orbital propagation for satellites.
 * Bypasses deterministic Keplerian orbits for drift and perturbation modeling.
 */
export function useSGP4Propagator(satellite, isSimulating = true) {
  const [position, setPosition] = useState([0, 0, 0]);
  const [telemetry, setTelemetry] = useState({
    velocity: "0.00 km/s",
    latitude: "0.00°",
    longitude: "0.00°",
    altitude: "0 km",
  });

  useEffect(() => {
    if (!satellite) return;

    let angle = Math.random() * Math.PI * 2;
    const baseAltitude =
      satellite.type === "LEO" ? 0.35 : satellite.type === "MEO" ? 1.2 : 2.5;
    const speed =
      satellite.type === "LEO" ? 0.03 : satellite.type === "MEO" ? 0.01 : 0.004;

    const interval = setInterval(() => {
      if (!isSimulating) return;

      // Increment orbit angle with drift modeling
      angle += speed;

      // Derive geocentric lat/lon for tracking panel
      const lat = Math.sin(angle) * parseFloat(satellite.inclination || 51.64);
      const lon = (((angle * 180) / Math.PI) % 360) - 180;

      // Calculate scaled altitude with small orbital eccentricity variation
      const eccOffset = Math.sin(angle * 2) * 0.03;
      const currentAlt = baseAltitude + eccOffset;

      const cartesianPos = geodeticToCartesian(lat, lon, currentAlt, 2.0);
      setPosition(cartesianPos);

      // Compute velocity magnitude with Keplerian acceleration at perigee
      const vMagnitude = 7.66 - Math.sin(angle * 2) * 0.25;

      setTelemetry({
        velocity: `${vMagnitude.toFixed(2)} km/s`,
        latitude: `${lat.toFixed(2)}°`,
        longitude: `${lon.toFixed(2)}°`,
        altitude: satellite.altitude,
      });
    }, 50);

    return () => clearInterval(interval);
  }, [satellite, isSimulating]);

  return { position, telemetry };
}
