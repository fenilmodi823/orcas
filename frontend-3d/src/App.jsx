import React from "react";
import { OrbitProvider } from "./context/OrbitContext";
import SidebarMetrics from "./components/Dashboard/SidebarMetrics";
import ControlPanel from "./components/Dashboard/ControlPanel";
import AnalyticsHUD from "./components/Dashboard/AnalyticsHUD";
import StageCanvas from "./components/Viewports/StageCanvas";

export default function App() {
  return (
    <OrbitProvider>
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          backgroundColor: "#020617",
          fontFamily: '"Outfit", sans-serif',
        }}
      >
        {/* Left Sidebar (Diagnostics & Focused Object Metrics) */}
        <SidebarMetrics />

        {/* Remaining Space is occupied by 3D Viewport with Absolute Overlays */}
        <div style={{ flex: 1, height: "100%", position: "relative" }}>
          {/* Absolute Top-Left control overlay */}
          <ControlPanel />

          {/* Absolute Top-Right analytics HUD */}
          <AnalyticsHUD />

          {/* Canvas Render viewport */}
          <StageCanvas />
        </div>
      </div>
    </OrbitProvider>
  );
}
