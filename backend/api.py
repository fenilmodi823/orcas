import math
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from skyfield.api import load, wgs84
from datetime import datetime
from typing import Optional

# Earth-centric Imports
from backend.tle_fetcher import fetch_tle
from backend.orbit_predictor import load_tles

# Interplanetary Imports
from backend.interplanetary_engine import InnerSolarSystemModel

app = FastAPI(title="ORCAS API")

# Configure CORS to allow the Vite React frontend (typically running on port 5173)
# and allow all origins for ease of development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------------------------
# GLOBAL INITIALIZATION
# -------------------------------------------------------------------------
print("Initializing Interplanetary Engine for API...")
# We instantiate this globally so the heavy .bsp file loads only once on startup.
solar_model = InnerSolarSystemModel()


# -------------------------------------------------------------------------
# EARTH-CENTRIC ENDPOINTS
# -------------------------------------------------------------------------
@app.get("/api/satellites", tags=["Earth Orbit"])
def get_satellites():
    # 1. Fetch specialized CelesTrak groups
    stations_path, _ = fetch_tle(group="stations")
    gnss_path, _ = fetch_tle(group="gnss")
    geo_path, _ = fetch_tle(group="geo")
    active_path, _ = fetch_tle(group="active")

    # 2. Load into Skyfield EarthSatellite objects
    stations_sats = load_tles(str(stations_path))
    gnss_sats = load_tles(str(gnss_path))
    geo_sats = load_tles(str(geo_path))
    active_sats = load_tles(str(active_path))

    final_satellites = []

    # 3. Explicitly Isolate the ISS and Pin it as Priority #1
    iss_sat = next((s for s in stations_sats if s.name and "ISS" in s.name), None)
    if iss_sat:
        final_satellites.append(iss_sat)

    # 4. Create a Balanced Payload for the 3D Render
    # Append MEO candidates (GNSS)
    final_satellites.extend(gnss_sats[:40])

    # Append GEO candidates
    final_satellites.extend(geo_sats[:40])

    # Append LEO candidates (remaining Active), ensuring ISS is not duplicated
    active_filtered = [s for s in active_sats if s.name and "ISS" not in s.name][:70]
    final_satellites.extend(active_filtered)

    ts = load.timescale()

    result = []
    for sat in final_satellites:
        # We need the TLE metadata to be present (attached by backend.orbit_predictor load_tles)
        if hasattr(sat, "line1") and hasattr(sat, "line2"):
            # Calculate current position for Cesium fallback
            geocentric = sat.at(ts.now())
            subpoint = wgs84.subpoint(geocentric)

            result.append(
                {
                    "name": sat.name,
                    "line1": sat.line1,
                    "line2": sat.line2,
                    "lat": subpoint.latitude.degrees,
                    "lon": subpoint.longitude.degrees,
                    "alt": subpoint.elevation.km,
                    "alert": False,  # Mocked for now
                }
            )

    return result


# -------------------------------------------------------------------------
# HELIOCENTRIC ENDPOINTS
# -------------------------------------------------------------------------
@app.get("/api/solar-system", tags=["Interplanetary"])
async def get_solar_system(target_date: Optional[str] = None):
    """
    Returns the heliocentric [x, y, z] positions and historical orbital paths
    for the solar system bodies at a specific date (or now).
    """
    try:
        ts = solar_model.ts

        # --- THE TIME MACHINE LOGIC ---
        if target_date:
            # Parse the incoming ISO date string from the frontend
            dt = datetime.fromisoformat(target_date.replace("Z", "+00:00"))
            # Convert to Skyfield's high-precision timescale
            t_target = ts.utc(dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second)
        else:
            t_target = ts.now()
            dt = t_target.utc_datetime()

        # Isolate the scalar datetime to prevent downstream vectorization crashes
        if isinstance(dt, np.ndarray):
            dt = dt.item()

        # Pass the calculated time to the engine
        positions = solar_model.get_positions(t_target)

        # Configuration matches our plotter: (Name, Skyfield Body, Period, Step)
        orbit_configs = [
            ("mercury", solar_model.mercury, 88, 1),
            ("venus", solar_model.venus, 225, 2),
            ("earth", solar_model.earth, 365, 2),
            ("mars", solar_model.mars, 687, 3),
            ("jupiter", solar_model.jupiter, 4333, 15),
        ]

        # --- DYNAMICALLY APPEND ASTEROIDS ---
        if solar_model.apophis is not None:
            orbit_configs.append(("apophis", solar_model.apophis, 323, 2))
        if solar_model.bennu is not None:
            orbit_configs.append(("bennu", solar_model.bennu, 436, 2))
        if solar_model.ryugu is not None:
            orbit_configs.append(("ryugu", solar_model.ryugu, 474, 2))

        payload = {}

        for name, body, period, step in orbit_configs:
            # 1. Grab current position and cast to standard Python list
            current_pos = positions[name.lower()].tolist()

            # 2. Calculate the historical path (trailing backward from the target date)
            days_past = np.arange(0, period, step)
            t_array = ts.utc(dt.year, dt.month, dt.day - days_past)  # type: ignore

            # Skyfield returns shape (3, N). We transpose to (N, 3)
            path_au = solar_model.sun.at(t_array).observe(body).position.au  # type: ignore
            path_nodes = (
                path_au.T.tolist()
            )  # CRITICAL: Cast the 2D matrix to nested Python lists

            payload[name] = {
                "current_position": current_pos,
                "orbital_path": path_nodes,
            }

            if name.lower() in ["apophis", "bennu", "ryugu"]:
                distance_au = math.dist(positions["earth"].tolist(), positions[name.lower()].tolist())
                distance_km = distance_au * 149597870.7
                if distance_au <= 0.0025:
                    status = "CRITICAL"
                elif distance_au <= 0.05:
                    status = "WARNING"
                else:
                    status = "SAFE"
                payload[name]["threat_assessment"] = {
                    "status": status,
                    "distance_km": distance_km,
                }

        return {"status": "success", "timestamp": dt.isoformat(), "data": payload}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
