---
title: Prompt — Phase 0 Scaffold
type: meta
updated: 2026-08-13
status: superseded
---

# Prompt — Phase 0 Scaffold

> [!warning] ⚠️ **SUPERSEDED — use [[Prompt - Simulation Restructure]] instead.**
> This version assumed a **new empty directory** and a single monorepo containing both the portfolio and the simulation. Two things changed on 2026-08-13 (evening):
> 1. The restructure happens **in place** in `C:\VS Code\orcas`, which has 47 commits and a 217 MiB pack that need handling.
> 2. The **portfolio moves to its own separate folder and repo**, so it is not scaffolded here at all.
>
> Kept for reference — the reasoning notes at the bottom still apply.

> Copy everything in the block below into Claude Code, in an **empty directory** that will become the new ORCAS repository.
> Governing notes: [[Phases#Phase 0 — Foundation and decisions]] · [[Rules]] · [[Docker]] · [[Architecture]] · [[Deployment]]

**Before you run it:**

1. Create the empty target directory. Do **not** run this inside `C:\VS Code\orcas` — that is the *old* tree and Phase 0 is a fresh repository ([[Open-Questions#Decided]] Q5).
2. Copy `ORCAS Vault/` and `ml_models/object_classifier.joblib` into the new directory first, so `CLAUDE.md` and the vault are present for the agent to read.
3. Have your Neon connection string ready — **not** needed for this prompt, but it's the next step.

---

## The prompt

```text
Scaffold Phase 0 of the ORCAS monorepo in this directory. This is a FRESH repository —
do not import history from anywhere, and do not copy the old backend, frontend-3d, or
the Cesium frontend.

Read these first, in order, and follow them as binding:
  1. ORCAS Vault/00 - Meta/memory.md
  2. ORCAS Vault/00 - Meta/Rules.md
  3. ORCAS Vault/01 - Product/Phases.md   (Phase 0 section — that is this task)
  4. ORCAS Vault/03 - Engineering/Docker.md
  5. ORCAS Vault/03 - Engineering/Architecture.md

Then confirm in two lines what you understand Phase 0 to be, and STOP for my
confirmation before writing any files.

=== ORDER OF WORK — the first step is not negotiable ===

STEP 1. Before creating any other file, create .gitignore and run `git init`.
The repository will be public and the old tree leaked a .env. Nothing else gets
written until ignores are in place. Cover at minimum:
  .env and .env.*  (but NOT .env.example)
  data/tle/  data/ephemeris/  data/raw/  data/cache/
  __pycache__/  *.pyc  .venv/  .pytest_cache/  .mypy_cache/  .ruff_cache/
  node_modules/  dist/  .vite/
  *.log  .DS_Store  .idea/  .vscode/

STEP 2. Directory skeleton. NOTE this repo has TWO tracks — a public Astro
portfolio and a local-only simulation. See ORCAS Vault/03 - Engineering/Stack.md.

  portfolio/                 Astro 5 + TypeScript — the PUBLIC site (deploys)
  frontend/src/{scene,ui,physics,data,state,hooks,styles}/
                             React 19 + R3F + Vite — simulation UI (local only)
  backend/app/{api,schemas,services,domain,infra,workers}/
                             FastAPI — local only, never deployed
  packages/
    orcas-physics/           pure TypeScript, shared by BOTH frontends
    orcas-scene/             R3F components, shared by BOTH frontends
  workers/
  infra/docker/
  scripts/
  ml_models/                 (already contains object_classifier.joblib — leave it)
  data/sample/               (small committed fixture set, see STEP 7)
  ORCAS Vault/               (already present — do not modify)

Use a workspace setup (npm workspaces or pnpm) so portfolio/ and frontend/ can both
import from packages/. Scaffold packages/* as real buildable packages, not empty dirs.

STEP 3. docker-compose.yml — EXACTLY FOUR services: frontend, backend, worker, postgres.
There is NO redis service; that was decided against on 2026-08-13. Requirements:
  - `docker compose up` must work with no second step. This is a hard acceptance criterion.
  - healthchecks on postgres and backend; depends_on uses condition: service_healthy
  - worker reuses the backend image with a different command, not a separate image
  - named volume for postgres data

STEP 4. Dockerfiles in infra/docker/ — backend.Dockerfile and frontend.Dockerfile.
Multi-stage (base / deps / dev / prod). Non-root user in every image. Pin base images
to a minor version. Build tools must not reach the prod stage.

STEP 5. Backend skeleton (Python 3.12, FastAPI, uv + pyproject.toml):
  - The layering rule is absolute: domain/ imports NOTHING from api/, infra/, or FastAPI.
    Pure functions over dataclasses. Add a test that asserts this and fails if violated.
  - One Settings object using pydantic-settings. No scattered os.getenv.
  - /health/live and /health/ready only. No business endpoints yet.
  - CORS from an explicit allowlist in Settings. Never ["*"].
  - infra/cache/ with THREE files:
        base.py    CacheService interface (get/set/delete/clear, async)
        memory.py  MemoryCache — TTL-aware in-process implementation
        redis.py   RedisCache — a stub that raises NotImplementedError
    Services depend on the interface only. Nothing imports a cache client directly.
  - Alembic initialised, no migrations yet. Never use create_all().
  - ruff + mypy configured; mypy strict on domain/ and services/.

STEP 5b. Portfolio skeleton (Astro 5 + TypeScript):
  - Astro 5, TypeScript strict, Tailwind v4
  - @astrojs/react integration configured, so React islands work
  - Content collections set up with type-safe frontmatter (empty collections are fine)
  - One placeholder page per route: / , /research , /projects/orcas , /cv , 404
  - styles/tokens.css imported here too — SAME file as the simulation frontend
  - sitemap + robots.txt integrations wired
  - Confirm `npm run build` produces static output in portfolio/dist
  - Content pages must ship ZERO JavaScript. Verify this in the build output.

STEP 6. Simulation frontend skeleton (React 19 + Vite + TypeScript strict):
  - Vite + React 19, tsconfig strict, no `any`
  - Pin exact versions of three, @react-three/fiber, @react-three/drei
  - satellite.js pinned to ^7 — note it is ESM-only in v7
  - Propagation code belongs in packages/orcas-physics, NOT in src/physics/.
    packages/orcas-physics must be pure TypeScript with no React import and must
    be unit-testable with no browser.
  - scene/ and ui/ must not import each other; they talk through state/
  - styles/tokens.css with the palette from ORCAS Vault/02 - Design/Design.md.
    No colour literal may appear outside that file. The portfolio imports the same file.
  - A canvas that renders one placeholder mesh, imported from packages/orcas-scene,
    to prove the workspace wiring actually works end to end. Nothing more.

  IMPORTANT: docker compose runs the SIMULATION only (frontend, backend, worker,
  postgres). The portfolio is a static site built with `npm run build` and is NOT
  a compose service — it is never deployed alongside the backend and must never
  depend on it.

STEP 7. data/sample/ — a small committed fixture set for dev and tests:
  - ~20 objects as canonical OMM JSON records (see Data-Strategy §9.1 for the shape)
  - Include at least one 6-digit catalog number to prove VARCHAR handling
  - Include Iridium 33 and Cosmos 2251 as fixtures for the golden-file test later
  - Keep it small. The 124 MB datasets must NEVER enter this repo.

STEP 8. CI — .github/workflows/ci.yml: ruff, mypy, pytest for the backend; eslint,
tsc --noEmit, vitest for the frontend. Run on push and PR.

STEP 9. .github/workflows/ingest.yml — a scheduled cron stub, `0 */6 * * *` plus
workflow_dispatch. It should log "not implemented" and exit 0 for now. Production
scheduling is GitHub Actions, not an always-on service.

STEP 10. .env.example, committed, matching ORCAS Vault/03 - Engineering/Deployment.md.
No real secret values. Include CACHE_BACKEND=memory and CELESTRAK_FORMAT=json.

=== CONSTRAINTS ===

- norad_id is VARCHAR everywhere it appears. Never INTEGER. 6-digit and Alpha-5
  catalog numbers exist as of 2026-07-11.
- OMM is the canonical orbital-data format. TLE is a legacy import adapter only.
  Do not build any schema around TLE strings.
- No file over 250 lines.
- No `any` in TypeScript. No bare `except:` in Python.
- Every physics function docstring states its units and reference frame.
- Conventional Commits. Commit in logical units as you go, not one giant commit.

=== DEFINITION OF DONE ===

Verify, do not assure. Before you tell me it works:
  1. Run `docker compose up --build` and confirm all four containers reach healthy
  2. Run `docker compose run --rm backend pytest`  — passes
  3. Run `docker compose run --rm backend ruff check .` and `mypy app/domain app/services` — clean
  4. Run `docker compose run --rm frontend npm run build` — succeeds
  5. Run `npm run build` in portfolio/ — succeeds, and confirm content pages
     ship zero JS by inspecting the output
  6. Confirm packages/orcas-scene is genuinely imported by BOTH portfolio/ and
     frontend/ — the shared-package wiring is the thing most likely to be faked
  7. Run `git status` and confirm no .env, no data/tle, no node_modules is staged
  8. Print the output of `git count-objects -vH` — the repo must be small

Report what you actually ran and what it printed. "It should work" is not evidence.

Finally, update ORCAS Vault/00 - Meta/memory.md: mark Phase 0 complete, note anything
you deviated from and why, and record what the next session should pick up.

ASK ME FIRST before adding any dependency that is not already named in
ORCAS Vault/00 - Meta/Rules.md.
```

---

## Notes on why the prompt is shaped this way

**`.gitignore` before anything else.** The old tree leaked `backend/.env`, the repo is going public, and once a secret is committed the only real fix is rotation. Ordering it first removes the failure mode entirely rather than relying on a later audit catching it.

**"Confirm in two lines, then stop."** Matches the read-first instruction in `CLAUDE.md`. It's a cheap checkpoint — if the agent has misread the phase, you find out before it writes forty files.

**The layering test.** `domain/` staying pure is the single rule most likely to erode quietly under time pressure, and it is precisely what made the old backend unstable. A test that fails on violation is worth more than a paragraph of documentation.

**All three cache files up front, including the stub.** Writing `redis.py` as a `NotImplementedError` stub costs nothing now and makes the abstraction real rather than theoretical. If only `memory.py` exists, the first person who needs caching under load will reach for a Redis client directly and the interface dies.

**A 6-digit ID in the sample data.** It's the cheapest possible regression test for the `VARCHAR` decision. If someone types `INTEGER` in a migration six weeks from now, a fixture fails immediately instead of the bug surfacing in production against a real new object.

**Explicit "verify, don't assure" with commands to run.** Per [[Rules#Working style]]. Agents are prone to reporting success from intent rather than observation; naming the six commands and asking for their output makes that hard to skip.

---

**Related:** [[Phases]] · [[Rules]] · [[Docker]] · [[Architecture]] · [[Deployment]] · [[Prompting]] · [[memory]]
