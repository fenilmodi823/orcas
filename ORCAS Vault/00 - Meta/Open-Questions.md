---
title: Open Questions
type: meta
updated: 2026-08-13
status: active
---

# Open Questions

> ⚠️ **Rewritten 2026-07-27** for the restructure. Questions from the portfolio-era plan are archived at the bottom.
>
> ✅ **2026-08-13 — Q1 through Q8 are all decided.** Every blocking question is cleared; [[Phases#Phase 0 — Foundation and decisions]] is unblocked. Full reasoning in the Decided table. Only the 🟢 nice-to-resolve items remain.

Each item blocks something. Answer it, then move it to **Decided** with the date.

---

## 🔴 Blocking

**None.** All blocking questions were answered on 2026-08-13. See Decided.

---

## 🟢 Nice to resolve

### Q9 — Logo
Direction chosen: "The Radar Wireframe" ([[Branding#Logo — the mark]]). Needs to be actually drawn. Blocks the favicon, the OG card and the landing animation.

### Q10 — Does the portfolio get rebuilt too, or wait?
The simulation is the priority. The portfolio can be a simple static site initially and grow later.

### Q11 — Conjunction assessment in the product UI
The research contribution is P_c. Should the simulation surface live conjunction screening, or keep that in the paper? Surfacing it is the strongest differentiator — but it must be labelled as demonstration, never operational warning.

---

## ✅ Decided

| Date | Question | Decision |
| --- | --- | --- |
| 2026-07-27 | Backend strategy | **Rebuild from scratch. Python + FastAPI.** Language stays because Skyfield/sgp4/sklearn are the research; the code goes because the structure was the failure. |
| 2026-07-27 | Frontend consolidation | **One folder, `frontend/`, evolved from `frontend-three`.** |
| 2026-07-27 | `frontend-3d` | ❌ **Delete entirely, salvage nothing.** Its propagator is fake — `angle += speed`, sine-wave velocity, no `satellite.js`. New structure designed fresh. |
| 2026-07-27 | `frontend` (Cesium) | ❌ Delete after migration |
| 2026-07-27 | Old `backend/` | Frozen now, deleted in P6 after parity is proven |
| 2026-07-27 | Product direction | **Standalone interactive space simulation platform**, NASA-Eyes class. Portfolio is a separate, independent site. |
| 2026-07-27 | "ORCAS OS" desktop metaphor | ❌ **Retired** |
| 2026-07-27 | Design language | **Apple Liquid Glass**, entirely original identity |
| 2026-07-27 | Containerisation | **Everything in Docker**, one `docker compose up` |
| 2026-07-27 | Ingestion format | **OMM JSON**, not legacy TLE. `norad_id` as VARCHAR. |
| 2026-07-27 | Asset hosting | **Cloudflare R2** — 10 GB free, zero egress |
| 2026-07-27 | Backend hosting | **Render** — Fly.io no longer has a free tier |
| 2026-07-27 | Solar System view | Phase 7, but the scale architecture is designed in from P4 |
| 2026-07-27 | Publication wording | **"Accepted"**, never "published", until indexed in IEEE Xplore |
| 2026-07-28 | Publication wording *(refined)* | Three states: **accepted → presented → in proceedings**, and **not yet on Xplore**. See [[ORCAS Research Paper#Publication record]]. |
| **2026-08-13** | **Q1 — Repository layout** | ✅ **Monorepo for the simulation** — `backend/`, `frontend/`, `packages/`, `workers/`, `infra/`, `scripts/` in one repo. The `docker compose up` one-command rule decided it. |
| **2026-08-13** *(evening)* | **Q1b — Where does the portfolio live?** | ✅ **Its own separate folder and repo**, created later. Not inside the simulation monorepo. Consequence: `packages/orcas-physics` and `orcas-scene` must be **published to npm** for the portfolio to consume them — path imports won't survive a Cloudflare Pages build. Not needed until PA3. [[Stack#4. Shared code — across two separate repositories]] |
| **2026-08-13** *(evening)* | **Q5b — In-place restructure vs new folder** | ✅ **Restructure `C:\VS Code\orcas` in place, with fresh git history.** Audit found 47 commits and a **217 MiB pack** because `data/` was committed (117 files). `.gitignore` cannot fix that retroactively. Archive the old history as a `git bundle`, then re-init in the same folder. Same directory, clean history — both goals met. [[Prompt - Simulation Restructure]] |
| **2026-08-13** | **Q2 — `satellite.js` and 6-digit IDs** | ✅ **Resolved, and the blocker is gone.** `satellite.js` has `json2satrec()` since **v6.0.0**; Python `sgp4` has `omm.initialize()`. Neither needs TLE text. **OMM is canonical; TLE is a legacy import adapter only.** Architecture: [[Data-Strategy#⭐ The canonical orbital-data model]]. |
| **2026-08-13** | **Q3 — Contribution statement** | Fenil states he did all the implementation work. He is **first author of a six-author paper** — that is the published record and cannot be contradicted. Agreed wording claims the work specifically without denying the byline: see the callout below. |
| **2026-08-13** | **Q4 — Domains** | ✅ **`orcas.space`** as primary. `orcas-sim.dev` deferred — register only if `.space` proves problematic. |
| **2026-08-13** | **Q5 — Git history** | ✅ **Fresh repository.** Do not rewrite the old history. The backend is being rebuilt anyway, so this is the cheapest possible moment. `data/tle/`, `data/ephemeris/`, `data/raw/`, `data/cache/` are gitignored from commit one; a small sample dataset is committed for dev and tests. |
| **2026-08-13** | **Q6 — Bespoke 3D models** | ✅ **~30–50 curated, three tiers.** T1 recognisable craft (ISS, Hubble, Tiangong, Starlink, GPS, Iridium, Sentinel, Envisat, Terra, Aqua, Landsat) · T2 the 2009 collision pair (Iridium 33, Cosmos 2251) and other demo objects · T3 everything else gets a class-generic model. **Every bespoke asset carries a licence record.** |
| **2026-08-13** | **Q7 — Debris swarm in v1** | ✅ **Ships in v1, unmistakably labelled as simulation.** Enforced in two places: `source_type = "simulation"` in the data model, which bars it from the screening/ML pipeline, **and** a persistent UI label. Both are required, not either/or. |
| **2026-08-13** | **Q8 — Redis** | ❌ **Dropped from v1.** In-process cache behind a `CacheService` interface + GitHub Actions cron. Redis becomes a `RedisCache` implementation later, if and only if a measurement demands it — see the swap-in criteria in [[Data-Strategy#❌ Why *not* Redis in v1 — decided 2026-08-13]]. |

> [!warning] Q3 — the one place to be careful
> The paper is now in the published proceedings with **six authors listed**. Anyone reading a portfolio can pull up that byline in seconds — admissions committees especially.
>
> "I was the sole author" would be checkably false and would cast doubt on everything else on the page. But "I did the work" is a completely legitimate claim to make, and it can be stated *strongly* without contradicting the record. The strongest honest framing is specific about what was built:
>
> > **First author of** *Probabilistic Space Debris Conjunction Assessment Using Machine Learning and Covariance Intersection Analysis* (ICSSIT 2026, IEEE SMC Society). I designed and implemented the complete system — the SGP4 propagation engine, the covariance-intersection pipeline, the B-plane projection and P_c computation, the Random Forest classifier, and the WebGL visualisation layer — and produced the time-decoupled 2009 Iridium–Cosmos reconstruction that validates it.
>
> That is a bigger claim than "sole author," because it is *specific* and it is *verifiable against the paper*. It names five components. A reader who checks will find every one of them in the text.
>
> ⚠️ Still applies: **never write "sole author," "solo project," or "my paper" in a way that implies no co-authors.** [[Rules#Honesty rules]].

---

## 🗄️ Archived — portfolio-era questions

Superseded by the restructure. Kept for provenance.

- *Telemetry strategy (baked JSON vs live backend)* → resolved by [[Data-Strategy#Static vs dynamic]]: static snapshot first, always.
- *Next.js vs Vite* → **Vite.** The simulation is an SPA over a canvas; SSR buys nothing.
- *CLI terminal* → dropped with the ORCAS OS concept.
- *Mobile = vertical scroll portfolio* → superseded. Mobile gets the **real simulation** at reduced fidelity ([[Design#Responsive]]).
- *Window manager before 3D* → obsolete; there is no window manager now.

---

**Related:** [[Phases]] · [[PRD]] · [[Architecture]] · [[Data-Strategy]] · [[Decision]] · [[memory]]
