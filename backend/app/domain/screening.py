"""Broad-phase conjunction screening over a whole catalogue.

Method - sampled spatial screening, the standard broad phase:

1. Propagate every object with SGP4 at a fixed step. `SatrecArray` makes each
   step one vectorised C call across the catalogue.
2. At each step, a cKDTree finds every pair closer than
   R = reporting distance + v_max * step / 2. Two objects can close by at most
   v_max * step / 2 between a sample and the true time of closest approach,
   which lies within half a step of the nearest sample - so any encounter
   whose true miss is inside the reporting distance is inside R at that
   sample. v_max is set above any Earth-orbit closing speed.
3. Each pair's sampled separation is tracked step to step, and every local
   minimum is refined to the time of closest approach (TCA) by bounded 1-D
   minimisation over [t - step, t + step], which brackets it.

Positions are TEME, km, straight from SGP4. Distances and relative speeds are
invariant under rotation, so no frame conversion is needed anywhere here.

This finds geometry only. What a close approach *means* - maximum P_c, the
2D-validity gate - is maximum_pc.py's job, applied by the service.
"""

import math
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import numpy as np
from numpy.typing import NDArray
from scipy.optimize import minimize_scalar
from scipy.spatial import cKDTree
from sgp4.api import Satrec, SatrecArray, jday

SECONDS_PER_DAY = 86_400.0


@dataclass(frozen=True)
class ScreeningConfig:
    """Tunables. Defaults follow CelesTrak SOCRATES's 5 km reporting distance."""

    #: Report encounters with a miss distance at or below this, km.
    reporting_distance_km: float = 5.0
    #: Sampling step, s. Smaller is slower and tighter; correctness holds at any step.
    step_s: float = 10.0
    #: Above any closing speed in Earth orbit (~15.5 km/s head-on in LEO), km/s.
    max_relative_speed_km_s: float = 16.0
    #: Steps propagated per vectorised call; bounds memory at ~n_objects * chunk * 48 bytes.
    chunk_steps: int = 30

    @property
    def candidate_radius_km(self) -> float:
        """R: the sampled separation below which a pair must be examined, km."""
        return self.reporting_distance_km + self.max_relative_speed_km_s * self.step_s / 2.0


@dataclass(frozen=True)
class Encounter:
    """One close approach between catalogue entries `primary` < `secondary`
    (indices into the screened sequence). TCA in UTC, miss km, speed km/s.
    """

    primary: int
    secondary: int
    tca: datetime
    miss_distance_km: float
    relative_speed_km_s: float


class _Clock:
    """Maps seconds after the window start to SGP4's split Julian date."""

    def __init__(self, start: datetime) -> None:
        start = start.astimezone(UTC)
        self.start = start
        seconds = start.second + start.microsecond / 1e6
        self._jd, self._fr = jday(
            start.year, start.month, start.day, start.hour, start.minute, seconds
        )

    def split(
        self, offset_s: float | NDArray[np.float64]
    ) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
        total = self._fr + np.asarray(offset_s, dtype=np.float64) / SECONDS_PER_DAY
        whole = np.floor(total)
        return self._jd + whole, total - whole

    def at(self, offset_s: float) -> datetime:
        return self.start + timedelta(seconds=offset_s)


class _MinimaTracker:
    """Streams each pair's sampled separation and records its local minima.

    Only pairs seen at the previous step are held, so memory is bounded by the
    number of candidate pairs at one instant, not over the whole window. A pair
    absent from a step is taken to be farther than R there.
    """

    def __init__(self) -> None:
        # pair -> (separation at the previous step, was it <= the one before)
        self._previous: dict[tuple[int, int], tuple[float, bool]] = {}
        self.minima: list[tuple[int, int, int]] = []  # (i, j, step)

    def observe(self, step: int, pairs: dict[tuple[int, int], float]) -> None:
        current: dict[tuple[int, int], tuple[float, bool]] = {}
        for key, sep in pairs.items():
            before = self._previous.get(key)
            if before is None:
                current[key] = (sep, True)
                continue
            if sep > before[0] and before[1]:
                self.minima.append((key[0], key[1], step - 1))
            current[key] = (sep, sep <= before[0])
        for key, (_, descending) in self._previous.items():
            if key not in current and descending:
                self.minima.append((key[0], key[1], step - 1))
        self._previous = current

    def finish(self, last_step: int) -> None:
        for key, (_, descending) in self._previous.items():
            if descending:
                self.minima.append((key[0], key[1], last_step))
        self._previous = {}


def _sample_pairs(
    positions_km: NDArray[np.float64], ok: NDArray[np.bool_], radius_km: float
) -> dict[tuple[int, int], float]:
    """Every pair of valid objects closer than `radius_km` at one instant."""
    valid = np.flatnonzero(ok)
    if valid.size < 2:
        return {}
    points = positions_km[valid]
    idx = cKDTree(points).query_pairs(radius_km, output_type="ndarray")
    if idx.size == 0:
        return {}
    seps = np.linalg.norm(points[idx[:, 0]] - points[idx[:, 1]], axis=1)
    first, second = valid[idx[:, 0]], valid[idx[:, 1]]
    return {
        (int(min(a, b)), int(max(a, b))): float(s)
        for a, b, s in zip(first.tolist(), second.tolist(), seps.tolist(), strict=True)
    }


def _refine(a: Satrec, b: Satrec, clock: _Clock, lo_s: float, hi_s: float) -> Encounter | None:
    """Closest approach of one pair inside [lo_s, hi_s]; indices filled by the caller."""

    def state(sat: Satrec, offset_s: float) -> tuple[int, NDArray[np.float64], NDArray[np.float64]]:
        jd, fr = clock.split(offset_s)
        error, r, v = sat.sgp4(float(jd), float(fr))
        return error, np.asarray(r), np.asarray(v)

    def separation(offset_s: float) -> float:
        ea, ra, _ = state(a, offset_s)
        eb, rb, _ = state(b, offset_s)
        return math.inf if ea or eb else float(np.linalg.norm(ra - rb))

    result = minimize_scalar(
        separation, bounds=(lo_s, hi_s), method="bounded", options={"xatol": 1e-4}
    )
    offset = float(result.x)
    ea, ra, va = state(a, offset)
    eb, rb, vb = state(b, offset)
    if ea or eb:
        return None
    return Encounter(
        primary=-1,
        secondary=-1,
        tca=clock.at(offset),
        miss_distance_km=float(np.linalg.norm(ra - rb)),
        relative_speed_km_s=float(np.linalg.norm(va - vb)),
    )


def screen_catalogue(
    satrecs: Sequence[Satrec],
    start: datetime,
    end: datetime,
    config: ScreeningConfig | None = None,
) -> list[Encounter]:
    """Every close approach between any two of `satrecs` in [start, end] with a
    miss at or below the reporting distance, sorted by TCA. Objects SGP4
    cannot propagate at a given instant (decayed, diverged) are left out of
    that instant rather than failing the run.
    """
    config = config or ScreeningConfig()
    clock = _Clock(start)
    window_s = (end.astimezone(UTC) - clock.start).total_seconds()
    if window_s <= 0 or len(satrecs) < 2:
        return []

    array = SatrecArray(list(satrecs))
    n_steps = int(math.floor(window_s / config.step_s)) + 1
    tracker = _MinimaTracker()
    for chunk_start in range(0, n_steps, config.chunk_steps):
        steps = np.arange(chunk_start, min(chunk_start + config.chunk_steps, n_steps))
        jd, fr = clock.split((steps * config.step_s).astype(np.float64))
        errors, positions, _ = array.sgp4(jd, fr)
        finite = np.isfinite(positions).all(axis=2)
        ok = (errors == 0) & finite
        for column, step in enumerate(steps.tolist()):
            tracker.observe(
                step,
                _sample_pairs(positions[:, column, :], ok[:, column], config.candidate_radius_km),
            )
    tracker.finish(n_steps - 1)

    encounters: list[Encounter] = []
    for i, j, step in tracker.minima:
        lo = max(0.0, (step - 1) * config.step_s)
        hi = min(window_s, (step + 1) * config.step_s)
        found = _refine(satrecs[i], satrecs[j], clock, lo, hi)
        if found is not None and found.miss_distance_km <= config.reporting_distance_km:
            encounters.append(
                Encounter(i, j, found.tca, found.miss_distance_km, found.relative_speed_km_s)
            )
    encounters.sort(key=lambda e: e.tca)
    return encounters
