import React from "react";
import { useOrbit } from "../../context/OrbitContext";
import { Globe, Sun, Layers, Compass } from "lucide-react";

export default function ControlPanel() {
  const { viewMode, setViewMode, debrisFilters, toggleDebrisFilter, targets, setSelectedTarget } = useOrbit();

  const activeModeStyle = {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "12px 16px",
    background: "rgba(0, 255, 204, 0.15)",
    color: "#00ffcc",
    border: "1px solid rgba(0, 255, 204, 0.4)",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "bold",
    fontFamily: '"Outfit", sans-serif',
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    boxShadow: "0 0 15px rgba(0, 255, 204, 0.2)",
    textShadow: "0 0 8px rgba(0, 255, 204, 0.5)",
  };

  const inactiveModeStyle = {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "12px 16px",
    background: "rgba(15, 23, 42, 0.6)",
    color: "#94a3b8",
    border: "1px solid rgba(255, 255, 255, 0.05)",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "500",
    fontFamily: '"Outfit", sans-serif',
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  };

  const filterContainerStyle = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
    fontSize: "13px",
    color: "#cbd5e1",
    userSelect: "none",
  };

  const checkboxStyle = {
    width: "16px",
    height: "16px",
    borderRadius: "4px",
    accentColor: "#00ffcc",
    cursor: "pointer",
  };

  return (
    <div
      style={{
        position: "absolute",
        top: "20px",
        left: "340px",
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        width: "360px",
        padding: "20px",
        boxSizing: "border-box",
        borderRadius: "12px",
        backdropFilter: "blur(12px)",
        background: "rgba(10, 15, 30, 0.85)",
        border: "1px solid rgba(0, 255, 204, 0.2)",
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
      }}
    >
      {/* View Selector */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
          <Compass size={14} color="#00ffcc" />
          <span style={{ fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", color: "#64748b", letterSpacing: "1px" }}>
            Viewing Reference
          </span>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            style={viewMode === "geocentric" ? activeModeStyle : inactiveModeStyle}
            onClick={() => {
              setViewMode("geocentric");
              setSelectedTarget(null);
            }}
          >
            <Globe size={16} />
            Geocentric Tracking
          </button>
          <button
            style={viewMode === "heliocentric" ? activeModeStyle : inactiveModeStyle}
            onClick={() => {
              setViewMode("heliocentric");
              setSelectedTarget(null);
            }}
          >
            <Sun size={16} />
            Heliocentric Deep Space
          </button>
        </div>
      </div>

      {/* Geocentric Filters (Only visible in Geocentric mode) */}
      {viewMode === "geocentric" && (
        <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
            <Layers size={14} color="#00ffcc" />
            <span style={{ fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", color: "#64748b", letterSpacing: "1px" }}>
              Orbital Shell Filters
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <label style={filterContainerStyle}>
              <input
                type="checkbox"
                checked={debrisFilters.LEO}
                onChange={() => toggleDebrisFilter("LEO")}
                style={checkboxStyle}
              />
              <span style={{ color: debrisFilters.LEO ? "#00ffcc" : "#cbd5e1" }}>
                Low Earth Orbit (LEO) <span style={{ fontSize: "10px", color: "#64748b" }}>(&lt; 2,000 km)</span>
              </span>
            </label>

            <label style={filterContainerStyle}>
              <input
                type="checkbox"
                checked={debrisFilters.MEO}
                onChange={() => toggleDebrisFilter("MEO")}
                style={checkboxStyle}
              />
              <span style={{ color: debrisFilters.MEO ? "#00ffcc" : "#cbd5e1" }}>
                Medium Earth Orbit (MEO) <span style={{ fontSize: "10px", color: "#64748b" }}>(2,000 - 35,000 km)</span>
              </span>
            </label>

            <label style={filterContainerStyle}>
              <input
                type="checkbox"
                checked={debrisFilters.GEO}
                onChange={() => toggleDebrisFilter("GEO")}
                style={checkboxStyle}
              />
              <span style={{ color: debrisFilters.GEO ? "#00ffcc" : "#cbd5e1" }}>
                Geostationary Orbit (GEO) <span style={{ fontSize: "10px", color: "#64748b" }}>(&gt; 35,000 km)</span>
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Target Shortcuts */}
      <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
          <Compass size={14} color="#00ffcc" />
          <span style={{ fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", color: "#64748b", letterSpacing: "1px" }}>
            Quick Target Lock
          </span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {targets[viewMode].map((target) => (
            <button
              key={target.id}
              onClick={() => setSelectedTarget(target)}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: "600",
                cursor: "pointer",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                background: "rgba(15, 23, 42, 0.5)",
                color: target.color || "#cbd5e1",
                transition: "all 0.2s ease",
                boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
              }}
            >
              {target.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
