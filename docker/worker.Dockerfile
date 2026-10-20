# syntax=docker/dockerfile:1
FROM node:22.23.3-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392 AS base
ENV TURBO_TELEMETRY_DISABLED=1 \
    COREPACK_HOME=/opt/corepack \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    npm_config_store_dir=/pnpm/store
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm fetch --prod

FROM deps AS prod
COPY . .
RUN pnpm install --offline --frozen-lockfile --prod --filter worker...

FROM base AS runtime
ENV NODE_ENV=production \
    COREPACK_ENABLE_NETWORK=0 \
    PATH=/app/apps/worker/node_modules/.bin:$PATH
COPY --from=prod /app /app
USER node
WORKDIR /app/apps/worker
# Runs under tini (compose `init: true`); tsx is the application process (ADR-009).
CMD ["tsx", "src/index.ts"]
