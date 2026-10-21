# AgentLab — Arquitectura

| Campo | Valor |
|---|---|
| Versión | 1.0 (2026-10-20) |
| Jerarquía | ADR aceptado > TECHNICAL_SPEC > **ARCHITECTURE** > AGENTS + WORKFLOW > ROADMAP > TASKS |

Este documento describe **cómo está construido** AgentLab. `TECHNICAL_SPEC.md` dice qué debe hacer; aquí se fija dónde vive cada responsabilidad, qué contratos se cruzan y qué está prohibido. Si el código contradice este documento, el código está mal (o hace falta un ADR).

## 1. Vista de procesos

Tres procesos en Docker Compose + dos opcionales + dos de un solo uso (`migrate`, `test`):

| Servicio | Imagen / base | Puerto expuesto | Responsabilidad |
|---|---|---|---|
| `web` | Node 22 (stage `runtime` de `docker/web.Dockerfile`, Next.js `output: "standalone"`, ADR-012) | `127.0.0.1:3000` (host) | UI + API HTTP/SSE. Crea runs, lee estado, emite eventos. **Nunca** ejecuta agentes. CMD `["node", "apps/web/server.js"]` bajo `init: true`, uid 1000, sin gestores de paquetes. Sin perfil en compose. Redes `backend` y `egress`: `egress` solo sirve para publicar el puerto (un contenedor conectado únicamente a redes `internal: true` no lo publica); `web` no hace llamadas salientes y su salida a internet sin restricciones es la de TD-018 (TASK-020). `tmpfs` en `/app/apps/web/.next/cache` (uid 1000, `0700`, 64m; ADR-012). Bajo `SIGTERM` sale con 143 por diseño de Next (ADR-012): es el único servicio que no termina con 0 y no es un fallo. |
| `worker` | Node 22 (stage `runtime` de `docker/worker.Dockerfile`, `pnpm deploy`, ADR-011) | ninguno | Reclama runs `queued`, ejecuta el grafo, persiste eventos y checkpoints. CMD `["node", "--import", "tsx", "src/index.ts"]` bajo `init: true` (OD-032). Redes `backend` y `egress`. |
| `db` | PostgreSQL 16 | ninguno (solo red interna; `5432` en host opcional vía `compose.override`) | Fuente de verdad. |
| `ollama` (opcional, perfil `local`) | ollama/ollama | ninguno | Inferencia local. |
| `otel-collector` (opcional, perfil `observability`, M3) | otel/opentelemetry-collector | ninguno | Recepción de trazas OTel. |
| `migrate` (one-shot, TASK-005) | Node 22 (stage `migrate` de `docker/worker.Dockerfile`, `pnpm deploy` de `@agentlab/persistence`, ADR-011, OD-026) | ninguno | CMD `["tsx", "src/cli/migrate.ts"]` (el mismo punto de entrada que `pnpm db:migrate`, ADR-010): migraciones de Drizzle y `setup()` del checkpointer, serializadas con `pg_advisory_xact_lock`; sale. Solo red `backend` y solo recibe `DATABASE_URL`. `web` y `worker` arrancan cuando termina con éxito. La imagen conserva las `devDependencies` de `persistence` (`drizzle-kit`, `tsx`; ADR-010) pero no las de la raíz (condición 2 de ADR-011); **no se reutiliza para `worker` ni `web`**: ningún otro servicio la usa como `target` y ningún stage parte de ella (`FROM`/`COPY --from`). |
| `test` (one-shot, perfil `test`, TASK-005) | Node 22 (stage `test` de `docker/worker.Dockerfile`: `base` con pnpm, uid 1000 `node`, sin salida de `deploy`) | ninguno | Fase 2 de `make test`/`make validate` (OD-019): recibe el árbol del host por `tar`, instala sin red (`--offline`, store `pnpm-store` montado `:ro`, sin volumen de `node_modules`) y corre los tests contra `agentlab_test`. Solo red `test-db` (`internal: true`, únicamente `db` y `test`). Único servicio que recibe `DATABASE_URL_TEST`. `make test` deja `db` en marcha; se para con `make down`. |

Imágenes de `docker/worker.Dockerfile` (TASK-008, ADR-011) y `docker/web.Dockerfile` (TASK-007, ADR-012); verificado el 2026-10-21:
- `web` no usa `pnpm deploy` (ADR-012): el stage `build` instala con `pnpm install --frozen-lockfile --offline --ignore-scripts --filter web...` sobre el store de `pnpm fetch --ignore-scripts` y compila con `RUN --network=none pnpm --filter web build`; `runtime` parte de su propio `slim` (sin `npm`, `npx`, `corepack` ni `yarn`) y solo copia `.next/standalone` y `.next/static`, sin fuentes `.ts`. Ningún stage de un Dockerfile parte de los del otro.
- `runtime` y `migrate` se construyen con `pnpm deploy --ignore-scripts`, precedido de `pnpm install --frozen-lockfile --lockfile-only --ignore-scripts --offline` (condición 1 de ADR-011). Parten del stage `slim`, que borra `npm`, `npx`, `corepack` y `yarn` (no se pueden ejecutar; los bytes siguen en la capa base, ADR-011), y corren como `USER node` (uid 1000). No contienen el monorepo, solo el paquete desplegado y su cierre de dependencias.
- `migrate`, `worker`, `web` y `test` llevan `cap_drop: [ALL]` y `security_opt: ["no-new-privileges:true"]` en `compose.yaml`.
- `.dockerignore` es una lista de inclusión: `*` y se reincluyen solo `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.npmrc`, `tsconfig.base.json` (TASK-007, ADR-012: lo extiende `apps/web/tsconfig.json` y `next build` comprueba tipos), `apps/` y `packages/`, con las exclusiones de `HOST_TAR` del Makefile a cualquier nivel y además `*.pem`, `*.key`, `.next`, `dist`, `coverage`, `*.log` y `.DS_Store`.
- Redes: `backend` (`internal: true`: `db`, `migrate`, `web`, `worker`, `ollama`), `test-db` (`internal: true`: `db` y `test`) y `egress` (`web`, `worker`, `ollama`).
- TD-021 sigue abierta (MEDIUM) en la parte del rol: `test` se conecta a PostgreSQL como superusuario hasta TASK-037. La parte de la red queda resuelta con `test-db`.

Reglas:
- `web` y `worker` comparten `packages/*` pero **no** comparten proceso ni memoria.
- La comunicación `web → worker` es **solo por PostgreSQL** (tabla `runs`). No hay HTTP entre ellos.
- La comunicación `worker → web` (eventos en tiempo real) es por `run_events` + `LISTEN/NOTIFY` de PostgreSQL (`NOTIFY run_events, '<runId>'`). El Route Handler SSE se suscribe y lee los eventos nuevos por `seq`.

## 2. Paquetes y dirección de dependencias

```
core ← persistence ← policies ← providers ← orchestrator ← agents ← { worker, web }
                                     ↑
                            observability (M3, transversal: solo depende de core)
                                     ↑
                                tools (M4: depende de core, policies)
                           evaluations (M5: depende de core, persistence)
```

| Paquete | Contiene | NO contiene |
|---|---|---|
| `core` | Esquemas Zod (`AgentDefinition`, `TeamDefinition`, `RunRequest`, `RunEvent`, `AgentInvocationResult`, `Budget`), enums de estado, errores tipados (`AgentLabError` y subclases), interfaces (`ModelProvider`, `Tool`, `Checkpointer` wrapper), utilidades puras. | Ninguna dependencia de red, DB ni framework. Cero imports de otros paquetes del monorepo. |
| `persistence` | Esquema Drizzle, migraciones, repositorios (`RunsRepository`, `EventsRepository`, …), checkpointer de LangGraph sobre PostgreSQL, `LISTEN/NOTIFY`. | Lógica de negocio. |
| `policies` | `BudgetGuard` (comprueba y descuenta antes de cada llamada), `ToolAuthorizer` (allowlist), `ApprovalPolicy` (qué requiere humano), límites de grafo. | Llamadas a proveedores. |
| `providers` | `ProviderRegistry`, adaptadores `openai-compatible` (OpenRouter, Ollama), `gemini`, normalización de errores, reintentos con backoff, timeout. | Prompts de agentes. |
| `orchestrator` | Construcción de grafos LangGraph (`buildResearchGraph`, …), nodos genéricos (`invokeAgent`, `review`, `gate`), interrupciones para aprobación, cancelación cooperativa. | Definiciones concretas de roles. |
| `agents` | Prompts versionados por rol, `outputSchema` por rol, equipos de ejemplo (`research-team`, `analysis-team`). | Lógica de grafo. |
| `observability` | Emisor de eventos tipados, spans OTel, métricas por run/agente. | Persistencia (usa `persistence` vía interfaz inyectada). |
| `tools` | `ToolRegistry`, herramientas (`web.search`, `source.read`, `artifact.*`), allowlist HTTP. | Decisiones de autorización (las toma `policies`). |
| `evaluations` | Datasets de tareas, evaluadores, comparación de runs. | — |

Cada paquete exporta desde `src/index.ts` y, opcionalmente, sub-exports declarados en `package.json` `exports`; nunca rutas internas (decisión humana del 2026-10-21, TASK-007). Importar rutas internas de otro paquete está prohibido (lint rule `no-restricted-imports`). Sub-exports actuales: `@agentlab/persistence/testing` y `@agentlab/persistence/migrate` (`runMigrations`, fuera del índice: OD-040 a); previsto: `@agentlab/providers/testing`. Cada sub-export está cubierto por el test de exports de su paquete.

## 3. Contratos centrales

### 3.1 `ModelProvider` (`core`)

```ts
interface ModelProvider {
  readonly id: string;              // "openrouter" | "ollama" | "gemini" | …
  readonly capabilities: ProviderCapabilities;
  listModels(): Promise<ModelInfo[]>;
  generate(req: GenerateRequest, signal: AbortSignal): Promise<GenerateResponse>;
}

interface ProviderCapabilities {
  tools: boolean;            // function calling
  structuredOutput: boolean; // JSON schema / response_format
  streaming: boolean;
  maxContextTokens: number | null;  // null = desconocido, nunca inventado
  reportsUsage: boolean;
  reportsCost: boolean;
}

interface GenerateRequest {
  model: string;
  messages: Message[];
  requires: Partial<Pick<ProviderCapabilities, "tools" | "structuredOutput">>;
  tools?: ToolSpec[];
  responseSchema?: JsonSchema;
  maxOutputTokens: number;
  temperature?: number;
  timeoutMs: number;
}

interface GenerateResponse {
  content: string | null;
  toolCalls: ToolCall[];
  usage: { inputTokens: number | null; outputTokens: number | null };
  costReported: number | null;
  raw?: unknown; // solo en modo debug; nunca persistido
}
```

- Si `req.requires.tools` y `capabilities.tools === false` → `ProviderCapabilityError` **antes** de llamar a la red.
- Errores normalizados: `ProviderAuthError`, `ProviderRateLimitError` (con `retryAfterMs?`), `ProviderTimeoutError`, `ProviderCapabilityError`, `ProviderResponseError`. Todos con `retryable: boolean`.

### 3.2 `Tool` (`core`) y `ToolRegistry` (`tools`)

```ts
interface Tool<I, O> {
  name: string;                 // "web.search"
  description: string;
  input: ZodType<I>;
  output: ZodType<O>;
  sensitivity: "none" | "network" | "write" | "approval"; // "approval" → interrupción humana
  execute(input: I, ctx: ToolContext): Promise<O>;
}
```

Flujo de una llamada a herramienta: modelo emite `toolCall` → `policies.ToolAuthorizer` comprueba allowlist del agente y `sensitivity` → `BudgetGuard` descuenta → `ToolRegistry.execute` valida input/output con Zod → resultado se persiste en `tool_invocations` → se devuelve al modelo **envuelto** como dato no confiable:

```
<tool_result name="web.search" trust="untrusted">
…contenido…
</tool_result>
```

### 3.3 `BudgetGuard` (`policies`)

```ts
interface Budget { maxModelCalls; maxConcurrentAgents; maxReviewIterations; timeoutMs;
                   maxTokensPerCall; maxTotalTokens; maxContextRatio; maxToolsPerInvocation;
                   maxResultChars; maxGraphDepth; }

class BudgetGuard {
  reserve(kind: "model" | "tool", est?: number): void;   // lanza BudgetExceededError
  commit(kind, actual: Usage): void;                      // ajusta con uso real si existe
  snapshot(): BudgetSnapshot;                             // para run_events y UI
}
```

`reserve` se llama **siempre antes** de la operación. Si el proveedor no informa uso, `commit` registra `null` y la UI muestra "no informado"; nunca se estima.

### 3.4 Eventos (`core`)

Discriminated union `RunEvent` con `type`, `runId`, `seq`, `ts`, `payload`. `seq` lo asigna `EventsRepository.append` en una transacción que bloquea la fila del run y calcula `MAX+1` (OD-022). SQL probado en PostgreSQL 16.15 (plan de TASK-005, V2: 3 sesiones concurrentes × 200 inserciones, `seq` 1..600 contiguo y sin errores):

```sql
BEGIN;
SELECT 1 FROM runs WHERE id = $1 FOR UPDATE;
INSERT INTO run_events (run_id, seq)
  SELECT $1, COALESCE(MAX(seq), 0) + 1 FROM run_events WHERE run_id = $1;
COMMIT;
```

El repositorio añade al mismo `INSERT … SELECT` las columnas `type` y `payload` y un `RETURNING`; no cambian el mecanismo. `FOR UPDATE` no se admite junto a funciones de agregado (`SELECT COALESCE(MAX(seq),0)+1 … FOR UPDATE` falla en PostgreSQL 16), por eso se bloquea la fila de `runs`. `unique (run_id, seq)` queda como red de seguridad. Un evento se persiste **antes** de notificarse (`NOTIFY`). Al reconectar, el cliente envía `Last-Event-ID` y el handler devuelve todo lo que tenga `seq > id`.

## 4. El grafo (LangGraph.js)

- Un `TeamDefinition` selecciona un **graph builder** registrado (`research`, `analysis`; M4: builder genérico desde la UI).
- Estado del grafo (`GraphState`): `runId`, `request`, `plan`, `tasks[]`, `artifacts{}`, `reviews[]`, `iteration`, `budgetSnapshot`, `status`.
- Nodos genéricos de `orchestrator`:
  - `gate.budget` — comprueba presupuesto y permisos antes de empezar.
  - `agent.invoke(role)` — construye el prompt, pide generación, valida `outputSchema`, registra invocación.
  - `fanout.tasks` — subtareas paralelas con límite `maxConcurrentAgents` (semaphore).
  - `review` — invoca Critic/Evaluator sobre el artefacto; devuelve `pass | fail` + motivos.
  - `decide.review` — arista condicional: `pass → persist`, `fail && iteration < max → replan`, `fail && iteration >= max → persist(partial)`.
  - `approval.wait` — `interrupt()` de LangGraph; el run pasa a `awaiting_approval`; `POST /resume` reanuda desde checkpoint.
  - `persist.result` — escribe resultado y métricas, emite `run.completed|partial`.
- **Checkpointer**: `PostgresSaver` (`@langchain/langgraph-checkpoint-postgres`, esquema `langgraph`; ADR-002) con `thread_id = runId`. `run_checkpoints` guarda `(run_id, checkpoint_id, step, created_at)` para listar y reanudar.
- **Cancelación**: `POST /cancel` marca `runs.cancel_requested = true`; cada nodo comprueba la bandera al inicio y el `AbortSignal` se propaga a proveedores y herramientas. Estado final `cancelled` + evento.
- **Recuperación tras caída del worker**: al arrancar, el worker busca runs `running` cuyo `worker_heartbeat_at` haya caducado (> 60 s), los marca `queued` y los reanuda desde el último checkpoint. Un run reanudado emite `run.resumed` y conserva su `seq`.

## 5. Máquina de estados de `runs`

| Desde | Hacia | Disparador |
|---|---|---|
| — | `queued` | `POST /api/runs` |
| `queued` | `running` | worker reclama (`FOR UPDATE SKIP LOCKED`) |
| `running` | `awaiting_approval` | nodo `approval.wait` |
| `awaiting_approval` | `running` | `POST /resume` (humano) |
| `running` | `completed` | `persist.result` con revisión `pass` |
| `running` | `partial` | límite de iteraciones o presupuesto agotado con resultado utilizable |
| `running` | `failed` | error no recuperable |
| `queued` \| `running` \| `awaiting_approval` | `cancelled` | `POST /cancel` |
| `running` | `queued` | heartbeat caducado (recuperación) |

Hasta TASK-026, «heartbeat caducado» no lleva a `queued`: el worker marca esos runs `failed` (`running → failed`, `runs.error.code` `WORKER_INTERRUPTED`) al arrancar y cada `WORKER_STALE_MS` (ver §8). La fila `running → queued` entra en uso con la reanudación de TASK-026.

Estados terminales: `completed`, `partial`, `failed`, `cancelled`. Un run terminal nunca cambia de estado.

## 6. Modelo de datos (esquema Drizzle)

Columnas obligatorias en todas las tablas gestionadas por Drizzle (esquema `public`): `id uuid pk default gen_random_uuid()`, `created_at timestamptz`, `updated_at timestamptz`.

Excepción: las tablas del checkpointer en el esquema `langgraph` (`checkpoints`, `checkpoint_blobs`, `checkpoint_writes`, `checkpoint_migrations`) no siguen esta regla ni figuran en la tabla siguiente: las crea y migra `setup()` de `PostgresSaver`, no Drizzle (ADR-002).

Excepción (OD-024): la tabla de control de migraciones de Drizzle vive en el esquema `drizzle` (`drizzle.__drizzle_migrations`, la que crea por defecto el migrador de `drizzle-orm`). Tampoco sigue la regla de columnas ni figura en la tabla siguiente. `drizzle.config.ts` declara `schemaFilter: ["public"]`: Drizzle nunca genera cambios sobre `langgraph` ni `drizzle`.

| Tabla | Columnas clave | Notas |
|---|---|---|
| `projects` | `name`, `budget_profile jsonb` | |
| `provider_configs` | `project_id`, `provider_type`, `base_url`, `default_model`, `api_key_env text` | `api_key_env` es el **nombre** de la variable; nunca el valor |
| `agent_definitions` | `project_id`, `name`, `role`, `system_prompt`, `prompt_version`, `provider_config_id`, `model_id`, `tool_allowlist text[]`, `max_calls`, `max_tokens`, `timeout_ms`, `output_schema jsonb`, `enabled` | |
| `team_definitions` | `project_id`, `name`, `graph_builder`, `agent_ids uuid[]`, `coordination jsonb` | |
| `runs` | `project_id`, `team_id`, `request jsonb`, `status`, `budget jsonb`, `budget_used jsonb`, `result jsonb`, `error jsonb`, `cancel_requested bool`, `worker_id`, `worker_heartbeat_at`, `started_at`, `finished_at` | índice `(status, created_at)` |
| `tasks` | `run_id`, `parent_task_id`, `title`, `assigned_role`, `depends_on uuid[]`, `status`, `input jsonb`, `output jsonb` | |
| `agent_invocations` | `run_id`, `task_id`, `agent_definition_id`, `step`, `provider_type`, `model_id`, `status`, `attempt`, `duration_ms`, `input_tokens`, `output_tokens`, `cost_reported`, `validation jsonb`, `error jsonb` | `input_tokens`/`cost` nullable |
| `tool_invocations` | `run_id`, `agent_invocation_id`, `tool_name`, `input jsonb`, `output jsonb`, `status`, `duration_ms`, `error jsonb` | Nace en TASK-030 con su migración (OD-028); no está en `0000_init` |
| `run_events` | `run_id`, `seq int`, `type`, `payload jsonb`, `ts` | `unique (run_id, seq)` |
| `run_checkpoints` | `run_id`, `checkpoint_id`, `step`, | FK lógico al checkpointer. Nace en TASK-023 con su migración (OD-028); no está en `0000_init` |
| `evaluations` | `run_id`, `criteria jsonb`, `scores jsonb`, `verdict`, `evaluator_role` | Nace en TASK-036 con su migración (OD-028); no está en `0000_init` |

La tabla anterior es el modelo objetivo. La migración `0000_init` (TASK-005, OD-021, OD-028) crea **8 tablas** —`projects`, `provider_configs`, `agent_definitions`, `team_definitions`, `runs`, `tasks`, `agent_invocations`, `run_events`— y solo lo que usa M1, sin columnas "por si acaso"; cada tabla o columna posterior entra con la migración de la tarea que la usa:
- **Común:** `id uuid PK DEFAULT gen_random_uuid()`, `created_at`/`updated_at timestamptz NOT NULL DEFAULT now()`; `updated_at` lo fija el repositorio en cada `UPDATE` (sin triggers). Nombres de columna explícitos en snake_case. FK físicas en los `*_id` escalares (ninguna en arrays). `jsonb` tipado con los tipos de `core`.
- **Estados y roles:** `text` con `CHECK` generado desde `RUN_STATUSES`, `AGENT_ROLES` y `RUN_EVENT_TYPES` de `core` (no `pgEnum`: PostgreSQL no permite quitar valores de un enum). Estados sin valores definidos en `core` (`tasks.status`, `agent_invocations.status`): `text` sin `CHECK`.
- **Borrado:** `runs → projects` y `runs → team_definitions` con `RESTRICT` (el historial no se borra en cascada, ADR-007); las tablas hijas de un run, con `CASCADE`.
- **Índices:** solo los que consulta M1: `runs (status, created_at)`, `unique (run_id, seq)` (sirve también a `listSince`) y los de `project_id` en `provider_configs` y `agent_definitions` (listados por proyecto).
- **Fuera de `0000_init`:** `team_definitions.coordination` (M4, TASK-034; `TeamDefinition` de `core` no la tiene) y las tablas `tool_invocations` (TASK-030), `run_checkpoints` (TASK-023) y `evaluations` (TASK-036), cada una con su migración (OD-028): "lo que M1 no use, fuera" manda sobre el número de tablas.
- **`provider_configs.api_key_env`:** `text NULL` (Ollama no tiene clave), **sin `CHECK`** (OD-023): un valor rechazado no debe llegar a la base ni a sus logs. Lo valida el repositorio antes del `INSERT` con la regla de OD-017 que exporta `core` y longitud ≤ 40; si no la cumple, lanza `InvalidApiKeyEnvError` de `core` (`code: "API_KEY_ENV_INVALID"`, OD-027), con mensaje fijo que no incluye el valor. Ningún otro código escribe en `provider_configs`.

Prompts persistidos en `agent_invocations` (M3, columna `prompt_snapshot jsonb`): se pasan por `redactSecrets()` antes de guardar. El test `persistence/redaction.test.ts` falla si una cadena que coincida con cualquier `api_key_env` del entorno llega a la base de datos.

## 7. apps/web

- Next.js App Router. Rutas: `/` (proyectos), `/projects/:id` (equipos, agentes), `/runs/:id` (timeline de eventos, pasos, presupuesto, resultado), `/runs/:id/compare/:otherId` (M3).
- App Router en `apps/web/src/app` (OD-041 a; `rootDir: "src"` se mantiene). Route Handlers en `apps/web/src/app/api/**/route.ts`; `route.ts` solo compone y la lógica vive en `apps/web/src/server/**`.
- Las rutas con lógica (desde TASK-014) validan entrada con Zod y devuelven errores `{ code, message }` con estado HTTP coherente (400 validación, 404, 409 transición inválida, 500). En M0 no hay ninguna: con un entorno inválido, `/api/health` responde el 500 por defecto de Next, que registra el error sin valores (OD-044 a: sin logger en `web` en M0).
- `GET /api/health` (TASK-007): `export const dynamic = "force-dynamic"`; 200 `{ ok: true, db: "up", version }` o 503 `{ ok: false, db: "down" }`, exactamente esas claves, ambas con `cache-control: no-store`. `version` es el campo `version` de `apps/web/package.json`, embebido en el build (OD-043 a). Plazo único de 2 s (`HEALTH_TIMEOUT_MS = 2000`, constante, no variable de entorno) que cubre conexión y `select 1` mediante `pingDatabase` de `persistence`, sobre un pool de una conexión por petición (`max: 1`, `connectionTimeoutMillis` = plazo); el pool compartido del proceso lo decide TASK-014. Sin autenticación (OD-003, TD-005).
- Protección de la API sin autenticación (`Host` permitido, `Origin` y `Content-Type` en peticiones no-GET, cabeceras `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors`): requisito de security en TASK-007, se implementa en TASK-014. M0 solo quita `x-powered-by` (`poweredByHeader: false`).
- El handler SSE usa `ReadableStream`; envía `: ping` cada 15 s; cierra cuando el run es terminal.
- Sin estado global en el proceso web: todo se lee de PostgreSQL.
- Server Components para lectura; Client Components solo para el timeline en vivo y formularios.

## 8. apps/worker

- Bucle: `claimNext()` → `runGraph(run)` → `heartbeat` cada 15 s en paralelo → `finalize`.
- Un único run a la vez por proceso worker en v1 (`WORKER_CONCURRENCY=1`). Elevarlo es config, no código.
- Apagado limpio: `SIGTERM` → deja de reclamar, espera al run actual hasta `SHUTDOWN_GRACE_MS` (30 s), guarda checkpoint, sale.
- Arranque: `tsx watch src/index.ts` en desarrollo y `node --import tsx src/index.ts` en `start` y en Docker. Es el fallback de ADR-009 §7, activado en TASK-008 (OD-032, 2026-10-21): el CLI `tsx` da 30 ms al proceso hijo para confirmar la señal y después le manda `SIGKILL` (código 143), así que un bucle de eventos ocupado más de 30 ms rompía el apagado limpio.
- Identidad: `worker_id = <hostname>/<uuid>`, nuevo en cada arranque.
- Runs huérfanos (M0–M2, TASK-008; OD-033, OD-037, OD-038). `runs.error` = `InvocationError` de `core` con `code` `WORKER_INTERRUPTED`, mensaje fijo y `retryable: false`. `WORKER_INTERRUPTED` es solo un valor de `runs.error.code`, no un `AgentLabErrorCode`. Sin evento en M0; `run.failed` llega con TASK-015. Dos momentos, una sola sentencia cada uno (`failOrphaned`), que nunca marca el `worker_id` actual:
  - **Al arrancar**, tras comprobar el esquema y antes de la primera reclamación: runs `running` con heartbeat caducado (`WORKER_STALE_MS`) o nulo, o con un `worker_id` de una ejecución anterior del mismo host. Un error aquí termina el proceso con código 1.
  - **Cada `WORKER_STALE_MS`**, con un temporizador propio independiente de los bucles de reclamación, sin solaparse consigo mismo y parado por el apagado antes de cerrar el pool: solo heartbeat caducado o nulo, nunca el criterio de host. Un error aquí es `warn` y se reintenta en el siguiente periodo. El worker exige `WORKER_HEARTBEAT_MS < WORKER_STALE_MS` al arrancar (código 1 si no).
  - Es la detección de la recuperación de §4; TASK-026 añade la reanudación (`queued` + checkpoint) sobre los mismos dos momentos.

## 9. Versiones y herramientas

| Herramienta | Versión | Fijada en |
|---|---|---|
| Node.js | `22.23.3` (OD-048 a+, TASK-006; `engines.node` `>=22.12 <23` desde TASK-004: lo exigen `vitest` 5 y `vite` 8). El step «Node versions agree» del job `lint` del CI (`scripts/ci/check-node-version.sh`) falla si `.nvmrc`, los dos Dockerfiles y el `Makefile` no coinciden. La subida a `22.23.4` (parche de seguridad) es TASK-042 | `.nvmrc`; `docker/worker.Dockerfile` y `docker/web.Dockerfile` y `NODE_IMAGE` del `Makefile` (`node:22.23.3-bookworm-slim`, fijada por digest); `engines` en `package.json` |
| pnpm | 9.x | `packageManager` en `package.json` |
| TypeScript | 5.x strict (`5.9.3`, con `@types/node` 22.x) | `tsconfig.base.json` |
| PostgreSQL | 16 | `compose.yaml` |
| GitHub Actions (CI, TASK-006) | Runner `ubuntu-24.04`. Acciones fijadas por SHA completo, con la versión en comentario: `actions/checkout` v7.0.1 (`3d3c42e5aac5ba805825da76410c181273ba90b1`), `actions/setup-node` v7.0.0 (`820762786026740c76f36085b0efc47a31fe5020`), `actions/cache` v6.1.0 (`55cc8345863c7cc4c66a329aec7e433d2d1c52a9`). La regla de antigüedad mínima aplica también a las acciones: publicadas el 2026-07-20, el 2026-07-14 y el 2026-06-26, respectivamente (verificado por security contra la API de GitHub). Sin actualización automática: Dependabot para actions se decide en TASK-040 | `.github/workflows/ci.yml` |

Dependencias fijadas por OD-001 (TASK-002, ADR-002) y por TASK-004 (OD-009), verificadas con `npm view` el 2026-10-20, y por TASK-007 (OD-042), verificadas el 2026-10-21. Versión exacta, sin `^`, idéntica en todos los workspaces que la usen.

Antigüedad mínima: cada dependencia nueva o actualizada usa una versión publicada hace al menos dos semanas. Única excepción: un aviso de seguridad verificado por `security`, con cita del aviso (identificador GHSA/CVE, URL y fecha); la excepción se registra en el ADR o en el plan de la tarea con el identificador del aviso. Ejemplo vigente: `next` 16.4.2 (OD-042, ADR-012). Decisión humana del 2026-10-21 (TASK-007), sin OD.

| Paquete | Versión | Workspace | Razón |
|---|---|---|---|
| `@langchain/langgraph` | `1.5.1` | `orchestrator` | Última estable; orden determinista de escrituras paralelas (1.5.0) y fixes de reanudación de interrupciones paralelas (1.5.1) |
| `@langchain/langgraph-checkpoint` | `1.2.0` | `persistence`, `orchestrator` | Peer del checkpointer y dependencia de langgraph 1.5.1 (`^1.2.0`); `1.2.0` exacta en todo workspace que la resuelva, una sola instancia en el monorepo |
| `@langchain/langgraph-checkpoint-postgres` | `1.1.0` | `persistence` (desde TASK-005: `setup()` en `pnpm db:migrate`) | `PostgresSaver` del mismo release coordinado que langgraph 1.5.0 / checkpoint 1.2.0; tablas propias vía `setup()` en el esquema `langgraph` |
| `@langchain/core` | `1.2.18` | `orchestrator`, `persistence` | Satisface los peers `^1.1.48` (langgraph, checkpoint) y `^1.1.44` (checkpoint-postgres) |
| `drizzle-orm` | `0.45.4` | `persistence` | Última estable (1.0 sigue en rc); driver `drizzle-orm/node-postgres` |
| `drizzle-kit` | `0.31.11` | `persistence` (dev) | Pareja estable de drizzle-orm 0.45.x |
| `pg` | `8.23.1` | `persistence` | Driver PostgreSQL único: Drizzle, `PostgresSaver` (solo admite `pg`, peer `^8.12.0`) y `LISTEN/NOTIFY` |
| `@types/pg` | `8.23.1` | `persistence` (dev) | Tipos de `pg` |
| `next` | `16.4.2` | `web` | Última estable; Node ≥20.9, TS ≥5.1; Route Handlers con `ReadableStream` para SSE. Publicada el 2026-10-15: **excepción a la regla de las dos semanas** (OD-042, decisión humana tras la verificación de security; avisos citados en ADR-012): toda 16.x ≤ 16.4.0 es vulnerable (parche 16.4.1, que 16.4.2 contiene). Instalada en TASK-007. Bundler webpack (`next dev --webpack`, `next build --webpack`) con `extensionAlias` `.js → .ts/.tsx/.js` (OD-039 a, ADR-012); volver a Turbopack se revisa en TASK-040 |
| `react` / `react-dom` | `19.3.0` | `web` | Satisfacen el peer de `next` (`^18.2.0 \|\| ^19.0.0`); `react-dom` 19.3.0 pide `react ^19.3.0`. Sin excepción: ningún aviso los afecta (OD-042); TASK-007 |
| `tailwindcss` / `@tailwindcss/postcss` | `4.3.3` | `web` (dev) | `@tailwindcss/postcss` trae `postcss`, que no se declara; TASK-007 |
| `@types/react` / `@types/react-dom` | `19.3.0` | `web` (dev) | Tipos de `react`/`react-dom` 19.3; sin excepción (OD-042); TASK-007 |
| `tsx` | `4.23.15` | `apps/worker` (`dependencies`); `packages/persistence` (dev, scripts `db:*`) | ADR-009 (OD-007): ejecuta el worker sin build en dev y en Docker. ADR-010: ejecuta `db:migrate`/`db:reset` de `persistence`; de runtime solo en `apps/worker` |
| `zod` | `4.6.7` | `packages/core` (`dependencies`) | Compatible con `^3.25.32 \|\| ^4.2.0` (peer de `@langchain/langgraph` 1.5.1) y `^3.25.76 \|\| ^4` (dependencia de `@langchain/core` 1.2.18); `z.toJSONSchema` nativo; TASK-004 |
| `vitest` | `5.0.5` | raíz (dev) | Runner de tests (OD-009); engines `^22.12.0 \|\| ^24 \|\| >=26`; TASK-004 |
| `@vitest/coverage-v8` | `5.0.5` | raíz (dev) | Cobertura v8; peer `vitest 5.0.5` exacto; TASK-004 |
| `vite` | `8.3.4` | raíz (dev) | Peer obligatorio de `vitest` 5, declarado explícitamente; TASK-004 |

Compatibilidad: peers verificados con `npm view` y release coordinado langgraphjs #2961 (2026-10-12); fuentes en ADR-002. `@langchain/langgraph-checkpoint` y `@langchain/core` resuelven a una sola versión exacta (`1.2.0` y `1.2.18`) en `persistence` y `orchestrator`: TASK-013 elige el mecanismo (declaración exacta en ambos `package.json` o `pnpm.overrides` en la raíz) y TASK-023 lo comprueba con `pnpm why`. `zod` queda fijado en TASK-004; cuando entre `@langchain/core` (TASK-013), `pnpm why zod` debe mostrar una sola instancia (`4.6.7`). `react`/`react-dom`/`tailwindcss` quedan fijadas en TASK-007 (OD-042, verificadas con `npm view` el 2026-10-21). Subir cualquiera de estas versiones es una tarea propia que vuelve a verificar la compatibilidad.

## 10. Convenciones de código

- ESM en todo el monorepo. `type: module`.
- Nombres de archivos `kebab-case.ts`; tipos y esquemas `PascalCase`; esquemas Zod sufijo `Schema` (`RunEventSchema`) y tipo inferido sin sufijo (`RunEvent`).
- Errores: siempre subclases de `AgentLabError` con `code` estable (`BUDGET_EXCEEDED`, `PROVIDER_RATE_LIMIT`, `API_KEY_ENV_INVALID`, …; lista cerrada en `core/errors.ts`, OD-016 ampliada por OD-027). Nunca `throw new Error("…")` fuera de tests.
- Nada de `console.log` en paquetes; se usa el logger de `observability` (M3) o `pino` inyectado (M0–M2).
- Tests junto al código (`*.test.ts`) para unitarios; `src/**/*.integration.test.ts` del paquete o `tests/integration` para los que necesitan PostgreSQL, en serie (`fileParallelism: false`; testing-conventions, regla 11); `tests/e2e` (M3+) con Playwright.
- Variables de entorno: declaradas y validadas con Zod en `core/env.ts`; una variable no declarada no existe.

## 11. Decisiones registradas

Ver `docs/adr/`. Índice en `ADR-000`.
