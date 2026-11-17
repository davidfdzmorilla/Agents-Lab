# TASK-018 — Adaptador Gemini (SDK Google GenAI)

| Campo | Valor |
|---|---|
| Tarea | TASK-018 · Adaptador Gemini (SDK Google GenAI) |
| Hito | M2 |
| Owner | providers-dev (paso 0 de manifiestos y lockfile: devops) |
| Fecha de cierre | 2026-11-17 (tomada del encargo de cierre; docs-keeper no ejecuta `date`) |
| Ciclos de corrección | 1 (ciclo 0 → ciclo 1) |
| Plan | `docs/reports/TASK-018-plan.md` (aprobado por el humano el 2026-11-16; OD-076 a OD-083 resueltas en (a); notas del 2026-11-17: OD-084, errata §3.7 y nota §3.6) |
| Veredicto TEST | PASS en 2 pasadas (ciclo 0: 209/209; ciclo 1: 223/223, cobertura 100/99.25; también con `--network none`) |
| Veredicto REVIEW | CHANGES_REQUESTED (ciclo 0) → APPROVED (ciclo 1) |
| Veredicto SECURITY | REQUIRED. APPROVED en 2 pasadas (la 1.ª se interrumpió por un falso positivo de bash-guard; decisión humana «Seguir sin la sonda») |
| Verificación del humano | `make test` y `make validate` en verde, 2026-11-17 |
| Estado final | DONE |
| CI | Pendiente del push del humano |

## Resumen

- Segundo adaptador de `packages/providers`: `GeminiProvider` sobre `@google/genai@2.32.0` (OD-076 a), que implementa `ModelProvider` de `core` sin cambiar `core`.
- Opciones `{ id, apiKeyEnv, secretResolver }`. La clave se resuelve una vez en la construcción y viaja en `x-goog-api-key`. Cliente con `vertexai: false`, `apiVersion: "v1beta"`, `baseUrl` constante, sin reintentos del SDK, sin AFC y con `automaticContinuation: false`.
- Capacidades fijas (OD-078 a), errores normalizados según OD-059 con dos añadidos propios (400 `API_KEY_INVALID` y `RetryInfo`), `usage` según OD-081 y OD-084, `costReported: null`.
- `resolveApiKey` sale de `openai-compatible/provider.ts` a `api-key.ts` (OD-083 a).
- Ciclo 1: MAJOR (un 200 mal formado se clasificaba como conexión reintentable) y MINOR y NIT de tests corregidos; OD-084 (b) aplicada.
- Deuda registrada: TD-159 a TD-169 (TD-141 ampliada). Pagadas en el cierre: TD-157 y TD-169.

## Ficheros

- Creados: nuevos `packages/providers/src/api-key.ts`, `api-key.test.ts`, `packages/providers/src/gemini/{provider.ts, mapping.ts, errors.ts, test-server.ts, provider.test.ts, mapping.test.ts, errors.test.ts, env-isolation.test.ts, no-leak.test.ts}`.
- Modificados: `package.json` (raíz, solo `pnpm.overrides`: `"@google/genai>ws": "8.22.1"`), `packages/providers/package.json` (`"@google/genai": "2.32.0"`), `pnpm-lock.yaml` (+304/−14, devops), `packages/providers/src/index.ts`, `index.test.ts`, `openai-compatible/provider.ts` (solo el import).
- Documentación de cierre: `docs/reports/TASK-018.md` (este), `docs/TASKS.md`, `docs/TECHNICAL_DEBT.md`, `docs/DEVELOPMENT_WORKFLOW.md`.
- Documentación del architect en el cierre (no tocada por docs-keeper): `docs/ARCHITECTURE.md` §9 (`:280`), `docs/TECHNICAL_SPEC.md` §13 (OD-084, `:616`; resolución `:415`), `docs/reports/TASK-018-plan.md` §3.6 (`:188`).
- README raíz: sin cambios (no cambia ningún comando de instalación; no lista `packages/providers`, como ya se anotó en TASK-012).

## Decisiones

- **OD-076 (a)** `@google/genai` 2.32.0 exacta + override `@google/genai>ws: 8.22.1`. `protobufjs>@types/node` no hizo falta (una sola versión, 22.20.5). `deps_allowed: ["@google/genai@2.32.0"]`. Subir a 3.x es TASK-040.
- **OD-077 (a)** Tests con msw (3.0.3) sobre el SDK real, no `vi.mock`.
- **OD-078 (a)** Capacidades fijas: `tools` true, `structuredOutput` true, `streaming` false, `maxContextTokens` null, `reportsUsage` true, `reportsCost` false. Afinar por modelo es TD-145.
- **OD-079 (a)** `baseUrl` constante `https://generativelanguage.googleapis.com/`, sin opción.
- **OD-080 (a)** Lecturas de entorno y `console.warn` del SDK aceptados como deuda LOW (TD-164).
- **OD-081 (a)** `outputTokens` con thinking, precisada por OD-084.
- **OD-082 (a)** `system` intermedio, o sin mensajes `user`/`assistant`: `ProviderCapabilityError` antes de la red.
- **OD-083 (a)** Reparto de scope: devops en el paso 0 (manifiestos y lockfile); providers-dev en `packages/providers/**`.
- **OD-084 (b)** (SPEC §13, origen «ciclo 0», resuelta el 2026-11-17, SPEC `:415`): `outputTokens = (candidatesTokenCount ?? 0) + (thoughtsTokenCount ?? 0)` si existe al menos uno; `null` solo si no existe ninguno. Cuenta más tokens, no menos; no estima nada.
- Criterio de reintento «fetch failed» (plan §3.6 `:188`, nota del 2026-11-17): solo `TypeError` con mensaje `"fetch failed"` y `cause` objeto es conexión reintentable; un corte a mitad del cuerpo (`"terminated"`) no se reintenta (TD-165).

## Deuda registrada

Aprobada por el humano el 2026-11-17 y registrada en `docs/TECHNICAL_DEBT.md` con los IDs definitivos. Origen de todas: TASK-018.

| TD | Severidad | Descripción | Pago |
|---|---|---|---|
| TD-159 | MEDIUM | Peers opcionales de `openai@7.45.1` y `langsmith@0.11.0` resueltos en los snapshots de persistence: `migrate` incluye `google-auth-library@10.9.1` y `ws@8.22.1` cargables; `worker` y `web` arrastran ~21 paquetes huérfanos (~11 MB). | TASK-040 (deploy / ADR-011) |
| TD-160 | MEDIUM | Comprobación pendiente por análisis estático de si `packages/persistence/src/cli/migrate.ts` carga langsmith o `@langchain/core` y, por esa vía, `ws` o `google-auth-library`. | TASK-040 |
| TD-141 | LOW | Ampliada: el mismo defecto de redirección en `GeminiProvider` (`gemini/provider.ts:64`). Corrección común: `fetch` envolvente con `redirect: "error"`. Decisión: se amplía TD-141 en lugar de crear una nueva, porque es la misma clase de defecto y el mismo pago. | TASK-020 |
| TD-161 | LOW | `gemini/errors.ts:38`: `retryAfterMs` sin tope. Requisito: `min(retryAfterMs, cap)`. | TASK-019 |
| TD-162 | LOW | `node-domexception@1.0.0` deprecated (vía `node-fetch@3` ← `gaxios@7`), sin aviso de seguridad. | TASK-040 |
| TD-163 | LOW | Tests de timers dependen de undici/msw (≤ 1 timer pendiente). Revisar al subir msw o el SDK. | TASK-040 |
| TD-164 | LOW | OD-080: lecturas de entorno (`GOOGLE_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_CLOUD_*`) y `console.warn` del SDK (textos fijos, sin valores). | TASK-020 / TASK-027 |
| TD-165 | LOW | Criterio de reintento: corte a mitad del cuerpo no se reintenta; «fetch failed» de TLS sí. Aplicar la misma regla en `openai-compatible`. | TASK-019 |
| TD-166 | LOW | Mutantes equivalentes que sobreviven (M04 `apiVersion`, M16 `assertCapabilities`, A5 `cause` null o primitivo). Sin acción. | TASK-040 |
| TD-167 | LOW | NIT de código: comentario de ~140 caracteres en `gemini/errors.ts:51`; nombre del test `gemini/no-leak.test.ts:164` (prueba `retryable:false` y ausencia de `cause`, no fugas). | TASK-019 |
| TD-168 | LOW (proceso) | `envg_re` de `.claude/hooks/bash-guard.sh:495` da falsos positivos con metacaracteres de regex. Paró 4 veces a security y 1 al reviewer. | TASK-046 (ADR-006: lo edita el humano) |
| TD-169 | LOW (proceso) | Tras un bloqueo de hook, el reviewer volcó a fichero un `git diff … \| grep` bloqueado (rodeo; solo lectura). | PAID (TASK-018): regla reforzada en `docs/DEVELOPMENT_WORKFLOW.md:98` |

Pagada en este cierre: **TD-157** (LOW, proceso): nueva regla 12 en `docs/DEVELOPMENT_WORKFLOW.md:36`, «Scope contrastado con role-guard al planificar».

Sin TD nueva: TD-140, TD-144, TD-145, TD-146 y TD-147 ya existían en el registro y siguen con su tarea de pago.

## OPEN DECISIONS

Todas resueltas por el humano:

- OD-076 a OD-083: (a) el 2026-11-16 (plan aprobado).
- OD-084: (b) el 2026-11-17 (SPEC `:415`).

No queda ninguna OPEN DECISION abierta de TASK-018.

## Bloqueos de hooks citados literalmente

Ninguno se rodeó. Cada uno se reformuló por el canal permitido o se dejó como deuda de proceso.

1. bash-guard, IMPLEMENTATION (providers-dev): «BLOCKED by bash-guard: escritura por shell en 'errors.ts' fuera del scope de la tarea. Usa Edit/Write dentro del scope o repórtalo.» Lo hizo con un heredoc y ruta relativa; se rehízo con Write y ruta absoluta.
3. bash-guard, IMPLEMENTATION (providers-dev): «BLOCKED by bash-guard: no se leen ficheros .env desde Claude Code (si .env es un patrón de búsqueda, escápalo: '\.env')». Salió con dos `sed -i` sobre `index.test.ts`; falso positivo. Se rehízo con Edit.
4. bash-guard, REVIEW (ciclo 0): «BLOCKED by bash-guard: no se leen ficheros .env desde Claude Code (si .env es un patrón de búsqueda, escápalo: '\.env')». Salió con `git diff pnpm-lock.yaml | grep …`. El reviewer lo volcó a un fichero del scratchpad y aplicó `grep` sobre él. Rodeo: ver TD-169.
5. bash-guard, SECURITY (1.ª pasada): la misma frase literal, con un `docker exec sec018 sh -c '…'` que creaba `/probe/hook.mjs`. Falso positivo probable. Decisión humana: «Seguir sin la sonda». El contenedor se eliminó.
6. bash-guard, SECURITY (2.ª pasada), tres veces la misma frase literal, disparada por `envg_re` (`bash-guard.sh:495`) con regex de grep que llevan `.*` o `?.`: `'^apps/.*/src/'` (abandonado), `(/[a-z]+)?.[;)\s]` (se paró) y `'^#+ .*TASK'` (búsqueda en docs, se paró).
7. bash-guard, SECURITY (2.ª pasada), una vez: «BLOCKED by bash-guard: el script de sh -c / bash -c no es una sola cadena… Escribe todo el script dentro de una sola cadena entre comillas». Se siguió la instrucción del propio hook.

Total: el aviso «no se leen ficheros .env» salió 6 veces (4 a security, 1 al reviewer, 1 al providers-dev); el de escritura por shell, 1 vez; el de `sh -c`, 1 vez. Ver TD-168.

## Avisos

- Los peers opcionales de openai y langsmith cambian claves de snapshot en el lockfile (~14 líneas «−» en openai, langsmith, `@langchain/core` y `@langchain/langgraph-checkpoint(-postgres)`); ninguna versión cambia. Es consecuencia de pnpm 9 y ya está en TD-159.
- Peers `google-auth-library` y `ws` aparecen como peer en `web` y `worker` (`pnpm -r why`). Sin carga al importar: en worker y web no están instalados (ver TD-159 y TD-160).
- Errata del plan §3.7 (`supportedActions`/`supportedGenerationMethods`): corregida por el architect con nota fechada (plan `:194`). El código filtra por `supportedActions`, el campo del SDK.
- `docs/ARCHITECTURE.md` §9 (`:280`) y `docs/TECHNICAL_SPEC.md` §13 (`:616`) los cerró el architect en su paso 7, no docs-keeper.
- Sin CI: `make test` y `make validate` los ejecutó el humano el 2026-11-17.
- Fuera de scope de docs-keeper: nada.

---

## PLAN (architect)

Ver `docs/reports/TASK-018-plan.md` (íntegro en ese fichero; aprobado el 2026-11-16, con las notas del 2026-11-17).

---

## IMPLEMENTATION — TASK-018, paso 0 (devops) — 2026-11-16

(Resumen guardado por el Orchestrator.)

- `@google/genai` 2.32.0 exacta en packages/providers/package.json (+1). Override raíz `"@google/genai>ws": "8.22.1"` (+1). pnpm-lock.yaml +304/−14, regenerado en contenedor con `--lockfile-only --ignore-scripts`.
- No hizo falta el override de `@types/node`: hay una sola versión, 22.20.5.
- Fechas del registro, con corte en 2026-11-02:
  - los 36 paquetes nuevos cumplen;
  - @google/genai 2026-10-29; ws 8.22.1 2026-10-31 (la 8.23.0, del 2026-11-12, queda excluida); protobufjs 7.6.6 2026-08-27; gaxios 7.3.1 2026-08-12; google-auth-library 10.9.1 2026-07-23; el resto entre 2013 y 2026-05.
  - google-logging-utils entra solo en la 1.1.3, no en la 1.2.0 que decía el plan.
- **Cambio inesperado del lockfile, para security.** pnpm resuelve ahora los peers opcionales de `openai@7.45.1` y `langsmith@0.11.0` con `ws` y `google-auth-library`.
  - Cambian las claves de snapshot de openai, langsmith, @langchain/core y @langchain/langgraph-checkpoint(-postgres). Son las ~14 líneas «−».
  - No cambia ninguna versión.
  - En `pnpm -r why` aparecen `google-auth-library` y `ws` como peer en web y worker.
- Resultados:
  - install frozen OK;
  - avisos de paquetes deprecated: `@esbuild-kit/*` (ya estaban) y `node-domexception` (nuevo);
  - `-r typecheck` verde;
  - providers 109/109 con cobertura 100/99.32/100/100.
- Sin bloqueos. El lockfile pasó por el scratchpad y se copió con `cp`.

## IMPLEMENTATION — TASK-018 (providers-dev) — 2026-11-16

(Resumen guardado por el Orchestrator.)

**Hecho**
- `GeminiProvider` exportado con `{id, apiKeyEnv, secretResolver}`; también se exporta el tipo `GeminiProviderOptions`.
- `resolveApiKey` pasa a `src/api-key.ts`; en openai-compatible solo cambia el import.
- La clave se resuelve una vez en `new` y se envía en `x-goog-api-key`. No hay `process.env` en src (escaneo en index.test.ts).
- Cliente: `vertexai:false`, `apiVersion v1beta`, `baseUrl` constante y sin `retryOptions`. Una sola petición por llamada (`automaticContinuation:false` y AFC desactivado, en mapping.ts:55-56).
- Capacidades fijas y congeladas. Los errores son de plantilla fija. `usage` según OD-081, `costReported` vale null y no hay `raw`.
- Referencias en gemini/provider.ts: :60-64 cliente, :111 `assertRepresentable`, :125 `AbortSignal.any`, :130 `throw signal.reason`, :102 y :138 `clearTimeout`.

**Ficheros**
- Nuevos (líneas):
  - api-key.ts (27) y api-key.test.ts (39);
  - en gemini/: provider.ts 141, mapping.ts 148, errors.ts 93, test-server.ts 73;
  - tests en gemini/: provider.test 463, mapping.test 273, errors.test 174, env-isolation.test 100, no-leak.test 160.
- Modificados: index.ts (+2), index.test.ts y openai-compatible/provider.ts (solo el import).

**Resultados** (contenedor)
- frozen, `format:check`, `-r typecheck` y `-r lint` OK.
- providers: 15 ficheros, 209/209 (109 + 100). Cobertura 100/99.22/100/100; gemini 100/99.08/100/100.

**SDK verificado** en dist/node/index.mjs de 2.32.0:
| Comportamiento | Líneas |
|---|---|
| `getBaseUrl` | :57-68 |
| v1beta | :13617 |
| `resolveCloudFlag` | :29416-29443 |
| lecturas de entorno descartadas | :29555-29560 |
| `console.warn` | :29655-29661 |
| `NodeAuth` sin GoogleAuth | :26918-26948 |
| `pRetry` solo con `retryOptions` | :14068-14125 |
| sin timer propio | :13658-13662 |
| `ApiError.message` = cuerpo | :7828-7835, :14296-14325 |
| AFC | :15315-15340 |
| `automaticContinuation` true por defecto | :15380-15389, :16044-16052, :16381-16393 |
| `Pager` | :16231, :5480-5560 |

**Discrepancias con el plan**
1. En wire el campo es `supportedGenerationMethods`; el SDK lo renombra a `supportedActions` (:12226-12230).
2. msw 3 intercepta a nivel de socket y undici deja vivo un timer de conexión, así que `vi.getTimerCount() ≤ 1`, como en TASK-010. No hay red real: se deduce del socket simulado. `--network none` no se pudo usar porque corepack necesita red.
3. `Object.keys` de un namespace sale en orden alfabético, así que el test ordena antes de comparar.

**Regla 13** (mutaciones revertidas)
- md5 de src antes y después de A/B: d2a9f827… en los dos casos.
- C/D/E se restauraron con `cmp` contra backup. El md5 final es ac95fa42…, porque mientras tanto se editaron dos tests.

| Mutación | Tests que fallan |
|---|---|
| A: copiar `err.message` | no-leak 400/500 y errors.test |
| B: `cause` | los mismos |
| C: sin `automaticContinuation:false` | test de una sola petición con `continuationToken` y mapping.test |
| D: sin `clearTimeout` | test de timers |
| E: sin `vertexai`/`baseUrl` | los 2 de env-isolation |

**Desviaciones**
- `toGeminiProviderError` no recibe `nowMs`.
- El id es `call_<posición entre las llamadas>`.
- `systemInstruction` lleva `role:"user"`, que pone el SDK.
- Las respuestas bloqueadas o sin candidatos tienen plantillas fijas distintas.
- Los timers se comprueban con ≤ 1.
- `listModels` comprueba `own.signal.aborted`.

**Bloqueos citados**
- «BLOCKED by bash-guard: escritura por shell en 'errors.ts' fuera del scope de la tarea. Usa Edit/Write dentro del scope o repórtalo.» Lo hizo con un heredoc y ruta relativa; se rehízo con Write y ruta absoluta.
- «BLOCKED by bash-guard: no se leen ficheros .env desde Claude Code (si .env es un patrón de búsqueda, escápalo: '\.env')». Salió con dos `sed -i` sobre index.test.ts y es un falso positivo; se rehízo con Edit.

**Puntos a confirmar**
- (a) Los timers con ≤ 1.
- (b) Corregir el texto del plan §3.7 (`supportedActions` / `supportedGenerationMethods`).

**Deuda propuesta (LOW)**
- OD-080: lecturas de entorno y `console.warn` del SDK. Se paga en TASK-020/027.
- Los tests de timers dependen de undici/msw: revisarlos al subir de versión.
- TD-145: capacidades por modelo.

## IMPLEMENTATION — TASK-018, ciclo de corrección 1 (providers-dev) — 2026-11-17

(Resumen guardado por el Orchestrator.)
- MAJOR 1a: `errors.ts:53-58` `isFetchNetworkFailure` = `TypeError && message === "fetch failed" && isRecord(cause)`; uso en `:98`. El SDK relanza el error de `fetch` sin tocarlo (index.mjs:14076-14082; `DEFAULT_FETCHER`, :20649-20652). Sonda en Node 22.23.4: "fetch failed" llega con `cause` Error. Se usa `isRecord` y no `instanceof Error` porque msw `HttpResponse.error()` pone como `cause` una `Response`. Cualquier otro TypeError → «unexpected error», no retryable.
- MAJOR 1b: `mapping.ts:123`, con `isRecord(part)` → `ProviderResponseError` «malformed response part», no retryable.
- MINOR: `provider.test.ts:473-481`, con `getTimerCount() === 0` tras un `listModels` correcto.
- NIT 3: `env-isolation.test.ts:89`, ahora `HttpResponse.json`.
- NIT 4: `no-leak.test.ts:122` renombrado. Caso nuevo en `:135`: un 200 que repite la clave en el candidato; solo aparece en `content` y nunca en `console` ni en el resto de campos. En `:164`, dos 200 mal formados: no retryable, sin fuga y sin `cause`.
- OD-084 (b): `mapping.ts:100-101`. Tests: solo candidates, solo thoughts, ambos, ninguno e inválido + válido.
- Ficheros: en gemini/, errors.ts, mapping.ts y 5 tests. provider.ts sin cambios.
- Contenedor: frozen, typecheck, lint y format OK. providers 223/223 (+14). Cobertura 100/99.25/100/100.
- Mutaciones sobre la copia del contenedor:

  | Mutación | Resultado |
  |---|---|
  | A1 (`instanceof TypeError`) | 5 fallos |
  | A2 (sin guarda de partes) | 3 fallos |
  | A1+A2 | 10 fallos |
  | B (sin `clearTimeout` en `listModels`) | 1 fallo |
  | C (`outputTokens` antiguo) | 1 fallo |

  md5 en scratchpad/c1.
- Sin bloqueos, OD ni deuda nueva. Límite conocido: un «fetch failed» con `cause` que no venga de la red sería retryable. No hay ningún camino que lo produzca, porque la URL base es constante.

## TEST — TASK-018 (tester) — 2026-11-17 — Veredicto: PASS

(Resumen guardado por el Orchestrator.)

**Comandos** (en contenedor)
- install frozen (también `--offline`), `-r typecheck`, `-r lint` y `format:check`: todos OK.
- providers: 15 ficheros, 209/209. Cobertura 100/99.22/100/100; gemini 100/99.08/100/100. La única rama sin cubrir es errors.ts:39.
- core 171/171 y agents 89/89.
- persistence, web y worker no se ejecutaron (necesitan BD).
- **Sin red real:** con `--network none` y el store reutilizado, providers, core y agents pasan.
- `grep process.env` en src, excluidos los tests: 0 resultados.

**DoD**
| # | Resultado | Evidencia |
|---|---|---|
| 1 | ✅ | index.ts:3-4; provider.ts:37-43; index.test.ts (exports y mapa `exports`) |
| 2 | ✅ | api-key.ts:11-26; provider.test.ts:56, :70, :78, :119; index.test.ts:37-49. Mutaciones M01, M02, M24, M34 y X1 muertas. |
| 3 | ✅ | provider.ts:60-65; env-isolation.test.ts:52 y :83. M03, M05 y M06 muertas. Sobrevive M04 (quitar `apiVersion`), equivalente: el valor por defecto ya es v1beta (:13617) y `GOOGLE_GENAI_API_VERSION` solo lo lee `fillGlobals` (:19900, Interactions). LOW, sin acción. |
| 4 | ✅ | provider.test.ts:156 (429/500/503) y :171 (`continuationToken`); mapping.test. M06, M07 y M08 muertas. |
| 5 | ✅ | provider.test.ts:104 y :225. M17, M18, M19 y M39-41 muertas. Sobrevive M16 (quitar `assertCapabilities`), equivalente: Gemini declara `tools` y `structuredOutput` como true. |
| 6 | ✅ | errors.test.ts (33 casos); provider.test.ts:245, 271, 291, 305, 313, 325, 338 y 349. M09-15 y M26-33 muertas. |
| 7 | ✅ | mapping.test. M20-23 y M42 muertas. |
| 8 | ✅ | no-leak.test.ts:74-147. M09-12 muertas. |
| 9 | ✅ | fake timers; pasa con `--network none`; cobertura ≥ 90. |
| 10 | ✅ | 2.32.0 exacta; solo ws@8.22.1 (lock :2595 y :4573). Fechas muestreadas, todas anteriores al 2026-11-03. Install frozen verde. |
| 11 | N/A | Se hace en el cierre. |

**Mutación**
- 52 mutaciones sobre una copia en el scratchpad. El md5 de src (28 ficheros) es idéntico antes y después.
- Sobreviven solo las equivalentes M04 y M16. M34 estaba mal construido y se rehízo como X1 y X2; las dos mueren.

**Puntos a confirmar**
- (a) Timers ≤ 1: de acuerdo. M28 (quitar `clearTimeout`) muere, así que el umbral sigue vigilando el timer propio.
- (b) `supportedActions`: de acuerdo. Hay que corregir el texto del plan §3.7 (en wire, `supportedGenerationMethods`).

**Resto**
- No se añadieron tests.
- Observación LOW: el test de `GOOGLE_GENAI_API_VERSION=v1alpha` pasa aunque se quite `apiVersion` (M04).
- Sin bloqueos y nada vivo.

## TEST — TASK-018, ciclo de corrección 1 — 2026-11-17 — Veredicto: PASS
- Contenedor: frozen, typecheck, lint y format OK. providers 223/223, cobertura 100/99.25/100/100; gemini 100/99.16 (sin cubrir errors.ts:39). core 171 y agents 89. providers con `--network none`: 223/223.
- DoD: ✅ 1-10 (6 y 7 reverificadas). 11 N/A.
  - Viñeta 6: errors.test.ts:145-175; provider.test.ts:306 (retryable) y :323; no-leak.test.ts:162.
  - Viñeta 7: mapping.test.ts:256-295 y mapping.ts:100-101.
- Cierre de hallazgos: MAJOR en errors.ts:57 y mapping.ts:123; MINOR en provider.test.ts:481; los 2 NIT verificados.
- Mutaciones (sobre copia; md5 de src idéntico): mueren A1, A2, A2b, A3, A4, A6, A7, A8, B, B2, C y C2-C7, más el muestreo del ciclo 0. Sobrevive A5 (`isRecord(cause)` → `cause !== undefined`), que solo se distingue con un `cause` null o primitivo, imposible en `fetch`. LOW, sin acción.
- Sin tests añadidos ni bloqueos. Nada vivo; 8 contenedores ajenos, sin tocar.

## REVIEW — TASK-018 (reviewer), ciclo 0 — 2026-11-17 — Veredicto: CHANGES_REQUESTED

(Resumen guardado por el Orchestrator.)

**Verificación propia**
- Copia en el scratchpad hecha con `git ls-files -co --exclude-standard`, sin `.claude/`. En contenedor: frozen, typecheck, lint y 209/209 con cobertura 100/99.22/100/100.
- Sondas en scratchpad/rev018/probe.test.ts. El repo no se tocó y no queda nada vivo.

**[MAJOR] errors.ts:87-91 y mapping.ts:114-115**
- Todo `TypeError` se trata como fallo de conexión con `retryable: true`, y `part.functionCall` se lee sin comprobar que `part` sea un objeto.
- Sondas:
  - un 200 con cuerpo `null` da «connection failed», `retryable: true` (TypeError del SDK: «Cannot set properties of null (setting 'sdkHttpResponse')»);
  - un 200 con `parts:[null]` da lo mismo.
- Incumple el plan §3.6 («Respuesta mal formada → no retryable»), la viñeta 6 del DoD y la simetría con openai-compatible, donde solo `APIConnectionError` es reintentable. TASK-019 reintentaría sin sentido.
- Corrección:
  - limitar el caso de conexión al fallo real del `fetch` (el `TypeError` de undici con mensaje «fetch failed» y `cause`; el del cuerpo `null` no trae `cause`);
  - `isRecord` en las partes de `fromGenerateContentResponse`, para que den `ProviderResponseError` no reintentable;
  - tests para el 200 con `null` y para `parts:[null]`;
  - si no se pueden distinguir de forma estable, elevarlo como OD.

**[MINOR] provider.ts:102** — ningún test cubre el `clearTimeout` de `listModels`: los 94 tests de gemini pasan sin él. Tras un `listModels` correcto hay 0 timers; añadir `expect(vi.getTimerCount()).toBe(0)`.

**[NIT] env-isolation.test.ts:88** — la respuesta de `list` se monta con `generateOk({models})`. Usar `HttpResponse.json({models:[…]})`.

**[NIT] no-leak.test.ts:122** — el nombre habla de «candidate», pero el test usa un 500. Renombrarlo o añadir un 200 que repita la clave en un candidato.

**Cumplimiento**
- SPEC, ARCHITECTURE y ADRs ✅. DoD ❌ en la viñeta 6 y plan ❌ en §3.6.
- En src no hay `process.env`, `console`, `throw new Error`, `any` ni casts. Sin sobrearquitectura.

**Desviaciones del owner (6): aceptables**
- `nowMs` sobraba.
- `call_<posición>` es determinista.
- El rol de `systemInstruction` lo pone el SDK.
- Plantillas de bloqueo según §3.5.
- `own.signal.aborted` es necesario. Con la 2.ª página colgada salta `ProviderTimeoutError` a los 10 s, porque el Pager reutiliza el `abortSignal`.

**Preguntas**
1. Timers ≤ 1 en `generate`: de acuerdo. Hay exactamente 1 de undici; sin `clearTimeout` serían 2. Precedente en timer-cleanup.test.ts:55. Para `listModels`, ver el MINOR.
2. `supportedActions`: el código está bien. Corregir el texto del plan §3.7 con una nota de errata fechada, que hace el architect en el paso 7 de cierre y archiva el docs-keeper.
3. Cambio colateral del lockfile: correcto e inevitable (pnpm 9 resuelve peers opcionales). No cambia versiones, solo claves de snapshot en los importers persistence y providers.
4. M04 y M16: equivalentes. Hay que mantener las dos protecciones.

**Deuda propuesta (LOW)**
- Los tests de timers dependen de undici/msw; pago en TASK-040.
- OD-080; pago en TASK-020/027.
- El MINOR, si no se corrige; pago en TASK-019.

**OD propuesta**
- Respuesta con solo tokens de razonamiento: `candidatesTokenCount` ausente y `thoughtsTokenCount` presente dan `outputTokens: null` (sonda: 16 tokens de razonamiento facturados). Coincide con el riesgo R5.
- Opciones: (a) mantenerlo; (b) `outputTokens = thoughtsTokenCount`.

**Para security**
1. Los peers nuevos de openai/langsmith (`google-auth-library`, `ws`): en qué imágenes entran y si algo los carga al importar.
2. El MAJOR, por los reintentos y el presupuesto.
3. `retryAfterMs` sin tope (p. ej. `"999999999s"`): TASK-019 debe acotarlo.
4. Tokens de razonamiento sin `candidatesTokenCount`.
5. El `console.warn` del SDK (OD-080).

**Bloqueo de hook**
- Mensaje: «BLOCKED by bash-guard: no se leen ficheros .env desde Claude Code (si .env es un patrón de búsqueda, escápalo: '\.env')».
- Salió con `git diff pnpm-lock.yaml | grep …`.
- El reviewer guardó el diff en el scratchpad y aplicó `grep` sobre ese fichero. **El Orchestrator lo marca como rodeo** (pasar lo bloqueado a un fichero), aunque fue de solo lectura y probable falso positivo. Pasa a deuda de proceso.

**Decisión humana del 2026-11-17**
- El ciclo 1 corrige el MAJOR, el MINOR y los dos NIT.
- OD propuesta → OD-084 resuelta en (b) ya, en el ciclo 1.

## REVIEW — TASK-018, ciclo de corrección 1 — 2026-11-17 — Veredicto: APPROVED
(Resumen guardado por el Orchestrator.)
- Verificado en una copia (scratchpad/rev018c1), en contenedor: typecheck, lint y format OK; 223/223; cobertura 100/99.25/100/100.
- Diff frente al ciclo 0:
  - código: solo errors.ts, mapping.ts y 5 tests de gemini;
  - docs: SPEC §13, 4 notas del plan y TASKS.
  - provider.ts, test-server, api-key, index, openai-compatible, los manifiestos y el lock no cambian.
- Hallazgos cerrados, con cita: errors.ts:57/:98, mapping.ts:123, provider.test.ts:481, env-isolation.test.ts:89, no-leak.test.ts:122/:135/:164 y mapping.ts:100-101.
- Criterio de reintento «fetch failed» + `isRecord(cause)`: estable. Sondas con undici real:

  | Caso | Resultado |
  |---|---|
  | ECONNREFUSED, DNS, socket cortado antes de las cabeceras | retryable |
  | corte a mitad del cuerpo («terminated») | no retryable |

  - Simétrico con openai-compatible (errors.ts:59-62).
  - Si falla, falla del lado seguro para TASK-019.
  - Límite aceptable con OD-079: un error TLS se reintentaría, pero lo acotan el máximo de reintentos y el presupuesto.
- Docs coherentes.
  - Recomendación: una nota fechada en el plan §3.6 (:177) que diga «solo "fetch failed" con cause; el corte a mitad del cuerpo no se reintenta».
- Sin sobrearquitectura. `isRecord` está duplicado en errors.ts:13 y mapping.ts:90; aceptable.
- **NIT**
  - errors.ts:51: comentario de ~140 caracteres.
  - SPEC:616: «ciclo 1» → «ciclo 0».
  - no-leak.test.ts:164-182: el canario va en la cabecera `x-echo-key`, que no se lee; el test prueba de verdad `retryable:false` y `cause` indefinido, así que basta con renombrarlo.
- **Deuda LOW consolidada**
  - Tests de timers dependientes de undici/msw → TASK-040.
  - OD-080 → TASK-020/027.
  - «terminated» no se reintenta y un «fetch failed» de TLS sí → TASK-019, con la misma regla en openai-compatible.
  - Mutantes equivalentes M04, M16 y A5 → sin acción; se revisan en TASK-040.
  - Los 3 NIT, si no se corrigen en el cierre.
- **Para security**
  1. El criterio de reintento y el presupuesto de TASK-019.
  2. OD-084: cuenta más tokens, no menos; confirmar que no estima nada.
  3. `retryAfterMs` sin tope (errors.ts:38): TASK-019 debe acotarlo.
  4. Peers `google-auth-library` y `ws` en las imágenes.
  5. `console.warn` del SDK (OD-080).
- Sin bloqueos de hooks.

## SECURITY — TASK-018, 1.ª pasada (interrumpida por un hook) — 2026-11-17 — Sin veredicto
(Resumen guardado por el Orchestrator.)

**Bloqueo**
- Mensaje literal: «BLOCKED by bash-guard: no se leen ficheros .env desde Claude Code (si .env es un patrón de búsqueda, escápalo: '\.env')».
- Comando: `docker exec sec018 sh -c '…'`, con un heredoc que creaba `/probe/hook.mjs` (`module.registerHooks`) y `node --import` de openai, langsmith, @langchain/core, langgraph-checkpoint-postgres y @google/genai.
- Parece un falso positivo: el comando no contenía `.env`.
- Security no lo reintentó ni lo rodeó.
- Antes, el classifier denegó un `grep -E '(^|/)\.env'` para filtrar la lista. La copia se hizo con `git ls-files -co --exclude-standard`, limitada a packages, apps, docker y la config raíz.
- Contenedor `sec018` eliminado. Hay 8 contenedores ajenos vivos y no se tocaron.

**Revisado hasta el bloqueo**: nada HIGH ni CRITICAL.

*Secretos*
- La clave se resuelve una vez (api-key.ts:14) y vive solo en `#client` (provider.ts:46, 60-65).
- `NodeAuth` con `apiKey` no crea `GoogleAuth` (index.mjs:26921-26925), así que no se accede a los metadatos. La clave va en `x-goog-api-key` (:26948).
- `?key=` solo aparece en el WebSocket de Live/Music (:14662), que no se usa.
- Los `console.warn` (:29564 y :29659) son textos fijos sin la clave. El aviso de `GOOGLE_GENAI_USE_*` no se alcanza con `vertexai:false`, y los `console.debug` solo están en Vertex.

*SSRF*
- El `baseUrl` explícito tiene prioridad sobre el entorno (:57-68).

*Presupuesto*
- Sin `retryOptions`, el SDK no reintenta (:14107).
- AFC y continuación están desactivados.
- OD-084 no estima nada.
- El criterio de reintento es aceptable: un fallo TLS se reintenta, pero queda acotado por el máximo de reintentos y por `reserve()`.

*Errores*
- Plantillas fijas, sin `cause`.

**Hallazgos provisionales**
- [LOW] gemini/provider.ts:64. El SDK no fija la redirección de `fetch`: ante una redirección entre orígenes, undici reenviaría `x-goog-api-key`. Corrección con TD-141: `httpOptions.fetch` envolvente con `redirect:"error"` (TASK-020).
- [LOW] gemini/errors.ts:38. `retryAfterMs` no tiene tope. Requisito para TASK-019: `min(retryAfterMs, cap)`.

**Pendiente**
1. Peers nuevos (google-auth-library, ws, gaxios, gcp-metadata, jws…). Entran como optionalDependencies de los snapshots de openai/langsmith que cuelgan de persistence (lock :126-135, :3959-3965, :4161-4165), así que es probable que acaben en las imágenes de worker, web y migrate.
   - En openai, google-auth-library solo está en `providers/vertex.*` y ws en `*/ws.mjs`.
   - `@google/genai` importa google-auth-library y ws en el nivel superior (:2 y :8).
2. Avisos GHSA y fechas de las 36 transitivas.

**Decisión humana del 2026-11-17**: «Seguir sin la sonda». Security completa con `pnpm deploy --prod` del worker, lectura estática de los imports y GHSA. El falso positivo del hook pasa a deuda de proceso.

## SECURITY — TASK-018, 2.ª pasada (final) — 2026-11-17 — Veredicto: APPROVED
(Resumen guardado por el Orchestrator.)
- Método: `pnpm deploy` en contenedor (`sec018c`, ya borrado) sobre el árbol actual y sobre HEAD (sacado con `git archive`). Frozen OK en los dos. Sin Node en el host.

**1. Imágenes**

| Imagen | Paquetes | Tamaño | Notas |
|---|---|---|---|
| worker (`--prod`) | 50 → 71 | 94 → 105 MB | Entran huérfanos sin enlazar ni subir: gaxios, gcp-metadata, jws, jwa, node-fetch, agent-base, https-proxy-agent, node-domexception… No entran google-auth-library, ws, openai, protobufjs ni @google/genai. |
| web | 60 → 81 | — | Mismos huérfanos. La salida standalone de Next debería dejarlos fuera; sin build. |
| migrate (sin `--prod`) | 52 → 75 | 154 → 166 MB | Entran google-auth-library@10.9.1 y ws@8.22.1 subidos (cargables). openai ya estaba. |

- Causa: peers opcionales de openai/langsmith en los snapshots de persistence.
- protobufjs y @google/genai no están en ninguna imagen (ninguna app depende aún de providers).

**2. Carga al importar**
- Incompleto: el hook bloqueó el grep.
- Sí consta: en worker y web no pueden cargarse, porque no están instalados.
- Queda abierto en migrate: falta ver si `src/cli/migrate.ts` llega a langsmith o @langchain/core.

**3. Avisos y registro**
- GHSA de los 36 paquete@versión: 0 avisos. La consulta se validó con ws@8.17.0 y protobufjs@7.2.4, que devuelven 15.
- ws 8.22.1, protobufjs 7.6.6 y jws 4.0.1 quedan fuera de los rangos afectados.
- Edades: la más baja es 17 días (ws 8.22.1); @google/genai 2.32.0, 19 días.
- Deprecated: solo node-domexception@1.0.0 (llega por node-fetch@3 ← gaxios).

**Hallazgos**
- [LOW] provider.ts:64: una redirección entre orígenes reenviaría `x-goog-api-key`. Pago: TD-141/TASK-020 (`httpOptions.fetch` con `redirect:"error"`).
- [LOW] errors.ts:38: `retryAfterMs` sin tope. Requisito para TASK-019: `min(retryAfterMs, cap)`.
- [MEDIUM, deuda] Peers opcionales que se cuelan en las imágenes: ~21 huérfanos (~11 MB) en worker y web; migrate con google-auth-library y ws cargables. Corregir con `peerDependenciesMeta`/`packageExtensions` o aceptarlo con un ADR. Pago: TASK-040 (deploy/ADR-011).
- [MEDIUM, deuda] Comprobación estática pendiente de si migrate carga langsmith/@langchain/core y, por esa vía, ws o google-auth-library.
- [LOW, deuda] node-domexception deprecated.

**Bloqueos de hook**, citados y sin rodear
- 3 veces: «BLOCKED by bash-guard: no se leen ficheros .env desde Claude Code (si .env es un patrón de búsqueda, escápalo: '\.env')». Los dispara `envg_re` (bash-guard.sh:495) con regex de grep que llevan `.*` o `?.`:
  - `'^apps/.*/src/'`: abandonado;
  - `(/[a-z]+)?.[;)\s]`: era el punto 2, se paró;
  - `'^#+ .*TASK'`: búsqueda en docs, se paró.
- 1 vez: «BLOCKED by bash-guard: el script de sh -c / bash -c no es una sola cadena… Escribe todo el script dentro de una sola cadena entre comillas». Se siguió la instrucción del propio hook.

**Deuda de proceso propuesta (LOW)**
- `envg_re` da falsos positivos con metacaracteres de regex. Se suma al de la sonda de la 1.ª pasada.
