---
title: Glossary
type: research
updated: 2026-07-27
---

# Glossary

Terms used across [[ORCAS Research Paper]], [[Architecture]] and the conference deck. Written so a non-specialist reader — or a new AI agent — can follow the project without the paper open.

---

## Orbital mechanics

**TLE — Two-Line Element set**
A compact, two-line text encoding of an object's orbit at a given moment (the *epoch*). Published free by CelesTrak and Space-Track for essentially every tracked object. Crucially, **a TLE carries no uncertainty information** — which is exactly the gap this research addresses.

**SGP4 — Simplified General Perturbations 4**
The standard analytical propagator that turns a TLE into a position and velocity at any time. Accounts for atmospheric drag and Earth's oblateness. It is what everyone uses, and ORCAS uses it too — server-side via Skyfield, client-side via satellite.js.

**Epoch**
The timestamp a TLE describes. Propagation accuracy decays as you move away from it — the reason "live" tracking is really "recently-refreshed" tracking.

**ECI — Earth-Centered Inertial**
Coordinate frame fixed relative to the stars, origin at Earth's centre. Orbits are naturally described here because it doesn't rotate.

**ECEF — Earth-Centered Earth-Fixed**
Coordinate frame that rotates *with* the Earth. Needed to say "the satellite is above this city".

**Geodetic coordinates**
Latitude, longitude, altitude above the WGS84 reference ellipsoid. What humans read.

**GMST — Greenwich Mean Sidereal Time**
The angle needed to convert between ECI and ECEF at any instant. ORCAS recomputes it **every frame**, which is what keeps the rendered Earth's rotation in sync with the satellites above it.

**Perigee / Apogee**
Closest and furthest points of an orbit. Velocity peaks at perigee — visible in Fig. 1 and a direct consequence of conservation of orbital energy.

**LEO / MEO / GEO**
Low (~160–2,000 km), Medium (~2,000–35,786 km), Geosynchronous (~35,786 km) Earth orbit. The backend pre-sorts objects into these bands by mean motion before the client sees them.

**B\* (B-star)**
The drag term in a TLE. Used as an ML feature — it correlates with an object's area-to-mass ratio, which helps distinguish debris from intact payloads.

---

## Conjunction assessment

**Conjunction**
A close approach between two orbiting objects. Not necessarily a collision — that is precisely the ambiguity this research quantifies.

**CA — Conjunction Assessment**
The process of predicting conjunctions and deciding which warrant action.

**SSA — Space Situational Awareness**
The broader field: knowing what is in orbit, where, and what it will do next.

**TCA — Time of Closest Approach**
The moment two objects are nearest. All the interesting mathematics happens here.

**Covariance matrix**
A 3×3 matrix describing the *uncertainty* in an object's position. Geometrically it's an ellipsoid: not "the satellite is here" but "the satellite is somewhere in this cloud, most likely near the centre". The central object of this paper.

**Covariance intersection**
Combining the uncertainty ellipsoids of two objects to reason about whether they overlap. If they overlap substantially, a predicted "miss" is not safe.

**Mahalanobis distance (D_M)**
Distance measured in units of standard deviation rather than kilometres. `D_M = √(rᵀ C⁻¹ r)`. Two objects 500 m apart with tight covariance are far; the same 500 m with sloppy covariance is dangerously close. **In the 2009 reconstruction, D_M = 1.84** — under two sigma.

**B-plane**
The plane perpendicular to the relative velocity vector at TCA. Projecting the 3D encounter onto this 2D plane turns an intractable volume integral into a tractable area integral. `C_B = P · C_c · Pᵀ`.

**P_c — Probability of Collision**
The integral of the 2D Gaussian probability density over the combined hardbody cross-section on the B-plane. The actionable output. **ORCAS alerts above 1.0 × 10⁻⁴; the 2009 event scored 4.2 × 10⁻³** — two orders of magnitude higher.

**Hardbody radius**
The two spacecraft modelled as spheres; their combined radius defines the cross-section `A` that `P_c` is integrated over.

**Deterministic screening**
The legacy approach: compute Euclidean distance, alert below a fixed threshold. Ignores uncertainty entirely. **This is what failed in 2009.**

**3σ boundary**
The ellipse containing ~99.7% of the probability mass. Fig. 4 shows the 3σ boundaries of Iridium 33 and Cosmos 2251 overlapping while their centres suggest a comfortable miss — the single most persuasive image in the project.

---

## The 2009 event

**Iridium 33 / Cosmos 2251**
10 February 2009, ~16:56 UTC, 788.6 km above Siberia. An active US communications satellite and a derelict Russian spacecraft collided at a relative velocity of **11.7 km/s** — the first major accidental hypervelocity collision between two intact satellites. It produced thousands of trackable fragments. Deterministic screening had not flagged it as critical.

ORCAS reconstructs it from declassified TLEs as ground-truth validation.

**Kessler Syndrome**
Proposed by Donald Kessler in 1978: a cascade where each collision produces debris that causes further collisions, eventually making an orbital band unusable. The reason any of this matters.

**Time-decoupled reconstruction**
Detaching the propagator from the system clock so it can ingest historical epochs. This is what makes the 2009 replay a genuine validation rather than a pre-rendered animation — the same physics engine runs on 2009 element sets.

---

## Machine learning

**Random Forest**
Ensemble of decision trees; predictions are averaged. Handles non-linear relationships between features without assuming a functional form. Used in ORCAS both to classify objects (payload / rocket body / debris) and to classify conjunction severity.

**ROC curve / AUC**
True positive rate against false positive rate across all thresholds. AUC 1.0 is perfect, 0.5 is a coin flip. **ORCAS: 0.94 vs 0.70 for deterministic thresholding.**

**Feature importance (Gini)**
How much each input contributes. Here: scalar velocity 0.40, eccentricity 0.25, altitude 0.20, inclination 0.15.

**Broad-phase / narrow-phase**
Two-stage collision detection borrowed from game physics. Broad-phase cheaply eliminates pairs that cannot possibly collide (spatial hashing, `cKDTree`), reducing O(N²) to ~O(N log N). Only survivors get the expensive narrow-phase probabilistic treatment. **This is what preserves the 60 FPS budget.**

---

## Rendering

**WebGL / Three.js / React-Three-Fiber**
Browser GPU API; the library that wraps it; the React renderer for that library. ORCAS uses R3F so 3D scene graph is declarative React.

**InstancedMesh**
One geometry, one material, an array of transform matrices — rendered in a **single draw call**. How ORCAS puts 10,000+ debris fragments on screen without collapsing the frame rate.

**Additive blending**
Overlapping translucent surfaces sum their brightness. Produces the volumetric glow of the density heatmap at no volumetric cost.

**Draw call**
One instruction from CPU to GPU. They are the bottleneck; minimising them is most of real-time graphics performance.

**dpr — device pixel ratio**
Physical pixels per CSS pixel. Uncapped on a high-DPI display it quadruples the fragment shading cost. ORCAS caps it at `[1, 2]`.

---

## Data sources

**CelesTrak** — Dr T. S. Kelso's public catalogue of TLEs. Primary source. Free, no auth.
**Space-Track.org** — Official US catalogue. More complete, requires an account.
**JPL SPICE / de421.bsp** — Planetary ephemeris kernels, used by the heliocentric engine.

---

**Related:** [[ORCAS Research Paper]] · [[Architecture]] · [[Conference - ICSSIT 2026]]
