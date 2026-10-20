.PHONY: help setup orchestrator verify-hooks up up-local down logs ps test lint typecheck

help:               ## Lista los targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

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

up:                 ## Levanta web + worker + db
	docker compose up --build -d

up-local:           ## Igual, con Ollama (perfil local)
	docker compose --profile local up --build -d

down:               ## Para y elimina contenedores (conserva volúmenes)
	docker compose down

logs:               ## Sigue los logs
	docker compose logs -f --tail=100

ps:                 ## Estado de los servicios
	docker compose ps

test:               ## Tests de todo el monorepo (requiere db levantada para integración)
	pnpm test

lint:               ## Lint
	pnpm -r lint

typecheck:          ## Typecheck
	pnpm -r typecheck
