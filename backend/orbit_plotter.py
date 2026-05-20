import os
from typing import Any, Dict, List
import numpy as np
import pyvista as pv
from skyfield.api import load

if os.environ.get("RUNNING_IN_DOCKER") == "true":
    pv.start_xvfb()

# Assets Configuration
EARTH_RADIUS_KM = 6371.0
TEXTURES_DIR = os.path.join("assets", "textures")
EARTH_DAY_TEX = os.path.join(TEXTURES_DIR, "earth_day.jpg")


# ---------------------------
# Helper: Earth & Rings
# ---------------------------
def _add_textured_earth(plotter: pv.Plotter):
    sphere = pv.Sphere(radius=EARTH_RADIUS_KM, theta_resolution=180, phi_resolution=180)
    sphere.texture_map_to_sphere(inplace=True)
    try:
        if os.path.exists(EARTH_DAY_TEX):
            tex = pv.read_texture(EARTH_DAY_TEX)
            plotter.add_mesh(sphere, texture=tex, name="Earth")
        else:
            plotter.add_mesh(sphere, color="blue", opacity=0.9, name="Earth")
    except Exception:
        plotter.add_mesh(sphere, color="blue", name="Earth")


def _add_orbit_rings(plotter: pv.Plotter):
    rings = [(2000, "green", "LEO"), (35786, "blue", "GEO")]
    actors = []
    for alt, col, label in rings:
        mesh = pv.Sphere(
            radius=EARTH_RADIUS_KM + alt, theta_resolution=60, phi_resolution=60
        )
        actor = plotter.add_mesh(mesh, color=col, opacity=0.1, name=label)
        actors.append(actor)
    return actors


# ---------------------------
# Main 3D Plotter with UI
# ---------------------------
def plot_satellite_orbits_3d(
    satellites: List[Any],
    minutes: int = 30,
    step_seconds: int = 60,
    max_satellites: int = 200,
):
    if not satellites:
        print("No satellites to plot.")
        return

    # Limit satellites for performance
    satellites = satellites[:max_satellites]

    # Setup Time
    ts = load.timescale()
    t0 = ts.now()
    times = [
        t0 + (i * step_seconds / 86400.0)
        for i in range(int((minutes * 60) / step_seconds))
    ]

    # Setup Plotter
    plotter = pv.Plotter(window_size=[1200, 800], title="ORCAS - Advanced View")
    plotter.set_background("black")  # type: ignore
    _add_textured_earth(plotter)
    _add_orbit_rings(plotter)

    # Actor Categories for UI Toggling
    category_actors: Dict[str, List[Any]] = {
        "Payload": [],
        "Rocket Body": [],
        "Debris": [],
        "Unknown": [],
        "Labels": [],
    }

    print(f"[Visualizer] Computing orbits for {len(satellites)} objects...")

    for sat in satellites:
        # Calculate Orbit Trail
        try:
            positions = [sat.at(t).position.km for t in times]
            if len(positions) < 2:
                continue
            points = np.array(positions)
        except Exception:
            continue

        # Determine Type & Color
        # Uses your ML tags if they exist, otherwise defaults
        stype = getattr(sat, "pred_type", "Unknown")
        if stype not in category_actors:
            stype = "Unknown"

        color_map = {
            "Payload": "lime",
            "Rocket Body": "yellow",
            "Debris": "red",
            "Unknown": "grey",
        }
        color = color_map.get(stype, "white")

        # Add Orbit Line
        line = pv.Spline(points, 100)
        actor_trail = plotter.add_mesh(line, color=color, opacity=0.6)
        category_actors[stype].append(actor_trail)

        # Add Satellite Point (Sphere)
        pos_now = points[0]
        sphere = pv.Sphere(radius=80, center=pos_now)
        actor_sat = plotter.add_mesh(sphere, color=color)
        category_actors[stype].append(actor_sat)

        # Add Label
        label_text = f"{sat.name}"
        # point_labels returns a VTK actor we need to track
        actor_label = plotter.add_point_labels(
            np.array([pos_now]),
            [label_text],
            font_size=10,
            text_color=color,
            always_visible=False,
        )
        category_actors["Labels"].append(actor_label)

    # ---------------------------------------------------------
    # UI WIDGETS (Interactive Controls)
    # ---------------------------------------------------------

    # Toggle Function Factory
    def create_toggle(category):
        def toggle_vis(state):
            for actor in category_actors[category]:
                actor.SetVisibility(state)

        return toggle_vis

    start_y = 10

    # 1. Debris Toggle
    plotter.add_checkbox_button_widget(  # type: ignore
        create_toggle("Debris"),
        value=True,
        position=(10, start_y),
        size=30,
        color_on="red",
        color_off="grey",
    )
    plotter.add_text("Show Debris", position=(50, start_y + 5), font_size=12)

    # 2. Payload Toggle
    plotter.add_checkbox_button_widget(  # type: ignore
        create_toggle("Payload"),
        value=True,
        position=(10, start_y + 40),
        size=30,
        color_on="lime",
        color_off="grey",
    )
    plotter.add_text("Show Payloads", position=(50, start_y + 45), font_size=12)

    # 3. Labels Toggle
    plotter.add_checkbox_button_widget(  # type: ignore
        create_toggle("Labels"),
        value=True,
        position=(10, start_y + 80),
        size=30,
        color_on="white",
        color_off="grey",
    )
    plotter.add_text("Show Labels", position=(50, start_y + 85), font_size=12)

    plotter.add_axes()  # type: ignore
    plotter.show()
