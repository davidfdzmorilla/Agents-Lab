# syntax=docker/dockerfile:1
# Next.js `output: "standalone"` image (ADR-012). The final image has no pnpm, corepack, npm, npx or yarn,
# no .ts sources and runs as uid 1000. No database variable exists in any build stage.
FROM node:22.23.3-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392 AS base
ENV TURBO_TELEMETRY_DISABLED=1 \
    NEXT_TELEMETRY_DISABLED=1 \
    COREPACK_HOME=/opt/corepack \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    npm_config_store_dir=/pnpm/store
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

# Holds the store only; never copied to the final image.
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm fetch --ignore-scripts

# --frozen-lockfile fails the build when any manifest and the lockfile disagree (ADR-011 condition 1, ADR-012).
# The application build runs without network and without scripts.
FROM deps AS build
COPY . .
RUN pnpm install --frozen-lockfile --offline --ignore-scripts --filter web...
RUN --network=none pnpm --filter web build

# Node without package managers.
FROM node:22.23.3-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392 AS slim
RUN rm -rf /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg \
        /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-*
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app

# M0 has no apps/web/public; when it exists, copy it next to .next/static like below.
FROM slim AS runtime
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
# Runs under tini (compose `init: true`). Next exits with 143 on SIGTERM by design (ADR-012).
CMD ["node", "apps/web/server.js"]
