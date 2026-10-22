.PHONY: help setup orchestrator verify-hooks up up-local down logs ps test validate lint typecheck

# GNU Make 3.81 (macOS default) ignores .SHELLFLAGS, so pipefail is set inside each piped recipe.
# Do not move it back to .SHELLFLAGS.
SHELL := /bin/bash

export TURBO_TELEMETRY_DISABLED := 1

NODE_IMAGE := node:22.23.3-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392
PNPM_STORE_VOLUME := agentlab-pnpm-store
# Root files (eslint.config.js, future root *.js/*.ts); workspaces are linted by `pnpm -r lint` (TD-007).
LINT_ROOT := pnpm exec eslint --ignore-pattern "apps/**" --ignore-pattern "packages/**" .

# The host filters the repo with tar and streams it over stdin; the container never mounts the repo,
# so excluded files (.env*, .git, node_modules) cannot reach it. Patterns are unanchored names that
# behave the same in bsdtar (macOS) and GNU tar. COPYFILE_DISABLE avoids AppleDouble ._ files.
HOST_TAR := COPYFILE_DISABLE=1 tar -C "$(CURDIR)" --no-xattrs --exclude=node_modules --exclude=.git --exclude=.next --exclude=.turbo --exclude=.pnpm-store --exclude=.env --exclude='.env.*' --exclude=.envrc --exclude='*.env' --exclude='.env-*' --exclude='.env_*' --exclude=settings.local.json --exclude=agent-memory-local -cf - .
DOCKER_NODE := docker run --rm -i --cap-drop ALL --security-opt no-new-privileges -v $(PNPM_STORE_VOLUME):/pnpm-store -e npm_config_store_dir=/pnpm-store -e TURBO_TELEMETRY_DISABLED=1 -w /work $(NODE_IMAGE) bash -euo pipefail -c
# make test / make validate run in two phases (OD-019). Phase 1 has internet and no db: only the lockfile,
# workspace file and .npmrc enter the container, and --ignore-scripts keeps package code from running
# (pnpm fetch runs lifecycle scripts otherwise). Phase 2 is the compose `test` service: internal network
# only, offline install without scripts, then the tests against db.
LOCK_TAR := COPYFILE_DISABLE=1 tar -C "$(CURDIR)" --no-xattrs -cf - pnpm-lock.yaml pnpm-workspace.yaml .npmrc
FETCH := mkdir -p /work && tar -C /work --no-same-owner -xf - && corepack enable && corepack prepare pnpm@9.15.9 --activate && pnpm fetch --ignore-scripts
IN_TEST := : "$${DATABASE_URL_TEST:?DATABASE_URL_TEST is required for make test (cp .env.example .env)}" && mkdir -p /work && tar -C /work --no-same-owner -xf - && pnpm install --offline --frozen-lockfile --ignore-scripts
# Credentials come only from the operator's .env, which compose reads from the project directory and passes
# to the test service environment; no recipe interpolates or prints them. The check fails early and clearly.
# ENV_FILE is overridable only to test the guard; compose always reads the project .env, so overriding it does not change where credentials come from.
ENV_FILE := .env
ENV_CHECK := test -f "$(ENV_FILE)" || { echo "missing $(ENV_FILE): run 'cp .env.example .env' and fill it in (make test/validate read credentials from it)" >&2; exit 1; }
TEST_RUN := docker compose --profile test run --rm -T --build test bash -euo pipefail -c

help:               ## Lista los targets
	@set -o pipefail; grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

setup:              ## Instala git hooks y comprueba herramientas
	git config core.hooksPath .githooks
	chmod +x .githooks/* .claude/hooks/*.sh
	@command -v node >/dev/null || { echo "falta node 22"; exit 1; }
	@command -v pnpm >/dev/null || { echo "falta pnpm (corepack enable)"; exit 1; }
	@command -v docker >/dev/null || { echo "falta docker"; exit 1; }
	@command -v jq >/dev/null || echo "aviso: jq no está instalado; los hooks usarán python3/node"
	@echo "ok"

orchestrator:       ## Lanza Claude Code como Orchestrator (agente de sesión, ADR-006)
	claude --agent orchestrator

verify-hooks:       ## Comprueba que las barreras funcionan (atribución, scope)
	@bash scripts/verify-hooks.sh

up:                 ## Levanta db, migrate, worker y web
	docker compose up --build -d

up-local:           ## Igual, con Ollama (perfil local)
	docker compose --profile local up --build -d

# down/logs/ps never use the credentials, but compose interpolates the required (`:?`) variables
# for every command. Filler is set per recipe only, and real values from the environment win.
# up/up-local deliberately do not get it: they must keep failing without .env.
COMPOSE_FILLER := POSTGRES_PASSWORD="$${POSTGRES_PASSWORD:-unused}" DATABASE_URL="$${DATABASE_URL:-unused}"

down:               ## Para y elimina contenedores (conserva volúmenes)
	$(COMPOSE_FILLER) docker compose --profile '*' down

logs:               ## Sigue los logs
	$(COMPOSE_FILLER) docker compose --profile '*' logs -f --tail=100

ps:                 ## Estado de los servicios
	$(COMPOSE_FILLER) docker compose --profile '*' ps

test:               ## Tests en contenedor contra db de compose (requiere .env; deja db en marcha, make down la para)
	@$(ENV_CHECK)
	@docker volume create $(PNPM_STORE_VOLUME) >/dev/null
	set -o pipefail; $(LOCK_TAR) | $(DOCKER_NODE) '$(FETCH)'
	set -o pipefail; $(HOST_TAR) | $(TEST_RUN) '$(IN_TEST) && pnpm test'

validate:           ## typecheck + lint (workspaces y raíz) + test + format:check en contenedor, tests contra db (TD-008)
	@$(ENV_CHECK)
	@docker volume create $(PNPM_STORE_VOLUME) >/dev/null
	set -o pipefail; $(LOCK_TAR) | $(DOCKER_NODE) '$(FETCH)'
	set -o pipefail; $(HOST_TAR) | $(TEST_RUN) '$(IN_TEST) && pnpm -r typecheck && pnpm -r lint && $(LINT_ROOT) && pnpm test && pnpm format:check'

lint:               ## Lint de los workspaces y de los ficheros de configuración de la raíz (TD-007)
	pnpm -r lint && $(LINT_ROOT)

typecheck:          ## Typecheck
	pnpm -r typecheck
