"""Hermite interpolation through a window of states, as NASA's SPK type 13 does (S6a, B.27).

The polynomial of degree 2W - 1 that matches the position and velocity of W
neighbouring states. W = 2 is the satellites' cubic (M1.1); W = 4 follows a
fast, tightly curving orbit far better from the same samples. Window for
interval k of K keyframes: keyframes lo .. lo + W - 1, lo = clamp(k - W // 2 + 1,
0, K - W). The client mirrors this in `frontend/src/propagation/hermite-window.ts`.
"""

from __future__ import annotations

import numpy as np

MAX_RELATIVE_ERROR = 1e-4  # B.26: within 1/10,000 of the distance from the centre


def hermite_window(tn: np.ndarray, pn: np.ndarray, vn: np.ndarray, t: np.ndarray) -> np.ndarray:
    """Position from the Hermite polynomial matching W states, by divided differences.

    Shapes: tn (C, W), pn and vn (C, W, 3), t (C,). Units: any consistent set
    (the bake uses export steps, km and km per step).
    """
    z, q = np.repeat(tn, 2, axis=1), np.repeat(pn, 2, axis=1)
    d = np.empty_like(q[:, :-1])
    d[:, 0::2] = vn
    d[:, 1::2] = (q[:, 2::2] - q[:, 1:-1:2]) / (z[:, 2::2] - z[:, 1:-1:2])[:, :, None]
    coef = [q[:, 0], d[:, 0]]
    for order in range(2, z.shape[1]):
        d = (d[:, 1:] - d[:, :-1]) / (z[:, order:] - z[:, :-order])[:, :, None]
        coef.append(d[:, 0])
    out = coef[-1]
    for k in range(len(coef) - 2, -1, -1):
        out = coef[k] + (t - z[:, k])[:, None] * out
    return out


def worst_error(c: np.ndarray, h: float, m: int, w: int, radius: float | None) -> float:
    """Worst error at the samples m-thinning drops, float32 keyframes.

    Relative to the distance from the centre, or to `radius` (a planet's, for
    its centre's offset from its system barycentre). Input: states km, km/s;
    h the export step in seconds.
    """
    keys = c[::m].astype(np.float32).astype(np.float64)
    big_k, w = len(keys), min(w, len(keys))
    worst = 0.0
    for j in range(1, m):
        k = np.arange(big_k - 1)
        idx = np.clip(k - w // 2 + 1, 0, big_k - w)[:, None] + np.arange(w)
        s = k * m + j
        tn = (idx * m).astype(float)
        p = hermite_window(tn, keys[idx, :3], keys[idx, 3:] * h, s.astype(float))
        truth = c[s, :3]
        scale = radius if radius else np.linalg.norm(truth, axis=1)
        worst = max(worst, float((np.linalg.norm(p - truth, axis=1) / scale).max()))
    return worst


def bake_chunk(c: np.ndarray, h: float, radius: float | None) -> dict:
    """Choose the step (every m-th sample) and window W for one chunk of exported states.

    Thins by the largest power of two that keeps W = 4 within MAX_RELATIVE_ERROR
    at every dropped sample. Where none does, keeps every sample with whichever
    W did better at twice the step (W = 2 across a burn, where a higher degree
    overshoots) and extrapolates the error at the export step.
    """
    n = len(c) - 1
    m, err = 1, None
    while n % (2 * m) == 0 and n // (2 * m) >= 3:
        e = worst_error(c, h, 2 * m, 4, radius)
        if e > MAX_RELATIVE_ERROR:
            break
        m, err = 2 * m, e
    if m > 1:
        return {"m": m, "w": 4, "error": err}
    even = c[: n - n % 2 + 1]
    if len(even) < 7:
        return {"m": 1, "w": 4 if len(c) >= 4 else 2, "error": None}
    e = {w: worst_error(even, h, 2, w, radius) for w in (4, 2)}
    w = 4 if e[4] <= e[2] else 2
    out = {"m": 1, "w": w, "error": None, "atTwiceStep": e[w]}
    if n % 4 == 0 and n // 4 >= 3 and e[w] > 0:
        # Halving the step again divides the error by at least the factor measured from four
        # steps to two (it grows toward 2^(2W) as the step shrinks). A factor under 4 means no
        # polynomial fits: the data jumps (a burn, or a joint between Horizons' trajectory files).
        # ponytail: 4 is a heuristic set from the joints the data sheets name.
        ratio = worst_error(c, h, 4, w, radius) / e[w]
        out |= {"jump": True} if ratio < 4 else {"estimated": e[w] / ratio}
    return out


if __name__ == "__main__":
    # Self-check: W states reproduce any polynomial of degree 2W - 1; W = 2 is the cubic.
    rng = np.random.default_rng(1)
    coeffs = rng.normal(size=(8, 3))
    tn = np.array([[0.0, 1.0, 2.0, 3.0]])

    def poly(t: float) -> np.ndarray:
        return sum(coeffs[i] * t**i for i in range(8))

    def dpoly(t: float) -> np.ndarray:
        return sum(i * coeffs[i] * t ** (i - 1) for i in range(1, 8))

    pn = np.array([[poly(t) for t in tn[0]]])
    vn = np.array([[dpoly(t) for t in tn[0]]])
    assert np.allclose(hermite_window(tn, pn, vn, np.array([1.37])), poly(1.37))
    s, p0, v0, p1, v1 = 0.3, pn[0, 0], vn[0, 0], pn[0, 1], vn[0, 1]
    cubic = (2 * s**3 - 3 * s**2 + 1) * p0 + (s**3 - 2 * s**2 + s) * v0
    cubic += (-2 * s**3 + 3 * s**2) * p1 + (s**3 - s**2) * v1
    assert np.allclose(hermite_window(tn[:, :2], pn[:, :2], vn[:, :2], np.array([s])), cubic)
    print("horizons_hermite: self-check passed")
