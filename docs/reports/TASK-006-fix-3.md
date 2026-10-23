# TASK-006-fix-3 — Un solo reloj para `updated_at` (el de PostgreSQL)

| Campo | Valor |
|---|---|
| Tarea | TASK-006-fix-3 |
| Hito | M0 (sobre TASK-006-fix-2 y TASK-006-fix-4) |
| Owner | persistence-dev (`columns.ts` y test de integración); architect (`docs/ARCHITECTURE.md` §6) |
| Fecha | 2026-10-23 (fecha del encargo del Orchestrator, sacada de `date +%F`) |
| Estado final | **VERIFIED (pendiente de CI)**. Pasa a DONE cuando el humano traiga el run de CI en verde, como fix-4 |
| Veredictos | tester PASS (primera ronda y ciclo 1) · reviewer CHANGES_REQUESTED (primera ronda, un [MAJOR]) y APPROVED (ciclo 1) · security no aplica (decisión humana) |
| Plan | Ninguno (decisión humana) |
| Severidad | LOW |

## Resumen

- Un solo reloj para `updated_at`: `packages/persistence/src/schema/columns.ts:16` pasa de `new Date()` a `.$onUpdate(() => sql\`now()\`)`. `created_at` y `updated_at` salen del reloj de PostgreSQL.
- Test nuevo: `packages/persistence/src/schema/columns.integration.test.ts`. Cita ARCHITECTURE §6 «Común». Todo en una transacción de Drizzle: `select now()`, `pg_sleep(0.05)`, `UPDATE` sin `updatedAt` y `updated_at = now()` comprobado en SQL.
- `docs/ARCHITECTURE.md` §6 «Común» (línea 214) queda ampliada a todas las marcas temporales que genera el sistema. Las fechas externas son datos.
- Ficheros de la tarea: `packages/persistence/src/schema/columns.ts`, `packages/persistence/src/schema/columns.integration.test.ts`, `docs/ARCHITECTURE.md`.
- Sin migración: `drizzle-kit generate` no detecta cambios.

## Decisiones humanas (en orden)

Fuente: registro de cambios de `docs/TASKS.md`, filas del 2026-10-22 y 2026-10-23 de TASK-006-fix-3.

1. Sin plan (decisión humana). Orden: architect primero y después persistence-dev.
2. Redacción de §6 «Común»: la del humano, con la frase «Ningún proceso escribe su propia hora».
3. Alcance de §6: todas las marcas temporales que genera el sistema las pone PostgreSQL; las fechas que vienen de fuera (un proveedor, un dataset) son datos y se guardan tal cual.
4. Otro sitio que escriba su propia hora = hallazgo con cita y fix aparte; no se amplía el scope de esta tarea.
5. Migración comprobada con `drizzle-kit generate` en contenedor (no se infiere).
6. `events.ts:37` no se toca (`new Date()` solo como relleno de validación).
7. Para el test: opción A del reviewer (una transacción, `pg_sleep`, igualdad exacta en SQL).
8. En el ciclo 1, tester y reviewer solo sobre el test.
9. Excepción en la regla 4 de testing-conventions (`pg_sleep` acotado) y regla nueva 13 (un test de un fix falla sin el fix). Ver punto «Cambios en testing-conventions» abajo.
10. El `select now()` sin usar (`columns.integration.test.ts:40`) se queda.

## Informes archivados

Copia literal de los ocho informes de la tarea, en orden. Extraídos por el Orchestrator de los mensajes de cada subagente. No se han resumido ni parafraseado.

### Informe 1 — IMPLEMENTATION (architect, paso 1: §6 con la redacción del humano)

````
## IMPLEMENTATION — TASK-006-fix-3 (paso architect)
Fecha: 2026-10-22
Hecho: he cambiado una sola cláusula en la viñeta «Común» de §6 de `docs/ARCHITECTURE.md`. El texto es el del humano, con backticks en los identificadores y sin otros cambios de redacción. El resto de la viñeta queda igual y no he añadido ninguna línea aparte. No hace falta ADR: aclara una regla que ya existía y la decisión es del humano.
Ficheros: creados ninguno · modificados /Users/davidferanandezmorilla/Desktop/development.nosync/agentlab/docs/ARCHITECTURE.md (solo la línea 214)

Antes (docs/ARCHITECTURE.md:214):
"- **Común:** `id uuid PK DEFAULT gen_random_uuid()`, `created_at`/`updated_at timestamptz NOT NULL DEFAULT now()`; `updated_at` lo fija el repositorio en cada `UPDATE` (sin triggers). Nombres de columna explícitos en snake_case. FK físicas en los `*_id` escalares (ninguna en arrays). `jsonb` tipado con los tipos de `core`."

Después (docs/ARCHITECTURE.md:214, leída de disco tras el cambio):
"- **Común:** `id uuid PK DEFAULT gen_random_uuid()`, `created_at`/`updated_at timestamptz NOT NULL DEFAULT now()`; `created_at` y `updated_at` los fija PostgreSQL (`defaultNow()` y `now()` en cada `UPDATE`, inyectado por el repositorio vía `$onUpdate`), sin triggers. Ningún proceso escribe su propia hora. Nombres de columna explícitos en snake_case. FK físicas en los `*_id` escalares (ninguna en arrays). `jsonb` tipado con los tipos de `core`."

Contradicciones encontradas: ninguna. He buscado `updated_at`, `created_at`, `_at`, `ts`, `now()`, `new Date`, `trigger`, `hora`, `fecha` y `timestamp` en `docs/ARCHITECTURE.md` y en `docs/TECHNICAL_SPEC.md` (este último solo lo he leído).
- ARCHITECTURE.md:193 solo declara las columnas `created_at timestamptz` y `updated_at timestamptz`, sin decir quién las fija. Es compatible con la regla.
- ARCHITECTURE.md:145-155: el SQL de `EventsRepository.append` no escribe `ts` desde el proceso. Es compatible.
- TECHNICAL_SPEC.md: no dice en ningún sitio que el cliente o el proceso fije una hora.

Cómo probarlo: `sed -n '214p' docs/ARCHITECTURE.md`
Comandos ejecutados y resultado: `date +%F` → 2026-10-22; `grep` sobre los dos docs, sin contradicciones; `sed -n '214p'` confirma la línea nueva.
Desviaciones del plan: ninguna (la tarea no tiene plan, por decisión humana).
Fuera de scope detectado: ninguno.
Dependencias que harían falta: ninguna.
OPEN DECISIONS: ninguna. Hay una ambigüedad que no he resuelto: la frase «Ningún proceso escribe su propia hora» está en la viñeta de columnas comunes, pero se puede leer como si valiera para todas las columnas de fecha. Hay otras que ARCHITECTURE no dice quién fija: `runs.worker_heartbeat_at`, `runs.started_at` y `runs.finished_at` (fila de `runs` en la tabla, ARCHITECTURE.md:205). Hoy no contradicen nada porque nadie las escribe todavía, pero conviene que el humano aclare si la regla también las cubre antes de que el worker las escriba (TASK-015 o la tarea del worker que toque).
Deuda propuesta: ninguna.
Dudas: ninguna.
````

### Informe 2 — IMPLEMENTATION (persistence-dev, primera entrega)

````
## IMPLEMENTATION — TASK-006-fix-3
Fecha: 2026-10-22
Hecho: `updatedAtColumn` ahora usa `$onUpdate(() => sql`now()`)`, así que `created_at` y `updated_at` salen del reloj de PostgreSQL. Afecta a las 8 tablas que usan la columna. Drizzle 0.45.4 acepta un SQL desde `$onUpdate`: typecheck pasa en `make validate`. Añadido un test de integración.
Ficheros: creados packages/persistence/src/schema/columns.integration.test.ts · modificados packages/persistence/src/schema/columns.ts
Diff (columns.ts:16): `-    .$onUpdate(() => new Date());` / `+    .$onUpdate(() => sql`now()`);`. `sql` ya estaba importado en la línea 1.

Test (columns.integration.test.ts):
- El comentario cita ARCHITECTURE §6 «Común» literalmente.
- El test inserta un project y retrodata `updated_at` un minuto por SQL.
- Lee `before = select now()`, ejecuta `db.update(projects).set({ name })` sin `updatedAt` y lee `after = select now()`.
- Afirma `updated_at > backdated` (estricto), `>= before` y `<= after` (inclusivos).
- NO hay transacción: cada sentencia hace autocommit en el pool (`max: 2`), así que son transacciones separadas. Las cotas son inclusivas de todos modos.
- No hay `Date.now()` ni `new Date()` como referencia. El único `new Date(value)` convierte el resultado de `select now()` en `dbNow()`.
- El test no contiene `as never` ni otros casts: el fixture usa `TEST_BUDGET`.

Comandos ejecutados y resultado:
- `make validate`: OK (typecheck, lint y tests de core, format:check "All matched files use Prettier code style!").
- `make test`: `@agentlab/persistence:test: ✓ src/schema/columns.integration.test.ts (1 test) 83ms` · Test Files 9 passed (9) · Tests 107 passed (107). core: 171 passed; web: 6 passed; worker: 44 passed.
- Los tests de runs.integration.test.ts (fixture de fix-1, incluido el de failOrphaned) siguen en verde. Ese fichero no se ha tocado.

Migración: no se ha ejecutado `drizzle-kit generate`. El cambio es solo de aplicación (`$onUpdate` no entra en el DDL), así que no debería generar migración. Es una inferencia, no una comprobación.
Desviaciones del plan: ninguna
Fuera de scope detectado: ninguno. events.ts:37 sin tocar.
Dependencias que harían falta: ninguna
OPEN DECISIONS: ninguna
Deuda propuesta: ninguna
Hallazgos resueltos:
- [x] DoD1 — packages/persistence/src/schema/columns.ts:16 — "    .$onUpdate(() => sql`now()`);"
Dudas: ninguna
Bloqueos: ninguno
````

### Informe 3 — IMPLEMENTATION (architect, paso 2: ampliación de §6 al alcance decidido)

````
## IMPLEMENTATION — TASK-006-fix-3
Fecha: 2026-10-22
Hecho: He ampliado la frase «Ningún proceso escribe su propia hora» dentro de la viñeta «Común» de §6, sin crear una viñeta nueva. Ahora fija el alcance que decidió el humano: todas las marcas temporales que genera el sistema las pone PostgreSQL, y las fechas que vienen de fuera son datos y se guardan tal cual. Sigue siendo una sola regla.
Ficheros: creados ninguno · modificados /Users/davidferanandezmorilla/Desktop/development.nosync/agentlab/docs/ARCHITECTURE.md (línea 214)
Cómo probarlo: `sed -n '214p' docs/ARCHITECTURE.md`

Antes (docs/ARCHITECTURE.md:214, fragmento cambiado):
"… sin triggers. Ningún proceso escribe su propia hora. Nombres de columna explícitos en snake_case. …"

Después (docs/ARCHITECTURE.md:214, línea literal leída en disco tras el cambio):
"- **Común:** `id uuid PK DEFAULT gen_random_uuid()`, `created_at`/`updated_at timestamptz NOT NULL DEFAULT now()`; `created_at` y `updated_at` los fija PostgreSQL (`defaultNow()` y `now()` en cada `UPDATE`, inyectado por el repositorio vía `$onUpdate`), sin triggers. Ningún proceso escribe su propia hora: todas las marcas temporales que genera el sistema (`created_at`, `updated_at`, `run_events.ts`, `runs.started_at`/`finished_at`/`worker_heartbeat_at`) las pone PostgreSQL; las fechas que vienen de fuera (un proveedor, un dataset) son datos y se guardan tal cual. Nombres de columna explícitos en snake_case. FK físicas en los `*_id` escalares (ninguna en arrays). `jsonb` tipado con los tipos de `core`."

Comandos ejecutados y resultado: `date +%F` → 2026-10-22. Revisé `packages/persistence/src/repositories/runs.ts` con grep: `now()` aparece en `workerHeartbeatAt`, en `startedAt` (`coalesce(..., now())`), en `finishedAt` (dos sitios) y en `updatedAt`. Confirma la corrección.
Desviaciones del plan: ninguna
Fuera de scope detectado: ninguno
Dependencias que harían falta: ninguna
OPEN DECISIONS: ninguna
Deuda propuesta: ninguna
Hallazgos resueltos: [x] alcance de la regla de hora (fix-3) — docs/ARCHITECTURE.md:214 — "Ningún proceso escribe su propia hora: todas las marcas temporales que genera el sistema (`created_at`, `updated_at`, `run_events.ts`, `runs.started_at`/`finished_at`/`worker_heartbeat_at`) las pone PostgreSQL; las fechas que vienen de fuera (un proveedor, un dataset) son datos y se guardan tal cual."
Corrección de mi informe anterior: dije que nadie escribía todavía `runs.worker_heartbeat_at`, `started_at` ni `finished_at`. Era falso y lo afirmé sin mirar el código: `packages/persistence/src/repositories/runs.ts` ya los escribe todos con `now()` de la base de datos. No volveré a afirmar hechos del código sin comprobarlos.
Dudas: ninguna
````

### Informe 4 — TEST (tester, primera verificación)

````
## TEST — TASK-006-fix-3
Fecha: 2026-10-22
Comandos:
- `git diff -- packages/persistence/src/schema/columns.ts` y lectura de `columns.integration.test.ts`.
- `make test; echo "EXIT=$?"`: EXIT=0.
- `make -n test`, y luego su pipeline de contenedor con `pnpm test` sustituido por `pnpm --filter @agentlab/persistence db:generate`. El contenedor no encontró `git`, así que el exit 127 del final no cuenta (ver abajo).
- No ejecuté `make validate` (opcional). No hubo bloqueos de hooks ni se usó Node en el host.

Resumen de `make test` (turbo: 4 tareas correctas, 0 en caché):
- core: 7 ficheros, 171 tests, todos OK.
- persistence: 9 ficheros, 107 tests, todos OK. Incluye `src/schema/columns.integration.test.ts` (1 test). `runs.integration.test.ts` tiene 69 tests y también pasa.
- worker: 3 ficheros, 44 tests, todos OK.
- web: 2 ficheros, 6 tests, todos OK.

Salida literal de `drizzle-kit generate` (en contenedor):
```
> @agentlab/persistence@0.0.0 db:generate /work/packages/persistence
> drizzle-kit generate
Reading config file '/work/packages/persistence/drizzle.config.ts'
8 tables
agent_definitions 16 columns 1 indexes 2 fks
...
No schema changes, nothing to migrate 😴
```
El `EXIT=127` final viene de mi sufijo `git status`, que se ejecutó en el contenedor sin `git`. Es un error mío, posterior a la generación, y no afecta al resultado. El repo se copia al contenedor por tar, así que no se generó ni se tocó ningún fichero en el host.

DoD:
| # | Viñeta | Resultado | Evidencia |
|---|---|---|---|
| 1 | `updatedAtColumn` usa `$onUpdate(() => sql\`now()\`)` | ✅ | `columns.ts:16`: `.$onUpdate(() => sql\`now()\`);` (el diff cambia solo esa línea). |
| 2 | Test de integración que cita «Común» §6, compara con el reloj de la BD y mantiene el fixture de fix-1 | ✅ | Ver el detalle debajo la tabla. |
| 3 | ARCHITECTURE §6 | n/a | Lo revisa el reviewer. |
| 4 | `events.ts:37` sin tocar | ⚠️ | No hay git diff de `events.ts` (el repo no es git, así que no pude comprobarlo con `git diff`). El diff de `columns.ts` no lo menciona. El reviewer debería confirmarlo. |
| 5 | Migración comprobada con drizzle-kit | ✅ | "No schema changes, nothing to migrate". No se generó ningún fichero. |
| 6 | `make test` y `make validate` en verde; CI en verde tras el push | ⚠️ | `make test` está en verde (EXIT=0, resumen arriba). `make validate` no lo ejecuté. CI queda PENDING hasta el push. |

Detalle del punto 2:
- Cita: `columns.integration.test.ts:29-31` cita ARCHITECTURE §6 «Común» en un comentario.
- Referencia de tiempo: usa `dbNow()`, que ejecuta `select now()`, antes y después del UPDATE. No usa `Date.now()`. El único `new Date(value)` convierte el resultado de `select now()`.
- Cotas: `toBeGreaterThanOrEqual(before)` y `toBeLessThanOrEqual(after)` son inclusivas (líneas 55-56). El backdate es estricto: `toBeGreaterThan(stale.updatedAt)` en la línea 54.
- Fixture de fix-1: el `UPDATE` de las líneas 41-43 retrasa `updated_at` un minuto con `now() - interval '1 minute'`.
- Con el código antiguo: con `new Date()` el valor sale del reloj del proceso Node, no del de PostgreSQL. En el contenedor los relojes del proceso Node y de la BD se parecen, así que `before <= updated_at <= after` pasaría casi siempre. Por eso el test no detecta de forma determinista el reloj usado, solo la regresión grosa (el backdate estricto y las cotas). Es una limitación del enfoque, no un fallo. No ejecuté el test contra el código antiguo, porque no puedo modificar código.

Cobertura: n/a (el DoD no fija objetivo). `columns.ts` está al 100 %.
Tests añadidos: ninguno (por mi parte). Problemas en tests existentes: ninguno.

Veredicto: PASS para los puntos verificables (1, 2, 5 y `make test`). Quedan PENDING el CI del punto 6, `make validate` (no ejecutado) y la comprobación del punto 4 por el reviewer. No hay FAIL.
````

### Informe 5 — REVIEW (reviewer, primera revisión)

````
## REVIEW — TASK-006-fix-3
Fecha: 2026-10-22

Hallazgos:
  - [MAJOR] packages/persistence/src/schema/columns.integration.test.ts:47-56: el test no distingue qué reloj se usó. La limitación del tester es real, y más fuerte de lo que dijo. Con el `.$onUpdate(() => new Date())` antiguo, `updated_at` = hora de Node en T1, entre `before` (T0 de la BD) y `after` (T2 de la BD). En compose y en CI, Node y PostgreSQL leen el mismo reloj del kernel (en macOS, el de la VM de Docker Desktop). El truncado a ms (`floor(T0) ≤ floor(T1) ≤ floor(T2)`) no rompe el orden. Así que el test pasa **siempre** con `new Date()`. Solo falla si quitan `$onUpdate` (el backdate estricto de :54) o si hay un desfase de reloj mayor que la ventana. La viñeta 2 del DoD dice que el test «lo cubre» (la viñeta 1, el reloj de la BD) y que «demuestra la regla». Ninguna de las dos cosas se cumple aunque la forma literal (antes/después, entre los dos) sí. Lo que sí consigue: no depender del reloj del proceso, así que no es flaky. Opciones (decide el humano):
    - **A (recomendada, determinista, mantiene «antes y después»):** dentro de `db.transaction(async (tx) => …)` hacer `before = select now()`, `select pg_sleep(0.05)`, `tx.update(projects).set({ name })` y `after = select now()`. Dentro de una transacción `now()` está congelado, así que `before = after` y «entre los dos» queda reducido a igualdad. La comprobación se hace en SQL para no perder los µs: `select updated_at = now() as same from projects where id = …`, y `same` debe ser true. Con `new Date()` falla de forma determinista: la hora del proceso es T0+≥50 ms y además solo tiene precisión de ms. El backdate de fix-1 puede ir antes de la transacción, y `truncateAll` limpia igual. Lo comprobé en un Postgres 16 desechable: tras `pg_sleep(0.05)`, `updated_at = now()` → `true`, y con un reloj de pared (`clock_timestamp()`) → `false`. Drizzle 0.45.4 aplica `onUpdateFn` en el dialecto (`buildUpdateSet`), que comparten `db` y `tx`, así que `$onUpdate` funciona igual dentro de `db.transaction`. Esto último lo saco del código de drizzle 0.45 que conozco; no pude leer node_modules en el host, porque las dependencias solo están en el store del contenedor. Que el test actual pase con `sql\`now()\`` (:54 estricto) confirma que se inyecta SQL y no un parámetro.
    - **B:** una sola sentencia `update … returning({ same: sql\`${projects.updatedAt} = now()\` })`. Es casi determinista: con `new Date()` solo daría true por coincidencia de ms y µs=000. Pierde la forma antes/después.
    - **C:** dejarlo como está (forma literal del humano) y registrar deuda LOW. Si el humano elige C, este hallazgo deja de ser MAJOR y el veredicto pasa a APPROVED sin más cambios.

Viñetas comprobadas (sin hallazgo):
  - DoD 1, packages/persistence/src/schema/columns.ts:16: "    .$onUpdate(() => sql`now()`);".
  - DoD 3, docs/ARCHITECTURE.md:214: es fiel al texto del humano y a la ampliación, y sigue siendo una sola regla dentro de la viñeta «Común». Añade `worker_heartbeat_at`, que no está en la lista del humano («inicio y fin de runs»). Lo cubre «todas las marcas temporales que genera el sistema» y coincide con runs.ts:62 y :103, así que no pido cambio; lo dejo dicho para que el humano lo sepa.
  - DoD 4: `git diff --stat` de events.ts sale vacío (0 líneas).
  - DoD 5: `$onUpdate` es solo de runtime y no genera DDL. migrations/ está sin cambios en git, y 0000_init.sql ya tiene `"updated_at" … DEFAULT now() NOT NULL` en las 8 tablas. Concuerda con el `drizzle-kit generate` del tester («No schema changes»).
  - Observación sin hallazgo: los `updatedAt: sql\`now()\`` explícitos de runs.ts:64/91/103/126 ya sobran con `$onUpdate`, pero no hacen daño. Fuera de scope.

Búsqueda de hora propia (regla del humano). Busqué `new Date(`, `Date.now(`, `toISOString(`, `\bDate\b`, `$default`, `$onUpdate`, `defaultNow`, `performance.now` y `hrtime` en packages/** y apps/**, sin tests ni node_modules:
  - packages/persistence/src/repositories/events.ts:37: el placeholder de validación que ya conocíamos; el `ts` guardado viene de run-events.ts:32 `defaultNow()`. No es hallazgo.
  - packages/persistence/src/repositories/events.ts:25: `row.ts.toISOString()` solo serializa un valor que viene de la BD. No es hallazgo.
  - apps/worker/src/testing/gated-main.ts:35-36: `Date.now()` en una espera activa de un helper de test; no se guarda. No es hallazgo.
  - runs.ts:62-64/91-92/103/125-126/132 y testing/fixtures.ts:74-78 usan `sql\`now()\``. No es hallazgo.
  - Ninguna entrada de repositorio permite meter marcas temporales: `CreateRunInput`, el `create` de projects y `CreateProviderConfigInput` no las tienen, y agent-definitions.ts:10-13 omite `createdAt`/`updatedAt`.
  - **Resultado: ningún hallazgo nuevo.**

Cumplimiento: SPEC ✅ · ARCHITECTURE ✅ · ADRs ✅ · DoD ❌ (viñeta 2, por el MAJOR) · plan n/a (sin plan, por decisión del humano)
DoD 6: `make test` en verde según el tester. `make validate` solo lo ha ejecutado el owner (el tester no) y la CI está pendiente del push. El Orchestrator debe conseguir evidencia de `make validate`; yo no lo ejecuté porque necesita `.env`.
Sobrearquitectura detectada: ninguna
Deuda propuesta: solo si el humano elige C: TD-? «columns.integration.test.ts no distingue el reloj de la BD del del proceso cuando ambos comparten kernel», LOW, a pagar en persistence (columns.integration.test.ts) con la forma A.
Requiere security: no (persistence/schema y docs; el humano decidió que no aplica)
Veredicto: CHANGES_REQUESTED (pasa a APPROVED si el humano elige la opción C)
````

### Informe 6 — IMPLEMENTATION (persistence-dev, ciclo de corrección 1)

````
## IMPLEMENTATION — TASK-006-fix-3 (ciclo 1/3)
Fecha: 2026-10-23
Hecho: el test `columns.integration.test.ts` ahora distingue qué reloj pone `updated_at`. El insert y el atraso de 1 minuto quedan antes de la transacción. Dentro de un único `db.transaction`, todo sobre `tx`, se ejecutan `select now()`, `select pg_sleep(0.05)`, `tx.update(projects).set({ name: "clock-2" })` sin `updatedAt`, y `select updated_at = now() as same from projects where id = …`. Se espera `same === true` (igualdad exacta en SQL, sin tolerancias) y se mantiene `updatedAt > stale`. Eliminado el helper `dbNow` (ya sin uso); no hay `Date.now()` ni `new Date()`. Comentario de ARCHITECTURE §6 «Común» conservado; el comentario falso sobre autocommit se sustituyó por una explicación en inglés de la transacción y `pg_sleep`.
Ficheros: modificados `packages/persistence/src/schema/columns.integration.test.ts`. `columns.ts` solo cambió temporalmente y quedó restaurado.

Diff del test (resumen):
- eliminado `async function dbNow()` y el bloque `before`/`after` con sus tres aserciones de rango.
- comentario nuevo: "now() is transaction_timestamp(): inside one transaction it is frozen, so after pg_sleep the process clock is >= 50 ms ahead and only the DB clock can make updated_at = now() hold exactly."
- añadido:
```
const { same, updatedAt } = await db.transaction(async (tx) => {
  await tx.execute(sql`select now() as now`);
  await tx.execute(sql`select pg_sleep(0.05)`);
  await tx.update(projects).set({ name: "clock-2" }).where(eq(projects.id, id));
  const check = await tx.execute<{ same: boolean }>(
    sql`select updated_at = now() as same from projects where id = ${id}::uuid`);
  const [row] = await tx.select().from(projects).where(eq(projects.id, id));
  return { same: check.rows[0]?.same, updatedAt: row?.updatedAt };
});
expect(same).toBe(true);
expect(updatedAt?.getTime()).toBeGreaterThan(stale?.updatedAt.getTime() ?? 0);
```

Fallo con `new Date()` (columns.ts:16 cambiado temporalmente a `.$onUpdate(() => new Date())`, `make test` EXIT 2):
```
FAIL src/schema/columns.integration.test.ts > refreshes updated_at with the database clock when an update sets no updatedAt
AssertionError: expected false to be true // Object.is equality
- Expected: true
+ Received: false
❯ src/schema/columns.integration.test.ts:53:16   expect(same).toBe(true);
persistence: Tests 1 failed | 106 passed (107)
```
Por qué falla: `updated_at` recibe la hora del proceso, que va al menos 50 ms por delante de `transaction_timestamp()` (`now()` queda congelado al inicio de la transacción, antes de `pg_sleep`). Por eso `updated_at = now()` da false. Con `sql\`now()\`` el UPDATE usa el mismo `now()` y la igualdad es exacta.

Restauración y verificación:
- `make test` tras restaurar, EXIT 0: core 7 ficheros/171 tests; persistence 9 ficheros/107 tests; worker 3/44; web 2/6; todo pasa.
- `make validate`: EXIT 0 (prettier "All matched files use Prettier code style!").
- `columns.ts` líneas 12-16 tras restaurar, idénticas a antes:
```
export const updatedAtColumn = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => sql`now()`);
```
Hallazgo [MAJOR] resuelto: [x] columns.integration.test.ts:53 — "  expect(same).toBe(true);"
Desviaciones del plan: ninguna
Fuera de scope detectado: ninguno
Dependencias que harían falta: ninguna
OPEN DECISIONS: ninguna
Deuda propuesta: ninguna
Comandos bloqueados: ninguno
Dudas: ninguna
````

### Informe 7 — TEST (tester, ciclo de corrección 1)

````
## TEST — TASK-006-fix-3 (ciclo de corrección 1)
Fecha: 2026-10-23
Comandos:
- `make test`: EXIT=0. core 7 ficheros/171 tests; persistence 9/107; worker 3/44; web 2/6. Turbo: 4 tareas correctas.
- `make validate`: EXIT=0. Prettier: "All matched files use Prettier code style!".
- No ejecuté Node, pnpm ni npx en el host. No toqué ningún fichero.

DoD (ciclo 1):
| # | Elemento | Resultado | Evidencia |
|---|---|---|---|
| 1 | Una sola transacción | ✅ | columns.integration.test.ts:39 `db.transaction(async (tx) => {` (cierra en :51) |
| 2 | Todas las sentencias sobre `tx` | ✅ | :40, :41, :42, :46 y :49 usan `tx`. Dentro no hay ningún `db.` |
| 3 | `select now()` | ✅ | :40 `await tx.execute(sql\`select now() as now\`);` |
| 4 | `pg_sleep(0.05)` | ✅ | :41 `await tx.execute(sql\`select pg_sleep(0.05)\`);` |
| 5 | UPDATE sin `updatedAt` | ✅ | :42-45 `.set({ name: "clock-2" })` |
| 6 | Igualdad exacta en SQL, dentro de la misma transacción, sin tolerancias | ✅ | :46-48 `select updated_at = now() as same ...`, aserción en :53 `expect(same).toBe(true);` |
| 7 | `updatedAt > stale` | ✅ | :54 `expect(updatedAt?.getTime()).toBeGreaterThan(stale?.updatedAt.getTime() ?? 0);` |
| 8 | Cita de ARCHITECTURE §6 «Común» | ✅ | :20-22 |
| 9 | Sin `Date.now()` ni `new Date()` en el test | ✅ | Los he buscado leyendo el fichero entero (55 líneas) y no aparece ninguno |
| 10 | Fixture de fix-1 que atrasa `updated_at` un minuto | ✅ | :33-35 `set updated_at = now() - interval '1 minute'` |
| 11 | `make test` y `make validate` en verde | ✅ | Los dos con EXIT=0 |
| 12 | El IMPLEMENTATION explica cómo falla el test con `new Date()` | ✅ | Informe de persistence-dev, y el análisis de abajo lo respalda |

Esquema: `columns.ts:16` es `.$onUpdate(() => sql\`now()\`);` y no hay más cambios en lo que leí, así que no hace falta repetir `drizzle-kit generate`.

Fallo sin el fix (análisis estático, sin ejecutar):
- `:53` es la aserción que daría false con `new Date()`.
- Con `new Date()`, Drizzle manda como parámetro la hora de Node en el momento del UPDATE (:42).
- `now()` en PostgreSQL es `transaction_timestamp()`, y ya está fijado en el `BEGIN` implícito de :39. Por eso el UPDATE queda al menos 50 ms después, por el `pg_sleep` de :41.
- Entonces `updated_at` (hora de Node) es mayor que `now()` (inicio de la transacción), y `updated_at = now()` da false en :46-48.
- Con `sql\`now()\`` el UPDATE evalúa el mismo `now()` congelado, así que la igualdad es exacta y da true.
- La comparación se hace en SQL y en microsegundos de PostgreSQL, así que no hay redondeo a milisegundos de JS.
- No ejecuté el test con `new Date()`, porque eso exige editar `columns.ts`, que es código de producción y no es mi rol. Si el humano quiere la confirmación ejecutada, que la haga él o la delegue. El informe de persistence-dev ya cita ese fallo en `:53` y deja `columns.ts` restaurado, y el estado actual de `columns.ts:16` coincide.

Observaciones (no bloquean):
- El `select now()` de :40 no usa su resultado. Sirve solo para abrir la transacción, y como `now()` ya vale desde el `BEGIN`, el resultado no cambia.
- La regla 4 de testing-conventions prohíbe `sleep` reales. `pg_sleep(0.05)` es una espera de 50 ms en la base de datos, exigida literalmente por el DoD que decidió el humano, así que no la cuento como fallo.

Cobertura: n/a
Tests añadidos: ninguno
Problemas en tests existentes: ninguno
Hallazgos verificados: [x] MAJOR del reviewer (el test no distinguía el reloj) — columns.integration.test.ts:53 — "  expect(same).toBe(true);"; columns.ts:16 — "    .$onUpdate(() => sql`now()`);"
Veredicto: PASS
````

### Informe 8 — REVIEW (reviewer, ciclo de corrección 1)

````
## REVIEW — TASK-006-fix-3 (ciclo de corrección 1)
Fecha: 2026-10-23
Alcance: solo `packages/persistence/src/schema/columns.integration.test.ts` y `columns.ts:16`, como pidió el humano. Solo he leído y citado: no he levantado contenedores ni ejecutado tests, Node, pnpm ni npx. Comandos usados: `date +%F`, `git status --short`, `git diff` y `grep`.

1. El [MAJOR] anterior está resuelto.
   - `columns.ts:16` sigue siendo `    .$onUpdate(() => sql\`now()\`);`. `git diff` de `columns.ts` muestra un único cambio, `new Date()` → `sql\`now()\``.
   - El test ya distingue qué reloj pone `updated_at`. Con `sql\`now()\``, el `UPDATE` de :42-45 evalúa `now()` dentro de la transacción, que es `transaction_timestamp()`. Por eso :47 compara exactamente, en microsegundos y en SQL. Con `new Date()`, Drizzle manda como parámetro la hora de Node, que va al menos 50 ms por delante por el `pg_sleep` de :41, y :53 da false. El fallo que describe el IMPLEMENTATION (`expected false to be true` en :53) es lo que se deduce leyendo el código. No lo he vuelto a ejecutar.
   - Otras implementaciones que la igualdad exacta también detecta, deducido leyendo el código:
     - sin `$onUpdate`: la fila seguiría con la hora atrasada de :34, así que :53 y :54 fallarían;
     - `$onUpdate` con `clock_timestamp()` o `statement_timestamp()`: :53 fallaría, porque el `pg_sleep` las separa de `now()`.

2. El test hace lo que dice la decisión del humano. Punto por punto:
   - una sola transacción: `db.transaction` en :39-51;
   - todas las sentencias sobre `tx` (:40, :41, :42, :46, :49); dentro no hay ningún `db.`;
   - `select now()`: :40;
   - `pg_sleep(0.05)`: :41;
   - `UPDATE` sin `updatedAt`: `.set({ name: "clock-2" })`, :44;
   - igualdad en SQL dentro de la transacción y sin tolerancias: :47, `select updated_at = now() as same …`;
   - aserción: :53, `expect(same).toBe(true);`;
   - no hay `Date.now()` ni `new Date()` en las 55 líneas.
   - Las aserciones fallan bien si algo va mal: si falta la fila, `same` es `undefined` y :53 falla; si `updatedAt` es `undefined`, :54 falla.

3. Las dos observaciones del tester:
   - `select now()` sin usar (:40): **no es hallazgo** (como mucho un NIT, sin cambio pedido). No hace nada, porque `transaction_timestamp()` ya queda fijado en el `BEGIN` que abre `db.transaction` (:39), no en la primera `SELECT`. Pero la decisión del humano lo pide literalmente («SELECT now()»), así que no pido quitarlo.
   - `pg_sleep(0.05)` frente a la regla 4 (`.claude/skills/testing-conventions/SKILL.md:17`: «Sin `sleep`/timers reales: `vi.useFakeTimers()` o `AbortSignal` controlado.»): **no es hallazgo**.
     - Es una espera en el servidor, sin carrera y mandada por el humano.
     - `vi.useFakeTimers()` no puede mover el reloj de PostgreSQL, así que la alternativa que da la regla aquí no sirve.
     - El `sleep` es lo que hace fiable el test: sin él, la hora de Node (en milisegundos) podría coincidir alguna vez con `now()` (en microsegundos).
     - Choca con el texto de la regla. Propongo una OPEN DECISION (abajo) en lugar de un hallazgo. TD-027 (`docs/TECHNICAL_DEBT.md:41`) es otro caso: allí la espera es una sincronización por tiempo y tiene alternativa.

4. Otros problemas: ninguno. :32 (`project?.id ?? ""`) y :54 (`?? 0`) quedan precedidos por `toBeDefined` en :31 y :37, así que no ocultan fallos. El comentario de :23-25 es correcto.

Hallazgos:
  - ninguno BLOCKER, MAJOR ni MINOR.
Cumplimiento: SPEC ✅ · ARCHITECTURE ✅ (§6 «Común», citado en :20-22) · ADRs ✅ · DoD ✅ · plan ✅ (decisión A del humano)
Sobrearquitectura detectada: ninguna
Deuda propuesta: ninguna
OPEN DECISION propuesta (OD-?): la regla 4 de testing-conventions no prevé esperas en el servidor cuando el test necesita que avance el reloj de la base de datos.
  - Opciones:
    - (a) añadir a la regla 4 una excepción explícita: `pg_sleep` dentro de una transacción, solo en tests de reloj de la BD;
    - (b) dejarlo como excepción puntual registrada en el cierre de TASK-006.
  - Recomendación: (a).
Requiere security: no (diff de test y de una columna de esquema; no toca providers, tools, policies, API, Docker ni CI)
Hallazgos verificados:
  - [x] MAJOR (revisión anterior) — `packages/persistence/src/schema/columns.integration.test.ts:53` — "  expect(same).toBe(true);"
  - [x] `packages/persistence/src/schema/columns.ts:16` — "    .$onUpdate(() => sql`now()`);"
Veredicto: APPROVED
````

## Evidencia del humano

Literal, del humano en su terminal (`.env` local):

«make test && make validate → EXIT=0. core 171, persistence 107 (columns.integration.test.ts 1/1), worker 44, web 6; typecheck, lint y format:check limpios.»

CI: pendiente del push del humano. Ningún run citado todavía.

## Migración

Comprobada, no inferida: `drizzle-kit generate` en contenedor (informe 4) dio «No schema changes, nothing to migrate 😴». `0000_init.sql` ya tiene `"updated_at" … DEFAULT now() NOT NULL` en las 8 tablas (informe 5). No se genera migración.

## NIT (decisión humana)

- `packages/persistence/src/schema/columns.integration.test.ts:40`: el resultado de `select now()` no se usa. Sirve para abrir la transacción. Decisión humana: se queda; no abre ciclo; no es deuda.

## DoD insuficiente (decisión humana, literal)

«El PASS del tester en este test se queda como está (cumplía el DoD literal), pero conste en el informe que el DoD era insuficiente y la regla lo cubre a partir de ahora.»

El PASS de la primera ronda del tester (informe 4) cumplía el DoD literal y no detectaba que el test pasaba también con `new Date()`. La regla 13 de testing-conventions cubre esto a partir de ahora.

## Cambios en testing-conventions (decisiones humanas literales)

- Regla nueva: «un test que cubre un fix tiene que fallar sin el fix, y el informe IMPLEMENTATION dice cómo; el tester lo comprueba antes de dar PASS.» Es la regla 13, con motivo: en TASK-006-fix-3 el test pasaba también sin el fix.
- Excepción en la regla 4: «Excepción en la regla 4 de testing-conventions, acotada: pg_sleep se permite solo dentro de una transacción, en tests que verifican el reloj de la base, y con la pausa mínima que haga visible la diferencia (decenas de ms, no segundos). Fuera de eso sigue la regla.» Motivo: TASK-006-fix-3.

## Notas de incidencia

a) **architect, nota primera (decisión humana).** En el informe 1 escribió: «Hoy no contradicen nada porque nadie las escribe todavía, pero conviene que el humano aclare si la regla también las cubre antes de que el worker las escriba…». Era falso: `packages/persistence/src/repositories/runs.ts` ya escribía `worker_heartbeat_at`, `started_at` y `finished_at` con el reloj de la base (`runs.ts:62-63`, `:92`, `:103`, `:125`). Lo corrigió el Orchestrator antes de la decisión humana sobre el alcance de §6. El architect lo reconoció en el informe 3. Motivo del humano, literal: «Afirmar «nadie las escribe todavía» sin mirar runs.ts es lo mismo que cerrar un hallazgo sin cita: una afirmación sobre el código sin comprobarla. La pregunta de fondo era buena y no se le quita; lo que se califica es el dato.»

b) **reviewer, nota (decisión humana: «primera»).** En el informe 5 escribió: «Lo comprobé en un Postgres 16 desechable». Motivo del humano, literal: «Levantar un contenedor no es leer; su rol propone y cita, no prototipa. Si necesita demostrar una opción, lo dice y yo se lo encargo al tester. Lo que probó vale igual, porque el razonamiento se sostiene sin el contenedor.» El humano comprobó que el contenedor ya no está en marcha.

c) **tester.** En la primera ronda añadió un `git status` al pipeline del contenedor para `drizzle-kit generate`, y dio exit 127 porque el contenedor no tiene git. Él mismo lo reportó (informe 4). Hecho registrado; el humano no lo ha calificado.

d) **persistence-dev.** Para demostrar el fallo sin el fix, cambió temporalmente `columns.ts:16` a `new Date()` y lo restauró (informe 6). Lo autorizó el Orchestrator dentro del scope y se lo dijo al humano. `columns.ts:16` está restaurado con `sql\`now()\``.

e) **Orchestrator.** En el registro del 2026-10-22 escribió que el architect «corrigió su afirmación falsa». La corrección la hizo el Orchestrator; el architect amplió §6 después. La frase ya está corregida en `docs/TASKS.md` por decisión humana.

## Deuda registrada / OPEN DECISIONS registradas

- Deuda nueva: ninguna. Deuda pagada: ninguna. `docs/TECHNICAL_DEBT.md` no se toca.
- OPEN DECISIONS: ninguna. La OD propuesta por el reviewer (regla 4 frente a `pg_sleep`) la decidió el humano directamente, opción (a), sin `/open-decision`.
- Fuera de scope detectado y no tocado: `runs.ts:64/91/103/126` tienen `updatedAt: sql\`now()\`` explícito que ya sobra con `$onUpdate` (informe 5, sin hallazgo; no se toca).

## Estado final

**VERIFIED (pendiente de CI).** Pendiente: el run de CI en verde tras el push del humano. Cuando llegue, pasa a DONE, como en TASK-006-fix-4.

Instalación y comandos: sin cambios. README no se toca.
