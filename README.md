# AgentLab

[![CI](https://github.com/davidfdzmorilla/Agents-Lab/actions/workflows/ci.yml/badge.svg)](https://github.com/davidfdzmorilla/Agents-Lab/actions/workflows/ci.yml)

Plataforma open source para **definir, ejecutar, observar y evaluar equipos de agentes de IA** sin depender de un proveedor concreto. TypeScript de extremo a extremo: Next.js (UI + API), worker Node.js con LangGraph.js, PostgreSQL + Drizzle, Docker Compose. Coste de inferencia objetivo: 0 € (modelos gratuitos o Ollama local).

> **Estado**: el monorepo (`apps/`, `packages/`) y el entorno Docker Compose existen. Los hitos y sus criterios de salida están en [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Estructura del repositorio

```
agentlab/
├── apps/
│   ├── web/                       # Next.js: UI y API (GET /api/health)
│   └── worker/                    # worker Node.js (src/index.ts)
├── packages/
│   ├── core/                      # contratos y validación de variables (src/env.ts)
│   └── persistence/               # Drizzle: esquema, migraciones y CLI (src/cli/)
├── docker/                        # web.Dockerfile, worker.Dockerfile, postgres/init.sql (crea agentlab y agentlab_test)
├── docs/                          # documentación: ver «Documentación» abajo
├── scripts/                       # verify-hooks.sh · ci/ (comprobaciones de la CI)
├── .github/workflows/ci.yml       # CI en cada push y PR
├── .claude/                       # sistema de agentes de desarrollo (ver docs/AGENTS.md)
├── .githooks/                     # commit-msg · pre-commit
├── CLAUDE.md                      # puntero para Claude Code
├── Makefile                       # targets de desarrollo (make help)
├── compose.yaml                   # servicios: db, migrate, web, worker, test, ollama (perfil local)
├── compose.override.example.yaml  # plantilla opcional para exponer db al host (solo desarrollo)
├── .env.example                   # variables de entorno (sin valores)
└── package.json                   # scripts raíz (turbo) y db:*
```

## Camino principal: en contenedor

Requisitos en el host: `make`, `bash`, `tar`, `curl` (para la comprobación de `/api/health`) y Docker con `docker compose`. `bash` es el shell de `make` (`Makefile:5`, `SHELL := /bin/bash`). No hace falta Node ni pnpm en el host.

```bash
cp .env.example .env # crea tu fichero de variables (no se commitea)
```

Antes de `make up`, abre `.env` y rellena:

- `POSTGRES_PASSWORD`: obligatoria; solo letras y dígitos (`[A-Za-z0-9]`). Compose se niega a arrancar sin ella.
- `DATABASE_URL`: obligatoria; `postgresql://agentlab:<pw>@db:5432/agentlab`, con la misma `<pw>` que `POSTGRES_PASSWORD`.
- `DATABASE_URL_TEST`: obligatoria para `make test` y `make validate`; `postgresql://agentlab:<pw>@db:5432/agentlab_test`, con la misma `<pw>`.

Después:

```bash
make up              # docker compose up --build -d
curl localhost:3000/api/health
```

`make up` levanta `db`, `migrate`, `worker` y `web`. El orden de arranque lo impone Compose:

1. `db` arranca y espera a estar `healthy`.
2. `migrate` aplica las migraciones y debe terminar con código 0.
3. `worker` y `web` arrancan cuando `migrate` ha terminado correctamente.

`web` publica el puerto 3000 solo en `127.0.0.1`. Ningún otro servicio publica puertos al host.

`web` no tiene healthcheck (`compose.yaml:35-57`), y `make up` (`docker compose up --build -d`, `Makefile:53`) vuelve antes de que Next escuche. Si el `curl` falla justo después, reintenta unos segundos. Con la base arriba, la respuesta es `{"ok":true,"db":"up","version":…}` (`apps/web/src/server/health.ts:21-22`); con la base caída, 503 con `{"ok":false,"db":"down"}` (`apps/web/src/server/health.ts:26`).

Para el perfil local con Ollama: `make up-local`.

Otros targets útiles: `make ps` (estado), `make logs` (logs en seguimiento) y `make down` (para y elimina contenedores; conserva los volúmenes). `make help` lista todos los targets.

### Tests y validación en contenedor

- `make test`: ejecuta los tests en un contenedor contra la base `db` de Compose. Requiere `.env` fuera de CI. Deja `db` en marcha; `make down` la para.
- `make validate`: en dos fases. La fase 1 descarga dependencias con acceso a internet (`pnpm fetch --ignore-scripts`, `Makefile:24`), sin scripts y sin base de datos. La fase 2 corre en el servicio `test`, en una red interna que solo alcanza `db`, e instala offline (`Makefile:25`). Ejecuta, en este orden: `typecheck`, `lint` (workspaces y raíz), `test` y `format:check`. Requiere `.env` con `DATABASE_URL_TEST`.

La CI (`.github/workflows/ci.yml`) corre en cada push y PR: lint, typecheck, test, audit, secrets-scan y `make validate` en Linux.

## Desarrollo en el host

Requisitos: Node.js `>=22.12 <23` y pnpm 9.15.9. La versión la impone `engine-strict=true` (`.npmrc:1`) junto con `engines` (`package.json:7`, `"node": ">=22.12 <23"`), que hacen que pnpm rechace versiones distintas. `packageManager` fija pnpm 9.15.9 (`package.json:5`); `corepack enable` lo activa.

Primero, instala dependencias:

```bash
pnpm install
```

Después:

```bash
make setup           # instala los git hooks (core.hooksPath) y comprueba que existen node, pnpm, docker y jq
make verify-hooks    # debe terminar con "todas las barreras funcionan"
make lint            # lint de workspaces y de la raíz
make typecheck       # typecheck de los workspaces
```

`make setup` solo comprueba que las herramientas existen; no comprueba sus versiones. `jq` es opcional: sin él, los hooks usan `python3` o `node`.

Para Claude Code (flujo de desarrollo con agentes): `make orchestrator` lanza `claude --agent orchestrator`. Primera sesión: pega el contenido de `docs/CLAUDE_CODE_INITIAL_PROMPT.md`. El Orchestrator ejecuta `/status` al arrancar (ver `CLAUDE.md`).

### Base de datos desde el host

Scripts de la raíz que delegan en `@agentlab/persistence`:

- `pnpm db:generate`: genera migraciones con `drizzle-kit generate`.
- `pnpm db:migrate`: aplica las migraciones a la base de `DATABASE_URL`.
- `pnpm db:reset`: resetea la base de `DATABASE_URL_TEST`, que debe terminar en `_test`.

No hay targets de `make` que envuelvan estos comandos.

Para usarlos desde el host, la base `db` tiene que publicar su puerto. Para eso, copia la plantilla:

```bash
cp compose.override.example.yaml compose.override.yaml
```

`compose.override.yaml` está en `.gitignore`. La plantilla publica `127.0.0.1:5432` y une `db` a la red `egress`. **Aviso**: con ese override activo, `db` tiene salida a internet (deuda TD-016, se paga en TASK-037).

Después, `make up` recrea `db` con el puerto publicado (`compose.override.example.yaml:1`; `Makefile:53`).

Desde el host, `DATABASE_URL` y `DATABASE_URL_TEST` son las de tu `.env` con `127.0.0.1` en lugar de `db` (`compose.override.example.yaml:9`, `.env.example:8-9`); los CLI las leen del entorno del proceso, no de `.env` (`packages/core/src/env.ts:43` para `DATABASE_URL`, `:54` para `DATABASE_URL_TEST`).

## Documentación

- [`docs/TECHNICAL_SPEC.md`](docs/TECHNICAL_SPEC.md): qué debe hacer AgentLab.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): cómo está construido.
- [`docs/ROADMAP.md`](docs/ROADMAP.md): hitos y criterios de salida.
- [`docs/TASKS.md`](docs/TASKS.md): tareas.
- [`docs/TECHNICAL_DEBT.md`](docs/TECHNICAL_DEBT.md): deuda técnica con fecha de pago.
- [`docs/adr/`](docs/adr/): decisiones de arquitectura.
- [`docs/reports/`](docs/reports/): un informe por tarea cerrada.

## Cómo se desarrolla

Orquestador de sesión + subagentes especializados con permisos impuestos por hooks; estado en `docs/`, nunca en la conversación; cada tarea pasa por implementación → tests → revisión → (seguridad) → cierre documental → commit confirmado por el humano. Detalle en `docs/AGENTS.md` y `docs/DEVELOPMENT_WORKFLOW.md`.

Dos sistemas de agentes conviven aquí: los **de desarrollo** (`.claude/agents/`) construyen AgentLab; los **del producto** (`packages/agents`, aún no existe) son los que AgentLab ejecuta.

## Licencia

Repositorio público sin fichero LICENSE ni campo `license` en `package.json`: sin licencia, todos los derechos reservados, hasta que ADR-008 se acepte en M5.
