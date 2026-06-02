import os
import pyvista as pv
import numpy as np
from backend.interplanetary_engine import InnerSolarSystemModel


def draw_solar_system():
    print("Loading JPL Ephemeris and calculating macro positions...")
    model = InnerSolarSystemModel()
    ts = model.ts
    t_now = ts.now()
    dt = t_now.utc_datetime()

    if isinstance(dt, np.ndarray):
        dt = dt.item()

    positions = model.get_positions(t_now)
    sun_pos = [0, 0, 0]

    # Configuration: (Name, Skyfield Body, Orbital Period in Days, Step Size, Display Radius, Color)
    # Step size increases for outer planets to prevent memory overload
    orbit_configs = [
        ("Mercury", model.mercury, 88, 1, 0.03, "gray"),
        ("Venus", model.venus, 225, 2, 0.05, "orange"),
        ("Earth", model.earth, 365, 2, 0.05, "blue"),
        ("Mars", model.mars, 687, 3, 0.04, "red"),
        ("Jupiter", model.jupiter, 4333, 15, 0.1, "brown"),
    ]

    # --- THE MODERN HEADLESS CONFIGURATION ---
    if os.environ.get("RUNNING_IN_DOCKER") == "true":
        # Tell PyVista to never attempt opening a physical UI window
        pv.OFF_SCREEN = True

    plotter = pv.Plotter(title="ORCAS - Expanded Solar System (AU Scale)")
    plotter.background_color = pv.Color("black")

    # Draw the Sun
    sun_mesh = pv.Sphere(radius=0.2, center=sun_pos)
    plotter.add_mesh(sun_mesh, color="yellow", label="Sun")  # type: ignore

    for name, body, period, step, radius, color in orbit_configs:
        # 1. Plot current planetary position
        current_pos = positions[name.lower()]
        planet_mesh = pv.Sphere(radius=radius, center=current_pos)
        plotter.add_mesh(planet_mesh, color=color, label=name)  # type: ignore

        # 2. Calculate and plot the orbital trail
        days_past = np.arange(0, period, step)
        t_array = ts.utc(dt.year, dt.month, dt.day - days_past)  # type: ignore
        path_au = model.sun.at(t_array).observe(body).position.au  # type: ignore
        path_nodes = path_au.T

        orbit_trail = pv.Spline(path_nodes)
        plotter.add_mesh(orbit_trail, color=color, line_width=1, opacity=0.4)  # type: ignore

    plotter.add_legend()  # type: ignore
    plotter.show_axes()  # type: ignore

    # Pull camera way back to fit Jupiter (radius ~5.2 AU)
    plotter.camera_position = [(0, -12, 8), (0, 0, 0), (0, 0, 1)]

    print("Rendering macro-system scene in memory...")
    plotter.show(screenshot="assets/screenshots/macro_solar_system_render.png")
    print("Success! Saved render to assets/screenshots/macro_solar_system_render.png")


if __name__ == "__main__":
    draw_solar_system()
