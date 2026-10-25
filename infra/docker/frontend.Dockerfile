# syntax=docker/dockerfile:1
FROM node:24-slim AS base
RUN groupadd -r orcas && useradd -r -m -g orcas orcas && install -d -o orcas -g orcas /app
WORKDIR /app

# Installed as orcas: Vite writes into node_modules at runtime (vite-temp), and
# installing as root then `chown -R` copied all of node_modules into a second layer.
FROM base AS deps
USER orcas
COPY --chown=orcas:orcas package.json package-lock.json ./
COPY --chown=orcas:orcas packages/orcas-physics/package.json packages/orcas-physics/package.json
COPY --chown=orcas:orcas packages/orcas-scene/package.json packages/orcas-scene/package.json
COPY --chown=orcas:orcas frontend/package.json frontend/package.json
RUN npm install --no-audit --no-fund && npm cache clean --force

FROM deps AS dev
COPY --chown=orcas:orcas packages/ packages/
COPY --chown=orcas:orcas frontend/ frontend/
WORKDIR /app/frontend
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]

FROM deps AS build
COPY --chown=orcas:orcas packages/ packages/
COPY --chown=orcas:orcas frontend/ frontend/
RUN npm run build:frontend

FROM nginx:1.29-alpine AS prod
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
