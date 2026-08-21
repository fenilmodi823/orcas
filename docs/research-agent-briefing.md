# ORCAS — Research Agent Briefing

> Source of truth for what's *actually* open: `ORCAS Vault/00 - Meta/memory.md`, `Phases.md`, `Architecture.md`, `Data-Strategy.md`, `Design.md`, `UI-Research.md`. This file is a research-topics extract for feeding an external research agent — not a spec, not a plan. If it drifts from the vault, the vault wins.
>
> Compiled 2026-08-21, going into Phase 4 (single simulation frontend).

## 1. Orbital mechanics & physics (grounding, mostly implemented — verify/extend)

- SGP4 theory (Vallado's *Fundamentals of Astrodynamics*) — atmospheric drag (B\*) and Earth-oblateness perturbation terms, for documentation/comment accuracy in `domain/propagation.py`
- **Foster/Patera/Alfriend closed-form P_c approximations** — the backend uses `scipy.integrate.dblquad` (exact, batch-only); a real-time client-side conjunction highlight (PRD 4.3) needs a fast closed-form approximation. Research which one is standard for 60 FPS use.
- GMST / Vallado iterative WGS84 geodetic conversion — cross-check the hand-rolled `coordinates.py` implementation against a second authoritative source (Skyfield's ITRF chain) for edge cases near the poles
- `checkForDecay()` in `satellite.js` v7 — exact semantics, what "decayed" means numerically, how to wire it so long-dead objects don't render at garbage positions
- Broad-phase collision screening — `scipy.spatial.cKDTree.query_pairs` usage patterns for O(N log N) conjunction screening at ~16,200+ objects (`domain/screening.py`, not started)
- LEO/MEO/GEO/HEO classification thresholds by mean motion, including edge cases (Molniya/HEO orbits) — `domain/orbit_classes.py`, not started
- Kessler debris-field statistical generation — how NASA's ORDEM or ESA's MASTER models generate synthetic debris distributions, for a more realistic (but still clearly labelled `source_type=simulation`) swarm

## 2. Known open engineering issues (need a real answer, not a workaround)

- **Issue #17** — is there a newer `sgp4` PyPI release, or a documented way to call `Satrec.sgp4init()` directly, that lifts the `NORAD_CAT_ID > 339999` cap? Check the `python-sgp4` GitHub issues/changelog.
- Whether `satellite.js`'s `json2satrec()` shares the same >339999 ceiling on the frontend path (untested)
- **Issue #19** — search external sources (or Fenil's own `C:\orcas\` documents) for the original classifier training script/dataset that would reconcile the paper's Table I (velocity/eccentricity/altitude/inclination, 2 classes) against the shipped `.joblib` (inc/ecc/mean-motion/bstar, 3 classes)
- `satellite.js` v7 **bulk propagation API (WASM)** — real benchmark numbers (claimed 3–12× over a `propagate()` loop), API shape, browser support baseline (Node 20.19+/22.13+/24+ — does that map to browser WASM support concerns?)

## 3. 3D asset pipeline (Phase 2, deferred half)

- **NASA 3D Resources** catalog — confirm public-domain model availability for each named object: ISS, Hubble, Tiangong, GPS satellite, Iridium (generic), Sentinel, Envisat, Terra, Aqua, Landsat
- Model availability for **Starlink** (SpaceX doesn't publish official CAD; research legitimate open alternatives) and for the historical pair **Iridium 33 / Cosmos 2251** (likely no bespoke model exists — research whether a class-generic substitute is the honest fallback)
- `gltf-transform` CLI — prune/dedupe/weld pipeline docs, exact commands for glTF 2.0 optimization
- Draco geometry compression — encoder settings/tradeoffs (compression level vs. decode cost)
- KTX2 / Basis Universal texture pipeline — `toktx`/`basisu` CLI usage, GPU-native format support matrix across browsers
- Real Earth textures — 8k day/night/normal/specular map sourcing (NASA Visible Earth / Blue Marble), licensing terms, since `Earth.tsx` is currently a flat placeholder mesh (flagged directly in `Design.md` §9)
- Licence-recording format/precedent for a public-domain asset manifest (what NASA's own terms require you to state)

## 4. Frontend rendering & performance (Phase 4)

- React-Three-Fiber **`<Instances>`/`<Merged>`/`<Detailed>`** (drei) — exact APIs for the tier-2/tier-3 LOD strategy (instanced mesh, GPU point sprites)
- `<PerformanceMonitor>` (drei) — API for adaptive LOD tier switching driven by measured frame rate
- Logarithmic depth buffer + camera-relative-origin pattern in Three.js/R3F — reference implementations for the 10⁵-range Earth↔Solar-System scale problem (needed now per `Architecture.md` even though Phase 7 is deferred)
- Additive-blending volumetric density-heatmap techniques in Three.js (for the debris density heatmap port)
- Mobile WebGL2 support matrix (Safari iOS version floor, Android GPU tiers) and `dpr` capping strategy for the mobile performance path
- Cross-browser `backdrop-filter` current support state — re-verify Safari specifically (P3 flagged this as never live-tested; Claude-in-Chrome was down for that pass)

## 5. Camera & interaction systems (Phase 4)

- Camera focus-flight patterns: Earth-centric → object-centric transition (~900ms, interruptible mid-flight) — reference implementations (NASA Eyes' own approach, `drei`'s `CameraControls` vs hand-rolled tweening)
- Ground-track projection onto a rotating Earth — math/reference for correct real-time projection
- Historical replay UX — how to detach a simulation clock from wall-clock time cleanly (already partly solved in the backend's "time-decoupled reconstruction"; frontend equivalent needed)

## 6. Design — remaining open questions

- **Debris-swarm visual labelling** (`UI-Research.md` §6, still explicitly open) — how to make "simulated, not tracked" unmistakable without a dismissible toast; prior art from other sim/game UIs that label synthetic vs. real data persistently
- Deuteranopia/full colour-vision-deficiency verification beyond the already-done Brettel/Viénot matrix check, if a broader accessibility pass is wanted later

## 7. Testing, QA, accessibility (Phase 5)

- Lighthouse CI integration patterns for enforcing a performance/accessibility budget automatically (`Rules.md` names this as a P5 deliverable, not yet wired)
- Real-device testing services/checklists for mid-range Android + iPhone (since this needs actual hardware, not just DevTools emulation)
- `prefers-reduced-motion` handling audit — any gaps once the full P4 UI (not just `/design`) exists

## 8. Machine learning (unblocking issue #19, longer-term)

- scikit-learn `RandomForestClassifier` — Gini feature-importance computation, to confirm the shipped model's real importances (ecc 0.474/bstar 0.236/inc 0.232/mm 0.058) are computed correctly, independent of matching the paper
- If retraining is ever approved (ask-first boundary): current best-practice orbital-object classification feature sets in the literature, for comparison against both the paper's and the shipped model's choices

## 9. Phase 7 — Solar System (future, but architecture decided now)

- JPL SPICE / `de421.bsp` planetary ephemeris kernel — Python bindings (`spiceypy` or `skyfield`'s own SPICE support), licensing, file size
- Seamless heliocentric ↔ geocentric camera-scale transition — prior art (NASA Eyes on the Solar System's own technique, since it's the named UX reference)

## 10. Passive / tracking

- IEEE Xplore listing for Paper ID 1849 / ISBN 979-8-3315-8087-2 — watch for indexing, to add the DOI
