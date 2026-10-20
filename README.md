# AgentLab

Plataforma open source para **definir, ejecutar, observar y evaluar equipos de agentes de IA** sin depender de un proveedor concreto. TypeScript de extremo a extremo: Next.js (UI + API), worker Node.js con LangGraph.js, PostgreSQL + Drizzle, Docker Compose. Coste de inferencia objetivo: 0 € (modelos gratuitos o Ollama local).

> **Estado**: fase 0 — base documental y sistema de agentes de desarrollo. Sin código de aplicación todavía. El primer hito (M0) crea el monorepo y el entorno.

## Qué hay en este repositorio ahora

```
agentlab/
├── CLAUDE.md                      # puntero para Claude Code
├── Makefile                       # setup · orchestrator · verify-hooks · up · test
├── .env.example                   # variables (sin secretos)
├── .claude/                       # sistema de agentes de desarrollo (ver docs/AGENTS.md)
│   ├── settings.json              # permisos, hooks globales, sin atribución en commits
│   ├── task-scope.json            # scope de la tarea activa (lo escribe el Orchestrator)
│   ├── agents/                    # orchestrator (sesión) + 12 subagentes
│   ├── commands/                  # /status /next-task /execute-task /verify-task /close-task /commit /open-decision
│   ├── hooks/                     # scope-guard · role-guard · bash-guard
│   └── skills/                    # task-packet · reports · testing-conventions · monorepo-conventions
├── .githooks/                     # commit-msg (sin atribución, Conventional Commits) · pre-commit (secretos)
├── scripts/verify-hooks.sh        # prueba que las barreras funcionan
└── docs/
    ├── TECHNICAL_SPEC.md          # qué debe hacer (fuente: especificación del autor)
    ├── ARCHITECTURE.md            # cómo está construido: procesos, paquetes, contratos, datos
    ├── ROADMAP.md                 # M0–M5 con criterios de salida
    ├── TASKS.md                   # 39 tareas con owner, scope y DoD
    ├── TECHNICAL_DEBT.md          # deuda con fecha de pago
    ├── AGENTS.md                  # sistema de agentes de desarrollo (Claude Code)
    ├── DEVELOPMENT_WORKFLOW.md    # flujo, TASK PACKET, informes, commits
    ├── CLAUDE_CODE_INITIAL_PROMPT.md
    ├── adr/                       # ADR-000…008
    ├── security/SECURITY_POLICY.md
    └── reports/                   # un informe por tarea cerrada
```

## Requisitos

- Node.js 22 LTS y pnpm 9 (`corepack enable`)
- Docker con Compose v2
- Claude Code (para el flujo de desarrollo con agentes)
- `jq` recomendado (los hooks usan `python3` o `node` si falta)

## Empezar

```bash
make setup           # instala git hooks (core.hooksPath) y comprueba herramientas
make verify-hooks    # debe terminar con "todas las barreras funcionan"
cp .env.example .env # sin claves también arranca (perfil local con Ollama en M2)
make orchestrator    # = claude --agent orchestrator
```

Primera sesión: pega el contenido de `docs/CLAUDE_CODE_INITIAL_PROMPT.md`. Sesiones posteriores: el Orchestrator ejecuta `/status` solo y luego `/next-task`.

Cuando M0 esté cerrado, además:

```bash
make up              # docker compose up --build -d
curl localhost:3000/api/health
make test
```

## Cómo se desarrolla

Orquestador de sesión + subagentes especializados con permisos impuestos por hooks; estado en `docs/`, nunca en la conversación; cada tarea pasa por implementación → tests → revisión → (seguridad) → cierre documental → commit confirmado por el humano. Detalle en `docs/AGENTS.md` y `docs/DEVELOPMENT_WORKFLOW.md`.

Dos sistemas de agentes conviven aquí: los **de desarrollo** (`.claude/agents/`) construyen AgentLab; los **del producto** (`packages/agents`, desde M1) son los que AgentLab ejecuta.

## Licencia

Pendiente (ADR-008 propone Apache-2.0; se acepta antes de publicar).
