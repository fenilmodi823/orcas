# === ORCAS: Main Script ===
# Orchestrates TLE fetching, satellite loading, ML annotation,
# collision checking, and visualization (2D live & 3D).

from __future__ import annotations
import os
import re
import sys
import logging
import joblib
import numpy as np
from typing import Tuple, Any  

# ---------------------------------------------------------------------------------
# Make sure running via VS Code ▶️ (from backend/) still finds the project root
# ---------------------------------------------------------------------------------
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

# ---------------------------------------------------------------------------------
# Logging (visible, concise)
# ---------------------------------------------------------------------------------
logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s | %(levelname)s | %(message)s",
)
log = logging.getLogger("main")

# ---------------------------------------------------------------------------------
# Safe imports (show actionable errors instead of silent failures)
# ---------------------------------------------------------------------------------
try:
    from backend import tle_fetcher
except Exception as e:
    log.exception("Import error: backend.tle_fetcher failed: %s", e)
    tle_fetcher = None

try:
    from backend import telemetry_worker
except Exception as e:
    log.exception("Import error: backend.telemetry_worker failed: %s", e)
    telemetry_worker = None

try:
    from backend import orbit_predictor
except Exception as e:
    log.exception("Import error: backend.orbit_predictor failed: %s", e)
    orbit_predictor = None

try:
    from backend import visualizer
except Exception as e:
    log.exception("Import error: backend.visualizer failed: %s", e)
    visualizer = None

try:
    from backend import collision_checker
except Exception as e:
    log.exception("Import error: backend.collision_checker failed: %s", e)
    collision_checker = None

try:
    from backend import orbit_plotter
except Exception as e:
    log.exception("Import error: backend.orbit_plotter failed: %s", e)
    orbit_plotter = None

try:
    from backend.orbit_predictor import load_famous_sats
except Exception as e:
    log.warning("Could not import load_famous_sats directly: %s", e)
    load_famous_sats = None

# --------------------------
# Tunables (can override via env)
# --------------------------
COLLISION_MAX = int(os.environ.get("SDT_COLLISION_MAX", 60))   # cap pairwise collision check set size
PLOT3D_MAX    = int(os.environ.get("SDT_PLOT3D_MAX", 120))     # cap for 3D plotting
LIVE2D_MAX    = int(os.environ.get("SDT_LIVE2D_MAX", 100))     # cap for live 2D animation

# Toggle visualizations (useful when you just want logs)
ENABLE_2D     = os.environ.get("SDT_ENABLE_2D", "1") == "1"
ENABLE_3D     = os.environ.get("SDT_ENABLE_3D", "1") == "1"

# --------------------------
# ML: load once at startup
# --------------------------
MODEL_PATH = os.path.join(ROOT, "ml_models", "object_classifier.joblib")
CLF, FEATURES, CLASSES = None, [], []
try:
    MODEL_BUNDLE = joblib.load(MODEL_PATH)
    CLF       = MODEL_BUNDLE["model"]
    FEATURES  = MODEL_BUNDLE.get("features", ["inc_deg", "ecc", "mm_rev_day", "bstar"])
    CLASSES   = list(MODEL_BUNDLE.get("classes_", []))
    log.info("[ML] Loaded model from %s with classes: %s", MODEL_PATH, CLASSES)
except Exception as e:
    log.warning("[ML] Could not load model (%s). ML classification will be skipped.", e)

TYPE_COLOR = {
    "Payload": (0.20, 0.90, 0.20),     # green
    "Rocket Body": (1.00, 0.90, 0.20), # yellow
    "Debris": (1.00, 0.30, 0.30),      # red
    "Unknown": (0.80, 0.80, 0.80),     # grey fallback
}

# Ensure required folders exist
os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
os.makedirs(os.path.join(ROOT, "ml_models"), exist_ok=True)

# --------------------------
# Helpers for ML features
# --------------------------
def _parse_bstar(line1: str) -> float:
    """
    Parses BSTAR drag term from TLE line 1 (cols 54-61).
    Format is implied decimal with exponent (e.g., 12345-6 -> 0.12345e-6).
    Returns NaN on failure.
    """
    try:
        mant = line1[53:59].strip()
        expo = line1[59:61].strip()
        m = re.match(r"^([ +\-]?)(\d+)$", mant)
        if not m:
            return float("nan")
        sign, digits = m.groups()
        mantissa = float(f"{sign}0.{digits}")
        exponent = int(expo)
        return mantissa * (10.0 ** exponent)
    except Exception:
        return float("nan")

def _features_from_tle_lines(line1: str, line2: str) -> Tuple[float, float, float, float]:
    """
    Extracts ML features from 2 TLE lines.
    Returns tuple: (inc_deg, ecc, mm_rev_day, bstar).
    """
    try:
        inc_deg     = float(line2[8:16])
        ecc_txt     = line2[26:33].strip()
        ecc         = float(f"0.{ecc_txt}") if ecc_txt else float("nan")
        mm_rev_day  = float(line2[52:63])
        bstar       = _parse_bstar(line1)
        return inc_deg, ecc, mm_rev_day, bstar
    except Exception:
        return float("nan"), float("nan"), float("nan"), float("nan")

def classify_and_color(props: dict) -> Tuple[str, float, Tuple[float, float, float]]:
    """
    Classifies a satellite based on its orbital properties using the loaded ML model.
    
    Args:
        props: Dictionary containing 'inc_deg', 'ecc', 'mm_rev_day', 'bstar'.
        
    Returns:
        Tuple containing (predicted_label, confidence_probability, color_rgb).
    """
    if not CLF:
        return "Unknown", 0.0, TYPE_COLOR["Unknown"]
    try:
        vec = np.array([[float(props["inc_deg"]),
                         float(props["ecc"]),
                         float(props["mm_rev_day"]),
                         float(props["bstar"])]], dtype=float)
    except Exception:
        return "Unknown", 0.0, TYPE_COLOR["Unknown"]

    try:
        pred = CLF.predict(vec)[0]
        prob = float(CLF.predict_proba(vec).max()) if hasattr(CLF, "predict_proba") else 1.0
    except Exception:
        return "Unknown", 0.0, TYPE_COLOR["Unknown"]

    return pred, prob, TYPE_COLOR.get(pred, TYPE_COLOR["Unknown"])

def extract_features_from_sat(sat: Any) -> dict:
    """
    Extracts orbital features from a satellite object.
    Tries direct attributes first, then parses TLE lines if available.
    
    Returns:
        Dictionary with keys: inc_deg, ecc, mm_rev_day, bstar.
    """
    # 1) Direct attributes on sat (if your loader set them)
    for key in ("inc_deg", "ecc", "mm_rev_day", "bstar"):
        if hasattr(sat, key):
            try:
                _ = float(getattr(sat, key))
            except Exception:
                break
        else:
            break
    else:
        return {
            "inc_deg": float(getattr(sat, "inc_deg")),
            "ecc": float(getattr(sat, "ecc")),
            "mm_rev_day": float(getattr(sat, "mm_rev_day")),
            "bstar": float(getattr(sat, "bstar")),
        }

    # 2) Parse from TLE strings if available
    line1 = getattr(sat, "line1", None)
    line2 = getattr(sat, "line2", None)
    if line1 and line2:
        inc_deg, ecc, mm_rev_day, bstar = _features_from_tle_lines(line1, line2)
        return {"inc_deg": inc_deg, "ecc": ecc, "mm_rev_day": mm_rev_day, "bstar": bstar}

    # Some loaders keep TLE in a list/tuple
    tle = getattr(sat, "tle", None)
    if isinstance(tle, (list, tuple)) and len(tle) >= 2:
        inc_deg, ecc, mm_rev_day, bstar = _features_from_tle_lines(tle[0], tle[1])
        return {"inc_deg": inc_deg, "ecc": ecc, "mm_rev_day": mm_rev_day, "bstar": bstar}

    # 3) Could not get features
    return {"inc_deg": float("nan"), "ecc": float("nan"),
            "mm_rev_day": float("nan"), "bstar": float("nan")}

def annotate_satellites_with_ml(satellites: list) -> None:
    """
    Runs ML classification for a list of satellites and attaches results to objects.
    
    Attributes added to each satellite:
      - pred_type: Predicted class (Payload, Rocket Body, Debris)
      - pred_conf: Confidence score
      - pred_color: Visualization color
    """
    counts = {"Payload": 0, "Rocket Body": 0, "Debris": 0, "Unknown": 0}
    for sat in satellites:
        feats = extract_features_from_sat(sat)
        label, prob, color = classify_and_color(feats)
        setattr(sat, "pred_type", label)
        setattr(sat, "pred_conf", prob)
        setattr(sat, "pred_color", color)
        counts[label] = counts.get(label, 0) + 1

    log.info("ML classification summary: Payload=%d, Rocket Body=%d, Debris=%d, Unknown=%d",
             counts.get("Payload", 0), counts.get("Rocket Body", 0),
             counts.get("Debris", 0), counts.get("Unknown", 0))

def _safe(func, *args, **kwargs):
    """Run a step and log any exception without crashing the whole run."""
    try:
        return func(*args, **kwargs)
    except Exception as e:
        log.exception("Step failed in %s: %s", getattr(func, "__name__", "unknown"), e)
        return None

def main():
    log.info("=== ORCAS ===")
    log.info("Root: %s", ROOT)
    log.info("CWD : %s", os.getcwd())

    # ------------------------------------------
    # Step 1: Fetch latest TLE data
    # ------------------------------------------
    log.info("[1/4] Fetching latest TLE data...")
    if tle_fetcher and hasattr(tle_fetcher, "fetch_tle"):
        _safe(tle_fetcher.fetch_tle)
        log.info("✔ TLE data saved to data/latest_tle.txt")
    else:
        log.warning("tle_fetcher.fetch_tle() not found. Skipping fetch. (Ensure backend/tle_fetcher.py defines fetch_tle())")

    # ------------------------------------------
    # Step 2: Load satellites
    # ------------------------------------------
    log.info("[2/4] Loading satellites...")
    satellites = []

    # A) Famous sats if available
    if load_famous_sats:
        famous = _safe(load_famous_sats) or []
        satellites.extend(famous)
        if famous:
            log.info("Loaded %d famous satellites.", len(famous))
    else:
        log.warning("load_famous_sats() unavailable.")

    # B) Large set from fresh file if loader exists
    tle_path = os.path.join(ROOT, "data", "latest_tle.txt")
    if orbit_predictor and hasattr(orbit_predictor, "load_tles") and os.path.exists(tle_path):
        general = _safe(orbit_predictor.load_tles, tle_path) or []
        satellites.extend(general)
        log.info("Loaded %d from %s", len(general), tle_path)
    elif not os.path.exists(tle_path):
        log.warning("TLE file not found at %s (fetch may have failed).", tle_path)
    else:
        log.warning("orbit_predictor.load_tles() unavailable.")

    # Dedupe by name
    sat_by_name = {getattr(s, "name", f"SAT-{i}"): s for i, s in enumerate(satellites)}
    satellites = list(sat_by_name.values())

    if not satellites:
        log.error("No satellites loaded. Exiting early. Check TLE fetch/paths.")
        return

    preview = ", ".join(getattr(s, "name", "UNKNOWN") for s in satellites[:10])
    more = f" (+{len(satellites)-10} more)" if len(satellites) > 10 else ""
    log.info("✔ Total satellites loaded: %d. First few: %s%s", len(satellites), preview, more) 

    # ------------------------------------------
    # Step 2.5: Classify & annotate with ML
    # ------------------------------------------
    if CLF:
        annotate_satellites_with_ml(satellites)
    else:
        log.info("[ML] Model not available; skipping classification.")

    # ------------------------------------------
    # Step 3: Collision prediction (cap set size)
    # ------------------------------------------
    log.info("[3/4] Checking for close approaches...")
    if collision_checker and hasattr(collision_checker, "check_collisions"):
        if len(satellites) >= 2:
            subset = satellites[:COLLISION_MAX]
            if len(satellites) > COLLISION_MAX:
                log.info("[i] Using first %d satellites for collision check (cap).", COLLISION_MAX)
            _safe(collision_checker.check_collisions, subset, threshold_km=10)
            log.info("✔ Collision analysis complete.")
        else:
            log.info("Skipping collision check (need at least 2 satellites).")
    else:
        log.warning("collision_checker.check_collisions() unavailable.")

    # ------------------------------------------
    # Step 4: Visualization (2D live + 3D)
    # ------------------------------------------
    log.info("[4/4] Visualization...")
    if ENABLE_2D and visualizer and hasattr(visualizer, "plot_animated_positions_live"):
        log.info("Opening 2D live animation window (max_sats=%d). Close the window to continue.", LIVE2D_MAX)
        _safe(visualizer.plot_animated_positions_live, satellites, interval_ms=200, max_sats=LIVE2D_MAX)
    else:
        if not ENABLE_2D:
            log.info("2D visualization disabled by env SDT_ENABLE_2D=0.")
        elif not visualizer:
            log.warning("Visualizer module not available.")
        else:
            log.warning("Visualizer lacks plot_animated_positions_live.")

    if ENABLE_3D and orbit_plotter and hasattr(orbit_plotter, "plot_satellite_orbits_3d"):
        log.info("Opening 3D orbit view (max_sats=%d). Close the window to finish.", PLOT3D_MAX)
        _safe(orbit_plotter.plot_satellite_orbits_3d, satellites[:PLOT3D_MAX])
    else:
        if not ENABLE_3D:
            log.info("3D visualization disabled by env SDT_ENABLE_3D=0.")
        elif not orbit_plotter:
            log.warning("Orbit plotter module not available.")
        else:
            log.warning("orbit_plotter lacks plot_satellite_orbits_3d.")

    log.info("✔ Run complete.")

# Run the program
if __name__ == "__main__":
    main()

# python -m backend.main