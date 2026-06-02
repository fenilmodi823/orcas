import React from "react";
import { useSpaceTelemetry } from "../../hooks/useSpaceTelemetry";
import { ShieldAlert, AlertTriangle, Radio } from "lucide-react";

export default function AnalyticsHUD() {
  const { metrics, threatEvents } = useSpaceTelemetry();

  return (
    <div
      style={{
        position: "absolute",
        top: "20px",
        right: "20px",
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        width: "380px",
        padding: "16px",
        boxSizing: "border-box",
        borderRadius: "12px",
        background: "rgba(10, 15, 30, 0.75)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(0, 255, 204, 0.15)",
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
        fontFamily: '"Outfit", sans-serif',
      }}
    >
      {/* Top statistics */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}
      >
        <div
          style={{
            background: "rgba(15, 23, 42, 0.4)",
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.02)",
          }}
        >
          <div
            style={{
              fontSize: "10px",
              color: "#64748b",
              fontWeight: "bold",
              textTransform: "uppercase",
            }}
          >
            TRACKED DEBRIS
          </div>
          <div
            style={{
              fontSize: "18px",
              fontWeight: "bold",
              color: "#ff3b30",
              fontFamily: '"JetBrains Mono", monospace',
            }}
          >
            {metrics.trackedDebris.toLocaleString()}
          </div>
        </div>
        <div
          style={{
            background: "rgba(15, 23, 42, 0.4)",
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.02)",
          }}
        >
          <div
            style={{
              fontSize: "10px",
              color: "#64748b",
              fontWeight: "bold",
              textTransform: "uppercase",
            }}
          >
            ACTIVE PAYLOADS
          </div>
          <div
            style={{
              fontSize: "18px",
              fontWeight: "bold",
              color: "#00ffcc",
              fontFamily: '"JetBrains Mono", monospace',
            }}
          >
            {metrics.activePayloads.toLocaleString()}
          </div>
        </div>
      </div>

      <div
        style={{
          background: "rgba(15, 23, 42, 0.4)",
          padding: "10px",
          borderRadius: "8px",
          border: "1px solid rgba(255,255,255,0.02)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "10px",
              color: "#64748b",
              fontWeight: "bold",
              textTransform: "uppercase",
            }}
          >
            KESSLER SYNDROME PROB.
          </div>
          <div
            style={{
              fontSize: "16px",
              fontWeight: "bold",
              color: "#ffcc00",
              fontFamily: '"JetBrains Mono", monospace',
            }}
          >
            {metrics.kesslerProbability.toFixed(4)}%
          </div>
        </div>
        <Radio size={20} color="#ffcc00" />
      </div>

      {/* Warnings & Intercept Vectors HUD */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginBottom: "8px",
          }}
        >
          <ShieldAlert size={14} color="#ff3b30" />
          <span
            style={{
              fontSize: "11px",
              fontWeight: "bold",
              textTransform: "uppercase",
              color: "#64748b",
              letterSpacing: "1px",
            }}
          >
            Conjunction Feed
          </span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            maxHeight: "150px",
            overflowY: "auto",
            paddingRight: "4px",
          }}
        >
          {threatEvents.length === 0 ? (
            <div
              style={{
                fontSize: "12px",
                color: "#64748b",
                textAlign: "center",
                padding: "10px 0",
              }}
            >
              NO IMMEDIATE CONJUNCTIONS DETECTED
            </div>
          ) : (
            threatEvents.map((event) => (
              <div
                key={event.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  background:
                    event.threatLevel === "CRITICAL"
                      ? "rgba(239, 68, 68, 0.08)"
                      : "rgba(245, 158, 11, 0.08)",
                  borderLeft: `3px solid ${event.threatLevel === "CRITICAL" ? "#ff453a" : "#ffcc00"}`,
                  fontSize: "12px",
                  fontFamily: '"JetBrains Mono", monospace',
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <AlertTriangle
                    size={14}
                    color={
                      event.threatLevel === "CRITICAL" ? "#ff453a" : "#ffcc00"
                    }
                  />
                  <div>
                    <span style={{ fontWeight: "bold", color: "#fff" }}>
                      {event.target}
                    </span>
                    <span
                      style={{
                        fontSize: "10px",
                        color: "#64748b",
                        marginLeft: "6px",
                      }}
                    >
                      {event.time}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontWeight: "bold",
                      color:
                        event.threatLevel === "CRITICAL"
                          ? "#ff453a"
                          : "#ffcc00",
                    }}
                  >
                    {event.threatLevel}
                  </div>
                  <div style={{ fontSize: "10px", color: "#cbd5e1" }}>
                    d &lt; {event.distance}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
