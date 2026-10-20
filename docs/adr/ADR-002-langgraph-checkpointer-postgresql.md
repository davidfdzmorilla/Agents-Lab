# ADR-002 — LangGraph.js como motor de grafos con checkpointer PostgreSQL

| Campo | Valor |
|---|---|
| Estado | Accepted (2026-10-20, aprobado por el responsable humano; OD-001 resuelta en TASK-002) |
| Fecha | 2026-10-20 |
| Decisores | Responsable humano · architect |
| Relacionado | SPEC §3, §4, §6, §13 (OD-001); ARCHITECTURE §4, §6, §9; TASK-002, TASK-004, TASK-005, TASK-008, TASK-013, TASK-023 |

## Contexto
El motor necesita grafos con ciclos (revisión → replanificación), pausas para aprobación humana, cancelación y reanudación tras reinicio. Implementarlo a mano es posible pero reinventa checkpoints, interrupciones y estado.

## Decisión
1. **LangGraph.js** como motor de grafos. Los nodos genéricos (`gate.budget`, `agent.invoke`, `fanout.tasks`, `review`, `decide.review`, `approval.wait`, `persist.result`) viven en `packages/orchestrator`.
2. Checkpointer **`PostgresSaver`** (`@langchain/langgraph-checkpoint-postgres`) con `configurable.thread_id = runId` (UUID como texto) y `checkpoint_ns = ""`, enlazado por `run_checkpoints`. En M1 el grafo usa `MemorySaver` (deuda TD-002) y en M3 (TASK-023) pasa a `PostgresSaver`; el paquete entra en `persistence` antes, en TASK-005, porque `pnpm db:migrate` ejecuta su `setup()` (punto 7).
3. Aprobación humana mediante `interrupt()`; el run pasa a `awaiting_approval` y `POST /resume` reanuda desde checkpoint.
4. Versiones fijadas (TASK-002, 2026-10-20), exactas y sin `^`: `@langchain/langgraph 1.5.1`, `@langchain/langgraph-checkpoint 1.2.0`, `@langchain/langgraph-checkpoint-postgres 1.1.0`, `@langchain/core 1.2.18`. Cada una se resuelve a esa única versión exacta en todo workspace que la use: `@langchain/langgraph-checkpoint 1.2.0` y `@langchain/core 1.2.18` en `persistence` y `orchestrator`. Tabla completa (Drizzle, `pg`, Next.js) en ARCHITECTURE §9.
5. **`pg` (8.23.1) es el driver PostgreSQL único** (decisión humana 2026-10-20): un `pg.Pool` por proceso, creado por la app (`web`/`worker`) mediante una función de construcción de `persistence` (sin singleton de módulo, ARCHITECTURE §10) e inyectado en Drizzle (`drizzle-orm/node-postgres`) y `PostgresSaver`; `LISTEN/NOTIFY` usa un cliente dedicado del mismo driver. `PostgresSaver` recibe el pool inyectado; **nunca** se llama a `checkpointer.end()` sobre él (cierra el pool recibido): lo cierra quien lo creó.
6. **Las tablas del checkpointer viven en el esquema PostgreSQL propio `langgraph`** de la misma base (decisión humana 2026-10-20), construyendo el saver con `{ schema: "langgraph" }`. Sus tablas (`checkpoints`, `checkpoint_blobs`, `checkpoint_writes`, `checkpoint_migrations`) las crea y migra `setup()` (idempotente), no Drizzle. `run_checkpoints.checkpoint_id` es `text` (el checkpointer no usa `uuid`), `step` sale de `CheckpointMetadata.step` y el enlace es un FK lógico (no se declara FK física: las tablas las gestiona `setup()` fuera de Drizzle, con PK compuesta `(thread_id, checkpoint_ns, checkpoint_id)` en tabla externa).
7. **`setup()` del checkpointer lo ejecuta `pnpm db:migrate`** (decisión humana 2026-10-20), como paso explícito junto a las migraciones de Drizzle (TASK-005). El worker no lo ejecuta: al arrancar comprueba que el esquema `langgraph` existe y, si no, falla rápido con un mensaje claro que indica ejecutar `pnpm db:migrate` (TASK-008).

## Compatibilidad verificada (2026-10-20)
| Comprobación | Resultado | Fuente |
|---|---|---|
| langgraph 1.5.1 depende de `@langchain/langgraph-checkpoint ^1.2.0`; checkpoint-postgres 1.1.0 la exige como peer `^1.2.0` | ✅ ambos resuelven a 1.2.0 | `npm view <pkg>@<v> dependencies peerDependencies` · https://www.npmjs.com/package/@langchain/langgraph/v/1.5.1 · https://www.npmjs.com/package/@langchain/langgraph-checkpoint-postgres/v/1.1.0 |
| Release coordinado langgraph 1.5.0 / checkpoint 1.2.0 / checkpoint-postgres 1.1.0 (changeset #2961, columna `task_path` migrada por `setup()`) | ✅ 2026-10-12 | https://github.com/langchain-ai/langgraphjs/releases/tag/%40langchain%2Flanggraph-checkpoint-postgres%401.1.0 · https://github.com/langchain-ai/langgraphjs/releases/tag/%40langchain%2Flanggraph%401.5.1 |
| Peers `@langchain/core` (`^1.1.48` langgraph/checkpoint, `^1.1.44` checkpoint-postgres) | ✅ 1.2.18 los satisface | https://www.npmjs.com/package/@langchain/core/v/1.2.18 |
| `PostgresSaver` admite `pg.Pool` inyectado y opción `schema` (por defecto `public`) | ✅ `new PostgresSaver(pool, serde?, { schema })` | `dist/index.d.ts` del tarball 1.1.0 (inspeccionado en TASK-002) |
| checkpoint-postgres depende de `pg ^8.12.0` | ✅ `pg 8.23.1` | https://www.npmjs.com/package/pg/v/8.23.1 |
| ESM y Node 22 | ✅ todos `type: module`; `engines` ≥18 / ≥20 | `npm view <pkg>@<v> type engines` |
| Next.js 16.4.2: Route Handler `GET` que devuelve `new Response(ReadableStream)` (SSE), `runtime = 'nodejs'` | ✅ documentado | https://nextjs.org/docs/app/api-reference/file-conventions/route (sección *Streaming*, consultada 2026-10-20) |

Detalle y alternativas descartadas en `docs/reports/TASK-002-plan.md`.

## Alternativas consideradas
| Alternativa | Por qué se descarta |
|---|---|
| Máquina de estados propia | Reimplementar checkpoints/interrupciones; más código que mantener sin beneficio claro en v1 |
| Mastra, CrewAI-like TS | Menos control sobre estado y checkpoints; acoplan proveedores |
| Temporal / cola durable | Sobredimensionado para un worker local a coste cero |
| Checkpointer propio sobre Drizzle | Reimplementa serialización y migraciones que `PostgresSaver` ya resuelve |
| langgraph 1.4.21 + checkpoint-postgres 1.0.6 | langgraph 1.4.21 ya resuelve `checkpoint` a 1.2.0: no evita el cambio y renuncia a los fixes de interrupciones paralelas |
| `postgres` (postgres.js) para Drizzle + `pg` solo para el checkpointer | Dos drivers y dos pools sin beneficio |
| Tablas del checkpointer en `public` (con `tablesFilter` o prohibiendo `push`) | Mezcla tablas ajenas al contrato de ARCHITECTURE §6 con las de Drizzle |

## Consecuencias
- Positivas: ciclos, pausas y recuperación resueltos por la librería; patrón conocido. Un único driver y un único pool. El esquema `langgraph` aísla las tablas del checkpointer de las gestionadas por Drizzle.
- Negativas: dependencia de la API de LangGraph.js (cambios entre versiones); se encapsula en `orchestrator` para que `agents`, `providers` y `web` no la importen. langgraph 1.5.x es reciente (posible patch inmediato): versión exacta y subida deliberada por tarea. Drizzle 1.0 (rc) obligará a una migración futura propia.
- Obligaciones para tareas posteriores:
  - TASK-005: `drizzle.config.ts` con `schemaFilter: ["public"]` para que `generate`/`push` no toquen el esquema `langgraph`; `pnpm db:migrate` aplica las migraciones de Drizzle y ejecuta `setup()` sobre `langgraph`.
  - TASK-008: el worker comprueba al arrancar que existe el esquema `langgraph` y falla rápido con mensaje claro si no.
  - TASK-023: test de `setup()` idempotente (dos ejecuciones seguidas) y de `put`/`getTuple` en el esquema `langgraph` contra PostgreSQL 16.
  - TASK-004: versión exacta de `zod` dentro de los rangos de `@langchain/langgraph` 1.5.1 (`^3.25.32 || ^4.2.0`) y `@langchain/core` 1.2.18 (`^3.25.76 || ^4`).
  - TASK-013 / TASK-023: una sola versión exacta de `@langchain/core` (`1.2.18`) y `@langchain/langgraph-checkpoint` (`1.2.0`) en `persistence` y `orchestrator`; TASK-013 fija el mecanismo (declaración exacta en ambos `package.json` o `pnpm.overrides` en la raíz) y TASK-023 lo comprueba con `pnpm why`.
  - Las tablas del esquema `langgraph` son una **excepción** a las columnas obligatorias de ARCHITECTURE §6 (`id`, `created_at`, `updated_at`), documentada en §6.
  - TypeScript `5.9.3` y `@types/node` 22.x (decisión humana 2026-10-20; cabe en "5.x" de ARCHITECTURE §9). `react`/`react-dom`/`tailwindcss` en TASK-007.
- Riesgo: `@langchain/core`/`langsmith` leen `LANGSMITH_*`/`LANGCHAIN_TRACING*`/`LANGCHAIN_API_KEY` directamente de `process.env`; no declararlas en `core/env.ts` no impide el trazado remoto (coste y privacidad). Medida decidida (2026-10-20): TASK-013 desactiva el trazado explícitamente (`LANGCHAIN_TRACING_V2=false` y sin `LANGCHAIN_API_KEY` en `.env.example`, validado en `core/env.ts`) con test de que ninguna llamada sale hacia LangSmith con `FakeProvider`; security obligatorio en TASK-005, TASK-007 y TASK-013.

## Verificación
TASK-005: `pnpm db:migrate` crea el esquema `langgraph` vía `setup()`. TASK-008: arranque del worker sin esquema `langgraph` falla con mensaje claro. TASK-023 (M3, pago de TD-002): `setup()` idempotente en el esquema `langgraph` y `put`/`getTuple` con `thread_id = runId` contra PostgreSQL 16. TASK-013 (grafo con `FakeProvider`), TASK-023 (reanudación desde checkpoint), TASK-026 (muerte del worker).
