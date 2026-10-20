# PLAN — TASK-002 · Resolver OD-001 (versiones LangGraph.js, checkpointer PostgreSQL, Drizzle, Next.js)

| Campo | Valor |
|---|---|
| Autor | architect |
| Fecha | 2026-10-20 |
| Fase | plan (no se ha editado ARCHITECTURE, SPEC ni ADR-002) |
| Evidencia | npm registry consultado con `npm view` (solo lectura) el 2026-10-20; tarball de `@langchain/langgraph-checkpoint-postgres@1.1.0` inspeccionado con `npm pack` en scratchpad; GitHub Releases vía `gh api`; docs oficiales vía web |

## PLAN — TASK-002

**Contexto:** OD-001 deja sin fijar las versiones de LangGraph.js, su checkpointer PostgreSQL, Drizzle y Next.js. ADR-002 (Proposed) exige verificar compatibilidad LangGraph ↔ checkpointer antes de aceptarse. Esta tarea es solo documental: propone versiones exactas (sin `^`, mismo criterio que TASK-001) con fuente y fecha; la instalación real ocurre en las tareas de cada paquete.

### 1. Tabla de versiones propuesta (OD-001)

Fechas = campo `time` del registry npm (UTC). Todas son `dist-tag latest` y estables (no beta/rc/canary).

| Paquete | Versión exacta | Publicada | Dónde se usa | Razón | Fuente |
|---|---|---|---|---|---|
| `@langchain/langgraph` | `1.5.1` | 2026-10-16 | `orchestrator` | Última estable. 1.5.0 ordena de forma determinista las escrituras paralelas por `task_path` (relevante para `fanout.tasks`); 1.5.1 corrige reanudación de interrupciones paralelas y `durability: "exit"` (relevante para `approval.wait` y TASK-023). `type: module`, `engines.node >=18`. | https://www.npmjs.com/package/@langchain/langgraph/v/1.5.1 · https://github.com/langchain-ai/langgraphjs/releases/tag/%40langchain%2Flanggraph%401.5.1 |
| `@langchain/langgraph-checkpoint-postgres` | `1.1.0` | 2026-10-12 | `persistence` | Publicada en el mismo release coordinado que langgraph 1.5.0 y checkpoint 1.2.0 (PR #2961, columna `task_path` migrada por `setup()`). Expone `PostgresSaver`. Depende de `pg ^8.12.0`. | https://www.npmjs.com/package/@langchain/langgraph-checkpoint-postgres/v/1.1.0 · https://github.com/langchain-ai/langgraphjs/releases/tag/%40langchain%2Flanggraph-checkpoint-postgres%401.1.0 |
| `@langchain/langgraph-checkpoint` | `1.2.0` | 2026-10-12 | `persistence` (peer explícita) | Peer obligatoria del checkpointer (`^1.2.0`) y dependencia de langgraph 1.5.1 (`^1.2.0`): se fija igual en ambos para que `BaseCheckpointSaver` sea una única instancia. | https://www.npmjs.com/package/@langchain/langgraph-checkpoint/v/1.2.0 |
| `@langchain/core` | `1.2.18` | 2026-10-15 | `orchestrator`, `persistence` (peer) | Satisface peers `^1.1.48` (langgraph, checkpoint) y `^1.1.44` (checkpoint-postgres). `engines.node >=20` (Node 22 OK). | https://www.npmjs.com/package/@langchain/core/v/1.2.18 |
| `drizzle-orm` | `0.45.4` | 2026-10-08 | `persistence` | Última estable (`latest`). La rama 1.0 sigue en `1.0.0-rc.4` (2026-06-27) → descartada por no estable. Driver `node-postgres` (`pg`), peer opcional `pg >=8`. | https://www.npmjs.com/package/drizzle-orm/v/0.45.4 · https://github.com/drizzle-team/drizzle-orm/releases/tag/0.45.4 |
| `drizzle-kit` | `0.31.11` | 2026-09-21 | `persistence` (dev) | Última estable; publicada el mismo día que drizzle-orm 0.45.3 (línea 0.45.x). Sin peer deps. | https://www.npmjs.com/package/drizzle-kit/v/0.31.11 · https://github.com/drizzle-team/drizzle-orm/releases/tag/drizzle-kit%400.31.11 |
| `next` | `16.4.2` | 2026-10-15 | `apps/web` | Última estable. `engines.node >=20.9.0`, TypeScript mínimo 5.1. Route Handlers devuelven `new Response(ReadableStream)` (documentado, ver §3). Turbopack por defecto. | https://www.npmjs.com/package/next/v/16.4.2 · https://nextjs.org/docs/app/guides/upgrading/version-16 |

Paquetes acoplados que **no** forman parte de OD-001 (ver OPEN DECISIONS): `pg 8.23.1`, `@types/pg 8.23.1`, `zod 4.6.7`, `react`/`react-dom 19.3.1`, `tailwindcss 4.3.3`, `typescript`.

### 2. Verificación de compatibilidad LangGraph ↔ checkpointer ↔ core (DoD viñeta 2)

| Comprobación | Resultado | Evidencia |
|---|---|---|
| langgraph 1.5.1 → `@langchain/langgraph-checkpoint ^1.2.0` (dependency) | ✅ resuelve a 1.2.0 | `npm view @langchain/langgraph@1.5.1 dependencies` |
| checkpoint-postgres 1.1.0 → peer `@langchain/langgraph-checkpoint ^1.2.0` | ✅ misma 1.2.0 | `npm view @langchain/langgraph-checkpoint-postgres@1.1.0 peerDependencies` |
| peers `@langchain/core`: langgraph `^1.1.48`, checkpoint `^1.1.48`, checkpoint-postgres `^1.1.44` | ✅ 1.2.18 satisface las tres | `npm view … peerDependencies` |
| peer `zod` de langgraph: `^3.25.32 \|\| ^4.2.0`; core depende de `zod ^3.25.76 \|\| ^4` | ✅ con zod 4.6.7 o 3.25.x | `npm view` |
| Release coordinado | ✅ langgraph 1.5.0, checkpoint 1.2.0 y checkpoint-postgres 1.1.0 publicados el 2026-10-12 con el mismo changeset (#2961) | GitHub Releases (enlaces en tabla) |
| ESM | ✅ los cuatro paquetes `type: module` con `exports.import` | `npm view … type exports` |
| Node 22 | ✅ `engines`: langgraph/checkpoint `>=18`, core `>=20`, next `>=20.9.0`; Node 22 en mantenimiento LTS hasta 2027-04-30 | https://github.com/nodejs/Release/blob/main/schedule.json |

**Encaje de la API con ADR-002** (inspeccionado `dist/index.d.ts` y `dist/migrations.js` del tarball 1.1.0):
- `new PostgresSaver(pool: pg.Pool, serde?, { schema })` o `PostgresSaver.fromConnString(url, { schema })`; `schema` por defecto `"public"`. Permite **compartir el `pg.Pool`** de `persistence`.
- `setup()` crea y migra **tablas propias**: `checkpoint_migrations`, `checkpoints`, `checkpoint_blobs`, `checkpoint_writes` (PK `(thread_id, checkpoint_ns, checkpoint_id)`; `thread_id TEXT`, `checkpoint_id TEXT`). No las gestiona Drizzle.
- `thread_id = runId` encaja: el UUID del run se pasa como texto en `configurable.thread_id`.
- `run_checkpoints (run_id, checkpoint_id, step)` como relación propia encaja como "FK lógico": `checkpoint_id` debe ser `text` (el checkpointer no usa `uuid`) y `step` sale de `CheckpointMetadata.step`. No hay FK física posible (PK compuesta y tabla externa).
- Métodos disponibles: `getTuple`, `list`, `put`, `putWrites`, `deleteThread(threadId)`, `end()`. ⚠️ `end()` cierra el pool recibido (`this.pool.end()`).

### 3. Verificación Next.js 16.4.2 + SSE (DoD viñeta 3)

La referencia oficial de `route.js` (https://nextjs.org/docs/app/api-reference/file-conventions/route, sección *Streaming*, consultada 2026-10-20, lastUpdated 2026-04-30) documenta un `GET` que devuelve `new Response(new ReadableStream({ pull(controller) { … } }))`. Desde v15 los `GET` son dinámicos por defecto (sin caché estática), y el segmento admite `export const runtime = 'nodejs'`, necesario porque el handler SSE usará `pg` (`LISTEN/NOTIFY`). ✅ Soporta el diseño de ARCHITECTURE §7 (`ReadableStream`, `: ping` cada 15 s, cierre en estado terminal).

### Decisiones

- **Trío LangGraph 1.5.1 / checkpoint 1.2.0 / checkpoint-postgres 1.1.0 / core 1.2.18** — alternativa descartada: langgraph 1.4.21 + checkpoint-postgres 1.0.6 (más "asentada") porque langgraph 1.4.21 depende de `checkpoint ^1.1.6`, que ya resuelve a 1.2.0: no evita el cambio y renuncia a los fixes de interrupciones paralelas.
- **`PostgresSaver` oficial** (elimina el "o equivalente" de ARCHITECTURE §4) — alternativa descartada: checkpointer propio sobre Drizzle porque reimplementa serialización/migraciones que ADR-002 decidió no reinventar.
- **Drizzle 0.45.4 / drizzle-kit 0.31.11** — alternativa descartada: 1.0.0-rc.4 porque no es estable (criterio del packet); se registra el riesgo de migración futura.
- **Next.js 16.4.2** — alternativa descartada: 15.5.x (`backport`) porque 16 es la línea estable actual, cumple Node 22 y TS ≥5.1, y no hay motivo para empezar en una línea de mantenimiento.
- **Versiones exactas sin `^`**, iguales en todos los workspaces que las usen (mismo criterio que TASK-001).

### Pasos (fase /execute-task, tras aprobación humana)

1. Sustituir la fila `LangGraph.js / checkpointer / Drizzle / Next.js | OD-001 | TASK-002` de §9 por la tabla del Anexo A → ficheros: `docs/ARCHITECTURE.md` (§9 únicamente).
2. Añadir a ADR-002 la sección "Versiones fijadas" y las verificaciones (Anexo C); `Estado → Accepted` **solo si** el packet de ejecución trae la aprobación humana explícita; si no, queda `Proposed` → ficheros: `docs/adr/ADR-002-langgraph-checkpointer-postgresql.md`.
3. Marcar OD-001 como resuelta en la tabla de SPEC §13 (Anexo B) → ficheros: `docs/TECHNICAL_SPEC.md` (§13 únicamente).
4. (Fuera del scope de TASK-002, para el Orchestrator/docs-keeper) actualizar la fila de ADR-002 en el índice `docs/adr/ADR-000-indice-y-plantilla.md`, la frase de SPEC §3 que remite a OD-001 y el "o equivalente, OD-001" de ARCHITECTURE §4.

### Contratos públicos nuevos/cambiados

Ninguna firma de código. Convenciones que fija esta tarea para tareas posteriores:
- `configurable.thread_id = runId` (string UUID); `checkpoint_ns = ""`.
- `run_checkpoints.checkpoint_id` de tipo `text`; `step` tomado de `CheckpointMetadata.step`.
- `PostgresSaver` se construye con el `pg.Pool` inyectado de `persistence`; nunca se llama a `checkpointer.end()` sobre el pool compartido (lo cierra quien lo creó).

### Tests

Tarea documental: el tester verifica reproduciendo `npm view <pkg>@<versión> version time peerDependencies dependencies engines` para cada fila y comprobando los enlaces. La verificación ejecutable queda en las tareas consumidoras: `pnpm install` sin warnings de peer deps al añadir estos paquetes; test de integración en `persistence` que llame a `setup()` dos veces (idempotente) y haga `put`/`getTuple` con `thread_id = runId` contra PostgreSQL 16; TASK-013/TASK-023 cubren grafo y reanudación.

### Riesgos

- LangGraph 1.5.x tiene 8 días: posible patch inmediato. Mitigación: versión exacta y subida deliberada por tarea.
- Drizzle 1.0 (rc desde 2026-04) cambiará API/formato de migraciones; migrar será una tarea propia.
- `drizzle-kit push` gestiona todas las tablas/esquemas por defecto y propondría borrar las del checkpointer (https://orm.drizzle.team/docs/drizzle-config-file). Mitigación: usar `generate` + `migrate` y/o `schemaFilter` (ver OD-B).
- ARCHITECTURE §6 exige `id/created_at/updated_at` en "todas las tablas"; las tablas del checkpointer no los tienen (ver OD-B).
- Duplicar instancias de `@langchain/langgraph-checkpoint` o `@langchain/core` entre `persistence` y `orchestrator` rompería `instanceof`/tipos. Mitigación: misma versión exacta en ambos; comprobar con `pnpm why`.
- `@langchain/core` depende de `langsmith`: el trazado remoto solo se activa con variables `LANGSMITH_*`/`LANGCHAIN_TRACING*`; no deben declararse en `core/env.ts` ni en `.env.example` (coste 0 y privacidad). A revisar por security en las tareas de `orchestrator`.
- Node 22 sale de soporte el 2027-04-30 (Node 24 es LTS activo); no se reabre, se anota.

### OPEN DECISIONS

- **OD-A — Driver PostgreSQL compartido por Drizzle, checkpointer y LISTEN/NOTIFY.** El checkpointer solo admite `pg`. Opciones: (a) `pg 8.23.1` + `@types/pg 8.23.1` (2026-09-30 / 2026-08-17) con `drizzle-orm/node-postgres`, un único pool y un cliente dedicado para `LISTEN`; (b) `postgres` (postgres.js) 3.4.9 para Drizzle y `pg` solo para el checkpointer → dos drivers y dos pools. **Recomiendo (a).**
- **OD-B — Ubicación de las tablas del checkpointer.** Opciones: (a) esquema PostgreSQL dedicado (`schema: "langgraph"`) + `schemaFilter: ["public"]` en drizzle-kit y excepción documentada en ARCHITECTURE §6; (b) en `public` con `tablesFilter` que excluya `checkpoint*`; (c) en `public` sin filtro y prohibir `push`. **Recomiendo (a)**: aísla tablas ajenas al contrato de §6. Quién ejecuta `setup()` (`pnpm db:migrate` o arranque del worker) lo decide la tarea de `persistence`; recomiendo `db:migrate`.
- **OD-C — TypeScript.** ARCHITECTURE §9 dice 5.x, pero `typescript@latest` es 7.0.2 (2026-07-08) y `typescript-eslint@8.72.0` exige `typescript >=4.8.4 <6.1.0`: el criterio "última estable" de TASK-001 instalaría 7.0.2, rompería el peer de typescript-eslint e incumpliría el DoD de TASK-001 ("sin warnings de peer deps"). Opciones: (a) `5.9.3` (2025-09-30, última 5.x, respeta §9); (b) `6.0.3` (requiere cambiar §9); (c) 7.0.2 (incompatible hoy). **Recomiendo (a)**, comunicándolo antes de ejecutar TASK-001.
- **OD-D — Zod 3 vs 4.** Ambas válidas para langgraph/core. Opciones: `zod 4.6.7` (2026-10-12) o `3.25.x`. **Recomiendo 4.6.7**, a fijar en TASK-004 (`core`).
- **OD-E — React y Tailwind para `apps/web`.** Next 16.4.2 admite `react ^18.2 || ^19`. **Recomiendo** `react`/`react-dom 19.3.1` (2026-10-14), `@types/react 19.3.0`, `tailwindcss 4.3.3` + `@tailwindcss/postcss 4.3.3` (2026-07-16), a fijar en la tarea que cree la web.
- **OD-F — Scope.** El índice de ADR-000, SPEC §3 y ARCHITECTURE §4 mencionan OD-001 y quedan fuera del scope de TASK-002. Opciones: ampliar el scope de TASK-002 o delegar a docs-keeper en el cierre. **Recomiendo delegar a docs-keeper en el cierre.**

---

## Anexo A — Texto propuesto para ARCHITECTURE §9 (sustituye la última fila)

```markdown
| Herramienta | Versión | Fijada en |
|---|---|---|
| Node.js | 22 LTS | `.nvmrc`, Dockerfiles |
| pnpm | 9.x | `packageManager` en `package.json` |
| TypeScript | 5.x strict | `tsconfig.base.json` |
| PostgreSQL | 16 | `compose.yaml` |

Dependencias de runtime fijadas por OD-001 (TASK-002, verificadas 2026-10-20). Versión exacta, sin `^`, idéntica en todos los workspaces que la usen.

| Paquete | Versión | Workspace | Razón |
|---|---|---|---|
| `@langchain/langgraph` | `1.5.1` | `orchestrator` | Última estable; orden determinista de escrituras paralelas (1.5.0) y fixes de reanudación de interrupciones (1.5.1) |
| `@langchain/langgraph-checkpoint` | `1.2.0` | `persistence` | Peer del checkpointer y dependencia de langgraph 1.5.1; una sola instancia |
| `@langchain/langgraph-checkpoint-postgres` | `1.1.0` | `persistence` | `PostgresSaver` del mismo release que langgraph 1.5.0 / checkpoint 1.2.0; tablas propias vía `setup()` |
| `@langchain/core` | `1.2.18` | `orchestrator`, `persistence` | Satisface los peers `^1.1.48` / `^1.1.44` |
| `drizzle-orm` | `0.45.4` | `persistence` | Última estable (1.0 sigue en rc) |
| `drizzle-kit` | `0.31.11` | `persistence` (dev) | Pareja estable de drizzle-orm 0.45.x |
| `next` | `16.4.2` | `web` | Última estable; Node ≥20.9, TS ≥5.1; Route Handlers con `ReadableStream` para SSE |

Compatibilidad: peers verificados con `npm view` y release coordinado langgraphjs #2961 (2026-10-12). Subir cualquiera de estas versiones es una tarea propia que vuelve a verificar la compatibilidad.
```

(Si el humano resuelve OD-A/C/D/E en la misma aprobación, se añaden aquí sus filas: `pg`, `@types/pg`, `typescript 5.9.3`, `zod`, `react`, `react-dom`, `tailwindcss`.)

## Anexo B — Cambio propuesto en SPEC §13

```markdown
| OD-001 | ~~Versiones concretas de LangGraph.js, checkpointer PostgreSQL, Drizzle, Next.js~~ **RESUELTA (2026-10-20, TASK-002)**: ver ARCHITECTURE §9 y ADR-002 | architect → humano | M0 (TASK-002) |
```

## Anexo C — Actualización propuesta de ADR-002

- Cabecera: `Estado | Accepted (2026-10-20, OD-001 resuelta en TASK-002)`, **solo con aprobación humana explícita**; si no, se mantiene `Proposed`.
- Decisión, punto 2: "Checkpointer **`PostgresSaver`** (`@langchain/langgraph-checkpoint-postgres`) con `thread_id = runId`…".
- Decisión, punto 4 → sustituir por:

```markdown
4. Versiones fijadas (TASK-002, 2026-10-20): `@langchain/langgraph 1.5.1`, `@langchain/langgraph-checkpoint 1.2.0`, `@langchain/langgraph-checkpoint-postgres 1.1.0`, `@langchain/core 1.2.18`. Tabla completa en ARCHITECTURE §9.
5. `PostgresSaver` recibe el `pg.Pool` de `persistence`; sus tablas (`checkpoints`, `checkpoint_blobs`, `checkpoint_writes`, `checkpoint_migrations`) las crea y migra `setup()` (idempotente), no Drizzle. `run_checkpoints.checkpoint_id` es `text` y enlaza por FK lógico.
```

- Nueva sección antes de "Verificación":

```markdown
## Compatibilidad verificada
- langgraph 1.5.1 depende de `@langchain/langgraph-checkpoint ^1.2.0`; checkpoint-postgres 1.1.0 la exige como peer `^1.2.0`. Release coordinado: https://github.com/langchain-ai/langgraphjs/releases/tag/%40langchain%2Flanggraph-checkpoint-postgres%401.1.0
- Peers `@langchain/core` (`^1.1.48`, `^1.1.44`) satisfechos por 1.2.18. Todos ESM; Node ≥18/≥20.
```
