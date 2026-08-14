---
title: Git Workflow
type: meta
updated: 2026-07-27
status: active
---

# Git Workflow

> Source: handwritten notes, page 6 — *"Add instruction for git commands in .md file."*

---

## Repositories

| Repo | Path | Remote |
| --- | --- | --- |
| ORCAS | `C:\VS Code\orcas` | `https://github.com/fenilmodi823/orcas.git` |
| Portfolio | *not created yet* | **separate repo** — shares a design language, not a codebase |
| Vault | `C:\VS Code\orcas\ORCAS Vault` | lives inside the ORCAS repo |

> ✅ **Decided 2026-08-13 — monorepo.** `backend/`, `frontend/`, `workers/`, `infra/`, `scripts/` live in one repository, because a single `docker compose up` across repos is painful and the one-command rule is non-negotiable ([[Docker]]). The portfolio stays a separate repo — it shares a design language, not code.

---

## 🚨 Before making the repo public

The repo is going public in [[Phases#Phase 0]]. Do this first:

```bash
# 1. Is .env tracked? (it exists at backend/.env)
git ls-files | grep -i "\.env"

# 2. If yes — stop. Remove it from tracking:
git rm --cached backend/.env
echo "backend/.env" >> .gitignore
echo ".env" >> .gitignore

# 3. Has it ever been committed? Check history:
git log --all --full-history -- backend/.env

# 4. Was a NASA API key ever committed?
git log -p --all -S "NASA_API_KEY" | head -50
```

If a key was ever committed, **rotate the key**. Rewriting history does not un-leak a secret that has been pushed.

---

## Branching

```
main                 always deployable, always builds
├─ feat/<thing>      new work
├─ fix/<thing>       bug fixes
├─ docs/<thing>      vault and README changes
├─ refactor/<thing>  no behaviour change
└─ chore/<thing>     deps, config, tooling
```

Name branches after the outcome, not the phase: `feat/omm-ingestion`, not `feat/phase-1`.

Branch per phase-item from [[Phases]]. Merge to `main` when its exit criteria pass.

---

## Commit style

Conventional Commits. The existing repo already uses this — keep it.

```
<type>(<scope>): <imperative summary, no full stop>

<why, if not obvious>
```

Types: `feat` · `fix` · `docs` · `style` · `refactor` · `perf` · `test` · `build` · `chore`

Real examples from the repo:

```
feat: rebuild 3D engine in R3F, unify dashboard views, and fix camera lock bug
feat: implement real-time PHA threat detection and WebGL UI alerts
chore: rebrand project to ORCAS and update paths
build: upgrade architecture to FastAPI backend and Python 3.12
```

Rules:

- Imperative mood — "add", not "added"
- Subject under 72 characters
- Explain **why** in the body when the change isn't self-evident
- ❌ Never `commit message`, `update`, `wip`, `fix stuff` — the early history has these; don't add more

---

## Daily commands

```bash
# start
git status
git pull origin main
git checkout -b feat/omm-ingestion

# during
git add -p                       # stage in hunks, review as you go
git commit -m "feat(ingest): pull OMM JSON from CelesTrak and upsert element sets"
git push -u origin feat/omm-ingestion

# check before pushing
git diff --stat main             # what changed overall
git log --oneline main..HEAD     # what commits you're adding

# merge
git checkout main
git pull origin main
git merge --no-ff feat/omm-ingestion
git push origin main
git branch -d feat/omm-ingestion
```

---

## Useful recipes

```bash
# what did I actually change?
git diff --stat
git diff --cached                # staged only

# undo the last commit but keep the work
git reset --soft HEAD~1

# discard uncommitted changes to one file
git checkout -- path/to/file

# stash while you switch context
git stash push -m "half-built dock"
git stash list
git stash pop

# find when a line was introduced
git log -S "twoline2satrec" --oneline

# see a file at an older commit without checking it out
git show bf113870:frontend-three/src/App.jsx

# tag a milestone
git tag -a v1.0-sim -m "ORCAS simulation v1 live"
git push origin --tags
```

---

## .gitignore essentials

```
# Python
.venv/
venv/
__pycache__/
*.pyc
.pytest_cache/
.mypy_cache/

# Secrets
.env
.env.*
!.env.example
backend/.env

# Node
node_modules/
dist/
*.tsbuildinfo

# Large data — NEVER commit  (see [[Data-Strategy]])
data/tle/
data/ephemeris/

# Docker
.docker/

.DS_Store
```

> ✅ **Decided 2026-08-13 — restructure in place, with fresh git history.**
>
> **What the on-disk audit found in `C:\VS Code\orcas`:**
>
> | | |
> | --- | --- |
> | Commits | 47 |
> | Pack size | **217 MiB** |
> | `data/` tracked? | 🔴 **Yes — 117 files**, including `de421.bsp` |
> | `.env` tracked? | ✅ **No.** Never committed — working tree only. |
>
> `.gitignore` cannot undo a commit. Since the backend is being rebuilt anyway, the cheapest correct move is: **archive the old history as a bundle, delete `.git`, re-init in the same folder.** No `filter-repo` surgery, nothing lost, and the new repo starts at a few MB instead of 217.
>
> ```bash
> git bundle create ../orcas-history-archive.bundle --all   # a complete, restorable copy
> ```
> Keep that bundle **outside** the repo. All 47 commits remain recoverable from it.
>
> **Carries over:** `ml_models/`, `ORCAS Vault/`, `CLAUDE.md`, `data_analysis/` (⭐ generates the paper's figures), `assets/figures/`, `LICENSE`, test fixtures, and salvage from `frontend-three`.
> **Does not:** the old backend, `frontend-3d`, the Cesium frontend, `.venv/`, and all 124 MB of `data/` — kept on disk, gitignored.
>
> A **small sample dataset** *is* committed, enough to run tests offline. Everything else is fetched or generated.
>
> ⚠️ Rotate the NASA key as hygiene — but note the corrected finding: **it was never in git**, so this is not the emergency earlier notes implied.

### Two repositories

| Repo | Contains | Public? |
| --- | --- | --- |
| `C:\VS Code\orcas` | The simulation — backend, frontend, `packages/`, workers | Eventually, at P6 |
| *(new folder, created later)* | The portfolio — Astro site | ✅ Yes, and deployed |

They share code **only via published npm packages**, never by relative path — a `file:../` dependency works locally and breaks the Cloudflare Pages build. See [[Stack#4. Shared code — across two separate repositories]].

---

## Rules

1. `main` always builds. Never push a broken `main`.
2. Commit early and often on a branch; squash noise before merging if it helps.
3. Never force-push a shared branch. Agents must ask before touching history at all ([[Rules#Boundaries for AI]]).
4. No secrets, ever. If one slips through, rotate it — don't just rewrite history.
5. Vault changes get `docs:` commits so the code history stays readable.
6. Tag every deployment milestone.

---

**Related:** [[Rules]] · [[Phases]] · [[Docker]] · [[Deployment]] · [[Data-Strategy]] · [[Open-Questions]]
