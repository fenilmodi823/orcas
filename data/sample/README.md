# data/sample/

Small, committed fixture set for local dev and tests. Not fetched, not
regenerable-required — this is what a fresh clone runs against with Docker
and no network access.

## `omm-sample.json`

21 **synthetic** objects, canonical OMM shape (Data-Strategy.md §9.1 /
CelesTrak GP JSON). Covers LEO (10), one 6-digit `NORAD_CAT_ID` LEO object
(proves VARCHAR handling — see Data-Strategy.md §1), MEO (4), GEO (4), and
Molniya-type HEO (2). All 21 records were propagated with the real
`satellite.js` library before being committed (see the ORCAS session that
generated this file) — altitudes and orbit shapes are physically consistent
with their class, but the identities, designators, and element values are
made up. **None of these correspond to a real tracked object.**

## `iridium33_cosmos2251_2009_spacetrack.tle`

✅ **Real data, sourced 2026-08-15.** Fenil pulled these from Space-Track.org
and supplied them directly. Iridium 33 = NORAD 24946, Cosmos 2251 = NORAD
22675 — three-line TLE format, all distinct epochs Space-Track returned
around the 2009-02-10 collision (the last few are near-identical, elements
fit shortly before/after 16:56 UTC since both objects stopped generating
new tracking data once destroyed).

**Verified against the paper's own Table I**: propagating the epoch-closest
elements (day 041.76123952 for Iridium, day 041.75659016 for Cosmos) to
2009-02-10 16:56:00 UTC via this repo's real SGP4 code reproduces the
paper's stated altitude (788.6/788.6 km), latitude (72.51°N/72.51°N) and
longitude (97.90°E/97.90°E) to within propagation noise, and velocity
(7.47/7.47 km/s vs. the paper's 7.46/7.42) closely. See
`backend/tests/golden/test_2009_reconstruction.py`.

**What this data does *not* let the golden-file test claim**: the paper's
covariance matrices for this event were built by hand for the demo ("no
other real incident to calibrate against" — confirmed directly by Fenil),
not derived from a formula tied to real tracking data. Reverse-engineering
the paper's own listed covariance numbers against these real orbital states
does not reproduce D_M = 1.84 / P_c = 4.2 × 10⁻³ — confirmed by actually
running the numbers, not assumed. The golden-file test therefore verifies
real kinematics exactly, uses its own clearly-labelled realistic covariance
assumption (not the paper's undocumented one), and checks that the same
CRITICAL classification is reached — see issue #18 in memory.md.
