---
title: Data Strategy
type: product
updated: 2026-08-13
status: active
---

# Data Strategy

> ⚠️ **Rewritten 2026-07-27.** Scope expanded from "a portfolio snapshot" to "the full data layer of a simulation platform": orbital data, 3D assets, caching, CDN, free-tier delivery.
>
> 📌 **Updated 2026-08-13.** The `satellite.js` / 6-digit unknown is **resolved** (§1). Canonical-OMM architecture added (§9). Redis dropped from v1 (§4).

**Related:** [[Architecture]] · [[Docker]] · [[Deployment]] · [[PRD]] · [[Phases]]

---

## 1. ⚠️ The TLE deprecation — read this first

**This is the single most important technical fact in the data layer, and it is new.**

CelesTrak ran out of 5-digit catalog numbers on **11 July 2026** with the object *Saramago*. The official USSF catalogue is now past 100147.

**Consequences:**

- All newly catalogued objects get **6-digit numbers (100000+)**
- **GP data for these objects is not available in TLE format at all** — the TLE line has a 5-character field and it is full
- CelesTrak continues to serve legacy TLE **only** for objects with 5-digit numbers
- The interim **Alpha-5** scheme replaces the first digit with a capital letter (I and O omitted), extending the space by ~240,000 — but it makes catalog numbers **alphanumeric**

### What this means for ORCAS

| ❌ Don't | ✅ Do |
| --- | --- |
| Parse TLE text as the primary ingestion path | Ingest **OMM** (Orbit Mean-Elements Message) via CelesTrak's GP endpoints in **JSON** |
| Store `norad_id` as `INTEGER` | Store as **`VARCHAR`** — 6-digit and Alpha-5 values are not integers |
| Assume 69-character fixed-width lines | Use structured, versioned formats |
| Build the schema around TLE fields | Build around OMM fields; TLE becomes one possible *export* |

CelesTrak recommends OMM **XML v2.0** (CCSDS 505.0-B-3) for maximum interoperability; **JSON is the pragmatic choice** for a web backend and carries the same fields.

> [!success] ✅ **RESOLVED 2026-08-13 — both propagators accept OMM natively.**
> The earlier worry that `satellite.js` would force us back onto TLE strings is **not true**, verified against upstream changelogs:
>
> | Layer | Library | OMM entry point | Since |
> | --- | --- | --- | --- |
> | Frontend | `satellite.js` | **`json2satrec(omm)`** | **v6.0.0** (2025-04-06); `EPOCH`-with-`Z` parse fix in v6.0.1. Current release **v7.1.0** (2026-07-23). |
> | Backend | Python `sgp4` | **`omm.initialize()`** | Supports OMM from CelesTrak/Space-Track; takes an explicit `gravconst`. |
>
> Neither library needs a TLE string. **The 6-digit blocker is gone** — see [[Open-Questions#Decided]] and §9 below for the full architecture.

---

## 2. How much data is there

| Set | Count | Notes |
| --- | --- | --- |
| Active satellites | **~16,200** | CelesTrak active catalogue, July 2026 |
| Tracked objects (CelesTrak) | **30,000+** | Includes rocket bodies and large debris |
| Tracked objects (ESA estimate) | **~45,700** | Broader tracking network |
| Debris > 1 cm (ESA estimate) | **~1,200,000** | Not individually tracked — statistical only |

**Design target:** the full active catalogue (~16,200) rendered with LOD. Debris beyond that is *simulated statistically* (the Kessler swarm), never individually tracked. Being clear about that distinction matters — see [[Rules#Honesty rules]].

### Storage size

| Item | Size |
| --- | --- |
| One OMM record (JSON) | ~600 bytes |
| Full active catalogue, JSON | ~10 MB |
| Same, minified + gzipped | **~1.5–2 MB** |
| Client snapshot (subset of fields) | **~600 KB gzipped** |
| Daily full snapshot, archived as Parquet | ~1.5 MB/day → **~550 MB/year** |
| One Draco-compressed glTF satellite model | 50–400 KB |
| 40 hero models + 8 generic class models | **~15 MB** |
| Earth textures (KTX2, 8k day/night/normal/spec) | **~25 MB** |

**Total static assets: well under 100 MB.** That fits comfortably in a free tier.

---

## 3. Static vs dynamic — the classification

This determines cost, speed and resilience. Every piece of data is put in exactly one bucket.

### 🟦 Static — built once, served from CDN, cached forever

| Data | Cache |
| --- | --- |
| 3D models (glTF/Draco) | Immutable, content-hashed, `max-age=31536000` |
| Textures (KTX2) | Immutable, content-hashed |
| Fonts, icons, logo | Immutable |
| App JS/CSS bundles | Immutable, hashed |
| Object identity (name, ID, type, country, launch date) | Long — changes rarely |

### 🟩 Preprocessed — regenerated on a schedule, served as a file

| Data | Regenerated |
| --- | --- |
| **Catalogue snapshot** — the bundle the client boots from | Every 6 h |
| Orbit-class groupings | Every 6 h |
| Precomputed conjunction screening results | Every 6 h |
| Asset manifest | On asset change |

> The snapshot is the keystone. It is a single compressed file on the CDN. The client fetches it once and has a complete working simulation — **no database, no API, no cold start**. Everything else is enrichment.

### 🟨 Dynamic — computed per request, cached briefly

| Data | TTL |
| --- | --- |
| Object detail view | 5 min |
| Filtered/searched queries | 1 min |
| Ephemeris over a custom window | 5 min |
| Catalogue metadata (count, newest epoch) | 1 min |

### 🟥 Real-time — computed on the client, never server-side

| Data | Where |
| --- | --- |
| Satellite positions | **Client SGP4, every frame** |
| Orbit paths | Client, from propagation |
| Ground tracks | Client |
| Camera, selection, time scrubbing | Client |
| Telemetry readouts | Client |

> **Nothing in the interaction loop touches the network.** This is what makes 60 FPS possible and what makes the app work when the backend is asleep.

### 🟪 Never sent to the client
Raw historical archives · the full element-set time series · ML training data · `data/tle/` (107 MB) · `data/ephemeris/` (17 MB)

---

## 4. Storage architecture

> ✅ **Simplified 2026-08-13 by the local/public split.** There are now two storage stories, and the complicated one went away. No hosted database, no object storage, no free-tier accounting for the simulation.

### 🛰️ Simulation — entirely local

```
┌──────────────────────────────────────────────┐
│  Local disk  —  models, textures, data/      │
│  Full resolution. No file-size cap.          │
│  data/tle/ + data/ephemeris/ live here.      │
└───────────────────▲──────────────────────────┘
                    │
┌──────────────────────────────────────────────┐
│  PostgreSQL 16 in Docker  —  operational     │
│  space_object · element_set · conjunction    │
│  ✅ No storage ceiling. 90-day retention.     │
└───────────────────▲──────────────────────────┘
                    │
┌──────────────────────────────────────────────┐
│  CacheService (in-process)                   │
│  Still no Redis — nothing has changed to     │
│  justify a fifth container.                  │
└──────────────────────────────────────────────┘
```

### 🌍 Portfolio — static, and that is the whole architecture

```
┌──────────────────────────────────────────────┐
│  Cloudflare Pages  —  unlimited bandwidth    │
│  Astro build + demo island + baked snapshot  │
│  No database. No backend. No card.           │
│  ⚠️ 20,000 files · 25 MiB max per file        │
└──────────────────────────────────────────────┘
```

That is the entire portfolio infrastructure. Nothing to monitor, nothing to keep warm, nothing that can generate a bill or expire.

### Why PostgreSQL and not SQLite, even locally
Relational time-series with foreign keys and range queries over epochs. `element_set` grows monotonically and is queried by `(object_id, epoch DESC)` — exactly a relational index. Postgres also keeps the door open to hosting the simulation later without a migration; SQLite would make that a rewrite.

### 📌 Hosted-database research, retained for later
No longer needed, but the analysis was correct and would have to be redone if the simulation is ever published: **Neon** is the right free host because it degrades on *volume* (compute suspends, data survives), whereas **Render Postgres** degrades on *age* (free databases deleted at 30 days) and **Supabase** degrades on *inactivity* (paused after ~1 week, unrecoverable after 90 days). Full detail in [[Deployment#⚰️ Withdrawn recommendations — read before reinstating anything]].

### ❌ Why *not* Redis in v1 — decided 2026-08-13
Redis is the right tool for caching and brokering at scale, but ORCAS v1 has neither the traffic nor the operational budget to justify it. Adding it means one more service to deploy, monitor, configure, containerise and keep inside a free tier.

**v1 uses an in-process cache behind a `CacheService` interface, and GitHub Actions cron for scheduling.** The abstraction is the point — the application must never import a Redis client directly:

```
CacheService  (interface — this is what services depend on)
   ├── MemoryCache   ← v1
   └── RedisCache    ← added later only if measurements demand it
```

Swap-in criteria, so this is a measurement and not a vibe: introduce Redis when the backend runs more than one process/replica (in-process cache stops being coherent), or when cache-miss latency on the hot read paths becomes the measured bottleneck.

---

## 5. 3D asset pipeline

```
source model (.blend / .fbx / .obj)
   │  export
   ▼
glTF 2.0 (.gltf + .bin)
   │  gltf-transform: prune, dedupe, weld
   ▼
Draco geometry compression          → 70–90% smaller
   │
   ▼
KTX2 / Basis Universal textures     → GPU-native, ~6× smaller than PNG
   │
   ▼
LOD variants (tier 0 / 1 / 2)
   │
   ▼
content-hash → frontend/public/assets/ → deployed with Pages → manifest entry
```

⚠️ **Check every output file against the 25 MiB Cloudflare Pages per-file ceiling.** Models are 50–400 KB and nowhere near it; the 8k Earth textures are the only realistic risk. Split or downscale any single file that approaches the limit.

**Rules:**
- Every asset is content-hashed and immutable. A changed model is a new URL.
- Tier 2 and 3 use no individual models at all — instanced geometry and point sprites.
- Models load **lazily**, on focus. The boot path loads zero models.
- Always ship a generic fallback per object class; most of 16,200 objects will never have a bespoke model.

**Licensing:** NASA 3D Resources are public domain and are the safest source. **Record the licence for every model in the manifest** before shipping.

---

## 6. Ingestion

```
GitHub Actions cron  (every 6 h — no always-on scheduler service)
      │
      ▼
CelesTrak GP endpoint  ?FORMAT=json      ← OMM JSON, the canonical path
      │
      │  ┌─────────────────────────────────────────────┐
      │  │ Legacy adapter (5-digit objects only):      │
      │  │ TLE text → parse → same normalised record   │
      │  └─────────────────────────────────────────────┘
      ▼
Validate against the Pydantic OMM schema
      │  reject malformed records at this boundary
      ▼
Normalise → canonical OMM record  (§9)
      ▼
Upsert space_object (identity)
Insert  element_set  (append-only, never update)
      │
      ▼
Recompute orbit classes
Run conjunction screening
Regenerate snapshot → commit → triggers a Pages deploy
      │
      ▼
Invalidate CDN cache for the snapshot key
```

**Rules:**
- **Never fetch from CelesTrak inside a request handler.** That was the old backend's core failure.
- Validate before writing. A malformed upstream response must not corrupt the catalogue.
- If the fetch fails, keep the previous snapshot. **Stale data with an honest epoch beats no data.**
- Rate-limit and set a proper `User-Agent` — CelesTrak is a free public service run by one person. Do not abuse it.

---

## 7. Retention

> [!success] ✅ **Relaxed 2026-08-13 — the simulation is local-only, so the storage ceiling is gone.**
> Earlier today this section was cut to 48 hours because the free **Neon 0.5 GB** tier made 90-day retention 7× over budget. **That constraint no longer applies** — the simulation runs against a local Postgres in Docker ([[PRD#1. What we are building]]). Disk is the only limit, and 3.5 GB is nothing on a laptop.
>
> | Retention | Size | Local? |
> | --- | --- | --- |
> | 90 days @ 4 updates/day | 3,499 MB | ✅ Fine |
> | 30 days | 1,166 MB | ✅ Fine |
> | 48 hours *(the panicked free-tier number)* | 78 MB | — no longer necessary |
>
> *(16,200 objects × ~600 B per OMM row — [computed](#), not estimated.)*

| Data | Policy | Approx. size |
| --- | --- | --- |
| **Latest element set per object** | Forever — hot in Postgres | ~10 MB |
| **Element sets, last 90 days** | ✅ **Restored.** Local Postgres. Genuinely useful for studying epoch drift and propagation decay. | ~3.5 GB |
| **Element sets, older** | Compress to Parquet on local disk; drop from Postgres | on disk |
| Snapshots | Keep 30 daily, then monthly, locally | small |
| Conjunction results | 90 days | small |
| **2009 reconstruction dataset** | ⭐ **Committed to the repo as fixed sample data.** It is the paper's validation and must never depend on live ingestion or retention. | small |
| 3D assets | Forever, immutable, **full resolution — no 25 MiB cap locally** | ~40 MB+ |
| `data/tle/` (107 MB), `data/ephemeris/` (17 MB) | ✅ **Keep them locally and use them.** Gitignored, never committed, never deployed — but there is no longer any reason to avoid them on your own disk. | 124 MB |

### 🌍 The portfolio demo is the one thing still constrained

The demo island ships to Cloudflare Pages, so it keeps the tight budget:

| | Simulation (local) | Portfolio demo (public) |
| --- | --- | --- |
| Objects | ~16,200 + debris swarm | **a few hundred** |
| Snapshot | full, from the local DB | **baked, < 200 KB gzipped** |
| Backend | live FastAPI | **none — never calls an API** |
| Textures | full 8k | downscaled, **< 25 MiB per file** |
| Retention | 90 days | n/a — one static snapshot |

Baking the demo snapshot is a build step ([[Phases]]), not a runtime concern.

---

## 8. Immediate actions

- [x] ~~Confirm how `satellite.js` handles 6-digit / Alpha-5 objects~~ → ✅ **`json2satrec()` since v6.0.0.** No TLE needed. §1
- [ ] Switch ingestion from TLE text to **OMM JSON**
- [ ] `norad_id` as `VARCHAR` in the schema from the first migration
- [ ] Pin `satellite.js` to **v7.x** and budget for the v6→v7 breaking changes (§9.5)
- [ ] Spike the v7 **bulk propagation API** early — it is WASM-backed and claims 3–12× over a `propagate` loop, which is directly relevant to the 16,200-object 60 FPS target
- [ ] Start the repo fresh; `data/tle/` and `data/ephemeris/` never enter it ([[Open-Questions#Decided]])
- [ ] Write `scripts/bake-snapshot.py`
- [ ] Set up the R2 bucket and the asset manifest format
- [ ] Show the **element-set epoch** in the UI — non-negotiable ([[PRD#4.2]])

---

## 9. ⭐ The canonical orbital-data model

> **Architectural rule, decided 2026-08-13:** *OMM is the canonical orbital-data format. TLE is supported only as a legacy import adapter. Every object is normalised into one internal OMM-based record before propagation, ML, screening, or delivery to the client.*
>
> The point of the rule is that **the library must not dictate the schema.** "We store TLE because satellite.js parses TLE" would have hard-failed the moment a 6-digit object arrived. Storing OMM and letting each layer construct its own propagator from it is what survives the transition.

### 9.1 The canonical record

Stored on `element_set`, one row per object per epoch, append-only:

```jsonc
{
  "norad_cat_id":      "100147",              // VARCHAR — never INTEGER
  "object_name":       "SARAMAGO",
  "object_id":         "2026-001A",           // international designator
  "epoch":             "2026-08-13T12:00:00.000000Z",
  "mean_motion":       15.12345678,           // rev/day
  "eccentricity":      0.001234,              // dimensionless
  "inclination":       98.1234,               // deg
  "ra_of_asc_node":    120.1234,              // deg
  "arg_of_pericenter": 45.1234,               // deg
  "mean_anomaly":      210.1234,              // deg
  "bstar":             0.000123,              // 1/earth-radii
  "mean_motion_dot":   0.000001,              // rev/day^2
  "mean_motion_ddot":  0.0,                   // rev/day^3
  "ephemeris_type":    "SGP4",
  "source":            "celestrak",
  "source_format":     "omm_json",            // or "tle_legacy" — provenance is kept
  "source_type":       "real"                 // vs "simulation" — see §9.6
}
```

Units follow the CCSDS OMM spec (degrees and rev/day), **not** the internal radian/minute forms either propagator uses. Conversion happens at the propagator boundary, never in the database. Per [[Rules#Units and frames]], any function crossing that boundary states both.

### 9.2 One format in, two propagators out

The important correction to make here: **`satellite.js` is a JavaScript library and cannot run in the FastAPI backend.** Each side builds its own propagator from the same stored record.

```
                    CelesTrak
                        │
          ┌─────────────┴─────────────┐
     OMM JSON                    Legacy TLE
   (all objects)              (5-digit only)
          │                          │
          └─────────────┬────────────┘
                        ▼
              Normalise + validate          ← Pydantic, backend
                        ▼
            ⭐ Canonical OMM record          ← PostgreSQL, VARCHAR norad_id
                        ▼
          ┌─────────────┴──────────────┐
          ▼                            ▼
   BACKEND (Python)             FRONTEND (TypeScript)
   sgp4 omm.initialize()        satellite.js json2satrec()
          ▼                            ▼
        SGP4                          SGP4
          ▼                            ▼
   ML + conjunction              Positions every frame
   screening, snapshot           → R3F scene
   baking
```

Both paths run **the same SGP4 model** — OMM is a data format, not a different theory. CelesTrak's OMM records name the mean-element theory as SGP4 explicitly. Changing format changes nothing about the physics, which is why the paper's results stay valid.

### 9.3 Backend — Python

```python
from sgp4 import omm
from sgp4.api import Satrec

def satrec_from_omm(record: dict) -> Satrec:
    """Build an SGP4 propagator from a canonical OMM record.

    Input: canonical OMM fields (deg, rev/day) per §9.1.
    Output: initialised Satrec, WGS72 gravity model.
    """
    sat = Satrec()
    omm.initialize(sat, record)
    return sat
```

### 9.4 Frontend — TypeScript

```ts
import { json2satrec } from 'satellite.js';

// physics/ is pure — no React import. See Rules §3.
export function satrecFromOmm(record: OmmRecord): SatRec {
  return json2satrec(record);
}
```

### 9.5 ⚠️ `satellite.js` v7 — breaking changes to budget for

Pin the exact version ([[Rules#Libraries]]). Current release is **v7.1.0** (2026-07-23). If any older example code is copied from `frontend-three`, these will bite:

| Change | v6 | v7 |
| --- | --- | --- |
| Module format | AMD / CJS / ESM / minified | **ESM only** |
| `propagate` failure | `{position: false, velocity: false}` | returns **`null`** |
| `satrec.ndot` units | rev/day² | **rad/min²** |
| `satrec.nddot` units | rev/day³ | **rad/min³** |
| Node baseline | older | 20.19+ / 22.13+ / 24+ |

Two v7 features are worth designing around rather than discovering late:

- **Bulk propagation API** — C++ compiled to WASM, reported 3–12× faster than a `propagate` loop. This is the single most relevant upstream development for the 16,200-object 60 FPS target.
- **`checkForDecay()`** — filters objects that decayed long ago but for which SGP4 still reports "success" while returning garbage positions. Without it, a long-dead object renders at a nonsense location. That is exactly the class of silent-wrong-output this project has a rule against ([[Rules#Hard bans]]).

### 9.6 `source_type` — keeping simulation out of the real pipeline

Every object carries `source_type`, and it is **not** cosmetic:

| Value | Meaning | May enter ML / conjunction screening? |
| --- | --- | --- |
| `real` | Propagated from a genuine CelesTrak element set | ✅ Yes |
| `simulation` | Synthetic — the Kessler debris swarm | ❌ **Never** |

The debris swarm ships in v1 because it is the most visually striking thing in the product, but it is statistically generated, not tracked. A synthetic object must never reach the screening pipeline and be reported as a conjunction — that would be fabricating a result. The field is the enforcement mechanism; the UI label ([[PRD]]) is the disclosure. Both are required.

---

**Sources:** [CelesTrak SATCAT](https://celestrak.org/satcat/) · [CelesTrak GP data formats](https://celestrak.org/NORAD/documentation/gp-data-formats.php) · [satellite.js changelog](https://github.com/shashwatak/satellite-js/blob/develop/CHANGELOG.md) · [python-sgp4](https://github.com/brandon-rhodes/python-sgp4) · [Cloudflare R2 pricing](https://egresscost.com/cloudflare/)
