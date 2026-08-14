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

## Iridium 33 / Cosmos 2251 — deliberately NOT included here

⚠️ **Known gap, not an oversight.** Phases.md and Data-Strategy.md both call
for the 2009 Iridium 33 / Cosmos 2251 element sets to be committed as fixed
sample data for the Phase 1 golden-file test (reproducing D_M = 1.84,
P_c = 4.2 × 10⁻³ from the paper). Those two objects' real identities are
well-documented (Iridium 33 = NORAD 24946, Cosmos 2251 = NORAD 22675), but
their precise orbital elements at the 2009-02-10 epoch are **not** — and
Rules.md's honesty rule ("never invent a number") means those elements must
be sourced from an authoritative archive (Space-Track.org historical GP
query, or CelesTrak's historical TLE archive), not approximated or guessed.

**Action for Phase 1:** pull the real historical element sets for both
objects near 2009-02-10T16:56:00Z from Space-Track.org, normalise to this
same canonical OMM shape, and commit them here before writing the
golden-file test. Do not fabricate placeholder numbers in the meantime.
