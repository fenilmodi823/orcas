---
title: Deployment
type: engineering
updated: 2026-08-13
status: active
---

# Deployment

> ⚠️ **Rewritten 2026-07-27** — Fly.io lost its free tier; stack containerised end to end.
>
> 🔴 **Rewritten 2026-08-13 (morning)** — hard constraint became zero money, no card on file. **Render Postgres** and **Cloudflare R2** withdrawn. See the graveyard below.
>
> ✅ **Scoped down 2026-08-13 (evening) — only the PORTFOLIO deploys.** The simulation is local-only ([[PRD]]); it has no deployment, no hosting cost, and no free-tier constraints. This note is now almost entirely about a static Astro site, which is a much easier problem. The hosted-backend analysis is kept below because it becomes relevant again the moment the simulation is published.

**Related:** [[Stack]] · [[Docker]] · [[Architecture]] · [[Data-Strategy]] · [[Phases]]

---

## What deploys, and what doesn't

| | Deploys? | Where |
| --- | --- | --- |
| 🌍 **Portfolio** (Astro + demo island) | ✅ Yes | Cloudflare Pages, `<name>.pages.dev` |
| 🛰️ **Simulation frontend** | ❌ No | `localhost:5173` via Docker |
| 🛰️ **Simulation backend** (FastAPI) | ❌ No | `localhost:8000` via Docker |
| 🛰️ **Postgres** | ❌ No | Docker volume on your machine |

**Only the first row costs anything to think about.** A static site on Cloudflare Pages has no database, no server, no cold start, and no way to incur a charge.

---

## Constraint

**₹0 / month, permanently, and no payment method on file anywhere.**

This is stricter than "fits in a free tier." A free tier that requires a card is not acceptable here, because an accidental overage becomes a real charge. A free tier that expires is not acceptable either. Every service below is **permanently free and cannot bill you.**

---

## ⚰️ Withdrawn recommendations — read before reinstating anything

| Service | Why it's out |
| --- | --- |
| **Fly.io** | ❌ No free tier since 2026. Withdrawn 2026-07-27. |
| **Render Postgres** | 🔴 **Free databases expire 30 days after creation, then a 14-day grace period, then Render deletes the database and all its data.** This would have silently destroyed the catalogue about a month after launch. Withdrawn 2026-08-13. |
| **Cloudflare R2** | ❌ Requires a credit card to enable, even for the free 10 GB tier. Excellent product, wrong fit for a no-card constraint. Withdrawn 2026-08-13. |
| **Supabase** | ❌ Free projects **pause after ~1 week of inactivity** and become unrecoverable after 90 days. A project that sleeps for a fortnight during exams should not die. *(Fenil received a "your project is going to be paused" email on 2026-08-13 — this is not hypothetical.)* |
| **Custom domain** (`orcas.space`) | 💰 Costs money annually. **Deferred** — use the free `pages.dev` subdomain. |

---

## Topology — what actually ships

```
<name>.pages.dev              Cloudflare Pages  (the ONLY deployed thing)
   │
   ├─ /                        Astro — static HTML, zero JS
   ├─ /research                the paper, figures, honest status
   ├─ /projects/orcas          write-up + the demo island
   │     └─ demo island        React + R3F, lazy-hydrated
   │           └─ snapshot     baked JSON, few hundred objects, < 200 KB
   └─ /cv

   No backend. No database. No API calls. No card on file.
```

**The demo island never calls anything.** It boots from a snapshot baked at build time, propagates client-side with `satellite.js`, and runs entirely offline. There is no backend to be down, which is the strongest possible version of the "never block on the API" rule.

### Running the simulation (not deploying it)

```bash
docker compose up          # localhost:5173 frontend, :8000 API
```

That is the whole story. No hosting, no environment secrets in a dashboard, no uptime to monitor.

---

## Free-tier reality check (verified 2026-08-13)

| Platform | Free tier | Card? | Verdict |
| --- | --- | --- | --- |
| **Cloudflare Pages** | **Unlimited bandwidth**, 20,000 files/site, **25 MiB max per file**, 500 builds/month | ❌ No | ⭐ **Frontend *and* assets.** The file limits are the binding constraint, not bandwidth. |
| **Neon** | 0.5 GB storage, 100 CU-hours/month, scale-to-zero, 10 branches. **Compute suspends when limits are hit — data is never deleted.** | ❌ No | ⭐ **Database.** Degrades on volume, not on time — the right failure mode for a project that goes quiet during exams. |
| **Render web service** | 750 instance-hours/month, 512 MB RAM, spins down after 15 min idle (~1 min cold start) | ❌ No | ⭐ **Backend.** One service fits in 750 h. |
| **GitHub Actions** | Free for public repositories | ❌ No | ⭐ **Scheduled ingestion.** |
| ~~Render Postgres~~ | 1 GB but **expires at 30 days, then deleted** | — | 🔴 **Withdrawn.** |
| ~~Cloudflare R2~~ | 10 GB, zero egress | ✅ **Yes** | ❌ **Withdrawn** on the no-card rule. |

> **Cold starts are a design input, not a bug.** Render free services sleep, and Neon scales to zero. Because the client boots from a static snapshot on Pages, a sleeping backend degrades the experience from "full detail" to "full simulation, slightly less metadata." That is acceptable. It would be unacceptable if the scene depended on the API — which is exactly why it doesn't.

---

## Serving assets from Pages instead of R2

Dropping R2 is viable because the asset footprint is small and no single file is large ([[Data-Strategy#Storage size]]):

| Asset | Size | Within Pages limits? |
| --- | --- | --- |
| ~40 hero models + 8 generic (Draco glTF) | ~15 MB total, 50–400 KB each | ✅ Far under 25 MiB/file |
| Earth textures (KTX2, 8k set) | ~25 MB total | ⚠️ Keep **each** texture under 25 MiB — split or downscale the 8k set if any single file approaches it |
| Catalogue snapshot (gzipped) | ~600 KB | ✅ |
| **File count** | a few hundred | ✅ Far under 20,000 |

**Rules that change as a result:**

- Assets are committed to the repo (or generated at build time) and deployed *with* the frontend, rather than uploaded to a bucket
- Content-hashing still applies — Pages sets long cache TTLs on hashed filenames
- ⚠️ **Watch the 25 MiB per-file ceiling.** It is the one Pages limit this project can realistically hit, and only via Earth textures.
- If the asset library ever outgrows this, the escape hatch is R2 — but that means adding a card, so it is a deliberate decision, not a drift.

---

## Deploying the portfolio

### Cloudflare Pages
```
Framework preset   Astro
Build command      npm run build
Output directory   dist
Node version       22
```
No environment variables are required — there is no API to point at.

### Refreshing the demo snapshot

The demo's snapshot is baked from the local simulation, not fetched live:

```bash
# run locally, occasionally — this is a manual, deliberate act
docker compose run --rm backend python -m scripts.bake_demo_snapshot \
    --objects 300 --out ../portfolio/src/data/snapshot.json
git commit -am "chore(portfolio): refresh demo snapshot"   # → auto-deploys
```

**No cron, no GitHub Action, no scheduled ingestion for the portfolio.** A demo snapshot that is a few weeks stale is completely fine as long as the UI shows the element-set epoch honestly ([[Rules#Hard bans]] — never present stale data as live). Automating this would add machinery to solve a problem that doesn't exist.

> The 6-hourly GitHub Actions ingestion cron belongs to the **simulation**, and since the simulation is local, it is just a scheduled task on your own machine — or simply run by hand when you want fresh data.

---

## Domains

| Site | Now | Later |
| --- | --- | --- |
| **Portfolio** | **`<name>.pages.dev`** — free, HTTPS automatic | `fenilmodi.dev`, if spending becomes acceptable |
| Simulation | `localhost` | n/a — not deployed |

A custom domain is the only thing in this entire setup that costs money, and it buys presentation, not capability. Attach one later without redeploying anything.

> One honest consideration, since the audience is admissions committees: a `pages.dev` URL looks slightly less established than a custom domain on a CV. It is worth knowing that is the trade — but the content matters far more than the hostname, and a great site on `pages.dev` beats a thin one on a bought domain.

---

## Deploying each piece

## Environment variables — simulation only

The portfolio needs none. The simulation runs locally, so this file never leaves your machine:

```ini
# .env.example  — committed. Real .env is gitignored.
ENVIRONMENT=development
LOG_LEVEL=INFO

# Local Postgres in Docker. No hosted database.
DATABASE_URL=postgresql+asyncpg://orcas:orcas@postgres:5432/orcas

CACHE_BACKEND=memory          # memory | redis — always memory
CACHE_TTL_SECONDS=300

CELESTRAK_BASE_URL=https://celestrak.org/NORAD/elements/gp.php
CELESTRAK_FORMAT=json         # OMM JSON — canonical. Never tle.
CELESTRAK_USER_AGENT=ORCAS/1.0 (+contact@…)
INGEST_INTERVAL_HOURS=6

ASSET_BASE_URL=/assets

# Local only — the simulation is never exposed publicly.
CORS_ORIGINS=http://localhost:5173
```

⚠️ `NASA_API_KEY` from the old backend: **rotate it.** `backend/.env` currently sits in the working tree and the repo is going public — see [[Git-Workflow]].

---

## Pre-launch checklist — portfolio

- [ ] Secret audit complete; `.env` untracked; **NASA key rotated**
- [ ] `data/` never committed
- [ ] **Every claim about the paper is accurate** — "accepted, presented, in the proceedings, not yet on IEEE Xplore." Six authors acknowledged ([[Open-Questions#Decided]] Q3). This is the item most likely to be checked and most damaging to get wrong.
- [ ] Demo island works with **no backend running** — kill Docker and reload to prove it
- [ ] **No single asset file exceeds 25 MiB**
- [ ] **No payment method attached to any account**
- [ ] Lighthouse ≥ 90 performance, **100 accessibility**
- [ ] Real mid-range Android and iPhone tested
- [ ] Safari checked (`backdrop-filter` is the usual glass casualty)
- [ ] `robots.txt`, `sitemap.xml`, OG cards, JSON-LD
- [ ] Site live on HTTPS
- [ ] Element-set epoch visible in the demo — **never present a stale snapshot as live**

## Readiness checklist — simulation (local)

- [ ] `docker compose up` works on a clean machine, no manual steps
- [ ] CORS locked to `localhost` — **never `["*"]`**
- [ ] `/health/live` and `/health/ready` respond correctly
- [ ] Migrations applied
- [ ] ⭐ **Golden-file test passes** — D_M = 1.84, P_c = 4.2 × 10⁻³ from the 2009 element sets
- [ ] Old `backend/` deleted, parity verified ([[Phases]])

---

## Operations

| Cadence | Task |
| --- | --- |
| When you want fresh data | Run ingestion locally — no schedule required |
| Occasionally | Re-bake and commit the portfolio demo snapshot |
| On change | Update publication status in one place |

Nothing here is time-critical, because nothing expires and nothing sleeps.

---

## Cost ceiling

| Service | Free limit | Expected use | Headroom |
| --- | --- | --- | --- |
| Cloudflare Pages — bandwidth | Unlimited | a personal site | ∞ |
| Cloudflare Pages — files | 20,000 | a few hundred | Large |
| Cloudflare Pages — file size | **25 MiB each** | largest is a demo texture | ⚠️ The only limit worth checking |
| Cloudflare Pages — builds | 500/month | a few per week | Large |
| *Simulation* | — | runs on your machine | n/a |

**Projected: ₹0, permanently, with no payment method on file anywhere.**

Scoping the simulation to local removed every limit that previously required attention — the 0.5 GB database ceiling, the instance-hour budget, the cold-start behaviour, the retention compromise. What remains is a static site on a host with unlimited bandwidth. **Nothing in this setup can expire, sleep, be deleted for inactivity, or generate a bill.**
