# AgentLab — Sistema de agentes de desarrollo (Claude Code)

| Campo | Valor |
|---|---|
| Versión | 1.1 (2026-10-20) — §4: añadida garantía de no evasión de hooks (decisión humana) |
| Jerarquía | ADR > SPEC > ARCHITECTURE > **AGENTS + WORKFLOW** > ROADMAP > TASKS |

> Este documento describe **cómo se construye AgentLab con Claude Code**. No confundir con los agentes del producto (Manager, Researcher, Analyst, Writer, Critic, Evaluator), que viven en `packages/agents` y se describen en `TECHNICAL_SPEC.md §4`.

## 1. Piezas

| Pieza | Dónde | Para qué |
|---|---|---|
| **Orchestrator (sesión)** | `.claude/agents/orchestrator.md`, lanzado con `make orchestrator` (= `claude --agent orchestrator`) | Reconstruye el estado desde `docs/`, elige tarea, redacta el TASK PACKET, delega, exige veredictos, pide aprobación. **Nunca implementa.** |
| Subagentes | `.claude/agents/*.md` | Trabajo especializado en contexto aislado con `tools` mínimos, modelo y `effort` por rol |
| Comandos | `.claude/commands/*.md` | Puntos de entrada del flujo: `/status`, `/next-task`, `/execute-task`, `/verify-task`, `/close-task`, `/commit`, `/open-decision` |
| Skills | `.claude/skills/*/SKILL.md` | Conocimiento reutilizable precargado en los subagentes que lo necesitan |
| Hooks | `.claude/settings.json` + `.claude/hooks/*.sh` + frontmatter de cada subagente | Reglas que se **imponen** por mecanismo, no se sugieren |
| Git hooks | `.githooks/` | Segunda barrera: funcionan aunque el commit lo haga el humano a mano |
| `CLAUDE.md` | raíz | Puntero a este documento y a `DEVELOPMENT_WORKFLOW.md`; respaldo si la sesión se lanza con `claude` a secas |

## 2. Por qué el Orquestador es la sesión y no un subagente

Un subagente arranca sin la conversación y termina devolviendo un resumen: no puede sostener el ciclo (elegir tarea → delegar → leer veredictos → actualizar `TASKS.md` → pedir aprobación → siguiente). Por eso el Orquestador es el **agente de sesión**: su prompt sustituye al de Claude Code, su lista `tools` es la única forma de restringir *por mecanismo* qué subagentes puede invocar (`Agent(architect, core-dev, …)`), y su `initialPrompt` ejecuta `/status` al arrancar. Decisión registrada en ADR-006.

Con `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1` ningún subagente puede invocar a otro: el `engine-dev` no puede llamar al `tester` ni al `reviewer`. Solo el Orquestador delega.

## 3. Roster de subagentes

| Nombre | Modelo / effort | Tools | Puede editar (hook de rol) | Rol |
|---|---|---|---|---|
| `architect` | opus / high | Read, Grep, Glob, Bash, WebSearch, WebFetch, Edit, Write | `docs/adr/**`, `docs/ARCHITECTURE.md`, `docs/TECHNICAL_SPEC.md` (§13 OPEN DECISIONS) | Planes de implementación, ADRs `Proposed`, resolución de OPEN DECISIONS. No escribe código. |
| `core-dev` | sonnet / medium | Read, Grep, Glob, Edit, Write, Bash | `packages/core/**`, `packages/policies/**`, `packages/observability/**` | Contratos Zod, errores, presupuesto, observabilidad |
| `persistence-dev` | sonnet / medium | Read, Grep, Glob, Edit, Write, Bash | `packages/persistence/**`, `drizzle.config.ts`, `docker/postgres/**` | Drizzle, migraciones, repositorios, checkpointer, NOTIFY |
| `providers-dev` | sonnet / medium | Read, Grep, Glob, Edit, Write, Bash, WebFetch | `packages/providers/**` | Adaptadores de modelos, registro, reintentos |
| `engine-dev` | sonnet / medium | Read, Grep, Glob, Edit, Write, Bash | `packages/orchestrator/**`, `packages/agents/**`, `packages/tools/**`, `packages/evaluations/**`, `apps/worker/**` | Grafos LangGraph, roles del producto, herramientas, worker |
| `web-dev` | sonnet / medium | Read, Grep, Glob, Edit, Write, Bash | `apps/web/**` | Next.js: API, SSE, UI |
| `devops` | sonnet / medium | Read, Grep, Glob, Edit, Write, Bash | raíz del monorepo (`package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig*.json`, `.eslintrc*`, `.prettierrc`, `Makefile`, `.nvmrc`), `compose*.yaml`, `docker/**`, `.gitlab-ci.yml`, `.github/**`, `scripts/**`, `.env.example`, `.dockerignore`, `.gitignore`, `apps/*/package.json`, `packages/*/package.json` | Monorepo, Docker, CI |
| `tester` | sonnet / medium | Read, Grep, Glob, Edit, Write, Bash | `**/*.test.ts`, `tests/**`, `**/testing/**`, `vitest.config.*`, `docs/reports/M*-closure.md` | Escribe y ejecuta tests; veredicto `PASS`/`FAIL`. Nunca toca código de producción. |
| `reviewer` | opus / high | Read, Grep, Glob, Bash | ninguno (solo lectura) | Revisión de código contra SPEC/ARCHITECTURE; veredicto `APPROVED`/`CHANGES_REQUESTED`; propone deuda |
| `security` | opus / high | Read, Grep, Glob, Bash | ninguno (solo lectura) | Revisión de seguridad; obligatoria en tareas marcadas **security REQUIRED** y en cualquier cambio de `providers`, `tools`, `policies`, API, Docker o CI |
| `docs-keeper` | haiku / low | Read, Grep, Glob, Edit, Write | `docs/**` (excepto `adr/**`, `ARCHITECTURE.md`, `TECHNICAL_SPEC.md`), `README.md`, `examples/**`, `LICENSE`, `NOTICE`, `**/README.md`, `.claude/skills/**` (decisión humana, registrada en el cierre de TASK-003) | Cierra tareas: informe, `TASKS.md`, `TECHNICAL_DEBT.md`, README, skills de convenciones |
| `committer` | haiku / low | Read, Grep, Glob, Bash | ninguno (no edita ficheros) | `PREPARE` (diff, staging, mensaje propuesto) y `EXECUTE` (commit local) como pasos separados |

**Orchestrator (sesión)**: opus / high. Tools: `Agent(architect, core-dev, persistence-dev, providers-dev, engine-dev, web-dev, devops, tester, reviewer, security, docs-keeper, committer), Read, Grep, Glob, Edit, Write, Bash, Skill`. Hook de rol: solo puede editar `docs/TASKS.md`, `docs/TECHNICAL_DEBT.md`, `docs/ROADMAP.md`, `docs/reports/**` y `.claude/task-scope.json`.

Elección de modelos: Opus donde el juicio importa (diseño, revisión, orquestación), Sonnet para implementar, Haiku para lo mecánico. Todos devuelven **resúmenes estructurados**, no volcados: cada subagente consume contexto propio y la sesión principal solo recibe el informe.

## 4. Garantías por mecanismo

| Garantía | Mecanismo |
|---|---|
| Solo el Orquestador delega | `tools: Agent(…)` del agente de sesión + `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1` + `permissions.deny` de `Agent(fork)`, `Agent(general-purpose)`, `Agent(claude)`, `Agent(Explore)`, `Agent(Plan)` |
| Un subagente solo toca lo suyo | `hooks/role-guard.sh <rol>` en el frontmatter de cada subagente (PreToolUse Edit/Write) |
| Una tarea solo toca su scope | `hooks/scope-guard.sh` global: lee `.claude/task-scope.json` (lo escribe el Orquestador en `/execute-task`) y bloquea cualquier edición fuera de `allow` |
| Reviewer y security no editan | No tienen `Edit`/`Write` en `tools` |
| Nadie hace push/merge/rebase/reset | `permissions.deny`: `Bash(git push*)`, `Bash(git merge*)`, `Bash(git rebase*)`, `Bash(git reset --hard*)`, `Bash(git checkout -- *)` + `hooks/bash-guard.sh` |
| Nadie lee ni edita secretos | `permissions.deny`: `Read(.env)`, `Read(.env.*)`, `Edit(.env*)`, `Write(.env*)` (excepto `.env.example`) + `.githooks/pre-commit` bloquea `.env*` y patrones de clave |
| Sin atribución a IA en commits | `attribution` vacío en `settings.json` + `hooks/bash-guard.sh` rechaza `git commit` con `Co-Authored-By`, `Claude`, `Anthropic`, `Generated with` + `.githooks/commit-msg` (tercera barrera, vale para commits manuales) |
| Commit solo con tarea DONE | `bash-guard.sh` solo permite `git commit` si `.claude/task-scope.json` tiene `"commit_allowed": true`, que únicamente escribe el Orquestador en `/commit` tras los veredictos |
| Dependencias sin aprobación | `bash-guard.sh` bloquea `pnpm add`, `pnpm install <pkg>`, `npm i <pkg>` salvo que el TASK PACKET las liste en `task-scope.json → deps_allowed`. Fuera del repositorio, instalar para validar está permitido; dentro, solo `deps_allowed`. Instalar en el repo por un camino distinto de `pnpm add` para meter lo que `deps_allowed` no autoriza es un rodeo. |
| Un bloqueo de hook se cita y se para; nunca se rodea, tampoco en el scratchpad ni escribiendo por Bash lo que Write no deja. Una evasión detectada invalida la evidencia de esa fase y la fase se repite. Un bloqueo que parece un falso positivo se reporta como tal; el juicio de si lo es no es del subagente. | Prompt de cada subagente («nunca intentes rodearlo») + revisión del Orchestrator de los informes; los hooks (`bash-guard`, `role-guard`, `scope-guard`) bloquean y el agente cita el bloqueo literal en su informe |
| Edición de ficheros del repositorio | "Los ficheros del repositorio se editan con Edit/Write. Un script en línea (python3 -c, node -e, perl -i) que escriba en el repositorio cuenta como rodeo del hook aunque no haya habido bloqueo; sed -i y tee sobre rutas del scope sí están permitidos porque el hook los analiza". Una evasión invalida la evidencia de la fase y la fase se repite. | Mecanismo: `bash-guard.sh` analiza las escrituras por shell (`sed -i`, `tee`, redirecciones) y `scope-guard`/`role-guard` las de Edit/Write |
| Toda validación se ejecuta con la versión de Node del proyecto | Toda validación (tests, typecheck, lint, formato, builds) se ejecuta con la versión de Node del proyecto (`>=22.12 <23`): en el contenedor fijado (`make test`/`make validate`) o con nvm; nunca con otro Node del host. Aplica a todos los roles, también a reviewer y security. Mecanismo: instrucción en los TASK PACKET + revisión del Orchestrator de los informes; `engines`/`engine-strict` en `.npmrc` cubre las instalaciones. |

Si un hook bloquea algo que el flujo necesitaba, **el hook tiene razón**: se corrige el TASK PACKET o el scope, no el hook. Cambiar un hook requiere aprobación humana y un ADR si cambia una garantía.

## 5. Ciclo de una tarea

```
/next-task
  Orchestrator lee TASKS.md → elige la READY de menor número (o la que diga el humano)
  → architect (si la tarea lo exige o toca ARCHITECTURE/ADR): plan de implementación
  → humano aprueba el plan
/execute-task TASK-NNN
  Orchestrator escribe .claude/task-scope.json {task, allow[], deps_allowed[]}
  → marca IN_PROGRESS en TASKS.md
  → delega al owner con el TASK PACKET
  → owner devuelve informe IMPLEMENTATION
/verify-task TASK-NNN
  → tester: informe TEST (PASS | FAIL)
  → reviewer: informe REVIEW (APPROVED | CHANGES_REQUESTED)
  → security (si aplica): informe SECURITY (APPROVED | BLOCKED)
  Si algo no pasa: vuelta al owner con los hallazgos (máx. 3 ciclos; después, humano)
/close-task TASK-NNN
  → docs-keeper: docs/reports/TASK-NNN.md con los cuatro informes, TASKS.md → DONE,
    TECHNICAL_DEBT.md si hay deuda nueva, README si cambió la instalación
/commit
  Orchestrator escribe commit_allowed: true
  → committer PREPARE: diff, ficheros a stagear, mensaje propuesto
  → humano confirma
  → committer EXECUTE: git add <lista> && git commit
  Orchestrator deja task-scope.json en {"task": null, "allow": ["*"], "commit_allowed": false}
```

Detalle, formatos de informe y TASK PACKET en `DEVELOPMENT_WORKFLOW.md`.

## 6. Qué requiere al humano (siempre)

- Aprobar el plan de cada tarea antes de `/execute-task`.
- Confirmar cada commit (entre PREPARE y EXECUTE).
- Cambios de arquitectura o alcance, aceptar ADRs, resolver OPEN DECISIONS.
- Dependencias nuevas de peso (cualquier cosa que no sea una dev-dependency de test/lint).
- Deuda `HIGH`/`CRITICAL`.
- `git push`, merge, rebase, migraciones destructivas, despliegues, secretos: **siempre el humano, fuera de Claude Code**.
- Cerrar un hito.

## 7. Estructura de `.claude/`

```
.claude/
├── settings.json          # env, permissions.deny, hooks globales, attribution vacío
├── task-scope.json        # escrito por el Orchestrator; leído por scope-guard.sh
├── agents/
│   ├── orchestrator.md    # agente de SESIÓN (no subagente)
│   ├── architect.md  core-dev.md  persistence-dev.md  providers-dev.md
│   ├── engine-dev.md  web-dev.md  devops.md  tester.md
│   ├── reviewer.md  security.md  docs-keeper.md  committer.md
├── commands/
│   ├── status.md  next-task.md  execute-task.md  verify-task.md
│   ├── close-task.md  commit.md  open-decision.md
├── hooks/
│   ├── scope-guard.sh     # edición dentro del scope de la tarea
│   ├── role-guard.sh      # edición dentro de lo que permite el rol
│   ├── bash-guard.sh      # git/deps/secretos
│   └── lib.sh             # utilidades compartidas (parseo JSON sin jq si no está)
└── skills/
    ├── task-packet/SKILL.md
    ├── reports/SKILL.md
    ├── testing-conventions/SKILL.md
    └── monorepo-conventions/SKILL.md
```
