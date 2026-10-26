# M0 — Informe de cierre (verificación desde clone limpio)

Fecha: 2026-10-23
Autor: tester (TASK-009), con ciclos de corrección 1 y 2 (2026-10-26) tras la revisión del reviewer
Commit verificado: `f5a1a27696de6ecda88c93723bbaf818f753826b` (rama `main`, `git status --short` vacío tras el clone)
Estado: criterio de salida verificado en local y en CI. M0 cerrado el 2026-10-26: `ROADMAP.md:10` (a) se cumple con TASK-009 en DONE y (c) con la aceptación del humano (ver §6).

Convención de evidencia: «observado por el tester» significa que el código de salida lo vio el tester en su sesión; los logs del scratchpad no registran códigos de salida, así que se cita la última línea del log que lo respalda. Los logs estaban en `<S>` = `/private/tmp/claude-501/-Users-davidferanandezmorilla-Desktop-development-nosync-agentlab/3fa7c665-c570-4833-afbe-b934a451dd31/scratchpad/` (ya no existen; ver §7, incidencia 5).

## 1. Procedimiento

1. `make down` en el árbol de trabajo (sin `-v`); `docker compose ps` vacío.
2. `git clone https://github.com/davidfdzmorilla/Agents-Lab.git` en el scratchpad, directorio `agentlab-m0`. HEAD = `f5a1a27696de6ecda88c93723bbaf818f753826b`.
3. El humano puso el `.env` del clone a mano (no se ejecutó `cp .env.example .env`; ningún agente leyó ningún `.env`).
4. Primera pasada sin aislamiento (antecedente, §4, H-1).
5. Segunda pasada con `env COMPOSE_PROJECT_NAME=agentlab-m0` delante de cada comando de Compose del clone. **Esta variable es una condición del entorno de prueba, como el `.env`; no es un paso del README.** El README no se modificó.
6. Cierre: `docker compose down -v` solo del proyecto `agentlab-m0` y borrado del clone.

## 2. Pasos del README (camino principal, segunda pasada)

El clone ya no existe, así que las salidas cortas de `docker compose ls` y `make ps` no se conservaron en un fichero. Lo que sigue es lo observado por el tester en su sesión y lo respaldado por los logs citados.

| Paso README | Comando | Resultado | Evidencia |
|---|---|---|---|
| `cp .env.example .env` y rellenar | no ejecutado | lo hizo el humano | — |
| `make up` (README:50) | `env COMPOSE_PROJECT_NAME=agentlab-m0 make up` | EXIT=0 (observado por el tester) | `<S>m0b-make-up.log`; orden de arranque en `:181-195` (ver abajo) |
| proyecto Compose | `docker compose ls` | `agentlab-m0 running(3)` (observado; salida no conservada; el clone no existe) | contenedores `agentlab-m0-*` en `m0b-make-up.log:181-195` |
| `curl localhost:3000/api/health` (README:51) | `curl -s localhost:3000/api/health` | 1 intento; `{"ok":true,"db":"up","version":"0.0.0"}`, coincide con README:62. Se usó `-s` (sin barra de progreso); la primera pasada lo ejecutó literal con la misma respuesta | observado |
| `make ps` (README:66) | `env COMPOSE_PROJECT_NAME=agentlab-m0 make ps` | EXIT=0 observado. Contenedores `agentlab-m0-db-1` (healthy), `agentlab-m0-web-1` (`127.0.0.1:3000->3000/tcp`), `agentlab-m0-worker-1`. La salida literal no se conservó. | «worker y web en marcha» se apoya en `m0b-make-logs.log:56-57` (worker) y `:67` (`web-1 \| ✓ Ready in 0ms`) |
| `make logs` (README:66) | `env COMPOSE_PROJECT_NAME=agentlab-m0 make logs > …` | sigue indefinidamente (`logs -f`); se cortó con `kill` de los dos PIDs `docker compose … logs -f`; `make: *** [logs] Error 130` | `<S>m0b-make-logs.log` |
| `make test` (README:70) | `env COMPOSE_PROJECT_NAME=agentlab-m0 make test > …` | EXIT=0 (observado por el tester) | `<S>m0b-make-test.log:289`: ` Tasks:    4 successful, 4 total` |
| `make validate` (README:71) | `env COMPOSE_PROJECT_NAME=agentlab-m0 make validate > …` | EXIT=0 (observado por el tester) | `<S>m0b-make-validate.log:303`: ` Tasks:    4 successful, 4 total`; última línea: `All matched files use Prettier code style!` |
| `make down` (README:66) | sustituido por `docker compose down -v` del cierre | EXIT=0 (observado) | §5 |

Orden de arranque (README:54-58), de `m0b-make-up.log:181-195`: `db` Healthy → `migrate` Starting/Started → `migrate` Exited → `worker` Starting y `web` Starting/Started → `worker` Started (la última línea del log, `:195`, es ` Container agentlab-m0-worker-1 Started `).

Arranque en frío, en `m0b-make-logs.log`:
- `:36` `db-1 | /usr/local/bin/docker-entrypoint.sh: running /docker-entrypoint-initdb.d/init.sql`
- `:37-38` `db-1 | CREATE DATABASE` (dos veces: `agentlab` y `agentlab_test`)
- `:47` `migrate-1 | {"level":"info","msg":"migrations applied"}`
- `:52` `db-1 | PostgreSQL init process complete; ready for start up.`
- `:56-57` líneas del `worker` (arranque y `orphaned runs marked failed`)
- `:67` `web-1 | ✓ Ready in 0ms`

## 3. No verificado, y por qué

- **Por regla** (requiere acción prohibida a los agentes):
  - `cp .env.example .env` y la edición de `.env`: lo hizo el humano.
  - Sección «Desarrollo en el host» (README:75-118): `pnpm install`, `make setup`, `make lint`, `make typecheck`, `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:reset`, `cp compose.override.example.yaml compose.override.yaml` y el `make up` con override: no verificado: requiere Node en el host (prohibido a los agentes). `make verify-hooks` y `core.hooksPath` sí se comprobaron en el árbol de trabajo (§6, entregable de hooks).
  - `make orchestrator`: no aplica.
- **Fuera de alcance:** `make up-local` (Ollama), que no es criterio de salida de M0.
- El contraste de `0000_init.sql` con `ARCHITECTURE.md §6` ya no queda pendiente: lo hizo el reviewer (§6, tabla).

## 4. Hallazgos

- **H-1 (LOW)** `compose.yaml:1` — `name: agentlab`. Fija el nombre del proyecto Compose, así que dos checkouts en la misma máquina comparten contenedores, redes y volúmenes (`agentlab_pgdata`), sea cual sea el nombre del directorio. Detectado en la primera pasada: el clone arrancó como proyecto `agentlab` (`agentlab-db-1`…) sobre el volumen `agentlab_pgdata` del árbol de trabajo, no sobre uno vacío; `down -v` habría borrado datos del árbol de trabajo y se detuvo la verificación. Decisión humana: «`compose.yaml:1` fija `name: agentlab`, así que dos checkouts en la misma máquina comparten volúmenes; se decide después de M0 si se documenta o se cambia.»
- **H-2 (informativo)** `docs/TASKS.md` en el commit verificado: `TASK-009-prep` figura `VERIFIED (pendiente de CI…)` y `TASK-009` `BLOCKED`. Afecta a `ROADMAP.md:10` (a) (§6). El run de CI de f5a1a27 es success, así que docs-keeper puede cerrar ambas.
- **H-3 (deuda LOW, pago en TASK-040)** «Ruido en el log del primer arranque»: `m0b-make-logs.log:65-66` registra en PostgreSQL `ERROR:  relation "langgraph.checkpoint_migrations" does not exist at character 15` / `STATEMENT:  SELECT v FROM "langgraph".checkpoint_migrations ORDER BY v DESC LIMIT 1`.
  - Causa confirmada (reviewer): la `setup()` de `PostgresSaver` (`@langchain/langgraph-checkpoint-postgres` 1.1.0, `dist/index.js:97` hace el SELECT sobre `checkpoint_migrations` y `:100` traga el `42P01`). Camino: `cli/migrate.ts:9` → `migrate.ts:33` → `checkpointer/setup.ts:11`.
  - Aparece una sola vez (`m0b-make-logs.log:65`) y, por código, va antes de «migrations applied» (`:47` en el log de contenedores; el worker no interviene): `packages/persistence/src/migrate.ts:33` (`await setupCheckpointer(pool);`) se ejecuta dentro de `runMigrations`, que `packages/persistence/src/cli/migrate.ts:9` espera antes de escribir «migrations applied» en `:14`.
  - Decisión humana: deuda LOW, pago en TASK-040, donde se decide cómo (nota en el README o incidencia en la librería). No es OPEN DECISION. (Esta redacción sustituye a la primera versión de H-3, que atribuía el error a una comprobación del worker y era incorrecta.)
- Sin otras desviaciones README–realidad en el camino principal salvo H-1 (de `compose.yaml`, no del texto del README).

### Antecedente: primera pasada, sin aislamiento
- `make up` EXIT=0, log `<S>m0-make-up.log`.
- `curl localhost:3000/api/health` (literal), 1 intento: `{"ok":true,"db":"up","version":"0.0.0"}`.
- `make ps`: contenedores `agentlab-db-1`, `agentlab-web-1`, `agentlab-worker-1`, db `healthy`, web en `127.0.0.1:3000->3000/tcp`.
- Parada por H-1. `make down` sin `-v`; `agentlab_pgdata` siguió ahí.

## 5. Volúmenes y proyectos

Tras `make down` sin `-v` del clone, antes de la segunda pasada: `docker compose ls` listaba solo `autoinvest-demo`, `bitwarden` y `nocturna` (ningún `agentlab`); `docker volume ls --filter name=agentlab`:
```
DRIVER    VOLUME NAME
local     agentlab-pnpm-store
local     agentlab_pgdata
```
Tras `make up` con la variable, `docker compose ls` mostró `agentlab-m0   running(3)` (observado; salida íntegra no conservada).

Antes del `down -v`:
```
DRIVER    VOLUME NAME
local     agentlab-m0_pgdata
local     agentlab-pnpm-store
local     agentlab_pgdata
```
`env COMPOSE_PROJECT_NAME=agentlab-m0 docker compose down -v` → EXIT=0. Salida entera:
```
 Container agentlab-m0-worker-1 Stopping 
 Container agentlab-m0-web-1 Stopping 
 Container agentlab-m0-web-1 Stopped 
 Container agentlab-m0-web-1 Removing 
 Container agentlab-m0-worker-1 Stopped 
 Container agentlab-m0-worker-1 Removing 
 Container agentlab-m0-web-1 Removed 
 Container agentlab-m0-worker-1 Removed 
 Container agentlab-m0-migrate-1 Stopping 
 Container agentlab-m0-migrate-1 Stopped 
 Container agentlab-m0-migrate-1 Removing 
 Container agentlab-m0-migrate-1 Removed 
 Container agentlab-m0-db-1 Stopping 
 Container agentlab-m0-db-1 Stopped 
 Container agentlab-m0-db-1 Removing 
 Container agentlab-m0-db-1 Removed 
 Volume agentlab-m0_pgdata Removing 
 Network agentlab-m0_test-db Removing 
 Network agentlab-m0_egress Removing 
 Network agentlab-m0_backend Removing 
 Volume agentlab-m0_pgdata Removed 
 Network agentlab-m0_test-db Removed 
 Network agentlab-m0_backend Removed 
 Network agentlab-m0_egress Removed 
```
Después:
```
DRIVER    VOLUME NAME
local     agentlab-pnpm-store
local     agentlab_pgdata
```
`agentlab_pgdata` y `agentlab-pnpm-store` quedaron idénticos. El clone se borró con `rm -rf` (EXIT=0).

## 6. Criterio de salida

### `ROADMAP.md:26`
«`docker compose up --build` levanta el entorno, `curl localhost:3000/api/health` devuelve `{ ok: true, db: "up" }` y `pnpm test` pasa en limpio y en CI».

| Parte | Resultado | Evidencia |
|---|---|---|
| `docker compose up --build` levanta el entorno | cumplido | `make up` = `docker compose up --build -d` (`Makefile:53`); EXIT=0 con volumen vacío (init.sql, migraciones, worker y web). `m0b-make-up.log:181-195`, `m0b-make-logs.log:36-67` |
| `curl …/api/health` → `{ ok: true, db: "up" }` | cumplido | `{"ok":true,"db":"up","version":"0.0.0"}` al primer intento. La comprobación de la base está en `apps/web/src/server/health.ts:18` (`const up = await pingDatabase(pool, { timeoutMs });`) |
| `pnpm test` en limpio | cumplido | `make test` (ejecuta `pnpm test` en contenedor), EXIT=0 observado, `m0b-make-test.log:289`; además `make validate` EXIT=0, `m0b-make-validate.log:303` |
| `pnpm test` en CI | cumplido | run https://github.com/davidfdzmorilla/Agents-Lab/actions/runs/39932013572, `conclusion: success`, `headSha f5a1a27696de6ecda88c93723bbaf818f753826b`; jobs `validate-linux`, `audit`, `secrets-scan`, `test`, `typecheck`, `lint` todos `success` |

### `ROADMAP.md:10`
Literal: «Un hito se cierra cuando (a) todas sus tareas en `TASKS.md` están `DONE`, (b) su criterio de salida se ha verificado y el informe está en `docs/reports/M<n>-closure.md`, (c) el humano lo acepta.»
- (a) Tareas de M0 en `docs/TASKS.md` (f5a1a27). DONE: TASK-001, 002, 003, 003-fix-1, 004, 005, 006, 006-fix-1, 006-fix-2, 006-fix-4, 006-fix-3, 007, 008. Pendientes: `TASK-009-prep` = VERIFIED (pendiente de CI, que ya está en verde) y `TASK-009` = BLOCKED (esta verificación). (a) no se cumple todavía; se cumple cuando docs-keeper cierre esas dos.
- (b) Criterio verificado: este documento.
- (c) Aceptación del humano: aceptado el 2026-10-26.

### Entregables `ROADMAP.md:17-24` (evidencia en el clone, salvo donde se indica)
- Monorepo pnpm + Turborepo, TS estricto, ESLint + Prettier, `tsconfig.base.json`: `pnpm-workspace.yaml`, `turbo.json`, `eslint.config.js`, `tsconfig.base.json:10` (`"strict": true`); `make validate` (typecheck, lint, format:check) EXIT=0.
- `compose.yaml` con `web`, `worker`, `db`; perfil `local` con `ollama`: `compose.yaml:4` (db), `:35` (web), `:59` (worker), `:114-115` (`ollama`, `profiles: ["local"]`); contenedores en marcha según `make ps` y `m0b-make-up.log:181-195` (orden de arranque hasta ` Container agentlab-m0-worker-1 Started ` en `:195`, ver §2; observado el 2026-10-23; el log ya no existe, ver incidencia 5 de §7).
- Drizzle y migración inicial con todas las tablas de §6: `packages/persistence/migrations/0000_init.sql` (8 `CREATE TABLE`); `m0b-make-logs.log:47` «migrations applied». Contraste con §6 en la tabla siguiente.
- `core`: esquemas, errores y `env.ts`: `packages/core/src/` (`agent-definition.ts`, `team-definition.ts`, `run-request.ts`, `run-event.ts`, `budget.ts`, `errors.ts`, `env.ts`); sus tests pasan en `make test`.
- `GET /api/health` comprobando PostgreSQL: `apps/web/src/app/api/health/route.ts`; `apps/web/src/server/health.ts:18`; el `curl` devuelve `db:"up"`.
- CI (OD-004) con `lint`, `typecheck`, `test` contra PostgreSQL de servicio: `.github/workflows/ci.yml:26` (lint), `:53` (typecheck), `:77` (test); run 39932013572 en success.
- `.env.example`, `README.md` con instalación desde cero: ficheros presentes en el clone y recorrido el camino principal del README.
- `.githooks` instalados: evidencia sin clone, en el árbol de trabajo.
  - `git config --get core.hooksPath` → `.githooks`. **Ejecutado por el humano** (el comando del tester lo bloqueó bash-guard: «BLOCKED by bash-guard: no se cambia la configuración de git desde Claude Code»).
  - `make verify-hooks > <S>m0-verify-hooks.log 2>&1` → EXIT=0 (observado). Log de 26 líneas; las cinco últimas:
    ```
      OK   bloquea commit con atribución
      OK   no confunde >= en un mensaje con una redirección
      OK   bloquea cat .env
      OK   permite pnpm -r test
    verify-hooks: todas las barreras funcionan
    ```
    (los códigos de color ANSI se omiten aquí). `.claude/task-scope.json` ya figuraba modificado en `git status` antes del script (el Orchestrator lo cambia para cada tarea), así que que figure modificado después no indica nada sobre el script. El script lo copia en `scripts/verify-hooks.sh:20` y lo restaura en `:48`. El Orchestrator comprobó que el fichero quedó igual tras `verify-hooks` (registro de `docs/TASKS.md:711` en el commit de cierre, fila del 2026-10-23 «TASK-009, ciclo 1 (tester)»).
  - Rechazo real de `commit-msg` en el primer EXECUTE de f5a1a27, `docs/TASKS.md:694` en el commit de cierre: «2026-10-23 | TASK-009-prep, commit: primer EXECUTE rechazado por el hook `commit-msg`, cuyo patrón no aceptaba el sufijo `-prep` («commit-msg: falta el trailer 'Task: TASK-NNN' …»). El humano editó `.githooks/commit-msg:19` (`(-fix-[0-9]+|-prep)?`) y decidió que entrara en el mismo commit […]».
  - Con las tres piezas, el hook está instalado y rechaza de verdad, no solo existen los ficheros. `make setup` no se ejecutó (requiere Node/host).
- Versiones fijadas (TASK-002): `pnpm-lock.yaml` presente; `make validate` instala offline con el lockfile (README:71).
- Paquetes de M0 (`apps/web`, `apps/worker`): en marcha según `make ps` y `m0b-make-logs.log:56-57` y `:67`.

### Contraste de `0000_init.sql` con `ARCHITECTURE.md §6` (verificado por el reviewer)

| §6 | CREATE TABLE | id | created_at | updated_at | Columnas clave |
|---|---|---|---|---|---|
| projects :201 | :41 | :42 | :43 | :44 | completas |
| provider_configs :202 | :49 | :50 | :51 | :52 | completas; `api_key_env text` NULL y sin CHECK (:57, §6:219) |
| agent_definitions :203 | :1 | :2 | :3 | :4 | las 13; CHECK de role (:18) |
| team_definitions :204 | :108 | :109 | :110 | :111 | completas; sin `coordination` (§6:218) |
| runs :205 | :73 | :74 | :75 | :76 | las 13; CHECK de status (:90); índice (:132) |
| tasks :206 | :93 | :94 | :95 | :96 | completas; `status` sin CHECK (§6:215) |
| agent_invocations :207 | :21 | :22 | :23 | :24 | las 14; tokens y coste NULL |
| run_events :209 | :60 | :61 | :62 | :63 | `ts` DEFAULT now() NOT NULL (:68); `unique(run_id,seq)` (:69) |

No falta ni sobra ninguna tabla. `ARCHITECTURE.md:213` y `:218` reducen «todas las tablas de §6» a 8 en `0000_init`: `:213` «La migración `0000_init` (TASK-005, OD-021, OD-028) crea **8 tablas** —`projects`, `provider_configs`, `agent_definitions`, `team_definitions`, `runs`, `tasks`, `agent_invocations`, `run_events`—»; `:218` deja fuera `team_definitions.coordination` y las tablas `tool_invocations`, `run_checkpoints` y `evaluations`. `updated_at` sale de `packages/persistence/src/schema/columns.ts:16` (``.$onUpdate(() => sql`now()`)``), y `started_at`/`finished_at`/`worker_heartbeat_at` de `packages/persistence/src/repositories/runs.ts:62-63`, `:92`, `:103` y `:125`.

Comprobado también por el tester en el árbol de trabajo (misma `0000_init.sql`; el clone del commit verificado ya no existe): las posiciones de `CREATE TABLE`, `id`, `created_at` y `updated_at` de las 8 filas (`:1-4`, `:21-24`, `:41-44`, `:49-52`, `:60-63`, `:73-76`, `:93-96`, `:108-111`), `:18` (CHECK de role), `:57` (`"api_key_env" text`, sin NOT NULL), `:68-69`, `:90` (CHECK de status) y `:132` (`runs_status_created_at_idx`), y las citas `ARCHITECTURE.md:213` y `:218`. No comprobé columna a columna la completitud de «columnas clave». Discrepancia de ruta: el reviewer cita `columns.ts:16`; el fichero está en `packages/persistence/src/schema/columns.ts:16`. Del bloque de `packages/persistence/src/repositories/runs.ts` solo leí las cuatro líneas coincidentes (`:62-63` `workerHeartbeatAt`/`startedAt`, `:92` `finishedAt`, `:103` y `:125`), sin ver el contexto que las atribuye a cada columna.

## 7. Incidencias durante la verificación y la revisión

1. **bash-guard, falso positivo con comillas escapadas.** Durante la revisión, bash-guard bloqueó un `grep` de solo lectura del Orchestrator sobre `scripts/verify-hooks.sh` con el mensaje «BLOCKED by bash-guard: escritura por shell en '\' fuera del scope de la tarea. Usa Edit/Write dentro del scope o repórtalo.» Causa, según el humano: un bug del sanitizador de bash-guard con comillas escapadas dentro de una cadena doble. Lo corrigió el humano en `.claude/hooks/bash-guard.sh:35`, con un caso nuevo en `scripts/verify-hooks.sh:33`; los dos entran en el commit de TASK-009. La parada del Orchestrator fue correcta.
2. **bash-guard bloquea `git config --get core.hooksPath` (solo lectura).** Comando del tester: `git config --get core.hooksPath; echo "EXIT=$?"`. Bloqueo literal: «BLOCKED by bash-guard: no se cambia la configuración de git desde Claude Code». El tester paró y no lo rodeó; el humano ejecutó el comando desde su sesión y dio `.githooks` (§6). Es un falso positivo de naturaleza parecida a la incidencia 1 (el hook no distingue lectura de escritura en `git config`); queda a criterio del humano si se corrige.
3. **Aislamiento de Compose (H-1).** Ver §4.
4. **`make logs` no termina** (`logs -f`, según el README): hubo que cortarlo con `kill` de sus dos procesos `docker compose … logs -f`. No es desviación del README, que lo describe «en seguimiento».
5. **Logs de evidencia perdidos (scratchpad recreado).** Los logs de §8 se escribieron en el scratchpad y los leyeron completos el tester y el Orchestrator el 2026-10-23. El 2026-10-26 el scratchpad se recreó vacío al retomar la sesión: es la carpeta temporal del sistema y ningún agente borró los logs (los agentes solo borraron el clone, §5). Las citas a esos logs (`fichero:línea`) se mantienen como observadas el 2026-10-23 y hoy no se pueden volver a abrir. Decisión humana: se mantienen así, y después de M0 se decide dónde guardar la evidencia para que dure.

## 8. Logs (scratchpad `<S>`)

Ya no existen en disco desde el 2026-10-26; ver §7.

- `m0-make-up.log` (primera pasada)
- `m0b-make-up.log`, `m0b-make-logs.log`, `m0b-make-test.log`, `m0b-make-validate.log` (segunda pasada)
- `m0-verify-hooks.log` (árbol de trabajo, ciclo de corrección 1)
