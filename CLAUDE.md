# CLAUDE.md

Guidance for Claude Code (and any AI agent) working in this repository.

---

## 🚦 Read this first

**Before anything else, read these two files, in order:**

1. `ORCAS Vault/00 - Meta/memory.md` — current state. Where the last session stopped, what's done, what's in flight.
2. `ORCAS Vault/00 - Meta/Rules.md` — the working contract. Libraries, hard bans, error handling, boundaries.

Then confirm in two lines what you understand the current state to be.

At the **end** of every session, update `memory.md`. `/sync` is an explicit instruction to do so — procedure in `Rules.md`.

> ⚠️ **The project was restructured on 2026-07-27.** Backend rebuilt from scratch, frontends consolidated to one, everything containerised, product redefined. Documentation written before that date is superseded. If something in the code contradicts the vault, **the vault wins** — the code has not caught up yet.

---

## What this is

**ORCAS — an interactive, browser-based space simulation platform** for exploring satellites and orbital objects in real time. Reference experience: NASA's *Eyes on Earth*. Visual identity: Apple **Liquid Glass**, entirely original.

Underneath it is a peer-reviewed conjunction-assessment engine. Instead of measuring the distance between two satellites and alerting below a threshold, it carries each object's *positional uncertainty* (its covariance matrix) through the whole pipeline and computes an actual **probability of collision**.

On 10 February 2009, deterministic screening predicted Iridium 33 and Cosmos 2251 would miss by **over 500 metres**. They collided at 11.7 km/s. ORCAS reconstructs that event from historical element sets and correctly flags it as critical. That reconstruction is the project's validation and its headline result.

There is an **accepted, IEEE-sponsored paper** behind this — `ORCAS Vault/04 - Research/ORCAS Research Paper.md`.

### ⚠️ Two properties — roles swapped 2026-08-13

| | What | Deploys? | State |
| --- | --- | --- | --- |
| 🌍 **Portfolio** | ⭐ **THE shipped public product.** Astro site + a cut-down ORCAS demo island. | ✅ Cloudflare Pages | 🔴 Ships first |
| 🛰️ **ORCAS Simulation** | Personal tool — the full 3D platform | ❌ **`localhost` only** | 🟡 Being rebuilt, no deadline |

**This inverts the earlier plan.** The simulation is no longer public, which means **most free-tier constraints in this repo no longer apply**: no 0.5 GB database ceiling, no 25 MiB texture cap, no cold starts, and `data/` (124 MB) can be used freely on local disk. Only the portfolio — a static site — carries deployment limits. Don't reintroduce the old ones.

They share `packages/orcas-physics` (pure TS) and `packages/orcas-scene` (R3F). **Neither may depend on the other at runtime** — the demo island never calls the backend.

---

## ⚠️ Facts you will get wrong if you skip this

1. **The paper is ACCEPTED and PRESENTED — three distinct states, don't collapse them.**
   ICSSIT 2026, **Paper ID 1849**, technically sponsored by the **IEEE SMC Society**. Accepted 24 Jun 2026. Copyright transferred, registration paid, **presented online 28 Jul 2026** (talk delivered, certificate received). The paper is now in the **camera-ready conference proceedings** — real page range (pp. 1769–1774), ISBN 979-8-3315-8087-2, DVD part CFP26P17. It is **not yet indexed on IEEE Xplore** (checked 28 Jul 2026) — that typically lands weeks to months after the conference closes.
   Say "accepted, presented, in the conference proceedings" — never bare "published" and never claim an Xplore listing that doesn't exist yet. Full breakdown: `ORCAS Vault/04 - Research/ORCAS Research Paper.md#Publication record`.
   *(Paper ID **1655** is a separate, earlier CMT submission to a **different** conference. Never use it for ICSSIT.)*

2. **Six authors.** Fenil Miteshkumar Modi is first author, with Satvik V Khara, Gaurav D Tivari, Jay Patel, Prathmesh Patel and Gautam Kumawat — Department of Computer Engineering, Silver Oak University, Ahmedabad.
   Fenil did all the implementation work, and that can be claimed *specifically* — but the published byline lists six names, so **never write "sole author" or "solo project"**. Approved wording: `Open-Questions.md#Decided`, Q3.

3. **Never invent a number.** Every figure must trace to the paper or to code in this repo. Do not round, rephrase or "improve" a result. If uncertain, say so.

4. ⚠️ **`frontend-3d`'s physics is fake.** Its `useSGP4Propagator` is `angle += speed` with `velocity = 7.66 - sin(angle*2)*0.25`. It never imports `satellite.js`. It is **deleted, nothing salvaged**. `frontend-three` is the real implementation — `twoline2satrec`, `propagate`, `gstime`, `eciToGeodetic`.

5. ⚠️ **OMM is the canonical orbital-data format. TLE is a legacy import adapter only.**
   CelesTrak exhausted 5-digit catalog numbers on **2026-07-11**; new objects get 6-digit IDs (100000+) with **no TLE representation**. Ingest **OMM JSON**. Store `norad_id` as **VARCHAR**, never INTEGER.
   **Both propagators take OMM natively** — `satellite.js json2satrec()` (v6.0.0+) on the client, Python `sgp4 omm.initialize()` on the server. Neither needs TLE text. Never let a library's parser dictate the schema.
   ⚠️ `satellite.js` v7 is **ESM-only**; `propagate` returns `null` on failure; `ndot`/`nddot` units changed from rev/day to rad/min. Full detail: `Data-Strategy.md#⭐ The canonical orbital-data model`.

6. ✅ **Only the portfolio deploys**, and it is a static Astro site on **Cloudflare Pages** — unlimited bandwidth, no card, no database, no backend. One limit to respect: **25 MiB per file**. The **simulation is local**: `docker compose up`, no hosting, no cost, no ceilings. **No Redis** — in-process cache behind a `CacheService` interface. Four compose services, not five.
   *(If the simulation is ever published, re-read `Deployment.md` first: Fly.io has no free tier, Render's free Postgres is deleted at 30 days, R2 needs a card, Supabase pauses when idle, Neon is the right host.)*

6b. **Languages — settled, see `Stack.md`.** Portfolio: **Astro 5 + TypeScript**, ORCAS demo as a React island. Both frontends: **React 19 + R3F + TypeScript**. Backend: **Python 3.12 + FastAPI** — non-negotiable, because the `.joblib` classifier, `scipy.spatial.cKDTree` and the NumPy/SciPy covariance maths *are* the research. Don't propose unifying on TypeScript; it fails on the ML model.

7. **The old backend is frozen, not maintained.** Don't fix it. It is replaced in Phase 1 and deleted in Phase 6 after parity is proven.

8. **Restructure happens IN PLACE with FRESH git history.** The simulation stays at `C:\VS Code\orcas`; the portfolio gets its own separate folder/repo later. The existing `.git` carries **47 commits and a 217 MiB pack** because `data/` was committed — archive it as a bundle, then start clean history in the same folder. `data/` stays on disk (gitignored), never re-committed.

9. **`backend/.env` is on disk but was NEVER committed** (verified `git ls-files`). Rotate the NASA key as hygiene, but this is not the emergency earlier notes implied. The 217 MiB `data/` in history is the real problem.

---

## Repository layout

### Now (transitional)

> ⚠️ **Audited on disk 2026-08-13 — the previous version of this list was incomplete.** It named 8 items; there are 20+.

```
C:\VS Code\orcas\                 ← 47 commits · 217 MiB pack · data/ IS committed
├─ backend/           🔴 OLD, frozen. Replaced in P1, deleted in P6.
│   └─ .env           ⚠️ on disk, NEVER committed (verified). Rotate anyway.
├─ frontend-three/    🟡 Real SGP4. Foundation for the new frontend. App.jsx = 1,391 lines.
├─ frontend-3d/       ⚫ Fake physics. Delete at P4 start.
├─ frontend/          ⚫ CesiumJS. Delete at P4 end.
├─ ml_models/         ✅ object_classifier.joblib — KEEP
├─ data_analysis/     ⭐ generate_ml_plots.py — PRODUCES THE PAPER'S FIGURES. Keep.
├─ assets/            figures · generations · models · screenshots · textures
├─ models/            iss.obj / iss.mtl — early 3D assets
├─ tests/             sample.tle, test_orbit_predictor.py, test_time_steps.py
├─ tools/             fix_backend_imports.py — one-off script
├─ data/              ⚠️ 124 MB, 117 files COMMITTED. Keep on disk, drop from git.
├─ ORCAS Vault/       ⭐ the specification
├─ CLAUDE.md · README.md · LICENSE
├─ Dockerfile · docker-compose.yml · run_docker.bat/.sh   (old, superseded)
├─ pyproject.toml · requirements.txt                       (old, superseded by uv)
└─ .venv/ · .vs/ · .vscode/ · .dockerignore · .gitignore

C:\orcas\             separate documents folder (not a repo)
├─ ICSSIT 2026 Paper (Camera-Ready).pdf · Certificate.pdf · Receipt.pdf
├─ ORCAS - ICSSIT 2026 Presentation (Paper ID 1849).pptx
├─ project figures/
└─ orcas related research/
```

**Two corrections from that audit:**

1. ✅ **`backend/.env` was never committed to git.** It exists in the working tree only — `git ls-files` finds no `.env`. The earlier "🔴 High — secret heading into a public repo" framing was wrong. Rotating the NASA key is still sensible hygiene; it is not an emergency.
2. 🔴 **`data/` *is* committed** — 117 files including `de421.bsp`, pack size **217 MiB**. This, not `.env`, is the real reason the history should not be carried forward.

### Target

```
orcas/
├─ portfolio/         🌍 Astro 5 — THE public site (deploys)
├─ frontend/          🛰️ React 19 + R3F + Vite — simulation UI (local)
├─ backend/           🛰️ FastAPI — api / services / domain / infra (local)
├─ packages/
│  ├─ orcas-physics/  ⭐ pure TypeScript — shared by BOTH frontends
│  └─ orcas-scene/    ⭐ R3F components — shared by BOTH frontends
├─ workers/           ingestion
├─ infra/docker/      Dockerfiles
├─ scripts/           asset pipeline, snapshot baking, demo-snapshot baking
├─ ml_models/
├─ ORCAS Vault/
├─ docker-compose.yml
└─ .env.example
```

**One physics implementation, two consumers.** Never write a second propagator for the portfolio — divergence there is a correctness failure, not a duplication annoyance.

### The vault is the specification

| Note | Covers |
| --- | --- |
| `00 - Meta/memory.md` | ⭐ current state — **read first** |
| `00 - Meta/Rules.md` | ⭐ libraries, bans, error handling, AI boundaries, `/sync` |
| `00 - Meta/Prompting.md` | how to structure work here |
| `00 - Meta/Git-Workflow.md` | branches, commits, the secret audit |
| `00 - Meta/Open-Questions.md` | decisions owed, decisions made |
| `01 - Product/PRD.md` | what to build, for whom, features |
| `01 - Product/Phases.md` | P0–P7 with completion criteria |
| `01 - Product/Data-Strategy.md` | ⚠️ TLE deprecation, storage, static vs dynamic, CDN |
| `02 - Design/Design.md` | Liquid Glass, colour, type, motion, layout |
| `02 - Design/Branding.md` | orca metaphor, the mark, logo animation, voice |
| `02 - Design/UI-Research.md` | NASA Eyes analysis, glass technique, anti-patterns |
| `03 - Engineering/Stack.md` | ⭐ languages and frameworks, and why the alternatives lost |
| `03 - Engineering/Architecture.md` | system design, layering, data model, scale strategy |
| `03 - Engineering/Docker.md` | containerisation, compose, the one-command rule |
| `03 - Engineering/Deployment.md` | free-tier hosting, domains, checklist |
| `04 - Research/ORCAS Research Paper.md` | the paper, maths, numbers |
| `04 - Research/Conference - ICSSIT 2026.md` | talk logistics |
| `04 - Research/Presentation Prep.md` | revision pack, Q&A |
| `04 - Research/Glossary.md` | SGP4, TLE, OMM, B-plane, P_c, Mahalanobis, Kessler |

When implementing, **cite the governing note** rather than guessing.

---

## The science (this is the research contribution)

```
C_c     = C_p + C_s                    combine primary + secondary covariance at TCA
C_ECEF  = J · C_ECI · Jᵀ               rotate uncertainty with the Earth (GMST Jacobian)
C_B     = P · C_c · Pᵀ                 project onto the B-plane (⊥ relative velocity)
D_M     = √( rᵀ C_B⁻¹ r )              Mahalanobis — separation in σ, not km
P_c     = 1/(2π√|C_B|) ∬_A exp(−½ rᵀ C_B⁻¹ r) dx dy
```

Alert threshold `P_c > 1.0 × 10⁻⁴`. The integral is approximated asymptotically — it cannot be solved analytically at 60 FPS. Broad-phase spatial hashing (`cKDTree`) reduces O(N²) → ~O(N log N).

### Verified results — quote exactly

**2009 Iridium 33 / Cosmos 2251, T₀ = 2009-02-10 16:56:00 UTC:**

| | Iridium 33 | Cosmos 2251 |
| --- | --- | --- |
| Altitude | 788.6 km | 788.6 km |
| Lat / Lon | 72.51 N / 97.90 E | 72.51 N / 97.90 E |
| Velocity | 7.46 km/s | 7.42 km/s |
| det(C) | 2.4 × 10⁴ km² | 4.1 × 10⁴ km² |
| **D_M** | — | **1.84** |
| **P_c** | — | **4.2 × 10⁻³** |
| Classification | — | **CRITICAL ALERT** |

Relative velocity **11.7 km/s**. Deterministic prediction: **>500 m miss**.

**ML:** ROC AUC **0.94** (Random Forest) vs **0.70** (deterministic). Feature importance: velocity 0.40 · eccentricity 0.25 · altitude 0.20 · inclination 0.15. Matrix: 745 / 45 / 25 / 185.

---

## Architecture

### Backend — FastAPI, strictly layered

```
app/
├─ api/        HTTP only. No physics, no SQL.
├─ services/   Orchestration.
├─ domain/     ⭐ PURE. No I/O, no framework imports. Physics lives here.
├─ infra/      DB, cache, CelesTrak client, storage, ML loader.
└─ workers/    Scheduler + ingestion.
```

**The layering rule:** `domain/` imports nothing from `api/`, `infra/` or FastAPI. Pure functions over dataclasses, unit-testable without a database or network. **This is what the old backend lacked and why it was unstable.**

Old backend failures and their fixes:

| Old | New |
| --- | --- |
| CelesTrak fetch *inside request handlers* | Background worker, scheduled |
| Blocking I/O in async paths | Async throughout |
| No layering | `api → services → domain`, `infra` at the edge |
| Config scattered | One `Settings` (pydantic-settings) |
| `allow_origins=["*"]` | Explicit allowlist |
| No tests | ≥70% on domain and services + a golden-file test reproducing the paper's numbers |

### Frontend — React 19 + R3F + TypeScript

```
src/
├─ scene/     everything inside <Canvas>
├─ ui/        everything outside <Canvas>
├─ physics/   ⭐ PURE TypeScript. No React. satellite.js wrapper, coordinates.
├─ data/      snapshot loader, typed API client, asset resolution
└─ state/     Zustand stores
```

`scene/` and `ui/` never import each other — they communicate through `state/`.

### Two decisions that must not be retrofitted

1. **Scale strategy.** Earth radius 6,371 km; Earth–Sun 1.5 × 10⁸ km. That range destroys float32 depth precision. Logarithmic depth buffer, camera-relative origin, nested scale contexts — designed in Phase 4 so the Solar System view (Phase 7) doesn't require a rewrite.
2. **Static-snapshot-first.** The client boots from a compressed snapshot on the CDN and propagates locally. **The scene never waits on the backend.** If the API is asleep, the simulation still runs.

---

## Commands

```bash
# Everything
docker compose up
docker compose up --build

# Backend
docker compose run --rm backend pytest
docker compose run --rm backend ruff check .
docker compose run --rm backend mypy app/domain app/services
docker compose run --rm backend alembic upgrade head
docker compose run --rm backend alembic revision --autogenerate -m "msg"

# Frontend
docker compose run --rm frontend npm run lint
docker compose run --rm frontend npm run build
docker compose run --rm frontend npm run test

# Ingestion, one-off
docker compose run --rm worker python -m app.workers.tasks.ingest_gp --once

# Logs / shell
docker compose logs -f backend
docker compose exec backend bash
```

**`docker compose up` must produce a working system in one command.** If a contributor needs a second step, setup is broken.

---

## Conventions

**Python:** ruff (lint + format) · type hints everywhere · `mypy --strict` on `domain/` and `services/` · docstrings on every public function, and **every physics function states units and reference frame** · custom exception types, never bare `except`.

**TypeScript:** `strict`, no `any` · files `kebab-case.tsx`, components `PascalCase`, hooks `use-thing.ts` · named exports · **no file over 250 lines** · never update React state every frame — refs and `useFrame`.

**Units and frames.** Every physical quantity carries its unit; every coordinate transform names input and output frames:

```python
def eci_to_ecef(position_km_eci: np.ndarray, gmst_rad: float) -> np.ndarray:
    """Rotate an ECI position vector into ECEF. Input km, output km."""
```

**Commits:** Conventional Commits. `feat(scope): imperative summary`, no full stop, under 72 chars. Never `wip`, `update`, `commit message`.

**Design tokens:** all colour in `styles/tokens.css`. Never a hex literal in a component.

```css
--void: #04070F   --orca-cyan: #00E5FF   --critical: #FF3B30
--glass-fill: rgba(12,20,34,.55)   --glass-blur: 24px
```

Fonts: **Plus Jakarta Sans** (UI) + **JetBrains Mono** (all measurements, `tabular-nums`).

> **The one typographic rule that does most of the work:** every number representing a measurement — altitude, velocity, P_c, coordinates — renders in mono with tabular figures. These values update every frame; proportional digits make the readout jitter.

---

## Hard bans

| ❌ Never | Why |
| --- | --- |
| Network I/O inside a request handler | The old backend's fatal flaw |
| Blocking I/O in an async path | Freezes the event loop |
| `norad_id` as INTEGER | 6-digit and Alpha-5 IDs already exist |
| TLE text as primary ingestion | Being retired upstream |
| React state updated every frame | The classic R3F killer |
| Colour literals outside the token file | Palette drift |
| Files over 250 lines | `App.jsx` at 1,391 is what we're escaping |
| `any` in TypeScript | |
| Bare `except:` / silent `catch {}` | |
| Containers as root | |
| `create_all()` instead of migrations | Schema drift |
| Committing `.env`, keys, or `data/` | Repo is going public |
| Presenting stale data as live | Always show the element-set epoch |
| **Shipping fake physics** | Exactly what `frontend-3d` did |
| **Overstating the research** | Highest-consequence rule here |

---

## Boundaries

**Freely:** read anything · write and refactor the new backend/frontend and this vault · run tests, linters, builds, containers · update `memory.md` · disagree and propose alternatives.

**Ask first:** adding any dependency · changing stack or architecture · **deleting anything** (deletions happen at phase boundaries, after parity, with approval) · git history · anything costing money · deploying · sending email · changing publication-status wording · retraining the ML model.

**Never:** overstate the research · invent numbers, citations, venues, dates or benchmarks · commit secrets · modify the paper PDF · imply sole authorship · mark a task complete when it isn't · ship a fake physics implementation.

---

## Error handling

**Never show the user a broken thing.** Every failure degrades to something honest.

| Failure | Behaviour |
| --- | --- |
| Backend unreachable | Scene runs from the static snapshot + visible "data may be stale" pill. **Never blank.** |
| WebGL2 unavailable | Static image + explanation. Never a black canvas. |
| A 3D model fails | Fall back to class-generic, then to an instanced marker |
| CelesTrak fetch fails | Keep the previous snapshot. Stale with an honest epoch beats nothing. |
| Malformed upstream data | Reject at validation. Never write it to the database. |
| Scene component throws | Error boundary around the canvas — UI survives |
| Panel throws | Per-panel boundary — one dies, app survives |
| Database unreachable | `/health/ready` fails; reads serve cache; no 500s to clients |

No `alert()`. No `confirm()`. Errors to clients are typed and safe — never a stack trace or an internal path.

---

## Working style

1. Read `memory.md` first. Always.
2. State the plan before a multi-step change; wait for agreement.
3. Prefer the smallest change that works.
4. **Verify, don't assure.** Run it, render it, read the numbers. "It should work now" is not evidence.
5. Never end a session with the repo in a non-building state.
6. Update `memory.md` before you finish.

---

## Current priorities

> ✅ **2026-08-13 — Q1–Q8 all decided. Nothing blocks Phase 0.** Monorepo · fresh repo · OMM canonical · no Redis · ~30–50 curated models · debris swarm labelled as simulation · `orcas.space`. See `Open-Questions.md#Decided`.

1. 🔴 **Phase 0** — fresh monorepo (both tracks), `.gitignore` before anything else, four-service compose skeleton, `CacheService` stub, CI.
2. 🔴 **Rotate the NASA key.**
3. 🌍 **PA1 — Astro site, deployed early even if ugly.** Prove the pipeline before polishing content.
4. Then PA2 (shared physics) → PA3 (demo island) → **PA4 ship**.
5. 🛰️ Simulation track (P1 backend → P2 data → P4 frontend) at whatever pace suits.
6. Passive: watch for the IEEE Xplore listing; add the DOI when it appears.

**Order note:** the portfolio ships first because it is finishable and it is what's needed soon. Building the demo island early also de-risks the simulation — it proves the shared physics package at small scale before the full frontend depends on it.
