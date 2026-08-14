---
title: Architecture
type: engineering
updated: 2026-07-27
status: active
---

# Architecture

> ⚠️ **Rewritten 2026-07-27.** New backend from scratch, single frontend, full containerisation.

**Related:** [[PRD]] · [[Docker]] · [[Data-Strategy]] · [[Deployment]] · [[Rules]] · [[Phases]]

---

## 1. System overview

```
                          ┌─────────────────────────┐
                          │   Cloudflare R2 / CDN   │
                          │  3D models · textures   │
                          │  static snapshots       │
                          └───────────▲─────────────┘
                                      │ (assets, zero egress cost)
┌──────────────┐         ┌────────────┴────────────┐
│  Portfolio   │◀───────▶│    ORCAS Frontend       │
│  (separate)  │  links  │    React 19 + R3F + TS  │
└──────────────┘         │    client-side SGP4     │
                         └────────────┬────────────┘
                                      │ HTTPS  /api/v1
                         ┌────────────▼────────────┐
                         │   ORCAS Backend         │
                         │   FastAPI (Python 3.12) │
                         │   api / services /      │
                         │   domain / infra        │
                         └──────┬───────────┬──────┘
                                │           │
                    ┌───────────▼──┐   ┌────▼──────────────┐
                    │  PostgreSQL  │   │  CacheService     │
                    │  catalogue,  │   │  in-process (v1)  │
                    │  elements    │   │  Redis = future   │
                    └───────▲──────┘   └───────────────────┘
                            │
                  ┌─────────┴─────────────────┐
                  │  Ingestion Worker         │
                  │  GitHub Actions cron      │
                  │  CelesTrak OMM JSON       │
                  └───────────────────────────┘
```

Everything above the CDN line runs in Docker ([[Docker]]).

---

## 2. Application flow

### Cold load
1. Browser requests the site → CDN serves the shell
2. Landing sequence begins — **non-blocking**
3. In parallel: static catalogue snapshot fetched from CDN (single compressed file)
4. Client parses the snapshot, initialises SGP4 propagators
5. Scene renders; landing sequence dismisses or is skipped
6. Backend is queried **only** for detail views and fresh element sets

> **The scene never waits on the backend.** If the API is down the user sees a fully working simulation, with a visible note that data may be stale. This is the core resilience decision.

### Selecting an object
1. Client already has position (locally propagated) and identity (from snapshot)
2. Panel opens instantly with what the client knows
3. `GET /api/v1/objects/{id}` fetches the richer metadata in the background
4. Panel fills progressively — no spinner over an empty panel

### Time scrubbing
Entirely client-side. SGP4 is cheap; a server round-trip per frame is not. The backend is never in the interaction loop.

---

## 3. Backend architecture

**Stack:** Python 3.12 · FastAPI · Pydantic v2 · SQLAlchemy 2.0 (async) · Alembic · PostgreSQL 16 · `sgp4` (incl. `omm.initialize`) · Skyfield · scikit-learn · uvicorn

> **No Redis in v1** ([[Open-Questions#Decided]]). Caching sits behind a `CacheService` interface with a `MemoryCache` implementation; `RedisCache` is added later only if a measurement demands it. Services depend on the interface, never on a cache client directly.

### Why Python stays
Skyfield, `sgp4`, the SPICE ephemeris path and the trained scikit-learn classifier are the research. Rewriting them in another language would mean reimplementing peer-reviewed work — new bugs, no benefit. **The old backend's problem was structure, not language.**

### What actually goes wrong in the old backend, and the fix

| Old problem | New approach |
| --- | --- |
| Blocking I/O (`fetch_tle`, file reads) inside request handlers | All I/O async; ingestion moved to a background worker |
| Endpoints fetch from CelesTrak *on request* | Endpoints read the database only. Ingestion is decoupled and scheduled. |
| No layering — HTTP, physics and file access in one function | Strict `api → services → domain` with `infra` at the edge |
| Config scattered across modules and `config.py` globals | One `Settings` object, `pydantic-settings`, env-driven |
| `allow_origins=["*"]` | Explicit allowlist per environment |
| No typed contracts | Pydantic models on every boundary |
| No tests | Unit + integration, ≥ 70% on domain and services |
| Silent failures | Structured logging, explicit error types, no bare `except` |

### Backend structure

```
backend/
├─ app/
│  ├─ main.py                   FastAPI app factory, middleware, router mount
│  ├─ settings.py               Settings (pydantic-settings) — ALL config
│  │
│  ├─ api/                      HTTP layer only. No physics, no SQL.
│  │  ├─ deps.py                DI: session, cache, current settings
│  │  ├─ errors.py              Exception handlers → typed error responses
│  │  └─ v1/
│  │     ├─ router.py
│  │     ├─ objects.py          /objects, /objects/{id}, /objects/{id}/ephemeris
│  │     ├─ conjunctions.py     /conjunctions
│  │     ├─ catalog.py          /catalog/snapshot, /catalog/meta
│  │     └─ health.py           /health/live, /health/ready
│  │
│  ├─ schemas/                  Pydantic request/response models
│  │
│  ├─ services/                 Orchestration. Talks to domain + infra.
│  │  ├─ catalog_service.py
│  │  ├─ propagation_service.py
│  │  ├─ conjunction_service.py
│  │  ├─ classification_service.py
│  │  └─ snapshot_service.py
│  │
│  ├─ domain/                   ⭐ PURE. No I/O, no framework imports.
│  │  ├─ models.py              dataclasses: SpaceObject, ElementSet, State
│  │  ├─ propagation.py         SGP4 wrapper, ECI→ECEF→geodetic
│  │  ├─ covariance.py          C_ECEF = J·C_ECI·Jᵀ, B-plane projection
│  │  ├─ conjunction.py         Mahalanobis, P_c integral
│  │  ├─ screening.py           broad-phase cKDTree
│  │  └─ orbit_classes.py       LEO/MEO/GEO/HEO from mean motion
│  │
│  ├─ infra/                    Everything that touches the outside world
│  │  ├─ db/                    engine, session, models, repositories
│  │  ├─ cache/
│  │  │  ├─ base.py             CacheService interface ⭐
│  │  │  ├─ memory.py           MemoryCache — v1
│  │  │  └─ redis.py            RedisCache — future, not written yet
│  │  ├─ celestrak/client.py    OMM JSON ingestion client
│  │  ├─ storage/r2_client.py   object storage
│  │  └─ ml/classifier.py       joblib model loader
│  │
│  └─ workers/
│     ├─ scheduler.py           dev only; prod uses GitHub Actions cron
│     └─ tasks/ingest_gp.py     fetch → validate → normalise → upsert
│
├─ alembic/
├─ tests/{unit,integration,golden}/
├─ pyproject.toml
└─ Dockerfile
```

**The layering rule:** `domain/` imports nothing from `api/`, `infra/` or FastAPI. It is pure functions over dataclasses, which makes the physics unit-testable without a database, a network or a running server. This is the single most important structural decision and the one the old backend lacked.

### API surface (v1)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health/live` | Process alive |
| GET | `/health/ready` | DB + cache reachable |
| GET | `/api/v1/catalog/snapshot` | Full client bundle (cached, CDN-fronted) |
| GET | `/api/v1/catalog/meta` | Object count, newest epoch, source |
| GET | `/api/v1/objects` | Paginated, filterable |
| GET | `/api/v1/objects/{id}` | Full detail |
| GET | `/api/v1/objects/{id}/ephemeris` | Propagated track over a window |
| GET | `/api/v1/conjunctions` | Screened conjunctions with P_c |

**Versioned from day one.** `/api/v1` costs nothing now and prevents a breaking-change crisis later.

---

## 4. Data model

```sql
space_object          -- identity, slow-changing
  id, norad_id, intl_designator, name, object_type,
  operator, country, launch_date, rcs_size, is_active

element_set           -- orbital elements, time-series
  id, object_id, epoch, mean_motion, eccentricity, inclination,
  raan, arg_perigee, mean_anomaly, bstar, rev_number,
  source, ingested_at
  -- INDEX (object_id, epoch DESC)

conjunction           -- computed screening results
  id, primary_id, secondary_id, tca, miss_distance_km,
  mahalanobis_d, probability_pc, severity, computed_at

asset                 -- 3D model / texture manifest
  id, object_id NULL, kind, lod_tier, url, content_hash, bytes
```

**Design notes:**
- `element_set` is append-only. Never update an element set — insert a new one. This preserves provenance and makes historical replay possible.
- `norad_id` is **`VARCHAR`, not `INTEGER`.** Catalog numbers exceeded five digits on 2026-07-11 and Alpha-5 encoding uses letters. See [[Data-Strategy#The TLE deprecation]]. ⚠️ Getting this wrong now means a painful migration later.
- Conjunctions are computed and stored by the worker, not per request.

---

## 5. Frontend architecture

**Stack:** React 19 · TypeScript strict · Vite · @react-three/fiber · drei · three · satellite.js · Zustand · Tailwind v4

### Structure — designed fresh

```
frontend/
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx                        thin shell only
│  │
│  ├─ scene/                         everything inside <Canvas>
│  │  ├─ Stage.tsx                   canvas, renderer config, perf monitor
│  │  ├─ earth/                      Earth, Atmosphere, Terminator, Clouds
│  │  ├─ objects/                    SatelliteField (instanced), SatelliteModel,
│  │  │                              OrbitPath, GroundTrack, DebrisSwarm,
│  │  │                              DensityHeatmap
│  │  ├─ camera/                     CameraRig, FocusController, ScaleManager
│  │  └─ env/                        Starfield, SunLight
│  │
│  ├─ ui/                            everything outside <Canvas>
│  │  ├─ hud/                        TelemetryPanel, ObjectInfoPanel,
│  │  │                              TimeControls, SearchPanel, FilterPanel
│  │  ├─ landing/                    LandingSequence, LogoAnimation
│  │  └─ primitives/                 GlassPanel, MonoStat, StatusPill, Slider
│  │
│  ├─ physics/                       ⭐ PURE. No React.
│  │  ├─ propagator.ts               satellite.js wrapper
│  │  ├─ coordinates.ts              ECI ↔ ECEF ↔ geodetic ↔ scene
│  │  ├─ orbit-elements.ts           derived params
│  │  └─ time.ts                     simulation clock, GMST
│  │
│  ├─ data/
│  │  ├─ types.ts
│  │  ├─ snapshot.ts                 load + parse static snapshot
│  │  ├─ api-client.ts               typed backend client
│  │  └─ assets.ts                   glTF/LOD resolution
│  │
│  ├─ state/                         Zustand stores
│  │  ├─ simulation-store.ts         time, rate, playing
│  │  ├─ selection-store.ts          selected/hovered object
│  │  └─ view-store.ts               layers, filters, camera mode
│  │
│  ├─ hooks/
│  └─ styles/tokens.css              ⭐ ALL colour lives here
│
├─ public/
├─ Dockerfile
└─ vite.config.ts
```

### Rules
- `physics/` is pure TypeScript with no React import — unit-testable, and it is the part that must be *correct*
- `scene/` and `ui/` never talk directly; they communicate through `state/`
- **No file over 250 lines.** `App.jsx` at 1,391 lines is what we are escaping.
- Renderer state lives in refs and `useFrame`, never in React state — re-rendering React every frame is the classic R3F performance mistake

### Rendering strategy — LOD

The full active catalogue is **~16,200 objects (July 2026)**. Individual meshes are impossible.

| Tier | Condition | Rendering |
| --- | --- | --- |
| 0 | Focused object | Full glTF model, textures, animated |
| 1 | Near camera, notable | Simplified glTF, shared material |
| 2 | Mid distance | Instanced mesh, class-coloured |
| 3 | Far / dense | GPU point sprites in a single draw call |

Tier transitions are distance- and count-driven, and adapt to measured frame rate via `<PerformanceMonitor>`.

### Scale strategy — the Solar System constraint

Earth radius ≈ 6,371 km. Earth–Sun ≈ 150,000,000 km. That is a range of 10⁵, which destroys `float32` depth precision — the cause of z-fighting in most naive space renderers.

**Approach, designed in now even though Solar System is Phase 7:**
- **Logarithmic depth buffer** (`logarithmicDepthBuf: true`)
- **Scene units are never raw kilometres.** A `ScaleManager` maps physical distance to scene units per context.
- **Camera-relative origin:** the camera sits near the origin and the world translates around it, avoiding large-coordinate precision loss.
- **Nested scale contexts:** Earth-local and heliocentric are separate contexts with an explicit transition, rather than one continuous coordinate space.

> Retrofitting this later would mean rewriting every positioning component. It costs little now.

---

## 6. Repository layout

```
orcas/
├─ backend/                 ← NEW FastAPI service (old one deleted in P6)
├─ frontend/                ← the ONE frontend
├─ workers/                 ← ingestion/scheduler (may live in backend image)
├─ infra/
│  ├─ docker/               Dockerfiles per service
│  └─ compose/              compose overrides per environment
├─ scripts/                 asset pipeline, snapshot baking, dev helpers
├─ ml_models/               object_classifier.joblib
├─ ORCAS Vault/             ← this vault
├─ docker-compose.yml
├─ .env.example
├─ CLAUDE.md
└─ README.md
```

**Deleted during the restructure:** `frontend-3d/` (P4 start), `frontend/` Cesium (P4 end), `backend/` old (P6), `data/tle/` and `data/ephemeris/` (moved out of git — see [[Data-Strategy]]).

---

## 7. Key design decisions

| Decision | Rationale |
| --- | --- |
| Python + FastAPI, rebuilt | Research code is Python; the problem was structure |
| Pure `domain/` layer | Physics testable without infrastructure |
| Client-side SGP4 | 60 FPS is impossible with a server in the loop |
| Static snapshot first | Scene never depends on backend availability |
| Append-only `element_set` | Provenance and historical replay |
| `norad_id` as VARCHAR | 6-digit and Alpha-5 catalog numbers already exist |
| API versioned from day one | Free now, expensive later |
| Zustand over Context | Frequent updates without re-rendering the tree |
| Log depth + scale contexts | Solar System becomes possible instead of a rewrite |
| One frontend folder | The confusion this restructure exists to end |
