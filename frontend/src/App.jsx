import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Viewer,
  Entity,
  PointGraphics,
  LabelGraphics,
  PolylineGraphics,
  EllipsoidGraphics,
  ImageryLayer,
} from "resium";
import {
  Cartesian3,
  Color,
  CallbackProperty,
  DistanceDisplayCondition,
  JulianDate,
  ArcGisMapServerImageryProvider,
} from "cesium";
import * as satellite from "satellite.js";
import "cesium/Build/Cesium/Widgets/widgets.css";

// Import your new 3D Solar System component
import InterplanetaryScene from "./components/Interplanetary/InterplanetaryScene";

// ==========================================
// 1. EARTH-CENTRIC VIEW
// ==========================================
const EarthSatelliteView = ({ satellites }) => {
  const [selectedSat, setSelectedSat] = useState(null);
  const [trackedEntity, setTrackedEntity] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [liveVelocity, setLiveVelocity] = useState("0.000");
  const [imageryProvider, setImageryProvider] = useState(null);

  const [showLEO, setShowLEO] = useState(true);
  const [showMEO, setShowMEO] = useState(true);
  const [showGEO, setShowGEO] = useState(true);

  // Initialize Cesium Imagery asynchronously to prevent WebGL crash
  useEffect(() => {
    ArcGisMapServerImageryProvider.fromUrl(
      "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
    )
      .then((provider) => setImageryProvider(provider))
      .catch((err) => console.error("Failed to load ArcGIS Imagery:", err));
  }, []);

  // Performance isolation: Mutable ref to hold 60FPS velocity without re-rendering React
  const velocityRef = useRef("0.000");

  // Poll the mutable ref at 10FPS (100ms) to update the UI smoothly
  useEffect(() => {
    if (!selectedSat) return;
    const interval = setInterval(() => {
      if (velocityRef.current !== liveVelocity) {
        setLiveVelocity(velocityRef.current);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [selectedSat, liveVelocity]);

  // Pre-process satellite records efficiently
  const satRecords = useMemo(() => {
    return satellites
      .filter((s) => s.line1 && s.line2)
      .map((sat) => ({
        ...sat,
        satrec: satellite.twoline2satrec(sat.line1, sat.line2),
      }));
  }, [satellites]);

  // Apply the Search Filter
  const filteredRecords = useMemo(() => {
    if (!searchQuery) return satRecords;
    const lowerQuery = searchQuery.toLowerCase();
    return satRecords.filter((s) => s.name.toLowerCase().includes(lowerQuery));
  }, [satRecords, searchQuery]);

  // Hook into native Cesium Viewer Events
  const handleSelectedEntityChanged = (entity) => {
    if (entity) {
      const targetId = typeof entity.id === "string" ? entity.id : entity.name;
      const sat = satRecords.find((s) => s.name === targetId);
      setSelectedSat(sat || null);
      setTrackedEntity(entity);
      velocityRef.current = "0.000"; // Reset velocity on target change
    } else {
      setSelectedSat(null);
      setTrackedEntity(null);
    }
  };

  const filterBtnStyle = (active) => ({
    padding: "10px",
    background: active ? "#2e7d32" : "#444",
    color: "white",
    border: "1px solid #666",
    borderRadius: "4px",
    cursor: "pointer",
    fontWeight: "bold",
    transition: "0.2s",
    fontFamily: "sans-serif",
  });

  const linkStyle = {
    color: "#00ffcc",
    textDecoration: "none",
    borderBottom: "1px dotted #00ffcc",
  };

  return (
    <>
      {/* ADVANCED ORBITAL MATH PANEL */}
      {selectedSat && (
        <div
          style={{
            position: "absolute",
            top: 110,
            left: 20,
            zIndex: 10,
            backgroundColor: "rgba(10,10,15,0.9)",
            padding: "15px 25px",
            borderRadius: "8px",
            color: "white",
            minWidth: "280px",
            borderLeft: "4px solid #00ffcc",
            fontFamily: "sans-serif",
            borderTop: "1px solid #333",
            borderRight: "1px solid #333",
            borderBottom: "1px solid #333",
            boxShadow: "0 4px 15px rgba(0,0,0,0.5)",
            pointerEvents: "auto",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "18px", color: "#fff" }}>
            {selectedSat.name}
          </h2>
          <div
            style={{
              margin: "5px 0 15px 0",
              fontSize: "12px",
              opacity: 0.7,
              fontFamily: "monospace",
            }}
          >
            NORAD ID: {selectedSat.line1.substring(2, 7).trim()}
          </div>

          {/* Real-Time Velocity Readout */}
          <div
            style={{
              marginBottom: "15px",
              padding: "10px",
              backgroundColor: "#111",
              borderRadius: "4px",
              border: "1px solid #333",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "1px",
                color: "#888",
              }}
            >
              Live Orbital Velocity
            </div>
            <div
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                color: "#00ffcc",
                fontFamily: "monospace",
              }}
            >
              {liveVelocity}{" "}
              <span style={{ fontSize: "12px", color: "#fff" }}>km/s</span>
            </div>
          </div>

          {/* Static Orbital Elements Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1fr",
              gap: "8px",
              fontSize: "12px",
              fontFamily: "monospace",
              marginBottom: "15px",
            }}
          >
            <div>
              <a
                href="https://en.wikipedia.org/wiki/Orbital_inclination"
                target="_blank"
                rel="noreferrer"
                style={linkStyle}
              >
                Inclination:
              </a>
            </div>
            <div style={{ textAlign: "right" }}>
              {((selectedSat.satrec.inclo * 180) / Math.PI).toFixed(2)}°
            </div>

            <div>
              <a
                href="https://en.wikipedia.org/wiki/Orbital_eccentricity"
                target="_blank"
                rel="noreferrer"
                style={linkStyle}
              >
                Eccentricity:
              </a>
            </div>
            <div style={{ textAlign: "right" }}>
              {selectedSat.satrec.ecco.toFixed(5)}
            </div>

            <div>
              <a
                href="https://en.wikipedia.org/wiki/Longitude_of_the_ascending_node"
                target="_blank"
                rel="noreferrer"
                style={linkStyle}
              >
                RAAN:
              </a>
            </div>
            <div style={{ textAlign: "right" }}>
              {((selectedSat.satrec.nodeo * 180) / Math.PI).toFixed(2)}°
            </div>

            <div>
              <a
                href="https://en.wikipedia.org/wiki/Argument_of_periapsis"
                target="_blank"
                rel="noreferrer"
                style={linkStyle}
              >
                Arg of Perigee:
              </a>
            </div>
            <div style={{ textAlign: "right" }}>
              {((selectedSat.satrec.argpo * 180) / Math.PI).toFixed(2)}°
            </div>

            <div>
              <a
                href="https://en.wikipedia.org/wiki/Mean_motion"
                target="_blank"
                rel="noreferrer"
                style={linkStyle}
              >
                Mean Motion:
              </a>
            </div>
            <div style={{ textAlign: "right" }}>
              {((selectedSat.satrec.no * 60 * 24) / (2 * Math.PI)).toFixed(2)}{" "}
              rev/d
            </div>
          </div>

          <a
            href={`https://www.n2yo.com/satellite/?s=${selectedSat.line1.substring(2, 7).trim()}`}
            target="_blank"
            rel="noreferrer"
            style={{
              color: "#000",
              backgroundColor: "#00ffcc",
              textDecoration: "none",
              padding: "8px 12px",
              borderRadius: "4px",
              fontWeight: "bold",
              fontSize: "12px",
              display: "block",
              textAlign: "center",
              textTransform: "uppercase",
            }}
          >
            Analyze External Telemetry
          </a>
        </div>
      )}

      {/* SEARCH AND FILTER UI PANEL */}
      <div
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          zIndex: 10,
          backgroundColor: "rgba(10,10,15,0.85)",
          padding: "15px",
          borderRadius: "8px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          fontFamily: "sans-serif",
          border: "1px solid #333",
          boxShadow: "0 4px 15px rgba(0,0,0,0.5)",
          pointerEvents: "auto",
          width: "200px",
        }}
      >
        {/* Search Engine */}
        <input
          type="text"
          placeholder="Search satellites..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            padding: "8px",
            backgroundColor: "#222",
            border: "1px solid #555",
            borderRadius: "4px",
            color: "white",
            marginBottom: "10px",
            fontFamily: "sans-serif",
          }}
        />

        <h3
          style={{
            margin: "0 0 5px 0",
            color: "#fff",
            fontSize: "14px",
            textAlign: "center",
            letterSpacing: "1px",
            textTransform: "uppercase",
          }}
        >
          Orbital Shells
        </h3>
        <button
          style={filterBtnStyle(showLEO)}
          onClick={() => setShowLEO(!showLEO)}
        >
          LEO (&lt; 2000km)
        </button>
        <button
          style={filterBtnStyle(showMEO)}
          onClick={() => setShowMEO(!showMEO)}
        >
          MEO (2000-35786km)
        </button>
        <button
          style={filterBtnStyle(showGEO)}
          onClick={() => setShowGEO(!showGEO)}
        >
          GEO (&gt; 35786km)
        </button>
      </div>

      <Viewer
        full
        timeline={false}
        animation={true}
        baseLayerPicker={false}
        infoBox={false}
        selectionIndicator={true}
        scene3DOnly={true}
        shadows={true}
        onSelectedEntityChanged={handleSelectedEntityChanged}
        trackedEntity={trackedEntity}
      >
        {imageryProvider && <ImageryLayer imageryProvider={imageryProvider} />}

        {/* Orbit Structural Shells */}
        {showLEO && (
          <Entity position={Cartesian3.ZERO}>
            <EllipsoidGraphics
              radii={
                new Cartesian3(
                  6371000 + 2000000,
                  6371000 + 2000000,
                  6371000 + 2000000,
                )
              }
              material={Color.CYAN.withAlpha(0.02)}
              outline={true}
              outlineColor={Color.CYAN.withAlpha(0.1)}
            />
          </Entity>
        )}
        {showMEO && (
          <Entity position={Cartesian3.ZERO}>
            <EllipsoidGraphics
              radii={
                new Cartesian3(
                  6371000 + 20000000,
                  6371000 + 20000000,
                  6371000 + 20000000,
                )
              }
              material={Color.ORANGE.withAlpha(0.02)}
              outline={true}
              outlineColor={Color.ORANGE.withAlpha(0.08)}
            />
          </Entity>
        )}
        {showGEO && (
          <Entity position={Cartesian3.ZERO}>
            <EllipsoidGraphics
              radii={
                new Cartesian3(
                  6371000 + 35786000,
                  6371000 + 35786000,
                  6371000 + 35786000,
                )
              }
              material={Color.MAGENTA.withAlpha(0.02)}
              outline={true}
              outlineColor={Color.MAGENTA.withAlpha(0.08)}
            />
          </Entity>
        )}

        {/* Dynamic Navigational Entities (Filtered) */}
        {filteredRecords.map((sat) => {
          const isSelected = selectedSat && selectedSat.name === sat.name;

          const positionProperty = new CallbackProperty((time) => {
            const jsDate = JulianDate.toDate(time);
            const posVel = satellite.propagate(sat.satrec, jsDate);

            if (posVel.position && posVel.position !== true) {
              // --- EXTRACT REAL-TIME VELOCITY IF SELECTED ---
              if (isSelected && posVel.velocity) {
                const v = posVel.velocity;
                const speed = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
                velocityRef.current = speed.toFixed(3);
              }

              const gmst = satellite.gstime(jsDate);
              const geodetic = satellite.eciToGeodetic(posVel.position, gmst);
              const lat = satellite.degreesLat(geodetic.latitude);
              const lon = satellite.degreesLong(geodetic.longitude);
              const alt = geodetic.height * 1000;

              if (isNaN(lat) || isNaN(lon) || isNaN(alt))
                return Cartesian3.ZERO;
              return Cartesian3.fromDegrees(lon, lat, alt);
            }
            return Cartesian3.ZERO;
          }, false);

          let pathProperty = null;
          if (isSelected) {
            pathProperty = new CallbackProperty((time) => {
              const points = [];
              const period = (2 * Math.PI) / sat.satrec.no;

              for (let i = 0; i <= 120; i++) {
                const offset = (i / 120) * period;
                const simDate = new Date(
                  JulianDate.toDate(time).getTime() + offset * 60000,
                );

                const posVel = satellite.propagate(sat.satrec, simDate);
                if (posVel.position && posVel.position !== true) {
                  const gmst = satellite.gstime(simDate);
                  const geodetic = satellite.eciToGeodetic(
                    posVel.position,
                    gmst,
                  );
                  const lat = satellite.degreesLat(geodetic.latitude);
                  const lon = satellite.degreesLong(geodetic.longitude);
                  const alt = geodetic.height * 1000;
                  if (!isNaN(lat) && !isNaN(lon) && !isNaN(alt)) {
                    points.push(Cartesian3.fromDegrees(lon, lat, alt));
                  }
                }
              }
              return points;
            }, false);
          }

          return (
            <Entity
              key={sat.name}
              id={sat.name}
              name={sat.name}
              position={positionProperty}
            >
              <PointGraphics
                pixelSize={isSelected ? 16 : 10}
                color={sat.alert ? Color.RED : Color.LIME}
                outlineColor={Color.WHITE}
                outlineWidth={isSelected ? 2 : 0}
                distanceDisplayCondition={
                  new DistanceDisplayCondition(0.0, Number.MAX_VALUE)
                }
              />
              <LabelGraphics
                text={sat.name}
                font="14px sans-serif"
                fillColor={Color.WHITE}
                outlineColor={Color.BLACK}
                outlineWidth={2}
                pixelOffset={{ x: 0, y: -20 }}
                showBackground={true}
                backgroundColor={new Color(0.1, 0.1, 0.1, 0.8)}
                distanceDisplayCondition={
                  new DistanceDisplayCondition(0.0, 40000000.0)
                }
              />
              {isSelected && (
                <PolylineGraphics
                  positions={pathProperty}
                  width={2}
                  material={Color.CYAN.withAlpha(0.6)}
                />
              )}
            </Entity>
          );
        })}
      </Viewer>
    </>
  );
};

// ==========================================
// 2. MAIN APP DASHBOARD (The Orchestrator)
// ==========================================
function App() {
  const [viewMode, setViewMode] = useState("earth");
  const [satellites, setSatellites] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchSatellites = async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/satellites`);
        if (response.ok) {
          const data = await response.json();
          setSatellites(data);
        }
      } catch (error) {
        console.error("Failed to fetch satellites:", error);
      }
    };
    fetchSatellites();
    const interval = setInterval(fetchSatellites, 30000);
    return () => clearInterval(interval);
  }, []);

  // --- CUSTOM TLE INGESTION LOGIC ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      // Split by line and remove empty lines
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const newSats = [];
      // Step by 3 to chunk Name, Line 1, and Line 2
      for (let i = 0; i < lines.length; i += 3) {
        if (lines[i] && lines[i + 1] && lines[i + 2]) {
          newSats.push({
            // Clean leading structural zeros from custom TLE names if present
            name: lines[i].replace(/^0\s+/, ""),
            line1: lines[i + 1],
            line2: lines[i + 2],
            alert: false,
          });
        }
      }
      // Inject directly into the engine
      setSatellites((prev) => [...prev, ...newSats]);
    };
    reader.readAsText(file);
    // Reset input so the same file can be uploaded again if needed
    e.target.value = null;
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        backgroundColor: "black",
        overflow: "hidden",
      }}
    >
      {/* Global ORCAS Header & Navigation Controls */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          zIndex: 100,
          backgroundColor: "rgba(10,10,15,0.85)",
          padding: "15px 25px",
          borderRadius: "8px",
          border: "1px solid #333",
          color: "white",
          fontFamily: "sans-serif",
          boxShadow: "0 4px 15px rgba(0,0,0,0.5)",
          pointerEvents: "auto",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "24px",
            fontWeight: "bold",
            color: "#00ffcc",
          }}
        >
          ORCAS Dashboard
        </h1>
        <p
          style={{
            margin: "5px 0 15px 0",
            opacity: 0.8,
            fontSize: "12px",
            letterSpacing: "1px",
            textTransform: "uppercase",
          }}
        >
          System Toggle
        </p>

        <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
          <button
            onClick={() => setViewMode("earth")}
            style={{
              padding: "8px 12px",
              cursor: "pointer",
              backgroundColor: viewMode === "earth" ? "#00ffcc" : "#333",
              color: viewMode === "earth" ? "#000" : "#fff",
              border: "none",
              borderRadius: "4px",
              fontWeight: "bold",
              transition: "0.2s",
            }}
          >
            GEOCENTRIC (EARTH)
          </button>
          <button
            onClick={() => setViewMode("solar")}
            style={{
              padding: "8px 12px",
              cursor: "pointer",
              backgroundColor: viewMode === "solar" ? "#00ffcc" : "#333",
              color: viewMode === "solar" ? "#000" : "#fff",
              border: "none",
              borderRadius: "4px",
              fontWeight: "bold",
              transition: "0.2s",
            }}
          >
            HELIOCENTRIC (SOLAR)
          </button>
        </div>

        {/* CUSTOM TLE UPLOAD BUTTON */}
        <div style={{ borderTop: "1px solid #444", paddingTop: "15px" }}>
          <input
            type="file"
            accept=".txt,.tle"
            ref={fileInputRef}
            onChange={handleFileUpload}
            style={{ display: "none" }}
          />
          <button
            onClick={() => fileInputRef.current.click()}
            style={{
              width: "100%",
              padding: "8px",
              backgroundColor: "#2e7d32",
              color: "white",
              border: "1px solid #4caf50",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "12px",
              textTransform: "uppercase",
            }}
          >
            + Upload Custom TLE
          </button>
        </div>
      </div>

      {viewMode === "earth" ? (
        <EarthSatelliteView satellites={satellites} />
      ) : (
        <InterplanetaryScene />
      )}
    </div>
  );
}

export default App;
