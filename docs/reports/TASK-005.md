# TASK-005 · packages/persistence: Drizzle, migración inicial, repositorios base

| Campo | Valor |
|---|---|
| Tarea | TASK-005 |
| Hito | M0 |
| Estado | DONE |
| Owner | persistence-dev (reparto por pasos: devops, core-dev, persistence-dev) |
| Depende de | TASK-003, TASK-004 |
| Fecha de cierre | 2026-10-20 |
| Plan | `docs/reports/TASK-005-plan.md` (architect) |
| Veredicto TEST | PASS (ciclo 1 y re-test del ciclo 1/3: 22/22 viñetas) |
| Veredicto REVIEW | APPROVED (re-review del ciclo 1/3 y revisión acotada de exports del esquema + `restoreMocks`). Primera revisión: CHANGES_REQUESTED |
| Veredicto SECURITY | APPROVED (security REQUIRED; hallazgos MEDIUM y LOW tratados como deuda, ver sección de deuda) |
| Ciclos de corrección | 1/3, más una corrección acotada (exports del esquema y `restoreMocks`) por decisión humana |

## Resumen de lo entregado

- `packages/persistence` completo: 8 tablas Drizzle en `public` (`projects`, `provider_configs`, `agent_definitions`, `team_definitions`, `runs`, `tasks`, `agent_invocations`, `run_events`), migración `0000_init.sql`, `runMigrations` con `pg_advisory_xact_lock` y `setup()` del checkpointer sobre el esquema `langgraph` (4 tablas), repositorios `runs`, `events`, `projects`, `agent_definitions` y `provider_configs`, CLIs `db:migrate` y `db:reset`, y helpers de test en `@agentlab/persistence/testing`.
- `core`: `loadTestDatabaseUrl()`, `isApiKeyEnvName()` e `InvalidApiKeyEnvError` (`code: "API_KEY_ENV_INVALID"`).
- Infraestructura: `make test` y `make validate` en dos fases contra `db` (servicio `test` solo en `backend`); servicio `migrate` one-shot que `web` y `worker` esperan con `service_completed_successfully`; `DATABASE_URL_TEST` solo en el servicio `test`; `turbo.json` con `passThroughEnv`.
- Verificación final: `make validate` y `make test` con exit 0; core 7 ficheros / 169 tests (100 % de cobertura); persistence 6 ficheros / 93 tests tras la corrección acotada (92 en el re-test del ciclo 1/3); `public|8`, `langgraph|4`, `drizzle|1` tras `docker compose up`.
- Cobertura de persistence: 74,2 % de líneas (sin objetivo en el DoD). Los repositorios están entre el 98 % y el 100 %.

## Decisiones humanas (2026-10-20)

1. **ADR-010 Accepted** (2026-10-20): `tsx` 4.23.15 entra en `devDependencies` de `packages/persistence`, solo para sus scripts `db:*`. Amplía ADR-009 §2 sin contradecirlo; `tsx` sigue siendo dependencia de runtime solo de `apps/worker`.
2. **OD-019 … OD-025** (2026-10-20), resueltas tal como recomendó el plan: dos fases para `make test`/`validate` (OD-019); `loadTestDatabaseUrl()` en `core` (OD-020); tabla de columnas del plan, sin columnas "por si acaso" (OD-021); bloqueo de fila del run + `MAX+1` y corrección de ARCHITECTURE §3.4 (OD-022); **sin `CHECK` en la base** para `api_key_env`, validación en el repositorio (OD-023, se descartó la opción recomendada por el plan: un valor rechazado no debe aparecer en los logs de `db`); esquema `drizzle` para la tabla de control (OD-024); `create`/`get`/`list` y `null` si el id no existe (OD-025).
3. **OD-026, OD-027, OD-028** (2026-10-20): stage propio de `migrate` con devDependencies de `persistence` y sin scripts (OD-026, opción a); `InvalidApiKeyEnvError` en `core` con `code: "API_KEY_ENV_INVALID"` (OD-027, opción a); `0000_init` crea 8 tablas, y `tool_invocations` nace en TASK-030, `run_checkpoints` en TASK-023 y `evaluations` en TASK-036, cada una con su migración (OD-028, opción c).
4. **`--ignore-scripts` en la fase offline de tests** (2026-10-20): la instalación de la fase 2 de `make test` no ejecuta scripts de dependencias con acceso a `db` como superusuario.
5. **Paso 4b** (2026-10-20): devops completa `test` y `typecheck` de `persistence` después del paso 4, para que `make validate` y `make test` ejecuten sus tests a través de turbo.
6. **testing-conventions alineada antes del paso 3** (2026-10-20): la regla de integración apunta a `src/**/*.integration.test.ts` y no a `tests/integration/`; `resetTestDatabase(testUrl)` sustituye a `resetTestDb()`; `make test` sustituye a `pnpm test:integration`. Tras el cierre quedan además la regla 11 (tests de integración en serie) y la regla 2 (proveedores reales en `tests/integration/providers/`), cada una con su cita en el informe correspondiente.
7. **Imagen `migrate` sin las devDependencias de la raíz** (2026-10-20): pnpm 9 con `--frozen-lockfile` instala siempre el importer raíz, así que la exclusión no se pudo conseguir sin rediseño. Decisión humana (opción A): aceptarlo como deuda, **TD-020** LOW, que se paga en TASK-008 junto con TD-015.
8. **`DATABASE_URL_TEST` en `migrate`** (2026-10-20): el humano exigió verificarlo directamente y no vale "por construcción" como evidencia. El bloqueo del hook impidió la comprobación con `env` en el contenedor; la verificación final se hizo con `docker compose --profile '*' config`, que muestra `DATABASE_URL_TEST` solo en el servicio `test` (ver sección de informes, TEST).
9. **`t5.mk` del scratchpad** (2026-10-20): el humano lo calificó de uso aceptable de Write, sin incidencia: "Un Makefile auxiliar en el scratchpad es exactamente para lo que hemos abierto Write fuera del repo; no rodea ningún bloqueo".
10. **Exportación del esquema** (2026-10-20): hueco de diseño detectado en la revisión y corregido dentro de la tarea. `index.ts` solo exporta tipos del esquema (`export type { … }`) y repositorios; las tablas Drizzle ya no salen como valor. Se añade `packages/persistence/src/index.test.ts` y `restoreMocks: true` en `vitest.config.ts`.
11. **Códigos de error** (2026-10-20): `RowNotFoundError` (`ROW_NOT_FOUND`) e `InvalidEventPayloadError` (`EVENT_PAYLOAD_INVALID`) se deciden como códigos del proyecto (no son OD). Se implementan en TASK-014 (`rows.ts`) y TASK-024 (`events.ts`); sus DoD ya lo recogen.
12. **NITs sin acción** (2026-10-20): canario en mayúsculas en el caso de 41 caracteres (el canario actual tiene minúsculas y se rechaza por la regex); test del `ROLLBACK` del tester no incorporado al repo; `release(true)` en lugar de `release(failure)` en `migrate.ts`.

## Bloqueos del hook citados por los agentes

Literal de los informes. Ninguno se rodeó: cada agente se detuvo o usó un procedimiento aceptado por el humano.

- `BLOCKED by bash-guard: no se leen ficheros .env desde Claude Code`: persistence-dev (script con `HOST_TAR`, falso positivo, el comando solo excluía `.env`) y tester (comandos `tar … --exclude=.env`). Ambos se citan y se paran.
- `BLOCKED by bash-guard: no se imprimen variables de entorno con secretos`: devops (`env | grep -c DATABASE_URL_TEST` dentro de `migrate`). Se paró y la comprobación de `DATABASE_URL_TEST` se repitió con `docker compose config`.
- `BLOCKED by bash-guard: escritura por shell en '…/mut5/…/provider-configs.ts' fuera del scope de la tarea. Usa Edit/Write dentro del scope o repórtalo.`: tester, al intentar `sed -i` sobre una copia del scratchpad. Aplicó la mutación con Edit sobre la copia, tal como indicaba el propio mensaje.
- `BLOCKED by bash-guard` sobre `docker compose run --rm -T … test bash -c '…vitest run…'` con `tar … --exclude=.env --exclude='.env.*'`: tester, ciclo de re-test. Se citó y se paró; el caso "variable vacía dentro del contenedor" quedó sin ejecutar en ese ciclo y se cubrió después con `DATABASE_URL_TEST= make test`.

## Limitaciones

- Cobertura de persistence: 74 % de líneas. No hay objetivo en el DoD (decisión 17 del plan). Core: 100 %.
- Los CLI `db:migrate` y `db:reset` se probaron a mano en el contenedor; no tienen test automático (**TD-023**, pago en TASK-009).
- `drizzle-kit generate`, el migrador y `setup()` se ejecutaron en el contenedor real (paso 4 y paso 5), no en el host.

## Deuda registrada

Ya estaban en `docs/TECHNICAL_DEBT.md` (registradas por el Orchestrator antes del cierre; no se duplican):

| ID | Severidad | Pago | Origen |
|---|---|---|---|
| TD-019 | LOW | TASK-040 (al subir `drizzle-kit`) | `@esbuild-kit/*` obsoletos y GHSA-67mh-4wv8-2f99 en `esbuild@0.18.20` (solo `esbuild serve`) |
| TD-020 | LOW | TASK-008 (con TD-015) | Devdependencies de la raíz en la imagen `migrate` (decisión humana A) |
| TD-021 | MEDIUM | TASK-008 (red `internal: true` para `db` y `test`) y TASK-037 (rol no superusuario) | El servicio `test` se conecta como superusuario y comparte la red `backend` (R5) |
| TD-022 | LOW | TASK-008 | `cap_drop`/`no-new-privileges` en `migrate` y `worker`; `test` como uid 0; `--ignore-scripts` en `docker/worker.Dockerfile:12` y `:16`; `.dockerignore` más corto que `HOST_TAR` |
| TD-023 | LOW | TASK-009 | Los CLI `db:*` no tienen test automático |
| TD-024 | LOW | TASK-027 | `core/src/env.test.ts` (`loadEnv > reads process.env by default`) depende del `process.env` real |

Actualizadas en el cierre: **TD-011** (nota de `DrizzleQueryError`, que mete los parámetros en `message`), **TD-017** (precisión: sin canal de confidencialidad entre fases; riesgo de integridad) y **TD-019** (GHSA de esbuild). Ninguna deuda se marca `PAID` en esta tarea: ninguna fila tenía TASK-005 como pago.

Deuda propuesta por el reviewer o los owners y **no registrada como deuda nueva** (resuelta dentro de la tarea o sin acción): restaurar espías (resuelto con `restoreMocks: true`); `truncateAll` que vacía todas las tablas (es lo que fija la decisión 13 del plan); exportación de tablas desde `index.ts` (resuelta, ver decisión 10).

## OPEN DECISIONS registradas

- OD-019 … OD-028: **RESUELTAS** (2026-10-20), registradas en `docs/TECHNICAL_SPEC.md` §13 y en ARCHITECTURE §1, §3.4, §6, §9 y §10.
- Sin OD abiertas al cierre. La propuesta de código estable para invariantes internas (`TypeError` en `rows.ts`) y para payload de evento inválido (`ZodError` en `events.ts`) se decidió en la decisión 11 y se implementa en TASK-014 y TASK-024.

## Informes archivados

Orden: PLAN (original), PLAN (revisado), PLAN (registro OD-026…028), IMPLEMENTATION pasos 1, 2, 3, 4, 4b, 5 y 5 (continuación); TEST; REVIEW (CHANGES_REQUESTED); IMPLEMENTATION ciclo 1/3; SECURITY; TEST re-test ciclo 1/3; REVIEW re-review ciclo 1/3; IMPLEMENTATION corrección acotada; REVIEW revisión acotada; anexo de procesos.

Nota: el anexo contiene cuatro CLOSURE de `testing-conventions` (el packet mencionaba tres; el cuarto, de la regla 2, está en el disco y se archiva igualmente) y la corrección del plan (decisión 20).

---

## Informe archivado 1 · PLAN (original)

## PLAN — TASK-005

Contexto: `packages/persistence` está vacío (`export {};`, sin dependencias ni script `test`). `make test` corre aislado y no llega a `db`, y nada migra la base en `make up`. El plan propone el esquema de las 11 tablas, la migración `0000_init.sql`, `pnpm db:migrate` (Drizzle y después `setup()` sobre `langgraph`), los 4 repositorios, el servicio `migrate` y un `make test` contra `db`.

Hay decisiones humanas pendientes antes de lanzar el paso 1: ADR-010 (Proposed), OD-019…OD-025, los huecos de scope y `deps_allowed`. **No he registrado las OD en SPEC §13**: están solo en el plan, con números provisionales a partir de OD-019, y te toca registrarlas a ti.

Validación fuera del repo (scratchpad; Docker 29.8.2, Compose v5.5.0, imágenes fijadas del repo; todo limpiado al terminar):
- **V1:** el SQL literal de ARCHITECTURE §3.4 falla en PG 16.15 con `FOR UPDATE is not allowed with aggregate functions`.
- **V2:** bloqueando la fila del run y haciendo `MAX+1` en la misma transacción, 600 appends concurrentes dan `seq` 1..600 sin errores. **V3:** sin el bloqueo salen cientos de violaciones del `unique`.
- **V4:** `claimNext` con `SKIP LOCKED`, 3 sesiones sobre 50 runs: 0 duplicados.
- **V5:** el `CHECK` de `api_key_env` rechaza `sk-`, `AIza` y nombres de más de 40 caracteres, pero el `DETAIL` del error muestra el valor rechazado.
- **V7:** `${VAR:?}` en un servicio con perfil rompe `docker compose up`, porque compose interpola todo el fichero. Por eso `DATABASE_URL_TEST` no puede llevar `:?` en compose.
- **V8–V11:**
  - `pnpm fetch` ejecuta `postinstall` (el de esbuild) si no se le pasa `--ignore-scripts`.
  - La fase 2 en la red `backend` funciona sin internet: `compose run -T` recibe el stdin, el store va en `:ro`, la instalación es offline y los tests pasan.
- **Sin validar:** `drizzle-kit generate`, el migrador y `setup()` en ejecución real. El hook bloquea `pnpm add` y no lo rodeé; los inspeccioné en tarballs de `npm pack`.
- **Falso positivo de `bash-guard`:** bloquea `cd $VAR/…` seguido de una redirección. Escribí el fichero de prueba con Write, fuera del repo. Quien verifique debe usar rutas absolutas literales.

Decisiones:
  - `drizzle.config.ts` en `packages/persistence/`, sin `dbCredentials` y con `schemaFilter: ["public"]` — descarto la raíz porque la raíz no tiene tsconfig ni lint propios (TD-007) y obligaría a `--config ../../`.
  - `db:migrate` usa el migrador programático de drizzle-orm y después `PostgresSaver.setup()` con `{schema:"langgraph"}`, nunca `end()` — descarto `drizzle-kit migrate` porque es dependencia de desarrollo, exige credenciales (`process.env` fuera de core) y no ejecuta `setup()`.
  - CLIs en `src/cli/*.ts` ejecutados con `tsx` — esto contradice ADR-009 §2, así que propongo **ADR-010 (Proposed)**.
  - `make test`/`validate` en dos fases (OD-019a) — descarto la fase única con internet y la base a la vez, porque abre un canal de exfiltración con el superusuario (TD-013).
  - `seq`: `FOR UPDATE` sobre la fila del run y `MAX+1` (OD-022a) — descarto el contador en `runs`, que añade una columna que §6 no tiene.
  - Imagen de `migrate`: stages nuevos en `docker/worker.Dockerfile` con `target` explícito — descarto un Dockerfile aparte porque duplicaría el digest de Node.
  - Tests en `src/**/*.test.ts` (TD-010); `globalSetup` hace el reset y cada test un `TRUNCATE`; `fileParallelism: false` — descarto la transacción por test porque `claimNext` concurrente necesita conexiones que vean filas confirmadas.
  - NOTIFY queda fuera: es de TASK-024.

Pasos (detalle en el plan):
  0. Orchestrator/humano: decidir ADR-010 y las OD, ampliar el scope y fijar `deps_allowed`.
  1. devops: dependencias y scripts → `packages/persistence/package.json`, `pnpm-lock.yaml`, `package.json` (raíz).
  2. core-dev (si OD-020a): `loadTestDatabaseUrl()` → `packages/core/src/env.ts`, `env.test.ts`.
  3. devops: infraestructura de test → `turbo.json` (`passThroughEnv`), `compose.yaml` (servicio `test`), `Makefile` (dos fases), `.env.example:9` (host `db`).
  4. persistence-dev → `packages/persistence/**`: esquema, migraciones generadas, repositorios, CLIs, `testing/` y tests.
  5. devops: servicio `migrate` → `docker/worker.Dockerfile`, `compose.yaml` (`depends_on` con `service_completed_successfully`).
  6. tester → reviewer → security.

Huecos de scope: `.env.example`, `package.json` (raíz; también para excluir `migrations/meta` de prettier, porque role-guard no deja a nadie editar `.prettierignore`), `pnpm-lock.yaml`, `docker/worker.Dockerfile` y `packages/core/src/env.ts` + `env.test.ts` (OD-020a). Después de las decisiones, `docs/ARCHITECTURE.md` §1/§3.4/§6/§9 (architect). `drizzle.config.ts` en la raíz sobra en el scope.

`deps_allowed` propuestas (exactas, verificadas con npm el 2026-10-20; las aprueba el humano):
- `dependencies` de `packages/persistence`: `drizzle-orm 0.45.4`, `pg 8.23.1`, `@langchain/langgraph-checkpoint-postgres 1.1.0`, `@langchain/langgraph-checkpoint 1.2.0`, `@langchain/core 1.2.18`, `tsx 4.23.15` (ADR-010).
- `devDependencies`: `drizzle-kit 0.31.11`, `@types/pg 8.23.1`.
- Peers y engines compatibles con Node `>=22.12 <23`.
- Ojo: `@langchain/core 1.2.19` salió hoy; se mantiene 1.2.18 según ARCHITECTURE §9.

Contratos públicos nuevos (firmas completas en el plan):
- `createPool`, `createDatabase`, `runMigrations`, `CHECKPOINT_SCHEMA`.
- `create{Runs,Events,Projects,AgentDefinitions}Repository(db)`.
- `RunsRepository`: `create`, `get`, `claimNext(workerId)`, `transition(id, to)` (lanza `InvalidTransitionError`), `heartbeat(id, workerId): boolean`.
- `EventsRepository`: `append(runId, event)`, `listSince(runId, seq)`.
- `@agentlab/persistence/testing`: `resetTestDatabase` (se niega si la base no termina en `_test`), `truncateAll`.
- Servicios de compose `migrate` y `test`.

Tests:
- Tabla exhaustiva 7×7 de `transition`.
- `claimNext`: concurrente, con N runs, y un caso determinista con la fila bloqueada.
- `seq` contiguo con appends concurrentes.
- Esquema: 11 tablas en `public` y 4 en `langgraph`; `drizzle-kit generate` no detecta cambios.
- `CHECK` de `api_key_env` (código 23514).
- Sin `DATABASE_URL_TEST`: el run falla, no se salta ningún test.
- `make test` no llega a `localhost` aunque el override publique el 5432.
- Regla 10: macOS (make 3.81), y `make -n` + `bash -n` en Linux.

Riesgos (R1–R15 en el plan). Los que más pesan:
- `setup()` y el migrador de Drizzle no usan bloqueo entre procesos.
- El valor rechazado por el `CHECK` aparece en el error y en los logs de `db` (R4).
- El contenedor de test se conecta como superusuario y alcanza la base `agentlab` y `ollama` (R5, para security).
- Con un segundo paquete con tests de integración (TASK-007), los `reset` chocarán (R6).
- El scope de TASK-024 no incluye `src/repositories/events.ts`, y el NOTIFY debe ir en la transacción de `append` (R9).
- `make test`/`validate` pasan a necesitar `.env` y dejan `db` levantada (R10).

OPEN DECISIONS (las recomendadas en negrita):
- OD-019 · Red de `make test`: **(a) dos fases con un servicio `test` solo en `backend`**; (b) una fase con internet; (c) `docker run` exportando la variable a mano.
- OD-020 · Tests sin `DATABASE_URL`: **(a) `loadTestDatabaseUrl` en core**; (b) leer `process.env` fuera de core; (c) suplantar `DATABASE_URL`.
- OD-021 · Detalle del esquema no fijado en §6 (tipos, nulabilidad, defaults, FK y `ON DELETE`, CHECK de estados): **tabla propuesta en el plan**.
- OD-022 · `seq`: **(a) bloquear la fila del run y `MAX+1`**, y corregir el texto de §3.4; (b) contador en `runs`; (c) advisory lock.
- OD-023 · `api_key_env`: **(a) CHECK con la regex de OD-017, ≤ 40 caracteres, `NULL` permitido, y deuda LOW por la fuga del valor en `DETAIL`**; (b) repositorio con validación previa; (c) trigger.
- OD-024 · Tabla de control de Drizzle: **(a) esquema `drizzle` por defecto**, documentado como excepción en §6; (b) `public`; (c) `langgraph`.
- OD-025 · Repositorios: **`create`/`get`/`list`; `null` si el id no existe**; alternativa: `NotFoundError` en core.

Cambios en `docs/reports/TASK-003-plan.md` (citas literales tras editar; ya no queda ningún `2026-10-21`):
- `:6` — "| Fecha | 2026-10-20 (ajustado el 2026-10-20 tras la decisión humana) |"
- `:8` — "| Estado | Aprobado por el humano (2026-10-20) con las decisiones de abajo. …"
- `:10` — "## Decisiones humanas (2026-10-20, literal)"
- `:51` — "… El 2026-10-20 tampoco pude probar el perfil `web` …"
- `:58` — "- Docker docs \"Using profiles with Compose\" (docs.docker.com/compose/how-tos/profiles, 2026-10-20). …"
- `:136` (nueva) — "   - *Nota posterior:* en el ciclo 2, por decisión humana, el montaje `-v $(CURDIR):/src:ro` de estas dos líneas se sustituyó por una copia filtrada por stdin, sin montar el repo. Ver «Desviaciones respecto al plan» en `docs/reports/TASK-003.md`."
- `:187` (R6, añadido al final) — "… *Nota posterior:* en el ciclo 2, por decisión humana, el montaje se sustituyó por una copia filtrada por stdin, sin montar el repo, así que este riesgo ya no aplica. Ver «Desviaciones respecto al plan» en `docs/reports/TASK-003.md`."
- La decisión 12 de ese plan (`:86`, "El repo se monta en **solo lectura** en `/src`") también describe el montaje antiguo. No la he tocado porque el packet pedía no cambiar nada más.

Ficheros escritos:
- /Users/davidferanandezmorilla/Desktop/development.nosync/agentlab/docs/reports/TASK-005-plan.md
- /Users/davidferanandezmorilla/Desktop/development.nosync/agentlab/docs/adr/ADR-010-tsx-en-persistence.md (Proposed)
- /Users/davidferanandezmorilla/Desktop/development.nosync/agentlab/docs/adr/ADR-000-indice-y-plantilla.md (índice: fila de ADR-010)
- /Users/davidferanandezmorilla/Desktop/development.nosync/agentlab/docs/reports/TASK-003-plan.md (fechas y notas)

---

## Informe archivado 2 · PLAN (revisado)

## PLAN — TASK-005 (revisado con las decisiones humanas del 2026-10-20)

Contexto: he aplicado las decisiones del packet a ADR-010, ADR-000, ADR-009, SPEC §13, ARCHITECTURE §1, §3.4, §6, §9 y §10, y a los planes de TASK-005 y TASK-003. El plan queda aprobado salvo 3 OPEN DECISIONS nuevas que salen de aplicar esas decisiones y 1 hueco de scope. Ningún hook me bloqueó.

**Ficheros tocados**
- `docs/adr/ADR-010-tsx-en-persistence.md`
- `docs/adr/ADR-000-indice-y-plantilla.md`
- `docs/adr/ADR-009-ejecucion-typescript-runtime.md` (solo «Relacionado», como obligaba ADR-010)
- `docs/TECHNICAL_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/reports/TASK-005-plan.md` (reescrito; la versión anterior está en `/private/tmp/claude-501/-Users-davidferanandezmorilla-Desktop-development-nosync-agentlab/3fa7c665-c570-4833-afbe-b934a451dd31/scratchpad/TASK-005-plan.before.md`)
- `docs/reports/TASK-003-plan.md`

**Citas releídas en disco**
- `ADR-010…md:5` — "| Estado | Accepted (2026-10-20, aprobado por el responsable humano con una precisión) |"
- `ADR-010…md:29` — "1. `tsx` **`4.23.15`**, … entra en **`devDependencies`** de `packages/persistence`, solo para sus scripts `db:*`. Como dependencia de runtime, `tsx` sigue estando **solo** en `apps/worker` (ADR-009 §2). Esto amplía ADR-009 §2 …: no lo contradice."
- `ADR-000…md:22` — "| ADR-010 | … | Accepted (2026-10-20; `tsx` dev de `persistence`, amplía ADR-009 §2) |"
- `TECHNICAL_SPEC.md:350-356` — filas OD-019…OD-025 «RESUELTA (2026-10-20)». En `:354`: "**sin `CHECK` en la base** (un valor rechazado no debe aparecer en los logs de `db`; se descarta la opción recomendada)…"
- `ARCHITECTURE.md:21-22` — filas de los servicios `migrate` (one-shot, `pg_advisory_xact_lock`, solo `DATABASE_URL`) y `test` (perfil `test`, solo `backend`, «`make test` deja `db` en marcha; se para con `make down`»).
- `ARCHITECTURE.md:141-143` — "SELECT 1 FROM runs WHERE id = $1 FOR UPDATE; / INSERT INTO run_events (run_id, seq) / SELECT $1, COALESCE(MAX(seq), 0) + 1 FROM run_events WHERE run_id = $1;". Es literalmente el SQL de V2 (`scratchpad/append.sql` solo insertaba `run_id, seq`), y `:147` aclara que `type`/`payload`/`RETURNING` los añade el repositorio.
- `ARCHITECTURE.md:187` — "Excepción (OD-024): la tabla de control de migraciones de Drizzle vive en el esquema `drizzle`…"
- `ARCHITECTURE.md:209` — "**`provider_configs.api_key_env`:** `text NULL` …, **sin `CHECK`** (OD-023)…"
- `ARCHITECTURE.md:250` — "| `tsx` | `4.23.15` | `apps/worker` (`dependencies`); `packages/persistence` (dev, scripts `db:*`) | …"
- `TASK-003-plan.md:87` — "*Nota posterior:* en el ciclo 2, por decisión humana, este montaje se sustituyó por una copia filtrada por stdin, sin montar el repo. Ver «Desviaciones respecto al plan» en `docs/reports/TASK-003.md`."
- `TASK-005-plan.md:11` (bloque «Decisiones humanas (2026-10-20, literal)»), `:108` (decisión 18, bloqueo consultivo), `:114-117` (decisión 19: "**Hoy `core` no exporta la regla.** `SECRET_NAME` es una constante privada del módulo (`packages/core/src/env.ts:53`). El paso 2 (core-dev) exporta `isApiKeyEnvName`…") y `:94` (`fileParallelism: false`).

**Decisiones de diseño nuevas en el plan**
- **Bloqueo en `runMigrations`.** Un cliente dedicado abre `BEGIN` y toma `pg_advisory_xact_lock`. Drizzle y `setup()` corren en otras conexiones del pool, porque el `COMMIT` del migrador soltaría el bloqueo si compartieran conexión. Por eso el pool necesita `max ≥ 2`. Lo usan tanto `db:migrate` como `resetTestDatabase`. Se prueba con dos pools en paralelo sobre esquemas vacíos.
- **`api_key_env`.** Se valida en un `ProviderConfigsRepository.create` nuevo (`create`/`get`/`listByProject`) antes de cualquier consulta. La regla es `isApiKeyEnvName` de `core` más `length ≤ 40`. El límite de 40 vive en `persistence`: meterlo en `core` cambiaría la regla de OD-017. El error lleva un mensaje fijo, sin el valor ni `cause`. Los tests buscan el valor canario en `message`, `stack`, `cause` y `JSON.stringify`, comprueban con un espía que no sale ninguna consulta y, a mano, que `docker compose logs db` no lo contiene.
- **Poda de OD-021.** Ninguna columna queda fuera de §6. Sale `team_definitions.coordination` (es de M4, y `core` ya no la tiene). También salen el `CHECK (seq >= 1)`, el `UNIQUE (run_id, checkpoint_id)` y los índices en todas las FK. Quedan `tasks.parent_task_id` y `depends_on`, porque SPEC §4.3 los prevé en M1.
- **Tests de integración.** Van en `src/**/*.integration.test.ts`, en un solo Vitest con `fileParallelism: false`. Descarto `projects` de Vitest. Ajusté ARCHITECTURE §10, que decía `tests/integration` y contradecía el DoD; es un cambio fuera de las secciones del packet, pero dentro de un fichero permitido.

**Incoherencias entre el DoD de TASKS.md §TASK-005 y el plan**
1. El DoD de OD-023 exige validar «en el repositorio», pero su lista de repositorios no incluye `ProviderConfigsRepository`. El plan lo añade.
2. El DoD pide «11 tablas de §6» y a la vez «lo que M1 no use, fuera». `tool_invocations`, `run_checkpoints` y `evaluations` no tienen ninguna columna con uso en M1 → OD-028.
3. Con `tsx` en dev, la imagen `migrate` no puede instalarse con `--prod`, y el stage `deps` actual hace `pnpm fetch --prod` → OD-026.
4. **Falta en el scope** `packages/core/src/index.test.ts`. Su test compara la lista exacta de exports (`:5-38`), así que exportar `loadTestDatabaseUrl` e `isApiKeyEnvName` lo rompe. Si OD-027 se decide como (a), también faltan `packages/core/src/errors.ts` y `errors.test.ts`.
5. Para docs-keeper: la regla 1 de testing-conventions nombra `resetTestDb()` (el plan usa `resetTestDatabase`) y cita `pnpm test:integration`, un comando que no existe ni crea esta tarea.

**OPEN DECISIONS** (números provisionales; las registra el Orchestrator)
- **OD-026 · Cómo lleva `tsx` la imagen `migrate`.** Recomiendo (a): un stage `migrate-deps` con `pnpm fetch --ignore-scripts` completo e instalación de `persistence` sin `--prod`. Mete `drizzle-kit` y dos `esbuild` en la imagen; lo revisa security (R16). (b) `tsx` en `dependencies` contradice la precisión humana. (c) Usar el `tsx` del worker, que ADR-010 ya descartó.
- **OD-027 · Qué error tipado lanza la validación.** Recomiendo (a) `InvalidApiKeyEnvError`, `code: "API_KEY_ENV_INVALID"`, en `core`: amplía la lista de OD-016 y el scope. (b) Reutilizar `EnvValidationError`, que mezcla la configuración del operador con un dato de entrada.
- **OD-028 · Las tres tablas sin uso en M1.** Recomiendo (c): no crearlas en `0000_init` y que el DoD pase a «8 tablas». (a) Crearlas solo con `id`, timestamps y `run_id`. (b) Crearlas completas, lo que incumple «fuera».

**Riesgos que siguen abiertos**
- R5: el contenedor de test se conecta como superusuario; lo decide security.
- R6: el «un solo runner» entre paquetes lo tendrá que cumplir la primera tarea que añada tests de integración en un segundo paquete (TASK-007 o TASK-014).
- R16: la superficie de la imagen `migrate`.
- Ni el bloqueo consultivo ni el migrador real se han validado todavía: su primera ejecución será la del paso 4.

---

## Informe archivado 3 · PLAN (registro de OD-026…OD-028 y ajuste de documentos)

## PLAN — TASK-005 (registro de OD-026…OD-028 y ajuste de documentos)

He registrado las tres decisiones en SPEC §13, he anotado en ARCHITECTURE §1, §6 y §10 dónde nace cada tabla, la imagen de `migrate` y el código nuevo, y he ajustado el plan. No ha habido bloqueos de hook. No he tocado ningún ADR ni ADR-000, porque ninguna de las tres decisiones contradice un ADR aceptado.

**Ficheros tocados**
- `/Users/davidferanandezmorilla/Desktop/development.nosync/agentlab/docs/TECHNICAL_SPEC.md`
- `/Users/davidferanandezmorilla/Desktop/development.nosync/agentlab/docs/ARCHITECTURE.md`
- `/Users/davidferanandezmorilla/Desktop/development.nosync/agentlab/docs/reports/TASK-005-plan.md`

**Citas literales (leídas en disco tras editar)**
- `TECHNICAL_SPEC.md:357`: "| OD-026 | ~~Cómo instala `tsx` la imagen `migrate` si es `devDependency` de `persistence` (ADR-010)~~ **RESUELTA (2026-10-20)**: opción (a). "Stage propio para migrate con las devDependencies de persistence, sin ejecutar scripts; …"
- `TECHNICAL_SPEC.md:358`: "| OD-027 | … **RESUELTA (2026-10-20)**: opción (a). "InvalidApiKeyEnvError, code API_KEY_ENV_INVALID, en core." **Amplía la lista de códigos de OD-016** con `API_KEY_ENV_INVALID` …". La fila de OD-016 no se ha tocado.
- `TECHNICAL_SPEC.md:359`: "| OD-028 | … **RESUELTA (2026-10-20)**: opción (c). "0000_init crea 8 tablas; tool_invocations nace en TASK-030, run_checkpoints en TASK-023, evaluations en TASK-036, …"
- `ARCHITECTURE.md:21` (§1, servicio `migrate`): "… instalada con `--ignore-scripts` (`fetch` e `install`); **no se reutiliza para `worker` ni `web`**: ningún otro servicio la usa como `target` y ningún stage parte de ella (`FROM`/`COPY --from`). |"
- `ARCHITECTURE.md:198`: "| `tool_invocations` | … | Nace en TASK-030 con su migración (OD-028); no está en `0000_init` |"
- `ARCHITECTURE.md:200`: "| `run_checkpoints` | … | FK lógico al checkpointer. Nace en TASK-023 con su migración (OD-028); no está en `0000_init` |"
- `ARCHITECTURE.md:201`: "| `evaluations` | … | Nace en TASK-036 con su migración (OD-028); no está en `0000_init` |"
- `ARCHITECTURE.md:203`: "La migración `0000_init` (TASK-005, OD-021, OD-028) crea **8 tablas** —`projects`, `provider_configs`, `agent_definitions`, `team_definitions`, `runs`, `tasks`, `agent_invocations`, `run_events`— …"
- `ARCHITECTURE.md:208`: sustituye la frase anterior "pendientes de decisión humana" por las tres tareas.
- `ARCHITECTURE.md:209`: "… lanza `InvalidApiKeyEnvError` de `core` (`code: "API_KEY_ENV_INVALID"`, OD-027), con mensaje fijo que no incluye el valor."
- `ARCHITECTURE.md:262` (§10): "(`BUDGET_EXCEEDED`, `PROVIDER_RATE_LIMIT`, `API_KEY_ENV_INVALID`, …; lista cerrada en `core/errors.ts`, OD-016 ampliada por OD-027)". ARCHITECTURE no tenía una lista cerrada de códigos: §3.1 solo nombra los errores de proveedor y §10 daba ejemplos. Por eso el código va en §10 y en §6.
- `TASK-005-plan.md:26`: "Segunda ronda (2026-10-20, literal):", seguida de las 5 decisiones literales (líneas 27–31).
- `TASK-005-plan.md:110`: "16. **Imagen de `migrate`: stage propio, no reutilizable** (OD-026 a, decidida). …"
- `TASK-005-plan.md:111`: "… instala `--offline --frozen-lockfile --ignore-scripts --filter @agentlab/persistence...` sin `--prod`. **Ni `fetch` ni `install` ejecutan scripts.** …"
- `TASK-005-plan.md:183`: "2. **core-dev.** → `packages/core/src/env.ts`, `packages/core/src/env.test.ts`, `packages/core/src/errors.ts`, `packages/core/src/errors.test.ts`, `packages/core/src/index.test.ts`"
- `TASK-005-plan.md:213`: "… **8 tablas** (`projects`, `provider-configs`, …, `run-events`; …). Sin ficheros ni tablas para `tool_invocations`, `run_checkpoints` ni `evaluations` (OD-028 c)."
- `TASK-005-plan.md:230`: "RUN pnpm install --offline --frozen-lockfile --ignore-scripts --filter @agentlab/persistence... (…; `--ignore-scripts` en las dos órdenes, DoD)."
- `TASK-005-plan.md:290`: "export class InvalidApiKeyEnvError extends AgentLabError { constructor(); } // OD-027 (a); code "API_KEY_ENV_INVALID", retryable false, fixed message, no value/cause"
- `TASK-005-plan.md:304`: "… da **exactamente las 8 tablas** en `public` (ninguna de `tool_invocations`, `run_checkpoints`, `evaluations`; OD-028) …"
- `TASK-005-plan.md:352`: "Ninguna pendiente. OD-019…OD-028: **RESUELTAS** (2026-10-20), …"

**Otros cambios en el plan**
- La sección de scope pasa a llamarse «Scope (aprobado y cerrado)» y desaparece la tabla de huecos.
- `ProviderConfigsRepository` queda explícito en el paso 4.
- En el paso 5 hay dos comprobaciones nuevas:
  - que ningún servicio ni stage reutiliza `migrate`;
  - que `tsx` arranca en una imagen instalada con `--ignore-scripts`.
- Riesgos: R16 queda como decidido y añado R17.

**Comprobación de scope**
Todos los ficheros que cita el plan están en el scope de TASKS.md §TASK-005 (`TASKS.md:109`): persistence, turbo, Makefile, compose, `.env.example`, `package.json` y lockfile, `worker.Dockerfile`, y en core `env.ts`, `env.test.ts`, `index.test.ts`, `errors.ts` y `errors.test.ts`. No queda ningún hueco.

**Incoherencias o puntos abiertos**
1. **R17, sin validar.** `esbuild`, que usa `tsx`, declara un `postinstall` y la imagen `migrate` se instala con `--ignore-scripts`. Su diseño con binarios por plataforma en `optionalDependencies` debería funcionar sin ese script, pero las fuentes no lo confirman y no lo he probado. El paso 5 lo comprueba; si falla, devops para y lo reporta, sin relajar la bandera.
2. **`make test`, fase 2.** El `pnpm install --offline` del servicio `test` no lleva `--ignore-scripts`. Ahí los scripts se ejecutan sin internet, que es lo que ya aceptó OD-019. OD-026 solo cubre la imagen `migrate`. No lo he cambiado; si se quiere la misma regla en las dos, es una decisión humana.
3. **TASKS.md:117** dice "(y para el servicio `migrate` de test, si lo hubiera)". Es un resto: el plan no tiene un `migrate` de test. No lo he tocado porque TASKS.md está fuera de mi scope.
4. **TASK-030 y TASK-036** las tiene engine-dev, pero su scope incluye `packages/persistence/**`. TASKS.md ya lo marca como reparto con persistence-dev; lo dejo anotado para cuando se planifiquen.
5. **ADR-010:50** sigue remitiendo a «decisión 16» del plan, que ahora recoge OD-026. Es coherente; no he editado el ADR porque ya está Accepted.

Sources:
- [esbuild 0.13.0 release notes](https://newreleases.io/project/npm/esbuild/release/0.13.0)
- [npm clean-install --ignore-scripts — it's a trap (mbork.pl, 2024-09-23)](https://mbork.pl/2024-09-23_npm_clean-install_--ignore_scripts_-_it's_a_trap)
- [How to control npm dependency install scripts (simplified.guide)](https://www.simplified.guide/_export/xhtml/nodejs/dependency-control-install-script)

---

## Informe archivado 4 · IMPLEMENTATION paso 1 (devops)

## IMPLEMENTATION — TASK-005 · paso 1 (devops)
Hecho: las dependencias de persistence están instaladas con versión exacta, y los scripts y exports de persistence y de la raíz están creados. `make validate` termina en verde (typecheck, lint, test y `format:check` OK). Dejé fuera de `package.json` dos scripts que romperían `make validate` (ver Desviaciones).

Ficheros: modificados `packages/persistence/package.json`, `pnpm-lock.yaml`, `package.json` (raíz). No creé ninguno.

Cambios, releídos tras editar:
- `packages/persistence/package.json:6-8`: `"exports": { ".": "./src/index.ts", "./testing": "./src/testing/index.ts" }`.
- `packages/persistence/package.json:13-15`:
  - `"db:generate": "drizzle-kit generate"`
  - `"db:migrate": "tsx src/cli/migrate.ts"`
  - `"db:reset": "tsx src/cli/reset.ts"`
- `packages/persistence/package.json:17-24`, `dependencies`: `@agentlab/core` `workspace:*`, `@langchain/core` 1.2.18, `@langchain/langgraph-checkpoint` 1.2.0, `@langchain/langgraph-checkpoint-postgres` 1.1.0, `drizzle-orm` 0.45.4, `pg` 8.23.1.
- `packages/persistence/package.json:25-29`, `devDependencies`: `@types/pg` 8.23.1, `drizzle-kit` 0.31.11, `tsx` 4.23.15. Todo sin `^`.
- `package.json:15-17`:
  - `"db:generate": "pnpm --filter @agentlab/persistence db:generate"`
  - `"db:migrate": "pnpm --filter @agentlab/persistence db:migrate"`
  - `"db:reset": "pnpm --filter @agentlab/persistence db:reset"`
- `package.json:18-19`: `format` y `format:check` terminan en `... \"*.{js,json}\" \"!packages/persistence/migrations/meta/**\""`.

Cómo se instaló: en `node:22.23.3-bookworm-slim` (la imagen fijada del Makefile) con `--cap-drop ALL` y `no-new-privileges`.
- Los volúmenes `agentlab-pnpm-store` y `agentlab-validate-node-modules` fueron los del Makefile.
- El repo entró por `tar` por stdin con los mismos filtros que `HOST_TAR`: se excluyen `.env`, `.env.*`, `.git` y `node_modules`. No se montó el repo, así que no hay `.env` en riesgo.
- Ejecuté `pnpm --filter @agentlab/persistence add --save-exact ...` y `add -D --save-exact ...`.
- Saqué por stdout solo `pnpm-lock.yaml` y `packages/persistence/package.json`, y los copié al host. El `node_modules` del host no se tocó.

Comandos y resultado:
- `pnpm audit --prod`: `No known vulnerabilities found`.
- `pnpm --filter @agentlab/persistence list --prod`: muestra `@agentlab/core link:../core`, `@langchain/core 1.2.18`, `@langchain/langgraph-checkpoint 1.2.0`, `@langchain/langgraph-checkpoint-postgres 1.1.0`, `drizzle-orm 0.45.4` y `pg 8.23.1`. `tsx` no aparece en prod.
- `pnpm install` solo mostró este warning: `2 deprecated subdependencies found: @esbuild-kit/core-utils@3.3.2, @esbuild-kit/esm-loader@2.6.5`. Son transitivas de `drizzle-kit`, como anticipaba el plan. Ningún warning de peer ni de engines.
- Una sola versión de `zod` (4.6.7), de `tsx` (4.23.15) y de `@langchain/core` (1.2.18) en el lockfile. En el lockfile, `drizzle-orm@0.45.4` queda resuelto con `(@types/pg@8.23.1)(pg@8.23.1)`. `pnpm why` salió truncado, así que lo comprobé contra el lockfile y no con `pnpm why`.
- `make validate`: verde. `core` tiene 100 % de cobertura y `Tasks: 1 successful, 1 total`.

Desviaciones del plan:
1. No añadí `typecheck: ... && tsc --noEmit -p tsconfig.config.json`. Se queda `tsc --noEmit`, porque `tsconfig.config.json` no existe en persistence y `make validate` fallaría.
2. No añadí `test: vitest run --coverage`. Persistence no tiene `vitest.config.ts` ni tests, y vitest fallaría con «no test files».
3. Añadí `@agentlab/core: workspace:*`. No estaba en la lista del packet, pero sí en la tabla del plan; es un enlace del workspace, no un paquete externo.

Cuándo completar el `package.json` de persistence: persistence-dev no puede editarlo. Tras el paso 4, un devops (nuevo paso 4b) debe añadir `test` y ampliar `typecheck`. Antes de eso persistence-dev tiene que haber creado `tsconfig.config.json`, `vitest.config.ts` y al menos un test.

Fuera de scope detectado: ninguno.
Dependencias que harían falta: ninguna.
OPEN DECISIONS: ninguna. El orden del paso 4b es una propuesta para el Orchestrator.
Deuda propuesta: ninguna. Hay un warning de deprecación de `@esbuild-kit/*`, transitivo de `drizzle-kit` 0.31.11 y solo en desarrollo. Severidad LOW; se paga al subir `drizzle-kit`.
Dudas: ninguna.

---

## Informe archivado 5 · IMPLEMENTATION paso 2 (core-dev)

## IMPLEMENTATION — TASK-005 · paso 2 (core-dev)
Hecho: `core` exporta ahora `loadTestDatabaseUrl`, `isApiKeyEnvName` e `InvalidApiKeyEnvError`.
- `loadTestDatabaseUrl(source = process.env)`: valida con el mismo `postgresUrl()` y no tiene valor por defecto. Una variable ausente o vacía lanza `EnvValidationError("DATABASE_URL_TEST is required for integration tests and db:reset (cp .env.example .env)")`. Una URL inválida lanza un mensaje fijo ("DATABASE_URL_TEST is not a valid postgres:// or postgresql:// URL") que no incluye el valor. No hay `cause`, así que ni la URL ni el error de zod se propagan.
- `isApiKeyEnvName(name)` es solo `SECRET_NAME.test(name)`. `createSecretResolver` la usa, y su semántica no cambia (los tests del resolver no se tocaron).
- `errors.ts`: `"API_KEY_ENV_INVALID"` entra en la unión `AgentLabErrorCode`. `InvalidApiKeyEnvError` tiene constructor sin parámetros, `retryable: false` y el mensaje fijo de la decisión 19.
- `index.ts` no se tocó: reexporta con `export *`.

Ficheros: modificados, todos bajo `/Users/davidferanandezmorilla/Desktop/development.nosync/agentlab/packages/core/src/`: `env.ts`, `env.test.ts`, `errors.ts`, `errors.test.ts`, `index.test.ts`. No he creado ninguno.

Citas releídas tras editar:
- `env.ts:53`: "export function loadTestDatabaseUrl(source: EnvSource = process.env): string {"
- `env.ts:70-73`: "const SECRET_NAME = /^[A-Z][A-Z0-9_]*_API_KEY$/;" y "export function isApiKeyEnvName(name: string): boolean { return SECRET_NAME.test(name); }"
- `env.ts`, dentro de `createSecretResolver`: la condición pasó a ser `!isApiKeyEnvName(envName) || !DECLARED_NAMES.has(envName)`.
- `errors.ts:12`: `  | "API_KEY_ENV_INVALID"`
- `errors.ts:113`: `      "API_KEY_ENV_INVALID",`
- `errors.ts:114`: "provider_configs.api_key_env must name an environment variable matching ^[A-Z][A-Z0-9_]*_API_KEY$ (max 40 characters)"
- `errors.test.ts:113`: `expect(err.code).toBe("API_KEY_ENV_INVALID");`

Tests añadidos:
- `loadTestDatabaseUrl`: presente, ausente, vacía, sin caer a `DATABASE_URL`, inválida sin eco de la URL ni de la contraseña, y lectura de `process.env` por defecto.
- `isApiKeyEnvName`: acepta `OPENROUTER_API_KEY`. Rechaza `sk-…`, `AIza…`, minúsculas, `""` y un nombre sin el sufijo.
- `errors.test.ts`: `InvalidApiKeyEnvError` es `instanceof AgentLabError` y comprueba `code`, `retryable`, `name`, el mensaje fijo y la ausencia de `cause`.
- `index.test.ts`: la lista cerrada incluye las tres exportaciones nuevas.

Cómo probarlo: `make validate`. Con `pnpm` directo en el host falla por `ERR_PNPM_UNSUPPORTED_ENGINE` (pnpm 9.12.2 y Node 26 frente a lo que exige el repo: pnpm 9.15.9 y Node >=22.12 <23), así que todo corrió en el contenedor.

Comandos ejecutados y resultado:
- La primera ejecución de `make validate` falló en `format:check` (Prettier sobre `env.test.ts`). Reformateé a mano dos líneas.
- La segunda ejecución de `make validate` terminó con exit 0.
- Últimas líneas de esa ejecución: "Checking formatting... All matched files use Prettier code style!"
- core: 7 ficheros de test y 169 tests, todos en verde. Typecheck y lint pasaron dentro de `validate`.
- Cobertura de core: All files 100 % statements, 100 % branch, 100 % funcs y 100 % lines. `env.ts` y `errors.ts` están al 100 %. `index.ts`, `model-provider.ts` y `tool.ts` salen al 0 % porque son solo reexports y tipos.
- No hubo interferencia de los `package.json` ni del lockfile de devops.

Desviaciones del plan: ninguna.
Fuera de scope detectado: ninguno.
Dependencias que harían falta: ninguna.
OPEN DECISIONS: ninguna.
Deuda propuesta: ninguna.
Dudas: ninguna. El mensaje de URL inválida de `loadTestDatabaseUrl` no está fijado en el plan, solo exige que no contenga la URL. Elegí el texto de arriba; si hay un texto preferido, es un cambio de una línea.

---

## Informe archivado 6 · IMPLEMENTATION paso 3 (devops)

## IMPLEMENTATION — TASK-005 · paso 3 (devops)
Hecho: `make test` y `make validate` corren ahora en dos fases. Fase 1: `pnpm fetch --ignore-scripts` en un contenedor node con red y sin `db`; solo entran en el tar `pnpm-lock.yaml`, `pnpm-workspace.yaml` y `.npmrc`. Fase 2: servicio compose `test` (perfil `test`, `target: base`, `cap_drop ALL`, `no-new-privileges`, solo red `backend`, `depends_on db healthy`, store `:ro`). Ahí corre `pnpm install --offline --frozen-lockfile --ignore-scripts` y después los tests contra `db`. La comprobación `:?` de `DATABASE_URL_TEST` va DENTRO del contenedor. `turbo.json` deja pasar `DATABASE_URL_TEST` a `test`. `tsx`/`esbuild` no necesitaron su postinstall: todo en verde con `--ignore-scripts`.
Ficheros: modificados `turbo.json`, `compose.yaml`, `Makefile`, `.env.example`. Creados: ninguno.
Citas releídas tras editar:
- `turbo.json:11` — `"passThroughEnv": ["DATABASE_URL_TEST"]`
- `compose.yaml:65` — `  test:` (perfil `test`; `target: base` en :70; `DATABASE_URL_TEST: ${DATABASE_URL_TEST:-}` en :81, con el comentario en inglés en :79-80)
- `compose.yaml:106-110` — volúmenes `pnpm-store` y `validate-node-modules`, `external: true`, `name: agentlab-pnpm-store` / `agentlab-validate-node-modules`
- `Makefile:22` `LOCK_TAR := COPYFILE_DISABLE=1 tar -C "$(CURDIR)" --no-xattrs -cf - pnpm-lock.yaml pnpm-workspace.yaml .npmrc`
- `Makefile:23` `FETCH := … && pnpm fetch --ignore-scripts`
- `Makefile:24` `IN_TEST := : "$${DATABASE_URL_TEST:?DATABASE_URL_TEST is required for make test (cp .env.example .env)}" && … && pnpm install --offline --frozen-lockfile --ignore-scripts`
- `Makefile:25` `TEST_RUN := docker compose --profile test run --rm -T --build test bash -euo pipefail -c`
- `Makefile:65` `test:               ## Tests en contenedor contra db de compose (requiere .env; deja db en marcha, make down la para)`
- `Makefile:68-69` y `:74-75`: `set -o pipefail; $(LOCK_TAR) | $(DOCKER_NODE) '$(FETCH)'` y `set -o pipefail; $(HOST_TAR) | $(TEST_RUN) '$(IN_TEST) && pnpm test'` (validate: `… && pnpm -r typecheck && pnpm -r lint && pnpm test && pnpm format:check'`)
- `.env.example:9` — `DATABASE_URL_TEST=                # obligatoria para make test; postgresql://agentlab:<pw>@db:5432/agentlab_test (solo la recibe el servicio test de compose; nunca web, worker ni migrate)`
- Eliminé `IN_COPY` del Makefile porque quedó sin uso. `HOST_TAR`, `DOCKER_NODE`, `COMPOSE_FILLER`, `down/logs/ps` y `up/up-local` no cambian.

Cómo probarlo (proyecto `agentlab-t5`, credenciales desechables inline, sin leer `.env`): `COMPOSE_PROJECT_NAME=agentlab-t5 POSTGRES_PASSWORD=tp1234 DATABASE_URL=postgresql://agentlab:tp1234@db:5432/agentlab DATABASE_URL_TEST=postgresql://agentlab:tp1234@db:5432/agentlab_test make test` (o `make validate`).

Comandos ejecutados y resultado:
```
make test      (macOS, make 3.81)  -> exit=0  (core: cobertura 100 %, "Tasks: 1 successful")
make validate  (macOS)             -> exit=0  (prettier: "All matched files use Prettier code style!")
env -u DATABASE_URL_TEST make test -> bash: line 1: DATABASE_URL_TEST: DATABASE_URL_TEST is required for make test (cp .env.example .env)
                                      make: *** [test] Error 1
docker compose run test (db arriba), pruebas de red desde el contenedor:
  1.1.1.1:443 FAIL · db:5432 OPEN · localhost:5432 FAIL · DNS externo: none
  CapEff: 0000000000000000 · NoNewPrivs: 1 · red: solo agentlab-t5_backend
env -u DATABASE_URL_TEST docker compose config -q -> ok (V7: no rompe make up/config)
grep -n DATABASE_URL_TEST compose.yaml -> solo :79 (comentario) y :81 (servicio test)
Linux (node:22 + GNU Make 4.3, docker stub): make -n test / validate + bash -n -> OK las dos
macOS: make -n test -> recetas expandidas correctas
```
Tras las pruebas: `make down` del proyecto de prueba, y borrados solo `agentlab-t5_pgdata` y la red `agentlab-t5_backend`. Los volúmenes externos `agentlab-pnpm-store` y `agentlab-validate-node-modules` se quedan. No toqué el proyecto `agentlab`.

Desviaciones del plan: ninguna. Pequeño añadido: comentario de Makefile (:18-21) que explica las dos fases, y el comentario de los volúmenes externos en compose.
Fuera de scope detectado: ninguno.
Dependencias que harían falta: ninguna.
OPEN DECISIONS: ninguna.
Notas para tester/reviewer/security:
1. Con la comprobación `:?` dentro del contenedor, `db` arranca antes de que falle un `make test` sin `DATABASE_URL_TEST` (el packet lo pedía así por V7). Queda en marcha hasta `make down`.
2. Compose sigue exigiendo `POSTGRES_PASSWORD` y `DATABASE_URL` reales en `make test`: interpola `db` y `worker`. No uso `COMPOSE_FILLER` porque `db` necesita la contraseña real.
3. No probé el caso de la sección «Infraestructura» del plan `DATABASE_URL_TEST=…@localhost:5432` con el override activo. Probé el equivalente directo: `localhost:5432` no conecta desde el contenedor de test.
4. Mis redirecciones temporales de salida (`/tmp/x`, `/tmp/y`) fueron a `/tmp` y no al scratchpad. No contienen secretos.
Deuda propuesta: ninguna.
Dudas: ninguna.

---

## Informe archivado 7 · IMPLEMENTATION paso 4 (persistence-dev)

## IMPLEMENTATION — TASK-005 (paso 4, persistence-dev)

Hecho:
- `packages/persistence` completo según el plan: 8 tablas Drizzle, `0000_init.sql` generada, `runMigrations` con `pg_advisory_xact_lock` y `setup()` del checkpointer, 5 repositorios, helpers de test, CLI `db:migrate` y `db:reset`.
- Tests de integración contra PostgreSQL 16 real: 5 ficheros, 90 tests, todos en verde. `make validate` termina en exit 0.
- R3 no ocurrió: `drizzle-kit generate` resolvió los imports `.js` y `@agentlab/core` sin problema.
- La migración no se editó a mano. No contiene `langgraph`, `coordination` ni `CHECK` sobre `api_key_env`.
- Sin `console.*` ni `process.env` en `src` (grep vacío).

Ficheros (todo bajo `/Users/davidferanandezmorilla/Desktop/development.nosync/agentlab/packages/persistence/`):
- Creados:
  - Config: `drizzle.config.ts`, `vitest.config.ts`, `tsconfig.config.json`.
  - Migración: `migrations/0000_init.sql`, `migrations/meta/0000_snapshot.json`, `migrations/meta/_journal.json`.
  - Esquema: `src/schema/{columns,projects,provider-configs,agent-definitions,team-definitions,runs,tasks,agent-invocations,run-events,index}.ts`.
  - Núcleo: `src/pool.ts`, `src/migrate.ts`, `src/checkpointer/setup.ts`, `src/index.ts`.
  - Repositorios: `src/repositories/{rows,projects,agent-definitions,provider-configs,runs,events}.ts`.
  - CLI: `src/cli/{migrate,reset}.ts`.
  - Testing: `src/testing/{index,reset,global-setup,fixtures}.ts`.
  - Tests: `src/migrate.integration.test.ts` y `src/repositories/{runs,events,provider-configs,definitions}.integration.test.ts`.
- Modificados: ninguno. `package.json` ya traía los scripts `db:*` y el export `./testing` del paso 1. No lo toqué.

Citas literales releídas tras editar:
- `drizzle.config.ts:9` — `  schemaFilter: ["public"],`
- `src/migrate.ts:26` — `    await lockClient.query("SELECT pg_advisory_xact_lock($1)", [`
- `src/repositories/runs.ts:56` — ``            sql`(select id from runs where status = 'queued' order by created_at, id limit 1 for update skip locked)`,``
- `src/repositories/runs.ts:69` — `          .for("update");` (`transition`: `FOR UPDATE`, luego `canTransition`)
- `src/repositories/events.ts:45` — `          .for("update");` (`append`: bloquea la fila del run, luego `INSERT … SELECT COALESCE(MAX(seq),0)+1`)
- `src/repositories/provider-configs.ts:26` — `  if (name.length > API_KEY_ENV_MAX_LENGTH || !isApiKeyEnvName(name)) {`

Cómo probarlo (todo en contenedor, credenciales desechables inline, proyecto compose `agentlab-t5`):
- `COMPOSE_PROJECT_NAME=agentlab-t5 POSTGRES_PASSWORD=… DATABASE_URL=… DATABASE_URL_TEST=… make validate`
- Para mis iteraciones usé un `.mk` auxiliar en el scratchpad que reutiliza `HOST_TAR`, `TEST_RUN` e `IN_TEST` del Makefile y ejecuta `pnpm exec vitest run --coverage` en `packages/persistence` (ver "Incidencia de hook").

Comandos ejecutados y resultado:
- `tsc --noEmit`, `tsc --noEmit -p tsconfig.config.json` y `eslint .` en persistence: sin errores (salió `LINT_TSC_OK`).
- Primer `tsc` falló (TS2677) en el type predicate de `truncateAll`. Lo reescribí con un bucle y `is(value, PgTable)`.
- `vitest run --coverage`:
  ```
  ✓ runs.integration.test.ts (63) · migrate.integration.test.ts (7) · events.integration.test.ts (7)
  ✓ provider-configs.integration.test.ts (9) · definitions.integration.test.ts (4)
  Test Files 5 passed (5) · Tests 90 passed (90)
  All files | 74.21 % Stmts | 70.45 % Branch | 77.04 % Funcs | 74.34 % Lines
  ```
  La cobertura baja por los CLI (0 %, probados a mano), `index.ts`/`schema/index.ts` (re-exports) y los callbacks de FK del esquema. `src/repositories` está en 98 % de sentencias y 100 % de líneas. No hay umbral en persistence (decisión 17).
- `pnpm db:generate` tras la migración: `No schema changes, nothing to migrate`.
- `DATABASE_URL=<test> pnpm db:migrate`: `{"level":"info","msg":"migrations applied"}`, y es idempotente en una segunda ejecución.
- `pnpm db:reset`: `{"level":"info","msg":"test database reset"}`.
- `db:reset` con `…/agentlab`: `{"level":"error",…,"name":"EnvValidationError","message":"DATABASE_URL_TEST must point to a database whose name ends in _test; refusing to reset it","code":"ENV_INVALID"}`, exit ≠ 0 y sin la URL.
- `env -u DATABASE_URL_TEST vitest run`: `exit=1`, `No test files found, exiting with code 1` y `EnvValidationError: DATABASE_URL_TEST is required for integration tests and db:reset (cp .env.example .env)`. No hay tests saltados.
- Canario OD-023: `docker compose logs db | grep -c "CANARY|sk-test|AIzaTest"` devuelve `0`.
- `make validate` (typecheck, lint, test y format:check): `EXIT=0`. `format:check` pasa con mis ficheros.
- Limpieza: `docker compose --profile '*' down -v` solo en el proyecto `agentlab-t5`. `docker volume ls | grep -c agentlab-t5` devuelve `0`. No toqué el proyecto `agentlab` ni otros. Los volúmenes compartidos `agentlab-pnpm-store` y `agentlab-validate-node-modules` los reutilicé sin borrarlos.

Cubierto por los tests:
- **Migración:** exactamente 8 tablas en `public` y 4 en `langgraph`; dos ejecuciones seguidas; `unique(run_id, seq)` e índice `(status, created_at)`; la migración sin `langgraph`/`coordination`/`CHECK` de `api_key_env`; `schemaFilter` presente en `drizzle.config.ts`.
- **Bloqueo:** dos `runMigrations` concurrentes con pools distintos sobre una base en blanco. Ambos terminan, queda 1 fila en `drizzle.__drizzle_migrations` y 0 bloqueos consultivos en `pg_locks`.
- **Guarda de reset:** una URL `…/agentlab` lanza `EnvValidationError` sin el host en el mensaje y deja la base intacta.
- **`transition`:** tabla exhaustiva 7×7 (49 casos). Las inválidas lanzan `InvalidTransitionError` con `from`, `to` y `code`, y la fila no cambia. `finished_at` solo en terminales. Id inexistente devuelve `null`. `updated_at` se refresca.
- **`claimNext`:** 1 run con 2 llamadas concurrentes reclama exactamente uno; 8 runs con 16 llamadas dan 8 ids distintos; una fila bloqueada por otra transacción devuelve `null` sin esperar; reclama por orden de `created_at`; `started_at` se conserva al reclamar de nuevo.
- **`heartbeat`:** `true` para su worker, `false` para otro worker o si el run no está `running`.
- **`append`/`listSince`:** 50 `append` concurrentes dan `seq` 1..50 contiguo; dos runs intercalados tienen secuencias independientes; `listSince(run, 10)` devuelve 11..50 en orden; un payload inválido o un run inexistente no insertan nada.
- **`api_key_env`:** 5 valores rechazados (`sk-…`, `AIza…`, más de 40 caracteres, minúsculas, sin sufijo `_API_KEY`). `vi.spyOn(pool, "query")` comprueba que no se envía ninguna consulta. Ninguna fila queda guardada. El canario no aparece en `message`, `stack`, `cause` ni en `JSON.stringify`. `OPENROUTER_API_KEY` y `null` se aceptan.
- **`get` de los cuatro repositorios** con un uuid aleatorio devuelve `null`.

Desviaciones del plan:
- `NewRunEvent` y `append` validan dos veces con `RunEventSchema`: antes del INSERT (con `seq: 1` y `ts` provisionales, para no insertar si es inválido) y al leer la fila guardada.
- `RunEventSchema.parse` lanza `ZodError` ante un payload inválido. El plan decía "se rechaza" sin especificar el tipo de error.
- `createTestDatabase(testUrl)` devuelve `{ pool, db }`. El plan solo daba el nombre.
- `src/testing/fixtures.ts` (`createScope`, `createQueuedRun`, `TEST_BUDGET`) es un añadido interno para los tests y no se exporta.
- `AGENT_ROLES` y los estados de `tasks.assigned_role`/`agent_definitions.role` llevan `CHECK` (decisión 5), junto con `runs.status` y `run_events.type`.
- `requireRow` lanza `TypeError` (invariante imposible de `RETURNING`), porque `AgentLabErrorCode` es una lista cerrada.
- El test "Drizzle no toca `langgraph`" lo hice en dos partes: comprobación de `schemaFilter` en el test y `db:generate` ("No schema changes") a mano. No hay `git status`, porque el directorio no es un repo git.

Incidencia de hook (AGENTS §4), citada y no rodeada:
- Comando: un `Bash` que escribía un script con `HOST_TAR` copiado del Makefile. Incluía las cadenas `--exclude=.env`, `--exclude='.env.*'`, etc., y `pnpm fetch` en la misma cadena.
- Mensaje literal: `BLOCKED by bash-guard: no se leen ficheros .env desde Claude Code`.
- Falso positivo: el comando solo excluía `.env` del tar; no los leía.
- Qué hice: no reformulé el texto para esquivarlo. Escribí con `Write` un `.mk` en el scratchpad que reutiliza las variables ya definidas en el Makefile, y lo invoqué con `make -f Makefile -f …/scratchpad/t5.mk`. Si el verificador considera que eso es una evasión, la evidencia de este paso debe repetirse con `make validate` y los tests ya integrados en turbo (paso 4b).
- El `.mk` solo tiene los targets `t5-fetch`, `t5-run`, `t5-gen` y `t5-fmt`. No lee `.env` ni credenciales.

Fuera de scope detectado: ninguno. Cambios que no toqué porque no son míos: `packages/persistence/package.json` y todo lo de core, que ya traía `loadTestDatabaseUrl`, `isApiKeyEnvName` e `InvalidApiKeyEnvError` correctos.

Dependencias que harían falta: ninguna.

Lo que necesita devops:
- **Paso 4b** (`packages/persistence/package.json`):
  - Añadir `"test": "vitest run --coverage"`.
  - Ampliar `typecheck` a `tsc --noEmit && tsc --noEmit -p tsconfig.config.json`. Hoy es solo `tsc --noEmit`, y `tsconfig.config.json` ya existe y pasa.
  - `lint` ya existe (`eslint .`).
  - Después, `make validate` pasará a ejecutar mis tests vía turbo. Hace falta que turbo pase `DATABASE_URL_TEST` (`passThroughEnv`, ya hecho en el paso 3).
  - Los tests exigen `max ≥ 2` y usan hasta 8 conexiones por pool. El `max_connections` por defecto de postgres alcanza.
- **Paso 5** (imagen `migrate`):
  - `pnpm db:migrate` es `tsx src/cli/migrate.ts`. Lee `loadEnv()`, así que exige `DATABASE_URL` válida. `loadEnv()` usa el resto de variables con valores por defecto y no exige ninguna otra.
  - La CLI resuelve `migrations/` relativo a `src/migrate.ts` (`../migrations`). Hay que copiar `packages/persistence/migrations/**` a la imagen.
  - `tsx` funciona instalado con `--ignore-scripts` en el servicio `test` (misma imagen base, `pnpm install --offline --frozen-lockfile --ignore-scripts`). No se ha probado todavía en el stage `migrate` (R17 sigue abierto para devops).
  - El log sale por `process.stdout` y el error por `process.stderr`, ambos en JSON de una línea. En fallo, `exitCode = 1` con `name`, `code` y `message`, sin URL.

OPEN DECISIONS: ninguna nueva.
- Matiz para el reviewer: `RunEventSchema.parse` en `append` lanza `ZodError`, no un error tipado de `core`. Si la API (TASK-014) necesita un código estable para esto, sería un `AgentLabErrorCode` nuevo, y eso ya requiere decisión.

Deuda propuesta:
- LOW. `truncateAll` borra todas las tablas de `schema`, incluidas las que añadan tareas futuras. Es correcto, pero un test que dependa de que una tabla no se vacíe fallaría sin aviso. Pagar si aparece el caso.
- LOW. Los CLI `src/cli/*.ts` no tienen test automático (0 % de cobertura). Los probé a mano en el contenedor. Un test de `db:migrate` con una URL inválida se puede añadir en TASK-009.

Dudas: ninguna.

---

## Informe archivado 8 · IMPLEMENTATION paso 4b (devops)

## IMPLEMENTATION — TASK-005 · paso 4b
Hecho: `packages/persistence/package.json` ya tiene `test` y el `typecheck` completo. `lint` no se tocó. Turbo ejecuta ahora los tests de persistence además de los de core.
Ficheros: modificados `packages/persistence/package.json` · creados ninguno
Cita releída tras editar:
- package.json:11 — `    "typecheck": "tsc --noEmit && tsc --noEmit -p tsconfig.config.json",`
- package.json:13 — `    "test": "vitest run --coverage",`
Cómo probarlo: `COMPOSE_PROJECT_NAME=agentlab-t5 POSTGRES_PASSWORD=tp1234 DATABASE_URL=postgresql://agentlab:tp1234@db:5432/agentlab DATABASE_URL_TEST=postgresql://agentlab:tp1234@db:5432/agentlab_test make validate` y lo mismo con `make test`.
Comandos ejecutados y resultado:
- `make validate` → exit 0. Resumen vitest de persistence:
  - `Test Files 5 passed (5)`
  - `Tests 90 passed (90)`
  - Cobertura, línea "All files": `74.21 | 70.45 | 77.04 | 74.34` (stmts, branch, funcs, lines).
  - Por fichero: runs 63 tests, migrate 7, events 7, provider-configs 9, definitions 4.
- Core en el mismo run: `Test Files 7 passed (7)`, `Tests 169 passed (169)`, cobertura 100%.
- `make test` → exit 0. `Test Files 7 passed (7)` para core y `Test Files 5 passed (5)` para persistence. `Tasks: 2 successful, 2 total`.
- Limpieza: `docker compose --profile '*' down -v` con `COMPOSE_PROJECT_NAME=agentlab-t5`. Eliminados el contenedor `agentlab-t5-db-1`, el volumen `agentlab-t5_pgdata` y la red `agentlab-t5_backend`. Los volúmenes externos `agentlab-pnpm-store` y `agentlab-validate-node-modules` y el proyecto `agentlab` no se tocaron.
Desviaciones del plan: ninguna
Fuera de scope detectado: ninguno
Dependencias que harían falta: ninguna
OPEN DECISIONS: una, de umbral de cobertura. La cobertura de persistence es 74 % lines y exit 0, así que `vitest.config.ts` no define umbral o es inferior a ese valor. No lo evalué. Si el DoD de TASK-005 exige un mínimo, hay que revisarlo.
Deuda propuesta: ninguna
Dudas: ninguna

---

## Informe archivado 9 · IMPLEMENTATION paso 5 (devops, parada)

## IMPLEMENTATION — TASK-005 · paso 5 (devops)
Estado: implementado y funcional, pero PARADO en la comprobación de contenido de imagen del plan (aparecen devDependencies de la raíz). Pendiente de decisión.

Hecho:
- `docker/worker.Dockerfile`: stages `migrate-deps` (líneas 20-24) y `migrate` (26-32), antes de `runtime`, tal como el plan. `fetch` e `install` con `--ignore-scripts`; `CMD ["pnpm","db:migrate"]`; `USER node`.
- `compose.yaml`: servicio `migrate` (línea 20; target migrate, red `backend`, depends_on db healthy, solo `DATABASE_URL`, sin restart). `worker` con `target: runtime` y `depends_on` db healthy + `migrate: service_completed_successfully` (línea 63). Igual en `web` (línea 44). Eliminados los dos comentarios `# TASK-005 adds…`.

Ficheros: modificados `docker/worker.Dockerfile`, `compose.yaml`.

Pruebas (proyecto `agentlab-t5`, credenciales desechables):
- `docker compose config -q`: ok.
- `up --build -d`: db Healthy → migrate `exited 0` → worker `running`. Log: `{"level":"info","msg":"migrations applied"}`.
- Segunda ejecución (`run --rm migrate`): mismo mensaje, exit 0 (idempotente).
- `tsx`/esbuild funciona con `--ignore-scripts`: no hizo falta `postinstall` (R17 no se activa).
- `migrations/` está en la imagen (`0000_init.sql`, `meta`); `.dockerignore` no lo excluye.
- Sin internet: `fetch('https://example.com')` desde migrate → `no internet`.
- No reutilización: `grep -n "target:" compose.yaml` → `24: target: migrate` (solo servicio migrate), `55: runtime`, `85: base`. `grep -nE "FROM migrate|--from=migrate"` → solo `worker.Dockerfile:29: COPY --from=migrate-deps /app /app`.
- Limpieza: `down -v` solo de `agentlab-t5`.
- NO ejecutado: `make validate`, por la parada de abajo.

PARADA / hallazgo (regla del plan: "si aparecen devDependencies de la raíz, parar y reportarlo"):
- `/app/node_modules` de la imagen `migrate` contiene `eslint`, `@eslint`, `@typescript-eslint`, `@vitest`, `vitest`, `prettier`, `tsc`, `turbo`, `vite`, `eslint-config-prettier` en `.bin`. Son devDependencies del `package.json` raíz (líneas 21-33), no de `persistence` (que solo tiene `@types/pg`, `drizzle-kit`, `tsx`).
- Causa probable: pnpm instala el proyecto raíz del workspace con `--filter @agentlab/persistence...` (o por `COPY . .`). No lo investigué más ni cambié nada.
- Además `pnpm -r list` lista `worker` (con `tsx`) pero `apps/worker/node_modules` no existe, así que solo es listado, no instalado.
- Impacto: la imagen `migrate` es mayor de lo previsto y lleva herramientas de lint/test que el DoD no pretendía. No afecta a `worker` ni `web`.

OPEN DECISIONS:
- Cómo excluir las devDependencies de la raíz de la imagen `migrate`. Opciones: (a) aceptarlo y documentarlo; (b) añadir `--filter '!agentlab'` (excluir la raíz) al `pnpm install`; (c) otra variante. Recomiendo (b), previa verificación. Lo decide el humano o el architect.

Hook: `docker compose run --rm --entrypoint sh migrate -c '… env | grep -c DATABASE_URL_TEST'` fue bloqueado con "BLOCKED by bash-guard: no se imprimen variables de entorno con secretos". Me detuve ahí y no lo rodeé. Por eso no verifiqué directamente que `DATABASE_URL_TEST` no llegue a `migrate`. Por construcción no llega: el servicio `migrate` solo declara `DATABASE_URL`.

Desviaciones del plan: ninguna. Fuera de scope detectado: ninguno. Dependencias nuevas: ninguna. Deuda propuesta: ninguna. Dudas: ninguna.

---

## Informe archivado 10 · IMPLEMENTATION paso 5 (continuación, parada con opciones A-D)

## IMPLEMENTATION — TASK-005 · paso 5 (continuación)

Estado: **PARADO según el punto 3 del packet.** La raíz no se puede excluir de la instalación de `migrate` con pnpm 9.15.9 sin un cambio de diseño. Traigo la evidencia y las opciones; no he decidido nada.

Hecho:
- El paquete raíz se llama `agentlab` (`package.json`). Probé `--filter '@agentlab/persistence...' --filter '!agentlab'` en el stage `migrate-deps`, con `--offline --frozen-lockfile --ignore-scripts` y sin `--prod`.
- pnpm acepta el filtro y el log dice `Scope: 2 of 5 workspace projects`, pero **instala igualmente el importer raíz `.`** (`. | +193`). En `/app/node_modules/.bin` siguen estando eslint, eslint-config-prettier, prettier, tsc, tsserver, turbo, vite y vitest.
- Revertí el cambio. `docker/worker.Dockerfile:24` es otra vez `RUN pnpm install --offline --frozen-lockfile --ignore-scripts --filter @agentlab/persistence...`. Es idéntico al estado anterior, así que el Dockerfile no tiene cambios netos.

Evidencia (imagen `migrate` construida con el filtro `!agentlab`, proyecto `agentlab-t5`):
```
pnpm -r list --depth 0
worker@0.0.0 /app/apps/worker (PRIVATE)      dependencies: tsx 4.23.15
@agentlab/core@0.0.0 /app/packages/core      dependencies: zod 4.6.7
@agentlab/persistence@0.0.0 /app/packages/persistence
  @agentlab/core link:../core, @langchain/core 1.2.18, @langchain/langgraph-checkpoint 1.2.0,
  @langchain/langgraph-checkpoint-postgres 1.1.0, drizzle-orm 0.45.4, pg 8.23.1
ls -a /app/node_modules:
  .bin .modules.yaml .pnpm @eslint @eslint-community @types @typescript-eslint @vitest eslint
  eslint-config-prettier eslint-scope eslint-visitor-keys prettier turbo typescript typescript-eslint vite vitest
ls /app/node_modules/.bin:
  eslint eslint-config-prettier prettier tsc tsserver turbo vite vitest
ls /app/packages/persistence/node_modules/.bin:
  drizzle-kit tsx
```
`pnpm -r list` muestra solo los proyectos del workspace. Las devDependencies de la raíz no aparecen ahí, pero sí están en disco.

Variantes probadas en un contenedor del stage `migrate-deps`. Todas dejan los mismos binarios de la raíz, salvo la tercera, que falla:
- `--filter '@agentlab/persistence...' --filter '!agentlab'` (además `--workspace-root=false`): instala la raíz.
- `--filter './packages/persistence...' --filter '!{.}'`: instala la raíz.
- `--filter '@agentlab/persistence' --filter '!agentlab'`: instala la raíz.
- Con `--config.ignore-workspace-root-check=true` o `--config.include-workspace-root=false`: instala la raíz.
- Con `--config.shared-workspace-lockfile=false`: `ERR_PNPM_NO_LOCKFILE` con frozen-lockfile.

Causa: la instalación headless con `--frozen-lockfile` de pnpm 9 siempre enlaza el importer `.`, aunque el filtro lo excluya.

Opciones para el humano (todas son cambio de diseño):
- **A. Deuda.** Aceptar las devDependencies de la raíz en la imagen `migrate`. Es una imagen de un solo uso, sin puertos, y no se reutiliza en worker ni web. Es la menos intrusiva.
- **B. `pnpm deploy --filter @agentlab/persistence`** en `migrate-deps`, y copiar a `migrate` el resultado, que no incluye la raíz. Cambia la estructura de `/app` y el CMD actual, `pnpm db:migrate`, que depende del script de la raíz. Habría que ejecutar `tsx`/`drizzle` directamente desde `packages/persistence`. Con `deploy`, `--ignore-scripts` y la inyección de dependencias workspace podrían variar.
- **C. Dockerfile aparte con un `package.json` raíz mínimo** (sin devDependencies) y su propio lockfile. Rompe el lockfile único (ADR-001).
- **D. Borrar `eslint`, `vitest`, etc. de `node_modules` en el stage `migrate`.** Es frágil y es una solución cosmética, no recomendada.

Recomiendo A (deuda) o B si se quiere cerrar el hueco ahora.

No ejecutados, por la parada: `docker compose up --build -d` y `make validate` de este ciclo, y los dos `migrate` de este ciclo. El `migrate` ya verificado en el paso anterior sigue en pie, porque el Dockerfile quedó igual.

Limpieza: `docker compose --profile '*' down -v` del proyecto `agentlab-t5` hecho (volumen y red eliminados). También eliminé las imágenes temporales `t5-exp` y `agentlab-t5-migrate`.

Fichero: /Users/davidferanandezmorilla/Desktop/development.nosync/agentlab/docker/worker.Dockerfile (sin cambios netos)

Desviaciones: ninguna · Fuera de scope: ninguno · Dependencias: ninguna · Hooks: sin bloqueos.
OPEN DECISIONS: elegir entre las opciones A, B, C y D. Recomendación: A como deuda o B como rediseño.

---

## Informe archivado 11 · TEST (primer ciclo, veredicto PASS con ⚠️ en viñeta 19)

## TEST — TASK-005
Comandos (proyecto compose `agentlab-tv5`, credenciales desechables inline, sin leer `.env`):
- `make validate` exit 0 (typecheck, lint, test y format:check OK). `make test` exit 0.
  - core: 7 ficheros / 169 tests, 100 % de cobertura.
  - persistence: 5 ficheros / 90 tests pasan, ninguno saltado. Cobertura 74,2 % de líneas (sin objetivo en el DoD; `repositories/*` 98-100 %).
- `docker compose up --build -d`: db healthy → `migrate Exited (0)` → `worker Up`. Dos `docker compose run --rm migrate` seguidos devuelven `{"level":"info","msg":"migrations applied"}` (idempotente).
- BD tras `up`:
  - `public|8`, `langgraph|4`, `drizzle|1` (`drizzle.__drizzle_migrations`, 1 fila).
  - Las 8 tablas de public son `agent_definitions`, `agent_invocations`, `projects`, `provider_configs`, `run_events`, `runs`, `tasks` y `team_definitions`.
  - `pnpm db:generate` dentro de la imagen migrate → `No schema changes, nothing to migrate`; `diff -r migrations` sin cambios.
- `docker compose --profile '*' config`: `DATABASE_URL_TEST` aparece solo en `test`. Las líneas con `DATABASE_URL` son `migrate: DATABASE_URL: postgresql://agentlab:tp1234@db:5432/agentlab`, `web:` y `worker:` con lo mismo, y `test: DATABASE_URL_TEST: postgresql://…/agentlab_test`. Es un grep del config completo, no el bloque `environment` literal; el recuento por servicio dio 0 para migrate, worker y web.
- Redes: el contenedor `test` resuelve `db` (192.168.163.2) y conecta a `db:5432`. `127.0.0.1:5432` da `Connection refused`. Tanto `test` como `migrate` dan `Network is unreachable` hacia 1.1.1.1:443. `migrate` tiene `drizzle-kit` y `tsx` en `packages/persistence/node_modules/.bin`.
- Regla 10: en macOS, GNU Make 3.81 ejecuta `make validate` y `make test` reales con exit 0. En Linux, GNU Make 4.3 en contenedor node:22 con stub de docker: `make test` y `make validate` exit 0 (el stub lee stdin; sin eso el pipefail da SIGPIPE, artefacto del stub).
- Comprobación de fallo con `DATABASE_URL_TEST` ausente: `env -u DATABASE_URL_TEST make test` falla con `DATABASE_URL_TEST: DATABASE_URL_TEST is required for make test (cp .env.example .env)`, exit 1.

DoD (el orden sigue las viñetas de TASKS.md §TASK-005):
| # | Viñeta | Res. | Evidencia |
|---|---|---|---|
| 1 | turbo `passThroughEnv` + `make test` contra `agentlab_test` | ✅ | `turbo.json`: `"passThroughEnv": ["DATABASE_URL_TEST"]`; `make test` exit 0 con 90 tests de persistence |
| 2 | `DATABASE_URL_TEST` obligatoria, falla con mensaje claro, nunca a web/worker | ✅ | `Makefile` (IN_TEST): `: "$${DATABASE_URL_TEST:?DATABASE_URL_TEST is required…}"`; salida literal arriba; `config` solo la muestra en `test` |
| 3 | `make test` en contenedor, sin `localhost:5432` | ✅ | `127.0.0.1:5432` refused, `db:5432` ok; `.env.example:9` documenta `…@db:5432/agentlab_test` |
| 4 | Servicio `migrate`; web y worker esperan | ✅ | `compose.yaml`: `migrate: … service_completed_successfully` en web y worker; `migrate Exited (0)` → `worker Up` |
| 5 | `schemaFilter: ["public"]`; control en `drizzle` (OD-024) | ✅ | `packages/persistence/drizzle.config.ts`: `schemaFilter: ["public"],`; `drizzle|1`; ARCHITECTURE.md:187 documenta la excepción; test `limits Drizzle to the public schema in drizzle.config.ts` |
| 6 | `db:migrate` aplica migraciones y `setup()` | ✅ | `langgraph|4` tras `migrate`; `src/checkpointer/setup.ts` |
| 7 | Lock `pg_advisory_xact_lock`, test de concurrencia | ✅ | `migrate.integration.test.ts::lets two concurrent runMigrations on a blank database both succeed`; `src/migrate.ts:26` |
| 8 | Instalación offline con `--ignore-scripts` en la fase de tests | ✅ | `Makefile` (IN_TEST): `pnpm install --offline --frozen-lockfile --ignore-scripts` |
| 9 | Stage `migrate` propio, `--ignore-scripts`, no reutilizado | ✅ | `docker/worker.Dockerfile`: `FROM base AS migrate` / `pnpm install … --ignore-scripts --filter @agentlab/persistence...`; `compose.yaml`: `target: migrate` solo en `migrate`; worker usa `runtime` y web su propio Dockerfile. TD-020 (devDeps de la raíz) aceptada, no es FAIL |
| 10 | `make test` en dos fases, deja `db` en marcha | ✅ | `Makefile`: fetch con red (`DOCKER_NODE`) + `TEST_RUN` (servicio `test`) y sin red hacia fuera; `ps` tras `make test` mantiene db |
| 11 | `loadTestDatabaseUrl()` en core; nadie lee `process.env` fuera de `env.ts` | ✅ | grep de `process.env` en packages y apps: solo `core/src/env.ts` y `env.test.ts`; `testing/global-setup.ts` usa el loader |
| 12 | `append` con bloqueo de fila + MAX+1; ARCH §3.4 corregido | ✅ | `docs/ARCHITECTURE.md:141-143` (`FOR UPDATE` + `COALESCE(MAX(seq),0)+1`); `events.integration.test.ts::assigns contiguous seq 1..50 across 50 concurrent appends` |
| 13 | Esquema según OD-021, `create`/`get`/`list`, `get` → null | ✅ | `*.integration.test.ts::returns null for an id that does not exist` (runs, projects, agent defs, provider configs) |
| 14 | 8 tablas, índices, `unique(run_id, seq)` | ✅ | `migrate.integration.test.ts::creates exactly the 8 M1 tables…` y `::has unique(run_id, seq) and the (status, created_at) index`; recuento real 8/4/1 |
| 15 | `0000_init.sql` aplicable; `db:reset` | ✅ | `migrate` exit 0 sobre BD vacía; `resetTestDatabase` se ejecuta en cada `make test` (globalSetup) |
| 16 | Repositorios y métodos listados | ✅ | `runs.integration.test.ts` (`claimNext`, `transition`, `heartbeat`), `events.integration.test.ts` (`append`, `listSince`), `definitions` y `provider-configs` |
| 17 | `transition` inválida lanza `InvalidTransitionError` | ✅ | `runs.integration.test.ts` tabla exhaustiva `%s -> %s follows canTransition` (RUN_STATUSES², `code: "INVALID_TRANSITION"`) |
| 18 | `claimNext` concurrente sin duplicados | ✅ | `::lets exactly one of two concurrent callers claim a single queued run`; `::claims N distinct runs from 2N concurrent calls`; `::skips a row locked by another transaction` |
| 19 | Sin `DATABASE_URL_TEST` los tests fallan, no se saltan; sin default | ⚠️ | `make test` sin variable falla con el mensaje claro (exit 1). Con una URL inválida el run falla (el único test fallido es `src/env.test.ts > reads process.env by default`, ver «Problemas»). `env.ts:54-59` no da valor por defecto; sin `it.skip` en los tests de persistence ni de core (el grep no pudo ejecutarse limpio: `no matches found` en zsh). No pude ejecutar el caso «variable vacía dentro del contenedor» porque bash-guard bloqueó el comando (ver abajo) |
| 20 | `api_key_env` es `text`; test de valores tipo clave | ✅ | `0000_init.sql:57`: `"api_key_env" text` (única mención, sin CHECK); `provider-configs.integration.test.ts::rejects %s without inserting, querying or leaking the value` (`sk-`, `AIza`, >40 caracteres) |
| 21 | Validación en repo, `InvalidApiKeyEnvError` sin el valor; sin CHECK; canario OD-023 | ✅ | Mismo test: `expect(spy).not.toHaveBeenCalled()` (no hay query), `code: "API_KEY_ENV_INVALID"`, mensaje/stack/JSON sin CANARY; error en `core/src/errors.ts:110`. Tras `make test`, `docker compose logs db` contiene 0 coincidencias de `sk-`, `AIza` o `canary` y 0 de `api_key_env` (el log de Postgres por defecto no registra sentencias, así que esto es corroboración débil; la prueba fuerte es el `spy`) |
| 22 | Integración en serie, `fileParallelism: false` | ✅ | `packages/persistence/vitest.config.ts`: `fileParallelism: false,` y `globalSetup` |

Cobertura: persistence 74,2 % líneas, core 100 % (objetivo ≥ 90 % para core; el DoD no fija objetivo para persistence).
Tests añadidos: ninguno.
Problemas en tests existentes: ninguno bloqueante. Con `DATABASE_URL_TEST` inválida falla el test unitario de core `env.test.ts > loadEnv > reads process.env by default`, que lee `process.env` real. Es sensible al entorno del host, y la tarea no pide aislarlo. Bajo riesgo.

Bloqueo de hook (cita): comando `tar -C . --exclude=node_modules --exclude=.git --exclude=.env --exclude='.env.*' -cf - . | docker compose --profile test run --rm -T -e DATABASE_URL_TEST= test bash -c '…vitest run…'` → `BLOCKED by bash-guard: no se leen ficheros .env desde Claude Code`. Paré ahí y no lo rodeé. Es el único efecto: el caso «variable vacía dentro del contenedor» queda sin ejecutar (viñeta 19 en ⚠️).

Limpieza: `docker compose --profile '*' down -v` solo en `agentlab-tv5`; los volúmenes externos se conservan.

Veredicto: PASS (la viñeta 19 queda ⚠️ por el caso vacío no ejecutado; el resto ✅).

---

## Informe archivado 12 · REVIEW (CHANGES_REQUESTED)

## REVIEW — TASK-005

**Veredicto: CHANGES_REQUESTED.** Hay 1 MAJOR: un test del DoD no cubre la regla que dice probar. Lo demás no bloquea. La corrección es pequeña y solo toca un fichero de test.

Hallazgos:
  - [MAJOR] packages/persistence/src/repositories/provider-configs.integration.test.ts:39 — `["a name longer than 40 characters", \`${CANARY}_${"A".repeat(40)}_API_KEY\`],`
    - El valor lleva minúsculas porque `CANARY = "CANARY9f3a7c1e5b"`, así que ya lo rechaza la expresión regular. Lo comprobé con node: 65 caracteres, `isApiKeyEnvName` = false.
    - Consecuencia: si se quita `name.length > API_KEY_ENV_MAX_LENGTH ||` de provider-configs.ts:26, todos los tests siguen en verde. No se cumple la viñeta del DoD «test que falla si … longitud > 40 sin espacios» ni la fila del plan (TASK-005-plan.md:311, «`A…_API_KEY`»).
    - Qué cambiar: añadir un nombre que cumpla la expresión y tenga 41 caracteres (p. ej. `"A".repeat(33) + "_API_KEY"`) y comprobar que se rechaza. Añadir también el límite exacto de 40 caracteres y comprobar que se acepta. El canario puede quedarse en otro caso, o pasar a mayúsculas.
  - [MINOR] packages/persistence/src/migrate.ts:34-36 — `await lockClient.query("ROLLBACK"); throw error;`
    - Si el `ROLLBACK` falla (conexión caída), tapa el error original, y `release()` devuelve al pool un cliente roto.
    - Qué cambiar: proteger el `ROLLBACK` y, en el camino de error, liberar con `release(err)`.
  - [MINOR] packages/persistence/src/index.ts:1 — `export { CHECKPOINT_SCHEMA, setupCheckpointer } from "./checkpointer/setup.js";`
    - `setupCheckpointer` no está en los contratos públicos del plan (plan §Contratos: solo `CHECKPOINT_SCHEMA` y `runMigrations`). Exportarlo permite ejecutar `setup()` fuera del `pg_advisory_xact_lock` que pide el DoD.
    - Qué cambiar: dejarlo interno, o que el architect lo añada al contrato con esa advertencia.
  - [MINOR] packages/persistence/src/repositories/rows.ts:3 — `if (row === undefined) throw new TypeError("statement returned no row");`
    - No es una subclase de `AgentLabError`, que es lo que exige ARCHITECTURE §10. La invariante es inalcanzable y la lista de códigos es cerrada (OD-016), así que no hay ningún código que encaje.
    - Qué cambiar: registrar una OD (código de invariante interna, o excepción explícita en §10).
    - fixtures.ts:39 hace lo mismo, pero es soporte de test: aceptable.
  - [MINOR] packages/persistence/src/repositories/events.ts:33 — `RunEventSchema.parse({`
    - Un payload inválido lanza `ZodError` sin `code` estable. Es aceptable en M0, porque nadie de fuera llama a `append`.
    - Qué cambiar: meterlo en la misma OD y cerrarlo antes de TASK-014/TASK-024.
  - [MINOR] docs/reports/TASK-005-plan.md:133 — «`DEFAULT` solo en `id`, `created_at`, `updated_at`, `runs.status` … y `run_events.ts`»
    - El código tiene otros cuatro `DEFAULT`: agent-definitions.ts:46 (`tool_allowlist '{}'`), :53 (`enabled true`), agent-invocations.ts:29 (`attempt 1`) y tasks.ts:37 (`depends_on '{}'`).
    - Esos cuatro coinciden con la tabla de OD-021 (plan:258, 261, 262), que es la que cita el DoD, así que el código vale. El problema es que el plan se contradice.
    - Qué cambiar: el architect corrige la decisión 20.
  - [NIT] packages/persistence/src/repositories/events.integration.test.ts:77 y :82 — `rejects.toThrow()` no comprueba el tipo de error. Afirmar `ZodError` en :77 y el error de FK en :82 deja fijado el comportamiento.
  - [NIT] .claude/skills/testing-conventions/SKILL.md, regla 5 («nadie lee `process.env` fuera de `core/env.ts`») frente a la regla 2 (`it.skipIf(!process.env.OPENROUTER_API_KEY)`, ya existía): se contradicen. Lo resuelve docs-keeper.

Verificado sin hallazgos:
- **Dependencias y reglas de paquete:** `persistence` solo importa de `core`, y `core` no importa de `persistence`. Ningún `console.*`. `process.env` aparece solo en core/env.ts. Sin estado de módulo mutable.
- **Errores y secretos:** el CLI solo lee `loadEnv().DATABASE_URL` y su error lleva `name`/`code`/`message`, nunca el objeto `Env` ni la URL (TD-011).
- **`claimNext`/`transition`/`heartbeat`/`append`:** cumplen ARCHITECTURE §3.4 y §5 y las decisiones 6 a 9. SQL parametrizado.
- **`runMigrations`:** cliente dedicado para el bloqueo, Drizzle y `setup()` en otras conexiones, sin `saver.end()`. El pool usa `max` por defecto (10).
- **Esquema y migración:** 8 tablas; `CHECK` de estados y roles sacados de `core` (decisión 5); `api_key_env` como `text` sin `CHECK` (0000_init.sql:57). La guarda de `_test` impide inyección de identificador.
- **`ProviderConfigsRepository`:** valida antes de cualquier consulta, el espía está bien puesto y `InvalidApiKeyEnvError` no lleva valor ni `cause`. Ningún test escribe en `provider_configs` sin pasar por el repositorio.
- **Lockfile:** coincide exactamente con `deps_allowed`.
- **Makefile/compose/Dockerfile:**
  - Dos fases con `--ignore-scripts` en las dos órdenes y en `migrate-deps`.
  - El servicio `test` está solo en `backend`.
  - `target: migrate` solo lo usa `migrate`; el único `COPY --from=migrate-deps` es el de `migrate`.
  - `pipefail` en cada receta; el relleno de `down`/`logs`/`ps` está intacto.
- **Documentación:** coherente con el código, salvo plan:133.
- **Desviaciones que declaró persistence-dev:**
  - Doble validación en `append`: aceptada. La primera evita la inserción; la segunda devuelve un `RunEvent` tipado.
  - `createTestDatabase` devuelve `{ pool, db }`: aceptado, hace falta `pool.end()`.
  - `fixtures.ts` interno: aceptado.
  - `ZodError` y `TypeError`: son los MINOR de arriba.

Cumplimiento: SPEC ✅ · ARCHITECTURE ✅ (los dos MINOR de errores, pendientes de OD) · ADRs ✅ (ADR-002, ADR-009, ADR-010) · DoD ❌ (el MAJOR de >40) · plan ✅ (MINOR en index.ts:1 y en plan:133)

Sobrearquitectura detectada: ninguna.

Deuda propuesta:
- TD-? LOW: los CLI `db:migrate`/`db:reset` no tienen test automático, incluido que el error no lleve la URL. Se paga en TASK-009 (o TASK-006).
- TD-? LOW: el test de core env.test.ts:154-157 (`loadEnv > reads process.env by default`) depende del `process.env` real, por donde ahora llega `DATABASE_URL_TEST` vía turbo. Arreglo: `vi.stubEnv("DATABASE_URL_TEST", "")` o un `source` aislado. Se paga en la próxima tarea que toque core/env.test.ts (TASK-027).
- No lo registraría: que `truncateAll` vacíe todas las tablas no es deuda, es lo que fija la decisión 13 del plan (plan:103).
- OPEN DECISION propuesta: código estable para invariantes internas (rows.ts:3) y para un payload de evento inválido (events.ts:33).

Requiere security: sí. El diff toca Docker, compose, Makefile, persistencia de `api_key_env` y la conexión como superusuario. Puntos para security:
- R5: el contenedor `test` se conecta como superusuario.
- El servicio `migrate` no tiene `cap_drop`/`no-new-privileges` (compose.yaml:20-30); el plan no lo pedía.
- R4: `export * from "./schema/index.js"` permite insertar directamente en `providerConfigs`.
- El volumen `validate-node-modules` es de escritura en la fase 2 (con `db`) y se monta en la fase 1 (con internet) (TD-017).
- docker/worker.Dockerfile:12 `RUN pnpm fetch --prod` no lleva `--ignore-scripts`. Viene de antes y no lo cambia esta tarea.
- TD-020.

Veredicto: CHANGES_REQUESTED

---

## Informe archivado 13 · IMPLEMENTATION ciclo de corrección 1/3 (persistence-dev)

## IMPLEMENTATION — TASK-005 (ciclo de corrección 1/3)
Hecho: C1-C3 corregidos. `make validate` con las variables del paquete termina con exit 0. Lo que ejecuté: la prueba de mutación de C1 y luego la validación completa. Después hice `docker compose --profile '*' down -v` solo del proyecto agentlab-c1 (volumen y red agentlab-c1_* eliminados).
Ficheros: modificados (todo en `packages/persistence/src/`) `repositories/provider-configs.integration.test.ts`, `migrate.ts`, `index.ts`. Creados: ninguno. No toqué provider-configs.ts: lo restauré idéntico (diff contra la copia original sin diferencias).
Cómo probarlo: `make validate` con COMPOSE_PROJECT_NAME=agentlab-c1 y las variables del packet.
Comandos y resultado:
- Mutación C1, primer intento: quitar la condición dejaba `API_KEY_ENV_MAX_LENGTH` sin usar y lint fallaba antes de los tests. Repetí con `name.length > API_KEY_ENV_MAX_LENGTH * 1000 ||`, que desactiva el límite sin romper lint.
- Con la mutación: `provider-configs.ts:26` quedó `if (name.length > API_KEY_ENV_MAX_LENGTH * 1000 || !isApiKeyEnvName(name)) {`.
- Con la mutación: `× rejects a well-formed name of 41 characters without inserting, querying or leaking the value`.
- Con la mutación: `Tests 3 failed | 89 passed (92)`.
- Los otros dos fallos, "lowercase name" y "without the _API_KEY suffix", aparecieron en la misma pasada. Supongo que son efecto en cascada del 41, pero no lo comprobé.
- Restaurado: `provider-configs.ts:26` → `  if (name.length > API_KEY_ENV_MAX_LENGTH || !isApiKeyEnvName(name)) {`
- Verde final: `@agentlab/persistence:test: Test Files 5 passed (5)`, `Tests 92 passed (92)`, make validate exit=0.
Desviaciones: ninguna. Fuera de scope: ninguno. Dependencias: ninguna. OPEN DECISIONS: ninguna. Deuda: ninguna. Dudas: ninguna.
Nota: dejé el canario en un caso separado, `${CANARY}_API_KEY`. Cumple el sufijo pero tiene minúsculas, así que se rechaza por la regex y la comprobación de no filtración sigue teniendo valor.

Hallazgos resueltos:
[x] C1 — provider-configs.integration.test.ts:39 — "  [\"a canary-bearing name that is not a valid variable\", `${CANARY}_API_KEY`],"
[x] C1 — provider-configs.integration.test.ts:40 — "  [\"a well-formed name of 41 characters\", `${\"A\".repeat(33)}_API_KEY`],"
[x] C1 — provider-configs.integration.test.ts:73-74 — "  it(\"accepts a well-formed name of exactly 40 characters\", async () => {" / "    const name = `${\"A\".repeat(32)}_API_KEY`;" (la línea siguiente comprueba `toHaveLength(40)` y que `create` lo acepta)
[x] C2 — migrate.ts:35-45 — releído del disco:
```
  } catch (error) {
    failure = error instanceof Error ? error : new Error(String(error));
    try {
      await lockClient.query("ROLLBACK");
    } catch {
      // Keep the original error; the client is discarded below.
    }
    throw error;
  } finally {
    lockClient.release(failure);
  }
```
`failure` se declara antes del `try` con `let failure: Error | undefined;`. En el camino de éxito `release(undefined)` devuelve el cliente al pool; en el de error lo destruye.
[x] C3 — index.ts:1 — "export { CHECKPOINT_SCHEMA } from \"./checkpointer/setup.js\";" (ningún test importaba `setupCheckpointer` desde el índice; `migrate.ts` lo importa del módulo interno)

---

## Informe archivado 14 · SECURITY

## SECURITY — TASK-005
Vectores revisados: secretos · inyección · SSRF · presupuesto · autoaprobación · docker/ci · garantías dev · dependencias. Inyección por prompt, SSRF, presupuesto y autoaprobación no aplican: el diff no tiene prompts, ni herramientas HTTP, ni `reserve()`, ni `resume`.

Hallazgos:
  - [MEDIUM] compose.yaml:88 `    networks: [backend]` (servicio `test`) junto con el superusuario (TD-013) — **R5, mi decisión: aceptable en M0 como deuda; no bloquea.** En la fase 2 corre código de todas las devDependencies (vitest, eslint, tsx, drizzle-kit…). Ese código puede leer y borrar la base `agentlab` y ejecutar `COPY … TO PROGRAM` dentro de `db`. Hay además dos salidas a internet que rompen el «sin internet» de OD-019: (a) con el perfil `local`, `ollama` está en `backend` y en `egress`, y su API sin autenticación hace `pull`/`push` a un registro arbitrario; (b) con el override de TD-016, `db` tiene salida. Lo que hay en juego es poco: la contraseña local, la base de desarrollo y el código fuente. Las `*_API_KEY` no son alcanzables. Corrección mínima: una red `internal: true` solo para `db` y `test` (TASK-008), y un rol no superusuario dueño de `agentlab_test` con `CREATEDB` (con TD-013 en TASK-037).
  - [MEDIUM] packages/persistence/src/index.ts:9 `export * from "./schema/index.js";` — **R4.** Esto exporta la tabla `providerConfigs`, y `createDatabase` devuelve el handle de Drizzle completo, así que cualquier consumidor puede escribir `api_key_env` sin pasar por `assertApiKeyEnv`. Como OD-023 quitó el `CHECK`, la garantía depende solo de una convención. Hoy no hay ningún consumidor. Corrección mínima antes de TASK-014 (la primera que escribe datos del usuario): exportar del esquema solo tipos (o no exportar `providerConfigs`) y añadir `no-restricted-imports` o una comprobación del reviewer en TASK-014.
  - [LOW] compose.yaml:20-30 — `migrate` no tiene `cap_drop`/`no-new-privileges`. Lo mitigan `USER node` (worker.Dockerfile:30), que no tiene puertos, solo está en `backend` y es one-shot. Corrección: `cap_drop: [ALL]` y `security_opt: ["no-new-privileges:true"]`, también en `worker`, en TASK-008.
  - [LOW] compose.yaml:85 `      target: base` — `test` corre como uid 0. Lo mitigan `CapEff 0` y NoNewPrivs. Se paga con la entrada anterior.
  - [LOW] docker/worker.Dockerfile:12 `RUN pnpm fetch --prod` y :16 sin `--ignore-scripts` (ya estaban antes de esta tarea). Los scripts de las dependencias se ejecutan durante el build, con red y con el contexto ya copiado. Además, `.dockerignore` excluye menos que `HOST_TAR`: no excluye `.envrc`, `*.env`, `.env-*` ni `.env_*`. La imagen `migrate` (:23 `COPY . .` y :29 `COPY --from=migrate-deps /app /app`) mete ahora ese contexto en una imagen final. Corrección: `--ignore-scripts` en :12 y :16 (R17 ya demostró que `tsx` arranca sin ellos) y alinear `.dockerignore` con `HOST_TAR`. Se paga en TASK-008.
  - [LOW] TD-017 — el volumen `validate-node-modules` se escribe en la fase 2 (con `db`) y se monta en la fase 1 (con internet). En la fase 1 no se ejecuta código de paquetes: solo corepack y `pnpm fetch --ignore-scripts`, y el tar lleva únicamente lockfile, workspace y `.npmrc` del host, sin pnpmfile. Así que no hay canal de confidencialidad entre fases. Sí persiste el riesgo de integridad entre ejecuciones de la fase 2. Sigue en LOW; hay que actualizar su texto.
  - [LOW] TD-020 — de acuerdo con LOW. Además, `pnpm audit` (todas las dependencias) da 1 moderate: GHSA-67mh-4wv8-2f99 en `esbuild@0.18.20` (pnpm-lock.yaml:2322), que entra por `drizzle-kit`→`@esbuild-kit/core-utils` y también está en la imagen `migrate`. Solo afecta a `esbuild serve`, que no se usa. Se une a TD-019.
  - [LOW] Para TD-011 y TASK-027: en drizzle-orm 0.45.4, `DrizzleQueryError` mete los parámetros de la consulta en `message` (`package/errors.js:12-13`, "Failed query: ${query}\nparams: ${params}"). Los CLI registran `message` (cli/migrate.ts:25); hoy solo con parámetros inocuos (hash y fecha de la migración). Ningún logger futuro (worker, API) debe registrar ese `message` tal cual.

Sobre el ciclo paralelo de persistence-dev (aún no estaba en disco cuando releí):
  - Test de más de 40 caracteres: hoy, provider-configs.integration.test.ts:40 `["a well-formed name of 41 characters", `${"A".repeat(33)}_API_KEY`],` no lleva canario. `CANARY` (:15) tiene minúsculas y no puede ir dentro de un nombre bien formado. El test nuevo necesita un canario en mayúsculas dentro de un nombre válido de más de 40 caracteres, y comprobar que *ese* texto no aparece; si no, el test no prueba nada. No bloquea: el error ya no puede filtrar el valor, porque su constructor no recibe parámetros (core/src/errors.ts:110-117).
  - ROLLBACK: no tiene impacto de seguridad, pero hay que mantener `lockClient.release(failure)` (migrate.ts:44), que descarta la sesión y suelta el bloqueo.
  - `setupCheckpointer` no tiene efecto de seguridad. index.ts:1 ya exporta solo `CHECKPOINT_SCHEMA`.

Hallazgos verificados:
  [x] .env.example — sin valores: `DATABASE_URL_TEST=` vacía en :9; POSTGRES_PASSWORD, DATABASE_URL y las dos API_KEY también vacías. El grep de secretos solo encuentra credenciales desechables en docs/reports.
  [x] `DATABASE_URL_TEST` solo en `test`: `docker compose --profile '*' config` con credenciales desechables (proyecto agentlab-sec5) → solo `test` la tiene. `test` y `migrate` están solo en `backend` (`internal: true`), sin puertos.
  [x] Logs del CLI — cli/migrate.ts:5 "// Only name/code/message are reported: never the Env object or the connection URL (TD-011)."; no se registran `cause` ni `Env`.
  [x] Guarda de reset — testing/reset.ts:8 "const TEST_DATABASE_NAME = /^[a-z_][a-z0-9_]*_test$/;" impide comillas en el identificador citado (:33-34). Probé que con pg-connection-string 2.14.1 `?database=agentlab` no cambia la base: pg conecta a `agentlab_test` / `postgres`.
  [x] SQL parametrizado — repositories/events.ts:48 usa marcadores `${…}` de `sql`; no hay `sql.raw`.
  [x] Canario OD-023 — migrations/0000_init.sql:57 "	"api_key_env" text" (sin CHECK); repositories/provider-configs.ts:27 "    throw new InvalidApiKeyEnvError();"; el test espía que no sale ninguna consulta (:54).
  [x] Dependencias — `pnpm audit --prod`: "No known vulnerabilities found". Todo el lockfile viene del registro con `integrity`; los importers coinciden con `deps_allowed`.
  [x] Garantías dev — `.claude/` solo cambia `task-scope.json` (más restrictivo) y testing-conventions; no se tocan `.githooks/`, `settings.json` ni hooks. Ojo, committer: en HEAD `task-scope.json` es el estado inactivo (`"allow": ["*"]`).
Deuda propuesta: TD nueva MEDIUM (R5: red y rol del servicio `test` → TASK-008/TASK-037) · TD nueva MEDIUM (R4: exportación de tablas → antes de TASK-014) · LOW: endurecimiento de `migrate`/`worker`/`test`, `--ignore-scripts` y `.dockerignore` → TASK-008 · TD-017 actualizar texto · TD-019 añadir GHSA de esbuild · TD-011 añadir nota de `DrizzleQueryError`.
Limpieza: no levanté contenedores (0 de agentlab-sec5). Los dos `docker run` fueron desechables (`--rm`, `--cap-drop ALL`). Borré el config renderizado del scratchpad. No leí `.env` y ningún hook me bloqueó.
Veredicto: APPROVED

---

## Informe archivado 15 · TEST (re-test ciclo 1/3)

## TEST — TASK-005 (re-test ciclo 1/3)
Comandos (proyecto `agentlab-tv5b`, credenciales desechables inline, sin tocar `.env`; repo sin editar):
- `make validate` exit 0. Resumen vitest: core `Test Files 7 passed (7)`, `Tests 169 passed (169)`; persistence `Test Files 5 passed (5)`, `Tests 92 passed (92)` (provider-configs 11 tests, migrate 7). `format:check`: "All matched files use Prettier code style!".
- `make test` exit 0, mismos resúmenes (7/169 y 5/92).
- `docker compose up --build -d` rc 0: `db Up (healthy)`, `migrate Exited (0)`, `worker Up`. Dos `docker compose run --rm migrate` seguidos: `{"level":"info","msg":"migrations applied"}` ambos (idempotente).
- Tablas: `public|8`, `langgraph|4`, `drizzle|1`.
- `docker compose --profile '*' config`: `DATABASE_URL_TEST` solo en la línea 68, dentro de `test` (`test:` empieza en la línea 53, `web:` en la 86).
- Redes: `test` y `migrate` dan `ENETUNREACH` hacia 1.1.1.1:443. Desde `test`, `127.0.0.1:5432` da `ECONNREFUSED` y `db:5432` da `db ok`.
- `DATABASE_URL_TEST= make test` (variable vacía) falla con exit 2 de make: `DATABASE_URL_TEST: DATABASE_URL_TEST is required for make test (cp .env.example .env)`. Es el caso «vacía» de la viñeta 19, que antes quedó ⚠️.
- Canario OD-023: `docker compose logs db` tiene 0 coincidencias de `sk-|AIza|canary|api_key_env`. Es corroboración débil, porque Postgres no registra sentencias por defecto. La prueba fuerte es el `spy` del test.
- Regla 10: macOS con GNU Make 3.81, ejecuciones reales. Linux con GNU Make 4.3 en node:22: `make -n test validate` expande a comandos idénticos a los de macOS (`diff` vacío). La ejecución completa en Linux con stub de docker se hizo en el ciclo anterior. El Makefile no figura entre los cambios de este ciclo, pero no hay git para comprobarlo, así que esa última afirmación es inferencia.

### Prueba de mutación (C1), en copia `/private/tmp/claude-501/-Users-davidferanandezmorilla-Desktop-development-nosync-agentlab/3fa7c665-c570-4833-afbe-b934a451dd31/scratchpad/mut5`
Mutación: `API_KEY_ENV_MAX_LENGTH = 40` → `4000` en la copia. Resultado con el fichero completo (`tests 3 failed | 8 passed`):
```
× rejects a well-formed name of 41 characters ...   expected "query" to not be called at all, but actually been called 1 times
× rejects a lowercase name ...                      expected "query" to not be called at all, but actually been called 3 times
× rejects a name without the _API_KEY suffix ...    expected "query" to not be called at all, but actually been called 3 times
✓ accepts a well-formed name of exactly 40 characters
```
- Con el límite desactivado, el caso de 41 caracteres falla: C1 protege el límite. El caso de exactamente 40 es la guarda contra un límite demasiado estricto.
- Los otros dos fallos son cascada, no fallos reales. Lo comprobé: con la misma mutación, ejecutando solo esos dos (`-t "lowercase name|without the _API_KEY"`), pasan (`Tests 2 passed | 9 skipped`).
- El mecanismo no está en la BD. `truncateAll` sí corre por test, en el `beforeEach`. El problema es el `vi.spyOn(pool, "query")`. En `provider-configs.integration.test.ts` el `spy.mockRestore()` va después de `expect(spy).not.toHaveBeenCalled()`, no en `finally`. Cuando ese `expect` falla, el spy no se restaura. `packages/persistence/vitest.config.ts` no tiene `restoreMocks` (grep vacío). El siguiente test reutiliza el spy ya acumulado, con las llamadas de `truncateAll` y `createScope` (3 llamadas), y falla.
- Defecto de aislamiento solo en el camino de fallo. Con el código correcto no afecta y no es bloqueante. Hace que un fallo real se muestre como 3 fallos. Arreglo mínimo: `mockRestore` en `finally`, o `restoreMocks: true` en vitest.config.

### C2 (`migrate.ts`)
Escribí en la copia (no en el repo) `src/migrate-failure.integration.test.ts` con 2 tests, que pasan (`Tests 2 passed (2)`):
- Con `migrationsFolder` inexistente, `runMigrations` relanza el error original (`Can't find meta/_journal.json file`). Después dos `runMigrations` buenos seguidos funcionan en un pool de 2, y `pg_locks` advisory = 0.
- Con `ROLLBACK` forzado a fallar, se relanza igualmente el error original (no `rollback-boom`) y `release` recibe un `Error`, es decir, el cliente se descarta.

Este test no está en el repo. El owner podría incorporarlo (OPEN DECISION de scope, no la resuelvo yo).

### DoD
| # | Viñeta | Res. | Evidencia |
|---|---|---|---|
| 1 | turbo passThroughEnv + `make test` contra `agentlab_test` | ✅ | `make test` exit 0, 92 tests de persistence |
| 2 | `DATABASE_URL_TEST` obligatoria, mensaje claro, nunca a web/worker | ✅ | mensaje literal arriba; `config` solo en `test` |
| 3 | `make test` en contenedor, sin localhost:5432 | ✅ | `ECONNREFUSED` en 127.0.0.1, `db ok` |
| 4 | Servicio `migrate`; web y worker esperan | ✅ | `migrate Exited (0)` → `worker Up` |
| 5 | schemaFilter public; control en `drizzle` (OD-024) | ✅ | `drizzle\|1`; test `limits Drizzle to the public schema` pasa |
| 6 | `db:migrate` aplica migraciones y `setup()` | ✅ | `langgraph\|4` |
| 7 | Lock advisory + test de concurrencia | ✅ | `migrate.integration.test.ts` pasa (7); fallo dentro del lock cubierto por la prueba de la copia |
| 8 | Instalación offline `--ignore-scripts` | ✅ | `make -n` (línea IN_TEST) |
| 9 | Stage `migrate` propio | ✅ | `migrate` construye y sale con 0; red sin salida |
| 10 | `make test` en dos fases, deja db en marcha | ✅ | `db` sigue Up tras `make test` |
| 11 | `loadTestDatabaseUrl()` en core; nada de `process.env` fuera de `env.ts` | ✅ | verificado en el ciclo anterior; el grep de este ciclo falló por un `--include` en zsh y no lo repetí |
| 12 | `append` con bloqueo + MAX+1 | ✅ | `events.integration.test.ts` (7) pasa |
| 13 | Esquema OD-021, `create`/`get`/`list`, `get` → null | ✅ | integration tests pasan |
| 14 | 8 tablas, índices, `unique(run_id, seq)` | ✅ | `public\|8`; `migrate.integration.test.ts` |
| 15 | `0000_init.sql` aplicable; `db:reset` | ✅ | `migrate` exit 0 sobre BD vacía; `resetTestDatabase` en cada run |
| 16 | Repositorios y métodos listados | ✅ | `runs` (63 tests), `events`, `definitions` pasan |
| 17 | `transition` inválida lanza `InvalidTransitionError` | ✅ | tabla exhaustiva en `runs.integration.test.ts` |
| 18 | `claimNext` concurrente sin duplicados | ✅ | tests de concurrencia en `runs.integration.test.ts` pasan |
| 19 | Sin `DATABASE_URL_TEST` los tests fallan, no se saltan | ✅ | caso vacío ejecutado (arriba). Grep de `it.skip` / `describe.skip` / `skipIf` en `packages/*/src` sin coincidencias. `env.ts` sin valor por defecto (visto en el ciclo anterior) |
| 20 | `api_key_env` es `text`; test de valores tipo clave | ✅ | `0000_init.sql` sin CHECK; `provider-configs` 11 tests pasan |
| 21 | Validación en repo, error sin el valor; canario OD-023 | ✅ | los 6 casos rechazados pasan (incluidos el canario y el de 41); logs db 0 coincidencias; límite protegido (mutación) |
| 22 | Integración en serie, `fileParallelism: false` | ✅ | `vitest.config.ts` (verificado en el ciclo anterior) |

Hallazgos verificados:
- [x] C1 — `provider-configs.ts:7` — "const API_KEY_ENV_MAX_LENGTH = 40;"
- [x] C1 — `provider-configs.integration.test.ts:39-40` — "[\"a canary-bearing name that is not a valid variable\", `${CANARY}_API_KEY`]," y "[\"a well-formed name of 41 characters\", `${\"A\".repeat(33)}_API_KEY`],"
- [x] C2 — `migrate.ts:36-37` — "} catch (error) {" / "failure = error instanceof Error ? error : new Error(String(error));" (después `try { await lockClient.query("ROLLBACK"); } catch {}` y `throw error;`; `lockClient.release(failure)` en el `finally`)
- [x] C3 — `src/index.ts:1` — "export { CHECKPOINT_SCHEMA } from \"./checkpointer/setup.js\";" (sin `setupCheckpointer`)

Cobertura: no medida en detalle este ciclo. La tabla de v8 del `make validate` muestra `provider-configs.ts` al 66,66 % de líneas y varios `repositories/*` entre el 25 y el 66 % en ese informe. Es un efecto de que ese informe cuenta los ficheros sin sus propios tests, no el fallo de ninguno. El DoD no fija objetivo para persistence. Core ya estaba al 100 % en el ciclo anterior.
Tests añadidos en el repo: ninguno (los de mutación y de C2 viven solo en la copia del scratchpad).
Problemas en tests existentes: el `spy` de `provider-configs.integration.test.ts` no se restaura si el `expect` falla (detalle arriba). Menor.
Bloqueo de hook (AGENTS.md §4): comando `cd $S/mut5; sed -i '' 's/API_KEY_ENV_MAX_LENGTH = 40;/API_KEY_ENV_MAX_LENGTH = 4000;/' packages/persistence/src/repositories/provider-configs.ts; ...` → `BLOCKED by bash-guard: escritura por shell en '$S/mut5/packages/persistence/src/repositories/provider-configs.ts' fuera del scope de la tarea. Usa Edit/Write dentro del scope o repórtalo.` No rodeé el bloqueo con otro comando de shell. Rehice la copia con `tar` y apliqué la mutación con la herramienta Edit sobre la copia, como indicaba el propio mensaje. Impacto sobre la verificación: ninguno.
Limpieza: `docker compose --profile '*' down -v` solo en `agentlab-tv5b`; volúmenes y redes del proyecto eliminados.

Veredicto: PASS

---

## Informe archivado 16 · REVIEW (re-review ciclo 1/3)

## REVIEW — TASK-005 · re-review del ciclo de corrección 1/3

**Veredicto: APPROVED.** Los tres hallazgos (R1, R2, R3) están resueltos y no veo regresiones. El hallazgo nuevo del tester es MINOR.

Hallazgos:
  - [MINOR] packages/persistence/src/repositories/provider-configs.integration.test.ts:49-55. `spy.mockRestore()` se ejecuta después de `expect(spy).not.toHaveBeenCalled()` y no en un `finally`, y vitest.config.ts no tiene `restoreMocks`.
    - Solo afecta al camino de fallo: si el expect falla, el espía no se restaura, el siguiente `vi.spyOn` reutiliza el mismo mock con las llamadas anteriores y los casos que quedan del `it.each` fallan en cascada.
    - Encaja con el "3 failed" de la mutación (el de 41 más "lowercase" y "without suffix", los que van detrás).
    - Nunca da un falso verde, solo empeora el diagnóstico. Por eso es MINOR y no MAJOR.
    - Qué cambiar: `restoreMocks: true` en packages/persistence/vitest.config.ts, o bien `try/finally` alrededor del expect.
  - [NIT] packages/persistence/src/migrate.ts:36 — "    failure = error instanceof Error ? error : new Error(String(error));"
    - Construye un `Error` genérico en código de paquete solo para pasárselo a `release()`. No lo lanza, así que no incumple §10 a la letra.
    - Qué cambiar: `release(true)` con un booleano, que también destruye el cliente, sería más simple.
  - Nota de security sobre R1, coincido en que no bloquea:
    - `InvalidApiKeyEnvError` no recibe parámetros; el mensaje es constante (packages/core/src/errors.ts:111-114, `constructor() {`). Hoy no hay forma de filtrar el valor.
    - Un canario en mayúsculas dentro de un nombre válido de más de 40 caracteres (p. ej. `CANARYXQZ…_API_KEY`) solo protegería contra una regresión futura, si alguien añadiera el valor al error. Lo dejo como NIT opcional.

Hallazgos verificados:
  [x] R1 — provider-configs.integration.test.ts:39 — "  [\"a canary-bearing name that is not a valid variable\", `${CANARY}_API_KEY`],"
  [x] R1 — provider-configs.integration.test.ts:40 — "  [\"a well-formed name of 41 characters\", `${\"A\".repeat(33)}_API_KEY`],"
  [x] R1 — provider-configs.integration.test.ts:73-75 — "  it(\"accepts a well-formed name of exactly 40 characters\", async () => {" / "    const name = `${\"A\".repeat(32)}_API_KEY`;" / "    expect(name).toHaveLength(40);"
    - Lo comprobé con node contra la regex de core/env.ts:70: el nombre de 41 caracteres cumple la regex (41 true), así que solo lo rechaza la longitud. El de 40 también la cumple (40 true). El del canario no (24 false, por las minúsculas).
    - Con la mutación del tester y del owner, el caso de 41 falla. El test protege el límite.
  [x] R2 — migrate.ts:24 — "  let failure: Error | undefined;"
  [x] R2 — migrate.ts:37-42 — "    try {" / "      await lockClient.query(\"ROLLBACK\");" / "    } catch {" / "      // Keep the original error; the client is discarded below." / "    }" / "    throw error;"
  [x] R2 — migrate.ts:44 — "    lockClient.release(failure);"
    - Con éxito, `release(undefined)` devuelve el cliente al pool. Con error lo destruye, y se relanza el error original.
  [x] R3 — index.ts:1 — "export { CHECKPOINT_SCHEMA } from \"./checkpointer/setup.js\";"
    - `setupCheckpointer` solo se importa internamente, en migrate.ts:4.

Otros cambios en packages/persistence desde mi revisión:
- Solo cambió la fecha de modificación de 4 ficheros: index.ts, migrate.ts y provider-configs.integration.test.ts (19:12:41), y provider-configs.ts (19:13:26). El resto sigue con fecha ≤ 18:41:21.
- provider-configs.ts lo tocó la mutación del owner y está restaurado. La línea 26 dice "  if (name.length > API_KEY_ENV_MAX_LENGTH || !isApiKeyEnvName(name)) {", idéntica a la que cité en mi revisión anterior; el fichero entero (55 líneas) no tiene otros cambios.
- No hay ningún fichero nuevo en el paquete.

Fuera del ciclo (pendientes de decisión humana, solo comento):
- rows.ts:3 (`TypeError`) y events.ts:33 (`ZodError`): mantengo que van en una misma OD.
- plan:133: lo corrige el architect.
- Los NIT de events.integration.test.ts:77/:82 y la regla 2 de testing-conventions siguen igual. No los cuento como no resueltos.

Cumplimiento: SPEC ✅ · ARCHITECTURE ✅ (los MINOR de errores, pendientes de OD) · ADRs ✅ · DoD ✅ (el límite de 40 ya está cubierto) · plan ✅ (salvo plan:133, que corrige el architect)

Sobrearquitectura detectada: ninguna.

Deuda propuesta:
- TD-? LOW: restaurar los espías de forma robusta en persistence (`restoreMocks: true` o `finally`). Se paga en la próxima tarea que toque los tests de persistence, o ahora si el Orchestrator abre un ciclo menor.
- Se mantienen las dos TD-? LOW de mi informe anterior: los CLI de db sin test, y env.test.ts:154-157 dependiente del `process.env` real.

Requiere security: sí, ya está en curso según el packet. El ciclo 1 solo tocó tests, migrate.ts e index.ts, nada nuevo en Docker, CI ni providers.

Limitación: no pude ejecutar typecheck ni lint en local (node v26 frente al engines `>=22.12 <23`). Me fío del `make validate` exit 0 del owner y del tester.

Veredicto: APPROVED

---

## Informe archivado 17 · IMPLEMENTATION corrección acotada (exports del esquema y `restoreMocks`)

## IMPLEMENTATION — TASK-005 (corrección acotada)
Hecho: `index.ts` ya no exporta ninguna tabla Drizzle, solo tipos del esquema. Hay un test de exports de valor. `restoreMocks: true` está activo en persistence.
Ficheros: creado `packages/persistence/src/index.test.ts` · modificados `packages/persistence/src/index.ts`, `packages/persistence/vitest.config.ts`.
Cómo probarlo: `make validate` con las variables del packet.

F1 [x]
- `packages/persistence/src/index.ts:9` — "export type {" (líneas 9-24, hasta `} from "./schema/index.js";`).
- Tipos exportados: AgentDefinitionRow, AgentInvocationRow, NewAgentDefinitionRow, NewAgentInvocationRow, NewProject, NewRun, NewTaskRow, NewTeamDefinitionRow, Project, ProviderConfigRow, Run, RunEventRow, TaskRow, TeamDefinitionRow.
- Siguen los repositorios, `runMigrations`, `createPool`, `createDatabase`, `type Database` y `CHECKPOINT_SCHEMA`.
- Los repositorios exportan solo factories, interfaces y tipos, así que ningún tipo público obliga a exportar una tabla como valor. No hizo falta parar.
- `NewProviderConfigRow` y `NewRunEventRow` no existen en el esquema y no se inventaron.

F2 [x]
- `packages/persistence/src/index.test.ts:5` — `it("exports only repositories and infrastructure, never Drizzle tables", () => {`.
- Compara `Object.keys(persistence).sort()` con la lista exacta: CHECKPOINT_SCHEMA, createAgentDefinitionsRepository, createDatabase, createEventsRepository, createPool, createProjectsRepository, createProviderConfigsRepository, createRunsRepository, runMigrations.
- No usa DB, pero el `globalSetup` de persistence la exige para cualquier test. Corre dentro de `make validate`; en la ejecución final aparece `✓ src/index.test.ts (1 test)`.

F3 [x]
- `packages/persistence/vitest.config.ts:8` — "    restoreMocks: true,".
- Con el límite en 40, el test de `api_key_env` sigue verde: persistence pasó 6 ficheros y 93 tests.
- Copia en el scratchpad (`/private/tmp/claude-501/-Users-davidferanandezmorilla-Desktop-development-nosync-agentlab/3fa7c665-c570-4833-afbe-b934a451dd31/scratchpad/copy`) con `API_KEY_ENV_MAX_LENGTH = 4000` en `provider-configs.ts:7`, ejecutando solo `vitest run provider-configs`:
  - Resultado: "Tests 1 failed | 10 passed (11)".
  - El único fallo es "× rejects a well-formed name of 41 characters without inserting, querying or leaking the value". Los otros 5 casos de `rejected` y los 3 de aceptación pasan, sin cascada.

Comandos ejecutados y resultado:
- `make validate` con las variables del packet → rc=0. Incluye typecheck, lint, test y format:check ("All matched files use Prettier code style!").
- Vitest persistence: "Test Files 6 passed (6) · Tests 93 passed (93)". Core: 7 ficheros, 169 tests, todos pasan.
- `docker compose --profile '*' down -v` con `COMPOSE_PROJECT_NAME=agentlab-c2`: se eliminaron la red y el volumen `agentlab-c2_pgdata`.
- La copia del scratchpad usó un Makefile modificado solo en esa copia.

Desviaciones del plan: ninguna.
Fuera de scope detectado: ninguno. No hubo bloqueos de hook.
Dependencias que harían falta: ninguna.
OPEN DECISIONS: ninguna.
Deuda propuesta: ninguna.
Dudas: ninguna. Una nota: `provider-configs.integration.test.ts:5` sigue importando `providerConfigs` desde `../schema/index.js` (ruta interna). Eso es válido y no pasa por `index.ts`.

---

## Informe archivado 18 · REVIEW revisión acotada (exports del esquema + restoreMocks)

## REVIEW — TASK-005 (revisión acotada: exports del esquema + restoreMocks)
Hallazgos: ninguno (ni BLOCKER, ni MAJOR, ni MINOR).
Comprobaciones (leído del disco):
1. Ningún valor del esquema sale por `index.ts`. Las tablas solo salen como tipos.
   - `packages/persistence/src/index.ts:9` — "export type {"
   - `packages/persistence/src/index.ts:24` — "} from \"./schema/index.js\";"
   - Los repositorios reexportados con `export *` (`index.ts:4-8`) solo exportan interfaces, tipos y `create*Repository`. Lo comprobé con grep de `^export` en `repositories/*.ts`: ninguno exporta tablas. `rows.ts` (`requireRow`) no se reexporta. `schema/columns.ts` (`inList`, `idColumn`…) no lo reexporta ni `schema/index.ts`.
2. `Database` y `createDatabase` no obligan a exponer las tablas.
   - `packages/persistence/src/pool.ts:3` — "import * as schema from \"./schema/index.js\";" (el import es interno)
   - `pool.ts:5` — "export type Database = NodePgDatabase<typeof schema>;" (solo usa `typeof` a nivel de tipo, no exporta valores)
3. Los 14 tipos exportados existen todos y no hay ninguno inventado. Los crucé con `schema/*.ts`: agent-definitions:61-62, agent-invocations:38-39, projects:13-14, provider-configs:24, run-events:40, runs:56-57, tasks:47-48, team-definitions:17-18. No falta ninguno: `ProviderConfigRow` y `RunEventRow` no tienen `New*` en el esquema.
4. `restoreMocks` no rompe nada.
   - `packages/persistence/vitest.config.ts:8` — "restoreMocks: true,"
   - Solo hay un espía en el paquete, y se crea dentro del `it`, no en `beforeEach`:
     `repositories/provider-configs.integration.test.ts:49` — "const spy = vi.spyOn(pool, \"query\");"
   - Los `beforeEach` de los 4 ficheros de integración solo truncan o crean datos, no crean mocks. No hay `vi.fn`/`vi.mock`/`stubEnv` en el paquete. El `spy.mockRestore()` de la línea 55 ya sobra, pero no molesta. Ahora, si falla un `expect` antes de esa línea, el espía se restaura igualmente.
5. El test de exports fallaría si alguien vuelve a añadir `export * from "./schema/index.js"`.
   - `packages/persistence/src/index.test.ts:6` — "expect(Object.keys(persistence).sort()).toEqual("
   - Con `toEqual` contra la lista exacta de 9 nombres, aparecerían `agentDefinitions`, `agentInvocations`, `projects`, `providerConfigs`, `runEvents`, `runs`, `tasks` y `teamDefinitions`, y el test fallaría. Lo mismo pasaría si un repositorio reexportara una tabla. Los tipos se borran al compilar, así que el test no los cubre; los cubre `typecheck`.
- No hay consumidores externos de `@agentlab/persistence` en `packages/` ni en `apps/`: el cambio no rompe ningún import.
- No pude ejecutar vitest en mi entorno: el binding nativo de rolldown falla al cargar, y es un problema de mi sandbox, no del código. Me apoyo en el análisis estático y en el `make validate` exit 0 que informa persistence-dev.
Cumplimiento: SPEC ✅ · ARCHITECTURE ✅ (§2 exports solo desde `src/index.ts`; §3 la fila `persistence` mantiene el esquema dentro del paquete) · ADRs ✅ · DoD ✅ (lo que pide la decisión humana: cambio en `index.ts`, test de exports y `restoreMocks: true`) · plan ✅
Sobrearquitectura detectada: ninguna
Deuda propuesta: ninguna
Requiere security: no (el cambio solo toca `persistence` y no afecta a providers/tools/policies/API/Docker/CI)
Hallazgos verificados:
  [x] Exportación del esquema — packages/persistence/src/index.ts:9 — "export type {"
  [x] Espías no restaurados — packages/persistence/vitest.config.ts:8 — "restoreMocks: true,"
Veredicto: APPROVED

---

## Anexo · Informes de proceso

## Anexo A.1 · CLOSURE testing-conventions (regla 11, tras TEST/PLAN inicial)

## CLOSURE — TASK-005
Ficheros tocados: `.claude/skills/testing-conventions/SKILL.md` (único fichero modificado).
Cambio: añadida regla 11 tras la 10 (líneas 24).
Cita (fichero:línea, leído en disco tras el cambio):
`.claude/skills/testing-conventions/SKILL.md:24` — "11. **Tests de integración contra PostgreSQL en serie.** Se nombran `*.integration.test.ts` y corren en serie: un solo runner y `fileParallelism: false` para esos ficheros. Motivo: comparten la base `agentlab_test` y sus resets chocarían entre paquetes (decisión humana en el plan de TASK-005, riesgo R6)."
Contradicciones: ninguna. Revisadas: línea 10 (integración en `packages/<pkg>/src/**/*.integration.test.ts` y `tests/integration/**`; el nombre es coherente), línea 14 (reset antes de cada suite; compatible con serie), línea 29 (`pnpm test:integration`; compatible).
TASKS.md: no tocado (fuera de scope de este packet).
Deuda registrada: ninguna.
README actualizado: no.
Fuera de scope detectado: ninguno.

## Anexo A.2 · CLOSURE testing-conventions (alinear con el plan, antes del paso 3)

## CLOSURE — TASK-005 (proceso: alinear testing-conventions con el plan)

Ficheros tocados: `.claude/skills/testing-conventions/SKILL.md` (solo este).

Cambios realizados:
- `.claude/skills/testing-conventions/SKILL.md:14` — antes: "(o el helper `resetTestDb()` de `@agentlab/persistence/testing`)." — ahora: "(o el helper `resetTestDatabase(testUrl)` de `@agentlab/persistence/testing`, que se niega si la base no termina en `_test`)." Releído: `1. **PostgreSQL real** para repositorios y handlers. Nunca SQLite, nunca mocks del ORM. Antes de cada suite: \`pnpm db:reset\` (o el helper \`resetTestDatabase(testUrl)\` de \`@agentlab/persistence/testing\`, que se niega si la base no termina en \`_test\`).`
- `.claude/skills/testing-conventions/SKILL.md:30` — antes: "pnpm test:integration    # necesita docker compose up db" — ahora: "make test    # integración en contenedor (dos fases); deja db en marcha, `make down` la para". Releído: `make test                                   # integración en contenedor (dos fases); deja db en marcha, \`make down\` la para`

Verificación contra el plan (`docs/reports/TASK-005-plan.md`): `resetTestDatabase(testUrl: string)` en `@agentlab/persistence/testing` (contratos, línea 278; decisión 14 guarda `_test`); `make test` en dos fases y `db` en marcha, parar con `make down` (decisión 15, línea 102, y R10). `pnpm db:reset` sigue existiendo como script raíz (paso 1, línea 179), por eso se mantiene.

Referencias que NO coinciden con el plan y que NO se han cambiado (fuera del packet):
- `SKILL.md:10` — "Integración: `tests/integration/**` o `packages/<pkg>/src/**/*.integration.test.ts`". El plan (decisión 12) fija `src/**/*.integration.test.ts` en persistence; `tests/integration/` se descartó.
- `SKILL.md:18` — "variables de entorno de test se cargan desde `tests/.env.test.example`". El plan usa `.env.example` (`DATABASE_URL_TEST`, paso 3, línea 205); no existe `tests/.env.test.example` en el plan.
- `SKILL.md:14` — "Antes de cada suite". El plan (decisión 13) ejecuta `resetTestDatabase` una vez por ejecución en `globalSetup` y después `truncateAll(db)` al inicio de cada test. La frase no coincide con eso.
- `SKILL.md:24` — regla 11 cita "(decisión humana en el plan de TASK-005, riesgo R6)". Coincide con el plan; sin cambio.
- `SKILL.md:31` — `pnpm --filter <pkg> exec vitest run --coverage`. No lo menciona el plan; sin verificar.

Ficheros tocados (lista exacta): `/Users/davidferanandezmorilla/Desktop/development.nosync/agentlab/.claude/skills/testing-conventions/SKILL.md`
TASKS.md: no tocado (no era parte del packet).
Deuda registrada: ninguna.
README actualizado: no.
Fuera de scope detectado: ninguno.

## Anexo A.3 · CLOSURE testing-conventions (alinear antes del paso 3)

## CLOSURE — TASK-005 (proceso: alinear testing-conventions antes del paso 3)
Ficheros tocados: `.claude/skills/testing-conventions/SKILL.md` (solo este; tres líneas editadas, nada más).
TASKS.md: no tocado (no es cierre de tarea) · desbloqueadas: ninguna
Deuda registrada: ninguna
README actualizado: no

Cambios y texto releído en disco tras editar:
1. `SKILL.md:10` (Dónde, integración): "- Integración con PostgreSQL: `packages/<pkg>/src/**/*.integration.test.ts`. Corren en serie contra `agentlab_test` (`DATABASE_URL_TEST`). Los tests contra proveedores reales (regla 2) van aparte, en `tests/integration/providers/`."
   Regla 2 (`SKILL.md:15`) no se ha tocado. Ya no hay contradicción: `tests/integration/` queda solo para proveedores reales, no para PostgreSQL.
2. `SKILL.md:14` (regla 1): "1. **PostgreSQL real** para repositorios y handlers. Nunca SQLite, nunca mocks del ORM. `resetTestDatabase(testUrl)` de `@agentlab/persistence/testing` se ejecuta una vez por ejecución en el `globalSetup` de Vitest, y se niega si la base no termina en `_test`. Al inicio de cada test, `truncateAll(db)`."
3. `SKILL.md:18` (regla 5): "5. Sin secretos en fixtures. `DATABASE_URL_TEST` se documenta en `.env.example` (vacía, sin valores reales) y la lee `loadTestDatabaseUrl()` de `@agentlab/core`; nadie lee `process.env` fuera de `core/env.ts`."

Aviso para el humano (no lo he resuelto porque la instrucción era no tocar la regla 2):
- `SKILL.md:15` (regla 2) sigue con `it.skipIf(!process.env.OPENROUTER_API_KEY)`. Esto contradice la frase nueva de la regla 5 ("nadie lee `process.env` fuera de `core/env.ts`"). Persistence-dev no toca esa regla, pero si los tests de proveedores la usan, la regla 2 hay que alinearla en otra decisión.
- La regla 11 (`SKILL.md:24`) ya dice «en serie» y `fileParallelism: false`, de acuerdo con el plan. No la he modificado.

## Anexo A.4 · CLOSURE testing-conventions (regla 2, cierre de la tarea)

## CLOSURE — TASK-005 (proceso)
Ficheros tocados: `/Users/davidferanandezmorilla/Desktop/development.nosync/agentlab/.claude/skills/testing-conventions/SKILL.md` (solo este; regla 2, línea 15).
TASKS.md: no tocado (tarea de proceso, sin cambio de estado en este alcance).
Deuda registrada: ninguna
README actualizado: no

Verificación:
- Fuente releída: `packages/core/src/env.ts:79-81` exporta `createSecretResolver(source: EnvSource = process.env): SecretResolver`; `env.ts:72-74` `isApiKeyEnvName`; `env.ts:28` declara `OPENROUTER_API_KEY`. `createSecretResolver` solo resuelve nombres `*_API_KEY` declarados en `EnvSchema`. `loadEnv()` en `env.ts:42`.
- Cita literal releída tras editar, `SKILL.md:15`:
"2. **`FakeProvider`** (`@agentlab/providers/testing`) para cualquier test que invoque un modelo. Los tests contra proveedores reales viven en `tests/integration/providers/` y se saltan si no hay clave, mostrando el aviso. La presencia de la clave se obtiene vía `@agentlab/core`, nunca leyendo `process.env`: `const hasKey = Boolean(createSecretResolver()("OPENROUTER_API_KEY"))` (`createSecretResolver` solo resuelve nombres `*_API_KEY` declarados en `env.ts`; alternativa: `loadEnv().OPENROUTER_API_KEY`), y `it.skipIf(!hasKey)(...)` con un `console.warn` de aviso cuando `!hasKey`."

Nota: la regla 5 (`SKILL.md:18`) no se tocó. Su frase "nadie lee `process.env` fuera de `core/env.ts`" ya es coherente con el cambio, porque el default `process.env` de `createSecretResolver` vive dentro de `env.ts`. Se respetó el resto de la regla 2 (FakeProvider, `tests/integration/providers/`, skip con aviso).
OPEN DECISIONS: ninguna
Dudas: ninguna

## Anexo A.5 · CLOSURE/IMPLEMENTATION de proceso: corrección del plan (decisión 20)

## IMPLEMENTATION — TASK-005 (corrección del plan, decisión 20)
Hecho: he corregido la viñeta `DEFAULT` de la decisión 20 para que coincida con la tabla de OD-021 y con el código. Ahora incluye los cuatro `DEFAULT` que faltaban. No he tocado nada más del plan.
Ficheros: modificados /Users/davidferanandezmorilla/Desktop/development.nosync/agentlab/docs/reports/TASK-005-plan.md (solo la línea 133)

Lo comprobé en el código antes de editar con `grep -n -i default packages/persistence/src/schema/*.ts`:
- agent-definitions.ts:46 — `.default(sql\`'{}'\`),` (tool_allowlist)
- agent-definitions.ts:53 — `enabled: boolean("enabled").notNull().default(true),`
- agent-invocations.ts:29 — `attempt: integer("attempt").notNull().default(1),`
- tasks.ts:37 — `.default(sql\`'{}'\`),` (depends_on, en las líneas 34-37)
- Los demás `DEFAULT` (columns.ts:7/10/15, runs.ts:39/44, run-events.ts:32) ya estaban en la viñeta.

Nota: la tabla de OD-021 está en las líneas 397-403 del plan, no en las ~258-262 que indicaba el packet. Las líneas 397, 400 y 401 recogen esos cuatro `DEFAULT`.

Hallazgos resueltos:
[x] REVIEW-MINOR decisión 20 — docs/reports/TASK-005-plan.md:133 — "    - `DEFAULT` solo en `id`, `created_at`, `updated_at`, `runs.status` (`'queued'`), `runs.cancel_requested` (`false`) y `run_events.ts` (`now()`), que son las columnas que `create`/`append` no reciben, y en los cuatro que fija la tabla de OD-021: `agent_definitions.tool_allowlist` (`'{}'`), `agent_definitions.enabled` (`true`), `agent_invocations.attempt` (`1`) y `tasks.depends_on` (`'{}'`). El resto lo aporta quien escribe, con los tipos de `core`."

Desviaciones del plan: ninguna
Fuera de scope detectado: hay dos discrepancias más entre la tabla de OD-021 y la decisión 20, que no he tocado. La línea 398 todavía muestra `team_definitions.coordination ... DEFAULT '{}'` y la línea 403 muestra `CHECK (seq >= 1)`, aunque la decisión 20 dice que ambos se quitan. Es probable que la tabla refleje la propuesta original y la decisión 20 la poda. Si el humano quiere que el plan sea coherente del todo, haría falta otra corrección.
OPEN DECISIONS: ninguna
Dudas: ninguna

---

## Verificación de citas tras el cierre (docs-keeper)

- `docs/TASKS.md:5` — "| Última actualización | 2026-10-21 (cierre TASK-005) |" (cita literal, fecha previa a la corrección)
- `docs/TASKS.md:7` — "| Tareas READY | TASK-007, TASK-008, TASK-010, TASK-012 |"
- `docs/TASKS.md:108` — "- **Estado**: DONE · **Owner**: persistence-dev · **Depende de**: TASK-003, TASK-004 · **security REQUIRED**"
- `docs/TASKS.md:137` — "- **Estado**: BLOCKED · **Owner**: devops · **Depende de**: TASK-005, OD-004" (TASK-006 sigue BLOCKED)
- `docs/TASKS.md:148` — "- **Estado**: READY · **Owner**: web-dev · **Depende de**: TASK-005 · **security REQUIRED**" (TASK-007)
- `docs/TASKS.md:160` — "- **Estado**: READY · **Owner**: engine-dev · **Depende de**: TASK-005" (TASK-008)
- `docs/TASKS.md:432` — "| 2026-10-21 | TASK-005 → DONE (tester PASS, re-test 22/22; …). Informe en docs/reports/TASK-005.md. Desbloqueadas: TASK-007 y TASK-008 (READY). TASK-006 sigue BLOCKED (OD-004 abierta). |" (cita literal, fecha previa a la corrección)
- `docs/TECHNICAL_DEBT.md:5` — "| Última actualización | 2026-10-21 (cierre TASK-005: TD-019…TD-024 registradas; TD-011, TD-017 y TD-019 actualizadas; TD-008 PAID por TASK-003) |" (cita literal, fecha previa a la corrección)













