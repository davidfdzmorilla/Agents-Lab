# AgentLab — Arquitectura

| Campo | Valor |
|---|---|
| Versión | 1.0 (2026-10-20) |
| Jerarquía | ADR aceptado > TECHNICAL_SPEC > **ARCHITECTURE** > AGENTS + WORKFLOW > ROADMAP > TASKS |

Este documento describe **cómo está construido** AgentLab. `TECHNICAL_SPEC.md` dice qué debe hacer; aquí se fija dónde vive cada responsabilidad, qué contratos se cruzan y qué está prohibido. Si el código contradice este documento, el código está mal (o hace falta un ADR).

## 1. Vista de procesos

Tres procesos en Docker Compose + dos opcionales:

| Servicio | Imagen / base | Puerto expuesto | Responsabilidad |
|---|---|---|---|
| `web` | Node 22 + Next.js | `3000` (host) | UI + API HTTP/SSE. Crea runs, lee estado, emite eventos. **Nunca** ejecuta agentes. |
| `worker` | Node 22 | ninguno | Reclama runs `queued`, ejecuta el grafo, persiste eventos y checkpoints. |
| `db` | PostgreSQL 16 | ninguno (solo red interna; `5432` en host opcional vía `compose.override`) | Fuente de verdad. |
| `ollama` (opcional, perfil `local`) | ollama/ollama | ninguno | Inferencia local. |
| `otel-collector` (opcional, perfil `observability`, M3) | otel/opentelemetry-collector | ninguno | Recepción de trazas OTel. |

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

Cada paquete exporta **solo** desde `src/index.ts`. Importar rutas internas de otro paquete está prohibido (lint rule `no-restricted-imports`).

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

Discriminated union `RunEvent` con `type`, `runId`, `seq`, `ts`, `payload`. `seq` lo asigna `EventsRepository.append` con `SELECT COALESCE(MAX(seq),0)+1 … FOR UPDATE` por run. Un evento se persiste **antes** de notificarse (`NOTIFY`). Al reconectar, el cliente envía `Last-Event-ID` y el handler devuelve todo lo que tenga `seq > id`.

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
- **Checkpointer**: `PostgresSaver` (o equivalente, OD-001) con `thread_id = runId`. `run_checkpoints` guarda `(run_id, checkpoint_id, step, created_at)` para listar y reanudar.
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

Estados terminales: `completed`, `partial`, `failed`, `cancelled`. Un run terminal nunca cambia de estado.

## 6. Modelo de datos (esquema Drizzle)

Columnas obligatorias en todas las tablas: `id uuid pk default gen_random_uuid()`, `created_at timestamptz`, `updated_at timestamptz`.

| Tabla | Columnas clave | Notas |
|---|---|---|
| `projects` | `name`, `budget_profile jsonb` | |
| `provider_configs` | `project_id`, `provider_type`, `base_url`, `default_model`, `api_key_env text` | `api_key_env` es el **nombre** de la variable; nunca el valor |
| `agent_definitions` | `project_id`, `name`, `role`, `system_prompt`, `prompt_version`, `provider_config_id`, `model_id`, `tool_allowlist text[]`, `max_calls`, `max_tokens`, `timeout_ms`, `output_schema jsonb`, `enabled` | |
| `team_definitions` | `project_id`, `name`, `graph_builder`, `agent_ids uuid[]`, `coordination jsonb` | |
| `runs` | `project_id`, `team_id`, `request jsonb`, `status`, `budget jsonb`, `budget_used jsonb`, `result jsonb`, `error jsonb`, `cancel_requested bool`, `worker_id`, `worker_heartbeat_at`, `started_at`, `finished_at` | índice `(status, created_at)` |
| `tasks` | `run_id`, `parent_task_id`, `title`, `assigned_role`, `depends_on uuid[]`, `status`, `input jsonb`, `output jsonb` | |
| `agent_invocations` | `run_id`, `task_id`, `agent_definition_id`, `step`, `provider_type`, `model_id`, `status`, `attempt`, `duration_ms`, `input_tokens`, `output_tokens`, `cost_reported`, `validation jsonb`, `error jsonb` | `input_tokens`/`cost` nullable |
| `tool_invocations` | `run_id`, `agent_invocation_id`, `tool_name`, `input jsonb`, `output jsonb`, `status`, `duration_ms`, `error jsonb` | |
| `run_events` | `run_id`, `seq int`, `type`, `payload jsonb`, `ts` | `unique (run_id, seq)` |
| `run_checkpoints` | `run_id`, `checkpoint_id`, `step`, | FK lógico al checkpointer |
| `evaluations` | `run_id`, `criteria jsonb`, `scores jsonb`, `verdict`, `evaluator_role` | |

Prompts persistidos en `agent_invocations` (M3, columna `prompt_snapshot jsonb`): se pasan por `redactSecrets()` antes de guardar. El test `persistence/redaction.test.ts` falla si una cadena que coincida con cualquier `api_key_env` del entorno llega a la base de datos.

## 7. apps/web

- Next.js App Router. Rutas: `/` (proyectos), `/projects/:id` (equipos, agentes), `/runs/:id` (timeline de eventos, pasos, presupuesto, resultado), `/runs/:id/compare/:otherId` (M3).
- Route Handlers en `app/api/**/route.ts`; cada handler valida entrada con Zod y devuelve errores `{ code, message }` con estado HTTP coherente (400 validación, 404, 409 transición inválida, 500).
- El handler SSE usa `ReadableStream`; envía `: ping` cada 15 s; cierra cuando el run es terminal.
- Sin estado global en el proceso web: todo se lee de PostgreSQL.
- Server Components para lectura; Client Components solo para el timeline en vivo y formularios.

## 8. apps/worker

- Bucle: `claimNext()` → `runGraph(run)` → `heartbeat` cada 15 s en paralelo → `finalize`.
- Un único run a la vez por proceso worker en v1 (`WORKER_CONCURRENCY=1`). Elevarlo es config, no código.
- Apagado limpio: `SIGTERM` → deja de reclamar, espera al run actual hasta `SHUTDOWN_GRACE_MS` (30 s), guarda checkpoint, sale.

## 9. Versiones y herramientas

| Herramienta | Versión | Fijada en |
|---|---|---|
| Node.js | 22 LTS | `.nvmrc`, Dockerfiles |
| pnpm | 9.x | `packageManager` en `package.json` |
| TypeScript | 5.x strict | `tsconfig.base.json` |
| PostgreSQL | 16 | `compose.yaml` |
| LangGraph.js / checkpointer / Drizzle / Next.js | **OD-001** | TASK-002 |

## 10. Convenciones de código

- ESM en todo el monorepo. `type: module`.
- Nombres de archivos `kebab-case.ts`; tipos y esquemas `PascalCase`; esquemas Zod sufijo `Schema` (`RunEventSchema`) y tipo inferido sin sufijo (`RunEvent`).
- Errores: siempre subclases de `AgentLabError` con `code` estable (`BUDGET_EXCEEDED`, `PROVIDER_RATE_LIMIT`, …). Nunca `throw new Error("…")` fuera de tests.
- Nada de `console.log` en paquetes; se usa el logger de `observability` (M3) o `pino` inyectado (M0–M2).
- Tests junto al código (`*.test.ts`) para unitarios; `tests/integration` para los que necesitan PostgreSQL; `tests/e2e` (M3+) con Playwright.
- Variables de entorno: declaradas y validadas con Zod en `core/env.ts`; una variable no declarada no existe.

## 11. Decisiones registradas

Ver `docs/adr/`. Índice en `ADR-000`.
