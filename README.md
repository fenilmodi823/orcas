# ORCAS — Orbital Risk and Conjunction Assessment System

[![CI](https://github.com/fenilmodi823/orcas/actions/workflows/ci.yml/badge.svg)](https://github.com/fenilmodi823/orcas/actions/workflows/ci.yml)
[![Python 3.12](https://img.shields.io/badge/python-3.12-blue.svg)](https://www.python.org/downloads/)
[![TypeScript](https://img.shields.io/badge/typescript-strict-3178C6.svg)](https://www.typescriptlang.org/)
[![Ruff](https://img.shields.io/badge/lint-ruff-D7FF64.svg)](https://github.com/astral-sh/ruff)

An interactive, browser-based space simulation platform for exploring satellites and orbital
objects, built on a conjunction-assessment engine that propagates **positional uncertainty**
rather than position alone.

Most collision screening measures the distance between two objects and alerts below a threshold.
ORCAS carries each object's covariance matrix through the entire pipeline and computes an actual
**probability of collision**.

> On 10 February 2009, deterministic screening predicted Iridium 33 and Cosmos 2251 would miss by
> **over 500 metres**. They collided at 11.7 km/s. ORCAS reconstructs that event from real
> historical element sets and correctly flags it as critical — that reconstruction is a committed,
> passing test (`backend/tests/golden/test_2009_reconstruction.py`), not a claim.

---

## ⚠️ Project status — read this before evaluating the code

This repository is **under active reconstruction** and is honest about what is and is not built.

| Component | Status |
| --- | --- |
| **Backend** (`backend/`) | ✅ **Complete and tested.** Propagation, covariance, conjunction, ML classification, OMM ingestion, REST API, 100% coverage on `domain/` + `services/`. |
| **Data layer** | 🟡 **Half done.** Ingestion, retention, snapshot generation and the `/catalog` endpoints work. The 3D asset pipeline is not started. |
| **Design system** (`frontend/src/ui/`) | ✅ **Complete.** Tokens, glass material, 12 components, live at the `/design` route. |
| **Simulation frontend** | 🟡 **In progress.** The renderer is being built milestone by milestone on **debug routes**. The root route `/` is still a placeholder scene. |

**The polished single-page app that earlier versions of this README described does not exist.** An
earlier prototype (`frontend-3d`) was deleted in a 2026-08-14 restructure because its "physics" was
`angle += speed` — it never imported an SGP4 implementation at all. Nothing was salvaged from it,
and the features it advertised (Kessler swarm, density heatmaps, CSV export) are **not currently
implemented**. They are ideas, not deliverables, and appear as such in the roadmap below.

This project **runs locally only.** It is not deployed and has no hosted instance.

---

## Table of contents

- [Quick start](#quick-start)
- [What you can actually look at](#what-you-can-actually-look-at)
- [The science](#the-science)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Tech stack](#tech-stack)
- [Development](#development)
- [Testing](#testing)
- [Data sources and the OMM migration](#data-sources-and-the-omm-migration)
- [Research paper](#research-paper)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [References](#references)
- [License](#license)

---

## Quick start

**Requirements:** Docker Desktop. That is the whole list — no Python, Node or Postgres install needed.

```bash
git clone https://github.com/fenilmodi823/orcas.git
cd orcas
cp .env.example .env
docker compose up
```

Then open **<http://localhost:5173/points>**.

That one command must produce a working system. If a second step is ever required, the setup is
considered broken. Four services come up: `postgres`, `backend` (:8000), `worker`, and `frontend`
(:5173). There is no Redis — caching is in-process behind a `CacheService` interface.

The repository ships **21 synthetic sample objects** plus real 2009 Iridium/Cosmos element sets, so
the stack works offline with no API keys. `NASA_API_KEY` in `.env` is optional and unused by the
core simulation.

To pull the live CelesTrak catalogue instead:

```bash
docker compose run --rm worker python -m app.workers.tasks.ingest_gp --once
docker compose run --rm worker python -m app.workers.tasks.bake_snapshot --once
```

---

## What you can actually look at

The real work lives on debug routes. Each corresponds to one completed milestone.

| Route | What it shows |
| --- | --- |
| **`/points`** | ⭐ **Start here.** The whole catalogue as GPU points in a single draw call, Earth-occlusion fade, orbit-class filtering, hover tethers, click-to-select, and the full camera system — click an object to fly to it, `Esc` to return, drag to orbit, wheel to zoom. Includes a camera dev panel and time transport. |
| `/keyframes` | The simulation core — keyframe segments and Hermite interpolation between them. |
| `/propagation` | Raw SGP4 propagation readouts, for checking the physics directly. |
| `/catalog` | Catalogue loading, validation and the IndexedDB cache. |
| `/design` | The design system — tokens, glass surfaces and all 12 components over a live 3D backdrop. |
| `/` | ⚠️ Still the **placeholder** scene (Earth, starfield and the landing sequence). The real renderer moves here once the subsystem is integrated. |

Backend endpoints:

| Endpoint | Purpose |
| --- | --- |
| `GET /health/live` · `GET /health/ready` | Liveness, and readiness including a real database ping |
| `GET /api/v1/objects` | Catalogue search by name or NORAD ID |
| `GET /api/v1/objects/{id}` | One object with its latest element set |
| `GET /api/v1/objects/{id}/ephemeris` | Propagated ephemeris, capped at 5,000 points |
| `GET /api/v1/catalog/snapshot` | The full gzip client bundle |
| `GET /api/v1/catalog/meta` | Object count, newest epoch, generation time |

Interactive API documentation: <http://localhost:8000/docs>.

---

## The science

This is the research contribution, and it lives in `backend/app/domain/` as pure functions over
dataclasses — no I/O, no framework imports, unit-testable without a database or a network.

```text
C_c     = C_p + C_s                    combine primary + secondary covariance at TCA
C_ECEF  = J · C_ECI · Jᵀ               rotate uncertainty with the Earth (GMST Jacobian)
C_B     = P · C_c · Pᵀ                 project onto the B-plane (⊥ relative velocity)
D_M     = √( rᵀ C_B⁻¹ r )              Mahalanobis — separation in σ, not km
P_c     = 1/(2π√|C_B|) ∬_A exp(−½ rᵀ C_B⁻¹ r) dx dy
```

The alert threshold is `P_c > 1.0 × 10⁻⁴`. The integral is approximated asymptotically — it cannot
be solved analytically at interactive frame rates. Broad-phase spatial hashing
(`scipy.spatial.cKDTree`) reduces pair screening from O(N²) to roughly O(N log N).

**Every physics function states its units and reference frame.** This is a convention the codebase
enforces, not an aspiration:

```python
def eci_to_ecef(position_km_eci: np.ndarray, gmst_rad: float) -> np.ndarray:
    """Rotate an ECI position vector into ECEF. Input km, output km."""
```

### On the classifier

The committed `ml_models/object_classifier.joblib` is a Random Forest whose **actual** features are
`inc_deg`, `ecc`, `mm_rev_day` and `bstar`, over **three** classes (Debris, Payload, Rocket Body).
This **does not match the feature set or class count described in the paper's Table I**, and the
original training script has not been recovered. The classification service was deliberately built
around what the file actually contains rather than what the paper describes. The discrepancy is
documented rather than hidden, and remains unresolved.

---

## Architecture

### Backend — strictly layered

```text
backend/app/
├─ api/        HTTP only. No physics, no SQL.
├─ services/   Orchestration.
├─ domain/     ⭐ PURE. No I/O, no framework imports. The physics lives here.
├─ infra/      Database, cache, CelesTrak client, ML loader.
├─ schemas/    Pydantic wire shapes.
└─ workers/    Scheduler and ingestion tasks.
```

**The layering rule:** `domain/` imports nothing from `api/`, `infra/` or FastAPI. The previous
backend lacked this and was unstable as a result. Its other faults, and how they are fixed here:

| Previous backend | This backend |
| --- | --- |
| CelesTrak fetched *inside request handlers* | A scheduled background worker |
| Blocking I/O on async paths | Async throughout |
| No layering | `api → services → domain`, with `infra` at the edge |
| Configuration scattered | One `Settings` object (pydantic-settings) |
| `allow_origins=["*"]` | An explicit allowlist |
| No tests | 90 tests, 100% coverage on `domain/` and `services/` |

### Frontend

```text
frontend/src/
├─ renderer/   everything inside <Canvas> — points, camera
├─ ui/         everything outside <Canvas> — the design system
├─ simulation/ the frame loop and FrameState
├─ data/       snapshot loading, IndexedDB cache, typed API client
└─ state/      Zustand stores
```

The renderer and the UI never import each other; they communicate through `state/`.

### Two decisions that must not be retrofitted

1. **Scale strategy.** Earth's radius is 6,371 km; the Earth–Sun distance is 1.5 × 10⁸ km. That
   range destroys float32 depth precision. Logarithmic depth, a camera-relative origin and nested
   scale contexts are designed in now, so that a future Solar System view is not a rewrite.
2. **Static-snapshot-first.** The client boots from a compressed snapshot and propagates locally.
   **The scene never waits on the backend.** If the API is down the simulation still runs — with a
   visible notice that data may be stale, never a blank screen.

### Error handling

Every failure degrades to something honest, never to a broken screen.

| Failure | Behaviour |
| --- | --- |
| Backend unreachable | Scene runs from the cached snapshot with a "data may be stale" indicator |
| WebGL2 unavailable | A static image and an explanation — never a black canvas |
| A 3D model fails to load | Fall back to class-generic, then to a plain instanced marker |
| CelesTrak fetch fails | Keep the previous snapshot; stale data with an honest epoch beats none |
| Malformed upstream data | Rejected at validation, never written to the database |
| A component throws | Error boundaries around the canvas and each panel — one dies, the app survives |

---

## Project structure

```text
orcas/
├─ backend/                    🛰️ FastAPI backend (Python 3.12)
│  ├─ app/
│  │  ├─ api/v1/               objects.py · catalog.py · router.py
│  │  ├─ domain/               ⭐ propagation · coordinates · covariance
│  │  │                           conjunction · classification · tle · types
│  │  ├─ services/             catalog · propagation · conjunction · classification
│  │  │                           ingestion · retention · snapshot
│  │  ├─ infra/                db/ · cache/ · celestrak/ · ml/
│  │  ├─ schemas/              Pydantic request and response models
│  │  └─ workers/tasks/        ingest_gp.py · bake_snapshot.py · retention.py
│  ├─ alembic/                 migrations — never create_all()
│  └─ tests/                   unit/ · integration/ · golden/
├─ frontend/                   🛰️ React 19 + React Three Fiber + Vite
│  └─ src/
│     ├─ renderer/points/      Tier 0 GPU point renderer, picking, selection
│     ├─ renderer/camera/      the camera system — rig, flight, state machine
│     ├─ simulation/           frame loop, FrameState (struct-of-arrays typed arrays)
│     ├─ data/                 catalogue client, validation, IndexedDB cache
│     ├─ ui/                   GlassSurface and 12 design-system components
│     ├─ state/                Zustand stores (simulation · selection · view)
│     ├─ styles/tokens.css     ⭐ every colour lives here, no exceptions
│     ├─ brand/ · landing/     the logo and the intro sequence
│     └─ design/               the /design route
├─ packages/
│  ├─ orcas-physics/           ⭐ pure TypeScript — satellite.js wrapper, transforms
│  └─ orcas-scene/             R3F components — Earth, Satellites, OrbitPath, Starfield
├─ infra/docker/               backend.Dockerfile · frontend.Dockerfile (multi-stage)
├─ ml_models/                  object_classifier.joblib
├─ scripts/analysis/           generate_ml_plots.py — regenerates the paper's figures
├─ data/sample/                21 synthetic OMM fixtures + real 2009 element sets
├─ docs/                       figures/ · superpowers/plans/ (written implementation plans)
├─ .github/workflows/ci.yml    ruff · mypy · pytest ‖ eslint · tsc · vitest
└─ docker-compose.yml          4 services: postgres, backend, worker, frontend
```

**One physics implementation, two consumers.** `packages/orcas-physics` is the only propagator. A
second one would silently diverge, which is a correctness failure rather than a duplication
annoyance.

---

## Tech stack

### Backend

| Technology | Role |
| --- | --- |
| **Python 3.12** | Non-negotiable — the `.joblib` classifier, `cKDTree` screening and the NumPy/SciPy covariance maths *are* the research |
| **FastAPI** + Uvicorn | Async HTTP layer |
| **sgp4** (2.27) | SGP4/SDP4 propagation, initialised from OMM directly |
| **NumPy · SciPy** | Covariance algebra, B-plane projection, spatial hashing |
| **scikit-learn** (pinned 1.6.1) | Object classification — pinned because the committed model was trained with this exact version |
| **SQLAlchemy 2** (async) + **asyncpg** | Persistence |
| **Alembic** | Migrations — `create_all()` is banned |
| **Pydantic v2** + pydantic-settings | Validation, and one settings object |
| **PyArrow** | Parquet archival for the retention policy |
| **APScheduler** | Worker scheduling |
| **ruff · mypy --strict · pytest** | Lint, types, tests |

### Frontend

| Technology | Role |
| --- | --- |
| **React 19** + **TypeScript** (strict) | UI — `any` is banned |
| **Three.js** + **React Three Fiber** | WebGL rendering |
| **satellite.js 7** | Client-side SGP4, initialised from OMM via `json2satrec()` |
| **Zustand** | State — never updated per frame; the render loop uses refs |
| **Vite** + **Vitest** | Build and test |
| **Tailwind v4** | Wired to `tokens.css` through `@theme` |
| **Framer Motion** · **Lucide** | Motion and icons |
| **Plus Jakarta Sans** · **JetBrains Mono** | Self-hosted type |

**The one typographic rule that does most of the work:** every number representing a measurement —
altitude, velocity, P_c, coordinates — renders in mono with `tabular-nums`. These values update
every frame, and proportional digits make the readout jitter.

### Infrastructure

Docker Compose (4 services) · PostgreSQL 16 · GitHub Actions · `uv` for Python dependencies.
Containers never run as root.

---

## Development

```bash
# Everything
docker compose up
docker compose up --build

# Backend
docker compose run --rm backend uv run pytest
docker compose run --rm backend uv run ruff check .
docker compose run --rm backend uv run mypy app/domain app/services
docker compose run --rm backend uv run alembic upgrade head
docker compose run --rm backend uv run alembic revision --autogenerate -m "message"

# Frontend
docker compose run --rm frontend npm run lint
docker compose run --rm frontend npm run test
docker compose run --rm frontend npm run build

# Logs and shells
docker compose logs -f backend
docker compose exec backend bash
```

### Conventions

**Python** — ruff for lint and format · type hints everywhere · `mypy --strict` on `domain/` and
`services/` · docstrings on every public function, and every physics function states its units and
reference frame · custom exception types, never a bare `except`.

**TypeScript** — `strict`, no `any` · files `kebab-case.tsx`, components `PascalCase`, hooks
`use-thing.ts` · named exports · **no file over 250 lines** · never update React state every frame,
use refs and `useFrame`.

**Commits** — Conventional Commits. `feat(scope): imperative summary`, under 72 characters, no full
stop.

**Design tokens** — all colour lives in `frontend/src/styles/tokens.css`. A hex literal in a
component is a bug.

### Hard bans

| Never | Why |
| --- | --- |
| Network I/O inside a request handler | The previous backend's fatal flaw |
| Blocking I/O on an async path | Freezes the event loop |
| `norad_id` stored as INTEGER | 6-digit and Alpha-5 IDs already exist |
| TLE text as the primary ingestion format | Being retired upstream |
| React state updated every frame | The classic React Three Fiber killer |
| Colour literals outside the token file | Palette drift |
| Files over 250 lines | The deleted prototype's `App.jsx` reached 1,391 |
| `any` in TypeScript · bare `except:` · silent `catch {}` | Hidden failures |
| Containers as root · `create_all()` instead of migrations | Privilege and schema drift |
| Committing `.env`, keys or `data/` | The repository is public |
| Presenting stale data as live | Always show the element-set epoch |
| **Shipping fake physics** | Exactly what the deleted prototype did |
| **Overstating the research** | The highest-consequence rule here |

---

## Testing

```bash
docker compose run --rm backend uv run pytest      # 90 passed, 4 xfailed
docker compose run --rm frontend npm run test      # 317 tests
```

CI runs both suites on every push. Coverage on `domain/` and `services/` is enforced at 70% or above
and currently sits at 100%.

The suite includes a **golden-file test** reconstructing the 2009 Iridium 33 / Cosmos 2251 event from
real Space-Track element sets. It is deliberately split in two: real kinematics with no tuning,
asserted against the paper's own table; and classification under an explicit, labelled covariance
assumption reaching the same CRITICAL verdict. It reproduces the *conclusion*, and does not pretend
to reproduce the paper's exact demonstration figures.

**Known flake:** `catalog-snapshot.test.ts`'s "46,000 records under 800 ms" assertion is a wall-clock
budget, so it fails under CPU contention (measured at roughly 1,100 to 1,750 ms inside a container).
It passes in isolation. This is a test-harness problem, not a performance regression.

---

## Data sources and the OMM migration

**OMM (Orbit Mean-Elements Message) is the canonical format here. TLE is a legacy import adapter
only.**

CelesTrak exhausted 5-digit catalog numbers on **11 July 2026**. New objects receive 6-digit IDs with
**no TLE representation at all** — the format has no room for them. Two consequences are baked into
this codebase:

- `norad_id` is stored as **VARCHAR**, never INTEGER.
- Ingestion consumes **OMM JSON**. Both propagators accept OMM natively — `satellite.js`'s
  `json2satrec()` on the client, and Python `sgp4`'s `omm.initialize()` on the server. Neither needs
  TLE text.

A library's parser must never dictate the schema.

Sources: **[CelesTrak](https://celestrak.org)** for general perturbations data, and
**[Space-Track.org](https://www.space-track.org)** for the historical element sets used in the 2009
reconstruction (an account is required for the latter).

---

## Research paper

There is a peer-reviewed paper behind this work.

> **Modi, F. M., Khara, S. V., Tivari, G. D., Patel, J., Patel, P., and Kumawat, G.**
> Department of Computer Engineering, Silver Oak University, Ahmedabad.
> **ICSSIT 2026**, Paper ID 1849, technically sponsored by the **IEEE SMC Society**.
> Accepted 24 June 2026 · presented 28 July 2026 · pp. 1769–1774 · ISBN 979-8-3315-8087-2.

The paper is **accepted, presented, and in the conference proceedings.** It is **not yet indexed on
IEEE Xplore** — indexing typically follows some weeks or months after a conference closes. A DOI
will be added here when the listing appears.

Reported results, quoted exactly and neither rounded nor reinterpreted: for the 2009 event at
T₀ = 2009-02-10 16:56:00 UTC, both objects at 788.6 km altitude and 72.51° N / 97.90° E, with a
Mahalanobis distance **D_M = 1.84** and **P_c = 4.2 × 10⁻³** — a **critical alert**, against a
deterministic prediction of a miss by over 500 m. Relative velocity 11.7 km/s. For classification,
ROC AUC **0.94** (Random Forest) against **0.70** for the deterministic baseline.

⚠️ **An honest caveat.** The covariance values behind those specific P_c figures were constructed for
the paper's demonstration rather than derived from real tracking data — outside the 2009 event there
were no real incidents to draw on. Every *formula* in `covariance.py` and `conjunction.py` matches
the paper's derivation exactly, verified line by line. The golden test reconstructs the event
independently and states its own assumptions in the open.

---

## Roadmap

Built and merged:

- [x] Layered FastAPI backend with a pure, fully-tested physics domain
- [x] Covariance propagation, B-plane projection, Mahalanobis distance and P_c
- [x] 2009 Iridium/Cosmos reconstruction as a golden-file test
- [x] OMM-first ingestion with a TLE legacy adapter
- [x] REST API, snapshot generation, retention policy, in-process caching
- [x] Four-service Docker Compose stack working from a single command
- [x] Design system — tokens, glass material, 12 components, WCAG-audited
- [x] Tier 0 GPU point renderer — the full catalogue in a single draw call
- [x] Earth-occlusion fade and orbit-class filtering
- [x] GPU picking, hover and selection with asynchronous readback
- [x] Camera system — fly-to, object mode, predictive targeting, reduced-motion support

Not yet built:

- [ ] Tier 1 instanced models, LOD cross-fade, orbit paths and trails
- [ ] Performance hardening and device tiering
- [ ] Integration — moving the real renderer onto the root route
- [ ] The 3D asset pipeline (glTF/meshopt/KTX2, licensed models)
- [ ] Live conjunction screening in the browser
- [ ] Historical replay, debris-swarm and density-heatmap visualisations
- [ ] Time-series data export
- [ ] Solar System and galactic scales

---

## Contributing

This is primarily a personal research and engineering project, but the conventions above are
enforced by CI rather than by review alone. If you open a pull request:

1. Run `ruff`, `mypy`, `eslint` and both test suites before pushing.
2. Add tests for new logic. Physics changes need a numerical assertion, not a smoke test.
3. State units and reference frames on anything carrying a physical quantity.
4. Keep files under 250 lines, and colours in the token file.
5. Never claim a result the code does not produce.

---

## References

1. Vallado, D. A. *Fundamentals of Astrodynamics and Applications*.
2. Hoots, F. R. and Roehrich, R. L. *Spacetrack Report No. 3: Models for Propagation of NORAD Element Sets*.
3. [CelesTrak](https://celestrak.org) — general perturbations catalogue and the OMM format
4. [Space-Track.org](https://www.space-track.org) — official space situational awareness data
5. [NASA Orbital Debris Program Office](https://orbitaldebris.jsc.nasa.gov)
6. [ESA Space Safety Programme](https://www.esa.int/Space_Safety)
7. [python-sgp4](https://pypi.org/project/sgp4/) and [satellite.js](https://github.com/gtcaz/satellite.js)
8. [scikit-learn](https://scikit-learn.org)

---

## Acknowledgements

Developed as an academic research project exploring orbital mechanics and SGP4 propagation, space
debris and the Kessler Syndrome, probabilistic conjunction assessment, machine learning for object
classification, and real-time 3D scientific visualisation on the web.

The interaction model is informed by NASA's *Eyes on the Solar System*; the visual identity is
original.

---

## License

⚠️ **No license is currently set.** The `LICENSE` file in this repository is empty, which means
default copyright applies and no reuse rights are granted. A license will be added once the authors
have agreed on one.
