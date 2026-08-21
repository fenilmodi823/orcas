# Phase 4 — M0 Bug-Fix Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the three live bugs and one disproven assumption the Phase 4 research brief found by direct measurement, before any Phase 4 rendering/data-core code (M1.0+) is built on top of them.

**Architecture:** Four independent, sequential tasks (M0.1–M0.4) matching the brief's own milestone numbering. No new modules — each task edits an existing `domain/` (backend) or `src/` (frontend physics package) function plus its test file, so the fix and its regression guard land together. Task 4 is vault-only (no code).

**Tech Stack:** Python 3.12 / pytest / mypy --strict (`backend/`), TypeScript strict / vitest (`packages/orcas-physics/`). No new dependencies.

**Spec:** `ORCAS Vault/03 - Engineering/Phase-4-Engineering-Brief.md` Part 11.1 (M0) and Part 12.3 ("What to do first" #1). Cross-referenced against the actual repo: `backend/app/domain/{coordinates,propagation,tle,types}.py`, `packages/orcas-physics/src/{coordinates,propagate,satrec-from-omm,types}.ts`.

## Global Constraints

- `domain/` (backend) and `packages/orcas-physics/src/` (frontend) stay framework-free, pure functions — no I/O, no React. (Rules.md §3)
- Every physics function's docstring/comment states units and reference frame. (Rules.md, CLAUDE.md)
- `NORAD_CAT_ID` / catalog identity is always `VARCHAR`/`string`, sourced verbatim from the OMM record — never derived from a `Satrec`/`SatRec` field, never Alpha-5. (Rules.md hard ban; brief P4.D15)
- No `any` in TypeScript; `mypy --strict` on `backend/app/domain`; ruff clean. (Rules.md §1, §3)
- Never invent a number — every test constant here is either copied verbatim from the brief's own measured findings or derived from a real fixture already in the repo (`backend/tests/unit/test_propagation.py` / `packages/orcas-physics/test/propagate.test.ts`'s shared synthetic OMM, or the ISS TLE in `backend/tests/unit/test_tle.py`). (CLAUDE.md honesty rules)
- Custom exception types, never bare `except`/silent `catch`. (Rules.md §2)
- Commits: Conventional Commits, imperative, under 72 chars, no `wip`. (CLAUDE.md)

---

### Task 1: M0.1 — Unify catalog identity across the stack

**Why first:** `backend/app/domain/tle.py:66` currently sets `NORAD_CAT_ID=sat.satnum_str`. The brief's Part 4.1 measured table shows `Satrec.satnum_str` is the **Alpha-5-encoded** form (`100000 → 'A0000'`, `148493 → 'E8493'`), not the decimal string — `sat.satnum` (int) is the decoded decimal. `backend/tests/unit/test_tle.py`'s only fixture is NORAD 25544 (below 100000, where Alpha-5 and decimal are identical), so this has never been exercised by a test. Every TLE-ingested object ≥ 100000 would today get a corrupted `NORAD_CAT_ID` ("E8493" instead of "148493"), silently breaking the "canonical decimal string" rule (P4.D15) the moment the legacy TLE adapter sees a 6-digit object.

**Files:**
- Modify: `backend/app/domain/tle.py:66` (the bug)
- Modify: `backend/tests/unit/test_tle.py` (regression test for the fix)
- Create: `backend/tests/unit/test_identity.py` (identity-is-verbatim-string contract + Issue #17 ceiling + Bug 3 xfail)
- Create: `packages/orcas-physics/test/identity.test.ts` (frontend mirror — no-ceiling regression)
- Modify: `backend/pyproject.toml` (pin `sgp4` exactly — the brief's findings are measured against 2.27)

**Interfaces:**
- Consumes: `app.domain.tle.omm_record_from_tle(line1, line2, object_name) -> OmmRecord` (existing), `app.domain.propagation.satrec_from_omm(record: OmmRecord) -> Satrec` (existing), `satrecFromOmm(record: OmmRecord) -> SatRec` (existing, `packages/orcas-physics/src/satrec-from-omm.ts`)
- Produces: nothing new — this task only corrects and pins down existing identity behavior.

- [ ] **Step 1: Write the failing test for the Alpha-5 TLE bug**

Add to `backend/tests/unit/test_tle.py`:

```python
def test_alpha5_catalog_number_normalises_to_decimal_string() -> None:
    """A TLE whose columns 3-7 hold an Alpha-5 designator (satellite
    number >= 100000) must produce a decimal NORAD_CAT_ID, matching the
    same object's identity if it had arrived via OMM JSON instead. Before
    this fix, `sat.satnum_str` returned the Alpha-5 form ('E8493') here,
    not the decimal one ('148493') — see brief Part 4.1.
    """
    # Same ISS-shaped element set as LINE1/LINE2, satellite number field
    # (cols 3-7) swapped to the Alpha-5 encoding of 148493.
    alpha5_line1 = "1 E8493U 98067A   26226.50000000  .00016717  00000-0  10270-3 0  9994"
    record = omm_record_from_tle(alpha5_line1, LINE2, object_name="ISS (ZARYA)")
    assert record["NORAD_CAT_ID"] == "148493"
```

- [ ] **Step 2: Run it to verify it fails**

Run: `docker compose run --rm backend pytest tests/unit/test_tle.py::test_alpha5_catalog_number_normalises_to_decimal_string -v`
Expected: FAIL — `assert 'E8493' == '148493'`

- [ ] **Step 3: Fix the bug**

In `backend/app/domain/tle.py`, change line 66:

```python
        NORAD_CAT_ID=str(sat.satnum),  # decimal string — sat.satnum_str is
        # Alpha-5-encoded ('E8493' for 148493), not decimal; see brief Part 4.1.
```

(replacing the old `NORAD_CAT_ID=sat.satnum_str,  # already VARCHAR-safe — handles Alpha-5` line and its now-incorrect comment).

- [ ] **Step 4: Run the full TLE test file to verify it passes and nothing else broke**

Run: `docker compose run --rm backend pytest tests/unit/test_tle.py -v`
Expected: PASS, all 4 tests (the 3 existing + the new one).

- [ ] **Step 5: Write the identity contract test module**

Create `backend/tests/unit/test_identity.py`:

```python
"""Cross-stack catalog-identity contract. ORCAS Vault Phase-4 Unified
Engineering Brief, Part 4.1/4.2, milestone M0.1.

python-sgp4 decodes Alpha-5 catalog numbers to an int; satellite.js's
twoline2satrec keeps the raw 5 characters instead. Above catalog number
99999 the two libraries disagree about what a NORAD ID even is. ORCAS
avoids the problem entirely by never deriving identity from a
Satrec/SatRec: identity is always the OmmRecord['NORAD_CAT_ID'] string,
verbatim, from ingestion through to render. This module is the regression
guard for that rule, plus the two known library defects it depends on
being aware of (the 339999 ceiling — Issue #17 — and the Alpha-5 emit
bug in the C++ backend for 180000-189999/230000-239999).
"""

import pytest
from sgp4.alpha5 import to_alpha5

from app.domain.propagation import satrec_from_omm
from app.domain.types import OmmRecord

_BASE: OmmRecord = {
    "OBJECT_NAME": "ORCAS-TEST-SAT",
    "OBJECT_ID": "1998-999Z",
    "EPOCH": "2026-01-01T00:00:00.000000",
    "MEAN_MOTION": 15.5,
    "ECCENTRICITY": 0.0001,
    "INCLINATION": 51.6,
    "RA_OF_ASC_NODE": 0,
    "ARG_OF_PERICENTER": 0,
    "MEAN_ANOMALY": 0,
    "EPHEMERIS_TYPE": 0,
    "CLASSIFICATION_TYPE": "U",
    "NORAD_CAT_ID": "90001",
    "ELEMENT_SET_NO": 999,
    "REV_AT_EPOCH": 1,
    "BSTAR": 0,
    "MEAN_MOTION_DOT": 0,
    "MEAN_MOTION_DDOT": 0,
}


@pytest.mark.parametrize("norad_id", ["25544", "148493", "339999"])
def test_identity_round_trips_verbatim_for_in_range_ids(norad_id: str) -> None:
    """Below the 339999 ceiling a Satrec can be built, but identity never
    comes from it — the caller already had norad_id before calling
    satrec_from_omm(). This just proves construction doesn't raise and
    the input string is never touched.
    """
    record: OmmRecord = {**_BASE, "NORAD_CAT_ID": norad_id}
    satrec_from_omm(record)  # must not raise for an in-range id
    assert record["NORAD_CAT_ID"] == norad_id


def test_nine_digit_id_has_no_satrec_but_keeps_its_identity() -> None:
    """Issue #17 (closed as disproven, M0.4): the 339999 ceiling is a
    5-character TLE-field storage limit enforced by every Satrec
    constructor path, not a parsing bug — there is no integer side door.
    A 9-digit catalog id's *identity* (the OMM string) is unaffected; only
    building a Satrec for it is blocked today.
    """
    record: OmmRecord = {**_BASE, "NORAD_CAT_ID": "799500000"}
    with pytest.raises(ValueError, match="cannot exceed 339999"):
        satrec_from_omm(record)
    assert record["NORAD_CAT_ID"] == "799500000"


@pytest.mark.xfail(
    reason=(
        "python-sgp4 2.27's C++ backend emits the spec-forbidden Alpha-5 "
        "letters I/O for satnum 180000-189999 and 230000-239999 instead of "
        "J/P, disagreeing with its own pure-Python sgp4.alpha5.to_alpha5(). "
        "See brief Part 4.1 'Bonus finding'; not yet confirmed upstream."
    ),
    strict=True,
)
@pytest.mark.parametrize("satnum", [180000, 189999, 230000, 239999])
def test_satnum_str_agrees_with_the_spec_correct_alpha5_encoder(satnum: int) -> None:
    record: OmmRecord = {**_BASE, "NORAD_CAT_ID": str(satnum)}
    satrec = satrec_from_omm(record)
    assert satrec.satnum_str[0] == to_alpha5(satnum)[0]
```

- [ ] **Step 6: Run the new module, confirm the expected pass/xfail split**

Run: `docker compose run --rm backend pytest tests/unit/test_identity.py -v`
Expected: 4 passes (`test_identity_round_trips_verbatim_for_in_range_ids` x3, `test_nine_digit_id_has_no_satrec_but_keeps_its_identity`), 4 xfail (`test_satnum_str_agrees_with_the_spec_correct_alpha5_encoder` x4). If any of the 4 xfail tests unexpectedly **passes** (`XPASS`), the upstream bug has been fixed in the installed `sgp4` version — remove `strict=True` fails loudly in that case, which is the intended signal to revisit Bug 3.

- [ ] **Step 7: Write the frontend no-ceiling regression test**

Create `packages/orcas-physics/test/identity.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { satrecFromOmm } from '../src/index.js';
import type { OmmRecord } from '../src/index.js';

/**
 * satellite.js's json2satrec has no catalog-number ceiling and never
 * re-encodes NORAD_CAT_ID — satrec.satnum is the input string, verbatim,
 * for every case python-sgp4 can (25544, 148493, 339999) and cannot
 * (340000, 799500000, 999999999) construct a Satrec for. ORCAS Vault
 * Phase-4 Unified Engineering Brief, Part 4.2, milestone M0.1. This is a
 * regression guard: if a future satellite.js release starts normalising
 * or rejecting these, ORCAS's identity assumptions break silently
 * without this test.
 */
const BASE: OmmRecord = {
  OBJECT_NAME: 'ORCAS-TEST-SAT',
  OBJECT_ID: '1998-999Z',
  EPOCH: '2026-01-01T00:00:00.000000',
  MEAN_MOTION: 15.5,
  ECCENTRICITY: 0.0001,
  INCLINATION: 51.6,
  RA_OF_ASC_NODE: 0,
  ARG_OF_PERICENTER: 0,
  MEAN_ANOMALY: 0,
  EPHEMERIS_TYPE: 0,
  CLASSIFICATION_TYPE: 'U',
  NORAD_CAT_ID: '90001',
  ELEMENT_SET_NO: 999,
  REV_AT_EPOCH: 1,
  BSTAR: 0,
  MEAN_MOTION_DOT: 0,
  MEAN_MOTION_DDOT: 0,
};

describe('catalog identity — no ceiling, no re-encoding', () => {
  it.each(['25544', '148493', '339999', '340000', '799500000', '999999999'])(
    'json2satrec accepts NORAD_CAT_ID=%s and preserves it verbatim on satrec.satnum',
    (noradId) => {
      const record = { ...BASE, NORAD_CAT_ID: noradId };
      const satrec = satrecFromOmm(record);
      expect(satrec.satnum).toBe(noradId);
    },
  );
});
```

- [ ] **Step 8: Run the frontend test**

Run: `docker compose run --rm frontend npm run test -w packages/orcas-physics -- identity.test.ts` (or the package's own `npm test` if run from `packages/orcas-physics/`)
Expected: PASS, 6/6.

- [ ] **Step 9: Pin `sgp4` exactly**

In `backend/pyproject.toml`, change `"sgp4>=2.23",` to `"sgp4==2.27",` — the brief's measured findings (the ceiling, the Alpha-5 emit bug, the `satnum_str` behavior) are specific to this version; an unpinned range can silently change any of them on the next `uv sync`.

- [ ] **Step 10: Re-lock and verify the full backend suite still passes**

Run: `docker compose run --rm backend uv lock && docker compose run --rm backend pytest -v`
Expected: all tests pass (existing + the new `test_identity.py` + updated `test_tle.py`), ruff clean, `mypy --strict app/domain app/services` clean.

- [ ] **Step 11: Commit**

```bash
git add backend/app/domain/tle.py backend/tests/unit/test_tle.py backend/tests/unit/test_identity.py backend/pyproject.toml backend/uv.lock packages/orcas-physics/test/identity.test.ts
git commit -m "fix(backend): normalise Alpha-5 TLE catalog numbers to decimal NORAD_CAT_ID"
```

---

### Task 2: M0.2 — Fix the geodetic conversion (pole bug + 9.6x speedup)

**Why:** `backend/app/domain/coordinates.py`'s `ecef_to_geodetic_deg()` uses the same flawed `r / cos(lat) - c` height formula as `satellite.js`'s `eciToGeodetic` — independently reproducible: at `x=y=0, z=6800`, `atan2(6800, 0)` gives `lat = π/2` exactly, `cos(π/2)` is `~6.12e-17` (not exactly zero in floating point), so `alt = 0/6.12e-17 - 6399.59 ≈ -6399.59 km` instead of the true `+443.25 km`. This is the *same* singularity as the brief's Bug 2, present in the hand-rolled Python implementation too, not just `satellite.js`. Both stacks get the Bowring closed-form fix.

**Files:**
- Modify: `backend/app/domain/coordinates.py` (replace the 8-iteration loop)
- Create: `backend/tests/unit/test_coordinates.py`
- Modify: `packages/orcas-physics/src/coordinates.ts` (replace the `satellite.js` `eciToGeodetic` call)
- Create: `packages/orcas-physics/test/coordinates.test.ts`

**Interfaces:**
- Consumes: `Vec3`/`GeodeticPosition` (backend, `app.domain.types`); `EciVec3<number>`/`GeodeticPosition` (frontend, `./types.js`)
- Produces: `ecef_to_geodetic_deg(position_km_ecef: Vec3) -> GeodeticPosition` (backend, same signature as today — callers in `eci_to_geodetic_deg` and elsewhere are unaffected); `eciToGeodeticDeg(positionEciKm: EciVec3<number>, gmst: number) -> GeodeticPosition` (frontend, same signature as today)

- [ ] **Step 1: Write the failing pole test (backend)**

Create `backend/tests/unit/test_coordinates.py`:

```python
"""Regression tests for app.domain.coordinates.ecef_to_geodetic_deg —
the pole singularity (brief Part 3.3, Bug 2) and its Bowring closed-form
fix, milestone M0.2.
"""

import math

import pytest

from app.domain.coordinates import ecef_to_geodetic_deg
from app.domain.types import Vec3

# WGS-84 semi-minor axis, km (a * (1 - f), f = 1/298.257223563). True
# height at the exact pole for a given z is z - b, since R (=hypot(x,y))
# is 0 there. Brief's own worked example: z=6800 -> height 443.247686 km.
_B_KM = 6356.752314245


def test_north_pole_returns_correct_altitude_not_the_iterative_bug_value() -> None:
    geo = ecef_to_geodetic_deg(Vec3(x=0.0, y=0.0, z=6800.0))
    assert geo.altitude_km == pytest.approx(6800.0 - _B_KM, abs=1e-3)
    assert geo.latitude_deg == pytest.approx(90.0, abs=1e-6)


def test_south_pole_is_symmetric() -> None:
    geo = ecef_to_geodetic_deg(Vec3(x=0.0, y=0.0, z=-6800.0))
    assert geo.altitude_km == pytest.approx(6800.0 - _B_KM, abs=1e-3)
    assert geo.latitude_deg == pytest.approx(-90.0, abs=1e-6)


def _geodetic_to_ecef_km(lat_deg: float, lon_deg: float, alt_km: float) -> Vec3:
    """Standard forward WGS-84 formula — test-only, used to build known
    ground-truth points and confirm ecef_to_geodetic_deg recovers them.
    """
    a, f = 6378.137, 1 / 298.257223563
    e2 = f * (2 - f)
    lat, lon = math.radians(lat_deg), math.radians(lon_deg)
    n = a / math.sqrt(1 - e2 * math.sin(lat) ** 2)
    x = (n + alt_km) * math.cos(lat) * math.cos(lon)
    y = (n + alt_km) * math.cos(lat) * math.sin(lon)
    z = (n * (1 - e2) + alt_km) * math.sin(lat)
    return Vec3(x=x, y=y, z=z)


@pytest.mark.parametrize(
    "lat_deg,lon_deg,alt_km",
    [
        (0.0, 0.0, 400.0),
        (0.0, 179.999, 35786.0),
        (45.0, -73.5, 550.0),
        (-51.6, 120.0, 417.0),
        (89.9, 10.0, 800.0),
        (-89.9999, -10.0, 800.0),
    ],
)
def test_round_trips_within_brief_measured_bowring_accuracy(
    lat_deg: float, lon_deg: float, alt_km: float
) -> None:
    """Bowring vs a 60-iteration reference, per the brief's own measurement
    (Part 3.3): max latitude error ~1.7e-3 arcsec (~5.4 cm ground), max
    height error 0.31 m. Use those bounds, not machine precision.
    """
    ecef = _geodetic_to_ecef_km(lat_deg, lon_deg, alt_km)
    geo = ecef_to_geodetic_deg(ecef)
    assert geo.latitude_deg == pytest.approx(lat_deg, abs=1.7e-3 / 3600)
    assert geo.longitude_deg == pytest.approx(lon_deg, abs=1.7e-3 / 3600)
    assert geo.altitude_km == pytest.approx(alt_km, abs=0.001)  # 0.31 m bound, generous
```

- [ ] **Step 2: Run it to verify the pole tests fail**

Run: `docker compose run --rm backend pytest tests/unit/test_coordinates.py -v`
Expected: `test_north_pole_...` and `test_south_pole_...` FAIL with `altitude_km` around `-6399.59`, not `443.25`. The round-trip tests should already pass (the old iterative method is accurate away from the poles) — confirming the fix must be scoped to the pole singularity, not the general algorithm.

- [ ] **Step 3: Replace the iterative conversion with Bowring's closed form**

In `backend/app/domain/coordinates.py`, add a semi-minor-axis constant next to the existing ones:

```python
_WGS84_B_KM = _WGS84_A_KM * (1 - _WGS84_F)  # semi-minor axis, 6356.752314245 km
```

Replace the body of `ecef_to_geodetic_deg`:

```python
def ecef_to_geodetic_deg(position_km_ecef: Vec3) -> GeodeticPosition:
    """WGS84 ECEF to geodetic via Bowring's closed-form parametric-latitude
    method — no iteration. ~9.6x faster than the previous fixed-iteration
    loop and pole-safe; see ORCAS Vault Phase-4 brief Part 3.3 (Bug 2).
    Input km, output deg/deg/km. Accuracy vs a 60-iteration reference:
    ~5 cm on the ground, ~0.31 m height.
    """
    x, y, z = position_km_ecef.x, position_km_ecef.y, position_km_ecef.z
    lon = math.atan2(y, x)
    r = math.hypot(x, y)

    if r < 1e-9:  # on the spin axis — atan2(y, x) and the Bowring step below
        # are both singular here; handle the pole directly instead.
        sign = 1.0 if z >= 0 else -1.0
        return GeodeticPosition(
            latitude_deg=90.0 * sign,
            longitude_deg=0.0,
            altitude_km=abs(z) - _WGS84_B_KM,
        )

    ep2 = _WGS84_E2 / (1 - _WGS84_E2)  # second eccentricity squared
    th = math.atan2(_WGS84_A_KM * z, _WGS84_B_KM * r)
    st, ct = math.sin(th), math.cos(th)
    lat = math.atan2(
        z + ep2 * _WGS84_B_KM * st**3,
        r - _WGS84_E2 * _WGS84_A_KM * ct**3,
    )

    sin_lat = math.sin(lat)
    n = _WGS84_A_KM / math.sqrt(1 - _WGS84_E2 * sin_lat * sin_lat)
    # near the poles, r/cos(lat) is ill-conditioned; switch height branch
    # at |lat| > 30 deg (|sin(lat)| > 0.5), same trick as the pole guard.
    alt = (
        z / sin_lat - n * (1 - _WGS84_E2)
        if abs(sin_lat) > 0.5
        else r / math.cos(lat) - n
    )
    return GeodeticPosition(
        latitude_deg=math.degrees(lat), longitude_deg=math.degrees(lon), altitude_km=alt
    )
```

- [ ] **Step 4: Run the backend coordinate tests and the existing propagation tests**

Run: `docker compose run --rm backend pytest tests/unit/test_coordinates.py tests/unit/test_propagation.py tests/golden/ -v`
Expected: all PASS — `test_coordinates.py` (new), and the existing `test_propagate_rotates_to_geodetic_consistent_with_417km_circular_orbit` (416.79 km) and the golden-file 2009 reconstruction, both unaffected since Bowring's ~5 cm/~0.3 m error is far inside those tests' existing tolerances (`abs=0.1`).

- [ ] **Step 5: Write the failing pole test (frontend)**

Create `packages/orcas-physics/test/coordinates.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { eciToGeodeticDeg } from '../src/index.js';

// Same worked example as the backend test and the brief (Part 3.3):
// x=y=0, z=6800 km -> true height z - b, b = 6356.752314245 km.
const B_KM = 6356.752314245;

describe('eciToGeodeticDeg — pole singularity (Bug 2)', () => {
  it('returns the correct altitude at the north pole, not -6399.59 km', () => {
    const geo = eciToGeodeticDeg({ x: 0, y: 0, z: 6800 }, 0);
    expect(geo.altitudeKm).toBeCloseTo(6800 - B_KM, 3);
    expect(geo.latitudeDeg).toBeCloseTo(90, 6);
  });

  it('is symmetric at the south pole', () => {
    const geo = eciToGeodeticDeg({ x: 0, y: 0, z: -6800 }, 0);
    expect(geo.altitudeKm).toBeCloseTo(6800 - B_KM, 3);
    expect(geo.latitudeDeg).toBeCloseTo(-90, 6);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `docker compose run --rm frontend npm test -- coordinates.test.ts` (run from `packages/orcas-physics/`)
Expected: FAIL — `altitudeKm` is `-6399.59...`, not `443.25`.

- [ ] **Step 7: Replace `eciToGeodeticDeg` with the Bowring closed form**

Replace the full contents of `packages/orcas-physics/src/coordinates.ts`:

```ts
import { gstime } from 'satellite.js';
import type { EciVec3 } from 'satellite.js';
import type { GeodeticPosition } from './types.js';

/** Greenwich Mean Sidereal Time at a given instant. Input: JS Date (UTC). Output: radians. */
export function gmstRad(at: Date): number {
  return gstime(at);
}

const A_KM = 6378.137; // WGS-84 semi-major axis
const F = 1 / 298.257223563; // WGS-84 flattening (exact value)
const B_KM = A_KM * (1 - F); // 6356.752314245 km
const E2 = F * (2 - F); // 0.00669437999014132
const EP2 = E2 / (1 - E2); // second eccentricity squared
const TWO_PI = 2 * Math.PI;

/**
 * Rotate a TEME position into geodetic lat/lon/altitude via a bare
 * z-rotation by GMST followed by Bowring's closed-form parametric-latitude
 * method (no iteration). Replaces the satellite.js `eciToGeodetic` call,
 * which returns -6399.59 km instead of +443.25 km at the exact pole
 * (x=y=0) — see ORCAS Vault Phase-4 brief Part 3.3 (Bug 2). ~9.6x faster
 * at 46k objects and accurate to ~5 cm / ~0.31 m vs a 60-iteration
 * reference. Input: TEME position (km), GMST (rad). Output: degrees,
 * degrees, km above WGS84.
 */
export function eciToGeodeticDeg(positionEciKm: EciVec3<number>, gmst: number): GeodeticPosition {
  const { x, y, z } = positionEciKm;
  const r = Math.hypot(x, y); // rotation-invariant: same in ECI and ECEF

  const lon = ((((Math.atan2(y, x) - gmst + Math.PI) % TWO_PI) + TWO_PI) % TWO_PI) - Math.PI;

  if (r < 1e-9) {
    // On the spin axis — atan2(y, x) above and the Bowring step below are
    // both singular here.
    const sign = z >= 0 ? 1 : -1;
    return { latitudeDeg: 90 * sign, longitudeDeg: 0, altitudeKm: Math.abs(z) - B_KM };
  }

  const th = Math.atan2(A_KM * z, B_KM * r);
  const st = Math.sin(th);
  const ct = Math.cos(th);
  const lat = Math.atan2(z + EP2 * B_KM * st ** 3, r - E2 * A_KM * ct ** 3);

  const sinLat = Math.sin(lat);
  const n = A_KM / Math.sqrt(1 - E2 * sinLat * sinLat);
  // near the poles, r/cos(lat) is ill-conditioned; switch height branch
  // at |lat| > 30 deg (|sin(lat)| > 0.5).
  const height =
    Math.abs(sinLat) > 0.5 ? z / sinLat - n * (1 - E2) : r / Math.cos(lat) - n;

  return {
    latitudeDeg: (lat * 180) / Math.PI,
    longitudeDeg: (lon * 180) / Math.PI,
    altitudeKm: height,
  };
}
```

Note this drops the `eciToGeodetic`/`degreesLat`/`degreesLong` import from `satellite.js` entirely — the function no longer calls into the library for this step. `gstime` is still used for `gmstRad`.

- [ ] **Step 8: Run the frontend coordinate and propagation tests**

Run: `docker compose run --rm frontend npm test -- coordinates.test.ts propagate.test.ts` (from `packages/orcas-physics/`)
Expected: all PASS, including the existing `rotates to a geodetic position consistent with a ~417 km circular orbit` test (416.79 km, unaffected within its `toBeCloseTo(..., 1)` tolerance).

- [ ] **Step 9: Measure and record the before/after cost**

This is a one-time manual measurement per the brief's DoD ("a benchmark records the before/after cost... and writes it into the vault"), not a CI-gated test. From a scratch Node REPL or a throwaway script inside `packages/orcas-physics/`, generate ~46,000 synthetic ECI positions (random `x,y,z` in LEO/GEO range) and time calling the **old** `eciToGeodetic` from `satellite.js` directly vs the **new** `eciToGeodeticDeg` in a loop, `performance.now()` before/after, averaged over ~20 reps (same method the brief itself used). Record the two numbers.

- [ ] **Step 10: Run the full type-check and lint**

Run: `docker compose run --rm backend mypy --strict app/domain app/services && docker compose run --rm backend ruff check .`
Run: `docker compose run --rm frontend npm run lint`
Expected: clean.

- [ ] **Step 11: Commit**

```bash
git add backend/app/domain/coordinates.py backend/tests/unit/test_coordinates.py packages/orcas-physics/src/coordinates.ts packages/orcas-physics/test/coordinates.test.ts
git commit -m "fix(physics): replace iterative geodetic conversion with pole-safe Bowring closed form"
```

(The benchmark numbers from Step 9 go into the memory.md update in Task 4, not into this commit.)

---

### Task 3: M0.3 — Correct the decay predicate

**Why:** Both propagators already fail *safely* today — `backend/app/domain/propagation.py` raises `PropagationFailedError` on **any** nonzero SGP4 error code (not just 6), and `packages/orcas-physics/src/propagate.ts` throws on any falsy/null result. Neither has the anti-pattern the brief warns about (checking `error === 6` alone). What's missing: the frontend doesn't yet opt into `communityDecayCheckEnabled`, which the brief recommends specifically for a visualisation platform (catches long-decayed objects whose `tempa` has gone negative and which SGP4 would otherwise report as a "successful", fictitious position); and there's no regression test proving a real decayed object (Vallado's canonical case 22312) is correctly treated as unrenderable despite reporting error 1, not error 6.

**Files:**
- Modify: `packages/orcas-physics/src/propagate.ts` (enable the community decay check)
- Modify: `backend/tests/unit/test_propagation.py` (add the object-22312 regression case)
- Modify: `packages/orcas-physics/test/propagate.test.ts` (mirror, if a JS-side fixture is available — see Step 4)

**Interfaces:**
- Consumes: `sgp4Propagate(satrec, at, options?)` from `satellite.js` (existing import in `propagate.ts`)
- Produces: `propagate(satrec: SatRec, at: Date, noradId: string): SatState` — same signature, unchanged; only the internal call to `sgp4Propagate` gains an options argument.

- [ ] **Step 1: Fetch Vallado's canonical decayed-object fixture**

Object 22312 ("SL-6 R/B(2)... decayed 2006-04-04") is one of the 33 cases in `python-sgp4`'s own bundled `SGP4-VER.TLE` test file. Get its real two TLE lines — do not hand-write them. Either:

```bash
docker compose run --rm backend python -c "import sgp4, os; print(os.path.dirname(sgp4.__file__))"
```
then read `SGP4-VER.TLE` from that directory for the block starting `22312`, **or** fetch it directly:
```bash
curl -s https://raw.githubusercontent.com/brandon-rhodes/python-sgp4/master/sgp4/SGP4-VER.TLE | grep -A2 "^# .*22312\|^1 22312"
```
Extract the two element lines (and the case's stated start/stop/step if present) for use in Step 2.

- [ ] **Step 2: Write the failing regression test (backend)**

Add to `backend/tests/unit/test_propagation.py`, using the two real lines from Step 1 (replace `<LINE1>`/`<LINE2>` with what Step 1 found):

```python
def test_decayed_object_22312_fails_with_error_1_not_error_6() -> None:
    """Vallado's canonical verification case 22312 is annotated "decayed
    2006-04-04" but reports SGP4 error 1 (mean eccentricity out of range),
    not error 6 ("has decayed") — first failing at t=494.2 min per the
    brief's own measurement (Part 3.4). A decay predicate that only checks
    error == 6 would misclassify this as healthy. ORCAS's actual behaviour
    (raise PropagationFailedError on ANY nonzero error) already gets this
    right; this test pins that down against future regressions.
    """
    from sgp4.api import Satrec, WGS72

    sat = Satrec.twoline2rv("<LINE1>", "<LINE2>", WGS72)
    at = datetime(2006, 4, 4, 8, 15, 0, tzinfo=UTC)  # well past the 494.2 min mark from epoch

    with pytest.raises(PropagationFailedError) as exc_info:
        propagate(sat, at, "22312")
    assert exc_info.value.sgp4_error == 1
```

(If the fetched case's epoch makes the exact wall-clock time inconvenient to compute, propagate directly in `tsince` minutes via `sat.sgp4_tsince(...)` instead of wall-clock `propagate()`, asserting `error == 1` the same way — whichever matches the fixture's own stated start/stop/step from Step 1.)

- [ ] **Step 3: Run it to verify it currently passes (this documents existing-correct behavior, not a bug)**

Run: `docker compose run --rm backend pytest tests/unit/test_propagation.py::test_decayed_object_22312_fails_with_error_1_not_error_6 -v`
Expected: PASS already — `PropagationFailedError` is raised for any nonzero error, so this is a **regression pin**, not a fix. If it unexpectedly fails, `propagation.py`'s `if error != 0` check has regressed to something narrower (e.g. `== 6`); fix it back to `!= 0` before continuing.

- [ ] **Step 4: Enable the community decay check on the frontend**

In `packages/orcas-physics/src/propagate.ts`, change the `sgp4Propagate` call:

```ts
export function propagate(satrec: SatRec, at: Date, noradId: string): SatState {
  const result = sgp4Propagate(satrec, at, { communityDecayCheckEnabled: true });
  if (!result || !result.position || !result.velocity) {
    throw new PropagationFailedError(noradId, at);
  }
  return {
    positionEciKm: result.position,
    velocityEciKmS: result.velocity,
    at,
  };
}
```

Update the function's doc comment to note this: `satellite.js`'s community decay check (`tempa <= 0`, opt-in) is enabled so that long-decayed objects whose drag model has driven a *negative* semi-major-axis factor — which `tempa²` masks into a plausible-looking "successful" position — are still rejected. Cite: brief Part 3.4.

- [ ] **Step 5: Run the frontend propagation tests**

Run: `docker compose run --rm frontend npm test -- propagate.test.ts` (from `packages/orcas-physics/`)
Expected: PASS — the existing tests use a healthy synthetic orbit, `tempa` stays positive, so `communityDecayCheckEnabled` changes nothing for them.

- [ ] **Step 6: Commit**

```bash
git add backend/tests/unit/test_propagation.py packages/orcas-physics/src/propagate.ts
git commit -m "fix(physics): enable community decay check on frontend, pin backend decay-error regression"
```

---

### Task 4: M0.4 — Close Issue #17 as disproven, sync vault decisions

**Why:** Purely a documentation task — the code-level conclusion ("no integer side door exists; the ceiling is a storage constraint") is already evidenced by `test_identity.py`'s `test_nine_digit_id_has_no_satrec_but_keeps_its_identity` (Task 1). This task records that in the vault so a future agent doesn't re-open the same dead end, and folds forward the brief's Part 10 decision tables per this vault's established "layer corrections, don't rewrite history" pattern (see memory.md's own Cloudflare-Pages-to-Vercel precedent).

**Files:**
- Modify: `ORCAS Vault/00 - Meta/memory.md`

**Steps (no test cycle — this is documentation, verified by re-reading the diff, not by running anything):**

- [ ] **Step 1:** In memory.md's "🧠 Things a new agent must know" item **17**, change its status line from `🔴 **python-sgp4's C extension rejects...**` to:

  > **17.** ✅ **CLOSED AS DISPROVEN 2026-08-21** — the "call `sgp4init()` directly to bypass the ceiling" hypothesis was tested and fails identically at 340000, as does the OMM path (`sgp4.omm.initialize()`). The ceiling is a *storage* constraint (Vallado's C++ `elsetrec` holds the satellite number in a 5-character field), not a *parsing* one — every constructor path funnels through the same `to_alpha5()` guard, and there is no integer field to write a 9-digit number into. **The fix is P4.D15 (ingest OMM, keep `NORAD_CAT_ID` as a full-width string, never round-trip identity through a `Satrec`)**, not a workaround inside the SGP4 layer. Evidence: `backend/tests/unit/test_identity.py::test_nine_digit_id_has_no_satrec_but_keeps_its_identity`. Full measurement table: `03 - Engineering/Phase-4-Engineering-Brief.md` Part 4.1.

  Update the "⚠️ Known issues" table row for `sgp4` rejects `NORAD_CAT_ID` > 339999 the same way — 🔴 → ✅ **Closed as disproven**, one-line pointer to the same evidence.

- [ ] **Step 2:** Add a new dated entry at the top of memory.md's "🔖 Current state" (or a new "🔖 Current state — 2026-08-21" block, following the file's existing pattern of stacking dated callouts) recording:
  - `03 - Engineering/Phase-4-Engineering-Brief.md` was produced 2026-08-21, supersedes `03 - Engineering/Phase-4-Subsystem-1-Architecture.md` (absorbed in full, with corrections — the old file is left in place as historical record per this vault's standing pattern, not deleted; both files were also relocated from the vault root into `03 - Engineering/` and renamed to drop the redundant "ORCAS-" prefix during this same session's vault reorg, matching the `Architecture.md`/`Stack.md` naming convention).
  - Three live bugs were found by direct measurement and are now fixed: (1) backend TLE adapter stored Alpha-5 text instead of decimal `NORAD_CAT_ID` for catalog numbers ≥ 100000 — fixed, M0.1; (2) both `eciToGeodetic` implementations (backend hand-rolled iterative, frontend via `satellite.js`) returned a wildly wrong altitude at the exact geographic pole — fixed with a shared Bowring closed-form replacement, also ~9.6x faster at scale, M0.2; (3) frontend now opts into `satellite.js`'s community decay check so long-decayed objects with a masked-negative `tempa` don't render a fictitious position, M0.3.
  - Record the M0.2 benchmark numbers from Task 2 Step 9 here, verbatim, once measured.
  - Record the decision table from the brief's Part 10.2/10.3 as `P4.D15`–`P4.D22` (the brief's own IDs — copy the table rows directly, they're already written for vault consumption).
  - Note the still-open items the brief surfaced that are **not** part of this M0 gate: G5 (Chan's Pc series form — blocking prerequisite before any conjunction-screening code, not needed until Phase 5/M1.7+), G17 (NAIF SPICE licence — blocks Phase 7 only), and the Phase 3 dependency approval / uncommitted Phase 3 working-tree state (both raised to Fenil directly, not resolved by this plan — see chat).

- [ ] **Step 3:** Update memory.md's "⏭️ Next actions" list: mark the M0 gate done (or in-progress, depending on when this step runs relative to Tasks 1–3), and set the top item to **M1.0 — Catalogue ingest and snapshot** (brief Part 2 §I / Part 11.2), noting it's now amended to ingest OMM (already true for this codebase) and to record measured `eciToGeodetic` throughput per M1.1's Definition of Done.

- [ ] **Step 4:** Re-read the full diff to memory.md once done — this file has no test suite; the review pass **is** the verification step.

- [ ] **Step 5: Commit**

```bash
git add "ORCAS Vault/00 - Meta/memory.md"
git commit -m "docs(vault): close issue #17 as disproven, record M0 bug-fix gate and P4.D15-D22"
```

---

## Self-review notes

- **Spec coverage:** M0.1–M0.4 from brief Part 11.1 each map to Task 1–4 above. Part 11.1's DoD bullets are reproduced as concrete test names/assertions in each task, not paraphrased. The three "live bugs" from Part 0.5 are each closed by name (Bug 1 → Task 1, Bug 2 → Task 2, Bug 3 → Task 1's xfail test, since it's the same Alpha-5 family as Bug 1's fix). Part 11.1's M0 items stop short of the ingestion-layer "pass SGP4 a dummy in-range satnum" recommendation for >339999 objects (brief Part 4.1 recommendation #2) — that's real M1.0 ingestion work, not a 2-3 day bug fix, and is called out explicitly in Task 4 Step 2 rather than silently dropped.
- **Not in this plan, by design:** the Phase 3 uncommitted working-tree files, the framer-motion/lucide-react/font dependency approval, and G5/G17 — these are the user's calls (git workflow, dependency approval boundary, and phase sequencing respectively), not implementation tasks. Raised in the chat response accompanying this plan, not resolved here.
