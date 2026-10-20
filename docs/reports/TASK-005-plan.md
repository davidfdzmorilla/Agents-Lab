# PLAN — TASK-005 · packages/persistence: Drizzle, migración inicial, repositorios base

| Campo | Valor |
|---|---|
| Autor | architect |
| Fecha | 2026-10-20 (revisado el mismo día con las decisiones humanas) |
| Owners de la implementación | devops (pasos 1, 3 y 5) · core-dev (paso 2) · persistence-dev (paso 4) |
| Estado | **Aprobado** con las decisiones humanas de abajo. OD-026…OD-028 resueltas y scope cerrado (2026-10-20, segunda ronda). Sin OPEN DECISIONS pendientes |
| security | REQUIRED |

## Decisiones humanas (2026-10-20, literal)

- "ADR-010: Accepted. Precisión: tsx es devDependency de packages/persistence (sus scripts db:*) y dependencia de runtime solo de apps/worker; ADR-010 lo registra como ampliación de ADR-009 §2, no como contradicción."
- "OD-019 sí, dos fases: instalación con red; servicio `test` solo en la red interna de db."
- "OD-020 sí, loadTestDatabaseUrl() en core."
- "OD-021 sí, la tabla del plan, con la misma condición que en TASK-004: ninguna columna 'por si acaso'; lo que M1 no use, fuera."
- "OD-022 sí: bloqueo de la fila del run + MAX+1. Corregir ARCHITECTURE §3.4 con el SQL probado."
- "OD-023 NO al CHECK en la base: un valor rechazado no debe aparecer en los logs de db. La validación de api_key_env se hace en el repositorio antes del INSERT con la misma regla de OD-017 (importada de core), lanzando un error tipado que no incluye el valor. Test que lo compruebe. Sin deuda."
- "OD-024 sí, esquema `drizzle` para su tabla de control, excepción documentada en §6."
- "OD-025 sí."
- "Scope: aprobada la ampliación y el traslado de drizzle.config.ts a packages/persistence/."
- "Dependencias: aprobadas tal como las listas, con tsx en dev para persistence."
- Riesgos: "make test levanta db y la deja en marcha; se para con make down. Documentado en README." · "Superusuario y alcance del contenedor de test: lo decide security en la verificación; no bloquea el plan." · "Concurrencia de migrador/setup(): pg_advisory_xact_lock alrededor de la migración y de setup() en el servicio migrate. Al DoD." · "TASK-024: añade events.ts a su scope ya." · "Resets de la base de pruebas entre paquetes: los tests de integración corren en serie (un solo runner, fileParallelism: false para *.integration.test.ts); regla en testing-conventions."
- "Plan de TASK-003, decisión 12: sí, nota del architect en su próximo turno."

Segunda ronda (2026-10-20, literal):
- "OD-026: (a). Stage propio para migrate con las devDependencies de persistence, sin ejecutar scripts; security lo revisa en la verificación. Que la imagen de migrate no se reutilice para worker ni web."
- "OD-027: (a). InvalidApiKeyEnvError, code API_KEY_ENV_INVALID, en core."
- "OD-028: (c). 0000_init crea 8 tablas; tool_invocations nace en TASK-030, run_checkpoints en TASK-023, evaluations en TASK-036, cada una con su migración. DoD de TASK-005 pasa a 8; ARCHITECTURE §6 anota en qué tarea nace cada una de las tres. La regla 'lo que M1 no use, fuera' manda sobre un número escrito antes de tenerla."
- "Scope: sí, con index.test.ts, errors.ts y errors.test.ts de core."
- "Sí: ProviderConfigsRepository entra en la lista de repositorios del DoD."

Aplicado en: ADR-010 (Accepted), ADR-000 (índice), ADR-009 («Relacionado»), SPEC §13 (OD-019…OD-028 RESUELTAS), ARCHITECTURE §1, §3.4, §6, §9 y §10, TASKS.md (§TASK-005, §TASK-023, §TASK-030, §TASK-036; lo actualizó el Orchestrator) y este plan. testing-conventions (regla 11) la actualiza docs-keeper.

## Contexto

`packages/persistence` está vacío: `export {};` y un `package.json` sin dependencias ni script `test`. `make test` corre aislado en un contenedor sin red hacia `db`. `turbo.json` no deja pasar `DATABASE_URL_TEST`, porque turbo trabaja en modo estricto. Tampoco hay nada que migre la base en `make up`, el hueco que TASK-003 dejó documentado.

TASK-005 tiene que dejar listos:
- el esquema de las 8 tablas que usa M1 (ARCHITECTURE §6, con la poda de OD-021 y OD-028);
- la migración `0000_init.sql`, que `pnpm db:migrate` aplica y tras la que ejecuta `setup()` de LangGraph sobre `langgraph` (ADR-002), todo bajo `pg_advisory_xact_lock`;
- los repositorios con tests contra PostgreSQL real, incluida la validación de `api_key_env` antes del `INSERT` (OD-023);
- el servicio one-shot `migrate`;
- un `make test` en dos fases que llegue a `db` solo por la red interna de compose.

## Validación del architect fuera del repo (2026-10-20)

Todo lo que sigue se hizo en el scratchpad de la sesión (DEVELOPMENT_WORKFLOW §3, regla 11), con Docker Engine 29.8.2 y Compose v5.5.0 en darwin/arm64. Se usaron las imágenes ya fijadas del repo. No se tocó el repo ni ningún volumen del proyecto, y los contenedores, volúmenes e imágenes de prueba se borraron al terminar.

| # | Prueba | Resultado |
|---|---|---|
| V1 | ARCHITECTURE §3.4 al pie de la letra: `SELECT COALESCE(MAX(seq),0)+1 FROM run_events WHERE run_id=… FOR UPDATE` en `postgres:16.15` | ❌ `ERROR: FOR UPDATE is not allowed with aggregate functions` → OD-022 |
| V2 | `append` con `SELECT 1 FROM runs WHERE id=… FOR UPDATE`, después `INSERT INTO run_events (run_id, seq) SELECT …, COALESCE(MAX(seq),0)+1 FROM run_events WHERE run_id=…`, en la misma transacción. 3 sesiones concurrentes × 200 | ✅ 600 filas, `seq` 1..600 contiguo, 0 errores. Es el SQL que ahora recoge ARCHITECTURE §3.4 |
| V3 | Lo mismo sin bloquear la fila del run | ❌ 122 + 189 + 88 violaciones de `unique(run_id, seq)`. El `unique` funciona como red de seguridad, pero no basta |
| V4 | `claimNext`: `UPDATE runs SET status='running' … WHERE id = (SELECT id … WHERE status='queued' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING id`. 3 sesiones × 25 sobre 50 runs | ✅ 50 reclamados, 0 duplicados (17/17/16) |
| V5 | `CHECK (api_key_env ~ '^[A-Z][A-Z0-9_]*_API_KEY$' AND char_length(api_key_env) <= 40)` | ✅ acepta y rechaza bien, pero el error `DETAIL` incluye el valor rechazado (`Failing row contains (…, sk-or-v1-…)`). **Descartado por OD-023**: sin `CHECK` en la base |
| V6 | `DROP DATABASE IF EXISTS "agentlab_test" WITH (FORCE)` con una sesión abierta en esa base, seguido de `CREATE DATABASE` | ✅ |
| V7 | Compose: `${X:?msg}` en un servicio con `profiles: ["test"]` y después `docker compose up -d db` | ❌ falla con `required variable X is missing a value`. Compose interpola el fichero entero, perfiles inactivos incluidos → `DATABASE_URL_TEST` no puede llevar `:?` en compose sin romper `make up` |
| V8 | Servicio `test` con `${X:-}`, red `backend` (`internal`), `cap_drop: [ALL]` y `no-new-privileges`. `printf … \| docker compose --profile test run --rm -T test bash -c '…'` | ✅ el stdin llega por la tubería, `depends_on: db healthy` arranca `db`, `pg_isready -h db` responde, no hay DNS externo y `: "${X:?msg}"` sale con 1 y el mensaje |
| V9 | Volumen `external: true` inexistente en el servicio `test` y `docker compose up -d db` | ✅ `up` no falla. Solo falla `run test` (`external volume … not found`) |
| V10 | Fase 1 `pnpm fetch` (lockfile actual, imagen node fijada, red por defecto) | ⚠️ **ejecutó el `postinstall` de `esbuild`**: `fetch` ejecuta scripts de ciclo de vida. Con `pnpm fetch --ignore-scripts` no lo hace ✅ |
| V11 | Fase 2: copia filtrada del repo por stdin, imagen `docker/worker.Dockerfile` `--target base` (pnpm 9.15.9 ya activado), `--network <proyecto>_backend`, `--cap-drop ALL`, `COREPACK_ENABLE_NETWORK=0`, store en `:ro` | ✅ sin salida a internet, `pnpm install --offline --frozen-lockfile` en 1,3 s y `pnpm test` (core) en verde |

Inspeccionado, sin ejecutar, en los tarballs de `npm pack` y en los metadatos de `npm view` (2026-10-20):
- `PostgresSaver.setup()` (1.1.0) hace `CREATE SCHEMA IF NOT EXISTS "<schema>"` y aplica sus migraciones una a una. No usa transacción ni bloqueo, y es idempotente por la tabla `checkpoint_migrations`.
- El migrador de `drizzle-orm` 0.45.4 crea por defecto el esquema `drizzle` y la tabla `drizzle.__drizzle_migrations` (`migrationsSchema`/`migrationsTable` configurables). Aplica todas las migraciones pendientes en una transacción, sin bloqueo entre procesos.
- `drizzle-kit` 0.31.11: `Config` acepta `schemaFilter` y admite una configuración sin `dbCredentials`, y `generate` acepta `--name` (`0000_init.sql`). Depende de `tsx ^4.21.0`, `esbuild ^0.25.4`, `@esbuild-kit/esm-loader` (deprecado: *"Merged into tsx"*) y `@drizzle-team/brocli`.
- `drizzle-orm` 0.45.4 pg-core trae `check(name, sql)` y `.for("update", { skipLocked: true })`.

Documentación consultada en la revisión (2026-10-20):
- PostgreSQL 16, §9.27.10: `pg_advisory_xact_lock(bigint)` *"Obtains an exclusive transaction-level advisory lock, waiting if necessary"*; los bloqueos de transacción *"are held until the current transaction ends; there is no provision for manual release"*. https://www.postgresql.org/docs/16/functions-admin.html
- Vitest 5.0.5, `fileParallelism`: por defecto `true`; con `false` limita Vitest a un worker (`maxWorkers: 1`). https://vitest.dev/config/fileparallelism

**No validado:** no he instalado `drizzle-orm`, `drizzle-kit`, `pg` ni `@langchain/*`, ni he probado el bloqueo consultivo con el migrador real. La primera ejecución real de `drizzle-kit generate`, del migrador, de `setup()` y del bloqueo será la del paso 4.

Incidencia de hook, sin rodear: `bash-guard` bloqueó un `cat > compose.yaml` tras `cd $S/compose-probe`, porque resuelve `$S` como ruta relativa al repo. Es un falso positivo. Escribí el fichero de prueba con Write, fuera del repo. Aviso a quien verifique: en esos comandos hay que usar rutas absolutas literales.

## Decisiones (con la alternativa descartada)

1. **`drizzle.config.ts` en `packages/persistence/`, no en la raíz** (traslado aprobado).
   - Contenido: `dialect: "postgresql"`, `schema: "./src/schema/index.ts"`, `out: "./migrations"`, `schemaFilter: ["public"]`, `strict: true`, `verbose: true`. **Sin `dbCredentials`.**
   - Descarto la raíz porque `drizzle-kit` está en `persistence`, la raíz no tiene `tsconfig` ni lint propios (TD-007) y obligaría a `--config ../../drizzle.config.ts`.
   - Sin credenciales, `drizzle-kit push`/`migrate` no pueden tocar ninguna base y el fichero no lee `process.env`.
2. **`pnpm db:migrate` usa el migrador programático de `drizzle-orm`, no `drizzle-kit migrate`.** Orden: bloqueo (decisión 18), `migrate(db, { migrationsFolder })` y `new PostgresSaver(pool, undefined, { schema: "langgraph" }).setup()`. Nunca `saver.end()` (ADR-002 §5).
   - Descarto `drizzle-kit migrate` porque es dependencia de desarrollo, exige `dbCredentials` (es decir, `process.env` fuera de `core`) y no ejecuta `setup()`.
3. **El punto de entrada CLI vive en `packages/persistence/src/cli/` y se ejecuta con `tsx`, que es `devDependency` de `persistence`** (ADR-010, Accepted con la precisión humana). De runtime, `tsx` solo está en `apps/worker`. Consecuencia para la imagen `migrate`: decisión 16 (OD-026 a).
4. **Columnas con nombre explícito en snake_case** (`uuid("project_id")`), sin la opción `casing`. Descarto `casing: "snake_case"` porque obliga a repetirla en `drizzle()` en tiempo de ejecución y a recordarla en cada consulta SQL cruda (claimNext, seq).
5. **Estados de `runs`, roles y tipos de evento como `text` con `CHECK` generado desde `RUN_STATUSES`, `AGENT_ROLES` y `RUN_EVENT_TYPES` de `core`.** Descarto `pgEnum` porque PostgreSQL no permite quitar valores de un enum. Estos `CHECK` no contienen datos sensibles; el de `api_key_env` sí, y por eso no existe (OD-023).
6. **`claimNext` es una sola sentencia** `UPDATE … WHERE id = (SELECT … ORDER BY created_at, id LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *` (V4). La transición `queued → running` es válida por definición. Descarto `SELECT` + `UPDATE` en dos pasos porque necesita una transacción explícita sin aportar nada.
7. **`transition` en una transacción:** `SELECT status … FOR UPDATE`, después `canTransition(from, to)` y luego `UPDATE`. Si no puede, lanza `InvalidTransitionError(from, to)` y la fila queda intacta. Si el destino es terminal, fija `finished_at = now()`.
   - Descarto el compare-and-set `WHERE status = $from`: obliga al llamante a conocer `from` y no distingue «no existe» de «transición inválida».
8. **`heartbeat(runId, workerId)` devuelve `boolean`.** `UPDATE … SET worker_heartbeat_at = now() WHERE id = $1 AND worker_id = $2 AND status = 'running'`, y `false` si el run ya no es suyo. Descarto devolver `void`, porque el worker (TASK-008) no se enteraría de que ha perdido el run.
9. **`seq`: bloqueo de la fila del run y `MAX+1` en la misma transacción** (OD-022, V2; SQL en ARCHITECTURE §3.4). El repositorio añade `type`, `payload` y `RETURNING` al `INSERT … SELECT` probado.
10. **NOTIFY no entra en TASK-005.** Es de TASK-024, cuyo scope ya incluye `src/repositories/events.ts` (decisión humana). TASK-005 deja `append` con la transacción explícita para que TASK-024 meta ahí el `pg_notify`.
11. **`updated_at` lo actualiza el repositorio** (`updated_at = now()` en cada `UPDATE`, más `$onUpdate` de Drizzle), sin triggers. Descarto los triggers porque `drizzle-kit` no los gestiona y habría que añadir una migración `--custom`.
12. **Tests de integración en `src/**/*.integration.test.ts`**, dentro de `rootDir: src` (TD-010; testing-conventions, regla 11; ARCHITECTURE §10 actualizado).
    - Los ficheros de configuración (`drizzle.config.ts`, `vitest.config.ts`) se comprueban con `tsconfig.config.json`, como en `core`.
    - Las migraciones (`migrations/*.sql` y `meta/*.json`) quedan fuera de `src`: no son TypeScript.
    - Descarto `tests/integration/` porque, con `rootDir: src`, `tsc` no lo tipa sin otro tsconfig.
13. **Aislamiento y serie de los tests** (decisión humana sobre R6):
    - `vitest.config.ts` de `persistence`: `include: ["src/**/*.test.ts"]`, **`fileParallelism: false`** y `globalSetup: ["src/testing/global-setup.ts"]`. Un solo runner (el Vitest del paquete) para todos sus `*.integration.test.ts`.
    - `globalSetup` llama a `resetTestDatabase()` una vez por ejecución: `DROP DATABASE … WITH (FORCE)`, `CREATE DATABASE` y `runMigrations`, que incluye `setup()` y el bloqueo.
    - Cada test empieza con `truncateAll(db)`, que hace `TRUNCATE` de las 8 tablas de `public` con `RESTART IDENTITY CASCADE`, tomadas del esquema exportado. No toca `langgraph` ni `drizzle`.
    - Descarto `projects` de Vitest (unitarios en paralelo, integración en serie): `persistence` no tiene unitarios que lo justifiquen. Descarto la transacción por test porque `claimNext` concurrente necesita dos conexiones que vean filas confirmadas.
14. **Guarda de `db:reset`:** se niega a actuar si la base de `DATABASE_URL_TEST` no cumple `^[a-z_][a-z0-9_]*_test$`, y lanza `EnvValidationError` con un mensaje sin la URL. Así impide borrar `agentlab` por un `.env` mal escrito. Se conecta a la base de mantenimiento `postgres` del mismo servidor (`POSTGRES_DB: postgres` en compose).
15. **`make test` y `make validate` en dos fases** (OD-019, V7–V11):
    - **Fase 1:** `pnpm fetch --ignore-scripts`, con internet y sin `db`, sin ejecutar código de paquetes.
    - **Fase 2:** `docker compose --profile test run --rm -T --build test`, con la imagen `base` de `docker/worker.Dockerfile`, solo la red `backend` (sin internet), `cap_drop: [ALL]`, `no-new-privileges` y el store `:ro`. Ejecuta `pnpm install --offline` y después los tests contra `db`.
    - `make test` deja `db` en marcha; se para con `make down`. Lo documenta TASK-009 (README).
16. **Imagen de `migrate`: stage propio, no reutilizable** (OD-026 a, decidida). Stages `migrate-deps` y `migrate` dentro de `docker/worker.Dockerfile`, que parten de `base`. `worker` pasa a declarar `target: runtime`.
    - Como `tsx` es `devDependency` de `persistence` (ADR-010), `migrate` no puede instalar con `--prod`, y el stage `deps` actual solo tiene en el store lo de producción (`pnpm fetch --prod`). `migrate-deps` hace su propio `pnpm fetch --ignore-scripts` (sin `--prod`) e instala `--offline --frozen-lockfile --ignore-scripts --filter @agentlab/persistence...` sin `--prod`. **Ni `fetch` ni `install` ejecutan scripts.** Entran en la imagen `drizzle-kit`, `@types/pg` y `tsx` (más `esbuild` 0.25 y 0.28).
    - **No se reutiliza para `worker` ni `web`:** ningún servicio de compose salvo `migrate` declara `target: migrate` ni `migrate-deps`, y ningún stage hace `FROM migrate*` ni `COPY --from=migrate*`. `runtime` sigue saliendo de `deps` (`--prod`). El servicio `test` usa `base`, no `migrate`.
    - Descarto un `docker/migrate.Dockerfile` aparte porque duplicaría el digest de Node.
    - Descarto reutilizar la imagen `runtime` del worker: no contiene `persistence` mientras el worker no dependa de él, y TD-015 (TASK-008) le quitará pnpm.
17. **Sin umbral de cobertura en `persistence`.** El DoD no lo fija (testing-conventions, regla 7: «objetivos por paquete en el DoD»). Se informa del porcentaje.
18. **`runMigrations` serializa migración y `setup()` con `pg_advisory_xact_lock`** (decisión humana, al DoD).
    - Toma un cliente dedicado del pool, abre `BEGIN` y ejecuta `SELECT pg_advisory_xact_lock($1)` con una clave `bigint` constante del módulo (no exportada; comentario con el motivo). Con el bloqueo tomado, ejecuta `migrate()` y `setupCheckpointer()` sobre **otras** conexiones del pool, y después hace `COMMIT` (o `ROLLBACK` si falla) en el cliente del bloqueo. Lo suelta siempre en `finally`.
    - Las migraciones no corren en el cliente del bloqueo porque el migrador de Drizzle abre su propia transacción: un `BEGIN` anidado en la misma conexión haría que su `COMMIT` soltara el bloqueo antes de tiempo.
    - Requisito: el pool necesita `max ≥ 2`. `createPool` usa el valor por defecto de `pg` (10).
    - Lo usan el CLI `db:migrate` (servicio `migrate`) y `resetTestDatabase`, así que también protege los resets.
    - Descarto `pg_advisory_lock` de sesión: lo fijó el humano y, además, el de transacción se suelta solo con el `COMMIT`/`ROLLBACK`, sin un `pg_advisory_unlock` que se pueda olvidar en un camino de error ni quedar retenido en una conexión devuelta al pool.
19. **`api_key_env` se valida en `ProviderConfigsRepository.create`, antes de cualquier consulta** (OD-023; sin `CHECK` y sin deuda).
    - Regla: `isApiKeyEnvName(name)` de `core` (la expresión de OD-017, `^[A-Z][A-Z0-9_]*_API_KEY$`) **y** `name.length <= 40` (el límite que fija el DoD). `null` se acepta (Ollama no tiene clave).
    - Si no se cumple, lanza `InvalidApiKeyEnvError` de `core` (`code: "API_KEY_ENV_INVALID"`, OD-027 a). Su mensaje es fijo («`provider_configs.api_key_env must name an environment variable matching ^[A-Z][A-Z0-9_]*_API_KEY$ (max 40 characters)`»): sin el valor y sin `cause`.
    - **Hoy `core` no exporta la regla.** `SECRET_NAME` es una constante privada del módulo (`packages/core/src/env.ts:53`). El paso 2 (core-dev) exporta `isApiKeyEnvName` y hace que `createSecretResolver` la use, sin cambiar su comportamiento.
    - El repositorio es el único camino de escritura de `provider_configs` en código de producción (lo vigila el reviewer). Los tests no insertan en `provider_configs` con Drizzle directo.
    - El límite de 40 vive en `persistence` y no en `core`: añadirlo a `isApiKeyEnvName` cambiaría la regla de OD-017, que el humano decidió sin él.
    - Descarto exportar el `RegExp` en vez de una función: una función no expone un objeto mutable (`lastIndex`) y deja la regla en un solo sitio.
20. **Poda de OD-021 («lo que M1 no use, fuera»)**, recogida en ARCHITECTURE §6:
    - No hay columnas fuera de §6: la tabla de OD-021 solo daba tipos, nulabilidad y FK a las columnas de §6.
    - Sale de `0000_init` `team_definitions.coordination`: es de M4 (TASK-034) y `TeamDefinition` de `core` ya no la tiene (TASK-004, OD-014).
    - Salen las restricciones e índices que había añadido sin consumidor en M1: `CHECK (seq >= 1)`, `UNIQUE (run_id, checkpoint_id)` e índices en todas las FK. Solo quedan `runs (status, created_at)`, `unique (run_id, seq)` y los de `project_id` en `provider_configs` y `agent_definitions`.
    - `DEFAULT` solo en `id`, `created_at`, `updated_at`, `runs.status` (`'queued'`), `runs.cancel_requested` (`false`) y `run_events.ts` (`now()`), que son las columnas que `create`/`append` no reciben, y en los cuatro que fija la tabla de OD-021: `agent_definitions.tool_allowlist` (`'{}'`), `agent_definitions.enabled` (`true`), `agent_invocations.attempt` (`1`) y `tasks.depends_on` (`'{}'`). El resto lo aporta quien escribe, con los tipos de `core`.
    - Se mantienen `tasks.parent_task_id` y `tasks.depends_on`: SPEC §4.3 prevé subtareas y etapas encadenadas en el flujo de M1.
    - `tool_invocations`, `run_checkpoints` y `evaluations` **no están en `0000_init`** (OD-028 c): nacen en TASK-030, TASK-023 y TASK-036, cada una con su migración. `0000_init` crea 8 tablas: `projects`, `provider_configs`, `agent_definitions`, `team_definitions`, `runs`, `tasks`, `agent_invocations` y `run_events`.

## Scope (aprobado y cerrado)

Scope de TASKS.md §TASK-005: `packages/persistence/**` (con `drizzle.config.ts`), `turbo.json`, `Makefile`, `compose.yaml`, `.env.example`, `package.json` (raíz), `pnpm-lock.yaml`, `docker/worker.Dockerfile`, `packages/core/src/env.ts`, `packages/core/src/env.test.ts`, `packages/core/src/index.test.ts`, `packages/core/src/errors.ts`, `packages/core/src/errors.test.ts`. Reparto por fichero:

| Ruta | Owner | Paso |
|---|---|---|
| `packages/persistence/package.json`, `pnpm-lock.yaml`, `package.json` (raíz) | devops | 1 |
| `packages/core/src/env.ts`, `packages/core/src/env.test.ts`, `packages/core/src/errors.ts`, `packages/core/src/errors.test.ts`, `packages/core/src/index.test.ts` | core-dev | 2 |
| `turbo.json`, `compose.yaml` (servicio `test`), `Makefile`, `.env.example` | devops | 3 |
| `packages/persistence/**` salvo `package.json` | persistence-dev | 4 |
| `docker/worker.Dockerfile`, `compose.yaml` (servicio `migrate`, `worker`, `web`) | devops | 5 |

Los dos huecos de la ronda anterior quedan cubiertos por la ampliación aprobada: `index.test.ts` (el test «public API» compara `Object.keys(core)` con una lista cerrada y necesita `loadTestDatabaseUrl`, `isApiKeyEnvName` e `InvalidApiKeyEnvError`) y `errors.ts`/`errors.test.ts` (OD-027 a). Todos los ficheros que cita este plan están en el scope de TASKS.md §TASK-005.

No hace falta tocar: `apps/worker/**`, `.dockerignore` (ya excluye `.env*`, `docs` y `.claude`, y las migraciones entran en la imagen), `.gitignore` ni `docker/postgres/init.sql`. `.prettierignore` no lo puede editar ningún rol: la exclusión de `migrations/meta/**` va como patrón negado en los scripts `format` de la raíz (paso 1).

## Dependencias (aprobadas; `deps_allowed`)

Verificadas con `npm view` el 2026-10-20. Versión exacta, sin `^`. Coinciden con ARCHITECTURE §9.

| Paquete | Versión | Dónde | Peers y engines |
|---|---|---|---|
| `drizzle-orm` | `0.45.4` | `packages/persistence` · `dependencies` | Peers opcionales `pg >=8` y `@types/pg *` ✅. Sin `engines` |
| `pg` | `8.23.1` | `packages/persistence` · `dependencies` | `node >=16` ✅ |
| `@langchain/langgraph-checkpoint-postgres` | `1.1.0` | `packages/persistence` · `dependencies` | Peers `@langchain/core ^1.1.44` y `@langchain/langgraph-checkpoint ^1.2.0` ✅. Depende de `pg ^8.12.0` → 8.23.1. `node >=18` |
| `@langchain/langgraph-checkpoint` | `1.2.0` | `packages/persistence` · `dependencies` (peer obligatorio) | Peer `@langchain/core ^1.1.48` ✅. `node >=18` |
| `@langchain/core` | `1.2.18` | `packages/persistence` · `dependencies` (peer obligatorio) | `node >=20` ✅. Depende de `zod ^3.25.76 \|\| ^4` → 4.6.7 ya en el lockfile. Trae `langsmith`, `js-tiktoken`, `p-queue`, `mustache` y `@cfworker/json-schema`. `1.2.19` salió el 2026-10-20; ARCHITECTURE §9 fija 1.2.18 y subirla es otra tarea |
| `drizzle-kit` | `0.31.11` | `packages/persistence` · `devDependencies` | Sin peers ni engines. Transitivas: `esbuild 0.25.12`, `@esbuild-kit/esm-loader` (deprecado) y `tsx ^4.21.0` (resuelve a 4.23.15) |
| `@types/pg` | `8.23.1` | `packages/persistence` · `devDependencies` | — |
| `tsx` | `4.23.15` | `packages/persistence` · **`devDependencies`** | ADR-010 (Accepted). Ya está en el lockfile por `apps/worker` |
| `@agentlab/core` | `workspace:*` | `packages/persistence` · `dependencies` | No es externa. Cambia el lockfile |

- Sin `zod` directo: `persistence` usa los esquemas que exporta `core`.
- Engines: todo es compatible con `>=22.12 <23`.
- El host tiene Node 26 y `engine-strict`, así que devops instala dentro del contenedor node fijado (técnica de TASK-003), con `pnpm --filter @agentlab/persistence add … --save-exact` y `add -D … --save-exact` para las tres de desarrollo.
- Después: `pnpm audit --prod`, `pnpm why @langchain/core` y `pnpm why zod` (una sola instancia), `pnpm why tsx` (una sola versión) y `pnpm --filter @agentlab/persistence list --prod` (sin `tsx`).

## Pasos (en orden, con owner)

0. **Orchestrator / humano.** Hecho: ADR-010 aceptado, OD-019…OD-028 decididas, scope (con `index.test.ts`, `errors.ts` y `errors.test.ts` de `core`) y `deps_allowed` aprobados. Nada pendiente.
1. **devops: dependencias y scripts.** → `packages/persistence/package.json`, `pnpm-lock.yaml`, `package.json`
   - Instalar en el contenedor las dependencias de la tabla (`tsx` con `-D`).
   - `packages/persistence/package.json`:
     - `exports`: `{ ".": "./src/index.ts", "./testing": "./src/testing/index.ts" }`.
     - Scripts: `typecheck: tsc --noEmit && tsc --noEmit -p tsconfig.config.json`, `lint: eslint .`, `test: vitest run --coverage`, `db:generate: drizzle-kit generate`, `db:migrate: tsx src/cli/migrate.ts`, `db:reset: tsx src/cli/reset.ts`.
   - Raíz: `db:generate`, `db:migrate` y `db:reset` delegando con `pnpm --filter @agentlab/persistence`. `format`/`format:check` con `"!packages/persistence/migrations/meta/**"`.
2. **core-dev.** → `packages/core/src/env.ts`, `packages/core/src/env.test.ts`, `packages/core/src/errors.ts`, `packages/core/src/errors.test.ts`, `packages/core/src/index.test.ts`
   - `export function loadTestDatabaseUrl(source: EnvSource = process.env): string` (OD-020). Valida con el mismo `postgresUrl()`, sin valor por defecto (OD-018). Si falta, lanza `EnvValidationError("DATABASE_URL_TEST is required for integration tests and db:reset (cp .env.example .env)")`. Si es inválida, el mensaje nunca incluye la URL.
   - `export function isApiKeyEnvName(name: string): boolean`: `SECRET_NAME.test(name)`. `createSecretResolver` pasa a usarla. Comportamiento idéntico: los tests existentes del resolver siguen en verde sin tocarlos.
   - `errors.ts` (OD-027 a): `"API_KEY_ENV_INVALID"` se añade a la unión `AgentLabErrorCode` (amplía la lista de OD-016) y `export class InvalidApiKeyEnvError extends AgentLabError` con `code: "API_KEY_ENV_INVALID"`, `retryable: false`, el mensaje fijo de la decisión 19 y **constructor sin parámetros** (ni valor ni `cause`): no hay forma de meter el valor rechazado en el error.
   - Tests: `loadTestDatabaseUrl` presente, ausente, vacía e inválida (sin la URL en el mensaje). `isApiKeyEnvName`: acepta `OPENROUTER_API_KEY` y rechaza `sk-…`, `AIza…`, minúsculas, `""` y un nombre sin el sufijo. `errors.test.ts`: `InvalidApiKeyEnvError` es `instanceof AgentLabError`, `code`, `retryable: false`, `name` y mensaje fijo; sin `cause`. `index.test.ts` con las tres exportaciones nuevas (`loadTestDatabaseUrl`, `isApiKeyEnvName`, `InvalidApiKeyEnvError`). Cobertura de `core` ≥ 90 %.
3. **devops: infraestructura de tests (antes del paso 4).** → `turbo.json`, `compose.yaml`, `Makefile`, `.env.example`
   - `turbo.json`: `"test": { …, "passThroughEnv": ["DATABASE_URL_TEST"] }`.
   - `compose.yaml`, servicio `test`:
     - `profiles: ["test"]`;
     - `build: { context: ., dockerfile: docker/worker.Dockerfile, target: base }`;
     - `cap_drop: [ALL]`, `security_opt: ["no-new-privileges:true"]`;
     - `networks: [backend]` (solo la interna);
     - `depends_on: { db: { condition: service_healthy } }`;
     - `working_dir: /work`;
     - `environment`: `DATABASE_URL_TEST: ${DATABASE_URL_TEST:-}` (**no `:?`**, V7), `npm_config_store_dir: /pnpm-store`, `COREPACK_ENABLE_NETWORK: "0"`, `TURBO_TELEMETRY_DISABLED: "1"`;
     - `volumes`: `pnpm-store:/pnpm-store:ro` y `validate-node-modules:/work/node_modules`.

     Volúmenes de nivel superior con `external: true` y `name:` `agentlab-pnpm-store` / `agentlab-validate-node-modules`, que `make` ya crea. Comentario en inglés: `# DATABASE_URL_TEST cannot use :? here: compose interpolates every service, so it would break make up`.
   - `Makefile`:
     - `FETCH := … pnpm fetch --ignore-scripts`, con solo `pnpm-lock.yaml`, `pnpm-workspace.yaml` y `.npmrc` en el tar.
     - `IN_TEST := : "$${DATABASE_URL_TEST:?DATABASE_URL_TEST is required for make test (cp .env.example .env)}" && mkdir -p /work && tar -C /work --no-same-owner -xf - && pnpm install --offline --frozen-lockfile`.
     - `test:` crea los volúmenes y ejecuta `set -o pipefail; <tar lock> | $(DOCKER_NODE) '$(FETCH)'` y después `set -o pipefail; $(HOST_TAR) | docker compose --profile test run --rm -T --build test bash -euo pipefail -c '$(IN_TEST) && pnpm test'`.
     - `validate:` hace lo mismo, con `pnpm -r typecheck && pnpm -r lint && pnpm test && pnpm format:check`.
     - Cambia el texto `##` de `test` («Tests en contenedor contra db de compose (requiere .env; deja db en marcha, make down la para)»).
     - `down`/`logs`/`ps` no cambian: el servicio usa `:-` y no necesita relleno.
   - `.env.example:9`: `DATABASE_URL_TEST=                # obligatoria para make test; postgresql://agentlab:<pw>@db:5432/agentlab_test (solo la recibe el servicio test de compose; nunca web, worker ni migrate)`.
4. **persistence-dev.** → `packages/persistence/**` (salvo `package.json`)

   Ficheros:
   - `tsconfig.config.json` (`include: ["drizzle.config.ts", "vitest.config.ts"]`), `vitest.config.ts` (decisión 13) y `drizzle.config.ts` (decisión 1).
   - `src/schema/*.ts`, una tabla por fichero, más `src/schema/index.ts`: **8 tablas** (`projects`, `provider-configs`, `agent-definitions`, `team-definitions`, `runs`, `tasks`, `agent-invocations`, `run-events`; ARCHITECTURE §6 y decisión 20). Sin ficheros ni tablas para `tool_invocations`, `run_checkpoints` ni `evaluations` (OD-028 c).
   - `migrations/0000_init.sql` y `migrations/meta/*`, generados con `pnpm --filter @agentlab/persistence exec drizzle-kit generate --name init` **y no editados a mano**.
   - `src/pool.ts`: `createPool` y `createDatabase`.
   - `src/checkpointer/setup.ts`: `CHECKPOINT_SCHEMA` y `setupCheckpointer`.
   - `src/migrate.ts`: `runMigrations` con el bloqueo de la decisión 18; dentro, Drizzle y después `setupCheckpointer`.
   - `src/repositories/{runs,events,projects,agent-definitions,provider-configs}.ts`. `ProviderConfigsRepository` (`create`/`get`/`listByProject`) está en el DoD y es el único camino de escritura de `provider_configs`; valida `api_key_env` antes de cualquier consulta y lanza `InvalidApiKeyEnvError` (decisión 19).
   - `src/cli/migrate.ts`: `loadEnv()`, `createPool`, `runMigrations` y `pool.end()`. Log en una línea JSON con `process.stdout.write`, por el precedente de OD-H. Si falla, `process.exitCode = 1` con `name`/`code`/`message` del error y nunca la URL ni el objeto `Env` (TD-011).
   - `src/cli/reset.ts`: `loadTestDatabaseUrl()` y `resetTestDatabase()`.
   - `src/testing/index.ts`: `resetTestDatabase`, `truncateAll`, `createTestDatabase`.
   - `src/testing/global-setup.ts`.
   - `src/index.ts` y los tests `src/**/*.integration.test.ts` (ver «Tests»).

   Reglas:
   - Sin `console.*`. Sin `process.env` (lo lee `core`). Sin estado de módulo mutable: todo se construye con funciones que reciben `pool`/`db`.
   - Sin `CHECK` sobre `api_key_env` en el esquema ni en la migración.
   - Si `drizzle-kit` no resuelve los imports `.js` → `.ts` del esquema o el `@agentlab/core` del workspace (R3), para y lo reporta.
5. **devops: servicio `migrate` (después del paso 4, que crea `db:migrate`).** → `docker/worker.Dockerfile`, `compose.yaml`
   - Dockerfile (OD-026 a), stage `migrate-deps`: `FROM base`, `COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./`, `RUN pnpm fetch --ignore-scripts`, `COPY . .`, `RUN pnpm install --offline --frozen-lockfile --ignore-scripts --filter @agentlab/persistence...` (sin `--prod`: `tsx` es dev, ADR-010; `--ignore-scripts` en las dos órdenes, DoD).
   - Dockerfile, stage `migrate`: `FROM base`, `ENV NODE_ENV=production COREPACK_ENABLE_NETWORK=0`, `COPY --from=migrate-deps /app /app`, `USER node`, `WORKDIR /app`, `CMD ["pnpm", "db:migrate"]`.
   - Comprobar en la imagen que solo están `persistence`, `core` y sus dependencias (`pnpm -r list --depth 0`): si aparecen las `devDependencies` de la raíz (`turbo`, `vitest`, `eslint`…), parar y reportarlo.
   - Comprobar que `tsx` (y por tanto `esbuild`) funciona en la imagen instalada con `--ignore-scripts`: `docker compose run --rm migrate` aplica las migraciones. Si `esbuild` exige su `postinstall`, parar y reportarlo; **no** se quita `--ignore-scripts` ni se añade `pnpm rebuild` sin decisión humana (R17).
   - No reutilización (OD-026): `grep -n "target:" compose.yaml` → `migrate` solo en el servicio `migrate`; `grep -nE "FROM migrate|--from=migrate" docker/worker.Dockerfile` → solo el `COPY --from=migrate-deps` del stage `migrate`.
   - Los stages `migrate*` van **antes** de `runtime` y además se declara `target: runtime` en `worker`: Docker construye por defecto la última etapa.
   - Servicio `migrate`:
     - `build: { context: ., dockerfile: docker/worker.Dockerfile, target: migrate }`;
     - `networks: [backend]` (sin internet);
     - `depends_on: { db: { condition: service_healthy } }`;
     - `environment: { DATABASE_URL: ${DATABASE_URL:?set it in .env (cp .env.example .env)} }`, y solo esa variable;
     - sin `restart`.
   - `worker`: `build.target: runtime` y `depends_on` con `db: service_healthy` y `migrate: service_completed_successfully`. Lo mismo en `web`, que sigue con perfil.
   - Se quitan los dos comentarios `# TASK-005 adds a one-shot "migrate" service…`.
6. **tester → reviewer → security.** Ver «Tests». security decide además sobre el superusuario y el alcance del contenedor de test (R5) y revisa la imagen `migrate` (decisión humana de OD-026: `devDependencies` de `persistence`, `--ignore-scripts` y que no se reutilice).

## Contratos públicos nuevos

```ts
// @agentlab/persistence
export function createPool(connectionString: string, options?: { max?: number }): pg.Pool;
export type Database = NodePgDatabase<typeof schema>;
export function createDatabase(pool: pg.Pool): Database;
export const CHECKPOINT_SCHEMA = "langgraph";
export function runMigrations(pool: pg.Pool, options?: { migrationsFolder?: string }): Promise<void>; // pg_advisory_xact_lock; pool max >= 2
export * from "./schema/index.js";            // tables + inferred row types (Run, RunEventRow, Project, AgentDefinitionRow, ProviderConfigRow, …)

export interface RunsRepository {
  create(input: { projectId: string; teamId: string; request: RunRequest; budget: Budget }): Promise<Run>; // status queued
  get(id: string): Promise<Run | null>;
  claimNext(workerId: string): Promise<Run | null>;          // FOR UPDATE SKIP LOCKED
  transition(id: string, to: RunStatus): Promise<Run | null>; // throws InvalidTransitionError; null = not found (OD-025)
  heartbeat(id: string, workerId: string): Promise<boolean>;
}
export function createRunsRepository(db: Database): RunsRepository;

export type NewRunEvent = DistributiveOmit<RunEvent, "runId" | "seq" | "ts">;
export interface EventsRepository {
  append(runId: string, event: NewRunEvent): Promise<RunEvent>;   // seq: lock run row + MAX+1 (OD-022), validated with RunEventSchema
  listSince(runId: string, seq: number): Promise<RunEvent[]>;     // seq > n, ORDER BY seq ASC
}
export function createEventsRepository(db: Database): EventsRepository;

export interface ProjectsRepository { create(i): Promise<Project>; get(id): Promise<Project | null>; list(): Promise<Project[]>; }        // OD-025
export interface AgentDefinitionsRepository { create(i): Promise<AgentDefinitionRow>; get(id): Promise<AgentDefinitionRow | null>; listByProject(projectId): Promise<AgentDefinitionRow[]>; } // OD-025
export interface ProviderConfigsRepository {                       // OD-023, OD-025
  create(i: { projectId: string; providerType: string; baseUrl: string | null; defaultModel: string; apiKeyEnv: string | null }): Promise<ProviderConfigRow>; // validates apiKeyEnv before any query
  get(id: string): Promise<ProviderConfigRow | null>;
  listByProject(projectId: string): Promise<ProviderConfigRow[]>;
}
export function createProviderConfigsRepository(db: Database): ProviderConfigsRepository;

// @agentlab/persistence/testing
export function resetTestDatabase(testUrl: string): Promise<void>;  // guard *_test, DROP … WITH (FORCE), CREATE, runMigrations
export function truncateAll(db: Database): Promise<void>;

// @agentlab/core
export function loadTestDatabaseUrl(source?: EnvSource): string;     // OD-020
export function isApiKeyEnvName(name: string): boolean;              // OD-017 rule, reused by createSecretResolver and persistence
export type AgentLabErrorCode = … | "API_KEY_ENV_INVALID";          // OD-027 extends the OD-016 list
export class InvalidApiKeyEnvError extends AgentLabError { constructor(); } // OD-027 (a); code "API_KEY_ENV_INVALID", retryable false, fixed message, no value/cause
```

- Fábricas `create*`, coherentes con `createSecretResolver` de `core`. Sin clases ni singletons en `persistence`.
- Variables: `DATABASE_URL_TEST` solo la reciben el servicio `test` y turbo (`passThroughEnv`).
- Servicios de compose: `migrate` (one-shot) y `test` (perfil `test`).
- Esquemas PostgreSQL de la base: `public` (Drizzle), `langgraph` (`setup()`) y `drizzle` (control de migraciones, OD-024).

## Tests

Persistence (tester y persistence-dev). Todos en `src/**/*.integration.test.ts`, en serie, contra `agentlab_test` real y con valores ficticios.

| Qué | Cómo |
|---|---|
| Migración | Tras `resetTestDatabase`, `information_schema.tables` da **exactamente las 8 tablas** en `public` (ninguna de `tool_invocations`, `run_checkpoints`, `evaluations`; OD-028) y las 4 del checkpointer en `langgraph`. `runMigrations` dos veces seguidas no falla. `0000_init.sql` no contiene `langgraph` ni `CHECK` sobre `api_key_env`, ni la columna `coordination`. `unique(run_id, seq)` e índice `(status, created_at)` presentes en `pg_indexes` |
| Bloqueo de migración | En `agentlab_test`, `DROP SCHEMA public, drizzle, langgraph CASCADE` y `CREATE SCHEMA public`. Después, `Promise.all([runMigrations(poolA), runMigrations(poolB)])` con dos pools distintos → las dos resuelven, quedan 8 tablas en `public`, 4 en `langgraph` y **una** fila en `drizzle.__drizzle_migrations`. Al terminar, `pg_locks` no muestra bloqueos consultivos retenidos |
| Drizzle no toca `langgraph` | `pnpm --filter @agentlab/persistence db:generate` tras la migración → «No schema changes» y `git status` limpio. `drizzle.config.ts` contiene `schemaFilter: ["public"]` |
| `transition` | Tabla exhaustiva 7×7 (testing-conventions, regla 8). Válidas: cambia el estado, `finished_at` solo en terminales. Inválidas: `InvalidTransitionError` con `from`/`to` y `code: "INVALID_TRANSITION"`, y la fila sin cambios. Id inexistente → `null` |
| `claimNext` | (1) Un run `queued` y `Promise.all([claimNext("w1"), claimNext("w2")])` con un pool de 2 o más → exactamente uno no nulo. (2) N runs y 2N llamadas concurrentes → N ids distintos. (3) Determinista: el cliente A bloquea la fila (`FOR UPDATE` en una transacción abierta) y `claimNext` desde B devuelve `null` sin bloquearse. Además, orden por `created_at` |
| `heartbeat` | `true` para su worker, que actualiza `worker_heartbeat_at`. `false` para otro worker o si el run no está `running` |
| `append`/`listSince` | 50 `append` concurrentes en un run → `seq` 1..50 contiguo. Dos runs intercalados tienen secuencias independientes. `listSince(run, 10)` devuelve 11..50 en orden. Un payload que no cumple `RunEventSchema` se rechaza sin insertar |
| `api_key_env` (OD-023) | `ProviderConfigsRepository.create` con `sk-test-<canario>`, `AIzaTest<canario>` y un nombre de 41+ caracteres sin espacios (`A…_API_KEY`) → lanza `InvalidApiKeyEnvError` (`code: "API_KEY_ENV_INVALID"`) y **ninguna fila** en `provider_configs`. El canario no aparece en `message`, `stack`, `cause` ni en `JSON.stringify(error)`. `OPENROUTER_API_KEY` y `null` se aceptan. Un espía sin sustituir la implementación (`vi.spyOn(pool, "query")`, no un mock del ORM) prueba que con un valor rechazado no se envía ninguna consulta |
| `get` inexistente | `get` de los cuatro repositorios con un uuid aleatorio → `null` (OD-025) |
| Sin `DATABASE_URL_TEST` | `pnpm --filter @agentlab/persistence test` sin la variable → exit ≠ 0 y el mensaje de `loadTestDatabaseUrl`. Ningún test aparece como *skipped* |
| Guarda de reset | `resetTestDatabase` con una URL a `…/agentlab` → `EnvValidationError` y la base intacta |

Infraestructura (tester; credenciales desechables en línea y nunca `.env` del repo):
- `make test` con `POSTGRES_PASSWORD`/`DATABASE_URL`/`DATABASE_URL_TEST` desechables → exit 0. `persistence` y `core` en verde. Después, `docker compose ps` muestra `db` en marcha; `make down` la para.
- Sin `DATABASE_URL_TEST` → exit ≠ 0 con el mensaje `:?`.
- Con `DATABASE_URL_TEST=…@localhost:5432/agentlab_test` y el override activo (5432 publicado en el host) → falla con ECONNREFUSED, lo que prueba que no llega al host.
- `docker inspect` del contenedor de test durante la ejecución: solo `agentlab_backend`.
- `grep -n DATABASE_URL_TEST compose.yaml` → solo en el servicio `test`. `web`, `worker` y `migrate` no la tienen.
- `make up` con `.env` desechable sin `DATABASE_URL_TEST` sigue funcionando (V7).
- `docker compose up --build -d` → `migrate` sale con 0 (`docker compose ps -a`) y después arranca `worker`. Un `up` repetido es idempotente.
- `\dn` en `agentlab` muestra `public`, `langgraph` y `drizzle`. `migrate` con `DATABASE_URL` mal → `worker` no arranca.
- OD-023 manual: tras los tests, `docker compose logs db | grep -c <canario>` → `0`.
- Centinela de TASK-003 repetido: `node_modules` del host intacto tras `make test`/`make validate`.
- **Regla 10 (macOS y Linux):** `make test`/`make validate` en macOS (make 3.81) y, en el contenedor Linux, `make -n test validate` con GNU make más `bash -n` de las recetas expandidas, como en TASK-003-fix-1. Salida literal en el informe.
- `pnpm audit --prod`, `pnpm why tsx|zod|@langchain/core` (una sola versión), `pnpm --filter @agentlab/persistence list --prod` (sin `tsx`) y `list --dev` (con `tsx 4.23.15`).

## Riesgos

- **R1.** ~~Concurrencia de migrador y `setup()`~~ Resuelto: `pg_advisory_xact_lock` en `runMigrations` (decisión 18, al DoD). Queda el requisito de `max ≥ 2` en el pool: con `max: 1`, `runMigrations` se quedaría esperando una conexión para siempre. `createPool` no lo baja; el CLI y `resetTestDatabase` usan el valor por defecto.
- **R2.** La fase 2 corre como root sin capacidades, como hoy. Escribe en el volumen `agentlab-validate-node-modules` (TD-017).
- **R3.** `drizzle-kit` tiene que cargar `src/schema/*.ts` con imports `.js` y el `@agentlab/core` del workspace. 0.31.11 depende de `tsx`, así que debería funcionar, pero no lo he podido validar. Si falla, persistence-dev para y lo reporta.
- **R4.** ~~Fuga del valor en el `CHECK`~~ Desaparece con OD-023. Riesgo residual: un `INSERT` directo con Drizzle en `provider_configs` se salta la validación. Mitigación: el repositorio es el único camino de escritura (decisión 19), y lo vigila el reviewer.
- **R5.** El contenedor de test se conecta como **superusuario** (TD-013) y desde `backend` alcanza también la base `agentlab` de desarrollo. Con el perfil `local` activo, alcanza además `ollama`, que tiene salida a internet. **Lo decide security en la verificación** (decisión humana); no bloquea el plan.
- **R6.** ~~Resets concurrentes entre paquetes~~ Decidido: los `*.integration.test.ts` corren en serie con un solo runner (testing-conventions, regla 11). En TASK-005 solo `persistence` tiene tests de integración. La primera tarea que añada tests de integración en un segundo paquete (TASK-007 o TASK-014, «tests de handler contra PostgreSQL») tiene que cumplir el «un solo runner» entre paquetes: turbo ejecuta los `test` de paquetes distintos en paralelo.
- **R7.** Con `passThroughEnv`, turbo puede devolver de caché un `test` en el host sin tocar la base. En el contenedor no pasa, porque `.turbo` se excluye y el contenedor es efímero.
- **R8.** `@langchain/core` trae `langsmith`. El contenedor `migrate` solo recibe `DATABASE_URL`, así que el trazado queda desactivado por defecto. El riesgo de ADR-002 sigue para TASK-013, y security revisa.
- **R9.** ~~Scope de TASK-024~~ Resuelto: TASKS.md ya incluye `src/repositories/events.ts` en TASK-024.
- **R10.** Decidido: `make test`/`make validate` necesitan `.env` y dejan `db` en marcha; `make down` la para. TASK-009 lo documenta en el README.
- **R11.** Store `:ro` en la fase 2: funciona con el lockfile actual (V11). Una dependencia futura que necesite escribir la *side-effects cache* podría fallar. Si pasa, se quita `:ro` y se registra en TD-017.
- **R12.** `pnpm fetch` sin `--ignore-scripts` ejecuta los `postinstall` con internet (V10). La bandera es obligatoria en la fase 1 y en `migrate-deps`.
- **R13.** TASK-008 (TD-015) reescribirá `runtime` en `docker/worker.Dockerfile` y tiene que conservar los stages `base` y `migrate*`.
- **R14.** Primera validación real de las dependencias en el paso 1. Si `pnpm install` da avisos de peers, devops para. El aviso de `@esbuild-kit/esm-loader` deprecado es esperable y no es de peers.
- **R15.** `bash-guard` da un falso positivo con `cd $VAR/…` seguido de una redirección. Quien verifique debe usar rutas absolutas literales.
- **R16.** La imagen `migrate` crece con las `devDependencies` de `persistence` (OD-026 a, decidida): `drizzle-kit`, dos `esbuild` nativos y un paquete deprecado. No reciben más que `DATABASE_URL` y no tienen internet, pero amplían la superficie. Lo revisa security en la verificación (decisión humana); la mitigación estructural es que la imagen no se reutiliza para `worker` ni `web`.
- **R17.** `esbuild` (que usa `tsx`) declara un `postinstall` y la imagen `migrate` se instala con `--ignore-scripts`. Su diseño con `optionalDependencies` de plataforma debería funcionar sin el script, pero no lo he validado y las fuentes consultadas no son concluyentes. Se comprueba en el paso 5; si falla, devops para y lo reporta (no se relaja `--ignore-scripts` sin decisión humana).

## OPEN DECISIONS

Ninguna pendiente. OD-019…OD-028: **RESUELTAS** (2026-10-20), registradas en SPEC §13. OD-026 (a), OD-027 (a) y OD-028 (c) se resolvieron con la opción recomendada. El texto de las propuestas se conserva como registro.

Registro: propuesta de OD-026…OD-028 (RESUELTAS el 2026-10-20, segunda ronda).

**OD-026 · Cómo instala `tsx` la imagen `migrate` si es `devDependency` de `persistence`.** El stage `deps` actual hace `pnpm fetch --prod` y la propuesta original instalaba `--prod`: con la precisión de ADR-010, `migrate` se quedaría sin `tsx`.
- (a) **Recomendada.** Stage `migrate-deps` con su propio `pnpm fetch --ignore-scripts` (completo) e `install --offline --filter @agentlab/persistence...` sin `--prod` (paso 5). Respeta la precisión literal y no toca la imagen del worker. Coste: `drizzle-kit`, `@types/pg` y dos `esbuild` en una imagen sin internet que solo recibe `DATABASE_URL` (R16), y una capa de `fetch` más.
- (b) Volver a `tsx` en `dependencies` de `persistence` (la propuesta original de ADR-010). La imagen queda en `--prod`, pero contradice la precisión humana y exigiría otro ADR.
- (c) Que `migrate` ejecute el `tsx` de `apps/worker` (`--filter worker... --filter @agentlab/persistence...` con `--prod`). Ata la imagen a la app worker, que ADR-010 descartó, y deja de ejecutar `pnpm db:migrate` como pide el DoD.

**OD-027 · Qué error tipado lanza la validación de `api_key_env`.** La lista de códigos de `core` es cerrada (OD-016) y ninguno encaja del todo.
- (a) **Recomendada.** `InvalidApiKeyEnvError` nuevo en `core/errors.ts`, con `code: "API_KEY_ENV_INVALID"` y mensaje fijo sin el valor. Distingue un dato de entrada inválido (la API de M2–M4 lo traducirá a 400) de un error de configuración del operador. Amplía la lista de OD-016 y el scope a `packages/core/src/errors.ts` y `errors.test.ts`.
- (b) Reutilizar `EnvValidationError` (`ENV_INVALID`). Sin código nuevo ni más scope, pero mezcla el `.env` mal configurado del operador con una fila que alguien intenta guardar.

**OD-028 · Las tres tablas sin uso en M1 (`tool_invocations` M4, `run_checkpoints` M3, `evaluations` M5).** El DoD pide «las 11 tablas de §6» y, a la vez, «lo que M1 no use, fuera». Aplicado a esas tres tablas, no queda ninguna columna con uso en M1.
- (a) Crearlas solo con `id`, `created_at`, `updated_at` y `run_id → runs CASCADE`. Las demás columnas llegan con la migración de la tarea que las escribe (TASK-023 para `run_checkpoints`, la de herramientas en M4 y la de evaluaciones en M5). Cumple las dos viñetas al pie de la letra, pero deja tres tablas que nadie lee ni escribe.
- (b) Crearlas con todas sus columnas de §6. Cumple «11 tablas» y deja el esquema completo, pero incumple «lo que M1 no use, fuera».
- (c) **Recomendada.** No crearlas en `0000_init` y cambiar la viñeta a «las 8 tablas que usa M1». Cada tabla nace con su tarea y su migración. Es lo más coherente con la regla «nada por si acaso», pero cambia el DoD y el test de «exactamente 11 tablas» pasa a ser de 8.

## Registro: propuesta original de OD-019…OD-025 (todas RESUELTAS el 2026-10-20)

Se conserva el texto tal como se propuso. La decisión vigente es la de «Decisiones humanas» y SPEC §13. **OD-023 se resolvió con una alternativa distinta de la recomendada:** sin `CHECK` y con validación en el repositorio.

**OD-019 · Red y mecanismo de `make test`/`make validate` hacia `db`** (security REQUIRED).
- (a) **Recomendada.** Dos fases (decisión 15, V7–V11). El código de paquetes, incluidos los `postinstall` y los tests, nunca corre con internet. `DATABASE_URL_TEST` llega desde `.env` porque la interpola compose: el Makefile no lee `.env` y no hace falta exportarla. Se comprueba sin imprimirla con `: "${DATABASE_URL_TEST:?…}"` dentro del contenedor. Coste: un servicio de compose más y dos pasadas de tar.
- (b) Una fase, con `docker run --network agentlab_egress --network agentlab_backend` o un servicio en las dos redes. Es más simple, pero las dependencias de desarrollo correrían con internet y con credenciales de superusuario (TD-013): habría un canal de exfiltración de todas las bases.
- (c) Dos fases con `docker run --network agentlab_backend`. Obliga a **exportar** `DATABASE_URL_TEST` en la shell, porque el Makefile no lee `.env`. Es una trampa de uso: con `.env` relleno, `make test` falla igual.

**OD-020 · Cómo obtienen `DATABASE_URL_TEST` los tests y `db:reset` sin `DATABASE_URL`.** `loadEnv()` exige `DATABASE_URL` (OD-015), y el contenedor de test no la recibe: no debe poder tocar `agentlab`.
- (a) **Recomendada.** `loadTestDatabaseUrl(source?)` en `core/env.ts` (paso 2). Necesita ampliar el scope a `packages/core/src/env.ts` y `env.test.ts`, con core-dev como owner.
- (b) Que los helpers de test y el CLI `reset` lean `process.env` directamente. Incumple monorepo-conventions («`process.env` solo en `core`»).
- (c) Pasar `DATABASE_URL=<la de test>` al contenedor. Mezcla las dos variables, y un `db:migrate` accidental migraría la base de test.

**OD-021 · Detalle del esquema que ARCHITECTURE §6 no fija.**

Propuesta común a todas las tablas:
- `id uuid PK DEFAULT gen_random_uuid()`, `created_at` y `updated_at` como `timestamptz NOT NULL DEFAULT now()`.
- `jsonb` tipado con `$type<>()` de `core` donde exista el tipo.
- FK físicas en todos los `*_id` escalares. Los arrays (`agent_ids`, `depends_on`) no llevan FK.
- Índice en cada FK de tabla hija.
- Los estados sin valores definidos en SPEC/`core` van como `text` sin `CHECK`, hasta la tarea que los use.

| Tabla | Propuesta |
|---|---|
| `projects` | `name text NOT NULL`, `budget_profile jsonb NOT NULL` (`Budget`) |
| `provider_configs` | `project_id NOT NULL → projects ON DELETE CASCADE`, `provider_type text NOT NULL`, `base_url text NULL`, `default_model text NOT NULL`, `api_key_env text NULL` + CHECK (OD-023) |
| `agent_definitions` | `project_id NOT NULL → projects CASCADE`, `name`/`system_prompt`/`prompt_version`/`model_id text NOT NULL`, `role text NOT NULL CHECK (role IN AGENT_ROLES)`, `provider_config_id NOT NULL → provider_configs RESTRICT`, `tool_allowlist text[] NOT NULL DEFAULT '{}'`, `max_calls`/`max_tokens`/`timeout_ms integer NOT NULL`, `output_schema jsonb NOT NULL`, `enabled boolean NOT NULL DEFAULT true` |
| `team_definitions` | `project_id NOT NULL → projects CASCADE`, `name`/`graph_builder text NOT NULL`, `agent_ids uuid[] NOT NULL`, `coordination jsonb NOT NULL DEFAULT '{}'` |
| `runs` | `project_id NOT NULL → projects RESTRICT`, `team_id NOT NULL → team_definitions RESTRICT` (el historial no se borra en cascada, ADR-007), `request jsonb NOT NULL` (`RunRequest`), `status text NOT NULL DEFAULT 'queued' CHECK (status IN RUN_STATUSES)`, `budget jsonb NOT NULL` (`Budget`), `budget_used`/`result`/`error jsonb NULL`, `cancel_requested boolean NOT NULL DEFAULT false`, `worker_id text NULL`, `worker_heartbeat_at`/`started_at`/`finished_at timestamptz NULL` (`started_at` se conserva al reclamar de nuevo: `COALESCE`). Índice `(status, created_at)` |
| `tasks` | `run_id NOT NULL → runs CASCADE`, `parent_task_id NULL → tasks CASCADE`, `title text NOT NULL`, `assigned_role text NOT NULL CHECK (IN AGENT_ROLES)`, `depends_on uuid[] NOT NULL DEFAULT '{}'`, `status text NOT NULL`, `input`/`output jsonb NULL` |
| `agent_invocations` | `run_id NOT NULL → runs CASCADE`, `task_id NULL → tasks CASCADE`, `agent_definition_id NOT NULL → agent_definitions RESTRICT`, `step integer NOT NULL`, `provider_type`/`model_id`/`status text NOT NULL`, `attempt integer NOT NULL DEFAULT 1`, `duration_ms`/`input_tokens`/`output_tokens integer NULL`, `cost_reported numeric NULL`, `validation`/`error jsonb NULL` |
| `tool_invocations` | `run_id NOT NULL → runs CASCADE`, `agent_invocation_id NOT NULL → agent_invocations CASCADE`, `tool_name text NOT NULL`, `input jsonb NOT NULL`, `output jsonb NULL`, `status text NOT NULL`, `duration_ms integer NULL`, `error jsonb NULL` |
| `run_events` | `run_id NOT NULL → runs CASCADE`, `seq integer NOT NULL CHECK (seq >= 1)`, `type text NOT NULL CHECK (type IN RUN_EVENT_TYPES)`, `payload jsonb NOT NULL`, `ts timestamptz NOT NULL DEFAULT now()`, `UNIQUE (run_id, seq)`. Ese índice sirve a `listSince`, así que no hace falta otro |
| `run_checkpoints` | `run_id NOT NULL → runs CASCADE`, `checkpoint_id text NOT NULL` (ADR-002 §6, FK lógica), `step integer NOT NULL`, `UNIQUE (run_id, checkpoint_id)` |
| `evaluations` | `run_id NOT NULL → runs CASCADE`, `criteria`/`scores jsonb NOT NULL`, `verdict`/`evaluator_role text NOT NULL` |

Alternativas: (b) todo `NULL` salvo lo que §6 marca y sin FK. Es más flexible, pero deja pasar datos huérfanos. (c) `pgEnum` para los estados, que no permite quitar valores. **Recomiendo la tabla anterior.** *(Aplicada con la poda de la decisión 20 y ARCHITECTURE §6.)*

**OD-022 · Asignación de `seq`: ARCHITECTURE §3.4 no se puede ejecutar al pie de la letra** (V1).
- (a) **Recomendada.** En una transacción, `SELECT 1 FROM runs WHERE id = $1 FOR UPDATE`, después `INSERT … SELECT COALESCE(MAX(seq),0)+1 FROM run_events WHERE run_id = $1` y `RETURNING` (V2). No añade columnas y conserva la intención de §3.4. Bloquea la fila del run durante milisegundos, en competencia con `heartbeat`/`transition`.
- (b) Contador `runs.last_event_seq` con `UPDATE … RETURNING`. Es O(1), pero añade una columna que §6 no tiene.
- (c) `pg_advisory_xact_lock(hashtext(run_id::text))` y `MAX+1`. No toca `runs`, pero el bloqueo queda fuera del modelo de datos y hay posibilidad de colisiones de hash (inocuas, solo serializan).

**OD-023 · Guarda de `api_key_env` y fuga del valor rechazado.**
- (a) Recomendada en la propuesta, **rechazada por el humano**. `CHECK (api_key_env ~ '^[A-Z][A-Z0-9_]*_API_KEY$' AND char_length(api_key_env) <= 40)` y `NULL` permitido, con deuda LOW por la fuga del `DETAIL` (V5).
- (b) Validación previa en un `ProviderConfigsRepository.create` mínimo más el `CHECK` como respaldo.
- (c) Trigger `BEFORE INSERT/UPDATE` con `RAISE EXCEPTION` sin datos de la fila.
- **Decisión humana:** validación en el repositorio sin `CHECK` (decisión 19).

**OD-024 · Dónde vive la tabla de control de Drizzle.**
- (a) **Recomendada.** La de por defecto, `drizzle.__drizzle_migrations`: un tercer esquema de servicio, que se documenta en §6 como excepción, igual que `langgraph`.
- (b) `public` con `migrationsSchema: "public"`. La tabla no tiene `updated_at` ni `uuid` y rompería la regla de columnas de §6.
- (c) `langgraph`. Mezclaría dos gestores en un esquema que ADR-002 dedica al checkpointer.

**OD-025 · Contratos mínimos de repositorio que el DoD no detalla.**
- `ProjectsRepository`: `create`/`get`/`list`. `AgentDefinitionsRepository`: `create`/`get`/`listByProject`.
- Devuelven los tipos inferidos de Drizzle, con los `jsonb` tipados con `core`. La traducción a `AgentDefinition` (`providerConfigId` → `providerId`) la hace quien la consume.
- Un id inexistente devuelve `null` en `get`/`transition`, y la API lo traduce a 404.
- Alternativa: `NotFoundError` (`NOT_FOUND`) en `core`. Es más explícito para TASK-014, pero amplía la lista cerrada de OD-016.
- **Recomiendo `null`** y no añadir métodos que nadie consume todavía.

## Fuentes (consultadas el 2026-10-20)

- `npm view <pkg>@<v> version engines dependencies peerDependencies peerDependenciesMeta dist-tags time` para los 8 paquetes de la tabla. Registry: https://registry.npmjs.org
- Tarballs de `npm pack`, inspeccionados en el scratchpad:
  - `@langchain/langgraph-checkpoint-postgres@1.1.0`: `dist/index.js`, `setup()`;
  - `drizzle-orm@0.45.4`: `node-postgres/migrator.js` y `pg-core/dialect.js`, `migrate()`;
  - `drizzle-kit@0.31.11`: `index.d.ts`, `Config`, y `bin.cjs`, comando `generate`.
- Pruebas V1–V11 con `postgres:16.15-trixie@sha256:ca0bd484…`, `node:22.23.3-bookworm-slim@sha256:c3de60bf…` y Docker Engine 29.8.2 / Compose v5.5.0.
- PostgreSQL 16, Advisory Lock Functions: https://www.postgresql.org/docs/16/functions-admin.html
- Vitest 5.0.5, `fileParallelism`: https://vitest.dev/config/fileparallelism
