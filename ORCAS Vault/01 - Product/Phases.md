---
title: Phases
type: product
updated: 2026-08-13
status: active
---

# Phases

> ⚠️ **Rewritten 2026-07-27** for the restructuring: new backend, single frontend, full containerisation.
>
> 🔴 **Resequenced 2026-08-13.** The project split into a **public portfolio** and a **local-only simulation** ([[PRD]]). **The portfolio now ships first**, as its own track, and does not wait for the simulation.
>
> Each phase lists objectives, deliverables, completion criteria and dependencies. **Do not start a phase until its dependencies pass their completion criteria.**

**Related:** [[Stack]] · [[PRD]] · [[Architecture]] · [[Docker]] · [[Data-Strategy]] · [[Design]] · [[memory]]

---

## Two tracks

The point of the split is that these run **independently**. The portfolio is small, finishable, and public; the simulation is large, open-ended, and private. Coupling them means nothing ships until everything does.

```
       P0 Foundation  (monorepo, tooling, CI)
              │
       P3 Design System  (tokens, glass, logo — feeds BOTH tracks)
              │
      ┌───────┴────────────────────────────────────┐
      │                                            │
🌍 PORTFOLIO TRACK  ── ships in weeks        🛰️ SIMULATION TRACK ── takes as long as it takes
      │                                            │
  PA1 Astro site + content                    P1 Backend (FastAPI)
      │                                            │
  PA2 Shared physics package ◀────────────────▶ P2 Data layer
      │           (the one real coupling)          │
  PA3 Demo island (R3F, baked snapshot)        P4 Frontend consolidation
      │                                            │
  PA4 ⭐ DEPLOY — the public milestone          P5 Polish + Solar System (P7)
```

**The only shared code is `packages/orcas-physics` and the R3F scene components** ([[Stack#4. Shared code between the two properties]]). PA3 needs those to exist, which is why PA2 sits where it does — but it does *not* need the backend, the database, or the full catalogue.

### Why the portfolio goes first

1. It is **finishable**. Weeks, not months.
2. It is what you actually need soon — applications, recruiters, a link to send people.
3. It **de-risks the simulation**: building the demo island first proves the shared physics package and the scene components work, at small scale, before the full frontend depends on them.
4. Nothing about it is wasted. The demo island *is* the simulation's scene layer, in miniature.

> ⚠️ **The trap to avoid:** letting the portfolio grow into the simulation. The demo island is a few hundred objects, a baked snapshot, and no backend. If you find yourself adding conjunction screening to the portfolio, stop — that belongs in the simulation.

---

## Phase 0 — Foundation and decisions

**Objective:** clear the ground and remove every ambiguity that would stall later work.

> [!success] ✅ **All blocking decisions were made on 2026-08-13.** Q1–Q8 are answered ([[Open-Questions#Decided]]). Phase 0 is now purely mechanical — no decisions left to make, just setup.

### Deliverables

**Repository — restructure IN PLACE, fresh history ([[Open-Questions#Decided]] Q5b)**

> 🔴 **Prompt ready: [[Prompt - Simulation Restructure]]** — backup-first, with three checkpoints.
> The audit found **47 commits, a 217 MiB pack, and `data/` committed (117 files)**. `.env` was never committed.

- [ ] `git bundle create ../orcas-history-archive.bundle --all` — **verify it before anything else**
- [ ] Write `.gitignore`, then `rm -rf .git && git init` in the **same folder**
- [ ] Inspect `git status` before the first commit — no `.env`, no `data/`, no `legacy/`, no `.venv/`
- [ ] Simulation monorepo layout:
  ```
  frontend/           React 19 + R3F + Vite — the simulation UI
  backend/            FastAPI — local only
  packages/
    orcas-physics/    pure TypeScript  ⭐ npm-published later for the portfolio
    orcas-scene/      R3F components   ⭐ same
  workers/  infra/docker/  scripts/analysis/  ml_models/  docs/figures/
  data/ (gitignored)  data/sample/ (committed)  legacy/ (gitignored)
  ORCAS Vault/
  ```
- [ ] ⭐ **Preserve:** `ml_models/object_classifier.joblib` (checksum it), `data_analysis/` → `scripts/analysis/` (**it generates the paper's figures**), `assets/figures/` → `docs/figures/`, test fixtures
- [ ] Move `frontend-three/` and the old `backend/` to `legacy/` — **do not delete**; P4 salvages from them

> **The portfolio is NOT scaffolded here.** It gets its own folder and repo at PA1.
- [ ] `.gitignore` from commit one, including `data/tle/`, `data/ephemeris/`, `data/raw/`, `data/cache/`, `.env`
- [ ] Commit a **small representative sample dataset** for dev and tests — a few dozen objects, not 124 MB
- [ ] Port across only what is being kept: `ml_models/object_classifier.joblib`, the vault, and anything explicitly salvaged from `frontend-three`
- [ ] ⚠️ **Rotate the NASA key** before the first push. The old `backend/.env` is in the old working tree ([[Git-Workflow]]).

**Scaffolding**

- [ ] `docker-compose.yml` skeleton — **four services** (`frontend`, `backend`, `worker`, `postgres`); no Redis ([[Docker#Services]])
- [ ] `CacheService` interface + `MemoryCache` implementation stubbed, so nothing ever imports a cache client directly
- [ ] CI skeleton: lint + typecheck + test on push
- [ ] GitHub Actions cron workflow stub for ingestion (replaces an always-on scheduler in production)

### Completion criteria
`docker compose up` starts four containers that report healthy and do nothing else. The repo is clean — `git count-objects -vH` shows a small repository, because nothing large was ever committed. Reproducible on a clean machine.

**Dependencies:** none.

---

# 🌍 Portfolio track

> Ships first. Depends on P0 and P3 (design tokens). **Does not depend on the backend, the database, or the full catalogue.**

---

## Phase PA1 — Astro site and content

**Objective:** a deployable static site with real content, before any 3D work.

### Deliverables
- [ ] Astro 5 + TypeScript project in `portfolio/` ([[Stack#1. Portfolio → Astro]])
- [ ] Tailwind v4 wired to the shared `tokens.css` from [[Design]]
- [ ] Content collections (MDX) with type-safe frontmatter
- [ ] Pages: home · `/research` · `/projects/orcas` · `/cv` · 404
- [ ] ⭐ **The ORCAS research write-up** — the paper, the figures, the 2009 result, and the publication status stated exactly per [[ORCAS Research Paper#Publication record]]
- [ ] Contribution statement using the approved wording ([[Open-Questions#Decided]] Q3)
- [ ] SEO: sitemap, RSS, OG cards, JSON-LD `Person` + `ScholarlyArticle`
- [ ] Deployed to Cloudflare Pages — **even with placeholder styling.** Get the pipeline working early.

### Completion criteria
The site is live on `pages.dev`, Lighthouse ≥ 90 / 100 accessibility, every factual claim about the paper verified against the source documents. **Zero JavaScript shipped on content pages.**

**Dependencies:** P0. Design tokens from P3 are desirable but the site can ship and be restyled.

---

## Phase PA2 — Shared physics package

**Objective:** one propagation implementation, usable by both properties.

> This is the phase that makes the split safe. Two implementations of orbital propagation will silently diverge; one will not.

### Deliverables
- [ ] `packages/orcas-physics/` — **pure TypeScript, no React, no DOM**
- [ ] `satrecFromOmm()` wrapping `json2satrec` ([[Data-Strategy#⭐ The canonical orbital-data model]])
- [ ] `propagate()` → position/velocity at time `t`
- [ ] Coordinate transforms: ECI → ECEF → geodetic, GMST — **each stating units and reference frame** ([[Rules#Units and frames — a project-specific rule]])
- [ ] Typed `OmmRecord`, `SatState`
- [ ] `checkForDecay()` integration so dead objects don't render at garbage positions
- [ ] **Unit tests with no browser and no React** — including a known-position regression case
- [ ] `packages/orcas-scene/` — `Earth`, `Satellites`, `OrbitPath`, `Starfield` as R3F components

### Completion criteria
`orcas-physics` tests pass in isolation under Vitest. A known satellite propagates to a verified position. Nothing in the package imports React.

**Dependencies:** P0.

---

## Phase PA3 — The demo island

**Objective:** a live, interactive ORCAS demo embedded in the portfolio, with no backend.

### Deliverables
- [ ] `bake_demo_snapshot.py` — produces a **< 200 KB gzipped** snapshot of a few hundred notable objects
- [ ] React island in Astro, **lazy-hydrated** (`client:visible`) so it never blocks page load
- [ ] Earth + satellites + orbit paths, using `packages/orcas-scene`
- [ ] Click an object → a small info panel (name, NORAD ID, altitude, velocity, orbit class)
- [ ] ⚠️ **Visible element-set epoch** — the snapshot is static and must never look live ([[Rules#Hard bans]])
- [ ] Graceful WebGL2 fallback: a static rendered image, never a black canvas
- [ ] Mobile: 30 FPS floor, touch controls
- [ ] `prefers-reduced-motion` respected

### Completion criteria
The demo runs at 60 FPS desktop / 30 FPS mobile **with Docker stopped** — proving zero backend dependency. Content pages still ship zero JS. The island is under 300 KB gzipped before the 3D chunk.

**Dependencies:** PA1, PA2.

---

## Phase PA4 — ⭐ Public launch

**Objective:** the portfolio is live and correct. **This is the first real milestone of the whole project.**

### Deliverables
- [ ] Everything in [[Deployment#Pre-launch checklist — portfolio]]
- [ ] Landing sequence + logo animation ([[Branding#Logo animation]]) — **skippable, ≤ 4 s**
- [ ] Tested on a real mid-range Android and a real iPhone
- [ ] Safari verified (`backdrop-filter` is the usual glass casualty)
- [ ] **A second person reads it and can say what you built and what the paper claims**

### Completion criteria
Live, fast, accurate, accessible, costing nothing. Every paper claim survives checking.

**Dependencies:** PA3.

---

# 🛰️ Simulation track

> Local-only. No deadline, no hosting, no free-tier constraints. Correctness outranks everything.

---

## Phase 1 — New backend

**Objective:** a correct, tested, typed FastAPI service that replaces the old backend entirely.

> The old backend stays untouched and unused during this phase. It is deleted only in Phase 6, after parity is proven.

### Deliverables
- [ ] Project skeleton per [[Architecture#Backend structure]] — `api / services / domain / infra` layering
- [ ] Typed settings via `pydantic-settings`; **all config in one place**
- [ ] Structured JSON logging with request IDs
- [ ] Health endpoints: `/health/live`, `/health/ready`
- [ ] `GET /api/v1/objects` — paginated, filterable catalogue
- [ ] `GET /api/v1/objects/{id}` — full detail
- [ ] `GET /api/v1/objects/{id}/ephemeris` — propagated track over a window
- [ ] **OMM ingestion worker** — pulls CelesTrak **OMM JSON**, validates, normalises to the canonical record, upserts, records epoch ([[Data-Strategy#⭐ The canonical orbital-data model]])
- [ ] **TLE legacy adapter** — parses 5-digit TLE into the *same* canonical record. Import path only; never the primary format.
- [ ] Propagation service wrapping `sgp4` (`omm.initialize`) / Skyfield with explicit error handling
- [ ] ML classification service loading the existing `.joblib` model
- [ ] Conjunction service — the covariance / Mahalanobis / P_c pipeline from the paper
- [ ] OpenAPI schema published and accurate
- [ ] **Test suite: unit for domain logic, integration for endpoints, ≥ 70% coverage on `domain/` and `services/`**
- [ ] Golden-file test: propagating the 2009 Iridium/Cosmos TLEs reproduces the paper's D_M = 1.84 and P_c = 4.2 × 10⁻³

### Completion criteria
Every endpoint returns correct, typed data under test. The golden-file test passes. `docker compose up` starts it. **No endpoint may 500 on malformed input.**

**Dependencies:** P0.

---

## Phase 2 — Data layer

**Objective:** decide, build and populate the storage that feeds everything.

### Deliverables
- [ ] Database schema implemented and migrated (Alembic) — see [[Architecture#Data model]]
- [ ] Ingestion from CelesTrak **OMM/JSON**, not legacy TLE ([[Data-Strategy#The TLE deprecation]])
- [ ] Historical element-set retention policy implemented
- [ ] Static snapshot generator — the bundle the frontend loads instantly
- [ ] 3D model pipeline: source → glTF → Draco → KTX2 textures → object storage
- [ ] **Curate the ~30–50 bespoke models in three tiers** ([[Open-Questions#Decided]] Q6): T1 recognisable craft (ISS, Hubble, Tiangong, Starlink, GPS, Iridium, Sentinel, Envisat, Terra, Aqua, Landsat) · T2 demo objects incl. **Iridium 33 and Cosmos 2251** · T3 class-generic (payload / rocket body / debris)
- [ ] **Licence record for every bespoke asset** — `asset_id, object_name, source, author, licence, source_url, modifications, commercial_use_allowed, attribution_required`. No asset ships without one.
- [ ] Asset manifest with content hashes and LOD tiers
- [ ] CDN/object storage configured (Cloudflare R2 — 10 GB free, zero egress)
- [ ] `CacheService` + `MemoryCache` implemented per [[Data-Strategy#Static vs dynamic]] — **no Redis** ([[Open-Questions#Decided]] Q8)

### Completion criteria
A cold client can render the full active catalogue from the snapshot in under 3 seconds, with zero backend calls. Ingestion runs on schedule without manual intervention.

**Dependencies:** P1.

---

## Phase 3 — Design system *(parallel with P1–P2)*

**Objective:** a complete, documented visual language before any production UI is written.

### Deliverables
- [ ] Token file — colour, spacing, radii, blur, elevation, motion curves ([[Design]])
- [ ] Liquid Glass material spec, implemented and tested against a moving 3D background
- [ ] Typography scale and the mono-for-measurements rule
- [ ] Component inventory: panel, HUD readout, control cluster, search, timeline scrubber, object card
- [ ] **ORCAS logo — final** ([[Branding]])
- [ ] Logo animation storyboard and implementation
- [ ] Landing sequence storyboard
- [ ] Motion guidelines including full `prefers-reduced-motion` behaviour
- [ ] Accessibility contrast audit of glass surfaces over live 3D

### Completion criteria
Every component exists in isolation, verified against a moving backdrop, and passes contrast checks. The logo is final and animatable.

**Dependencies:** P0.

---

## Phase 4 — Single frontend

**Objective:** one production frontend, evolved from `frontend-three`, structured properly.

> **`frontend-3d/` is deleted at the start of this phase.** Its propagator is fake ([[PRD#Why rebuild rather than continue]]); nothing is salvaged. `frontend/` (Cesium) is deleted at the end.

### Deliverables
- [ ] New frontend structure created fresh per [[Architecture#Frontend structure]]
- [ ] **`App.jsx` decomposed** — the 1,391-line monolith split into modules. Nothing over 250 lines.
- [ ] Migrate to TypeScript, `strict: true`
- [ ] Real SGP4 propagation preserved exactly — `satellite.js`, unchanged behaviour
- [ ] Scene: Earth, atmosphere, terminator, starfield
- [ ] Object rendering with LOD tiers and instancing
- [ ] 3D model loading with Draco + KTX2
- [ ] Camera system: orbit, focus, follow, scale transitions
- [ ] Time controls: pause, rate, scrub, jump-to-now
- [ ] Selection and the information panel
- [ ] Search and filter
- [ ] Design system applied throughout
- [ ] Landing sequence integrated
- [ ] Feature ports from old `frontend-three`: density heatmap, Kessler swarm, historical replay, CSV export
- [ ] ⚠️ **Kessler swarm ships with an unmistakable simulation label** ([[Open-Questions#Decided]] Q7). Persistent, not a dismissible toast. Backed by `source_type = "simulation"` in the data model so synthetic objects can never enter screening ([[Data-Strategy#9.6 `source_type` — keeping simulation out of the real pipeline]]).
- [ ] `satellite.js` pinned to **v7.x**; account for the v6→v7 breaking changes when porting ([[Data-Strategy#9.5 ⚠️ `satellite.js` v7 — breaking changes to budget for]])
- [ ] Evaluate the v7 **WASM bulk-propagation API** against the `propagate` loop — measure, don't assume
- [ ] Wire `checkForDecay()` so long-decayed objects don't render at garbage positions
- [ ] Mobile layout and performance path
- [ ] `frontend/` (Cesium) deleted

### Completion criteria
60 FPS desktop with the full catalogue at LOD. 30 FPS on a real mid-range phone. Only one frontend folder exists. No file over 250 lines. No `any`.

**Dependencies:** P1, P2, P3.

---

## Phase 5 — Integration and polish

### Deliverables
- [ ] Portfolio ↔ ORCAS cross-navigation, both directions, both independent
- [ ] Error boundaries and every degradation path from [[Rules#Error handling]]
- [ ] Offline / API-down path verified by actually killing the backend
- [ ] Accessibility pass — keyboard, screen reader, reduced motion
- [ ] Performance budget enforced in CI
- [ ] SEO, metadata, OG cards, JSON-LD
- [ ] Cross-browser: Chrome, Firefox, Safari, Edge
- [ ] Real-device testing on mid-range Android and iPhone

### Completion criteria
Lighthouse ≥ 90 performance, 100 accessibility. Every failure mode degrades visibly and honestly. Works on real hardware, not just DevTools.

**Dependencies:** P4.

---

## Phase 6 — Decommission and open the repo

> 🔴 **No longer a deployment phase.** The simulation is not deployed ([[PRD]]); the portfolio went live back at PA4. What remains is cleanup.

### Deliverables
- [ ] **Parity verification: new backend matches or exceeds old backend on every used capability**
- [ ] ❌ **Delete `backend/` (old).** Only after the above passes.
- [ ] ❌ Delete `frontend-3d/` and `frontend/` (Cesium) if not already gone
- [ ] README rewritten — including honest "this runs locally" setup instructions
- [ ] Secret audit; **NASA key confirmed rotated**
- [ ] Repo made public

### Completion criteria
One backend, one simulation frontend, one portfolio. Old code gone. Repo public and clean. `docker compose up` works from a fresh clone.

**Dependencies:** P5.

> **On making the repo public:** the code going public is not the same as the simulation being deployed. A visitor can read it, clone it, and run it locally — which for a research project is arguably a better outcome than a hosted demo, because it is reproducible.

---

## Phase 7 — Solar System *(future)*

Deferred, but **[[Architecture]] must not preclude it.** Scale strategy, coordinate abstraction and camera system are designed in Phase 4 with this in mind.

- [ ] Heliocentric coordinate layer
- [ ] Planetary ephemeris (SPICE / de421)
- [ ] Seamless Earth-scale ↔ Solar-scale camera transition
- [ ] Planet and moon rendering
- [ ] Interplanetary mission tracks

---

## Progress

| Track | Phase | Status |
| --- | --- | --- |
| Shared | **P0 Foundation** | 🔴 **Next** — [[Prompt - Phase 0 Scaffold]] |
| Shared | P3 Design system | ⚪ Not started |
| 🌍 Portfolio | **PA1 Astro site + content** | ⚪ Not started |
| 🌍 Portfolio | PA2 Shared physics package | ⚪ Not started |
| 🌍 Portfolio | PA3 Demo island | ⚪ Not started |
| 🌍 Portfolio | ⭐ **PA4 Public launch** | ⚪ **First real milestone** |
| 🛰️ Simulation | P1 Backend | ⚪ Not started |
| 🛰️ Simulation | P2 Data layer | ⚪ Not started |
| 🛰️ Simulation | P4 Frontend consolidation | ⚪ Not started |
| 🛰️ Simulation | P5 Polish | ⚪ Not started |
| 🛰️ Simulation | P6 Decommission + open repo | ⚪ Not started |
| 🛰️ Simulation | P7 Solar System | ⚪ Deferred |

**Suggested order:** P0 → PA1 (get something deployed early) → P3 → PA2 → PA3 → **PA4 ship** → then the simulation track at whatever pace suits.

Update this table and [[memory]] at the end of every session.
