import React, { createContext, useContext, useState } from "react";

const OrbitContext = createContext();

export function OrbitProvider({ children }) {
  const [viewMode, setViewMode] = useState("geocentric");
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [debrisFilters, setDebrisFilters] = useState({
    LEO: true,
    MEO: true,
    GEO: true,
  });

  const toggleDebrisFilter = (key) => {
    setDebrisFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const resetTarget = () => {
    setSelectedTarget(null);
  };

  // Predefined catalog of targets for Geocentric and Heliocentric scenes
  const targets = {
    geocentric: [
      { id: "iss", name: "ISS (ZARYA)", type: "LEO", radius: 0.1, color: "#00ffcc", velocity: "7.66 km/s", altitude: "418 km", inclination: "51.64°" },
      { id: "iridium", name: "IRIDIUM 33", type: "LEO", radius: 0.08, color: "#ff3b30", velocity: "7.45 km/s", altitude: "780 km", inclination: "86.4°" },
      { id: "gps", name: "GPS BIIF-1", type: "MEO", radius: 0.08, color: "#ffcc00", velocity: "3.87 km/s", altitude: "20,180 km", inclination: "55.0°" },
      { id: "goes", name: "GOES 16", type: "GEO", radius: 0.09, color: "#af52de", velocity: "3.07 km/s", altitude: "35,786 km", inclination: "0.01°" },
    ],
    heliocentric: [
      { id: "sun", name: "Sun", type: "Star", radius: 1.2, color: "#ffcc00", position: [0, 0, 0] },
      { id: "mercury", name: "Mercury", type: "Planet", radius: 0.15, color: "#888888", position: [2.2, 0, 0], speed: 1.5, orbitalRadius: 2.2 },
      { id: "venus", name: "Venus", type: "Planet", radius: 0.25, color: "#e5c158", position: [3.5, 0, 0], speed: 1.0, orbitalRadius: 3.5 },
      { id: "earth", name: "Earth", type: "Planet", radius: 0.3, color: "#007aff", position: [5.5, 0, 0], speed: 0.8, orbitalRadius: 5.5 },
      { id: "mars", name: "Mars", type: "Planet", radius: 0.2, color: "#ff3b30", position: [7.5, 0, 0], speed: 0.6, orbitalRadius: 7.5 },
    ]
  };

  return (
    <OrbitContext.Provider
      value={{
        viewMode,
        setViewMode,
        selectedTarget,
        setSelectedTarget,
        debrisFilters,
        setDebrisFilters,
        toggleDebrisFilter,
        resetTarget,
        targets,
      }}
    >
      {children}
    </OrbitContext.Provider>
  );
}

export function useOrbit() {
  const context = useContext(OrbitContext);
  if (!context) {
    throw new Error("useOrbit must be used within an OrbitProvider");
  }
  return context;
}
