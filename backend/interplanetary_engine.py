from skyfield.api import load
from skyfield.data import mpc
from skyfield.constants import GM_SUN_Pitjeva_2005_km3_s2 as GM_SUN


class InnerSolarSystemModel:
    def __init__(self):
        self.ts = load.timescale()
        self.planets = load("de421.bsp")

        # Inner System
        self.sun = self.planets["sun"]
        self.mercury = self.planets["mercury"]
        self.venus = self.planets["venus"]
        self.earth = self.planets["earth"]
        self.moon = self.planets["moon"]

        # Outer System / Barycenters
        self.mars = self.planets["mars barycenter"]
        self.jupiter = self.planets["jupiter barycenter"]

        # Asteroid Engine
        self._load_asteroids()

    def _load_asteroids(self):
        """
        Fetches the Potentially Hazardous Asteroids (PHA) database from the Minor Planet Center.
        Skyfield caches this locally (PHA.txt) to prevent massive downloads on every boot.
        """
        print("Fetching/Loading Potentially Hazardous Asteroids (PHA.txt)...")
        url = "https://minorplanetcenter.net/iau/MPCORB/PHA.txt"
        try:
            with load.open(url) as f:
                self.asteroid_df = mpc.load_mpcorb_dataframe(f)

            # Use flexible substring matching instead of exact index keys
            self.apophis = self._build_asteroid("Apophis")
            self.bennu = self._build_asteroid("Bennu")
            self.ryugu = self._build_asteroid("Ryugu")

        except Exception as e:
            print(f"CRITICAL WARNING: Failed to load asteroid database: {e}")
            self.apophis = None
            self.bennu = None
            self.ryugu = None

    def _build_asteroid(self, search_term):
        """Safely extracts an asteroid from the Pandas DF using flexible substring matching."""
        try:
            # Find any row where the designation column contains our target name
            mask = self.asteroid_df["designation"].str.contains(
                search_term, case=False, na=False
            )
            match = self.asteroid_df[mask]

            if not match.empty:
                row = match.iloc[0]
                print(f"Successfully bound {search_term} to the Sun's gravity well.")
                return self.sun + mpc.mpcorb_orbit(row, self.ts, GM_SUN)  # type: ignore
            else:
                print(
                    f"Warning: Asteroid '{search_term}' not found in current MPC database."
                )
                return None
        except Exception as e:
            print(f"Error parsing asteroid {search_term}: {e}")
            return None

    def get_positions(self, time_obj=None):
        """
        Calculates the Heliocentric (Sun-centered) positions in Astronomical Units (AU).
        """
        t = time_obj if time_obj is not None else self.ts.now()

        positions = {
            "mercury": self.sun.at(t).observe(self.mercury).position.au,  # type: ignore
            "venus": self.sun.at(t).observe(self.venus).position.au,  # type: ignore
            "earth": self.sun.at(t).observe(self.earth).position.au,  # type: ignore
            "mars": self.sun.at(t).observe(self.mars).position.au,  # type: ignore
            "jupiter": self.sun.at(t).observe(self.jupiter).position.au,  # type: ignore
            "moon_heliocentric": self.sun.at(t).observe(self.moon).position.au,  # type: ignore
            "moon_geocentric": self.earth.at(t).observe(self.moon).position.km,  # type: ignore
        }

        # Dynamically append asteroids if they successfully loaded
        if self.apophis is not None:
            positions["apophis"] = self.sun.at(t).observe(self.apophis).position.au  # type: ignore
        if self.bennu is not None:
            positions["bennu"] = self.sun.at(t).observe(self.bennu).position.au  # type: ignore
        if self.ryugu is not None:
            positions["ryugu"] = self.sun.at(t).observe(self.ryugu).position.au  # type: ignore

        return positions
