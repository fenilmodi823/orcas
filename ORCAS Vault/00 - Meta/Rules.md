---
title: Rules
type: meta
updated: 2026-08-13
status: active
---

# Rules

> ⚠️ **Rewritten 2026-07-27** for the restructure: new Python backend, single frontend, full containerisation.
> This is the contract. An agent working on ORCAS reads [[memory]], then this file, in that order.

**Related:** [[Architecture]] · [[Docker]] · [[Prompting]] · [[Git-Workflow]] · [[PRD]]

---

## 1. Libraries — what to use

### Backend (Python 3.12)

| Need | Use | Never |
| --- | --- | --- |
| Framework | **FastAPI** | Flask, Django, bare ASGI |
| Validation | **Pydantic v2** | Hand-rolled dict validation |
| Config | **pydantic-settings**, one `Settings` object | Module-level globals, scattered `os.getenv` |
| ORM | **SQLAlchemy 2.0 async** | Raw SQL strings in services, Django ORM |
| Migrations | **Alembic** | Hand-written DDL, `create_all()` in production |
| DB driver | **asyncpg** | psycopg2 (sync) |
| HTTP client | **httpx** (async) | `requests` (blocking) |
| Orbital mechanics | **sgp4** (`omm.initialize` for OMM records), **Skyfield** | Writing your own propagator; parsing TLE text as the primary path |
| Caching | **`CacheService` interface** + `MemoryCache` | Importing a cache client directly in a service; Redis in v1 |
| ML | **scikit-learn** + the existing `.joblib` | Retraining without a reason |
| Numerics | **NumPy**, **SciPy** | Loops over Python lists |
| Scheduling | **APScheduler**, or GitHub Actions cron | `while True: sleep()` |
| Testing | **pytest**, **pytest-asyncio**, **httpx.AsyncClient** | unittest |
| Lint/format | **ruff** (both) | black + isort + flake8 separately |
| Types | **mypy**, strict on `domain/` and `services/` | Untyped code |
| Packaging | **uv** + `pyproject.toml` | requirements.txt as source of truth |

### Frontend (TypeScript)

| Need | Use | Never |
| --- | --- | --- |
| Framework | **React 19** + **Vite** | Next.js (this is an SPA over a canvas — SSR buys nothing) |
| Language | **TypeScript strict** | Plain JS in new files |
| 3D | **@react-three/fiber** + **drei** + **three** | Imperative three.js scene graphs in components |
| Propagation | **satellite.js v7.x** — `json2satrec()` for OMM | Reimplementing SGP4; `twoline2satrec` as the default path |
| State | **Zustand** | Redux; Context for high-frequency updates |
| Styling | **Tailwind v4** + `tokens.css` | Inline style objects, CSS-in-JS |
| Animation | **Framer Motion** | GSAP, hand-rolled rAF for UI |
| Icons | **lucide-react** | Mixed icon sets, emoji-as-icons |
| Assets | **glTF + Draco + KTX2** | Raw OBJ, PNG textures at scale |
| Testing | **Vitest** + **Testing Library** | Jest |

**Pin exact versions** for `three`, `@react-three/fiber` and `@react-three/drei`. Version drift between those three is a reliable source of silent breakage.

---

## 2. What to avoid — hard bans

| ❌ Never | Why |
| --- | --- |
| **Network I/O inside a request handler** | The old backend's fatal flaw. Ingestion belongs in a worker. |
| **Blocking I/O in an async path** | Freezes the event loop. Use async clients, or `run_in_threadpool`. |
| `allow_origins=["*"]` | Explicit allowlist per environment |
| **Colour literals outside `tokens.css`** | Palette drift |
| **`norad_id` as an integer** | Catalog numbers exceeded 5 digits on 2026-07-11 and Alpha-5 is alphanumeric ([[Data-Strategy#The TLE deprecation]]) |
| **TLE text as the primary ingestion format** | Being retired upstream. **OMM is canonical**; TLE is a legacy import adapter only ([[Data-Strategy#⭐ The canonical orbital-data model]]). |
| **Building the schema around whatever a library parses** | The library must not dictate the data model. Store canonical OMM; let each layer construct its own propagator from it. |
| **Letting a `source_type = "simulation"` object into screening or ML** | That is fabricating a result. The Kessler swarm is synthetic and must stay out of the real pipeline. |
| **Redis, or any second cache service, in v1** | Decided 2026-08-13. In-process cache behind `CacheService`. |
| **React state updated every frame** | The classic R3F killer. Refs + `useFrame`. |
| Animating `width` / `height` / `top` / `left` | Layout thrash. `transform` and `opacity` only. |
| **`any` in TypeScript** | Use `unknown` and narrow |
| Bare `except:` / silent `catch {}` | Log with context, then degrade |
| **Files over 250 lines** | `App.jsx` at 1,391 lines is what we are escaping |
| Committing `.env` or any key | Repo is going public |
| Committing `data/tle/` or `data/ephemeris/` | 124 MB, and regenerable |
| `localStorage` on a critical path | Blocked in embedded contexts. In-memory state. |
| Running containers as root | [[Docker#Rules]] |
| `create_all()` instead of a migration | Schema drift between environments |
| **Presenting stale data as live** | Always show the element-set epoch |
| **Overstating the research** | The highest-consequence rule here |

### Performance ceilings

- Client bundle < 300 KB gzipped before the 3D chunk
- Cap device pixel ratio: `dpr={[1, 2]}`
- Pause `useFrame` when `document.hidden`
- Limit simultaneously visible glass surfaces — blur over a live canvas is expensive
- Landing sequence ≤ 4 s, skippable from frame one
- 60 FPS desktop at full catalogue with LOD; 30 FPS floor on mid-range mobile

---

## 3. Coding standards

### Python

- **Layering is absolute.** `domain/` imports nothing from `api/`, `infra/`, or FastAPI. Pure functions over dataclasses.
- `api/` contains no physics and no SQL. `services/` orchestrates. `infra/` touches the outside world.
- Type hints on every public function. `mypy --strict` on `domain/` and `services/`.
- Docstrings on every public module and function, and on **every physics function state the units and reference frame**.
- Custom exception types per failure class. No generic `Exception` raises.
- Tests for every new domain function.

### TypeScript

- `strict: true`, no `any`
- Files `kebab-case.ts(x)`; components `PascalCase`; hooks `use-thing.ts` exporting `useThing`
- Named exports
- One component per file; split past 250 lines
- `physics/` is pure — no React import. It must be unit-testable in isolation.
- `scene/` and `ui/` never import each other; they communicate through `state/`

### Units and frames — a project-specific rule

Every variable holding a physical quantity carries its unit in the name or an adjacent comment, and every function that transforms coordinates names its input and output frames.

```python
def eci_to_ecef(position_km_eci: np.ndarray, gmst_rad: float) -> np.ndarray:
    """Rotate an ECI position vector into ECEF. Input km, output km."""
```

Unit confusion is the classic aerospace software failure. It costs nothing to prevent.

---

## 4. Error handling

**Never show the user a broken thing.** Every failure degrades to something honest.

| Failure | Behaviour |
| --- | --- |
| Backend unreachable | Scene runs from the static snapshot. Visible "data may be stale" pill. **Never a blank screen.** |
| Snapshot fails to load | Retry once, then a clear error state with a reload action |
| WebGL2 unavailable | Static rendered image + explanation. Never a black canvas. |
| A 3D model fails to load | Fall back to the class-generic model, then to an instanced marker |
| CelesTrak fetch fails | Keep the previous snapshot. Log. Alert. **Stale with an honest epoch beats nothing.** |
| Malformed upstream data | Reject at the validation boundary. Never write it to the database. |
| A scene component throws | Error boundary around the canvas — the UI survives |
| A panel throws | Per-panel error boundary — one panel dies, the app survives |
| Database unreachable | `/health/ready` fails; read paths serve cache; **no 500s to the client** |

### Rules

- Every `except` names its exception type and logs with context
- Every dynamic import has a `<Suspense>` boundary with a real skeleton, not a spinner
- No `alert()`, no `confirm()`
- Errors returned to clients are typed and safe — never a stack trace, never an internal path

---

## 5. Docker guidelines

Full detail in [[Docker]]. The rules that matter most:

1. **`docker compose up` must produce a working system.** One command. If a contributor needs a second step, setup is broken.
2. Multi-stage builds always; build tools never reach production
3. Non-root user in every image
4. Healthchecks on every long-running service; `depends_on` uses `condition: service_healthy`
5. Pin base images to a minor version
6. No secrets in images or compose files — `.env` only, with a committed `.env.example`
7. `.dockerignore` on every build context
8. The worker shares the backend image with a different command
9. Migrations run explicitly, never on container start
10. Never bake `data/tle/` or `data/ephemeris/` into an image

---

## 6. Boundaries for AI

### ✅ May do without asking

Read anything · write and refactor code in `backend/` (new), `frontend/` (new) and this vault · run tests, linters, builds, containers · update [[memory]] (**must**) · propose alternatives and disagree

### ⚠️ Must ask first

- Adding any dependency — justify it against §1
- Changing the stack or architecture in [[Architecture]]
- **Deleting anything** — especially `frontend-3d/`, `frontend/`, or the old `backend/`. Deletion happens at the phase boundaries defined in [[Phases]], after parity is proven, and with explicit approval.
- Anything touching git history
- Anything that costs money
- Deploying, publishing, or sending email
- Changing the wording of the publication status
- Retraining or replacing the ML model

### ❌ Must never

- Overstate the research
- Invent numbers, citations, venues, dates or benchmarks
- Commit secrets
- Modify the accepted paper PDF
- Imply sole authorship of a six-author paper
- Mark a task complete when it isn't — say what's blocking
- **Ship a fake physics implementation.** `frontend-3d`'s `useSGP4Propagator` was `angle += speed` with a sine-wave velocity, presented as SGP4. That is the exact failure this project cannot afford.

---

## 7. Honesty rules ⭐

The project's credibility rests on a peer-reviewed physics claim. A single overstatement costs more than every design decision combined.

| Say | Don't say |
| --- | --- |
| "Accepted at ICSSIT 2026, technically sponsored by IEEE SMC Society" | "Published in IEEE" — not indexed yet |
| "Paper ID 1849" | 1655 — a separate, earlier CMT submission to a different conference |
| "Co-authored with five colleagues; my contribution was X" | Anything implying sole authorship |
| "P_c = 4.2 × 10⁻³" | Rounded, rephrased or "improved" numbers |
| "~16,200 active satellites (CelesTrak, July 2026)" | An unsourced or stale count |
| "Element set epoch: <timestamp>" | Presenting propagated positions as live truth |
| "Simulated debris field, not tracked objects" | Letting the Kessler swarm look like real tracked data |
| "Educational and research-demonstration software" | Anything implying operational collision warning |

**Publication status lives in exactly one file** so it can be updated in one place the day it changes.

---

## 8. The /sync command

When Fenil types `/sync`, the agent must, without further prompting:

1. Re-read [[memory]]
2. Update **Current state** — date, active phase, immediate priority
3. Move finished items into **What has been completed**
4. Refresh **Which files are currently being worked on**
5. Add or amend anything in **Things a new agent must know**
6. Rewrite **Next actions** so the top item is genuinely next
7. Reconcile the progress table in [[Phases]]
8. Append one row to the **Session log**
9. Update the `updated:` frontmatter date
10. Reply with a **three-line** summary — no longer

Variants: `/sync quick` (1–3, 8–10) · `/sync full` (all, plus the [[Home]] status board)

---

## 9. Working style

1. Read [[memory]] first. Always.
2. State the plan before a multi-step change; wait for agreement.
3. Prefer the smallest change that works.
4. **Verify, don't assure.** Run it, render it, read the numbers. "It should work now" is not evidence.
5. Never end a session with the repo in a non-building state.
6. Update [[memory]] before finishing.
