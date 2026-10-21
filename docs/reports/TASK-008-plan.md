# PLAN — TASK-008 · apps/worker: bucle de reclamación vacío con heartbeat y apagado limpio

| Campo | Valor |
|---|---|
| Autor | architect |
| Fecha | 2026-10-20 (propuesta) · 2026-10-21 (actualización tras la decisión humana; segunda actualización: decisión 21, OD-037 y OD-038) |
| Owners de la implementación | core-dev (paso 1) · persistence-dev (paso 2) · devops (pasos 3 y 5) · engine-dev (paso 4) · architect y docs-keeper (paso 6) |
| Estado | OD-029…OD-038 **decididas** (2026-10-21), decisión 21 **aprobada** y ADR-011 **Accepted**. Sin decisiones pendientes |
| security | REQUIRED (docker/compose, logger con `redact`, red de `test`, lockfile congelado, barrido de runs huérfanos al arrancar y periódico) |

## Contexto

`apps/worker` es hoy el proceso provisional de TASK-003: un `setInterval`, salida con `SIGTERM` y una línea JSON escrita con `process.stdout.write`. No depende de ningún paquete. `persistence` ya ofrece `createPool`, `createDatabase` y `createRunsRepository`, con `claimNext(workerId)` (`SKIP LOCKED`), `transition(id, to)` (bloquea la fila y respeta `canTransition`) y `heartbeat(id, workerId): boolean`. También exporta `CHECKPOINT_SCHEMA = "langgraph"`.

La tarea sustituye ese proceso por el bucle real: `claimNext`, un `RunExecutor` inyectable (no-op en M0), `finalize`, heartbeat y apagado limpio. Añade el barrido de runs huérfanos al arrancar y cada `WORKER_STALE_MS` (mitigación de OD-033, OD-038 b). De paso cobra la deuda de imágenes y red: TD-015, TD-020, TD-021 (la parte de red), TD-022 y la parte de TD-017 del volumen de `node_modules`.

## Decisiones humanas (2026-10-21, literales)

- OD-029 scope: aprobado tal cual (con package.json raíz, ya que OD-034 es (a)).
- OD-030: (a) pino 10.4.0 exacta, dependencia de runtime de apps/worker; autorizada. El redact se prueba en la implementación con un test que inyecta un valor canario en DATABASE_URL y en una *_API_KEY y comprueba que no aparece en la salida.
- OD-031 / ADR-011: (a) pnpm deploy. ADR-011 Accepted con dos condiciones escritas en el ADR: (1) el stage de deploy verifica que el lockfile no cambia (`git diff --exit-code pnpm-lock.yaml` o `pnpm install --frozen-lockfile` previo en el mismo stage) para cubrir el riesgo del modo no estricto; (2) la limpieza del package.json raíz en migrate queda documentada como deuda LOW a revisar cuando pnpm lo soporte de forma nativa.
- OD-032: (a) node --import tsx desde ya. ADR-009 §7 lo autoriza; nota en ADR-009 y ARCHITECTURE §8. El test de SIGTERM con el worker ocupado (>30 ms bloqueado) entra en el DoD, exit 0.
- OD-033: (a) running, lo recupera TASK-026. Pero el riesgo que señalas es real: hasta TASK-026 un run interrumpido queda running para siempre. Mitigación en TASK-008: al arrancar, el worker marca failed (error.code WORKER_INTERRUPTED) cualquier run `running` con su propio worker_id anterior o con heartbeat caducado; es la mitad de TASK-026 sin la reanudación, y corrige TD-002 en su parte de "queda colgado". Al DoD.
- OD-034: (a) turbo run test --concurrency=1.
- OD-035: (a) quitar el volumen de node_modules; cierra la parte correspondiente de TD-017.
- OD-036: (b) WORKER_POLL_MS, declarada en core/env.ts con valor por defecto 1000. Es una línea y evita una OD en TASK-015.
- Riesgos: los tests dentro de las imágenes → deuda LOW, se paga en TASK-040 (excluir *.test.ts en deploy o en .dockerignore de stage). TASK-007 amplía .dockerignore: al DoD de TASK-007.

Registradas en SPEC §13 (OD-029…OD-036), ADR-011 (Accepted, sección «Condiciones de aceptación»), ADR-009 §7 (anotación) y ARCHITECTURE §5 y §8. La viñeta de `.dockerignore` ya figura en el DoD de TASK-007 (TASKS.md).

## Decisiones humanas, segunda ronda (2026-10-21, literales)

- Decisión 21: aprobada. worker_id = <hostname>/<uuid>; failOrphaned en una sentencia al arrancar, tras comprobar el esquema. WORKER_INTERRUPTED solo como valor de runs.error.code.
- OD-037: (a). Forma InvocationError {code, message fijo, retryable:false}; run.failed llega con TASK-015.
- OD-038: (b). Al arrancar y además cada WORKER_STALE_MS, solo por heartbeat caducado. Cierra R12 y es la mitad de TASK-026 que ya estamos haciendo; TASK-026 queda solo con la reanudación desde checkpoint. Que el architect anote en TASKS.md el recorte de TASK-026.
- Scope: aprobadas las diez rutas de persistence más env.ts/env.test.ts de core.
- Deuda LOW de la limpieza del package.json raíz en migrate → TASK-040. Sí.
- Orden de trabajo: aprobado. core-dev y persistence-dev en paralelo con scopes disjuntos.

Registradas en SPEC §13 (OD-033 actualizada, OD-037 y OD-038) y ARCHITECTURE §5 y §8. El recorte de TASK-026 y los textos de TASKS.md los aplica el Orchestrator (el rol de architect no edita TASKS.md). El barrido periódico se diseña en la decisión 21 f.

## Validación previa fuera del repo (scratchpad)

Todo se probó en copias filtradas del repo en `/private/tmp/claude-501/-Users-davidferanandezmorilla-Desktop-development-nosync-agentlab/3fa7c665-c570-4833-afbe-b934a451dd31/scratchpad/` (`t8/repo` el 2026-10-20, ya borrada; `t8lock/` y `t8sweep/` el 2026-10-21), sin `.env`. Herramientas: pnpm 9.15.9, `node:22.23.3-bookworm-slim@sha256:c3de60bf…` y `postgres:16.15-trixie@sha256:ca0bd484…`. Credenciales desechables (`throwaway8`). Al terminar se borraron los contenedores. En el repo no se instaló ni se cambió nada, salvo los documentos del scope.

| # | Prueba | Resultado |
|---|---|---|
| V1 | `apps/worker` con `@agentlab/core` y `@agentlab/persistence` (`workspace:*`) + `pnpm install --lockfile-only --ignore-scripts` | Cambia solo el importer `apps/worker` del lockfile (6 líneas `link:`). No resuelve ningún paquete nuevo |
| V2 | `pnpm --filter worker deploy --prod --offline --ignore-scripts /out` | **Falla**. Con `fetch --prod` da `ERR_PNPM_NO_OFFLINE_TARBALL` (`@vitest/coverage-v8`, importer raíz); con `fetch` completo, `ERR_PNPM_NO_OFFLINE_META` (`zod@4.6.7`, dependencia de `@agentlab/core`). En pnpm 9, `deploy` llama a `install` con `frozenLockfile: false` (`releasing/plugin-commands-deploy/src/deploy.ts`, tag `v9.15.9`) |
| V3 | Lo mismo sin `--offline` | Funciona. `/out` = `package.json`, `src`, `tsconfig.json`, `node_modules`. `.bin` = **`tsx`**. `@agentlab/*` inyectados como copias `file:`. 38 entradas en `.pnpm`, todas en `pnpm-lock.yaml` salvo las dos `file:`. Arrastra `@types/pg`, `@types/node` y `undici-types` por el peer opcional de `drizzle-orm` (solo tipos) |
| V4 | `pnpm --filter @agentlab/persistence deploy --ignore-scripts /out` (sin `--prod`) | `.bin` = `drizzle-kit eslint eslint-config-prettier prettier tsc tsserver tsx turbo vite vitest`: **vuelven las devDependencies de la raíz**, porque `deploy` instala el importer raíz en el `modulesDir` del deploy |
| V5 | V4 precedido de `npm pkg delete devDependencies`, aplicado al `package.json` raíz de la copia del stage | `.bin` = **`drizzle-kit tsx`**. 51 entradas, todas en el lockfile. La imagen `migrate` (`CMD ["tsx","src/cli/migrate.ts"]`, `cap_drop: ALL`, `no-new-privileges`) aplica las migraciones y sale con 0. Una segunda ejecución también sale con 0 |
| V6 | Stage final `slim` (Node fijado por digest, con `rm` de corepack, npm, npx y yarn) | `command -v pnpm corepack npm npx yarn` no devuelve nada, en `worker` ni en `migrate`. Usuario `uid=1000(node)` |
| V7 | `.dockerignore` como lista de inclusión; canarios `*.pem`, `*.key`, `.env.local`, `x.env` y `.envrc` en la raíz, `apps/worker`, `packages/core/src` y `packages/persistence` | `grep -rl` del canario en `/`: ninguna coincidencia en las dos imágenes |
| V8 | `tsx src/index.ts` bajo tini (`--init`) con un handler de `SIGTERM` que drena durante 1,5 s y 12 s, y `docker stop -t 40` | Sale con 0 en 1,8 s y 12,3 s. Si lo lanza Node con `spawn`, `kill("SIGTERM")` al padre `tsx` también da 0 |
| V9 | **`SIGTERM` durante el arranque** (0,1 / 0,3 / 0,6 / 1,5 s tras `docker run`) | Con `tsx src/index.ts`: **143 / 143 / 143 / 0**. Con `node --import tsx src/index.ts`: **0 / 0 / 0 / 0**. En los dos casos el handler se registra antes del `import()` dinámico de los módulos pesados |
| V10 | Compose de prueba: red `test-db` (`internal`) solo con `db` y `test`, `cap_drop`/`no-new-privileges` en `migrate` y `worker`, override de ejemplo | `db` en `[backend, test-db]` y, con el override, `[backend, egress, test-db]` (compose hace la unión). `test` solo en `[test-db]`. Las dos redes son `internal: true` |
| V11 | Servicio `test` con stage `test` (`USER node`, `/work` de `node`), fase 1 sin el volumen de `node_modules` y fase 2 offline | `id -u` = 1000; `CapEff` 0; instalación offline con `--ignore-scripts` en 1,5 s; persistence: 6 ficheros de test en verde; `ollama` y `worker` no resuelven desde `test` |
| V12 (2026-10-21) | `pnpm install --frozen-lockfile --lockfile-only --ignore-scripts [--offline]` sobre el lockfile del repo, sobre un lockfile alterado y sobre un manifiesto alterado; hash del lockfile antes/después de `deploy` | Sin tocar: exit 0, también `--offline` tras `pnpm fetch` (≈0,25 s). Lockfile alterado (`tsx` 4.23.15 → 4.23.14 en el importer `apps/worker`) y manifiesto alterado (`zod` → `^4.6.0`): exit 1 `ERR_PNPM_OUTDATED_LOCKFILE`. Con la misma deriva y sin la comprobación, `deploy` sale con 0 y el hash del lockfile no cambia (`saveLockfile: false`). Después de `npm pkg delete devDependencies` la comprobación falla siempre (exit 1): debe ir antes. Detalle en ADR-011 |
| V13 (2026-10-21) | `UPDATE … WHERE status = 'running' AND (heartbeat nulo OR caducado OR (starts_with(worker_id, 'hostA/') AND worker_id <> 'hostA/u9')) RETURNING id` en PostgreSQL 16.15 sobre 10 filas | Marca exactamente: caducado de otro host, ejecución anterior del mismo host con heartbeat fresco, heartbeat nulo. No toca: fresco de otro host, el propio `worker_id` actual, 59 s de antigüedad, `queued`, `awaiting_approval`, `completed`, ni `hostAA/…` (sin falso positivo de prefijo) |
| V14 (2026-10-21) | `os.hostname()` dentro de un contenedor Node antes y después de `docker restart` | Igual (`ad6116aa5479`, el id corto del contenedor). Cambia al recrearlo |
| V15 (2026-10-21, segunda actualización) | Sentencia de la decisión 21 d en sus dos formas (con y sin `starts_with(worker_id, 'hostA/')`) y con `worker_id is distinct from 'hostA/u9'` global, en PostgreSQL 16.15 sobre 9 filas, cada forma en una transacción con `ROLLBACK` | Al arrancar: marca `null_hb`, `prev_same_fresh` y `stale_other`. Periódico: marca `null_hb` y `stale_other`. Ninguna marca `self_stale` (el id actual con heartbeat de 120 s), `self_fresh`, `fresh_other`, `age59`, `queued_stale` ni `prefix_aa` (`hostAA/…`) |

Bloqueos de hook durante la validación del 2026-10-20 (AGENTS.md §4; los cito y no los rodeé):

- `bash-guard`: «escritura por shell en '$R/docker/worker.Dockerfile' fuera del scope de la tarea». Era un `sed -i` sobre la copia del scratchpad. A partir de ahí edité los ficheros del scratchpad con Write/Edit, que es lo que permite el packet.
- `bash-guard`: «dependencia 'pino' no autorizada en el TASK PACKET (deps_allowed)». Bloqueó `npm i pino@10.4.0` en el scratchpad. **El `redact` de pino no está probado aquí**; lo prueba la implementación (OD-030, test de canarios).

El 2026-10-21 no hubo bloqueos (tampoco en la segunda actualización).

## Decisiones de diseño

1. **Composición en tres módulos del worker, sin paquetes nuevos.** `index.ts` registra las señales y carga `main.ts`. `main.ts` es la raíz de composición: `loadEnv`, logger, pool, comprobación del esquema, repositorio e identidad del worker. `worker.ts` contiene el barrido inicial y el bucle. Tienen además `executor.ts` y `logger.ts`. Alternativa descartada: llevar el bucle a `packages/orchestrator`, porque ese paquete no existe hasta M1 y ROADMAP no lo asigna a M0.
2. **El handler de señales se registra antes de importar nada pesado.** `index.ts` no tiene imports estáticos de paquetes. Crea un `AbortController`, hace `process.once("SIGTERM"|"SIGINT", () => shutdown.abort())` y después `await import("./main.js")`. Así la señal que llega mientras se cargan `drizzle` y `pg` queda en cola y se atiende (V9). Alternativa descartada: imports estáticos, porque con ellos no hay handler durante la evaluación de los módulos.
3. **Arranque con `node --import tsx src/index.ts` (OD-032 a, ADR-009 §7 anotado).** El CLI de `tsx` da **30 ms** al hijo para confirmar la señal; después `SIGKILL` y 143 (V9). Con `--import` no hay proceso intermedio. `start` y el `CMD` de `runtime` lo usan; `dev` sigue con `tsx watch src/index.ts`. El test de `SIGTERM` con el bucle de eventos bloqueado más de 30 ms entra en el DoD. Alternativa descartada: el CLI, que contradice el DoD (código 0).
4. **Contrato `RunExecutor` mínimo, dentro de `apps/worker`.**

   ```ts
   type RunOutcome = "completed" | "interrupted";
   interface RunExecutor { execute(run: Run, signal: AbortSignal): Promise<RunOutcome> }
   ```

   El de M0, `noopExecutor`, devuelve `"completed"`. `"interrupted"` significa «abortado por el apagado; el run se queda `running`» (OD-033 a). Hasta TASK-026 lo recoge el barrido de la decisión 21 en el siguiente arranque. `partial` y `failed` como resultado los añadirá M1 cuando exista quien los produzca. Alternativa descartada: ponerlo en `core`. Solo lo consume el worker.
5. **`finalize` está en el worker y usa `transition`.**
   - `"completed"` → `transition(id, "completed")`.
   - `"interrupted"` → no hace transición.
   - Si el executor lanza → `transition(id, "failed")` y se registran solo `name` y `code` del error. (`runs.error` en este camino lo rellena TASK-015, que es quien tiene errores reales del grafo.)
   - `InvalidTransitionError` (por ejemplo, el run se canceló o lo marcó `failed` otro worker mientras corría) o `null` (el run ya no existe) → `warn` y se sigue.

   El heartbeat se para **antes** de `finalize`. Alternativa descartada: `finalize(id, workerId, status)` en persistence con guarda de `worker_id`: es de TASK-026 (R4).
6. **Heartbeat.** Un `setInterval` de `WORKER_HEARTBEAT_MS` (15 000 por defecto) por cada run activo.
   - Si `heartbeat()` devuelve `false` (el run ya no está `running` para este worker, por ejemplo porque otro worker lo marcó huérfano) → se aborta el `signal` del executor y no se finaliza.
   - Un error de base de datos en el heartbeat → `warn` y se sigue latiendo.
7. **Apagado.** Con `shutdown` abortado, cada bucle deja de reclamar y la espera en reposo se interrumpe al momento (`setTimeout` de `node:timers/promises` con `signal`).
   - Si hay un run en curso, se espera como mucho `SHUTDOWN_GRACE_MS`. Al vencer, se aborta el `signal` del executor y se le dan `SHUTDOWN_MARGIN_MS = 5000` (constante) para devolver `"interrupted"`.
   - Después se para el heartbeat, se cierra el pool y el proceso sale con `exitCode = 0`.
   - Un temporizador `unref()` de `SHUTDOWN_GRACE_MS + SHUTDOWN_MARGIN_MS` llama a `process.exit(0)` si algo mantiene vivo el bucle de eventos. Peor caso ≈35 s, por debajo de `stop_grace_period: 40s`. Alternativa descartada: `process.exit` directo en el handler, que corta los logs pendientes y no espera al run.
8. **Errores de base de datos en `claimNext`**: se registra `error` con `name`/`code` y se reintenta en el siguiente sondeo. El proceso no muere: compose no define `restart:` para `worker`. Fallos rápidos de arranque, con código 1: env inválido, `WORKER_HEARTBEAT_MS >= WORKER_STALE_MS` (decisión 21 f), base de datos inalcanzable en la comprobación inicial, esquema ausente y **error en el barrido de huérfanos al arrancar** (decisión 21). Un error en el barrido **periódico** no es de arranque: `warn` y se sigue (decisión 21 f).
9. **Sondeo en reposo: `WORKER_POLL_MS`** (OD-036 b), declarada en `core/env.ts` como `positiveInt(1000)`, en `.env.example` y en el `environment` de `worker` en `compose.yaml` (`${WORKER_POLL_MS:-}`, como las demás). La primera reclamación es inmediata al arrancar.
10. **`WORKER_CONCURRENCY` = N bucles independientes** (`Promise.all`), porque ARCHITECTURE §8 dice «elevarlo es config, no código». En v1 vale 1. Tiene un test unitario con 2. El barrido de huérfanos al arrancar se hace **una vez** antes de lanzar los N bucles, no en cada bucle; el periódico es **un** temporizador por proceso, independiente de los N bucles (decisión 21 f).
11. **`workerId` = `${os.hostname()}/${crypto.randomUUID()}`**, generado en cada arranque en `main.ts` y registrado en el log de arranque. Único por ejecución (lo que necesita la guarda de `worker_id` de TASK-026) y con un prefijo de host que permite reconocer las ejecuciones anteriores del mismo worker (decisión 21). Sustituye al `randomUUID()` a secas de la versión del 2026-10-20.
12. **Comprobación del esquema `langgraph` en `persistence`** (ADR-002 §7):

    ```ts
    checkpointSchemaExists(pool: pg.Pool): Promise<boolean>
    // select exists(select 1 from pg_namespace where nspname = $1)
    ```

    El parámetro es `CHECKPOINT_SCHEMA`. Se usa `pg_namespace` y no `information_schema.schemata`, porque esta última solo lista los esquemas sobre los que el rol tiene privilegios: con el rol sin superusuario de TASK-037 daría un falso «no existe». Si devuelve `false`, el worker registra `fatal` con el texto `langgraph schema not found: run "pnpm db:migrate" (docker compose: the migrate service) before starting the worker` y sale con 1. Sin código de error nuevo. Alternativa descartada: SQL directo en el worker (ARCHITECTURE §2).
13. **Logger: `pino` 10.4.0 exacta en `dependencies` de `apps/worker`** (OD-030 a; ARCHITECTURE §10, «pino inyectado (M0–M2)»).
    - `createLogger({ level, destination? })` usa `pino.destination({ dest: 1, sync: true })`.
    - `redact: { paths, censor: "[REDACTED]" }`. `paths` se **deriva** de `EnvSchema` e `isApiKeyEnvName` de `core`: todos los nombres declarados que cumplen `^[A-Z][A-Z0-9_]*_API_KEY$` o empiezan por `DATABASE_URL`, en la raíz y a un nivel de profundidad (`N` y `*.N`).
    - Serializador `err`: solo `type` (`name`) y `code`, y `message` únicamente si es `AgentLabError`. El `message` de `DrizzleQueryError` lleva los parámetros de la consulta (TD-011).
    - El objeto `Env` nunca se registra (TD-011).
    - Test de canarios (decisión humana): ver «Estrategia de tests».
14. **Imágenes con `pnpm deploy`** (ADR-011, **Accepted**):
    - Stages `deps`, `worker-deploy`, `migrate-deploy`, `slim`, `runtime`, `migrate` y `test`. Todos los `fetch`/`deploy` llevan `--ignore-scripts`. `deploy` sin `--offline` (V2).
    - **Condición 1 de ADR-011**: el primer `RUN` de `worker-deploy` y de `migrate-deploy`, tras copiar el contexto, es `pnpm install --frozen-lockfile --lockfile-only --ignore-scripts --offline` (V12). En `migrate-deploy` va antes de `npm pkg delete devDependencies`.
    - `migrate` quita las devDependencies de la raíz antes del `deploy` (V5; **condición 2**: deuda LOW, TASK-040) y su `CMD` pasa a `["tsx","src/cli/migrate.ts"]` (ADR-010 §2).
    - `runtime`: `CMD ["node","--import","tsx","src/index.ts"]` (decisión 3).
15. **`.dockerignore` como lista de inclusión** (V7) más los patrones de `HOST_TAR` y `**/*.pem`/`**/*.key`. TASK-007 la ampliará para `web` (ya en su DoD). Alternativa descartada: añadir solo los patrones que faltan, que sigue siendo una lista de exclusión (TD-015).
16. **Redes (TD-021):**

    | Red | `internal` | Servicios |
    |---|---|---|
    | `test-db` (nueva) | sí | `db`, `test` |
    | `backend` | sí | `db`, `worker`, `migrate`, `web`, `ollama` |
    | `egress` | no | `web`, `worker`, `ollama` |

    `test` pierde el acceso a `ollama`, `worker` y `web` (V11). El override de TD-016 sigue sumando `egress` a `db` (V10; lo cobra TASK-037). Alternativa descartada: una red por pareja, que no pide ningún DoD.
17. **`cap_drop: [ALL]` y `security_opt: ["no-new-privileges:true"]` en `migrate` y `worker`.** `init: true` se mantiene (V5 y V8 con `cap_drop`).
18. **`test` sin uid 0 y sin volumen de `node_modules`** (OD-035 a): stage `test` (`FROM base`, `install -d -o node -g node /work`, `USER node`, `WORKDIR /work`) y `target: test`. `node_modules` vive en la capa del contenedor y se descarta con `--rm`. La fase 1 deja de montar el volumen; `validate-node-modules` sale de `compose.yaml` y del `Makefile`. Cierra la parte de integridad entre ejecuciones de TD-017 (la de pnpm sin hash sigue en TASK-040).
19. **Tests en serie entre paquetes** (OD-034 a): `"test": "turbo run test --concurrency=1"` en el `package.json` raíz. docs-keeper actualiza la regla 11 de testing-conventions.
20. **¿ADR?** ADR-011 (Accepted). El fallback `node --import tsx` no necesita ADR (ADR-009 §7, anotado). La decisión 21 no necesita ADR: implementa decisiones humanas ya tomadas (OD-033, OD-037, OD-038) dentro de la máquina de estados vigente (`running → failed`, ARCHITECTURE §5); TASK-026 cambia el destino a `queued` + reanudación. El formato de `worker_id` y la forma de `runs.error` quedan fijados en ARCHITECTURE §8 (aprobación de la decisión 21 y OD-037 a).
21. **Barrido de runs huérfanos al arrancar y periódico (mitigación de OD-033; OD-037 a; OD-038 b).** **Aprobada (2026-10-21).** a–e resuelven las ambigüedades del primer encargo; f es el barrido periódico:

    **a. «Su propio `worker_id` anterior».** Con `randomUUID()` por arranque, un worker reiniciado no reconoce sus runs. Propuesta: `workerId = "<hostname>/<uuid>"` (decisión 11) y el barrido trata como huérfano todo run `running` cuyo `worker_id` empieza por `"<hostname>/"` y no es el actual. En Docker, `hostname` es el id del contenedor: se conserva con `docker compose restart`/`stop`+`up` y tras una caída (V14); en desarrollo es el del equipo, estable entre reinicios de `tsx watch`. El caso que motiva la mitigación es justo ese: vence `SHUTDOWN_GRACE_MS` (run `interrupted`, `running` sin heartbeat) y el worker vuelve a arrancar en segundos, con el heartbeat aún fresco.

    Alternativas descartadas:
    - *Solo heartbeat caducado, con `WORKER_CONCURRENCY=1` y un único worker*: no cubre ese caso. Con un reinicio en menos de `WORKER_STALE_MS` (60 s) el run sigue `running` hasta un arranque posterior.
    - *`WORKER_ID` estable por env o `hostname:` fijo en compose*: una variable más y un id compartido entre ejecuciones, que anula la guarda de `worker_id` de TASK-026 (una ejecución vieja y una nueva serían indistinguibles). Con `--scale worker=2` y `hostname:` fijo, el segundo worker marcaría `failed` los runs vivos del primero.
    - *Todo run `running` al arrancar es huérfano (ADR-004, un único worker)*: ADR-004 §2 admite varios workers y un worker local de desarrollo contra la misma base marcaría `failed` los runs vivos del otro.

    Residuo R12 (contenedor **recreado**, `hostname` nuevo, run interrumpido en los 60 s previos): **cerrado por OD-038 (b)**. El barrido periódico del worker nuevo lo marca en cuanto su heartbeat caduca (f).

    **b. Umbral.** `WORKER_STALE_MS` (60 000, ya en `core/env.ts`; ARCHITECTURE §4 y ADR-004 §3: «caducado (> 60 s)»). Se compara con el reloj de la base: `worker_heartbeat_at < now() - $staleMs * interval '1 millisecond'`; el heartbeat también lo escribe `now()` de la base, así que no hay deriva de relojes entre host y contenedor. Un run `running` con `worker_heartbeat_at` **nulo** cuenta como huérfano: nadie lo está latiendo (`claimNext` siempre lo rellena, así que solo aparece por una escritura manual o un camino futuro que no lo rellene).

    **c. `WORKER_INTERRUPTED`.** **No** entra en la lista cerrada de `AgentLabErrorCode` (OD-016): esa lista es la de los `code` de las subclases de `AgentLabError` que se lanzan, y aquí no se lanza nada; crear una clase sin ningún `throw` sería una variante «por si acaso». Es solo el valor de `runs.error.code` (decisión humana). Forma del jsonb `error` (OD-037 a, decidida): `InvocationError` de `core` (`{ code, message, retryable }`, `InvocationErrorSchema`), el único tipo de `core` para el error de un run: es el payload del evento `run.failed` y ARCHITECTURE §6 pide `jsonb` tipado con tipos de `core`. Valor fijo:

    ```ts
    { code: "WORKER_INTERRUPTED", message: "Worker stopped before the run finished; marked failed by the orphaned-run sweep", retryable: false }
    ```

    `retryable: false` porque nada lo reintenta en v1. La constante vive en `apps/worker/src/worker.ts`. **Transición**: el barrido no llama a `canTransition` fila a fila (es una sentencia sobre un conjunto), pero el estado origen está fijado en el `WHERE status = 'running'` y `running → failed` es una transición permitida (ARCHITECTURE §5). El test de integración afirma `canTransition("running", "failed") === true`, para que un cambio de la tabla de transiciones lo rompa. No emite `run.failed` en M0: llega con TASK-015 (OD-037 a). El mismo `error` sirve a los dos barridos; por eso el mensaje dice «by the orphaned-run sweep» y no «on worker startup».

    **d. Persistence y orden.** Un método nuevo en `RunsRepository` (persistence-dev) con **un solo modo y un criterio opcional**: `failOrphaned({ currentWorkerId, staleMs, error, hostPrefix? })`. Es una sola sentencia atómica (V13, V15):

    ```sql
    update runs set status = 'failed', error = $error, finished_at = now(), updated_at = now()
    where status = 'running'
      and worker_id is distinct from $currentWorkerId
      and (
        worker_heartbeat_at is null
        or worker_heartbeat_at < now() - $staleMs * interval '1 millisecond'
        -- only when hostPrefix is given:
        or starts_with(worker_id, $hostPrefix))
    returning id
    ```

    - La exclusión del `worker_id` actual se aplica a **todos** los criterios, no solo al de host como en la versión anterior. Así ningún barrido de este proceso marca un run suyo, aunque su heartbeat haya caducado, por ejemplo tras un corte de la base más largo que `WORKER_STALE_MS`. `is distinct from` deja como candidatos los `worker_id` nulos.
    - Con `hostPrefix` ausente, la línea `starts_with` no se genera: el fragmento `sql` de drizzle se compone de forma condicional, sin texto SQL concatenado.
    - `starts_with` evita los comodines de `LIKE` (`_`, `%`) en el nombre de host.
    - Con `READ COMMITTED`, si un worker vivo actualiza su heartbeat sobre una fila mientras el `UPDATE` espera su bloqueo, PostgreSQL vuelve a evaluar el `WHERE` sobre la versión nueva y no la marca.
    - `persistence` no decide la política: recibe el id actual, el umbral, el error y, si procede, el prefijo.

    Orden en el worker: `loadEnv` → logger → comprobación `WORKER_HEARTBEAT_MS < WORKER_STALE_MS` (f) → pool → `checkpointSchemaExists` → **barrido al arrancar** (`runWorker`, una vez, con `hostPrefix`) → N bucles de `claimNext` **y** el temporizador del barrido periódico (f).

    - Log `info` `orphaned runs marked failed` con `{ count, sweep: "startup" }` siempre, también con 0. Nunca la URL, el `Env` ni el `error` de las filas.
    - Si el barrido al arrancar falla → `fatal` (solo `name`/`code`) y código 1 (decisión 8).
    - Una señal durante el barrido al arrancar se atiende al terminar la sentencia: ni los bucles ni el temporizador llegan a arrancar.

    Alternativas descartadas para la firma:
    - *Dos métodos* (`failOrphanedOnStartup` / `failStaleRuns`): duplican la sentencia y el test de concurrencia por una línea de diferencia.
    - *Un discriminante `mode: "startup" | "periodic"`*: mete en `persistence` la política del worker (cuándo se aplica el criterio de host).

    **e. Relación con TASK-026 y TD-002.** Con OD-038 (b), TASK-008 hace **toda la detección** de huérfanos (al arrancar y periódica). TASK-026 queda **solo con la reanudación desde checkpoint**: cambia el destino `failed` de `failOrphaned` por `queued` + reanudación (ARCHITECTURE §4 y §5) y añade la guarda de `worker_id` (R4). Su scope (`apps/worker/**`, `packages/persistence/src/repositories/runs*.ts`) ya cubre ese cambio. El texto recortado de TASK-026 lo aplica el Orchestrator en TASKS.md (informe de esta actualización). TD-002 («el run queda `failed` por heartbeat, no se reanuda») pasa a ser cierto en M1–M2 gracias a este barrido; propuesta de texto en «Deuda».

    **f. Barrido periódico (OD-038 b).**

    - **Qué marca**: `failOrphaned({ currentWorkerId: workerId, staleMs, error: WORKER_INTERRUPTED_ERROR })`, **sin** `hostPrefix`. Solo cuenta el heartbeat caducado o nulo, nunca el criterio de host: con el de host, un segundo proceso en el mismo equipo marcaría cada minuto los runs vivos del primero, y no solo al arrancar (R11).
    - **Dónde corre**: una función `sweepLoop` dentro de `runWorker`, lanzada una sola vez por proceso junto a los N bucles (`Promise.all([...loops, sweepLoop()])`), independiente de ellos. Corre también mientras hay runs en curso: con `WORKER_CONCURRENCY=1` y un run largo, el worker sigue detectando los huérfanos de otros.
    - **Cadencia y no solapamiento**: es un bucle secuencial, `while (!shutdown.aborted) { await setTimeout(staleMs, undefined, { signal: shutdown }); await sweepOnce(); }` (`node:timers/promises`), y no un `setInterval`. La espera siguiente empieza cuando termina la sentencia anterior, así que un barrido lento no se solapa con el siguiente. El primero va `WORKER_STALE_MS` después del barrido al arrancar. Latencia máxima de detección: unos `2 × WORKER_STALE_MS` desde el último heartbeat (umbral más periodo), unos 120 s con los valores por defecto.
    - **Apagado**: el `abort` de `shutdown` rechaza la espera al momento (`AbortError`, que se captura y termina el bucle). Si hay una sentencia en vuelo, se espera a que termine: es una sola sentencia corta y la cubre el temporizador de seguridad de la decisión 7. `runWorker` no resuelve hasta que `sweepLoop` termina, y `main` cierra el pool **después** de `runWorker`. Así el barrido nunca usa un pool cerrado.
    - **Errores**: un error de base de datos en el barrido periódico → `warn` `orphaned run sweep failed` con `name`/`code` y se sigue con el siguiente periodo. `sweepLoop` no rechaza nunca, así que `Promise.all` no cae por él. El de arranque, en cambio, es `fatal` y código 1.
    - **Log**: `info` `orphaned runs marked failed` con `{ count, sweep: "periodic" }` solo si `count > 0`; con 0, `debug`, para no escribir una línea por minuto en reposo.
    - **El run activo de este worker nunca se marca**. Dos garantías independientes:
      1. La exclusión `worker_id is distinct from $currentWorkerId` de la sentencia (d). Cubre los barridos de este proceso.
      2. `WORKER_HEARTBEAT_MS < WORKER_STALE_MS`. Cubre los barridos de **otros** workers, que no pueden excluir este id. Hoy **no hay validación que lo garantice**: `EnvSchema` (`packages/core/src/env.ts`) declara cada variable por separado con `positiveInt` y no tiene `refine` entre campos. Con la decisión humana de no tocar `core` más allá de `WORKER_POLL_MS`, la comprobación va en `main.ts`, después de `loadEnv` y del logger y antes de `createPool`: si `WORKER_HEARTBEAT_MS >= WORKER_STALE_MS` → `fatal` `WORKER_HEARTBEAT_MS must be lower than WORKER_STALE_MS` con `{ heartbeatMs, staleMs }` (no son secretos) y `main` devuelve 1. No hace falta clase de error nueva: no se lanza nada. Los valores por defecto (15 000 < 60 000) dejan un margen de 4×. La regla es estricta (`<`), como pide la decisión; un margen mayor no lo fija nadie y no se inventa (R14).
    - **`WorkerDeps` no cambia**: el periodo es `staleMs`, el mismo campo que el umbral.

## Scope final (ruta → owner)

**Aprobada por el humano el 2026-10-21** («aprobadas las diez rutas de persistence más env.ts/env.test.ts de core»; la tabla tiene ocho rutas de `persistence` y dos de `core`, diez en total). El barrido periódico (OD-038 b) **no añade rutas**: vive en `runs.ts`, `worker.ts` y `main.ts`, ya incluidos. Sustituye a la tabla «Huecos de scope» del 2026-10-20 (OD-029 a aprobada). Rutas nuevas respecto a aquella: las de `core` (OD-036 b), `runs.ts`/`runs.integration.test.ts`, `testing/fixtures.ts`/`testing/index.ts` y `index.test.ts` de persistence (corrección: el plan anterior usaba `createScope`/`createQueuedRun` desde `@agentlab/persistence/testing`, pero `testing/index.ts` solo exporta `createTestDatabase`, `resetTestDatabase` y `truncateAll`; y el test «public API» de persistence compara con una lista cerrada que no tiene `checkpointSchemaExists`).

| Ruta | Owner | Paso | Por qué |
|---|---|---|---|
| `packages/core/src/env.ts`, `packages/core/src/env.test.ts` | core-dev | 1 | `WORKER_POLL_MS: positiveInt(1000)` y sus tests (OD-036 b) |
| `packages/persistence/src/checkpointer/setup.ts`, `packages/persistence/src/checkpointer/schema.integration.test.ts` | persistence-dev | 2 | `checkpointSchemaExists` y su test (decisión 12) |
| `packages/persistence/src/index.ts`, `packages/persistence/src/index.test.ts` | persistence-dev | 2 | Export de `checkpointSchemaExists` y lista cerrada del test «public API» |
| `packages/persistence/src/repositories/runs.ts`, `packages/persistence/src/repositories/runs.integration.test.ts` | persistence-dev | 2 | `failOrphaned` (con `hostPrefix` opcional) y su test (decisión 21 d) |
| `packages/persistence/src/testing/fixtures.ts`, `packages/persistence/src/testing/index.ts` | persistence-dev | 2 | `createRunningRun` y export de `createScope`, `createQueuedRun`, `createRunningRun` y `TestScope` para los tests del worker |
| `apps/worker/package.json`, `pnpm-lock.yaml`, `package.json` (raíz) | devops | 3 | Dependencias y scripts del worker; `"test": "turbo run test --concurrency=1"` |
| `apps/worker/**` (el resto) | engine-dev | 4 | Worker, tests, `vitest.config.ts`, `tsconfig.config.json` |
| `docker/worker.Dockerfile`, `.dockerignore`, `compose.yaml`, `Makefile`, `.env.example` | devops | 5 | ADR-011 con sus condiciones, redes, `cap_drop`, stage `test`, sin volumen de `node_modules`, `WORKER_POLL_MS` en `worker`, comentarios de `.env.example` |
| `docs/ARCHITECTURE.md` §1 | architect | 6 | Filas de `migrate` y `test`, redes (tras la implementación) |
| `docs/adr/ADR-010-*.md` (nota en Verificación), `.claude/skills/testing-conventions/SKILL.md` (regla 11), `docs/TECHNICAL_DEBT.md`, `docs/TASKS.md` | docs-keeper / Orchestrator | 6 | Cierre |

No hace falta tocar `turbo.json` (el hijo recibe un `env` construido; `passThroughEnv` ya cubre `test`), `compose.override.example.yaml` (V10) ni `packages/persistence/src/schema/runs.ts` (la forma del `error` se impone en la firma del método, no en la columna).

Ya hechos en las actualizaciones del 2026-10-21 (architect): SPEC §13 (OD-029…OD-038), ADR-011, ADR-000, nota de ADR-009 §7 (deja de ser trabajo de docs-keeper) y ARCHITECTURE §5 y §8 (incluido el barrido periódico). ARCHITECTURE §1 se queda para el paso 6: describe imágenes y redes que todavía no existen y conviene escribirlo con lo implementado.

## Pasos

0. **Orchestrator**: `deps_allowed` = `pino 10.4.0` exacta; scope de la tabla anterior en TASKS.md y `.claude/task-scope.json`; DoD nuevo (sección «DoD final»); deudas de la sección «Deuda»; recorte de TASK-026 y viñeta nueva de TASK-040 (textos en el informe de la segunda actualización). La decisión 21, OD-037 y OD-038 ya están decididas.
1. **core-dev** → `packages/core/src/env.ts`, `packages/core/src/env.test.ts`.
   - `WORKER_POLL_MS: positiveInt(1000)` junto a las otras `WORKER_*`.
   - Tests: el caso «applies documented defaults» incluye `WORKER_POLL_MS: 1000`; coerción de `"250"` a `250`; rechazo de `"0"` y `"abc"` nombrando la variable.
2. **persistence-dev** → `checkpointer/setup.ts`, `checkpointer/schema.integration.test.ts`, `index.ts`, `index.test.ts`, `repositories/runs.ts`, `repositories/runs.integration.test.ts`, `testing/fixtures.ts`, `testing/index.ts` (todas bajo `packages/persistence/src/`).
   - `checkpointSchemaExists` (decisión 12). Test: `true` sobre `agentlab_test` tras `resetTestDatabase` y `false` sobre la base de mantenimiento `postgres` del mismo servidor, cuya URL se construye como en `testing/reset.ts`.
   - `failOrphaned` en `RunsRepository` (decisión 21 d): exclusión del `currentWorkerId` siempre y criterio de host solo con `hostPrefix`.
   - `createRunningRun(db, scope, { workerId, heartbeatAgeMs })` en `fixtures.ts`: crea el run con el repositorio y fija `status`, `worker_id`, `worker_heartbeat_at = now() - edad` (o `null`) y `started_at` con una sentencia. Export desde `testing/index.ts` junto con `createScope`, `createQueuedRun` y `TestScope`.
   - `index.test.ts`: añade `checkpointSchemaExists` a la lista cerrada.
3. **devops (dependencias)** → `apps/worker/package.json`, `pnpm-lock.yaml`, `package.json` (raíz).
   - `dependencies`: `@agentlab/core` y `@agentlab/persistence` `workspace:*`, `tsx 4.23.15`, `pino 10.4.0`.
   - `scripts`: `dev` = `tsx watch src/index.ts`; `start` = `node --import tsx src/index.ts`; `typecheck` = `tsc --noEmit && tsc --noEmit -p tsconfig.config.json`; `lint`; `test` = `vitest run --coverage`.
   - Raíz: `"test": "turbo run test --concurrency=1"`.
   - Lockfile con `pnpm install --lockfile-only --ignore-scripts` en el contenedor fijado. Evidencia: `pnpm why tsx` y `pnpm why pino` muestran una sola versión; `pnpm install --frozen-lockfile --lockfile-only --ignore-scripts` sale con 0.
4. **engine-dev** → `apps/worker/`:
   - `src/index.ts`: señales y después `import()` de `main` (decisión 2).
   - `src/main.ts`: `main({ shutdown, executor? }): Promise<number>`. Lee campos sueltos de `loadEnv()`, crea el logger, comprueba `WORKER_HEARTBEAT_MS < WORKER_STALE_MS` (si no, `fatal` y 1; decisión 21 f), `createPool(env.DATABASE_URL)`, `checkpointSchemaExists`, `workerId` (decisión 11), `createRunsRepository(createDatabase(pool))`, `runWorker` y `pool.end()`.
   - `src/worker.ts`: `WORKER_INTERRUPTED_ERROR`, `runWorker` (barrido al arrancar una vez, N bucles y `sweepLoop`, el barrido periódico) y `finalize`.
   - `src/executor.ts`: `RunOutcome`, `RunExecutor`, `noopExecutor`.
   - `src/logger.ts`: `createLogger`.
   - `src/testing/gated-main.ts`: entrada del hijo para los tests de `SIGTERM`. Llama a `main` con un executor que obedece líneas de stdin: `release` (resuelve `"completed"`) y `block <ms>` (registra `blocking` y hace una espera activa síncrona de `<ms>`), o el abort.
   - `src/testing/global-setup.ts`: `resetTestDatabase(loadTestDatabaseUrl())`.
   - `vitest.config.ts` (`include: src/**/*.test.ts`, `fileParallelism: false`, `globalSetup`) y `tsconfig.config.json` (patrón de TD-010).
   - Tests (sección «Estrategia de tests»).
5. **devops (imágenes, compose, Makefile, env)**:
   - `docker/worker.Dockerfile` según ADR-011 con sus dos condiciones (decisión 14) y la decisión 18.
   - `.dockerignore` (decisión 15).
   - `compose.yaml`: decisiones 16 a 18; `WORKER_POLL_MS: ${WORKER_POLL_MS:-}` en `worker`; sin `validate-node-modules`.
   - `Makefile`: la fase 1 deja de montar el volumen de `node_modules`; se retira `validate-node-modules`.
   - `.env.example`: `WORKER_POLL_MS=1000` con comentario; el de `WORKER_STALE_MS` pasa a «heartbeat caducado → el worker marca el run failed, al arrancar y cada WORKER_STALE_MS (queued + reanudación desde TASK-026); debe ser mayor que WORKER_HEARTBEAT_MS»; el de `SHUTDOWN_GRACE_MS` a «≤ 35 s (stop_grace_period 40 s − margen 5 s)».

   Evidencias:
   - `ls /app/node_modules/.bin` de `worker` (`tsx`) y `migrate` (`drizzle-kit`, `tsx`).
   - `command -v pnpm corepack npm npx yarn`.
   - Prueba de canarios en el contexto.
   - Comparación de `/app/node_modules/.pnpm` con el lockfile.
   - **Condición 1 de ADR-011**: en una copia del repo, alterar el especificador de una dependencia en `pnpm-lock.yaml` → `docker build` de `runtime` y de `migrate` falla con `ERR_PNPM_OUTDATED_LOCKFILE`.
   - `docker compose --profile '*' config` (redes, `cap_drop`, `WORKER_POLL_MS`, sin volumen de `node_modules`).
   - `docker compose up --build -d`, y después `docker compose stop worker` **tras el log de arranque**: tiempo menor que `SHUTDOWN_GRACE_MS` y `docker inspect … ExitCode` = 0.
   - `make test` y `make validate` en macOS (make 3.81) y en el contenedor Linux (regla 10).
6. **architect** → ARCHITECTURE §1 (filas de `migrate` y `test`, redes). **docs-keeper** → nota en la Verificación de ADR-010 (`migrate` ejecuta `tsx src/cli/migrate.ts`), testing-conventions regla 11 (OD-034), TECHNICAL_DEBT y TASKS al cierre.

Orden: 1 y 2 en paralelo → 3 → 4 → 5 → verificación → 6. El paso 4 necesita 1 (`WORKER_POLL_MS`), 2 (métodos y fixtures) y 3 (dependencias).

## Contratos públicos nuevos o cambiados

- `@agentlab/core`: `EnvSchema` gana `WORKER_POLL_MS` (`number`, por defecto `1000`). Sin exports nuevos.
- `@agentlab/persistence`:

  ```ts
  export function checkpointSchemaExists(pool: pg.Pool): Promise<boolean>;

  export interface FailOrphanedInput {
    /** The caller's own worker_id; never marked, whatever its heartbeat. */
    readonly currentWorkerId: string;
    /** Heartbeat older than this, or null, means orphaned (WORKER_STALE_MS). */
    readonly staleMs: number;
    readonly error: InvocationError;
    /** worker_id prefix of this host ("<hostname>/"). When given, earlier runs of this host are orphaned regardless of heartbeat (startup sweep only). */
    readonly hostPrefix?: string;
  }
  interface RunsRepository {
    // …existing methods
    /** Marks orphaned running runs failed in one statement; returns their ids. */
    failOrphaned(input: FailOrphanedInput): Promise<string[]>;
  }
  ```

- `@agentlab/persistence/testing`: exporta además `createScope`, `createQueuedRun`, `TestScope` y el nuevo `createRunningRun(db: Database, scope: TestScope, options: { readonly workerId: string | null; readonly heartbeatAgeMs: number | null }): Promise<Run>`.
- `apps/worker` (interno; la app no exporta nada):

  ```ts
  export type RunOutcome = "completed" | "interrupted";
  export interface RunExecutor { execute(run: Run, signal: AbortSignal): Promise<RunOutcome> }
  export const noopExecutor: RunExecutor;
  export const WORKER_INTERRUPTED_ERROR: InvocationError;
  export interface WorkerDeps {
    readonly runs: Pick<RunsRepository, "failOrphaned" | "claimNext" | "transition" | "heartbeat">;
    readonly executor: RunExecutor;
    readonly logger: Logger;            // pino.Logger
    readonly workerId: string;          // "<hostname>/<uuid>"
    readonly hostPrefix: string;        // "<hostname>/"
    readonly concurrency: number;       // WORKER_CONCURRENCY
    readonly heartbeatMs: number;       // WORKER_HEARTBEAT_MS
    readonly pollMs: number;            // WORKER_POLL_MS
    readonly staleMs: number;           // WORKER_STALE_MS
    readonly shutdownGraceMs: number;   // SHUTDOWN_GRACE_MS
  }
  export function runWorker(deps: WorkerDeps, shutdown: AbortSignal): Promise<void>; // rejects only if the startup failOrphaned fails; resolves after the loops and the periodic sweep stop
  export function createLogger(options: { level: Env["LOG_LEVEL"]; destination?: pino.DestinationStream }): Logger;
  export function main(options: { shutdown: AbortSignal; executor?: RunExecutor }): Promise<number>; // exit code; 1 if WORKER_HEARTBEAT_MS >= WORKER_STALE_MS
  ```

- Scripts de `apps/worker`: `dev`, `start` (`node --import tsx src/index.ts`) y `test` (nuevos); `typecheck` amplía su alcance. Raíz: `test` = `turbo run test --concurrency=1`.
- Imágenes: `migrate` `CMD ["tsx","src/cli/migrate.ts"]` con `/app` = `persistence` desplegado. `runtime` `/app` = `worker` desplegado, `CMD ["node","--import","tsx","src/index.ts"]`. Nuevo stage `test`. Los stages `*-deploy` fallan si el lockfile no coincide con los manifiestos.
- Compose: red `test-db`; `test` → `target: test`, `networks: [test-db]`, sin volumen de `node_modules`; `worker` recibe `WORKER_POLL_MS`.

## Estrategia de tests

**core** (`env.test.ts`): ver paso 1.

**persistence** (`runs.integration.test.ts`, `describe("failOrphaned")`, con `createRunningRun`; edades lejos del umbral, 5 s y 120 s, para no depender del tiempo de ejecución):

- **Con `hostPrefix`** (barrido al arrancar). Marca `failed`: caducado de otro host, ejecución anterior del mismo host con heartbeat fresco, heartbeat nulo. Devuelve exactamente esos ids.
- **Sin `hostPrefix`** (barrido periódico), sobre las mismas filas: marca solo el caducado de otro host y el heartbeat nulo; la ejecución anterior del mismo host con heartbeat fresco sigue `running` (V15).
- No toca, en ninguno de los dos modos: fresco de otro host, el `currentWorkerId` **con heartbeat fresco y con heartbeat de 120 s**, `queued`, `awaiting_approval`, `completed`, y un `worker_id` con un host que solo comparte prefijo (`hostAA/…` frente a `hostA/`).
- En los marcados: `error` igual al de la entrada (y válido para `InvocationErrorSchema`), `finished_at` no nulo, `updated_at` refrescado.
- `canTransition("running", "failed") === true`.
- Concurrencia: una transacción abierta actualiza el heartbeat de un run caducado sin confirmar; `failOrphaned` en paralelo espera el bloqueo; tras el `COMMIT`, el run sigue `running` y no aparece en el resultado.
- `checkpointSchemaExists` (`schema.integration.test.ts`) e `index.test.ts`: ver paso 2.

**Unitarios del worker** (`apps/worker/src/worker.test.ts`, `logger.test.ts`): sin base de datos, con `vi.useFakeTimers()` (regla 4) y un `RunsRepository` falso en memoria.

- Barrido al arrancar: `failOrphaned` se llama una vez, antes del primer `claimNext`, con `hostPrefix`, `currentWorkerId: workerId`, `staleMs` y `WORKER_INTERRUPTED_ERROR`, también con `concurrency: 2`. Registra `count` con `sweep: "startup"`. Si rechaza, `runWorker` rechaza y no se llama a `claimNext` ni arranca el barrido periódico.
- **Barrido periódico** (reloj falso, `staleMs: 1000`):
  - Al avanzar 1000 ms y 2000 ms se hacen la segunda y la tercera llamada, **sin** `hostPrefix` y con `currentWorkerId`. Con `concurrency: 2` sigue habiendo una sola llamada por periodo.
  - Corre también con un run en curso: el executor está pendiente y las llamadas siguen llegando.
  - **No se solapa**: si la llamada periódica devuelve una promesa pendiente, avanzar 5000 ms no produce ninguna llamada más. Al resolverla, la siguiente llega exactamente 1000 ms después.
  - **Error**: si la llamada periódica rechaza, hay un `warn` con `name`/`code` y sin `message` de errores que no son `AgentLabError`, la siguiente llamada llega al periodo siguiente y `runWorker` no rechaza.
  - **Log**: con `count > 0`, `info` con `sweep: "periodic"`; con 0, ningún `info`.
  - **Apagado**: `shutdown` durante la espera → ninguna llamada más y `runWorker` resuelve. `shutdown` con la llamada periódica en vuelo → `runWorker` no resuelve hasta que esa llamada termina (orden comprobado con un registro de eventos: «sweep settled» antes de «runWorker resolved»).
- Reclama un run, ejecuta el executor y lo finaliza como `completed`.
- Llama a `heartbeat` a los 15 s y a los 30 s mientras el executor está pendiente, y deja de llamarlo tras `finalize`.
- `heartbeat` devuelve `false` → aborta el executor y no finaliza.
- `shutdown` en reposo → deja de reclamar y resuelve sin esperar al sondeo; en reposo vuelve a reclamar cada `pollMs`.
- `shutdown` con run en curso → no hay reclamaciones nuevas; el run se finaliza si el executor resuelve dentro de la gracia.
- Vence `SHUTDOWN_GRACE_MS` → el `signal` del executor queda abortado; con `"interrupted"` no hay `transition`.
- El executor lanza → `failed`.
- `InvalidTransitionError` en `finalize` → `warn` y el bucle sigue.
- Error en `claimNext` → `error` y se reintenta en el siguiente sondeo.
- `main` con `WORKER_HEARTBEAT_MS >= WORKER_STALE_MS`: lo cubre el caso (j) en proceso hijo; no hace falta un unitario aparte.
- `concurrency: 2` → dos runs en vuelo.
- Logger (decisión humana OD-030): un canario en `DATABASE_URL`, `DATABASE_URL_TEST`, `OPENROUTER_API_KEY` y `GEMINI_API_KEY` (los nombres derivados de `EnvSchema`), registrado en la raíz y anidado, no aparece en la salida y en su lugar sale `[REDACTED]`. El `message` de un error que no es `AgentLabError` tampoco aparece.

**Integración en proceso hijo** (`apps/worker/src/worker.integration.test.ts`): PostgreSQL real (`agentlab_test`, `truncateAll` por test, `createScope`/`createQueuedRun`/`createRunningRun` de `@agentlab/persistence/testing`).

- Cómo se lanza el hijo: `spawn(process.execPath, ["--import", "tsx", "src/index.ts"])` (o `src/testing/gated-main.ts`) con `cwd` = `apps/worker`.
- El `env` del hijo es un objeto mínimo **construido, no copiado de `process.env`** (regla 5): `DATABASE_URL` = URL de pruebas, `LOG_LEVEL`, y `SHUTDOWN_GRACE_MS`/`WORKER_POLL_MS` cuando haga falta, y `WORKER_HEARTBEAT_MS`/`WORKER_STALE_MS` en los casos (i) y (j). El hijo no hereda ninguna `*_API_KEY` salvo el canario explícito del caso (h).
- Se espera a líneas de log concretas del hijo (`orphaned runs marked failed` con su `sweep`, `worker started`, `run claimed`, `run finalized`, `shutdown requested`, `blocking`) y al evento `exit`. No hay `sleep`.
- Los runs de los casos (g) usan `os.hostname()` del proceso de test, que es el mismo que el del hijo.

Casos:

- (a) DoD: run `queued` → `index.ts` real → `completed`. `worker_id` empieza por `<hostname>/`, `worker_heartbeat_at` no nulo (era `null` al crearlo) y `finished_at` no nulo. Después `SIGTERM` → código 0.
- (b) `SIGTERM` con run en curso (`gated-main.ts`). Tras `shutdown requested`, el run sigue `running` en la base y `child.exitCode === null`. Con `release` → `completed` y código 0.
- (c) Vencimiento: `SHUTDOWN_GRACE_MS=300` sin `release` → código 0, el run sigue `running` y `finished_at` es nulo. Un segundo hijo arrancado después lo marca `failed` con `error.code = "WORKER_INTERRUPTED"` (mismo host, otro uuid: cierra el ciclo de OD-033).
- (d) `SIGTERM` en reposo → 0.
- (e) `SIGTERM` enviado nada más hacer `spawn`, antes de `worker started` → 0 (V9).
- (f) **Bucle de eventos bloqueado** (DoD de OD-032): con un run en curso, `block 200` por stdin; al leer `blocking`, `SIGTERM`. El hijo atiende la señal al terminar la espera activa; con `release` → código 0 (con el CLI de `tsx` sería 143).
- (g) **Huérfanos al arrancar**: antes de lanzar el hijo, `createRunningRun` con (1) `<hostname>/<otro uuid>` y heartbeat de 5 s, (2) `otro-host/<uuid>` y 120 s, (3) heartbeat nulo, (4) `otro-host/<uuid>` y 5 s, más un run `queued`. Resultado: (1)–(3) `failed` con `error` = `WORKER_INTERRUPTED_ERROR` y `finished_at` no nulo; (4) sigue `running`; el `queued` termina `completed`; el log incluye `"count":3`.
- (h) **Canarios en la salida** (OD-030): `DATABASE_URL` = la URL de pruebas apuntando a la base `postgres` (esquema ausente) con un canario en `?application_name=<canario>` (la conexión sigue funcionando), y `OPENROUTER_API_KEY` = otro canario → código 1; la salida (stdout y stderr completos) contiene `pnpm db:migrate` y **no** contiene ninguno de los dos canarios ni la contraseña de la URL.
- (i) **Barrido periódico** (OD-038 b), con `gated-main.ts`, `WORKER_HEARTBEAT_MS=200` y `WORKER_STALE_MS=1000`:
  1. Un run `queued`; esperar a `orphaned runs marked failed` con `sweep: "startup"` y `"count":0`, y a `run claimed`.
  2. Crear con `createRunningRun` un run `otro-host/<uuid>` con heartbeat de 120 s y otro `<hostname>/<otro uuid>` con heartbeat fresco (el que el criterio de host marcaría).
  3. Esperar a `orphaned runs marked failed` con `sweep: "periodic"` y `"count":1`.
  4. Comprobar: el de `otro-host` está `failed` con `WORKER_INTERRUPTED_ERROR`; el del mismo host sigue `running`; el run propio sigue `running` aunque lleva en curso al menos un periodo. Con `release`, el propio queda `completed`. `SIGTERM` → código 0.
- (j) **Comprobación de tiempos**: `WORKER_HEARTBEAT_MS=60000`, `WORKER_STALE_MS=60000` y `DATABASE_URL=postgres://u:p@127.0.0.1:1/x` (puerto sin servicio) → código 1. La salida contiene `WORKER_HEARTBEAT_MS must be lower than WORKER_STALE_MS` y no contiene ningún error de conexión, así que la comprobación va antes del pool.

**Infra** (tester, manual con evidencia): todo lo del paso 5. La cadencia exacta del heartbeat y del barrido periódico se prueba en el unitario con fake timers.

**Ejecución**: `make test` (dos fases, servicio `test` sin uid 0 en `test-db`, sin volumen de `node_modules`, `turbo run test --concurrency=1`). `make validate` incluye `typecheck` del worker. Cobertura: el DoD no fija objetivo; se informa el porcentaje.

## Riesgos

- **R1**: `deploy` necesita red con el contexto copiado y, en pnpm 9, no es `frozen`. Mitigado por la condición 1 de ADR-011 (V12) y por la comparación de `.pnpm` con el lockfile en la evidencia del paso 5. TASK-040 revisa el `deploy` de pnpm ≥10.
- **R2**: `rm` de corepack/npm/yarn no quita sus bytes de la capa base, solo los deja sin ejecutar (ADR-011).
- **R3**: *(cerrado por OD-032 a.)*
- **R4**: `transition` no comprueba `worker_id`. Sin riesgo con un solo worker hasta TASK-026, que añade esa guarda.
- **R5**: *(sustituido por la decisión 21.)* Un run `interrupted` ya no se queda `running` para siempre: lo marca `failed` el siguiente arranque o, si el heartbeat caduca antes, el barrido periódico de cualquier worker vivo. Sigue sin reanudarse hasta TASK-026.
- **R6**: `SHUTDOWN_GRACE_MS` > 35 s con `stop_grace_period: 40s` → Docker manda `SIGKILL` antes de que acabe el margen.
- **R7**: el `redact` de pino solo cubre claves en la raíz y a un nivel de profundidad, no los valores dentro de un texto. Los textos se cubren con el serializador `err` y la regla de no registrar `Env`. `redactSecrets` llega en TASK-027. El test de canarios lo comprueba en la implementación.
- **R8**: los paquetes inyectados llevan `*.test.ts` y `src/testing/**`, incluido el helper que hace `DROP DATABASE` (código inerte en runtime). Decisión humana: deuda LOW, se paga en TASK-040.
- **R9**: TASK-007 amplía la lista de inclusión de `.dockerignore` (ya en su DoD).
- **R10**: los volúmenes `agentlab-validate-node-modules` que ya existen son de root (uid 0). Con OD-035 (a) dejan de usarse y TASK-009 debe indicar en el README cómo borrarlos.
- **R11**: el barrido identifica «el mismo worker» por el `hostname`. Dos procesos worker en el mismo host fuera de contenedores (dos `pnpm dev` contra la misma base) se marcarían `failed` los runs vivos al arrancar (solo al arrancar: el barrido periódico no usa el criterio de host, decisión 21 f). ADR-004 no prueba varios workers en v1; queda documentado en el log de arranque (`workerId`) y en el informe.
- **R12**: *(cerrado por OD-038 b, 2026-10-21.)* Contenedor recreado (`hostname` nuevo) en menos de `WORKER_STALE_MS` desde el último heartbeat de un run interrumpido: el barrido periódico del worker nuevo lo marca cuando caduca, a lo sumo unos `2 × WORKER_STALE_MS` después del último heartbeat. Test (i).
- **R14**: la garantía `WORKER_HEARTBEAT_MS < WORKER_STALE_MS` es estricta y no deja margen. Con valores muy próximos (por ejemplo 59 000 y 60 000), un heartbeat que tarde en escribirse por la latencia de la base puede hacer que el barrido de **otro** worker marque un run vivo. Los barridos propios no, por la exclusión del `worker_id`. Ese run lo detecta su heartbeat siguiente (`false`): el executor se aborta y el run no se finaliza (decisión 6). Los valores por defecto dan un margen de 4×. Exigir un margen mayor sería un requisito nuevo que nadie ha fijado. No hay OD: si el humano lo quiere, basta con cambiar la comparación de `main.ts`.
- **R15**: con varios workers, cada uno hace su barrido periódico (N sentencias por periodo). Son idempotentes: la segunda no encuentra filas `running` que cumplan el predicado. Coste: una sentencia por worker y por minuto, sobre el índice `runs_status_created_at_idx`.
- **R13**: `os.hostname()` de un equipo de desarrollo queda en `runs.worker_id` y en los logs locales. No es un secreto; lo revisa security.

## Deuda propuesta (la registra el Orchestrator)

- **Tests y helpers de test dentro de las imágenes** (aprobada por el humano el 2026-10-21; `*.test.ts`, `src/testing/**` de los paquetes inyectados, incluido el `DROP DATABASE` de `testing/reset.ts`). LOW. Se paga en TASK-040: excluir `*.test.ts` y `src/testing/**` en el `deploy` (`files` en los `package.json`) o en un `.dockerignore` de stage. Introducida en TASK-008.
- **Limpieza del `package.json` raíz en `migrate-deploy`** (aprobada por el humano el 2026-10-21; `npm pkg delete devDependencies`, condición 2 de ADR-011). LOW. Se paga en TASK-040: al subir pnpm, comprobar si `deploy` deja de instalar las devDependencies de la raíz o tiene una opción nativa y, si es así, quitar la limpieza. Introducida en TASK-008.
- **Actualizaciones de deuda existente** (al cierre): TD-015, TD-020 y TD-022 → PAID (TASK-008); TD-021 → parcial (red pagada; rol no superusuario en TASK-037); TD-017 → parcial (volumen de `node_modules` retirado; pnpm sin hash sigue en TASK-040); TD-002, texto propuesto: «Checkpointer `MemorySaver` en M1: un reinicio del worker pierde el estado del grafo; el run en curso queda `failed` (`WORKER_INTERRUPTED`) en el siguiente arranque del worker o, si su heartbeat caduca antes, en el barrido periódico (TASK-008), y no se reanuda».

## DoD final de TASK-008 (texto para TASKS.md; lo aplica el Orchestrator)

**Dependencias autorizadas** (sustituye a la línea actual): `pino` 10.4.0 exacta en `dependencies` de `apps/worker` (OD-030 a); `tsx` ya declarado por TASK-003 (ADR-009).

Viñetas del DoD actual de TASKS.md que **se mantienen tal cual**: «Sustituye el `apps/worker/src/index.ts` provisional…», «Bucle `claimNext` → …», «Heartbeat cada 15 s…», «Test: crear run `queued` en DB…», «Imagen de runtime del worker…», «Red `internal: true`…», «Las imágenes de `worker` y `migrate` no contienen devDependencies…».

Viñetas que **cambian** (sustituyen a la viñeta actual indicada):

- *(sustituye a «Scripts de `apps/worker`…»)* `Scripts de apps/worker: dev = tsx watch src/index.ts, start = node --import tsx src/index.ts (fallback de ADR-009 §7, OD-032); CMD de la imagen runtime = ["node", "--import", "tsx", "src/index.ts"].`
- *(sustituye a «Con `SIGTERM` bajo `tsx`…»)* `Con SIGTERM: el worker deja de reclamar, para el barrido periódico, espera al run en curso hasta SHUTDOWN_GRACE_MS, lo deja en estado coherente (si vence la gracia, running sin heartbeat; OD-033), cierra el pool y sale con código 0. Tests en proceso hijo lanzado con node --import tsx: SIGTERM en reposo, con run en curso, al vencer la gracia, nada más arrancar y con el bucle de eventos bloqueado más de 30 ms (espera activa de 200 ms en el executor); todos con código 0.`
- *(sustituye a «El logger del worker oculta…»)* `El logger del worker oculta (redact) *_API_KEY y DATABASE_URL* desde su introducción, sin esperar a TASK-027 (TD-011, security). Test con un valor canario en DATABASE_URL y en una *_API_KEY: no aparece en la salida (unitario del logger y salida completa de un proceso hijo).`
- *(sustituye a «Al arrancar, el worker comprueba que existe el esquema `langgraph`…»)* `Al arrancar, el worker comprueba que existe el esquema langgraph (pg_namespace); si no, sale con código 1 y un mensaje que indica ejecutar pnpm db:migrate (servicio migrate en compose) (ADR-002). Test del caso de fallo.`

Viñetas **nuevas**:

- `worker_id = <hostname>/<uuid>, generado en cada arranque y registrado en el log de arranque.`
- `Barrido de runs huérfanos al arrancar (OD-033, decisión 21): tras comprobar el esquema langgraph y antes del primer claimNext, una sola sentencia (failOrphaned de persistence) marca failed los runs running con heartbeat caducado (WORKER_STALE_MS) o nulo, o con un worker_id de una ejecución anterior del mismo host; nunca el worker_id actual. runs.error = InvocationError { code: "WORKER_INTERRUPTED", message fijo, retryable: false } (OD-037 a; WORKER_INTERRUPTED no es un AgentLabErrorCode) y finished_at fijado; sin evento (run.failed llega con TASK-015). Registra cuántos marcó, sin datos sensibles. Un error en este barrido termina el proceso con código 1. Test de integración del método en persistence y test en proceso hijo.`
- `Barrido periódico de runs huérfanos (OD-038 b): cada WORKER_STALE_MS, con un temporizador propio independiente de los bucles de reclamación, la misma sentencia solo con el criterio de heartbeat caducado o nulo (nunca el de host) y nunca sobre el worker_id actual. No se solapa consigo mismo; el apagado lo detiene antes de cerrar el pool; un error de base de datos en él se registra como warn y el worker sigue. Test unitario con reloj falso (cadencia, no solapamiento, error, apagado con y sin barrido en vuelo) y test en proceso hijo (marca un run ajeno caducado, no marca el run propio en curso ni uno del mismo host con heartbeat fresco).`
- `El worker sale con código 1 y un mensaje claro, antes de conectar con la base de datos, si WORKER_HEARTBEAT_MS no es menor que WORKER_STALE_MS. Test en proceso hijo.`
- `WORKER_POLL_MS declarada en core/env.ts (entero positivo, por defecto 1000), con test en env.test.ts, en .env.example y en el environment de worker en compose.yaml (OD-036).`
- `Los stages de deploy de docker/worker.Dockerfile ejecutan pnpm install --frozen-lockfile --lockfile-only --ignore-scripts --offline antes del deploy (y, en migrate, antes de quitar las devDependencies de la raíz); evidencia: con un especificador alterado en pnpm-lock.yaml el build falla con ERR_PNPM_OUTDATED_LOCKFILE (condición 1 de ADR-011).`
- `pnpm test en la raíz ejecuta turbo run test --concurrency=1 (OD-034).`
- `El servicio test de compose y la fase 1 de make test/make validate no usan volumen de node_modules; el volumen validate-node-modules desaparece de compose.yaml y del Makefile (OD-035, TD-017 en su parte de integridad entre ejecuciones).`

**Scope** (sustituye a la línea actual de TASKS.md; los owners por ruta están en «Scope final»):

`apps/worker/**` (engine-dev; `apps/worker/package.json` devops), `packages/core/src/env.ts`, `packages/core/src/env.test.ts` (core-dev), `packages/persistence/src/checkpointer/setup.ts`, `packages/persistence/src/checkpointer/schema.integration.test.ts`, `packages/persistence/src/index.ts`, `packages/persistence/src/index.test.ts`, `packages/persistence/src/repositories/runs.ts`, `packages/persistence/src/repositories/runs.integration.test.ts`, `packages/persistence/src/testing/fixtures.ts`, `packages/persistence/src/testing/index.ts` (persistence-dev), `package.json`, `pnpm-lock.yaml`, `docker/worker.Dockerfile`, `.dockerignore`, `compose.yaml`, `Makefile`, `.env.example` (devops), `docs/ARCHITECTURE.md` §1 (architect), `docs/adr/ADR-010-tsx-en-persistence.md`, `.claude/skills/testing-conventions/SKILL.md`, `docs/TECHNICAL_DEBT.md`, `docs/TASKS.md` (docs-keeper / Orchestrator, al cierre)

## OPEN DECISIONS

Resueltas el 2026-10-21: OD-029…OD-038 (SPEC §13). La decisión 21 está aprobada. Esta actualización no abre ninguna OD nueva. Hay dos observaciones para el Orchestrator; no son decisiones abiertas:

- ARCHITECTURE §4, «Recuperación tras caída del worker», sigue diciendo «al arrancar». Describe el destino de TASK-026 (reanudación) y no se ha tocado, porque el encargo limita los cambios a §5 y §8. §8 ya dice que la detección corre en los dos momentos. Si TASK-026 reanuda también los runs que detecta el barrido periódico, su plan ajusta §4.
- El scope de TASK-040 (`docs/adr/**`, ARCHITECTURE §9, plan) no cubre los ficheros que tocaría pagar las dos deudas LOW (`docker/worker.Dockerfile`, `packages/*/package.json` o `.dockerignore`). Ya pasa lo mismo con viñetas de su DoD actual (el hash de pnpm en los Dockerfiles y el Makefile). Se resuelve al planificar TASK-040.

## Fuentes

- pnpm 9.15.9, `deploy` (`frozenLockfile: false`, `saveLockfile: false`, `useLockfile`, `modulesDir` del deploy): https://github.com/pnpm/pnpm/blob/v9.15.9/releasing/plugin-commands-deploy/src/deploy.ts (consultado el 2026-10-20 y el 2026-10-21). Documentación actual, v12 (lockfile dedicado, `--legacy`): https://pnpm.io/cli/deploy
- tsx 4.23.15, `relaySignals` (espera de 30 ms y `SIGKILL`): https://github.com/privatenumber/tsx/blob/v4.23.15/src/cli.ts (2026-10-20)
- pino 10.4.0: `npm view pino` (dist-tags, time, dependencies, types); `redact`: https://github.com/pinojs/pino/blob/main/docs/redaction.md; destino por defecto y vaciado al salir: https://github.com/pinojs/pino/blob/v10.4.0/lib/tools.js (2026-10-20)
- PostgreSQL 16, `information_schema.schemata` (solo los esquemas con privilegios): https://www.postgresql.org/docs/16/infoschema-schemata.html; `starts_with`: https://www.postgresql.org/docs/16/functions-string.html (2026-10-21)
