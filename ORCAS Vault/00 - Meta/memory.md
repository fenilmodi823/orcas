---
title: memory
type: meta
updated: 2026-08-14
status: active
---

# memory

> **READ ME FIRST, EVERY SESSION.**
> This file exists so a new agent — or you after a week away — can resume without re-reading the whole vault. That saves a large amount of context and tokens.

> [!important] UPDATE IT REGULARLY
> Worthless the moment it goes stale. Update at the **end of every session**, or when `/sync` is issued. Procedure: [[Rules#The /sync command]].

---

## 🔖 Current state — 2026-08-14

> ✅ **Phase 0 is complete.** [[Prompt - Simulation Restructure]] ran end to end today — fresh git history, new backend/frontend/packages scaffold, four-service Docker stack verified actually running. Full detail in the 2026-08-14 session log row and "Things a new agent must know" below. **Next up: PA1 — the Astro portfolio site**, in its own new folder/repo (this repo does not get a `portfolio/` directory).

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

**Immediate priority:** rotate the NASA key (see "Things a new agent must know" #12 below — this is now the single blocking hygiene item), then start **PA1: new folder, Astro site, deployed early** even if ugly.

> 📋 Starting a fresh Claude Code session? Paste [[Handoff - Claude Code Briefing]] — it orients a cold agent in 60 seconds. **Update its "YOUR NEXT TASK" section** — it still points at the restructure prompt, which is now done.

**Current phase:** P0 ✅ complete (2026-08-14). PA1 not started.

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

### Phase 0 — restructure (2026-08-14, complete)
- [x] Old history archived: `../orcas-history-archive.bundle` (210 MiB, verified, 10 refs incl. `feature/artemis-mission` and 5 `codex/*` branches nobody remembered), `backend/.env` copied to `../orcas-env-backup.txt`
- [x] Fresh git history: `rm -rf .git && git init`, staged and re-checked against `.env`/`data/`/`.venv/`/`node_modules/`/`legacy/` before the first commit
- [x] Deleted (confirmed, git-recoverable via the bundle): `frontend-3d/`, `frontend/` (Cesium), `tools/`, `.venv/`, old root `Dockerfile`/`docker-compose.yml`/`run_docker.bat`/`run_docker.sh`/`pyproject.toml`/`requirements.txt`
- [x] Preserved: `ml_models/object_classifier.joblib` (checksum verified byte-identical), `data_analysis/` → `scripts/analysis/`, `assets/figures/` → `docs/figures/`, `tests/{sample.tle,test_*.py}` folded into `backend/tests/`, `frontend-three/` → `legacy/frontend-three/`, old `backend/` → `legacy/backend-old/`
- [x] Two gaps the restructure prompt itself didn't cover, resolved with the user: root `models/` (`iss.obj`/`iss.mtl`) → `legacy/models/`; `assets/{generations,models,screenshots,textures}/` → `legacy/assets/`
- [x] `packages/orcas-physics` (OMM→SatRec→propagate→geodetic, wrapping `satellite.js` 7.1.0) and `packages/orcas-scene` (Earth/Satellites/OrbitPath/Starfield) scaffolded, both real and tested — see #10 below
- [x] `frontend/` scaffolded — React 19.2.8 + Vite 8.2.1 + TS strict, renders one `<Canvas>` importing `packages/orcas-scene` end to end
- [x] `backend/` scaffolded — FastAPI, `api/schemas/services/domain/infra/workers` layering, `/health/live` + `/health/ready` only, `CacheService`/`MemoryCache`/`RedisCache` (stub), Alembic (async, no migrations), uv-managed, Python 3.12.12 pinned. Layering-enforcement test in place before there's any domain code to check.
- [x] `docker-compose.yml` — four services, no Redis, all actually verified running (see #11)
- [x] `data/sample/omm-sample.json` — 21 synthetic OMM fixtures, all propagated through the real `satellite.js` before committing
- [x] `.github/workflows/ci.yml` — ruff, mypy, pytest, eslint, tsc, vitest
- [x] All 10 Definition-of-Done checks from [[Prompt - Simulation Restructure]] verified with real command output (pack size 217 MiB → 3.59 MiB)

---

## 📂 Which files are currently being worked on

| Area | State |
| --- | --- |
| `ORCAS Vault/**` | 🟢 Current |
| `Paper ID-1849.pptx` | ✅ Final, delivered, filed in `C:\orcas\` |
| `backend/` (new) | 🟢 P0 scaffold only — health endpoints, layering enforced, no business logic. P1 fills `domain/`. |
| `frontend/` (new) | 🟢 P0 scaffold only — one placeholder `<Canvas>`. P4 does the real UI. |
| `packages/orcas-physics`, `packages/orcas-scene` | 🟢 Real, tested, imported by `frontend/`. PA2 extends for the portfolio demo. |
| `legacy/frontend-three/` | 🟡 Gitignored holding pen. Real SGP4 — P4 salvages from it, do not delete. |
| `legacy/backend-old/` | 🔴 Gitignored holding pen. Frozen, deleted after P1 proves parity. |
| `legacy/models/`, `legacy/assets/` | 🟡 Gitignored holding pen — `iss.obj`/`iss.mtl` and pre-restructure `assets/{generations,models,screenshots,textures}/`. P2's 3D asset pipeline picks through these. |
| `data/sample/omm-sample.json` | 🟢 21 synthetic fixtures, committed. Iridium 33 / Cosmos 2251 deliberately NOT yet added — see `data/sample/README.md`. |
| `frontend-3d/`, `frontend/` (Cesium), `tools/` | ⚫ Deleted 2026-08-14, recoverable from `../orcas-history-archive.bundle` |

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

12. 🔴 **The NASA key still hasn't actually been rotated.** It was carried forward verbatim from `legacy/backend-old/.env` into the new root `.env` (gitignored, not committed) so `docker compose up` works out of the box. Every prior memory entry saying "rotate as hygiene, not urgent" is now the most concrete open item in the repo — an agent can't rotate it (that's an api.nasa.gov account action), so this needs Fenil directly.

13. ⚠️ **Iridium 33 / Cosmos 2251 are deliberately NOT in `data/sample/`.** Phases.md/Data-Strategy.md both call for their real 2009 element sets as committed fixtures for the Phase 1 golden-file test. Their identities are well-documented (NORAD 24946 / 22675) but their precise elements at the 2009-02-10 epoch are not something to reconstruct from memory — [[Rules#Honesty rules]] says never invent a number, and fabricating orbital elements for the paper's own validation case would be exactly that. **Phase 1 must pull these from Space-Track.org** before writing the golden-file test. Full note: `data/sample/README.md`.

14. **The restructure prompt itself had two blind spots**, both resolved with Fenil during the session rather than guessed: root `models/` (`iss.obj`/`iss.mtl`) and `assets/` subfolders beyond `figures/` had no assigned disposition in [[Prompt - Simulation Restructure]]. Both went to `legacy/` (see the "Which files" table above). If a future restructure-style prompt is written, assume it can still have gaps — enumerate and ask rather than trusting the prompt's own inventory is exhaustive.

15. **Two real Docker bugs were found and fixed while verifying, not while writing.** (1) The pre-restructure `.dockerignore` excluded `frontend/` and `tests/` wholesale — inherited unchanged from the old repo, it silently broke the frontend image build until `docker compose up` was actually run. (2) `backend`/`worker` both bind-mount `./backend:/app`; a stray Windows-native `backend/.venv/` on the host (left over from local `uv sync` testing) got bind-mounted into both Linux containers and corrupted package installs. Fixed with per-service named volumes (`orcas-backend-venv`, `orcas-worker-venv`) at `/app/.venv`, plus `UV_CACHE_DIR=/tmp/uv-cache` and an explicit `chown` before switching to the non-root user. **Lesson: `docker compose build` succeeding is not the same as the stack actually running — always run `up` and hit the endpoints before calling Docker done.**

16. **Root-level `workers/` from the restructure prompt's target structure was deliberately not created.** Architecture.md's own repo layout hedges "workers/ ← ingestion/scheduler (**may live in backend image**)" — and it does: `backend/app/workers/scheduler.py` plus the `worker` compose service reusing the backend image already cover this. An empty top-level stub would just be an unused directory. If Phase 2's ingestion work outgrows `backend/app/workers/`, split it out then.

---

## ⏭️ Next actions

1. 🔴 **Rotate the NASA key.** Now the top item — it's sitting in the new root `.env` verbatim from the old one. Visit api.nasa.gov, generate a new key, update `.env` locally. This is a Fenil action, not an agent one.
2. 🌍 **PA1 — new folder, Astro site, deployed early even if ugly.** Getting the deploy pipeline working before the content is polished is the point. This repo does not get a `portfolio/` directory — separate folder, separate repo, per [[Stack#4. Shared code]].
3. Then PA2 (publish `packages/orcas-physics`/`orcas-scene` for the portfolio) → PA3 (demo island) → **PA4 ship**. The simulation track (P1 backend business logic, starting with `domain/`) follows at whatever pace suits.
4. 🟡 **When P1 starts:** source the real Iridium 33 / Cosmos 2251 2009 element sets from Space-Track.org before writing the golden-file test — see #13 above and `data/sample/README.md`. Don't reconstruct them from memory.
5. Passive: watch for the IEEE Xplore listing (title or ISBN 979-8-3315-8087-2). When it lands, add the DOI and drop "pending Xplore" from [[ORCAS Research Paper]], [[Conference - ICSSIT 2026]], [[Home]] and `CLAUDE.md`.

---

## ⚠️ Known issues

> 🔎 **Restructure completed and verified 2026-08-14.** The `data/` and repo-inventory issues below are now resolved. Only the NASA key remains open.

| Issue | Severity | Note |
| --- | --- | --- |
| NASA API key not rotated | 🟡 **The one open item** | Carried forward into the new `.env` verbatim. Needs Fenil to visit api.nasa.gov — see Next actions #1. |
| `data/` committed to git | ✅ **Resolved 2026-08-14** | Fresh history via bundle-archive + `rm -rf .git` + re-init. Pack is now 3.59 MiB, not 217 MiB. `data/*` gitignored except `data/sample/`. |
| Repo inventory was incomplete | ✅ Resolved | Restructured per the corrected 20+ item inventory. Two further gaps the restructure prompt itself missed (`models/`, `assets/` subfolders) were found and resolved during the restructure — see #14. |
| Iridium 33 / Cosmos 2251 sample data | 🟡 **Open, scoped to P1** | Deliberately not fabricated — see #13. Real element sets need sourcing from Space-Track.org before the golden-file test. |
| `satellite.js` vs 6-digit catalog numbers | ✅ Resolved | `json2satrec()` since v6.0.0, pinned to v7.1.0 in the new packages. |
| `satellite.js` v6→v7 breaking changes | 🟡 Low | Handled in `packages/orcas-physics` (propagate throws on `null`, not silent). |
| `frontend-three/App.jsx` 1,391 lines | 🟡 Low | Now in `legacy/frontend-three/`, decomposed in P4 |
| `allow_origins=["*"]` in old backend | ✅ Resolved | New backend uses an explicit localhost allowlist from `Settings` |
| Old backend unstable | — | Frozen in `legacy/backend-old/`, replaced not fixed |

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

| 2026-08-14 | Claude | **Ran [[Prompt - Simulation Restructure]] end to end — Phase 0 complete.** Backed up first (bundle verified, 210 MiB, 10 refs incl. two branches nobody remembered; `.env` copied out). Inventoried all top-level entries — matched the known 2026-08-13 audit exactly, but found `frontend/` and `frontend-3d/` had their `node_modules` **tracked in git** (22,491 files, likely the biggest single contributor to the 217 MiB pack) and found two gaps in the restructure prompt's own disposition table (`models/`, `assets/` subfolders) — resolved both with Fenil rather than guessing. Fresh history: `rm -rf .git && git init`, staged, checked for forbidden paths, committed (pack now 3.59 MiB). Deleted the confirmed items; preserved everything else, checksummed the `.joblib` before and after (byte-identical). Scaffolded the full P0 target structure — `packages/orcas-physics` (real, wraps `satellite.js` 7.1.0, vitest regression test baselined against actual library output, not invented numbers), `packages/orcas-scene` (R3F components), `frontend/` (renders one `<Canvas>` importing the scene package), `backend/` (FastAPI, strict layering with an enforcement test, health-only, `CacheService`/`MemoryCache`/`RedisCache` stub, Alembic, uv/Python 3.12.12), `docker-compose.yml` (4 services), CI workflow. Built `data/sample/omm-sample.json` — 21 synthetic fixtures actually propagated through `satellite.js` before committing — but **deliberately did not fabricate Iridium 33 / Cosmos 2251's 2009 orbital elements**, since [[Rules#Honesty rules]] bans inventing numbers and their real elements need sourcing from Space-Track.org; documented this as an explicit P1 gap rather than papering over it. Ran the full Definition-of-Done checklist against real command output, which surfaced and fixed two genuine bugs: a pre-restructure `.dockerignore` silently excluding `frontend/`/`tests/` from the Docker build context, and a host-side stray `.venv` corrupting containers via bind mount (fixed with per-service named volumes). Carried the NASA key forward into the new `.env` rather than inventing a rotation that didn't happen — flagged as the one open hygiene item, now the top of Next Actions since it needs Fenil's action, not an agent's. |

<!-- Append new rows above. Newest at the bottom. -->
