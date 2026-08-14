# syntax=docker/dockerfile:1
FROM python:3.12-slim AS base
RUN groupadd -r orcas && useradd -r -g orcas orcas
WORKDIR /app
ENV UV_LINK_MODE=copy PYTHONUNBUFFERED=1 UV_CACHE_DIR=/tmp/uv-cache

FROM base AS deps
COPY --from=ghcr.io/astral-sh/uv:0.10.7 /uv /uvx /bin/
COPY backend/pyproject.toml backend/uv.lock* ./
RUN uv sync --no-install-project

FROM deps AS dev
COPY backend/ ./
RUN uv sync && chown -R orcas:orcas /tmp/uv-cache /app
USER orcas
EXPOSE 8000
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

FROM base AS prod
COPY --from=deps /app/.venv /app/.venv
COPY backend/app ./app
COPY backend/alembic ./alembic
COPY backend/alembic.ini ./
COPY ml_models ./ml_models
ENV PATH="/app/.venv/bin:$PATH" ML_MODEL_PATH="/app/ml_models/object_classifier.joblib"
USER orcas
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
