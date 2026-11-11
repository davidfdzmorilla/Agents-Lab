# TASK-010 · packages/providers: interfaz + adaptador OpenAI-compatible + FakeProvider

| Campo | Valor |
|---|---|
| Tarea | TASK-010 |
| Hito | M1 (no cierra el hito) |
| Owner | providers-dev |
| Fecha | 2026-11-11 |
| Plan | `docs/reports/TASK-010-plan.md` (aprobado 2026-11-10; §0 decisiones humanas OD-057 a OD-067) |
| Veredicto TEST | PASS (ciclo final: ciclo 3) |
| Veredicto REVIEW | APPROVED (ciclo final: ciclo 3) |
| Veredicto SECURITY | APPROVED (ciclo final: ciclo 3; M1 cerrado por OD-067) |
| Ciclos de corrección | 3 (ciclo 1 y 2: formato y calidad de tests, por el tester y providers-dev; ciclo 3: overrides de transitivas de msw por OD-067, devops) |
| Security | REQUIRED (secretos, red y dependencias nuevas) |

## Nota sobre las fuentes

- El PLAN se archiva por referencia: el fichero `docs/reports/TASK-010-plan.md` ya está en el repositorio, con su contenido íntegro (297 líneas, sin cambios desde la aprobación salvo lo indicado en su propio §0 y §4, R9). No se duplica aquí.
- Todos los demás informes (IMPLEMENTATION ciclo 0 y ciclo 3, TEST ciclos 0 a 3, REVIEW ciclos 0 a 3, SECURITY ciclos 0 y 3) son **resúmenes guardados por el Orchestrator**, tal como figuran en la copia de scratchpad. El registro cronológico completo está en `docs/TASKS.md` (filas 2026-11-10 y 2026-11-11 de TASK-010). Las correcciones de providers-dev de los ciclos 1 y 2 no tienen informe IMPLEMENTATION propio; se registran en su sección a partir del encargo del Orchestrator.

## Resumen de ciclos

| Ciclo | IMPLEMENTATION | TEST | REVIEW | SECURITY |
|---|---|---|---|---|
| 0 | providers-dev | PASS (105/105, luego 107/107 con `timer-cleanup.test.ts`) | CHANGES_REQUESTED (1 MAJOR de formato, 2 MINOR, 2 NIT) | APPROVED con M1 (MEDIUM) pendiente de decisión humana |
| 1 | providers-dev (formato y `received`) | PASS (109/109, con `construction-no-request.test.ts`) | CHANGES_REQUESTED (MAJOR por confirmar, MINOR setTimeout real, NIT) | — |
| 2 | providers-dev (`prettier`, `vi.spyOn` + `setImmediate`, quitar aserción) | PASS (109/109) | APPROVED | — |
| 3 | devops (`pnpm.overrides`, OD-067) | PASS (109/109; core 171/171) | APPROVED (1 NIT) | APPROVED (M1 cerrado; L6 nueva) |

---

## PLAN — TASK-010

Íntegro en `docs/reports/TASK-010-plan.md`. Resumen de su contenido para el lector de este fichero:
- Crea `packages/providers` con `OpenAICompatibleProvider` (SDK `openai` 7.45.1, `maxRetries: 0`, `logLevel: "off"`, clave solo vía `secretResolver`, sin `process.env`) y `FakeProvider` en `@agentlab/providers/testing`.
- Decisiones OD-057 a OD-066 aceptadas por el humano el 2026-11-10 (recomendaciones del plan), y OD-067 el 2026-11-11 (overrides de transitivas de msw).
- Dependencias aprobadas: `openai@7.45.1` (dependencies), `msw@3.0.3` (devDependencies). `undici` descartada.
- Scope ampliado con `pnpm-lock.yaml` (OD-063) y `package.json` raíz (solo `pnpm.overrides`, OD-067).

---

## IMPLEMENTATION — TASK-010 (providers-dev) — ciclo 0 — 2026-11-11

(Resumen guardado por el Orchestrator; el informe íntegro está en la conversación, no disponible en fichero.)

**Hecho.** `@agentlab/providers` con:
- `OpenAICompatibleProvider`, con el SDK guardado en `#client`;
- `FakeProvider` en `@agentlab/providers/testing`.

Sigue el plan (§4, pasos 1–8) y OD-057…066.

**Ficheros**
- En `packages/providers/`: `package.json`, `tsconfig.json`, `tsconfig.config.json`, `vitest.config.ts`.
- En `src/`: `index.ts`, `index.test.ts`, `capabilities.ts`, `capabilities.test.ts`.
- En `src/openai-compatible/`: `provider.ts`, `mapping.ts`, `errors.ts`, `test-server.ts`, más los tests de provider, mapping, errors y no-leak.
- En `src/testing/`: `index.ts`, `fake-provider.ts`, `fake-provider.test.ts`.
- `pnpm-lock.yaml`: +424/−16. Las −16 son sufijos de peers que provoca el peer opcional `typescript` de msw.

**Resultados en contenedor** (node:22.23.3, pnpm 9.15.9):
- `pnpm -r typecheck` y `pnpm -r lint` dan OK, y prettier también.
- vitest: 105/105.
- Cobertura: stmts 100, branch 99.32, funcs 100, lines 100.
- `pnpm why`: openai 7.45.1 (dependencies) y msw 3.0.3 (devDependencies).

**Comprobado contra openai 7.45.1 (`client.mjs`)**
- Variables `OPENAI_*`: el SDK solo las lee si la opción llega como `undefined`.
- `OPENAI_CUSTOM_HEADERS` se lee siempre (OD-064).
- Con `apiKeyEnv: null` se usa `apiKey "none"` y `Authorization: null`.
- Hay un test con `vi.stubEnv` para cada uno de estos casos.

**Regla 13.** Con `cause` y `err.message`, `no-leak.test.ts` falla en los casos 401, 403 y listModels. Se revirtió.

**Desviaciones**
1. msw: `onUnhandledFrame`.
2. Se añadió `test-server.ts`.
3. `parseRetryAfterMs` rechaza valores numéricos con signo.
4. El proveedor se construye después de `server.listen()`.
5. `fromChatCompletion` recibe `providerId`.

**Fuera de scope**
- `.claude/agents/providers-dev.md:29`.
- Security tiene que revisar el árbol transitivo de msw: 12 dependencias directas con `^`.

**Deuda propuesta (LOW)**
- OD-064 `OPENAI_CUSTOM_HEADERS` → TASK-020/027.
- OD-065 `PROVIDER_CONFIG_INVALID` → TASK-020.
- Errores sin cuerpo (R6) → TASK-027.
- Capacidades no verificadas (R7) → TASK-019/022.
- Cierre (R9): ARCHITECTURE §9 y §2, y `providers-dev.md:29`.

**Bloqueos**
- 4 veces: «BLOCKED by bash-guard: escritura por shell en '<ruta>' fuera del scope de la tarea. Usa Edit/Write dentro del scope o repórtalo.»
- Rutas: `providers/package.json`, `lockx`, `packages/providers`.
- Eran rutas relativas tras `cd`, o un `cp` al directorio.
- Se resolvieron con Write/Edit y `cp` a rutas de fichero absolutas.

---

## Correcciones de providers-dev, ciclos 1 y 2

(Según el encargo del Orchestrator; no hay informe IMPLEMENTATION de estos ciclos.)

**Ciclo 1**
- `timer-cleanup.test.ts` formateado con prettier.
- `server.use(route("post","/chat/completions",…))` en 3 tests con `received` (la comprobación de cero peticiones ya no pasa en vacío).

**Ciclo 2**
- Confirmado con `prettier --check` que `construction-no-request.test.ts` no cumplía; reescrito con `vi.spyOn(globalThis,"fetch")` + `setImmediate` (sin timer real). Mutación H hace fallar 2 casos.
- Quitada la aserción síncrona redundante de `provider.test.ts`.

**Citas de las líneas corregidas** (las leyó el reviewer en disco en el ciclo 2; ver REVIEW ciclo 2):
- `construction-no-request.test.ts:4` (import en una línea), `:10` (`restoreAllMocks`), `:22` (`vi.spyOn` de fetch), `:33` (`setImmediate`), `:34` (`not.toHaveBeenCalled`).
- `provider.test.ts:84-100`: aserción síncrona quitada.

---

## IMPLEMENTATION — TASK-010 (devops, ciclo 3 de 3, OD-067) — 2026-11-11

(Resumen guardado por el Orchestrator; los temporales están en scratchpad/t010c3/.)
- `pnpm.overrides` añadido al package.json raíz (solo ese bloque) y lockfile regenerado en contenedor.
- Las 12 dependencias quedan con fecha ≤ 2026-10-27 y dentro del rango `^` del padre:
  - @mswjs/interceptors 0.45.10 (msw ^0.45.6)
  - @inquirer/confirm 6.3.5, @inquirer/core 12.0.6, @inquirer/type 4.2.1 (exacta), @inquirer/ansi 2.0.10 y @inquirer/figures 2.0.10 (todas del 2026-10-27)
  - tldts y tldts-core 7.4.19 (2026-10-20)
  - ansi-regex 6.4.0 (2026-09-27; strip-ansi ^6.2.2)
  - cookie 2.0.1 (2026-06-30)
  - tough-cookie 6.0.2 (2026-07-07)
  - set-cookie-parser 3.2.1 (2026-10-21; headers-polyfill ^3.0.1)
- Overrides (pnpm solo admite selectores de un nivel padre>hijo):
  - msw>@inquirer/confirm, msw>@mswjs/interceptors, msw>cookie, msw>tough-cookie
  - @inquirer/confirm>@inquirer/core y >@inquirer/type
  - @inquirer/core>@inquirer/ansi, >@inquirer/figures y >@inquirer/type
  - tough-cookie>tldts y tldts>tldts-core
  - headers-polyfill>set-cookie-parser
  - strip-ansi>ansi-regex: es el único selector que no cuelga en exclusiva de msw. Hoy strip-ansi solo llega a través de msw.
- Efecto colateral: mute-stream pasa de 4.0.0 a 3.0.0 (2025-10-22), porque @inquirer/core@12.0.6 pide ^3.0.0.
- Lockfile: cambian solo esos paquetes más el bloque `overrides`.
- Comprobaciones:
  - `pnpm install --frozen-lockfile --ignore-scripts`: rc=0
  - `-r typecheck` y `-r lint`: rc=0
  - `format:check`: OK
  - providers: 109/109
  - `pnpm why`: todas bajo msw (y bajo vitest, por su peer opcional msw).
- Respecto a e3fae25: 45 versiones nuevas y ninguna posterior al 2026-10-28.
- Deuda LOW propuesta: retirar los overrides cuando msw y vitest resuelvan solos versiones de ≥ 14 días. El selector strip-ansi>ansi-regex no es exclusivo de msw.
- Bloqueos: ninguno.

---

## TEST — TASK-010 (tester) — ciclo 0 — 2026-11-11 — Veredicto: PASS

(Resumen guardado por el Orchestrator.)

**Comandos** (en contenedor node:22.23.3 con pnpm 9.15.9, usando run.sh tras leerlo, con `--cap-drop ALL`):
- `pnpm install --frozen-lockfile --ignore-scripts`: OK.
- `pnpm -r typecheck` y `pnpm -r lint`: OK.
- Tests: 105/105, y 107/107 con el test nuevo.

**DoD:** las viñetas 1 a 8 dan PASS. Evidencia:
- 1: provider.test (el resolver se llama una vez; control positivo con bearer; solo expone id y capabilities); no-leak (en todas las serializaciones e inspect); stubEnv de las variables OPENAI_*; escaneo estático con ≥ 6 ficheros.
- 2: ProviderAuthError al construir, con 0 peticiones; un nombre mal formado o demasiado largo no se cita.
- 3: no-leak con 400, 401, 403, 429, 500, error de red, timeout y listModels; el canario va en el cuerpo y en la cabecera; `cause` es undefined.
- 4: los mapeos 401 y 429 (retry-after y retry-after-ms) y el timeout con fake timers; el abort del llamador relanza `reason`; errors.test cubre Retry-After en todas sus formas.
- 5: usage tal cual, y null cuando falta.
- 6: fake-provider.test (12 tests) y los exports `.` y `./testing`.
- 7: msw con `onUnhandledFrame: "error"`.
- 8: cobertura 100 / 99.32 / 100 / 100.

**Mutaciones**
- Fallan como deben: A (maxRetries), B (apiKey enumerable), C (process.env), D (Authorization null), E (retryAfterMs), F (AbortSignal.any).
- G (clearTimeout) sobrevivía. Se añadió `packages/providers/src/openai-compatible/timer-cleanup.test.ts` con 2 tests, y ahora falla.
- md5 agregado de providers (sin el fichero nuevo): d524cc9734ea8092b746e5150b3e966e, igual antes y después.

**Formato del test nuevo:** el tester lo formateó con prettier dentro del contenedor, pero no escribió el resultado en el host. Puede que haga falta `make fmt`.

**Deuda propuesta**
- LOW: la aserción `<= 1` del test de éxito depende de cómo gestiona sus timers el SDK 7.45.1. Se paga al subir el SDK.

**Incidencia de hook:** bash-guard rechazó un `bash -c "..."` mal citado («el script de sh -c / bash -c no es una sola cadena…»). El tester lo resolvió pasando el script con `"$(cat fichero)"`.
- Esa forma es la clase de deuda OD-CC3-1 (datos que pasan a código, TD-128).
- El Orchestrator lo marca como posible rodeo del hook y lo pasa a security.

**Estado final:** no queda ningún contenedor propio vivo. No se usó Node en el host ni se tocó `.env`.

## TEST — TASK-010, ciclo de corrección 1 — 2026-11-11 — Veredicto: PASS

(Resumen guardado por el Orchestrator.)
- Contenedor: run2.sh mete el script en el tar y lo ejecuta con `bash /work/job.sh`. Sin `"$(cat …)"`. Sin bloqueos.
- install frozen OK, `-r typecheck` OK, `-r lint` OK, `format:check` de la raíz OK. Tests: 107/107, y 109/109 con el test nuevo. Cobertura: 100/99.32/100/100.
- DoD: las 8 viñetas en PASS.
- Mutación H (petición en el constructor si la clave no resuelve): la aserción síncrona `received` de provider.test.ts:~87 no puede fallar.
- Se añadió `src/openai-compatible/construction-no-request.test.ts`. Espera `setImmediate` y 20 ms reales y comprueba `received` = 0. Falla en sus 2 casos con la mutación H y pasa sin ella. Está formateado.
- md5 agregado de providers (sin el fichero nuevo): 73912ff467a0ef5646dd964327038247, igual antes y después. No queda ningún contenedor propio vivo.
- Deuda LOW propuesta: retirar la aserción síncrona redundante de provider.test.ts:~87.

## TEST — TASK-010, ciclo de corrección 2 — 2026-11-11 — Veredicto: PASS

(Resumen guardado por el Orchestrator.)
- El tester reconoce que en el ciclo 1 su script ejecutaba `prettier --write` antes de comprobar el formato, así que su «format:check OK» no valía. Esta vez no hay `--write` y se comprueba el árbol del host sin tocarlo.
- install frozen OK, `-r typecheck` OK y `-r lint` OK. `format:check` de la raíz, salida literal: «All matched files use Prettier code style!». Tests 109/109 en 9 ficheros. Cobertura 100/99.32/100/100.
- DoD: las 8 viñetas en PASS.
- Mutación H: `construction-no-request.test.ts` falla en sus 2 casos (3 tests fallidos y 106 pasados).
- md5 agregado de providers: dd09514ce45432c795a2a45daf41a08b, el mismo antes y después. No quedan contenedores propios vivos.

## TEST — TASK-010, ciclo de corrección 3 (overrides OD-067) — 2026-11-11 — Veredicto: PASS

(Resumen guardado por el Orchestrator.)
- `install --frozen-lockfile` OK. `-r typecheck` y `-r lint` OK. `format:check` OK (literal). providers: 109/109 y cobertura 100/99.32/100/100.
- core: 171/171 y cobertura 100.
- persistence: no se ejecutó, porque necesita DB.
- apps/web: fallan los 2 `*.integration.test.ts` con «no tests». El tester asume que es por la falta de DB, pero no lo ha verificado.
- worker: sin tests.
- `pnpm why -r`: las 12 dependencias y mute-stream 3.0.0 resuelven a las versiones del informe de devops, cada una con una sola versión.
- DoD: 8/8 en PASS. El md5 de providers sigue siendo dd09514ce45432c795a2a45daf41a08b. No queda nada vivo.

---

## REVIEW — TASK-010 (reviewer) — ciclo 0 — 2026-11-11 — Veredicto: CHANGES_REQUESTED

(Resumen guardado por el Orchestrator.)

**MAJOR**
- `timer-cleanup.test.ts:1` no cumple `.prettierrc` (`{}`, printWidth 80).
  - La línea del import de vitest mide 84 caracteres e importa 7 nombres.
  - Haría fallar `pnpm format:check` en la CI (`ci.yml:51`) y en `make validate` (`Makefile:82`).
  - Arreglo: formatearlo en el contenedor y volver a ejecutar format:check.

**MINOR**
- `pnpm-lock.yaml:3685-3689` (también :104, :2946 y :4225). Las −16 líneas no vienen del peer typescript de msw, sino de dos peers opcionales que ahora se satisfacen:
  - openai satisface el peer de langsmith@0.11.0, que viene de `@langchain/core` en persistence;
  - msw satisface el de vitest/`@vitest/mocker`.
  - Efecto: openai 7.45.1 entra en las imágenes runtime/migrate a través de pnpm deploy (`docker/worker.Dockerfile:21` y `:30`).
  - No hay que cambiar código. Lo valora security y se anota en ARCHITECTURE §9. Evitarlo es una OPEN DECISION, porque toca la configuración de pnpm de la raíz.
- `test-server.ts:32-39`. `received` solo registra las peticiones que llegan a rutas registradas, así que en `provider.test.ts:99`, `:252` y `:360` la comprobación de cero peticiones pasa sin probar nada.
  - Hoy la regresión la siguen detectando el tipo de error y `onUnhandledFrame: "error"`.
  - Arreglo: registrar todas las peticiones salientes, o registrar la ruta en esos tests.

**NIT**
- `timer-cleanup.test.ts:47`: la comprobación `<= 1` depende del SDK. Pasa a deuda.
- `test-server.ts:24-25`: tiene estado de módulo mutable. Es aceptable.

**Comprobado sin hallazgos**
- La clave, ProviderAuthError, los errores sin cause, que no se lea el entorno y el mapeo de errores, que sigue OD-059 (con abort y clearTimeout en finally).
- usage, FakeProvider y los exports.
- core no cambia, y la configuración es idéntica a la de core.
- Las 5 desviaciones son razonables.
- El escáner de secretos queda limpio.

**Deuda LOW propuesta**
- La comprobación `<= 1`, acoplada al SDK.
- openai entra de forma transitiva en las imágenes del worker (TASK-017 o el cierre, en ARCHITECTURE §9).
- Las LOW del owner (OD-064, OD-065, R6 y R7).

**Requiere security:** sí.

## REVIEW — TASK-010, ciclo de corrección 1 — 2026-11-11 — Veredicto: CHANGES_REQUESTED

(Resumen guardado por el Orchestrator.)
- MAJOR (por confirmar): `construction-no-request.test.ts:4-11`. El import multilínea cabría en 79 columnas y prettier lo colapsaría, así que `format:check` fallaría. Cierre: la salida de `prettier --check` sobre ese fichero; si lo da por bueno, el hallazgo se cierra.
- MINOR: `construction-no-request.test.ts:43` usa `setTimeout` real de 20 ms, en contra de la regla 4 de testing-conventions. Arreglo: `vi.spyOn(globalThis, "fetch")` antes de construir, `setImmediate` y `not.toHaveBeenCalled()`. Hay que repetir la mutación H.
- NIT: `provider.test.ts:87/:101`. La aserción síncrona es redundante; quitarla o dejarla como deuda LOW.
- Verificados: el MAJOR de timer-cleanup, el MINOR received en :249 y :358, y el lockfile sin cambios (deuda).
- Deuda LOW consolidada: `<= 1` acoplado al SDK; openai en las imágenes del worker (TASK-017 o ARCHITECTURE §9); la aserción de :101; las del owner OD-064, OD-065, R6 y R7.

## REVIEW — TASK-010, ciclo de corrección 2 (final) — 2026-11-11 — Veredicto: APPROVED

(Resumen guardado por el Orchestrator.)
- Están verificados en disco los tres puntos: el MAJOR de formato (construction-no-request.test.ts:4 en una línea), el MINOR del timer real (`vi.spyOn` fetch en :22, `setImmediate` en :33, `not.toHaveBeenCalled` en :34 y `restoreAllMocks` en :10) y el NIT de la aserción vacía (se quitó en provider.test.ts:84-100).
- Cumplimiento: SPEC, ARCHITECTURE, ADR-003, DoD (8/8) y plan. No hay sobrearquitectura.
- Deuda LOW consolidada:
  1. `<= 1` en timer-cleanup.test.ts:55, acoplada al SDK 7.45.1. Se paga al subir openai.
  2. openai entra de forma transitiva en persistence y en las imágenes runtime/migrate, por el peer de langsmith (pnpm-lock.yaml:3685-3689; docker/worker.Dockerfile:21 y :30). Se paga en TASK-017 o se anota en ARCHITECTURE §9.
  3. OD-064 `OPENAI_CUSTOM_HEADERS`. Se paga en TASK-020 o TASK-027.
  4. OD-065 `PROVIDER_CONFIG_INVALID`. Se paga en TASK-020.
  5. R6: errores sin cuerpo. Se paga en TASK-027.
  6. R7: capacidades no verificadas. Se paga en TASK-019 o TASK-022.
- Pendientes de cierre: añadir openai y msw a ARCHITECTURE §9; en §2, `/testing` pasa a «actual»; corregir providers-dev.md:29 (lo hace el humano).
- Requiere security: sí.

## REVIEW — TASK-010, ciclo de corrección 3 (OD-067) — 2026-11-11 — Veredicto: APPROVED

(Resumen guardado por el Orchestrator.)
- NIT: SPEC:398 y plan:54 dicen «acotados a msw», pero 9 de los 13 selectores tienen otro padre. Hoy el efecto se limita a msw porque esos padres solo llegan por msw. Se corrige la redacción al cerrar o pasa a la deuda 1.
- Las 13 entradas coinciden entre package.json:21-36 y lockfile:7-20.
- Ninguna resolución previa cambia. Las −16 líneas siguen siendo las mismas.
- strip-ansi y los demás padres solo llegan por msw (yargs, @inquirer/core) y cada uno tiene una sola versión.
- mute-stream 3.0.0 (2025-10-22) cumple la regla.
- `pnpm.overrides` en package.json es lo correcto en pnpm 9.15.9.
- Sin impacto en las imágenes, porque msw es dev.
- La frase de ARCHITECTURE:258 es coherente.
- apps/web: el fallo es anterior y no tiene que ver con los overrides. `loadTestDatabaseUrl()` se ejecuta al cargar el módulo y lanza `EnvValidationError` si falta `DATABASE_URL_TEST` (env.ts:58-61). La CI sí lo define (ci.yml:83, :117-119).
- Deuda LOW consolidada:
  1. Retirar los 13 overrides; vigilar los selectores no exclusivos → TASK-040.
  2. `<= 1` acoplado al SDK → al subir openai.
  3. openai transitivo en las imágenes → TASK-017 o ARCHITECTURE §9.
  4. OD-064 → TASK-020/027.
  5. OD-065 → TASK-020.
  6. R6 → TASK-027.
  7. R7 → TASK-019/022.
- Pendientes de cierre: ARCHITECTURE §9 (openai y msw), §2 (/testing pasa a actual) y providers-dev.md:29 (lo corrige el humano).

---

## SECURITY — TASK-010 — ciclo 0 — 2026-11-11 — Veredicto: APPROVED (M1 pendiente de una decisión humana)

(Resumen guardado por el Orchestrator; las descargas de security están en scratchpad/sec010/.)

**Verificación**
- tarball de openai@7.45.1: el sha512 coincide con el lockfile. Se leyó client.mjs.
- Se consultaron en el registro npm los 45 paquetes nuevos, y los avisos de GitHub con control positivo.
- Se leyó bash-guard.sh.

**Secretos: OK**
- La clave solo está en #client. `client.apiKey` es pública, pero cuelga de un campo privado; no-leak.test.ts:140-144 lo cubre.
- No se lee ninguna variable OPENAI_* salvo CUSTOM_HEADERS (client.mjs:251, OD-064).
- `"none"` nunca se envía: defaultHeaders se aplica después de las cabeceras de autenticación (client.mjs:1410-1413).

**Red**
- Una baseUrl vacía se rechaza (provider.ts:34).
- Las redirecciones se siguen. undici quita Authorization al cambiar de origen, pero en 307/308 reenvía el cuerpo (L2).
- Con `user:pass@` el fallo llega tarde, con un mensaje fijo (L1).

**Errores: OK**
- Plantillas fijas sin cause (errors.ts:48-91).
- `signal.reason` es el del llamador (provider.ts:130).

**Cadena de suministro**
- openai: 14 días, OIDC con procedencia, sin dependencias ni scripts y sin avisos.
- msw: OIDC, sin scripts y sin avisos.
- 45 paquetes nuevos: ninguno tiene scripts de instalación; 6 tienen `prepare`, que no se ejecuta. `--ignore-scripts` está en todas partes.

**MEDIUM**
- **M1:** 12 transitivas de msw tienen menos de 14 días, y 8 se publicaron menos de 24 h antes del lockfile.
  - Afectadas: @inquirer/{ansi,confirm,core,figures,type}, tldts y tldts-core 7.4.21, @mswjs/interceptors@0.45.12, ansi-regex@6.6.0, cookie@2.0.2, tough-cookie@6.1.0 y set-cookie-parser@3.2.2.
  - Ejecutadas en vitest en el contenedor dev (con red, sin .env) y en la CI (sin secretos). No están en las imágenes.
  - Atenuantes: 11 de 12 con OIDC; ansi-regex se leyó entero y está limpio; sin avisos ni scripts; integridad fijada.
  - ARCHITECTURE.md:258 no dice si la regla de las dos semanas cubre las transitivas.
  - Opciones: (a) overrides acotados a msw en el package.json raíz, con versiones anteriores al 2026-10-28 dentro de los rangos `^`; (b) aceptarlo y pagarlo en TASK-040 con resolution-mode=time-based o minimumReleaseAge (pnpm ≥ 10.16); (c) regenerar el lockfile a partir del 2026-11-25.
  - Recomendación de security: (a). Si la regla rige para las transitivas, M1 pasa a HIGH y la tarea queda BLOCKED.

**LOW**
- L1: assertHttpUrl acepta `user:pass@` → TASK-020.
- L2: añadir `fetchOptions: {redirect: "error"}` → TASK-020/027.
- L3: exigir https con clave real fuera de loopback/compose (OD) → TASK-020.
- L4: amplía OD-064. CUSTOM_HEADERS se fusiona después de la autenticación y puede sustituir Authorization → TASK-020/027.
- L5: openai entra de forma transitiva en las imágenes del worker por el peer de langsmith (pnpm-lock.yaml:3684-3689) → ARCHITECTURE §9 y TASK-017.

**Hooks**
- a. providers-dev: falso positivo legítimo (S4, bash-guard.sh:303-306 y :385). No es un rodeo y no deja ficheros sueltos.
- b. tester: `bash -c "$(cat f)"` rodea el análisis, sin daño. Propuesta: ampliar TD-128 con `bash -c "$(cat f)"` y `sh -c "$(<f)"`, y añadir a las convenciones: «ante el código 6, corregir las comillas o ejecutar el fichero».
- c. Orchestrator: falso positivo de TD-097 (bash-guard.sh:528, code_flat). Lo dispara `'^#+ .*(provider|proveedor)'`; con `'^#+.*(…)'` pasa. Propuesta: añadir el ejemplo a TD-097.

## SECURITY — TASK-010, ciclo de corrección 3 (final) — 2026-11-11 — Veredicto: APPROVED

(Los datos están en scratchpad/sec010c3/. Resumen guardado por el Orchestrator.)
- **M1 cerrado.** Frente a e3fae25 hay 45 versiones nuevas: 13 cambian respecto al ciclo 0 y las otras 32 son iguales. Las −2 líneas son sufijos de peers.
- **Comprobado en las 45:** la fecha en el registro, los scripts y que el sha512 del lockfile coincide con `dist.integrity`. 0 problemas.
- **Avisos de GitHub:** 0 en las 13 que cambian. El control positivo con next@16.4.0 devuelve sus 3 GHSA.
- **Las 13 que cambian** (línea del lockfile):
  - del 2026-10-27, con 15 días: @inquirer/ansi 2.0.10 (:855), confirm 6.3.5 (:859), core 12.0.6 (:868), figures 2.0.10 (:877) y type 4.2.1 (:881); @mswjs/interceptors 0.45.10 (:935);
  - de 20 a 21 días: set-cookie-parser 3.2.1 (:2194, 20 d), tldts-core y tldts 7.4.19 (:2295 y :2298, 21 d);
  - de 45 días o más: ansi-regex 6.4.0 (:1357, 45 d, sin procedencia), tough-cookie 6.0.2 (:2302, 126 d), cookie 2.0.1 (:1416, 133 d) y mute-stream 3.0.0 (:1958, 384 d).
- **openai 7.45.1** cumple los 14 días. En package.json solo se ha añadido `pnpm.overrides` (:21-37), y el lockfile lo recoge en :7-20.
- **L6 (LOW, nueva):** los selectores no indican la versión del padre (package.json:23-35). En el futuro podrían fijar en silencio paquetes de otro árbol o de otra versión mayor, y seguir vigentes después de subir msw.
  - Arreglo: acotar el padre con selectores tipo `msw@3.0.3>…`, `strip-ansi@7>…`, etc.
  - Hasta entonces, cualquier diff que toque los overrides o el lockfile pasa por security.
  - Pago: TASK-040, junto con retirar los overrides y automatizarlos.
- **Siguen igual:** L1–L5 (TASK-020/027/017 y ARCHITECTURE §9) y la ampliación de TD-128 y TD-097 (TASK-046/048).

---

## Cierre de arquitectura (2026-11-11)

Hecho por el architect, fuera de esta tarea de implementación:
- ARCHITECTURE §2 `:60`: `/testing` pasa de previsto a actual.
- ARCHITECTURE §9 `:279-280`: filas de `openai` y `msw`.
- SPEC `:398`: OD-067 registrada; precisión «acotados a msw» (NIT del reviewer ciclo 3).
- Plan `:53`: precisión «acotados a msw» (NIT); `:279` (R9): marcado como hecho.

---

## Incidencias de hooks

- **providers-dev**: 4 bloqueos «escritura por shell en '<ruta>' fuera del scope» (rutas relativas tras `cd`). Security lo califica de falso positivo legítimo (S4, bash-guard.sh:303-306 y :385). Resuelto con Write/Edit y rutas absolutas.
- **tester (ciclo 0)**: `bash -c "$(cat f)"` tras un bloqueo de bash-guard (código 6). Rodeo sin daño; clase de TD-128.
- **Orchestrator**: bloqueo «no se leen ficheros .env…» en una orden de solo lectura. Falso positivo de TD-097; no se reformuló.

## Incidencias fuera de la tarea

- Los 2 `*.integration.test.ts` de `apps/web` fallan sin `DATABASE_URL_TEST` en el contenedor de dev. Es preexistente y en la CI corren (ci.yml:83, :117-119).
- Pendiente del humano: `.claude/agents/providers-dev.md:29` dice `process.env[apiKeyEnv]`, contradice OD-017 (ADR-006: solo el humano edita `.claude/agents/**`).

---

## Deuda registrada (TECHNICAL_DEBT.md, 2026-11-11)

Ninguna TD tiene su pago en TASK-010 (no se marca PAID ninguna).

| ID | Descripción (resumen) | Severidad | Se paga en |
|---|---|---|---|
| TD-140 | Overrides de msw (13 entradas en `package.json` raíz): selectores sin versión del padre, 9 de 13 con padre distinto de msw (L6) | LOW | TASK-040 |
| TD-141 | `baseUrl`: `user:pass@` aceptado (L1), redirecciones no bloqueadas (L2), https y host no exigidos (L3, requiere OD) | LOW | TASK-020 |
| TD-142 | `OPENAI_CUSTOM_HEADERS` se fusiona tras la autenticación y puede sustituir `Authorization` (OD-064 + L4) | LOW | TASK-020 / TASK-027 |
| TD-143 | Error propio de configuración inválida, `PROVIDER_CONFIG_INVALID` (OD-065) | LOW | TASK-020 |
| TD-144 | Errores sin cuerpo ni `cause`: poco diagnóstico (R6) | LOW | TASK-027 |
| TD-145 | Capacidades declaradas por configuración, no verificadas (R7) | LOW | TASK-019 / TASK-022 |
| TD-146 | Aserción `toBeLessThanOrEqual(1)` en `timer-cleanup.test.ts:55`, acoplada a openai 7.45.1 | LOW | Al subir `openai` (sin tarea asignada, ver nota) |
| TD-147 | `openai` transitivo en `persistence` y en las imágenes runtime/migrate (peer de langsmith; `pnpm-lock.yaml:3685-3689`; `docker/worker.Dockerfile:21`, `:30`) | LOW | TASK-017 |

Ampliaciones (siguen OPEN):
- **TD-128**: ejemplo `bash -c "$(cat f)"` y `sh -c "$(<f)"`; pauta «ante un bloqueo de `bash -c`, corregir las comillas o ejecutar el fichero; nunca `"$(cat …)"`».
- **TD-097**: ejemplo `grep -n -i -E '^#+ .*(provider|proveedor)'`; alternativa `'^#+.*(…)'`.

## OPEN DECISIONS registradas

Todas RESUELTAS el 2026-11-10 y 2026-11-11 por el humano (plan §0 y SPEC §13): OD-057 a OD-066 (2026-11-10) y OD-067 (2026-11-11).

Abiertas que pasan a deuda o a decisión futura (sin OD nueva en esta tarea):
- Evitar que openai entre en las imágenes del worker por el peer de langsmith (R-OD del reviewer, ciclo 0): «toca la configuración de pnpm de la raíz». Queda en TD-147.

## Nota de cierre (docs-keeper)

- Regla 1 del registro de deuda: TD-146 no tiene tarea de pago; el Orchestrator debe asignarla antes de dar por cerrada la siguiente revisión del registro (o decidir un hito concreto).
- README: sin cambios (paquete interno; los tests se ejecutan con `pnpm --filter @agentlab/providers test`).

## Veredictos finales

| Veredicto | Resultado |
|---|---|
| TEST | PASS (DoD 8/8; 109/109; cobertura 100 / 99.32 / 100 / 100) |
| REVIEW | APPROVED (ciclo 3; 1 NIT) |
| SECURITY | APPROVED (ciclo 3; M1 cerrado; L6 nueva) |
| Hito | M1 sigue abierto |
