# syntax=docker/dockerfile:1
# Images built with `pnpm deploy` (ADR-011). Final images never contain pnpm, corepack or the monorepo.
FROM node:22.23.3-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392 AS base
ENV TURBO_TELEMETRY_DISABLED=1 \
    COREPACK_HOME=/opt/corepack \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    npm_config_store_dir=/pnpm/store
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

# Ancestor of the deploy stages only: holds the store, never copied to a final image.
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm fetch --ignore-scripts

# `deploy` runs a non-frozen install in pnpm 9 and needs the registry (no --offline). The first RUN
# freezes the lockfile against every manifest (ADR-011 condition 1); no package code runs.
FROM deps AS worker-deploy
COPY . .
RUN pnpm install --frozen-lockfile --lockfile-only --ignore-scripts --offline
RUN pnpm --filter worker deploy --prod --ignore-scripts /out

# One-shot migrations image (OD-026): never reused by worker or web. Keeps persistence devDependencies
# (drizzle-kit, tsx; ADR-010). The root devDependencies are dropped from this stage's copy only because
# pnpm 9 `deploy` reinstalls them (ADR-011 condition 2, debt LOW, TASK-040).
FROM deps AS migrate-deploy
COPY . .
RUN pnpm install --frozen-lockfile --lockfile-only --ignore-scripts --offline
RUN npm pkg delete devDependencies \
 && pnpm --filter @agentlab/persistence deploy --ignore-scripts /out

# Node without package managers: they cannot run in worker or migrate.
FROM node:22.23.3-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392 AS slim
RUN rm -rf /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg \
        /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-*
ENV NODE_ENV=production \
    PATH=/app/node_modules/.bin:$PATH
WORKDIR /app

FROM slim AS migrate
COPY --from=migrate-deploy /out /app
USER node
CMD ["tsx", "src/cli/migrate.ts"]

FROM slim AS runtime
COPY --from=worker-deploy /out /app
USER node
# Runs under tini (compose `init: true`). `node --import tsx` keeps node as the signal-receiving
# process (ADR-009 §7, OD-032): the tsx CLI would SIGKILL the child 30 ms after SIGTERM.
CMD ["node", "--import", "tsx", "src/index.ts"]

# Used only by the compose `test` service: non-root, no deploy output.
FROM base AS test
RUN install -d -o node -g node /work
USER node
WORKDIR /work
