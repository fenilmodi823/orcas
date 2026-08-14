---
title: Prompt — Simulation Restructure
type: meta
updated: 2026-08-13
status: ready
---

# Prompt — Simulation Restructure (in place)

> **Supersedes [[Prompt - Phase 0 Scaffold]]**, which assumed a new empty directory. This one restructures **`C:\VS Code\orcas` in place**, because that is where the work already is.
> **Scope: the simulation only.** The portfolio gets its own folder and its own repo, later. This prompt must not create it.

**Governing notes:** [[Phases#Phase 0 — Foundation and decisions]] · [[Stack]] · [[Rules]] · [[Docker]] · [[Architecture]] · [[Git-Workflow]]

---

## ⚠️ Read this before you run it

This prompt **deletes things and resets git history**. That is intended, and it is safe *if* the backup step runs first. Verified facts about the current folder, audited 2026-08-13:

| | |
| --- | --- |
| Commits | **47** — real history, worth archiving |
| Pack size | **217 MiB** — because `data/` was committed |
| `data/` tracked | 🔴 **117 files**, including `de421.bsp` |
| `.env` tracked | ✅ **No** — working tree only, never committed |

**Why fresh history rather than `filter-repo`:** the backend is being rebuilt from scratch anyway, so the history describes code that is about to stop existing. Rewriting 47 commits to strip `data/` is more work and more risk than archiving them and starting clean. The bundle keeps every commit recoverable.

**Before you start:** close VS Code, close any terminal sitting in the folder, and make sure nothing is mid-edit.

---

## The prompt

```text
Restructure the ORCAS simulation project IN PLACE in this directory
(C:\VS Code\orcas). This is a destructive reorganisation with a git history
reset. Work carefully and stop at the checkpoints.

SCOPE: the simulation ONLY. The portfolio will live in a separate folder and a
separate repository, created later. Do NOT create a portfolio/ directory here.

Read these first, in order, and treat them as binding:
  1. ORCAS Vault/00 - Meta/memory.md
  2. ORCAS Vault/00 - Meta/Rules.md
  3. ORCAS Vault/03 - Engineering/Stack.md
  4. ORCAS Vault/03 - Engineering/Architecture.md
  5. ORCAS Vault/01 - Product/Phases.md   (Phase 0)
  6. ORCAS Vault/00 - Meta/Git-Workflow.md

Then tell me, in no more than five lines: what you believe the target structure
is, what you plan to delete, and what you plan to preserve. STOP and wait for my
approval before touching anything.

════════════════════════════════════════════════════════════════
STEP 1 — BACK UP. Nothing else happens until this succeeds.
════════════════════════════════════════════════════════════════

  git status                       # report anything uncommitted; do not discard it
  git bundle create ../orcas-history-archive.bundle --all
  git bundle verify ../orcas-history-archive.bundle

Print the bundle's size and the verify output. If verification fails, STOP and
tell me. This bundle is the only copy of the 47 commits once STEP 4 runs.

Also copy backend/.env to ../orcas-env-backup.txt (outside the repo). It is not
in git, so it is not recoverable from the bundle.

════════════════════════════════════════════════════════════════
STEP 2 — INVENTORY. Show me what is actually here before changing it.
════════════════════════════════════════════════════════════════

For every top-level entry, print: name, size on disk, tracked-in-git yes/no,
and your proposed disposition (KEEP / MOVE / DELETE / GITIGNORE).

Known entries as of the 2026-08-13 audit — verify rather than assume:
  backend/ frontend/ frontend-3d/ frontend-three/ ml_models/ data/
  data_analysis/ assets/ models/ tests/ tools/ ORCAS Vault/ .venv/ .vs/ .vscode/
  CLAUDE.md README.md LICENSE Dockerfile docker-compose.yml
  pyproject.toml requirements.txt run_docker.bat run_docker.sh
  .gitignore .dockerignore

Flag anything present that is not on that list. STOP and show me the table.
Do not proceed until I approve the dispositions.

════════════════════════════════════════════════════════════════
STEP 3 — PRESERVE. These must survive. Verify each one afterwards.
════════════════════════════════════════════════════════════════

  ml_models/object_classifier.joblib   the trained classifier behind the paper's
                                       AUC 0.94. IRREPLACEABLE — it cannot be
                                       regenerated without retraining, which
                                       would invalidate a published number.
  data_analysis/                       generate_ml_plots.py PRODUCES THE PAPER'S
                                       FIGURES. Move to scripts/analysis/.
  assets/figures/                      published figures. Move to docs/figures/.
  ORCAS Vault/                         the specification. Do not modify contents.
  CLAUDE.md, LICENSE                   keep at root.
  tests/sample.tle + test_*.py         fixtures and reference tests — move to
                                       the new tests/ tree, do not delete.
  data/                                124 MB. KEEP ON DISK, add to .gitignore.
                                       The simulation is local-only, so there is
                                       no longer any reason to avoid using it.
  frontend-three/                      DO NOT DELETE YET. It is the only real
                                       SGP4 implementation and the source for
                                       Phase 4 salvage. Move to legacy/frontend-three/.

════════════════════════════════════════════════════════════════
STEP 4 — RESET GIT HISTORY (only after STEP 1 verified)
════════════════════════════════════════════════════════════════

  Write the new .gitignore FIRST, before git init. It must cover at minimum:
     .env  .env.*  (but NOT .env.example)
     data/  legacy/
     .venv/  __pycache__/  *.pyc  .pytest_cache/  .mypy_cache/  .ruff_cache/
     node_modules/  dist/  .vite/
     .vs/  .vscode/  *.log  .DS_Store

  Then:
     rm -rf .git
     git init
     git add -A
     git status          # ← PRINT THIS AND STOP.

  I must confirm the staged file list before the first commit. Specifically
  verify that NONE of these are staged: .env, data/, .venv/, node_modules/,
  legacy/. If any are, fix .gitignore and re-stage. Do not commit until I say so.

════════════════════════════════════════════════════════════════
STEP 5 — TARGET STRUCTURE
════════════════════════════════════════════════════════════════

  backend/                    NEW FastAPI. See Architecture.md for layering.
    app/{api,schemas,services,domain,infra,workers}/
    alembic/  tests/{unit,integration,golden}/  pyproject.toml
  frontend/                   NEW React 19 + R3F + Vite + TS strict
    src/{scene,ui,data,state,hooks,styles}/
  packages/
    orcas-physics/            pure TypeScript. No React, no DOM.
    orcas-scene/              R3F components.
  workers/
  infra/docker/               backend.Dockerfile, frontend.Dockerfile
  scripts/
    analysis/                 ← data_analysis/ moves here
  ml_models/                  unchanged
  data/                       on disk, gitignored
  data/sample/                small COMMITTED fixture set
  docs/figures/               ← assets/figures/ moves here
  legacy/                     gitignored holding pen, deleted at P4/P6
    frontend-three/  backend-old/
  ORCAS Vault/
  docker-compose.yml  .env.example  CLAUDE.md  README.md  LICENSE

  NOTE the old root-level backend/ must move to legacy/backend-old/ before the
  new backend/ is created. Do not overwrite it in place.

  DELETE OUTRIGHT (confirm with me first, per Rules.md "ask before deleting"):
     frontend-3d/    fake physics — angle += speed, no satellite.js. Salvage nothing.
     frontend/       CesiumJS learning exercise.
     tools/          one-off import-fixing script, no longer relevant.
     .venv/          regenerable.
     old root Dockerfile, docker-compose.yml, run_docker.bat, run_docker.sh,
     pyproject.toml, requirements.txt  — all superseded.

════════════════════════════════════════════════════════════════
STEP 6 — SCAFFOLD
════════════════════════════════════════════════════════════════

  Backend (Python 3.12, FastAPI, uv + pyproject.toml):
    - LAYERING IS ABSOLUTE: domain/ imports nothing from api/, infra/ or FastAPI.
      Add a test that fails if this is violated.
    - One Settings object (pydantic-settings). No scattered os.getenv.
    - /health/live and /health/ready only. No business endpoints yet.
    - CORS allowlist = localhost only. The simulation is never public.
    - infra/cache/{base.py,memory.py,redis.py} — CacheService interface,
      MemoryCache implementation, RedisCache raising NotImplementedError.
      Nothing may import a cache client directly.
    - Alembic initialised, no migrations yet. Never create_all().
    - ruff + mypy; mypy strict on domain/ and services/.

  Frontend (React 19 + Vite + TypeScript strict):
    - Pin exact versions of three, @react-three/fiber, @react-three/drei
    - satellite.js pinned to ^7 (ESM-only in v7 — see Data-Strategy §9.5)
    - styles/tokens.css with the palette from ORCAS Vault/02 - Design/Design.md.
      No colour literal outside that file.
    - A canvas rendering one placeholder mesh imported from packages/orcas-scene,
      to prove the workspace wiring works end to end.

  packages/ — npm workspaces. Both packages must build and be importable by
    frontend/. Do NOT set up npm publishing yet; that is a PA3 concern.

  docker-compose.yml — EXACTLY FOUR services: frontend, backend, worker, postgres.
    No redis. Healthchecks on postgres and backend; depends_on uses
    condition: service_healthy. worker reuses the backend image with a different
    command. Named volume for postgres.

  Dockerfiles — multi-stage (base/deps/dev/prod), non-root user, base images
    pinned to a minor version, build tools absent from prod.

  data/sample/ — ~20 objects as canonical OMM JSON (shape in Data-Strategy §9.1).
    Include at least one 6-digit catalog number to prove VARCHAR handling.
    Include Iridium 33 and Cosmos 2251 for the later golden-file test.

  CI — .github/workflows/ci.yml: ruff, mypy, pytest, eslint, tsc --noEmit, vitest.

════════════════════════════════════════════════════════════════
CONSTRAINTS
════════════════════════════════════════════════════════════════

  - norad_id is VARCHAR everywhere. Never INTEGER.
  - OMM is canonical. TLE is a legacy import adapter only. Do not build any
    schema around TLE strings.
  - No file over 250 lines.
  - No `any` in TypeScript. No bare `except:` in Python.
  - Every physics function docstring states its units and reference frame.
  - Conventional Commits, in logical units — not one giant commit.
  - ASK before adding any dependency not already named in Rules.md.
  - ASK before deleting anything not explicitly listed above.

════════════════════════════════════════════════════════════════
DEFINITION OF DONE — verify, do not assure
════════════════════════════════════════════════════════════════

  1. ../orcas-history-archive.bundle exists and passes `git bundle verify`
  2. ml_models/object_classifier.joblib is present and byte-identical to before
     (compare checksums, print both)
  3. scripts/analysis/generate_ml_plots.py present
  4. docker compose up --build → all four containers healthy
  5. docker compose run --rm backend pytest → passes
  6. ruff check . and mypy app/domain app/services → clean
  7. docker compose run --rm frontend npm run build → succeeds
  8. packages/orcas-scene is genuinely imported by frontend/ — prove it renders
  9. git status → no .env, no data/, no .venv, no legacy/, no node_modules
 10. git count-objects -vH → print it. Should be single-digit MB, not 217.

Report the actual command output for each. "It should work" is not evidence.

Finally, update ORCAS Vault/00 - Meta/memory.md: mark Phase 0 complete, record
anything you deviated from and why, and note what the next session picks up.
```

---

## Why the prompt is shaped this way

**Backup before anything.** 47 commits and a `.env` that is *not* in git — two different things at risk, needing two different backups. The bundle covers history; a file copy covers the `.env`. Neither is recoverable from the other.

**Inventory as a checkpoint, not an assumption.** The vault's own repo-layout section was wrong until today — it listed 8 top-level items when there are 20+. `data_analysis/`, which generates the paper's figures, was undocumented and could easily have been deleted as clutter. Making the agent enumerate and propose dispositions catches whatever else the audit missed.

**`legacy/` instead of immediate deletion.** `frontend-three` is the only real SGP4 implementation in the project, and Phase 4 salvages from it. Deleting it now to "clean up" would destroy the reference implementation before the replacement exists. It is gitignored, so it doesn't pollute the new history, and it disappears at P4/P6 once parity is proven.

**`git status` printed and stopped on, before the first commit.** The single highest-value checkpoint in the whole prompt. Once `data/` is committed again, you are back to a 217 MiB pack and `.gitignore` cannot save you. Catching it at the staging step costs nothing.

**Checksum the `.joblib`.** It is the one artifact in the repository that genuinely cannot be regenerated — retraining it would mean the paper's AUC 0.94 no longer describes the shipped model. Verifying it byte-for-byte after a large file reorganisation is cheap insurance.

---

## After this runs

The next milestones are on the portfolio track ([[Phases]]): create the new folder, scaffold Astro, and get something deployed early. The simulation track then proceeds P1 → P2 → P4 at whatever pace suits.

**Related:** [[Phases]] · [[Stack]] · [[Rules]] · [[Git-Workflow]] · [[Architecture]] · [[Docker]] · [[memory]]
