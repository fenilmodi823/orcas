---
title: Stack
type: engineering
updated: 2026-08-13
status: active
---

# Stack — languages and frameworks

> **Decided 2026-08-13**, after the project split into a **public portfolio** and a **local-only simulation** ([[PRD]]).
> This note exists so the question is answered once. If you are tempted to change a language, read the "why the alternatives lost" section for that surface first.

**Related:** [[Architecture]] · [[PRD]] · [[Rules]] · [[Deployment]] · [[Docker]]

---

## The four surfaces

| Surface | Language | Framework | Where it runs |
| --- | --- | --- | --- |
| **Portfolio** | TypeScript | **Astro 5** | Cloudflare Pages — public |
| **Portfolio ORCAS demo** | TypeScript | React 19 + R3F *(Astro island)* | the visitor's browser |
| **Simulation frontend** | TypeScript | React 19 + R3F + Vite | `localhost` |
| **Simulation backend** | **Python 3.12** | FastAPI | Docker, `localhost` |
| **Shared physics** | TypeScript | none — pure functions | imported by both frontends |

**Two languages total.** TypeScript everywhere in the browser, Python for the science. The boundary between them is HTTP, and it is the only place they meet.

---

## 1. Portfolio → Astro

The portfolio is a content site with one heavy interactive widget on it. That is precisely the shape Astro is built for.

**Why Astro wins here:**

- **Zero JavaScript by default.** Every page is static HTML. Lighthouse 100 is a realistic target, not an aspiration.
- **Islands architecture** — this is the decisive feature. The ORCAS mini-demo hydrates as an isolated React island while every other page ships no JS at all. You get a heavyweight 3D demo *and* an instant-loading site, which no all-or-nothing framework gives you.
- **Content collections + MDX** with type-safe frontmatter for the research write-up and project pages.
- **SEO is built in** — sitemap, RSS, canonical URLs, image optimisation. This matters: the audience includes admissions committees who will search your name ([[PRD#Audience]]).
- Builds to pure static files → Cloudflare Pages, free, no card ([[Deployment]]).

**Why the alternatives lost:**

| Option | Why not |
| --- | --- |
| **Next.js** | SSR, ISR and API routes buy nothing for a static personal site, and it ships a React runtime on every page even with Server Components. More weight, more config, no benefit here. |
| **Vite + React (plain)** | You hand-roll routing, meta tags, sitemap, RSS and the content pipeline — all of which Astro gives you for free. |
| **SvelteKit** | Genuinely excellent, and slightly leaner than React. Loses on one specific thing: **it cannot host the React/R3F components the simulation already uses.** Choosing it means writing the demo twice. |
| **Hugo / Eleventy** | Very fast static generation, but no React island support, so the live demo becomes impossible or a bolted-on iframe. |

> **The tiebreaker was component reuse.** Astro renders React components natively, so the portfolio demo imports the *same* R3F scene components and the *same* pure-TypeScript physics module as the full simulation. One physics implementation, two consumers. Svelte or Hugo would each force a second implementation — and two implementations of orbital propagation is exactly how they silently diverge.

**Styling:** Tailwind v4 + the shared `tokens.css` from [[Design]], so both properties look like the same person made them.

---

## 2. Simulation frontend → React 19 + R3F + TypeScript

Unchanged from the 2026-07-27 decision. There is no serious competitor.

- **Three.js** is the mature browser 3D engine; **React Three Fiber** is the best way to drive it declaratively, and it keeps the scene graph componentised instead of a 1,391-line imperative blob (which is what we are escaping).
- **satellite.js** — the SGP4/SDP4 implementation — is TypeScript. It is the reason the client can propagate locally every frame with no network round-trip.

**Why the alternatives lost:**

| Option | Why not |
| --- | --- |
| Vanilla Three.js | Imperative scene graph, manual lifecycle management, far more code for the same result. |
| Babylon.js | A strong engine, but no advantage over Three here and a much thinner React ecosystem. |
| **Rust / WASM + wgpu** | Tempting on raw speed, and genuinely faster at propagation maths. But it abandons `satellite.js`, and **the bottleneck is draw calls, not arithmetic** — which is why instancing and LOD are the actual performance strategy ([[Architecture#LOD tiers]]). Enormous DX cost for a benefit in the wrong place. *(Note: `satellite.js` v7 already ships a WASM bulk-propagation path, so the WASM speedup is available without leaving TypeScript.)* |
| Unity / Unreal WebGL export | Multi-megabyte bundles, poor web citizenship, hostile to the Liquid Glass UI layer. |

---

## 3. Simulation backend → Python 3.12 + FastAPI

Unchanged — and the local-only pivot makes it *more* clearly correct, not less.

### The decisive argument: the research artifacts are Python artifacts

This is not a preference. Three hard dependencies pin the backend to Python:

1. **`ml_models/object_classifier.joblib` is a scikit-learn model.** There is no faithful way to load it from Node, Go or Rust. Retraining it in another framework means **the paper's ROC AUC of 0.94 no longer describes the model you ship** — and [[Rules#Honesty rules]] forbids presenting a number that the code doesn't produce.
2. **`scipy.spatial.cKDTree`** does the broad-phase spatial hashing that turns O(N²) screening into ~O(N log N). The paper names it explicitly.
3. **NumPy / SciPy** carry the covariance mathematics — `J·C·Jᵀ`, matrix inversion for the Mahalanobis distance, the asymptotic `P_c` integral. Hand-rolling linear algebra in a weaker numerical environment is exactly how silent errors enter physics code.

Plus **Skyfield** for high-precision ephemeris, and **`sgp4`** with `omm.initialize()` for the canonical OMM path ([[Data-Strategy#⭐ The canonical orbital-data model]]).

The golden-file test — reproducing **D_M = 1.84** and **P_c = 4.2 × 10⁻³** from the 2009 element sets — is this project's proof that it is correct. Changing language puts that at risk in exchange for nothing.

### "Why not just use TypeScript everywhere?"

It is the obvious temptation: one language, `satellite.js` on both sides, one mental model. It fails on contact with the list above. You would either retrain the classifier (invalidating a published result) or run a Python sidecar for the ML — and **one language with a hidden Python dependency is worse than two languages with an explicit HTTP boundary.**

### What local-only changes

Nothing about the choice, and everything about the pressure on it:

| | Public deployment | Local only |
| --- | --- | --- |
| Cold starts | 15-min spin-down, ~1 min wake | ✅ Always warm |
| Memory | 512 MB ceiling | ✅ Your machine |
| Database | 0.5 GB free tier | ✅ Local Postgres, unbounded |
| Startup cost | Had to be seconds | ✅ Irrelevant |

Python's weakest traits in a serverless free tier — cold start and memory footprint — **stop mattering entirely** when it runs in Docker on your own machine.

---

## 4. Shared code — across two separate repositories

> 🔴 **Revised 2026-08-13.** The portfolio lives in its **own folder and its own repo**, not inside the simulation monorepo. That means the shared packages can no longer be imported by relative path, and this needs a deliberate answer.

```
REPO 1 — C:\VS Code\orcas          REPO 2 — <new folder>, created later
  the simulation                     the portfolio
  ├─ backend/       Python           ├─ src/pages/      Astro
  ├─ frontend/      React+R3F        ├─ src/islands/    React island
  └─ packages/                       └─ package.json
       ├─ orcas-physics/  ⭐ source of truth
       └─ orcas-scene/    ⭐
                    │
                    │  published as versioned npm packages
                    ▼
            @orcas/physics  ·  @orcas/scene
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
  simulation frontend      portfolio island
  (workspace link)         (npm dependency)
```

### The packages

```
packages/orcas-physics/     pure TypeScript — no React, no DOM
   satrec-from-omm.ts       json2satrec wrapper
   propagate.ts             position/velocity at t
   coordinates.ts           ECI → ECEF → geodetic, GMST
   types.ts                 OmmRecord, SatState

packages/orcas-scene/       R3F components
   Earth.tsx  Satellites.tsx  OrbitPath.tsx  Starfield.tsx
```

**The rule stands:** `orcas-physics` is pure and framework-free, unit-testable in isolation, and **identical in both consumers**. If propagation is ever wrong, it is wrong in exactly one place.

### How the portfolio gets them

| Option | Verdict |
| --- | --- |
| **Publish to npm** as `@orcas/physics`, `@orcas/scene` ⭐ | **Recommended.** Free for public packages, one `npm publish`, explicit version pinning, and it works in Cloudflare Pages CI with no special setup. The version boundary becomes visible instead of implicit. |
| `npm link` / `file:../orcas/packages/...` | Works on your machine, **breaks the Pages build** — CI has no sibling folder. Fine for local iteration, never for a committed dependency. |
| Git submodule | Fragile, easy to leave un-updated, and painful in CI. |
| Copy the files across | ❌ **This is the failure mode the whole package exists to prevent.** Two propagators will diverge and you will not notice until a number is wrong. |

> **Until the portfolio actually needs them** (Phase PA3), the packages live only in the simulation repo and nothing is published. Publishing is a PA2/PA3 concern — don't set up npm publishing during the restructure.

The portfolio demo is a **strict subset** — same components, smaller dataset, no backend calls. It must never depend on anything that requires the simulation to be running.

---

## Decision summary

| Question | Answer | Confidence |
| --- | --- | --- |
| Portfolio framework | **Astro 5 + TypeScript** | High — islands architecture is the exact fit |
| Portfolio interactivity | **React islands**, reusing simulation components | High — the reuse argument is decisive |
| Simulation frontend | **React 19 + R3F + TypeScript** | High — no real competitor |
| Simulation backend | **Python 3.12 + FastAPI** | **Very high — the ML model and numerical stack make it non-negotiable** |
| Unify on one language? | **No.** Two languages, one HTTP boundary. | High |
| Styling | Tailwind v4 + shared `tokens.css` | High |

---

**Related:** [[PRD]] · [[Architecture]] · [[Deployment]] · [[Rules]] · [[Design]] · [[Data-Strategy]] · [[Phases]]
