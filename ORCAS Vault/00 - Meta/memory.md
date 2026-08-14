---
title: memory
type: meta
updated: 2026-07-28
status: active
---

# memory

> **READ ME FIRST, EVERY SESSION.**
> This file exists so a new agent — or you after a week away — can resume without re-reading the whole vault. That saves a large amount of context and tokens.

> [!important] UPDATE IT REGULARLY
> Worthless the moment it goes stale. Update at the **end of every session**, or when `/sync` is issued. Procedure: [[Rules#The /sync command]].

---

## 🔖 Current state — 2026-08-13

> 🔴 **THE BIG ONE — the two properties swapped roles on 2026-08-13 (evening).**
>
> | | Then | **Now** |
> | --- | --- | --- |
> | 🌍 Portfolio | a sibling site, later | ⭐ **THE shipped public product. Ships first.** |
> | 🛰️ Simulation | the public product | **Local-only. `localhost`. Never deployed.** |
>
> **Why it matters to you as an agent:** most free-tier constraints in this vault applied to the *simulation* and **no longer apply at all**. Local Postgres has no 0.5 GB ceiling, textures have no 25 MiB cap, `data/` (124 MB) can be used freely on disk, there are no cold starts. Only the portfolio — a static Astro site — carries deployment constraints, and it will never approach one. Don't reintroduce the old limits. See [[PRD]] and [[Stack]].

**Active workstream:** restructure decided 2026-07-27, **documentation-only so far — still no code.**

**✅ The ICSSIT 2026 talk is delivered** (28 Jul). Paper is in the camera-ready proceedings, pp. 1769–1774, ISBN 979-8-3315-8087-2 — **not yet on IEEE Xplore**. Full status: [[ORCAS Research Paper#Publication record]].

**✅ 2026-08-13 — every blocking decision is now made.** Q1–Q8 all answered ([[Open-Questions#Decided]]). Headlines:

| | Decision |
| --- | --- |
| Repo | **Monorepo**, and a **fresh one** — no history rewrite, nothing large ever committed |
| Orbital data | **OMM is canonical.** TLE is a legacy import adapter only. |
| The 6-digit blocker | ✅ **Gone.** `satellite.js json2satrec()` (v6.0.0+) and Python `sgp4 omm.initialize()` both take OMM directly. |
| Cache | **No Redis in v1.** `CacheService` + `MemoryCache`; GitHub Actions cron for scheduling. |
| 3D models | ~30–50 curated in 3 tiers, licence record each |
| Debris swarm | Ships in v1, labelled as simulation, `source_type` keeps it out of screening |
| Domain | `orcas.space` |

**✅ 2026-08-13 (evening) — the stack question is settled.** Full reasoning in [[Stack]]:

| Surface | Language | Framework |
| --- | --- | --- |
| Portfolio | TypeScript | **Astro 5** (islands) |
| Portfolio ORCAS demo | TypeScript | React 19 + R3F island |
| Simulation frontend | TypeScript | React 19 + R3F + Vite |
| Simulation backend | **Python 3.12** | FastAPI |
| Shared physics | TypeScript | pure, framework-free |

**Two languages, one HTTP boundary.** Python is non-negotiable for the backend — the `.joblib` classifier, `cKDTree` and the NumPy/SciPy covariance maths are the research itself; changing language risks the golden-file test for no gain.

**📁 Two repositories, decided 2026-08-13 (evening):**

| Repo | What | Public |
| --- | --- | --- |
| `C:\VS Code\orcas` | The simulation — restructured **in place**, fresh git history | Eventually (P6) |
| *(new folder, later)* | The portfolio — Astro | ✅ Deployed |

Consequence: `packages/orcas-physics` + `orcas-scene` must be **published to npm** for the portfolio to use them. A `file:../` path import works locally and breaks the Pages build. Not needed until PA3 — don't set up publishing during the restructure. [[Stack#4. Shared code — across two separate repositories]]

**Immediate priority:** run [[Prompt - Simulation Restructure]] — restructures this folder in place. Then **PA1: new folder, Astro, deployed early** even if ugly.

> 📋 Starting a fresh Claude Code session? Paste [[Handoff - Claude Code Briefing]] — it orients a cold agent in 60 seconds and heads off the four mistakes they reliably make here.

**Current phase:** P0, not started.

---

## ✅ What has been completed

### Research
- [x] Paper **ACCEPTED** — 24 Jun 2026, ICSSIT 2026, **Paper ID 1849**, technically sponsored by IEEE SMC Society
- [x] IEEE copyright transferred · registration paid (₹12,000) · online mode approved
- [x] Presentation slot confirmed: 28 Jul, 02:40–03:00 PM IST, Parallel Session 5
- [x] 12-slide deck built and verified → presenting `Paper ID-1849.pptx`
- [x] Revision pack written → [[Presentation Prep]] + [[Presentation Script]] with expanded Q&A drill and math self-test
- [x] **Talk delivered — 28 Jul 2026.** Certificate of participation received.
- [x] Paper confirmed **in the camera-ready proceedings** — ISBN 979-8-3315-8087-2, pp. 1769–1774. Xplore checked same day: not yet indexed (expected — conference runs through 30 Jul).

### Documentation
- [x] Obsidian vault created and **fully rewritten for the new direction (2026-07-27)**
- [x] `CLAUDE.md` written and updated

### Existing code (to be replaced)
- [x] Old FastAPI backend — ⚠️ **unstable, being replaced entirely**
- [x] `frontend-three/` — real `satellite.js` SGP4, Kessler swarm, heatmap, historical replay, CSV export. ⚠️ 1,391-line `App.jsx`
- [x] `frontend-3d/` — ❌ **fake physics, to be deleted**
- [x] `frontend/` — CesiumJS, ❌ to be deleted
- [x] Random Forest classifier → `ml_models/object_classifier.joblib` (**kept**)

---

## 📂 Which files are currently being worked on

| Area | State |
| --- | --- |
| `ORCAS Vault/**` | 🟢 Rewritten today for the new direction |
| `Paper ID-1849.pptx` | ✅ Final, verified, presenting tomorrow |
| `backend/` (old) | 🔴 Frozen. Do not repair. Replaced in P1, deleted in P6. |
| `frontend-three/` | 🟡 Foundation for the new frontend. Do not extend `App.jsx`. |
| `frontend-3d/` | ⚫ Marked for deletion at P4 start |
| `frontend/` (Cesium) | ⚫ Marked for deletion at P4 end |
| New `backend/`, new `frontend/` | ⚪ Not started |

---

## 🧠 Things a new agent must know

1. **Two submissions of the same paper, two outcomes. Never mix them up.**

   | ID | Venue | Status |
   | --- | --- | --- |
   | **1849** | ICSSIT 2026 (IEEE SMC Society) | ✅ **Accepted, presented 28 Jul, in the proceedings** pp. 1769–1774. Not yet on Xplore. |
   | **1655** | IEEE TEMSMET 2026 (CMT) | ❌ **Rejected 12 Aug 2026.** Closed. |

   1849 is the one that counts and the only one to cite. 1655 is closed — don't list it, don't count it as a second publication, and don't let a future agent describe the work as "rejected" on the strength of it. Detail and the ethics note: [[ORCAS Research Paper#⚠️ The other submission — Paper ID 1655, TEMSMET 2026: **REJECTED**]].

2. **Six authors.** Fenil is first author and states he did all the implementation work himself. Both things are true at once, and the published byline lists six names — so **never write "sole author" or "solo project"**. The agreed framing claims the work *specifically* (naming the five components he built) rather than denying the byline. Exact approved wording: [[Open-Questions#Decided]], Q3 callout.

3. ⚠️ **CORRECTION — `frontend-3d` physics is fake.** Earlier vault versions called it "the port base" because its file structure is clean. That was wrong. Its `useSGP4Propagator` is `angle += speed` with `velocity = 7.66 - sin(angle*2)*0.25`. It never imports `satellite.js`. **`frontend-three` is the real one** — it uses `twoline2satrec`, `propagate`, `gstime`, `eciToGeodetic`. `frontend-3d` is deleted, nothing salvaged.

4. ⚠️ **TLE format is being retired — and OMM is now the canonical format, not a workaround.** CelesTrak exhausted 5-digit catalog numbers on **2026-07-11**. New objects get 6-digit IDs (100000+) with **no TLE representation at all**. Ingest **OMM JSON**; store `norad_id` as **VARCHAR**.
   ✅ **The old "can satellite.js even do this?" unknown is resolved** — `json2satrec()` since v6.0.0, and Python `sgp4` has `omm.initialize()`. Neither propagator needs TLE text. Full architecture, code samples and the v6→v7 breaking changes: [[Data-Strategy#⭐ The canonical orbital-data model]].
   ⚠️ `satellite.js` **v7 is ESM-only**, `propagate` returns `null` on failure, and `ndot`/`nddot` units changed. Don't copy v6-era snippets from `frontend-three` without checking.

5. ✅ **Hosting is now almost a non-question, because only the portfolio deploys.**
   **Portfolio** → Cloudflare Pages, static Astro, `<name>.pages.dev`, unlimited bandwidth, **no card**. The one limit worth checking is **25 MiB per file**.
   **Simulation** → not deployed. `docker compose up` on your machine. No hosting, no cost, no limits.
   A custom domain is the only thing that would cost money, and it is deferred.

   *Retained for if the simulation is ever published* — these were verified on 2026-08-13 and would apply again: **Fly.io** has no free tier · **Render Postgres** free DBs are *deleted* at 30 days · **Cloudflare R2** needs a card · **Supabase** pauses when idle · **Neon** is the right free host (degrades on volume, never deletes data). [[Deployment#⚰️ Withdrawn recommendations — read before reinstating anything]].

6. **Backend is rebuilt from scratch, not repaired.** Python + FastAPI stays (Skyfield/sgp4/sklearn are the research). The failure was architectural: blocking I/O in handlers, no layering, no tests, config everywhere. The old `backend/` is deleted only in P6, after parity is proven.

7. **One frontend folder, permanently.** That is the point of the restructure.

8. **Everything runs in Docker** — **four services, not five.** `frontend`, `backend`, `worker`, `postgres`. **No Redis in v1** (decided 2026-08-13); caching is in-process behind a `CacheService` interface. `docker compose up` must produce a working system in one command. See [[Docker]].

8b. **Restructure in place, fresh git history.** The simulation stays at `C:\VS Code\orcas`. The existing `.git` has **47 commits and a 217 MiB pack** because `data/` was committed (117 files) — `.gitignore` cannot undo that, so: bundle the history to an archive, `rm -rf .git`, re-init in the same folder. `data/` stays on disk, gitignored, and is now **freely usable** since the simulation is local. `frontend-three` moves to a gitignored `legacy/` holding pen — **do not delete it**, it is the only real SGP4 implementation and Phase 4 salvages from it.

9. **The portfolio is the product that ships; the simulation is a personal tool.** Reversed on 2026-08-13 — see the callout at the top. The simulation is still NASA-Eyes-class in ambition, it just isn't public. "ORCAS OS" remains retired.

9b. **One physics implementation, shared.** `packages/orcas-physics` (pure TypeScript) and `packages/orcas-scene` (R3F) are imported by *both* the Astro demo island and the simulation frontend. Never write a second propagator for the portfolio — two implementations diverge silently, and this project's credibility rests on the physics being right.

10. **Design language is Apple Liquid Glass**, visual identity entirely original. See [[Design]].

11. **Solar System view is Phase 7 but constrains Phase 4.** Log depth buffer + scale contexts must be designed in now — [[Architecture#Scale strategy]].

---

## ⏭️ Next actions

1. 🔴 **Run [[Prompt - Simulation Restructure]]** — restructures `C:\VS Code\orcas` in place. Backup-first, stops at three checkpoints. *(The older [[Prompt - Phase 0 Scaffold]] is superseded.)*
2. 🟡 **Rotate the NASA key** — hygiene, downgraded: it was never committed to git.
3. 🌍 **PA1 — new folder, Astro site, deployed early even if ugly.** Getting the deploy pipeline working before the content is polished is the point.
4. Then PA2 → PA3 → **PA4 ship**. The simulation track follows at whatever pace suits.
5. Passive: watch for the IEEE Xplore listing (title or ISBN 979-8-3315-8087-2). When it lands, add the DOI and drop "pending Xplore" from [[ORCAS Research Paper]], [[Conference - ICSSIT 2026]], [[Home]] and `CLAUDE.md`.

---

## ⚠️ Known issues

> 🔎 **Audited on disk 2026-08-13.** Two claims in earlier versions of this table were wrong. Corrected below.

| Issue | Severity | Note |
| --- | --- | --- |
| `backend/.env` | 🟡 **Downgraded from High** | ✅ **It was never committed** — `git ls-files` finds no `.env` anywhere. It exists in the working tree only. Rotate the NASA key as hygiene; it is *not* a public-leak emergency. |
| `data/` committed to git | 🟠 **Upgraded — this is the real problem** | **117 files are tracked**, including `de421.bsp`. Pack size is **217 MiB** across 47 commits. Not fixable by `.gitignore` alone — it needs fresh history ([[Prompt - Simulation Restructure]]). |
| Repo inventory was incomplete | ✅ Fixed | The vault listed 8 top-level items; there are 20+. `data_analysis/generate_ml_plots.py` **produces the paper's figures** and was undocumented — it must survive the restructure. |
| `satellite.js` vs 6-digit catalog numbers | ✅ Resolved | `json2satrec()` since v6.0.0. Not a blocker. |
| `satellite.js` v6→v7 breaking changes | 🟡 Low | ESM-only, `propagate`→`null`, `ndot`/`nddot` units. Bites only when porting old snippets. |
| `frontend-three/App.jsx` 1,391 lines | 🟡 Low | Decomposed in P4 |
| `allow_origins=["*"]` in old backend | 🟡 Low | Dies with the old backend |
| Old backend unstable | — | Being replaced, not fixed |

---

## 📜 Session log

| Date | Agent | What happened |
| --- | --- | --- |
| 2026-07-27 | Claude | Audited repo and documents. Found paper acceptance in Gmail (corrected "submitted" → "accepted"; Paper ID 1849, not 1655). Built the 12-slide ICSSIT deck. Created the vault + `CLAUDE.md`. Added presentation slot to calendar. Wrote [[Presentation Prep]]. **Then: major restructure decided** — new backend from scratch, single frontend, full Docker, simulation-platform direction. Rewrote PRD, Phases, Architecture, Data-Strategy, Deployment, Design, Branding, UI-Research, Rules; added [[Docker]]. Discovered `frontend-3d` physics is fake and the TLE format is being retired. |
| 2026-07-28 | Claude | Wrote [[Presentation Script]] with a measured (not estimated) timing table — 2,096 words ≈ 15:53, added trim guidance — then added a Q&A drill and a math self-test (dimensional analysis, `JCJᵀ` derivation, `exp(−D_M²/2)` interpretation, confusion-matrix arithmetic with an honest caveat about unlabelled cell order). **Talk delivered.** User uploaded the certificate of participation, the camera-ready proceedings paper, and the payment receipt. Confirmed via IEEE Xplore search: paper is in the proceedings (ISBN 979-8-3315-8087-2, pp. 1769–1774) but not yet indexed on Xplore. Filed the three documents in `C:\orcas\` as `ICSSIT 2026 Certificate.pdf`, `ICSSIT 2026 Paper (Camera-Ready).pdf`, `ICSSIT 2026 Receipt.pdf`. Updated [[ORCAS Research Paper]], [[Conference - ICSSIT 2026]] and [[Home]] to the three-state publication wording (accepted → in proceedings → pending Xplore), confirmed with the user first since publication-status wording is an ask-first boundary. |

| 2026-08-13 | Claude | **Answered Q1–Q8; all blocking questions cleared.** Monorepo · fresh repo (no history rewrite) · **OMM canonical, TLE legacy adapter only** · Redis dropped from v1 · ~30–50 curated 3D models in 3 tiers · debris swarm ships labelled as simulation · `orcas.space`. Verified against upstream changelogs that `satellite.js json2satrec()` exists since v6.0.0 and Python `sgp4` has `omm.initialize()` — **this resolves the old Q2 blocker**. Also caught that current `satellite.js` is v7.1.0 with breaking changes (ESM-only, `propagate`→`null`, `ndot`/`nddot` units) and a WASM bulk-propagation API worth evaluating for the 60 FPS target. Corrected three errors in the source recommendation Fenil brought in: it assumed a **Node** backend (this project is Python/FastAPI), named **Cesium** as the renderer (being deleted), and placed `satellite.js` in the backend (it's a JS library — the backend needs Python `sgp4`). Rewrote Data-Strategy §1/§4/§6/§9, Open-Questions, Phases P0/P1/P2/P4, Rules, Docker, Architecture, Deployment, Git-Workflow. |

| 2026-08-13 *(later)* | Claude | **Zero-cost constraint hardened + TEMSMET rejection recorded.** Fenil required ₹0 with no payment method on file. Verified free tiers and **withdrew two more recommendations**: Render Postgres (free DBs are *deleted* 30 days after creation — would have destroyed the catalogue a month post-launch) and Cloudflare R2 (needs a card). Also ruled out Supabase (pauses when idle). New stack: **Cloudflare Pages hosting frontend AND assets** (no bucket needed — footprint <100 MB, no file near the 25 MiB cap) + **Neon** (permanently free, degrades on volume not time) + Render web service + GitHub Actions cron + free `orcas.pages.dev`. **Recalculated retention** — the old 90-day element-set policy implied 3.5 GB, 7× the 0.5 GB Neon limit; cut to latest + 48 h (~140 MB with indexes), with the 2009 reconstruction pinned as committed sample data so the research result never depends on retention. Recorded the **TEMSMET 2026 rejection of Paper 1655** (12 Aug) — ICSSIT 1849 unaffected; noted the venue mismatch and the concurrent-submission risk the rejection incidentally closed. Wrote [[Prompt - Phase 0 Scaffold]], ready to run. |

| 2026-08-13 *(evening)* | Claude | **🔴 The two properties swapped roles.** Portfolio becomes the shipped public product; simulation becomes local-only, `localhost`, never deployed. Wrote [[Stack]] settling the language question across all four surfaces: **Astro 5** for the portfolio (islands architecture won it — the demo can reuse the *same* React/R3F components, which Svelte or Hugo would have forced a second implementation of), React 19 + R3F for both frontends, **Python + FastAPI** for the backend (non-negotiable: the `.joblib` classifier, `cKDTree` and NumPy/SciPy covariance maths *are* the research). **Relaxed everything the free tier was costing the simulation** — 90-day retention restored (was cut to 48 h this morning), full-resolution textures, `data/` usable locally, no cold starts. Rewrote PRD §1/§3/§5/§6/§7, Data-Strategy §4/§7, Deployment (now portfolio-only), Phases (split into a 🌍 portfolio track that ships first and a 🛰️ simulation track, added PA1–PA4). Added `packages/orcas-physics` + `orcas-scene` as the single shared implementation. |

| 2026-08-13 *(late)* | Claude | **Audited the actual repo on disk — the vault was wrong about it in two ways.** ✅ `backend/.env` was **never committed** (`git ls-files` finds no `.env`), so the "🔴 High — secret going public" item is downgraded to hygiene. 🔴 But `data/` **is** committed — 117 files, **217 MiB pack**, 47 commits — which `.gitignore` cannot undo. Also found 8+ undocumented top-level dirs, including **`data_analysis/generate_ml_plots.py`, which generates the paper's figures** and could easily have been deleted as clutter. Decided: **restructure in place with fresh history** (bundle-archive → `rm -rf .git` → re-init), and **portfolio moves to its own separate repo** — which means the shared packages must be **npm-published**, not path-imported. Wrote [[Prompt - Simulation Restructure]] (supersedes the Phase 0 scaffold prompt); updated Stack §4, Git-Workflow, Open-Questions (Q1b, Q5b), CLAUDE.md repo layout. |

<!-- Append new rows above. Newest at the bottom. -->
