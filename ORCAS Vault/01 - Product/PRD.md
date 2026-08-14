---
title: PRD — Product Requirement Document
type: product
updated: 2026-08-13
status: active
---

# PRD — Product Requirement Document

> ⚠️ **Rewritten 2026-07-27** — ORCAS reframed from portfolio widget to standalone simulation platform.
>
> 🔴 **Rewritten again 2026-08-13 — the two properties have swapped roles.** The **portfolio** is now the thing that ships publicly. The **simulation runs locally, for Fenil only.** Everything below reflects that.

**Related:** [[Stack]] · [[Architecture]] · [[Phases]] · [[Design]] · [[Data-Strategy]] · [[Rules]] · [[Open-Questions]]

---

## 1. What we are building

**Two things, with different audiences, different lifecycles, and — now — different deployment models.**

| | 🌍 **Portfolio** | 🛰️ **ORCAS Simulation** |
| --- | --- | --- |
| **Status** | ⭐ **The shipped product** | Personal tool |
| **Audience** | Admissions committees, recruiters, the public | Fenil |
| **Deployment** | Public — Cloudflare Pages | **`localhost` only.** Not deployed. |
| **Stack** | Astro 5 + TypeScript | React 19 + R3F + Vite · Python + FastAPI ([[Stack]]) |
| **Constraints** | Free tier, no card, SEO, mobile | **None that matter** — it runs on your machine |
| **Contains ORCAS?** | Yes — a cut-down live demo island | The full thing |

### Why the split

The simulation is ambitious, and ambitious things take time. Coupling the *public* deliverable to it means nothing is visible until everything is finished — which is the wrong shape when the near-term need is something to show people.

Decoupling them means the portfolio can ship in weeks while the simulation matures for as long as it needs. It also removes every free-tier compromise from the simulation at a stroke: no 0.5 GB database ceiling, no 25 MiB asset cap, no cold starts, no sleeping backend. Those constraints were shaping real architectural decisions, and **they now apply only to the portfolio — a static site that will never come close to any of them.**

### What connects them

A shared `orcas-physics` package (pure TypeScript) and shared R3F scene components. The portfolio's demo island is a **strict subset** of the simulation: same components, few hundred objects instead of ~16,200, baked snapshot instead of a live API.

**Neither may depend on the other at runtime.** The portfolio must build and deploy with the simulation backend switched off — which is trivially true, because the demo never calls it. See [[Stack#4. Shared code between the two properties]].

### What sits underneath

ORCAS has an accepted, IEEE-sponsored research paper behind it ([[ORCAS Research Paper]]). The portfolio is now the public face of that work. **Nothing displayed may contradict or overstate the paper** — see [[Rules#Honesty rules]]. This matters *more* now, not less: the portfolio is read by exactly the people most able to check.

---

## 2. Why rebuild rather than continue

### The backend
The existing Python backend is unreliable. It is being **replaced entirely**, not repaired. New stack: **Python + FastAPI, rebuilt properly** — the language stays because Skyfield, sgp4, scikit-learn and the trained classifier have no real equivalent elsewhere; the *code* goes. Details in [[Architecture]].

The instability was architectural, not linguistic: no layering, no typed contracts, blocking I/O in request paths, no tests, config scattered across modules.

### The frontends
Three exist. That ends now — **one frontend folder, permanently.**

| Folder | What it actually is | Decision |
| --- | --- | --- |
| `frontend-3d/` | React + R3F, cleanly structured — **but its propagator is fake.** `useSGP4Propagator` is `angle += speed` with a sine-wave velocity. No `satellite.js` import anywhere. Decorative, not physical. | ❌ **Delete entirely** |
| `frontend/` | CesiumJS + Resium. Learning exercise. Earth/Solar toggle works. Bundle is enormous. | ❌ **Delete after migration** |
| `frontend-three/` | React 19 + R3F + **real `satellite.js` SGP4** — `twoline2satrec`, `propagate`, `gstime`, `eciToGeodetic`. Kessler swarm, density heatmaps, historical replay, CSV export. ⚠️ 1,391-line monolithic `App.jsx`. | ✅ **The foundation.** Evolve to production. |

> **Why `frontend-3d` dies despite looking well-organised:** it renders numbers that are not real. On a project whose entire credibility rests on a peer-reviewed physics claim, shipping cosmetic telemetry would be indefensible. Its structure was appealing; its substance was not. New structure will be designed fresh in [[Architecture]].

---

## 3. Target users

> 🔴 **Re-ranked 2026-08-13.** The public artifact is now the portfolio, so its audience comes first. The previous ranking led with "the curious public" because the simulation was the shipped product — that is no longer the case.

Ranked. Where needs conflict, the higher row wins.

### 1. Admissions committees and recruiters ⭐ primary
Master's and PhD admissions, and technical recruiters. They arrive by searching your name or opening a link on an application.

**They need:** to establish credibility in under a minute. A clear statement of what you built; the paper, with its status stated honestly; evidence the engineering is real rather than described. **They will check things** — the byline, the venue, the repo. Everything must survive that.

**They will not:** install anything, run anything locally, or read 2,000 words before deciding you are interesting.

### 2. The curious public
Someone who saw a Starlink train, or read about space debris, and wants to *see* it. No domain knowledge assumed.

**They need:** the demo island to be beautiful within three seconds, obvious to control, and to work on a phone.

### 3. Space-sector professionals and researchers
Will immediately check whether the physics is real.

**They need:** SGP4 done properly; stated data provenance and epoch; honest accuracy caveats; a link to the paper; a link to the source.

### 4. Fenil — the only user of the full simulation
The simulation now has exactly one user, and that changes what it optimises for.

**It needs:** to be genuinely useful for exploring the data and extending the research; correct above all; reproducible via `docker compose up` after months away. **It does not need:** onboarding, mobile support, a landing sequence, marketing copy, or accessibility compromises for unknown visitors. Those requirements move to the portfolio or disappear.

---

## 4. Features

### 4.1 Satellite visualisation — must have

| # | Feature | Notes |
| --- | --- | --- |
| V1 | Real 3D models per object | glTF/GLB, Draco-compressed. Tiered: hero models for notable satellites, class-generic models otherwise, instanced billboards at distance. |
| V2 | Accurate orbital paths | Rendered from propagated positions, not idealised ellipses |
| V3 | Real-time positions | Client-side SGP4 at 60 FPS |
| V4 | Future position prediction | Scrub forward along the track; show ground track |
| V5 | Smooth camera navigation | Orbit, pan, zoom, focus-and-follow. Earth scale to object scale without jarring transitions. |
| V6 | Time control | Pause, play, rate multiplier, jump to now |
| V7 | Search and filter | By name, NORAD ID, orbit class, operator, country |

### 4.2 Satellite information panel — must have

On selection, show: **name · NORAD / catalog ID · international designator · object type · orbit class · current altitude · velocity · latitude / longitude · inclination · eccentricity · period · apogee / perigee · RAAN · epoch of the element set · operator / country · launch date**.

> **Every displayed value must carry its epoch.** Orbital data ages. A position derived from a three-day-old element set must say so. This is a credibility requirement, not a nicety.

### 4.3 Should have
- Orbit-class shells (LEO / MEO / GEO) as toggleable visual bands
- Debris density heatmap — port from `frontend-three`
- Kessler debris swarm — port from `frontend-three`
- Conjunction highlighting — the research contribution, surfaced
- 2009 Iridium 33 / Cosmos 2251 historical replay — port from `frontend-three`
- Ground track projection onto Earth
- Day/night terminator
- Data export (CSV) — port from `frontend-three`

### 4.4 Future — architecture must accommodate from day one
- **Full Solar System view.** Seamless transition from Earth scale to heliocentric scale. This is the single biggest constraint on the rendering and coordinate architecture — see [[Architecture#Scale strategy]].
- Live radar-derived covariance (from the paper's future work)
- Fragmentation cloud simulation
- Launch event visualisation

### 4.5 Explicitly out of scope for v1
- User accounts, saved views, social features
- Mobile-native apps
- VR / AR
- Anything requiring a paid hosting tier

---

## 5. The landing experience

> 🔴 **This now belongs to the PORTFOLIO, not the simulation.** A landing animation exists to impress a first-time visitor; the simulation has exactly one user who has seen it before. Shipping a 4-second intro in front of a tool you open daily is an annoyance, not a brand moment. **The simulation boots straight into the scene.**

First load must be memorable — this is a stated requirement, and it is where most WebGL projects lose people.

**Sequence:** space-themed cold open → ORCAS logo forms and transforms (orca silhouette resolving into orbital tracks) → smooth transition into the live scene.

**Hard constraints:**
- **Skippable from the first frame.** A visible skip control, always.
- **Never blocks data loading.** The scene loads *behind* the animation.
- **Respects `prefers-reduced-motion`** — reduced to a simple fade.
- **Plays once per session**, not on every navigation.
- **Total duration ≤ 4 seconds.**

An intro that cannot be skipped is a bounce, not a brand moment. See [[Design#Landing sequence]] and [[Branding#Logo animation]].

---

## 6. Non-functional requirements

> 🔴 **Split by property 2026-08-13.** These used to be one list because there was one deployed thing. The two now have genuinely different obligations — and conflating them is how a personal tool ends up carrying public-web compromises for no reason.

### 🌍 Portfolio — public, and therefore constrained

| Area | Target |
| --- | --- |
| First meaningful paint | < 1.5 s on a mid-range connection |
| Demo island interactive | < 3 s, and **never blocking the rest of the page** |
| Frame rate (demo) | 60 FPS desktop; 30 FPS floor on mid-range mobile |
| Demo object count | **A few hundred**, not the full catalogue. It is a taster. |
| Bundle | Zero JS on content pages. Demo island lazy-loaded, < 300 KB gzipped before the 3D chunk. |
| Accessibility | **Lighthouse 100.** Keyboard-navigable, screen-reader-labelled. Non-negotiable — this is the public face. |
| SEO | Sitemap, OG cards, JSON-LD, canonical URLs. Findable by name. |
| Hosting cost | **₹0/month, no card on file** ([[Deployment]]) |
| Asset ceiling | **25 MiB per file** (Cloudflare Pages) |
| Offline degradation | Demo renders from a baked snapshot. **It never calls a backend at all.** |

### 🛰️ Simulation — local, and therefore free of most of this

| Area | Target |
| --- | --- |
| Frame rate | 60 FPS on *your* machine with the full catalogue at LOD |
| Object capacity | **Full active catalogue (~16,200)**, plus the simulated debris swarm |
| Containerisation | **One `docker compose up`** — see [[Docker]]. This one still matters: it is what lets you return after months away. |
| Correctness | ⭐ **The golden-file test reproduces D_M = 1.84 and P_c = 4.2 × 10⁻³.** This is the requirement that outranks all others. |
| Database | Local Postgres — **no storage ceiling** ([[Data-Strategy#Retention]]) |
| Textures / assets | Full resolution. No per-file cap. |
| ~~Mobile support~~ | ❌ Dropped. Desktop only. |
| ~~Landing sequence~~ | ❌ Dropped. Boots straight into the scene. |
| ~~Accessibility for unknown visitors~~ | ❌ Not a requirement. Keyboard shortcuts for *your* efficiency still are. |
| ~~Cold-start / free-tier tolerance~~ | ❌ Irrelevant. Always warm. |

---

## 7. Success criteria

### Portfolio — the shipped thing

1. An admissions reader understands who you are and what you built **within 60 seconds**
2. Every claim about the paper survives being checked — status, venue, byline
3. The ORCAS demo runs smoothly on a mid-range phone
4. Lighthouse 100 on accessibility; ≥ 90 on performance
5. It costs nothing to operate, with no payment method on file
6. Searching your name finds it

### Simulation — the personal tool

7. `docker compose up` produces a working system on a clean machine, **six months from now**
8. The golden-file test passes — the physics reproduces the paper
9. 60 FPS with the full catalogue at LOD
10. A professional inspecting the physics finds it correct and honestly caveated
11. Adding a Solar System view later does not require re-architecting
12. Nothing anywhere overstates the research

---

## 8. Explicit non-goals

- Competing with commercial SSA providers on operational accuracy
- Being a general-purpose astronomy tool
- Real-time collision *warnings* to actual operators — this is educational and research-demonstration software, and must say so
- Supporting IE, or any browser without WebGL2

---

## 9. Naming

| Term | Meaning |
| --- | --- |
| **ORCAS** | The platform overall, and the simulation site |
| **ORCAS Simulation** | The 3D application |
| **The engine** | Backend + propagation + ML |
| **The portfolio** | The separate personal site |
| **ORCAS OS** | ❌ **Retired.** The desktop-metaphor concept is dropped — the simulation is the product now. |
