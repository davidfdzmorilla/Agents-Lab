# AgentLab — Tareas

| Campo | Valor |
|---|---|
| Última actualización | 2026-10-20 (cierre TASK-001) |
| Hito actual | M0 |
| Tareas READY | TASK-003, TASK-004 |

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
- **Estado**: READY · **Owner**: devops · **Depende de**: TASK-001, OD-007 (decidida: ADR-009)
- **Scope**: `compose.yaml`, `compose.override.example.yaml`, `docker/web.Dockerfile`, `docker/worker.Dockerfile`, `docker/postgres/init.sql`, `.env.example`, `.dockerignore`, `Makefile`, `apps/worker/package.json`, `pnpm-lock.yaml`
- **Dependencias autorizadas**: `tsx` 4.23.15 exacta, declarada en `dependencies` de `apps/worker/package.json` por esta tarea (ADR-009).
- **DoD**:
  - `docker compose up --build` levanta `db`, `web`, `worker`; `db` solo en red interna; `web` en `3000`.
  - `docker compose --profile local up` añade `ollama` sin puerto en host.
  - Dockerfiles multi-stage con `pnpm fetch` cacheado; usuario no root.
  - `init.sql` crea bases `agentlab` y `agentlab_test`.
  - `.env.example` sin ningún valor secreto; todas las variables documentadas en una línea.
  - `make up`, `make down`, `make logs`, `make test` funcionan.
  - `TURBO_TELEMETRY_DISABLED=1` en `Makefile` y en ambos Dockerfiles.
  - Target `make validate` con el comando de validación en Docker `node:22` y store de pnpm en volumen con nombre (TD-008).
  - `tsx` 4.23.15 declarado en `dependencies` de `apps/worker`; `docker/worker.Dockerfile` ejecuta `tsx src/index.ts` (ADR-009).
  - Apagado limpio: `docker compose stop worker` hace que el contenedor termine en < `SHUTDOWN_GRACE_MS` con código 0 (`stop_grace_period` > `SHUTDOWN_GRACE_MS`).

### TASK-004 · packages/core: esquemas Zod, errores tipados, env
- **Estado**: READY · **Owner**: core-dev · **Depende de**: TASK-001
- **Scope**: `packages/core/**`
- **DoD**:
  - Esquemas: `AgentDefinitionSchema`, `TeamDefinitionSchema`, `RunRequestSchema`, `RunEventSchema` (discriminated union con los 13 tipos de SPEC §8), `BudgetSchema`, `AgentInvocationResultSchema`, `ProviderCapabilitiesSchema`.
  - Interfaces `ModelProvider`, `Tool`, `GenerateRequest/Response` exactamente como `ARCHITECTURE.md §3`.
  - `AgentLabError` base con `code`, `retryable`, `cause`; subclases de proveedor y presupuesto.
  - `env.ts` con esquema Zod; `loadEnv()` falla con mensaje claro si falta una variable.
  - Estados de run y transiciones válidas como función pura `canTransition(from, to)` con test exhaustivo (tabla de `ARCHITECTURE.md §5`).
  - Cobertura de tests ≥ 90 % en `core`.
  - Cero dependencias de runtime salvo `zod`.
  - Versión exacta de `zod` compatible con los rangos de `@langchain/langgraph` 1.5.1 (`^3.25.32 || ^4.2.0`) y `@langchain/core` 1.2.18 (`^3.25.76 || ^4`), fijada sin `^` (ADR-002).
  - `vitest.config.ts` y tests fuera de `src/` conviven con `rootDir: src`: rootDir se mantiene; decidir include/tsconfig aparte (TD-010).

### TASK-005 · packages/persistence: Drizzle, migración inicial, repositorios base
- **Estado**: BLOCKED · **Owner**: persistence-dev · **Depende de**: TASK-003, TASK-004 · **security REQUIRED**
- **Scope**: `packages/persistence/**`, `drizzle.config.ts`
- **DoD**:
  - `drizzle.config.ts` con `schemaFilter: ["public"]`: Drizzle nunca genera ni aplica cambios sobre el esquema `langgraph` (ADR-002).
  - `pnpm db:migrate` aplica las migraciones de Drizzle y, como paso explícito, ejecuta `setup()` del checkpointer de LangGraph sobre el esquema `langgraph` (ADR-002).
  - Esquema Drizzle con las 11 tablas de `ARCHITECTURE.md §6`, columnas obligatorias, índices y `unique(run_id, seq)`.
  - Migración `0000_init.sql` generada y aplicable con `pnpm db:migrate`; `pnpm db:reset` recrea `agentlab_test`.
  - `RunsRepository` (`create`, `get`, `claimNext` con `SKIP LOCKED`, `transition` que respeta `canTransition`, `heartbeat`), `EventsRepository` (`append` con `seq` atómico, `listSince(runId, seq)`), `ProjectsRepository`, `AgentDefinitionsRepository`.
  - `transition` a un estado inválido lanza `InvalidTransitionError` (409 en API).
  - Tests de integración contra PostgreSQL real; `claimNext` probado con dos llamadas concurrentes que no reclaman el mismo run.
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
- **Scope**: `apps/web/**`
- **DoD**:
  - App Router, Tailwind, layout base, página `/` con texto "AgentLab" y enlace a `/projects`.
  - `GET /api/health` → `{ ok: true, db: "up", version }`; `{ ok: false, db: "down" }` con 503 si PostgreSQL no responde en 2 s.
  - Handler usa `persistence` vía `@agentlab/persistence`; sin SQL inline.
  - Test del handler con PostgreSQL arriba y abajo.
  - Elimina el placeholder `apps/web/src/index.ts` (TD-009).
  - `next.config.ts` convive con `rootDir: src`: rootDir se mantiene; decidir include/tsconfig aparte (TD-010).

### TASK-008 · apps/worker: bucle de reclamación vacío con heartbeat y apagado limpio
- **Estado**: BLOCKED · **Owner**: engine-dev · **Depende de**: TASK-005
- **Scope**: `apps/worker/**`
- **Dependencias autorizadas**: ninguna nueva; usa `tsx` ya declarado por TASK-003 (ADR-009).
- **DoD**:
  - Scripts de `apps/worker`: `dev` = `tsx watch src/index.ts`, `start` = `tsx src/index.ts` (ADR-009).
  - Bucle `claimNext` → ejecuta un `RunExecutor` inyectable (en M0: no-op que marca `completed`) → `finalize`.
  - Heartbeat cada 15 s mientras hay run activo.
  - Con `SIGTERM` bajo `tsx`: el worker deja de reclamar, espera al run en curso hasta `SHUTDOWN_GRACE_MS`, lo deja en estado coherente y sale con código 0. Test en proceso hijo lanzado con `tsx`. Si falla bajo el CLI de `tsx`, fallback autorizado `node --import tsx src/index.ts` (ADR-009), documentado en el informe.
  - Test: crear run `queued` en DB, arrancar worker en proceso hijo, verificar `completed` y heartbeat actualizado.
  - Al arrancar, el worker comprueba que existe el esquema `langgraph`; si no, sale con código ≠ 0 y un mensaje claro que indica ejecutar `pnpm db:migrate` (ADR-002). Test del caso de fallo.

### TASK-009 · README con instalación desde cero + cierre de M0
- **Estado**: BLOCKED · **Owner**: docs-keeper · **Depende de**: TASK-001…TASK-008
- **Scope**: `README.md`, `docs/reports/M0-closure.md`, `docs/TASKS.md`, `docs/ROADMAP.md`
- **DoD**:
  - README: requisitos, `make up`, verificación de `/api/health`, cómo ejecutar tests, estructura del repo, enlace a `docs/`.
  - `docs/reports/M0-closure.md` con el criterio de salida de M0 verificado literalmente (comandos y salida).
  - Humano acepta el cierre.

## M1 — MVP

### TASK-010 · packages/providers: interfaz + adaptador OpenAI-compatible + FakeProvider
- **Estado**: BLOCKED · **Owner**: providers-dev · **Depende de**: TASK-004
- **Scope**: `packages/providers/**`
- **DoD**:
  - `OpenAICompatibleProvider({ baseUrl, apiKeyEnv, capabilities })` sobre el SDK de OpenAI; `apiKey` leído de `process.env[apiKeyEnv]` en construcción y nunca expuesto en propiedades enumerables ni en `toJSON`.
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
- **Estado**: BLOCKED · **Owner**: engine-dev · **Depende de**: TASK-004
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
  - Trazado de LangSmith desactivado explícitamente: `LANGCHAIN_TRACING_V2=false` y sin `LANGCHAIN_API_KEY` en `.env.example`, validado en `core/env.ts`; test de que ninguna llamada sale hacia LangSmith con `FakeProvider`.

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
- **DoD**: lista proveedores con capacidades y modelos; test que verifica que ninguna respuesta contiene el valor de ninguna variable `*_API_KEY`.

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
- **DoD**: suite automatizada de los cuatro vectores; `SECURITY_POLICY.md` completa; **security REQUIRED**.

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
  - ADR `Proposed` que evalúa subir TypeScript a 6/7 (cuando typescript-eslint lo soporte) y pnpm a una versión mantenida, con compatibilidad verificada y plan de migración; paga TD-006.
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
