---
title: Docker
type: engineering
updated: 2026-07-27
status: active
---

# Docker

> **Requirement:** the entire ORCAS project runs in containers. A contributor on any OS clones the repo and runs **one command**.

**Related:** [[Architecture]] · [[Deployment]] · [[Rules]] · [[Phases]]

---

## The one command

```bash
git clone https://github.com/fenilmodi823/orcas.git
cd orcas
cp .env.example .env
docker compose up
```

That must produce a working system. Nothing else — no local Python, no local Node, no manual database creation, no seed script run by hand.

**This is a hard acceptance criterion for Phase 0**, not an aspiration.

---

## Services

| Service | Image | Port | Purpose |
| --- | --- | --- | --- |
| `frontend` | node:22-alpine (dev) / nginx:alpine (prod) | 5173 / 80 | React + R3F client |
| `backend` | python:3.12-slim | 8000 | FastAPI |
| `worker` | *same image as backend* | — | Scheduler + ingestion |
| `postgres` | postgres:16-alpine | 5432 | Catalogue and element sets |

`worker` deliberately reuses the backend image with a different command. Two images for the same codebase is a drift bug waiting to happen.

> [!info] **No Redis — decided 2026-08-13.** Four services, not five. Caching is in-process behind a `CacheService` interface; scheduling is GitHub Actions cron in production and the `worker` container in development. Every service you add is one more thing that has to start correctly for `docker compose up` to satisfy the one-command rule. See [[Data-Strategy#❌ Why *not* Redis in v1 — decided 2026-08-13]] for the swap-in criteria.

---

## compose (development)

```yaml
name: orcas

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: ../infra/docker/frontend.Dockerfile
      target: dev
    ports: ["5173:5173"]
    volumes:
      - ./frontend:/app
      - /app/node_modules          # anonymous volume: keep container's deps
    environment:
      - VITE_API_URL=http://localhost:8000
    depends_on:
      backend: { condition: service_healthy }

  backend:
    build:
      context: ./backend
      dockerfile: ../infra/docker/backend.Dockerfile
      target: dev
    ports: ["8000:8000"]
    volumes:
      - ./backend:/app
      - ./ml_models:/app/ml_models:ro
    env_file: .env
    environment:
      - DATABASE_URL=postgresql+asyncpg://orcas:orcas@postgres:5432/orcas
      - CACHE_BACKEND=memory
    depends_on:
      postgres: { condition: service_healthy }
    healthcheck:
      test: ["CMD", "python", "-c",
             "import urllib.request;urllib.request.urlopen('http://localhost:8000/health/live')"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 20s

  worker:
    build:
      context: ./backend
      dockerfile: ../infra/docker/backend.Dockerfile
      target: dev
    command: python -m app.workers.scheduler
    volumes:
      - ./backend:/app
      - ./ml_models:/app/ml_models:ro
    env_file: .env
    depends_on:
      backend: { condition: service_healthy }

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: orcas
      POSTGRES_PASSWORD: orcas
      POSTGRES_DB: orcas
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U orcas"]
      interval: 5s
      retries: 10

volumes:
  pgdata:
```

---

## Dockerfile patterns

### Backend — multi-stage, non-root

```dockerfile
# ---------- base ----------
FROM python:3.12-slim AS base
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
RUN groupadd -r orcas && useradd -r -g orcas -u 1000 orcas

# ---------- deps ----------
FROM base AS deps
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml uv.lock ./
RUN pip install uv && uv sync --frozen --no-dev

# ---------- dev ----------
FROM deps AS dev
RUN uv sync --frozen
COPY --chown=orcas:orcas . .
USER orcas
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ---------- prod ----------
FROM base AS prod
COPY --from=deps --chown=orcas:orcas /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"
COPY --chown=orcas:orcas ./app ./app
COPY --chown=orcas:orcas ./alembic ./alembic
COPY --chown=orcas:orcas alembic.ini ./
USER orcas
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request;urllib.request.urlopen('http://localhost:8000/health/live')"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Frontend — dev server vs static build

```dockerfile
FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM deps AS build
COPY . .
RUN npm run build

FROM nginx:alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
COPY infra/docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

---

## Rules

1. **One command starts everything.** If a new contributor needs a second step, the setup is broken.
2. **Non-root in every image.** No exceptions.
3. **Multi-stage always.** Build tools never ship to production.
4. **Healthchecks on every long-running service**, and `depends_on` uses `condition: service_healthy` — not bare `depends_on`, which only waits for *start*, not *readiness*.
5. **Pin base images to a minor version.** `python:3.12-slim`, not `python:slim`.
6. **No secrets in images or compose files.** `.env` only, gitignored, with a committed `.env.example`.
7. **Named volumes for data.** Bind mounts for source during development only.
8. **Anonymous volume for `node_modules`.** Otherwise the host directory shadows the container's install and the build breaks on a different OS.
9. **`.dockerignore` on every context** — `node_modules`, `.venv`, `__pycache__`, `.git`, `dist`, `data/`.
10. **The worker shares the backend image.** Same code, different command.
11. **Migrations run explicitly**, not on container start:
    `docker compose run --rm backend alembic upgrade head`
12. **Never bake `data/tle/` or `data/ephemeris/` into an image** ([[Data-Strategy]]).

---

## Common commands

```bash
docker compose up                          # start everything
docker compose up --build                  # rebuild and start
docker compose down                        # stop
docker compose down -v                     # stop and wipe data ⚠️

docker compose logs -f backend             # follow one service
docker compose ps                          # health status
docker compose exec backend bash           # shell into a running service

docker compose run --rm backend alembic upgrade head
docker compose run --rm backend alembic revision --autogenerate -m "add asset table"
docker compose run --rm backend pytest
docker compose run --rm backend ruff check .
docker compose run --rm frontend npm run lint
docker compose run --rm worker python -m app.workers.tasks.ingest_gp --once
```

---

## Environments

| File | Use |
| --- | --- |
| `docker-compose.yml` | Development. Hot reload, source mounted, ports exposed. |
| `compose.prod.yml` | Production override. Built assets, no mounts, restart policies. |
| `compose.test.yml` | CI. Ephemeral database, no volumes, exits on completion. |

```bash
docker compose -f docker-compose.yml -f infra/compose/compose.prod.yml up -d
```

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Backend can't reach Postgres | Using `localhost` | Use the service name: `postgres:5432` |
| Frontend can't reach backend | Browser resolves from the host | `VITE_API_URL` must be `http://localhost:8000`, not `http://backend:8000` |
| `node_modules` errors after OS change | Host directory shadowing | Ensure the anonymous volume `/app/node_modules` is present |
| Migrations fail on first run | Postgres not ready | Healthcheck + `condition: service_healthy` |
| Image is enormous | Single-stage build | Multi-stage; check `.dockerignore` |
| Permission denied on a mounted file | UID mismatch | Container user is uid 1000; `chown` on copy |
