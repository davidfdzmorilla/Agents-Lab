# AgentLab — Tareas

| Campo | Valor |
|---|---|
| Última actualización | 2026-10-20 (cierre TASK-003) |
| Hito actual | M0 |
| Tareas READY | TASK-005, TASK-010, TASK-012 |

## Cómo se lee este documento

- **Estados**: `BLOCKED` (dependencias sin cerrar) · `READY` (puede empezar) · `IN_PROGRESS` (una sola a la vez salvo autorización) · `REVIEW` (implementada; faltan veredictos) · `DONE` (tester PASS + reviewer APPROVED + security cuando aplica + informe en `docs/reports/TASK-NNN.md`) · `CANCELLED`.
- **Owner**: subagente de desarrollo que implementa (ver `AGENTS.md`). El Orchestrator (sesión) nunca es owner.
- **Scope**: rutas que la tarea puede tocar. El hook de scope bloquea cualquier edición fuera de ellas. `docs/**` siempre está permitido para `docs-keeper`.
- **DoD**: cada viñeta debe ser verificable por el `tester` o, si no es automatizable, documentada en el informe de cierre.
- Una tarea `DONE` no se reabre: se crea una tarea `fix` nueva que la referencia.
- Lo que no está definido en SPEC/ARCHITECTURE no se inventa: se registra como `OPEN DECISION` (SPEC §13) y la tarea queda `BLOCKED` si depende de ello.

Solo el Orchestrator (sesión) y `docs-keeper` editan este fichero.

---

## M0 — Base

### TASK-001 · Monorepo pnpm + Turborepo + TypeScript estricto
- **Estado**: DONE · **Owner**: devops · **Depende de**: —
- **Scope**: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.nvmrc`, `.npmrc`, `eslint.config.js`, `.prettierrc`, `.editorconfig`, `.gitignore`, `apps/web/package.json`, `apps/worker/package.json`, `packages/core/package.json`, `packages/persistence/package.json`, `apps/*/tsconfig.json`, `packages/*/tsconfig.json`, `apps/*/src/index.ts`, `packages/*/src/index.ts`, `Makefile`
- **Dependencias autorizadas** (solo devDependencies en la raíz, última estable al instalar, fijadas sin `^`): `typescript`, `turbo`, `eslint`, `@eslint/js`, `typescript-eslint`, `prettier`, `eslint-config-prettier`, `@types/node`.
- **DoD**:
  - `pnpm install` en limpio sin warnings de peer deps.
  - `pnpm -r typecheck` y `pnpm -r lint` pasan con los cuatro workspaces vacíos (un `index.ts` cada uno).
  - `tsconfig.base.json` con `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `moduleResolution: bundler`, ESM.
  - ESLint última major estable, flat config (`eslint.config.js`); regla `no-restricted-imports` que prohíbe `@agentlab/*/src/*`.
  - Versiones exactas de las devDependencies fijadas sin `^` en `package.json` y listadas en el informe (última estable compatible con ARCHITECTURE §9 y con los peers del resto: TypeScript 5.9.3, `@types/node` 22).
  - `.npmrc` con `engine-strict=true` y `engines` en `package.json` (node 22, pnpm 9.15.9): la instalación con otra versión de Node falla.
  - Validación hecha con Node 22 (nvm o contenedor), nunca con el Node de la máquina si no es 22.
  - `turbo.json` con pipelines `build`, `lint`, `typecheck`, `test` y dependencias `^build`.

### TASK-002 · Resolver OD-001: versiones de LangGraph.js, checkpointer PostgreSQL, Drizzle, Next.js
- **Estado**: DONE · **Owner**: architect · **Depende de**: —
- **Scope**: `docs/ARCHITECTURE.md` (§4, §6, §9), `docs/adr/ADR-002-*.md`, `docs/adr/ADR-000-indice-y-plantilla.md` (índice), `docs/TECHNICAL_SPEC.md` (§3 y §13 únicamente)
- **DoD**:
  - Tabla de versiones en `ARCHITECTURE.md §9` con la versión exacta y la razón.
  - Verificado que el checkpointer PostgreSQL elegido es compatible con la versión de LangGraph.js elegida (enlace a la documentación o al changelog).
  - Verificado que Next.js elegido soporta Route Handlers con `ReadableStream` para SSE.
  - ADR-002 actualizado de `Proposed` a `Accepted` **solo tras aprobación humana**.
  - OD-001 marcada como resuelta en SPEC §13.

### TASK-003 · Docker Compose: web, worker, db (+ perfil local con ollama)
- **Estado**: DONE · **Owner**: devops · **Depende de**: TASK-001, OD-007 (decidida: ADR-009) · **security REQUIRED** (docker/compose)
- **Scope**: `compose.yaml`, `compose.override.example.yaml`, `docker/worker.Dockerfile`, `docker/postgres/init.sql`, `.env.example`, `.dockerignore`, `.gitignore`, `Makefile`, `apps/worker/package.json`, `apps/worker/src/index.ts`, `pnpm-lock.yaml` (`docker/web.Dockerfile` pasa a TASK-007)
- **Dependencias autorizadas**: `tsx` 4.23.15 exacta, declarada en `dependencies` de `apps/worker/package.json` por esta tarea (ADR-009).
- **Plan aprobado**: `docs/reports/TASK-003-plan.md` (con decisiones humanas OD-A…OD-F del 2026-10-20).
- **DoD**:
  - `docker compose up --build` levanta `db` y `worker` (y define `web`, cuyo Dockerfile llega en TASK-007); `db` solo en red interna sin salida; `web` publicado en `127.0.0.1:3000`.
  - `apps/worker/src/index.ts` provisional: registra el arranque, espera `SIGTERM` y sale con código 0 (sin lógica de negocio; lo sustituye TASK-008).
  - Worker con `init: true` (tini) y `CMD tsx src/index.ts`.
  - `.env.example`: `POSTGRES_PASSWORD`, `DATABASE_URL` y `DATABASE_URL_TEST` vacíos; `POSTGRES_PASSWORD` y `DATABASE_URL` obligatorios en compose (`:?`); `DATABASE_URL_TEST` documentada como obligatoria desde TASK-005 para `make test` (ningún servicio de compose la consume; no se pasa al worker); `LANGCHAIN_TRACING_V2=false`; variables de Compose separadas de las de `env.ts`.
  - `.dockerignore` y las exclusiones de la copia de `make validate`/`make test` excluyen `.env` y `.env.*` en cualquier nivel (`**/.env`, `**/.env.*`).
  - `compose.override.example.yaml` avisa de que, con el override activo, `db` tiene salida a internet (deuda LOW → TASK-037).
  - `make validate`/`make test` no montan el repo en el contenedor: reciben por stdin solo la copia filtrada (sin `.env`/`.env.*` en ningún nivel); prueba de cuatro niveles repetida con el `tar` de macOS y el del contenedor Linux (security, MEDIUM).
  - El contenedor de `make validate`/`make test` corre con `--cap-drop ALL --security-opt no-new-privileges`.
  - Las recetas con tubería fallan si falla cualquier paso (`SHELL := /bin/bash` y `set -o pipefail;` al inicio de cada receta con tubería: GNU Make 3.81 de macOS ignora `.SHELLFLAGS`; comentario en el Makefile que lo explica); `tar -C "$(CURDIR)"` entrecomillado; la copia excluye además `.envrc`, `*.env`, `.env-*`, `.env_*`, `settings.local.json` y `agent-memory-local`.
  - `compose.override.yaml` en `.gitignore`.
  - `make test` en M0: contenedor node fijado, sin base de datos.
  - `make validate` monta `node_modules` en un volumen con nombre propio (y el store de pnpm fuera del repo); el `node_modules` del host no se toca (verificado con un fichero centinela).
  - El plan documenta el hueco de migraciones en `make up` (lo cierra TASK-005 con el servicio `migrate`); TASK-003 no lo implementa.
  - `docker compose --profile local up` añade `ollama` sin puerto en host.
  - Dockerfiles multi-stage con `pnpm fetch` cacheado; usuario no root.
  - `init.sql` crea bases `agentlab` y `agentlab_test`.
  - `.env.example` sin ningún valor secreto; todas las variables documentadas en una línea.
  - `make up`, `make down`, `make logs`, `make test` funcionan.
  - `TURBO_TELEMETRY_DISABLED=1` en `Makefile` y en `docker/worker.Dockerfile` (el de web, en TASK-007).
  - Target `make validate` con el comando de validación en Docker `node:22` y store de pnpm en volumen con nombre (TD-008).
  - `tsx` 4.23.15 declarado en `dependencies` de `apps/worker`; `docker/worker.Dockerfile` ejecuta `tsx src/index.ts` (ADR-009).
  - Apagado limpio del worker provisional: `docker compose stop worker` hace que el contenedor termine en < `SHUTDOWN_GRACE_MS` con código 0 (`stop_grace_period` > `SHUTDOWN_GRACE_MS`). El apagado del worker real se verifica en TASK-008.

### TASK-004 · packages/core: esquemas Zod, errores tipados, env
- **Estado**: DONE · **Owner**: core-dev (paso 0: devops) · **Depende de**: TASK-001 · **security REQUIRED** (decisión humana)
- **Scope**: `packages/core/**`; paso 0 (devops): `package.json` (raíz), `packages/core/package.json`, `pnpm-lock.yaml`
- **Dependencias autorizadas** (versión exacta): `zod` 4.6.7 en `dependencies` de `packages/core`; `vitest` 5.0.5, `@vitest/coverage-v8` 5.0.5 y `vite` 8.3.4 en `devDependencies` de la raíz. Paso 0 también sube `engines.node` a `>=22.12 <23`.
- **Plan aprobado**: `docs/reports/TASK-004-plan.md` (con decisiones humanas OD-009…OD-017).
- **DoD**:
  - Esquemas: `AgentDefinitionSchema`, `TeamDefinitionSchema`, `RunRequestSchema`, `RunEventSchema` (discriminated union con los 15 tipos de SPEC §8, incluidos `run.partial` y `run.resumed`), `BudgetSchema`, `AgentInvocationResultSchema`, `ProviderCapabilitiesSchema`. Sin campos opcionales que M1 no use.
  - Ids UUID (v7 si está disponible sin dependencia nueva; si no, v4 de `crypto.randomUUID`).
  - `env.ts`: solo `DATABASE_URL` obligatoria; resto con valores por defecto de ARCHITECTURE y `.env.example`; `LANGCHAIN_TRACING_V2` con valor por defecto `"false"`.
  - `SecretResolver` (`(envName: string) => string | undefined`) exportado desde `core`, construido en `env.ts`; nunca expone valores en mensajes de error (test). Allowlist (OD-017): solo resuelve nombres que cumplen `^[A-Z][A-Z0-9_]*_API_KEY$` **y** están declarados en `env.ts`; cualquier otro (PATH, HOME, `DATABASE_URL`, `LANGCHAIN_*`, no declarados) → `undefined` (tests).
  - Interfaces `ModelProvider`, `Tool`, `GenerateRequest/Response` exactamente como `ARCHITECTURE.md §3`.
  - `AgentLabError` base con `code`, `retryable`, `cause`; subclases de proveedor y presupuesto.
  - `env.ts` con esquema Zod; `loadEnv()` falla con mensaje claro si falta una variable.
  - Estados de run y transiciones válidas como función pura `canTransition(from, to)` con test exhaustivo (tabla de `ARCHITECTURE.md §5`).
  - Cobertura de tests ≥ 90 % en `core`.
  - Cero dependencias de runtime salvo `zod`.
  - Versión exacta de `zod` compatible con los rangos de `@langchain/langgraph` 1.5.1 (`^3.25.32 || ^4.2.0`) y `@langchain/core` 1.2.18 (`^3.25.76 || ^4`), fijada sin `^` (ADR-002).
  - `vitest.config.ts` y tests fuera de `src/` conviven con `rootDir: src`: rootDir se mantiene; decidir include/tsconfig aparte (TD-010).

### TASK-005 · packages/persistence: Drizzle, migración inicial, repositorios base
- **Estado**: READY · **Owner**: persistence-dev · **Depende de**: TASK-003, TASK-004 · **security REQUIRED**
- **Scope**: `packages/persistence/**`, `drizzle.config.ts`, `turbo.json`, `Makefile`, `compose.yaml` (estos tres fuera del rol de persistence-dev: se reparten con devops al planificar)
- **DoD**:
  - `turbo.json` deja pasar `DATABASE_URL_TEST` a las tareas de test (`passThroughEnv`) y `make test` ejecuta los tests de integración contra `agentlab_test`.
  - `DATABASE_URL_TEST` obligatoria para `make test` (y para el servicio `migrate` de test, si lo hubiera): falla con mensaje claro si falta (`:?` o comprobación equivalente); nunca se pasa a `web` ni `worker`.
  - `make test` corre en contenedor y no llega a `localhost:5432`: `DATABASE_URL_TEST` apunta al servicio `db` de compose (red y host definidos en el plan; `.env.example` actualizado).
  - Servicio one-shot `migrate` en `compose.yaml` (`depends_on: db` healthy, ejecuta `pnpm db:migrate` y sale); `web` y `worker` dependen de que termine con éxito.
  - `drizzle.config.ts` con `schemaFilter: ["public"]`: Drizzle nunca genera ni aplica cambios sobre el esquema `langgraph` (ADR-002).
  - `pnpm db:migrate` aplica las migraciones de Drizzle y, como paso explícito, ejecuta `setup()` del checkpointer de LangGraph sobre el esquema `langgraph` (ADR-002).
  - Esquema Drizzle con las 11 tablas de `ARCHITECTURE.md §6`, columnas obligatorias, índices y `unique(run_id, seq)`.
  - Migración `0000_init.sql` generada y aplicable con `pnpm db:migrate`; `pnpm db:reset` recrea `agentlab_test`.
  - `RunsRepository` (`create`, `get`, `claimNext` con `SKIP LOCKED`, `transition` que respeta `canTransition`, `heartbeat`), `EventsRepository` (`append` con `seq` atómico, `listSince(runId, seq)`), `ProjectsRepository`, `AgentDefinitionsRepository`.
  - `transition` a un estado inválido lanza `InvalidTransitionError` (409 en API).
  - Tests de integración contra PostgreSQL real; `claimNext` probado con dos llamadas concurrentes que no reclaman el mismo run.
  - Si falta `DATABASE_URL_TEST`, los tests de integración fallan con un mensaje claro (no se saltan; testing-conventions regla 6). `env.ts` no le da valor por defecto: las credenciales de la base de pruebas no van en código (OD-018).
  - `provider_configs.api_key_env` es `text`; test que falla si se intenta guardar un valor que parezca una clave (`sk-`, `AIza`, longitud > 40 sin espacios).

### TASK-006 · CI: lint, typecheck, test contra PostgreSQL de servicio
- **Estado**: BLOCKED · **Owner**: devops · **Depende de**: TASK-005, OD-004
- **Scope**: `.gitlab-ci.yml` o `.github/workflows/ci.yml` (según OD-004), `Makefile`, `scripts/ci/**`
- **DoD**:
  - Pipeline con jobs `lint`, `typecheck`, `test` (PostgreSQL 16 como servicio), caché de pnpm.
  - El pipeline falla si `pnpm audit --audit-level=high` reporta vulnerabilidades.
  - Job `secrets-scan` que ejecuta `scripts/ci/check-no-secrets.sh` (mismas reglas que `.githooks/pre-commit`).
  - Badge o enlace en README.
  - `TURBO_TELEMETRY_DISABLED=1` en todos los jobs del pipeline.
  - Lint de los ficheros de configuración de la raíz (`eslint.config.js`, etc.) incluido en el pipeline (TD-007).

### TASK-007 · apps/web: esqueleto Next.js + `GET /api/health`
- **Estado**: BLOCKED · **Owner**: web-dev · **Depende de**: TASK-005 · **security REQUIRED**
- **Scope**: `apps/web/**`, `docker/web.Dockerfile`, `compose.yaml`, `Makefile` (estos tres fuera del rol de web-dev: se reparten con devops al planificar; `compose.yaml` para quitar el perfil `web`, OD-G)
- **DoD**:
  - `docker/web.Dockerfile` (multi-stage, `pnpm fetch`, no root, `TURBO_TELEMETRY_DISABLED=1`) y `docker compose up --build` sirve `/api/health` en `127.0.0.1:3000`.
  - App Router, Tailwind, layout base, página `/` con texto "AgentLab" y enlace a `/projects`.
  - `GET /api/health` → `{ ok: true, db: "up", version }`; `{ ok: false, db: "down" }` con 503 si PostgreSQL no responde en 2 s.
  - Handler usa `persistence` vía `@agentlab/persistence`; sin SQL inline.
  - Test del handler con PostgreSQL arriba y abajo.
  - Elimina el placeholder `apps/web/src/index.ts` (TD-009).
  - `next.config.ts` convive con `rootDir: src`: rootDir se mantiene; decidir include/tsconfig aparte (TD-010).

### TASK-008 · apps/worker: bucle de reclamación vacío con heartbeat y apagado limpio
- **Estado**: BLOCKED · **Owner**: engine-dev · **Depende de**: TASK-005
- **Scope**: `apps/worker/**`, `docker/worker.Dockerfile` (fuera del rol de engine-dev: se reparte con devops al planificar)
- **Dependencias autorizadas**: ninguna nueva; usa `tsx` ya declarado por TASK-003 (ADR-009).
- **DoD**:
  - Sustituye el `apps/worker/src/index.ts` provisional de TASK-003; `docker compose stop worker` con el worker real termina en < `SHUTDOWN_GRACE_MS` con código 0.
  - Scripts de `apps/worker`: `dev` = `tsx watch src/index.ts`, `start` = `tsx src/index.ts` (ADR-009).
  - Bucle `claimNext` → ejecuta un `RunExecutor` inyectable (en M0: no-op que marca `completed`) → `finalize`.
  - Heartbeat cada 15 s mientras hay run activo.
  - Con `SIGTERM` bajo `tsx`: el worker deja de reclamar, espera al run en curso hasta `SHUTDOWN_GRACE_MS`, lo deja en estado coherente y sale con código 0. Test en proceso hijo lanzado con `tsx`. Si falla bajo el CLI de `tsx`, fallback autorizado `node --import tsx src/index.ts` (ADR-009), documentado en el informe.
  - Test: crear run `queued` en DB, arrancar worker en proceso hijo, verificar `completed` y heartbeat actualizado.
  - Imagen de runtime del worker solo con los `node_modules` de producción del worker + `tsx`: sin pnpm/corepack ni el monorepo completo; nada de `*.pem`/`*.key` en la imagen (TD-015).
  - El logger del worker oculta (`redact`) `*_API_KEY` y `DATABASE_URL*` desde su introducción, sin esperar a TASK-027 (TD-011, security).
  - Al arrancar, el worker comprueba que existe el esquema `langgraph`; si no, sale con código ≠ 0 y un mensaje claro que indica ejecutar `pnpm db:migrate` (ADR-002). Test del caso de fallo.

### TASK-009 · README con instalación desde cero + cierre de M0
- **Estado**: BLOCKED · **Owner**: docs-keeper · **Depende de**: TASK-001…TASK-008
- **Scope**: `README.md`, `docs/reports/M0-closure.md`, `docs/TASKS.md`, `docs/ROADMAP.md`
- **DoD**:
  - README: requisitos, `cp .env.example .env` y rellenar `POSTGRES_PASSWORD`/`DATABASE_URL`/`DATABASE_URL_TEST` antes de `make up`, `make up`, verificación de `/api/health`, cómo ejecutar tests, estructura del repo, enlace a `docs/`.
  - `docs/reports/M0-closure.md` con el criterio de salida de M0 verificado literalmente (comandos y salida).
  - Humano acepta el cierre.

## M1 — MVP

### TASK-010 · packages/providers: interfaz + adaptador OpenAI-compatible + FakeProvider
- **Estado**: READY · **Owner**: providers-dev · **Depende de**: TASK-004
- **Scope**: `packages/providers/**`
- **DoD**:
  - `OpenAICompatibleProvider({ baseUrl, apiKeyEnv, capabilities, secretResolver })` sobre el SDK de OpenAI; `apiKey` obtenido con el `SecretResolver` de `core` inyectado (`secretResolver(apiKeyEnv)`) en construcción y nunca expuesto en propiedades enumerables ni en `toJSON`. Ningún adaptador lee `process.env` (OD-017: el resolver solo acepta `^[A-Z][A-Z0-9_]*_API_KEY$` declarados en `env.ts`); test que lo comprueba.
  - Si `api_key_env` no resuelve (nombre no permitido o variable vacía/ausente), el adaptador lanza `ProviderAuthError` en la construcción, nunca en la primera llamada; el mensaje cita el nombre, nunca un valor (test).
  - Los errores de los adaptadores nunca incluyen cabeceras (`Authorization`) ni la request del SDK/fetch: test con valor canario que comprueba que no aparece en `message`, `cause`, `stack` ni serialización (security, TASK-004).
  - Timeout por petición vía `AbortSignal`; errores mapeados a las subclases de `core` (401 → `ProviderAuthError`, 429 → `ProviderRateLimitError` con `retryAfterMs`, timeout → `ProviderTimeoutError`).
  - `usage` devuelto tal cual; `null` si el proveedor no lo informa.
  - `FakeProvider` determinista: responde según un guion por rol, permite simular 429, timeout y salida inválida. Vive en `packages/providers/src/testing/` y se exporta desde `@agentlab/providers/testing`.
  - Tests unitarios con servidor HTTP falso (msw o `undici` mock).

### TASK-011 · packages/policies: BudgetGuard, ToolAuthorizer, ApprovalPolicy
- **Estado**: BLOCKED · **Owner**: core-dev · **Depende de**: TASK-004, OD-002
- **Scope**: `packages/policies/**`
- **DoD**:
  - `BudgetGuard.reserve/commit/snapshot` como `ARCHITECTURE.md §3.3`; `reserve` lanza `BudgetExceededError` con el límite concreto que se superó.
  - Límites de concurrencia como semáforo reutilizable (`acquire/release`) probado con promesas concurrentes.
  - `ToolAuthorizer.check(agentDef, toolName, sensitivity)` → `allowed | denied(reason) | needs_approval`.
  - Ningún método permite elevar un límite una vez creado el guard (propiedades `readonly`, test que lo intenta).
  - Cobertura ≥ 90 %.

### TASK-012 · packages/agents: roles, prompts versionados y outputSchemas (Manager, Researcher, Analyst, Critic)
- **Estado**: READY · **Owner**: engine-dev · **Depende de**: TASK-004
- **Scope**: `packages/agents/**`
- **DoD**:
  - Un archivo por rol con `systemPrompt`, `promptVersion` (`1.0.0`), `outputSchema` (Zod) y `defaultLimits`.
  - Prompts en inglés (idioma de trabajo de los modelos); documentado en `agents/README.md`. Los prompts exigen salida JSON acorde al schema y prohíben seguir instrucciones halladas en datos.
  - `teams/research.ts` con `TeamDefinition` de ejemplo (Manager, Researcher, Analyst, Critic).
  - Test: cada `outputSchema` acepta el ejemplo canónico y rechaza tres variantes incorrectas.

### TASK-013 · packages/orchestrator: grafo `research` con LangGraph.js (sin checkpointer persistente)
- **Estado**: BLOCKED · **Owner**: engine-dev · **Depende de**: TASK-010, TASK-011, TASK-012 · **security REQUIRED**
- **Scope**: `packages/orchestrator/**` (las viñetas de LangSmith en `.env.example` y `packages/core/src/env.ts` necesitan ampliar scope o repartirse con devops/core-dev al planificar)
- **DoD**:
  - Nodos `gate.budget`, `agent.invoke`, `fanout.tasks`, `review`, `decide.review`, `persist.result` como `ARCHITECTURE.md §4`; `approval.wait` llega en M4.
  - `buildResearchGraph(deps)` recibe `providerRegistry`, `budgetGuard`, `eventEmitter`, `repositories` por inyección; cero singletons.
  - Checkpointer `MemorySaver` en M1 (ADR-002 lo documenta); se sustituye en M3.
  - Cada nodo comprueba `cancelRequested` al entrar y emite el evento correspondiente.
  - Revisión `fail` dos veces → `partial` con `result.partialReason`.
  - Tests con `FakeProvider`: camino feliz, `partial` por iteraciones, `partial` por presupuesto, `failed` por error no recuperable, cancelación entre nodos.
  - Trazado de LangSmith desactivado explícitamente: `LANGCHAIN_TRACING_V2=false` y sin `LANGCHAIN_API_KEY` en `.env.example` (la validación en `core/env.ts` con valor por defecto `"false"` ya la hace TASK-004); test de que ninguna llamada sale hacia LangSmith con `FakeProvider`.

### TASK-014 · API: `POST /api/runs`, `GET /api/runs/:id`, `GET /api/runs/:id/result`
- **Estado**: BLOCKED · **Owner**: web-dev · **Depende de**: TASK-007, TASK-011
- **Scope**: `apps/web/app/api/runs/**`, `apps/web/lib/api/**`
- **DoD**:
  - Validación Zod del cuerpo (`RunRequestSchema`); 400 con detalle de campos.
  - `POST` crea run `queued` con el presupuesto del proyecto y devuelve `201 { id }` en < 100 ms (no espera al worker).
  - `GET /:id` incluye `status`, `budget`, `budgetUsed`, `steps[]` (derivados de `agent_invocations`), `finishedReason`.
  - `GET /:id/result` → 404 si no existe, 409 si no es terminal, 200 con `result` y `status`.
  - Tests de handler contra PostgreSQL.

### TASK-015 · Worker ejecuta el grafo `research`
- **Estado**: BLOCKED · **Owner**: engine-dev · **Depende de**: TASK-008, TASK-013
- **Scope**: `apps/worker/**`
- **DoD**:
  - `RunExecutor` real que construye dependencias desde `provider_configs` del proyecto y ejecuta `buildResearchGraph`.
  - Eventos del grafo → `EventsRepository.append`.
  - Error no capturado en el grafo → run `failed` con `error.code`, nunca worker caído.
  - Test de integración: run con `FakeProvider` configurado por env (`AGENTLAB_PROVIDER=fake`) termina `completed` con eventos en orden.

### TASK-016 · UI: pantalla `/runs/:id` y formulario de nueva ejecución
- **Estado**: BLOCKED · **Owner**: web-dev · **Depende de**: TASK-014, TASK-015
- **Scope**: `apps/web/app/(app)/**`, `apps/web/components/**`
- **DoD**:
  - `/projects/:id/runs/new`: textarea de petición, selector de equipo, botón "Ejecutar" → redirige a `/runs/:id`.
  - `/runs/:id`: timeline de pasos (agente, estado, duración, tokens o "no informado"), barra de presupuesto, estado del run y motivo de finalización, resultado renderizado (Markdown) o parcial con aviso.
  - Polling cada 2 s mientras el run no sea terminal (`TD-001` registra la sustitución por SSE en M3).
  - Sin librerías de estado global.

### TASK-017 · Tests end-to-end del MVP con FakeProvider + cierre de M1
- **Estado**: BLOCKED · **Owner**: tester · **Depende de**: TASK-016
- **Scope**: `tests/integration/**`, `docs/reports/M1-closure.md`
- **DoD**:
  - Test que levanta web + worker en proceso, crea un run por API, espera `completed` y comprueba resultado, eventos y presupuesto.
  - Mismo test con `FakeProvider` forzando `partial` y `failed`.
  - Ejecución manual documentada con Ollama o modelo gratuito de OpenRouter (captura de la pantalla en el informe).
  - Humano acepta el cierre.

## M2 — Modelos

### TASK-018 · Adaptador Gemini (SDK Google GenAI)
- **Estado**: BLOCKED · **Owner**: providers-dev · **Depende de**: TASK-010 · **Scope**: `packages/providers/src/gemini/**`
- **DoD**: misma superficie que OpenAI-compatible; capacidades declaradas reales; mapeo de errores; tests con mock del SDK.

### TASK-019 · ProviderRegistry, comprobación de capacidades y reintentos con backoff
- **Estado**: BLOCKED · **Owner**: providers-dev · **Depende de**: TASK-018 · **Scope**: `packages/providers/**`
- **DoD**: `ProviderCapabilityError` antes de red; backoff exponencial + jitter solo para `retryable`; respeta `retryAfterMs`; máximo de reintentos configurable y descontado del presupuesto de llamadas.

### TASK-020 · `GET /api/providers` y selección por agente desde `provider_configs`
- **Estado**: BLOCKED · **Owner**: web-dev · **Depende de**: TASK-019 · **Scope**: `apps/web/app/api/providers/**`, `apps/web/app/(app)/projects/**`
- **DoD**: lista proveedores con capacidades y modelos; test que verifica que ninguna respuesta contiene el valor de ninguna variable `*_API_KEY`; salida del worker restringida (sin RFC1918 ni metadatos cloud) junto con la allowlist de host (TD-018).

### TASK-021 · Perfil `local`: modelo Ollama por defecto (OD-005) y `docs/PROVIDERS.md`
- **Estado**: BLOCKED · **Owner**: devops · **Depende de**: TASK-019, OD-005 · **Scope**: `compose.yaml`, `docker/ollama/**`, `docs/PROVIDERS.md`
- **DoD**: `make up-local` descarga el modelo y lo deja listo; guía de cuotas de OpenRouter/Gemini con fecha de consulta.

### TASK-022 · Tests de contrato multi-proveedor + cierre de M2
- **Estado**: BLOCKED · **Owner**: tester · **Depende de**: TASK-020, TASK-021 · **Scope**: `tests/integration/providers/**`, `docs/reports/M2-closure.md`
- **DoD**: suite parametrizada fake/OpenRouter/Ollama/Gemini; se salta con aviso si faltan credenciales; criterio de salida M2 verificado.

## M3 — Control

### TASK-023 · Checkpointer PostgreSQL + `run_checkpoints`
- **Estado**: BLOCKED · **Owner**: persistence-dev · **Depende de**: TASK-013, TASK-002 · **Scope**: `packages/persistence/src/checkpointer/**`, `packages/orchestrator/src/graph/*.ts`
- **DoD**: `thread_id = runId`; relación en `run_checkpoints`; test de reanudación desde checkpoint intermedio; test de que `setup()` es idempotente (dos ejecuciones seguidas) y `put`/`getTuple` contra PostgreSQL 16 en el esquema `langgraph`; con `SIGTERM`, el run en curso guarda checkpoint antes de que el worker salga (ADR-009).

### TASK-024 · `LISTEN/NOTIFY` + SSE real con `Last-Event-ID`
- **Estado**: BLOCKED · **Owner**: web-dev · **Depende de**: TASK-023 · **Scope**: `packages/persistence/src/notify/**`, `apps/web/app/api/runs/[id]/events/**`, `apps/web/components/run-timeline/**`
- **DoD**: evento persistido antes de notificar; reconexión recupera huecos; ping cada 15 s; cierre en terminal; retira el polling (cierra TD-001).

### TASK-025 · Cancelación cooperativa y `POST /resume`
- **Estado**: BLOCKED · **Owner**: engine-dev · **Depende de**: TASK-023 · **Scope**: `packages/orchestrator/**`, `apps/web/app/api/runs/[id]/cancel/**`, `apps/web/app/api/runs/[id]/resume/**`
- **DoD**: `AbortSignal` llega a proveedor y herramientas; 409 en transiciones inválidas; `resume` desde último checkpoint sin repetir pasos.

### TASK-026 · Recuperación de runs huérfanos por heartbeat
- **Estado**: BLOCKED · **Owner**: engine-dev · **Depende de**: TASK-025 · **Scope**: `apps/worker/**`, `packages/persistence/src/repositories/runs*.ts`
- **DoD**: test que mata el worker (SIGKILL) a mitad de run y comprueba reanudación con `seq` continuo y sin invocaciones duplicadas.

### TASK-027 · packages/observability: eventos, spans OTel, métricas, `redactSecrets`
- **Estado**: BLOCKED · **Owner**: core-dev · **Depende de**: TASK-023 · **Scope**: `packages/observability/**`, `packages/persistence/src/redaction/**`, `compose.yaml` (perfil `observability`)
- **DoD**: span por run/agente/herramienta; exportador OTLP opcional; `redactSecrets` + test de fuga; prompts persistidos solo tras redacción.

### TASK-028 · UI: métricas por run y comparación de dos runs
- **Estado**: BLOCKED · **Owner**: web-dev · **Depende de**: TASK-027 · **Scope**: `apps/web/app/(app)/runs/**`, `apps/web/components/**`
- **DoD**: `/runs/:id/compare/:otherId` muestra pasos alineados, duración, tokens, resultado de revisión.

### TASK-029 · Cierre de M3
- **Estado**: BLOCKED · **Owner**: tester · **Depende de**: TASK-024…TASK-028 · **Scope**: `tests/integration/**`, `docs/reports/M3-closure.md`
- **DoD**: criterio de salida M3 verificado literalmente.

## M4 — Extensión

### TASK-030 · packages/tools: ToolRegistry, `artifact.read/write`, envoltura de resultados no confiables
- **Estado**: BLOCKED · **Owner**: engine-dev · **Depende de**: TASK-011, OD-006 · **Scope**: `packages/tools/**`, `packages/orchestrator/src/nodes/agent-invoke.ts`
- **DoD**: validación Zod de entrada y salida; resultado envuelto con `trust="untrusted"`; `tool_invocations` persistidas.

### TASK-031 · `web.search` y `source.read` con allowlist HTTP y bloqueo SSRF
- **Estado**: BLOCKED · **Owner**: engine-dev · **Depende de**: TASK-030 · **Scope**: `packages/tools/src/web/**`
- **DoD**: bloqueo de `localhost`, RFC1918, link-local, metadatos cloud; resolución DNS comprobada antes de conectar; tests de SSRF; **security REQUIRED**.

### TASK-032 · Aprobación humana: `approval.wait` + `awaiting_approval`
- **Estado**: BLOCKED · **Owner**: engine-dev · **Depende de**: TASK-025, TASK-030 · **Scope**: `packages/orchestrator/**`, `packages/policies/**`, `apps/web/app/(app)/runs/**`
- **DoD**: herramienta `sensitivity: approval` interrumpe el grafo; UI muestra la solicitud y botones aprobar/rechazar; test de que el modelo no puede autoaprobar; **security REQUIRED**.

### TASK-033 · Validación de salidas estructuradas con reintento guiado
- **Estado**: BLOCKED · **Owner**: engine-dev · **Depende de**: TASK-030 · **Scope**: `packages/orchestrator/src/nodes/agent-invoke.ts`, `packages/agents/**`
- **DoD**: `invalid_output` → una repetición con el error de validación en el prompt; segunda falla → `agent.failed`; descuenta llamadas.

### TASK-034 · Editor de equipos y agentes en la UI + builder de grafo genérico
- **Estado**: BLOCKED · **Owner**: web-dev · **Depende de**: TASK-033 · **Scope**: `apps/web/app/(app)/projects/**`, `apps/web/app/api/agents/**`, `apps/web/app/api/teams/**`, `packages/orchestrator/src/graph/generic.ts`
- **DoD**: crear/editar agentes y equipos sin tocar código; `coordination jsonb` validado; ejecutar hasta `completed`.

### TASK-035 · `examples/research-team` y `examples/analysis-team` + cierre de M4
- **Estado**: BLOCKED · **Owner**: docs-keeper · **Depende de**: TASK-034 · **Scope**: `examples/**`, `docs/reports/M4-closure.md`
- **DoD**: ejemplos reproducibles con Ollama; criterio de salida M4 verificado.

## M5 — Calidad

### TASK-036 · packages/evaluations: dataset, evaluadores, `pnpm bench`
- **Estado**: BLOCKED · **Owner**: engine-dev · **Depende de**: TASK-035 · **Scope**: `packages/evaluations/**`, `datasets/**`
- **DoD**: ≥ 10 tareas con criterios objetivos; evaluador escribe en `evaluations`; `pnpm bench --provider X` reproducible.

### TASK-037 · Pruebas de seguridad (inyección, SSRF, fugas, escalada de presupuesto)
- **Estado**: BLOCKED · **Owner**: security · **Depende de**: TASK-036 · **Scope**: `tests/security/**`, `docs/security/**`
- **DoD**: suite automatizada de los cuatro vectores; `SECURITY_POLICY.md` completa; usuario de aplicación sin DDL (TD-013; esta tarea no se retrasa ni va después de ningún despliegue fuera de localhost: TD-013 lo exige); `db` sin salida a internet también con el override de desarrollo (TD-016); **security REQUIRED**.

### TASK-038 · Licencia (ADR-008), NOTICE y revisión de dependencias
- **Estado**: BLOCKED · **Owner**: docs-keeper · **Depende de**: TASK-037 · **Scope**: `LICENSE`, `NOTICE`, `docs/adr/ADR-008-*.md`, `docs/THIRD_PARTY.md`
- **DoD**: `pnpm licenses list` revisado; ADR-008 `Accepted` solo tras aprobación humana.

### TASK-039 · OD-003 (auth de API) + instalación limpia verificada + cierre de M5
- **Estado**: BLOCKED · **Owner**: devops · **Depende de**: TASK-038, OD-003 · **Scope**: `README.md`, `docs/reports/M5-closure.md`, `apps/web/middleware.ts` (si OD-003 lo exige)
- **DoD**: instalación en máquina ajena siguiendo solo el README; criterio de salida M5 verificado; humano acepta.

---

## Transversal

### TASK-040 · ADR de herramientas: TypeScript 6/7 y pnpm con mantenimiento
- **Estado**: BLOCKED · **Owner**: architect · **Depende de**: TASK-009
- **Scope**: `docs/adr/**`, `docs/ARCHITECTURE.md` (§9), `docs/reports/TASK-040-plan.md`
- **DoD**:
  - ADR `Proposed` que evalúa subir TypeScript a 6/7 (cuando typescript-eslint lo soporte) y pnpm a una versión mantenida, con compatibilidad verificada y plan de migración; paga TD-006. `packageManager` y el pnpm de los Dockerfiles/Makefile fijados con hash (`pnpm@<v>+sha512.…`); `node_modules` de validación sin volumen persistente o verificado entre ejecuciones (TD-017).
  - `Accepted` solo tras aprobación humana.

---

## Registro de cambios de este documento

| Fecha | Cambio |
|---|---|
| 2026-10-20 | Creación con 39 tareas (M0–M5). READY: TASK-001, TASK-002. |
| 2026-10-20 | TASK-001 (decisión humana): scope ampliado con `tsconfig.json` y `src/index.ts` por workspace y `pnpm-lock.yaml`; `.eslintrc.cjs` → `eslint.config.js` (ESLint 9 flat); deps autorizadas fijadas. Autorizadas TASK-001 y TASK-002 en paralelo (scopes disjuntos). |
| 2026-10-20 | Planes TASK-001 y TASK-002 aprobados. Decisiones humanas: TS 5.9.3 + `@types/node` 22; ESLint última major estable (10.13.0); `.npmrc` `engine-strict` + `engines` en TASK-001; `pg` driver único; checkpointer en esquema `langgraph`; ADR-002 → Accepted; telemetría de turbo desactivada (DoD de TASK-003 y TASK-006). OD-007 (TS en runtime) bloquea TASK-003 y TASK-008. TASK-002 → IN_PROGRESS. |
| 2026-10-20 | TASK-002: tester PASS; reviewer CHANGES_REQUESTED (2 MAJOR fuera de scope). Ciclo de corrección 1/3. Scope ampliado por decisión humana: ADR-000 (índice), SPEC §3, ARCHITECTURE §4 y §6. |
| 2026-10-20 | Obligaciones de ADR-002 (decisión humana): TASK-004 rango de zod; TASK-005 `schemaFilter` y `setup()` en `db:migrate`; TASK-008 comprobación del esquema `langgraph` al arrancar; TASK-023 `setup()` idempotente. security REQUIRED en TASK-005, TASK-007, TASK-013. TASK-013: trazado de LangSmith desactivado. |
| 2026-10-20 | TASK-002: tester PASS (ciclo 1) y reviewer APPROVED (ciclo 1); security no aplica (solo docs). Pendiente `/close-task`. TASK-001 → IN_PROGRESS (owner devops). |
| 2026-10-20 | TASK-001: IMPLEMENTATION recibido; ciclo de corrección 1/3 (`.pnpm-store/` creado en el repo por la validación en Docker). `/close-task TASK-002` en paralelo (decisión humana). |
| 2026-10-20 | TASK-002 → DONE (tester PASS, reviewer APPROVED; ciclo de corrección 1). Informe en docs/reports/TASK-002.md. |
| 2026-10-20 | TASK-002 commit 48eee1f |
| 2026-10-20 | TASK-001: tester PASS (ciclo 0); reviewer CHANGES_REQUESTED (1 MAJOR: imports relativos entre paquetes) → corrección 2/3 (`rootDir: src`, `globalDependencies`); tester PASS y reviewer APPROVED (ciclo 2); security no aplica. TASK-001 → REVIEW. |
| 2026-10-20 | TASK-001 → DONE (tester PASS, reviewer APPROVED; ciclos de corrección 2). Informe en docs/reports/TASK-001.md. TASK-004 → READY. TASK-040 creada. Deuda TD-006…TD-010. |
| 2026-10-20 | TASK-001 commit 4a12555 |
| 2026-10-20 | OD-007 decidida por el humano: tsx (ADR-009 Proposed). TASK-003 → READY (scope pendiente: apps/worker/package.json, pnpm-lock.yaml); TASK-008 sin OD-007 (sigue BLOCKED por TASK-005). `tsx` 4.23.15 en deps autorizadas de ambas. |
| 2026-10-20 | ADR-009 Accepted (decisión humana) con fallback `node --import tsx`. TASK-003: scope + `apps/worker/package.json`, `pnpm-lock.yaml`; declara `tsx`; DoD de apagado limpio del contenedor. TASK-008: usa `tsx` (no lo declara); DoD de SIGTERM corregido. TASK-023: checkpoint antes de salir con SIGTERM. |
| 2026-10-20 | TASK-004: plan aprobado; OD-009…OD-017 resueltas por el humano (15 eventos, UUID, sin opcionales sobrantes, env con LANGCHAIN_TRACING_V2, SecretResolver). Deps y ampliación de scope (paso 0 devops, engines `>=22.12 <23`) aprobadas. TASK-010 usa SecretResolver. Nota: `docs/reports/TASK-004-plan.md` entró en el commit 67712cd (Task: none). |
| 2026-10-20 | OD-017 precisada (decisión humana): SecretResolver por allowlist — `^[A-Z][A-Z0-9_]*_API_KEY$` y declarado en `env.ts`; descartadas cualquier nombre (a) y lista negra (b). DoD de TASK-004 y TASK-010 actualizados; comunicado a core-dev en curso. |
| 2026-10-20 | TASK-004: IMPLEMENTATION recibido (devops paso 0 + core-dev) → REVIEW; security REQUIRED por decisión humana. TASK-010: `ProviderAuthError` en construcción si `api_key_env` no resuelve (decisión humana). |
| 2026-10-20 | TASK-004: tester PASS (12/12); reviewer CHANGES_REQUESTED (1 MAJOR: falta test de inventario de la allowlist del SecretResolver) → ciclo de corrección 1/3 (MAJOR + MINOR de validación de URLs). |
| 2026-10-20 | TASK-004 (ciclo 1): tester PASS (156 tests, 100 %, mutación del inventario OK); reviewer APPROVED; security APPROVED (4 LOW). Pendiente: OD sobre defaults de `.env.example` y aprobación de deuda antes de `/close-task`. |
| 2026-10-20 | TASK-004 → DONE (tester PASS, reviewer APPROVED, security APPROVED; 1 ciclo de corrección). Informe en docs/reports/TASK-004.md. TASK-010 y TASK-012 → READY. Deuda TD-011, TD-012. OD-018 resuelta. |
| 2026-10-20 | Regla pendiente para .claude/skills/monorepo-conventions/SKILL.md (TD-011): el objeto de loadEnv() no se pasa entero a ningún logger ni se serializa; se leen campos sueltos. No aplicada: role-guard impide a docs-keeper editar .claude/skills/**; la añade el humano. |
| 2026-10-20 | TASK-004 commit 2a360ff |
| 2026-10-20 | Pendiente para docs-keeper en el próximo cierre (decisiones humanas): (1) DEVELOPMENT_WORKFLOW §3: "una tarea a la vez por defecto; si el humano autoriza dos, el scope es la unión" (debió entrar en el cierre de TASK-004); (2) AGENTS.md §3: docs-keeper puede editar `.claude/skills/**` (role-guard actualizado, commit 69a90a8). Regla de TD-011 ya añadida a monorepo-conventions por el humano. |
| 2026-10-20 | TASK-003: plan aprobado con decisiones humanas OD-A…OD-F (web.Dockerfile y "/api/health en 3000" → TASK-007; worker provisional en `apps/worker/src/index.ts`; credenciales solo en `.env`; `127.0.0.1:3000`; `init: true`; `make test` en contenedor; `compose.override.yaml` ignorado; `make validate` sin tocar `node_modules` del host). TASK-005 recibe `turbo.json`, `Makefile`, `compose.yaml` (servicio `migrate`). TASK-008: apagado del worker real. TASK-009: `cp .env.example .env`. Deuda TD-013 (superusuario → TASK-037), TD-014 (ollama root → TASK-021). |
| 2026-10-20 | TASK-003: IMPLEMENTATION recibido; tester PASS (17/17 + override ⚠️ manual); reviewer CHANGES_REQUESTED (1 MAJOR: `DATABASE_URL_TEST` no es obligatoria en compose — ningún servicio la usa; pendiente de decisión humana). → IN_PROGRESS, ciclo de corrección 1/3 en espera. |
| 2026-10-20 | TASK-003: decisiones humanas tras REVIEW — `DATABASE_URL_TEST` sale del DoD de TASK-003 y pasa a TASK-005; OD-G aprobada (`compose.yaml` y `Makefile` en scope de TASK-007); deuda LOW aprobada (imagen runtime → TASK-008; egress de `db` con override → TASK-037). Ciclo de corrección 1/3 lanzado (devops). |
| 2026-10-20 | TASK-003 ciclo 1/3: devops IMPLEMENTATION; tester PASS; reviewer CHANGES_REQUESTED (1 MAJOR: falta el aviso de egress de `db` en `compose.override.example.yaml` — el fichero no se modificó pese a lo que decían los informes de devops y tester; verificado por el Orchestrator). Security en curso. |
| 2026-10-20 | TASK-003: security APPROVED (1 MEDIUM: `Makefile:10` monta el repo `:ro` y expone `.env` del host al contenedor de validación; 4 LOW). Pendiente de decisión humana sobre el MEDIUM antes del ciclo de corrección 2/3. |
| 2026-10-20 | TASK-003: decisiones humanas sobre SECURITY — MEDIUM se corrige ya (copia por stdin, sin montar el repo) + `--cap-drop ALL --security-opt no-new-privileges`; LOW → TD-017 (TASK-040), TD-015 ampliada (TASK-008), TD-018 (TASK-020); notas en DoD de TASK-005/008/037. Regla nueva: un hallazgo solo se cierra con cita literal del fichero corregido. Ciclo de corrección 2/3 lanzado (devops). |
| 2026-10-20 | TASK-003 ciclo 2/3: devops IMPLEMENTATION (citas verificadas por el Orchestrator); tester PASS; reviewer APPROVED (1 MINOR: recetas con tubería sin `pipefail`); security APPROVED (3 LOW: más patrones `.env`, ficheros locales de `.claude/`, volumen node_modules persistente). Pendiente de decisión humana: ciclo 3/3 o deuda. |
| 2026-10-20 | TASK-003: decisión humana — ciclo 3/3 (último) solo sobre `Makefile`: `pipefail`, comillas en `-C`, seis patrones de exclusión; volumen persistente de node_modules → TD-017 (TASK-040). Fechas 2026-10-21 corregidas a 2026-10-20 en TASKS.md y TECHNICAL_DEBT.md. Si queda algún hallazgo, no hay ciclo 4: decide el humano. |
| 2026-10-20 | TASK-003 ciclo 3/3: tester FAIL (T1: con fichero ilegible `make test`/`validate` salen 0 — GNU Make 3.81 de macOS ignora `.SHELLFLAGS`); reviewer APPROVED (MINOR abierto, mismo punto); security APPROVED (MEDIUM abierto, mismo punto). Exclusiones y comillas verificadas. Ciclos agotados → decisión humana. |
| 2026-10-20 | TASK-003: decisión humana (a) — corrección de una línea fuera de ciclo: `set -o pipefail;` en las recetas de `make test`/`make validate`, fuera `.SHELLFLAGS`, comentario sobre make 3.81. Verificación acotada a ese diff. |
| 2026-10-20 | TASK-003: corrección fuera de ciclo verificada — tester PASS (fichero ilegible → exit 2 en `test` y `validate`; repo real exit 0); reviewer APPROVED (1 NIT sin acción: `help` con tubería sin pipefail); security APPROVED. → REVIEW, lista para `/close-task`. |
| 2026-10-20 | TASK-003 → DONE (tester PASS, reviewer APPROVED, security APPROVED; ciclos 1, 2 y 3 más una corrección fuera de ciclo autorizada por el humano). Informe en docs/reports/TASK-003.md. TASK-005 → READY (depende de TASK-003 y TASK-004, ambas DONE). TD-008 PAID. Reglas añadidas: DEVELOPMENT_WORKFLOW §3 regla 1, AGENTS.md §3 (docs-keeper edita `.claude/skills/**`) y testing-conventions regla 10. |
