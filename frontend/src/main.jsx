import React from "react";
import ReactDOM from "react-dom/client";

// --- ADD THIS CRITICAL LINE HERE ---
// This tells Cesium exactly where Vite is serving its massive asset folders
window.CESIUM_BASE_URL = "/cesium/";
// -----------------------------------

import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
