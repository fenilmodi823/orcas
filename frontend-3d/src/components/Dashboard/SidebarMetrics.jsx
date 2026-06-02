import React from "react";
import { useOrbit } from "../../context/OrbitContext";
import { useSGP4Propagator } from "../../hooks/useSGP4Propagator";
import { Activity, ShieldAlert, Cpu, Orbit, Info } from "lucide-react";

export default function SidebarMetrics() {
  const { selectedTarget, resetTarget, viewMode } = useOrbit();

  // Retrieve live propagated telemetry for selected geocentric satellite
  const isGeoSatellite =
    selectedTarget &&
    viewMode === "geocentric" &&
    selectedTarget.id !== "earth";
  const { telemetry } = useSGP4Propagator(
    isGeoSatellite ? selectedTarget : null,
  );

  return (
    <div
      style={{
        width: "320px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        padding: "20px",
        boxSizing: "border-box",
        background: "rgba(10, 15, 30, 0.75)",
        backdropFilter: "blur(20px)",
        borderRight: "1px solid rgba(0, 255, 204, 0.15)",
        boxShadow: "10px 0 30px rgba(0, 0, 0, 0.5)",
        color: "#cbd5e1",
        overflowY: "auto",
        zIndex: 10,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <Orbit size={24} color="#00ffcc" />
        <h2
          style={{
            margin: 0,
            fontSize: "18px",
            fontWeight: 700,
            letterSpacing: "1px",
            color: "#fff",
          }}
        >
          TELEMETRY HUB
        </h2>
      </div>

      {/* Target Focus Panel */}
      <div
        style={{
          background: "rgba(15, 23, 42, 0.6)",
          border: "1px solid rgba(0, 255, 204, 0.2)",
          borderRadius: "12px",
          padding: "16px",
          position: "relative",
          boxShadow: "inset 0 0 15px rgba(0, 255, 204, 0.05)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              fontWeight: "bold",
              textTransform: "uppercase",
              color: "#64748b",
              letterSpacing: "1px",
            }}
          >
            Target Lock
          </span>
          {selectedTarget && (
            <button
              onClick={resetTarget}
              style={{
                fontSize: "10px",
                background: "rgba(239, 68, 68, 0.2)",
                color: "#ff453a",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                borderRadius: "4px",
                padding: "2px 8px",
                cursor: "pointer",
                fontWeight: "bold",
                transition: "0.2s",
              }}
            >
              UNLOCK
            </button>
          )}
        </div>

        {selectedTarget ? (
          <div>
            <h3
              style={{
                margin: "0 0 8px 0",
                fontSize: "20px",
                fontWeight: 700,
                color: selectedTarget.color || "#00ffcc",
              }}
            >
              {selectedTarget.name}
            </h3>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                fontSize: "13px",
                fontFamily: '"JetBrains Mono", monospace',
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>TYPE</span>
                <span style={{ color: "#fff" }}>{selectedTarget.type}</span>
              </div>

              {isGeoSatellite ? (
                <>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span style={{ color: "#64748b" }}>VELOCITY</span>
                    <span style={{ color: "#00ffcc" }}>
                      {telemetry.velocity}
                    </span>
                  </div>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span style={{ color: "#64748b" }}>LATITUDE</span>
                    <span style={{ color: "#fff" }}>{telemetry.latitude}</span>
                  </div>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span style={{ color: "#64748b" }}>LONGITUDE</span>
                    <span style={{ color: "#fff" }}>{telemetry.longitude}</span>
                  </div>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span style={{ color: "#64748b" }}>ALTITUDE</span>
                    <span style={{ color: "#fff" }}>{telemetry.altitude}</span>
                  </div>
                </>
              ) : (
                <>
                  {selectedTarget.orbitalRadius && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ color: "#64748b" }}>ORBIT AU</span>
                      <span style={{ color: "#fff" }}>
                        {selectedTarget.orbitalRadius} AU
                      </span>
                    </div>
                  )}
                  {selectedTarget.radius && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ color: "#64748b" }}>RADIUS</span>
                      <span style={{ color: "#fff" }}>
                        {selectedTarget.radius}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: "20px 0",
              color: "#64748b",
              fontSize: "14px",
            }}
          >
            <Info size={32} style={{ marginBottom: "8px", opacity: 0.5 }} />
            <div>SELECT ORBITAL TARGET TO INITIALIZE STATE VECTORS</div>
          </div>
        )}
      </div>

      {/* System Sensors Status */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <h4
          style={{
            margin: 0,
            fontSize: "12px",
            fontWeight: "bold",
            textTransform: "uppercase",
            color: "#64748b",
            letterSpacing: "1px",
          }}
        >
          SYSTEM DIAGNOSTICS
        </h4>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px",
              background: "rgba(15, 23, 42, 0.4)",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <Activity size={16} color="#00ffcc" />
            <div style={{ fontSize: "13px" }}>
              <div style={{ fontWeight: "bold", color: "#fff" }}>
                SGP4 Propagator
              </div>
              <div style={{ fontSize: "11px", color: "#64748b" }}>
                Active • 60Hz Thread
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px",
              background: "rgba(15, 23, 42, 0.4)",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <ShieldAlert size={16} color="#ff3b30" />
            <div style={{ fontSize: "13px" }}>
              <div style={{ fontWeight: "bold", color: "#fff" }}>
                ML Conjunction Risk
              </div>
              <div style={{ fontSize: "11px", color: "#64748b" }}>
                kD-Tree Parser Running
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px",
              background: "rgba(15, 23, 42, 0.4)",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <Cpu size={16} color="#ffcc00" />
            <div style={{ fontSize: "13px" }}>
              <div style={{ fontWeight: "bold", color: "#fff" }}>
                Ephemeris Engine
              </div>
              <div style={{ fontSize: "11px", color: "#64748b" }}>
                Double-precision Float
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
