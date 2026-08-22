# syntax=docker/dockerfile:1
FROM node:24-slim AS base
RUN groupadd -r orcas && useradd -r -g orcas orcas
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/orcas-physics/package.json packages/orcas-physics/package.json
COPY packages/orcas-scene/package.json packages/orcas-scene/package.json
COPY frontend/package.json frontend/package.json
RUN npm install --no-audit --no-fund

FROM deps AS dev
COPY packages/ packages/
COPY frontend/ frontend/
RUN chown -R orcas:orcas /app
USER orcas
WORKDIR /app/frontend
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]

FROM deps AS build
COPY packages/ packages/
COPY frontend/ frontend/
RUN npm run build:frontend

FROM nginx:1.29-alpine AS prod
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
