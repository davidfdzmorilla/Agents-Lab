# TASK-020 — GET /api/providers y selección por agente desde provider_configs

| Campo | Valor |
|---|---|
| Tarea | TASK-020 · `GET /api/providers` y selección por agente desde `provider_configs` |
| Hito | M2 (sección `## M2 — Modelos` de `docs/TASKS.md`; ver «Discrepancias») |
| Owner | web-dev (paso 0 de manifiesto y lockfile: devops; paso 1: core-dev; pasos 2 y 3: providers-dev; pasos 4 a 7: web-dev; cierre: architect y docs-keeper) |
| Fecha de cierre | 2026-11-23 (tomada del encargo de cierre; docs-keeper no tiene shell para ejecutar `date`) |
| Ciclos de corrección | 1 (MEDIUM de security: la clave aparecía en el `TypeError` del constructor de OpenAI; decisión humana del 2026-11-23: «Corregir ya, ciclo 1») |
| Plan | `docs/reports/TASK-020-plan.md` (aprobado por el humano el 2026-11-20; OD-088 (b), OD-089 (b), OD-090 (a), OD-091 (c), OD-092 (a) y OD-093 (a)) |
| Veredicto TEST | PASS (ciclo 0 y ciclo 1; providers 371/371, cobertura 100/99.39/100/100) |
| Veredicto REVIEW | APPROVED (ciclo 0, con 2 MINOR; ciclo 1, limitado al MEDIUM, APPROVED) |
| Veredicto SECURITY | REQUIRED. APPROVED (ciclo 0, con 1 MEDIUM y 4 LOW; ciclo 1, MEDIUM cerrado, APPROVED) |
| Verificación del humano | `make test` 6/6 paquetes en verde (providers 371, core 173, agents 89, persistence 112, worker 44, web 36) y `make validate` en verde (typecheck, lint, tests y format), 2026-11-23 |
| Estado final | DONE |
| CI | Pendiente del push del humano |

## Resumen

- `packages/providers` gana el sub-export `@agentlab/providers/presets`: tipos y presets congelados, `providerConfigFromRecord` (`base_url` ignorada) e `isProviderType`. El índice principal no se importa desde `web`.
- `packages/core` gana `ProviderConfigInvalidError` (`PROVIDER_CONFIG_INVALID`, `retryable: false`) y `httpUrl()` rechaza credenciales embebidas. TD-143 queda pagada.
- Endurecimiento de los adaptadores: `assertHttpUrl` (sin credenciales; sin `http:` con clave), `redirect: "error"` en OpenAI y `noRedirectFetch` en Gemini (TD-141), `Authorization` fijado de forma explícita por encima de `OPENAI_CUSTOM_HEADERS` (TD-142), y `new OpenAI` dentro de try/catch con mensaje fijo sin clave ni `cause` (ciclo 1).
- `apps/web` gana `GET /api/providers` (`force-dynamic`, `no-store`, sin `base_url` ni `api_key_env`, 500 fijo ante fallo de BD), `/projects` y `/projects/[id]` como Server Components de solo lectura. `web` no importa `openai` ni `@google/genai` y `compose.yaml` no pasa ninguna `*_API_KEY` a `web`.
- Única dependencia nueva: el enlace de workspace `@agentlab/providers` en `apps/web` (lockfile +3/−0). Ninguna dependencia externa.
- Ciclos de corrección: 1 (MEDIUM de security, cerrado en el ciclo 1 y verificado por REVIEW, TEST y SECURITY).
- Deuda registrada: TD-178 a TD-186 (todas LOW). TD-038 y TD-005 ampliadas. Pagadas en este cierre: TD-141, TD-142, TD-143 y TD-171. TD-012 con la parte 1 (credenciales) pagada, sigue OPEN.
- Dependientes: TASK-050 sigue BLOCKED (ADR-014 sigue Proposed). TASK-022 sigue BLOCKED (TASK-021 y TASK-050).

## Ficheros

- Creados, `packages/core`: ninguno. Modificados: `src/errors.ts`, `src/errors.test.ts`, `src/env.ts`, `src/env.test.ts`, `src/index.test.ts`.
- Creados, `packages/providers/src/`: `presets.ts` (+ `presets.test.ts`), `no-redirect-fetch.ts` (+ `no-redirect-fetch.test.ts`), `openai-compatible/hardening.test.ts`, `openai-compatible/url-credentials.test.ts` (tester, ciclo 0), `openai-compatible/client-build.test.ts` (ciclo 1), `gemini/hardening.test.ts`.
- Modificados, `packages/providers`: `package.json` (`exports["./presets"]`), `src/registry.ts` (+ test), `src/retry.ts` (+ test), `src/index.test.ts`, `src/openai-compatible/provider.ts` (+ test), `src/openai-compatible/test-server.ts`, `src/openai-compatible/timer-cleanup.test.ts`, `src/gemini/provider.ts`.
- Creados, `apps/web`: `src/server/db.ts`, `src/server/providers.ts`, `src/server/projects.ts`, `src/server/test-rows.ts`, `src/server/providers.test.ts`, `src/server/projects.test.ts`, `src/server/static.test.ts`, `src/server/projects.integration.test.ts`, `src/app/api/providers/route.ts`, `src/app/api/providers/route.integration.test.ts`, `src/app/api/providers/no-leak.integration.test.ts`, `src/app/(app)/projects/page.tsx`, `src/app/(app)/projects/[id]/page.tsx`.
- Modificados, `apps/web`: `package.json` (+1 línea: `"@agentlab/providers": "workspace:*"`), `next.config.ts` (`transpilePackages`).
- Modificados, raíz: `pnpm-lock.yaml` (+3/−0, solo el importer `apps/web`).
- Documentación: `docs/reports/TASK-020.md` (este), `docs/reports/TASK-020-plan.md` (plan íntegro, enlazado), `docs/TASKS.md`, `docs/TECHNICAL_DEBT.md`. El architect cerró `docs/ARCHITECTURE.md` (§2, §6, §7, §10 y las correcciones de §1 y §3.1) en su paso de cierre; docs-keeper no lo tocó.
- Sin cambios: `compose.yaml`, `Makefile`, `docker/`, `.github/`, `.githooks/`, `.claude/settings.json`, `docs/adr/**`, `docs/TECHNICAL_SPEC.md`, `packages/agents`, `packages/persistence`, `apps/worker`.
- README raíz: sin cambios (ver «Avisos»).

## Decisiones

- **OD-088 (b), OD-089 (b), OD-090 (a), OD-091 (c), OD-092 (a) y OD-093 (a)**: aprobadas por el humano el 2026-11-20 con el plan (`docs/reports/TASK-020-plan.md`). OD-090 (a) con las capacidades de la tabla D3 confirmadas. OD-093 (a) se ejecuta en TASK-050 (ADR-014, Proposed).
- Desviaciones del owner de providers, aceptadas en el ciclo 0 del reviewer: exports adicionales `GEMINI_CAPABILITIES` e `isProviderType` (API pública del sub-export, DoD 11 del architect); `BASE` de los tests pasa a https; `timer-cleanup.test.ts` en el caso de error acepta `≤1` timer (verificado por M7 en TEST); R3 documentado en comentario, sin test.
- Ciclo 1: el catch de `new OpenAI` lanza `ProviderConfigInvalidError` con plantilla fija (`id` del proveedor, sin `cause`, sin la clave). La regla 13 se cumple: con el `throw e` en el catch fallan los 4 tests de `client-build.test.ts`. El test 3 y el 4 se reformularon con un nombre de cabecera que no es token, porque una variable de entorno se trunca en el NUL; el SDK cita el nombre de la cabecera en el error (openai `headers.js:54-55`).
- Hallazgo adicional del ciclo 1: el nombre de la cabecera también filtraba el canario; la misma corrección lo cubre.

## Deuda registrada, ampliada y pagada

Aprobada por el humano el 2026-11-23 («Aprobar toda»). Todas LOW. Origen: TASK-020, salvo que se indique.

| TD | Severidad | Descripción | Pago |
|---|---|---|---|
| TD-178 | LOW | Tests de `web`: faltan tests de render de `/projects` y `/projects/[id]` (404 y marcas); `apps/web/vitest.config.ts` no tiene `globalSetup` de migración (los tests con BD dependen de que persistence migre antes); `static.test.ts` usa una lista fija (`files.length ≥ 5`). | TASK-014 |
| TD-179 | LOW | `apps/web/src/server/providers.ts:83-88`: (a) los `model_id` de agentes de otro proyecto que usan la configuración no salen en `models` (D2); (b) `provider_type` no se valida al escribir; debe usar `isProviderType`. | TASK-034 |
| TD-180 | LOW | Ollama: (a) el nombre `ollama` sin el perfil `local` (`packages/providers/src/presets.ts:44`): el DNS de Docker reenvía al resolver del host y los prompts irían en claro a un host de la LAN con ese nombre; (b) `OLLAMA_BASE_URL` no tiene consumidor. | TASK-050 / TASK-021 |
| TD-181 | LOW | `packages/providers/src/no-redirect-fetch.ts:9`: depende de `globalThis.fetch`. Si se envuelve (p. ej. OTel), hay que repetir el endurecimiento con la instrumentación, o se reabre TD-141. | TASK-027 |
| TD-182 | LOW | `packages/providers/src/api-key.ts:14`: validar la clave con `/^[\x21-\x7E]+$/` y lanzar `ProviderAuthError` con mensaje fijo. Una clave con caracteres de control falla tarde y con un error genérico. Viñeta ya añadida en el DoD de TASK-015. | TASK-015 |
| TD-183 | LOW | `packages/providers/src/openai-compatible/provider.ts:82`: el catch genérico atribuye a la clave o a las cabeceras cualquier fallo futuro del constructor del SDK. Solo afecta al diagnóstico. | Próxima subida de versión de `openai`: TASK-040 (ver «Discrepancias») |
| TD-184 | LOW | Timer residual de msw/undici: con `redirect:"error"`, `timer-cleanup.test.ts` tolera `≤1` timer pendiente. | TASK-022 |
| TD-185 | LOW | NIT de providers: (a) título de `timer-cleanup.test.ts:58`; (b) redacción del mensaje de `openai-compatible/provider.ts:84` («value» o «name»); (c) falta test con `\r` en el valor de `OPENAI_CUSTOM_HEADERS`. Viñeta ya añadida en el DoD de TASK-013. | TASK-013 |
| TD-186 | LOW | NIT de web: (a) falta el `<th>` «Issues» en `apps/web/src/app/(app)/projects/[id]/page.tsx:78-86`; (b) comentario de `apps/web/src/server/projects.ts:20`; (c) regex de `apps/web/src/server/static.test.ts:48` (no detecta `import()` dinámico ni `/testing`). | TASK-014 |

Ampliadas:
- **TD-038** (pago TASK-014): `apps/web/src/server/db.ts:14-17` (`withDatabase`) abre un pool por petición; las consultas no tienen `statement_timeout`, con riesgo de agotar `max_connections` desde peticiones sin autenticación; `listProviderViews` hace N+1 consultas y `loadEnv` se ejecuta en cada petición.
- **TD-005** (MEDIUM, pago TASK-014 para esta parte): lectura sin autenticación por DNS rebinding (R7) de `/api/providers` y `/projects`, que exponen ids, tipos, modelos y nombres, sin secretos. La severidad de la fila sigue MEDIUM porque la deuda original lo es; la parte añadida es LOW.

Cambios de pago decididos con el plan:
- **TD-018** → TASK-050 (antes: TASK-020).
- **TD-012** → TASK-050 (allowlist de host) y TASK-037 (`postgresUrl()`).
- **TD-164** → solo TASK-027 (antes: TASK-020 / TASK-027).

Pagadas en este cierre (`PAID`), con evidencia del informe de security (ciclo 0, líneas vigentes tras el ciclo 1):
- **TD-141**: `provider.ts:37-38` y `:77` (antes `:74`); `gemini/provider.ts:57`. Corrección: `assertHttpUrl` sin credenciales y `redirect: "error"` / `noRedirectFetch`.
- **TD-142**: `provider.ts:79` (antes `:76`): `Authorization` explícito, por encima de `OPENAI_CUSTOM_HEADERS`.
- **TD-143**: core `errors.ts:78`; `retry.ts:61`; `registry.ts` (lanzadores en :18, :21 y :75).
- **TD-171**: `registry.ts:74` (`config satisfies never`) con `ProviderConfigInvalidError` en :75.

Parte pagada, sigue OPEN:
- **TD-012**: parte 1 (credenciales embebidas) PAID en `packages/core/src/env.ts:19` (`refine` de `httpUrl()` con `hasNoEmbeddedCredentials`). Resto con pago en TASK-050 y TASK-037.

## OPEN DECISIONS

- OD-088 (b), OD-089 (b), OD-090 (a), OD-091 (c), OD-092 (a) y OD-093 (a): resueltas por el humano el 2026-11-20 (plan). Ver «Decisiones».
- Ninguna OPEN DECISIONS nueva en IMPLEMENTATION, TEST, REVIEW ni SECURITY.
- Quedan abiertas en la deuda: R7 (lectura sin autenticación, TD-005), `ollama` sin perfil (TD-180), `api-key` (TD-182), TD-183 y el resto de TD-178 a TD-186.

## Dependientes

Revisión de dependencias sobre `docs/TASKS.md` (búsqueda de `TASK-020` en todas las cabeceras «Depende de»):

- **TASK-050** (`Depende de`: TASK-020, ADR-014 Accepted): TASK-020 pasa a DONE; ADR-014 sigue Proposed. **Sigue BLOCKED.** Su texto no se ha tocado; el motivo se actualiza en la cabecera «Tareas READY».
- **TASK-022** (`Depende de`: TASK-020, TASK-021, TASK-050): TASK-021 sigue BLOCKED por OD-005 y TASK-050 sigue BLOCKED. **Sigue BLOCKED.**
- **TASK-021** (`Depende de`: TASK-019, OD-005): no depende de TASK-020. Sigue BLOCKED por OD-005.
- Ninguna tarea pasa a READY con este cierre.

## Bloqueos de hooks citados literalmente

Ninguno se rodeó. Los bloqueos siguen citados en cada informe:

1. core-dev (paso 1): `sed -i.bak` fuera del scope; pasó a Edit. `rm -f` sobre un fichero de entorno, con el mensaje «no se leen ficheros .env…»; no hacía falta. `mkdir w` relativo dentro del contenedor; pasó a ruta absoluta.
2. providers-dev (pasos 2-3): «escritura por shell en 'src/openai-compatible/provider.ts' fuera del scope…» (un `sed -i` dentro del contenedor); siguió con Edit. Un `grep --include` dio un falso positivo «.env» y se reescribió.
3. web-dev (pasos 4-7): `mkdir -p` sobre `(app)/projects/[id]`; se resolvió con Write.
4. tester (ciclo 0): `grep -v '^.env$'` → «no se leen ficheros .env»; se rehízo sin el patrón. Escritura de `run1.sh` → Write. `mkdir -p cp` → se usó el montaje.
5. tester (ciclo 1): `> out4.txt` con ruta relativa; se repitió con ruta absoluta, que el hook acepta.
6. reviewer (ciclo 0): «BLOCKED by bash-guard: no se leen ficheros .env desde Claude Code (si .env es un patrón de búsqueda, escápalo: '\.env')», al lanzar `git diff -- pnpm-lock.yaml` y `git diff` de SPEC filtrado por OD. Paró sin rodearlo; el +3 del lockfile se verificó con devops y el tester.
7. reviewer (ciclo 1): sin bloqueos.
8. security (ciclos 0 y 1): sin bloqueos.

## Incidencias de proceso

- **providers-dev, paso 3**: reescribió la parte final de `presets.ts` con `python3 -I -B` en línea en vez de Edit. Lo declaró él mismo y el hook no lo bloqueó. El reviewer lo leyó entero y es correcto.
- **architect, cierre**: usó `sed -i` sobre `docs/ARCHITECTURE.md`, dentro del scope de la tarea.
- **Ciclo 1, store de pnpm**: el store estaba incompleto. El clasificador denegó un `pnpm fetch` con red y providers-dev no lo rodeó. El store se rellenó con el `make test` del humano.
- **tester (ciclo 0)**: creó y borró un fichero `dummy-never-used` fuera del scratchpad. El Orchestrator comprobó que ya no existe.

Estas incidencias se citan aquí y no se registran como deuda.

## Discrepancias

1. **Hito.** TASKS.md sitúa TASK-020 y TASK-019 bajo `## M2 — Modelos` (líneas 404 y siguientes), y TD-012 y TD-018 dicen «M2» para TASK-020. La cabecera de TASKS.md dice «Hito actual M1» y el informe de TASK-019 dice «Hito M1». No se ha cambiado nada. Lo tiene que confirmar el Orchestrator.
2. **TD-183 y su tarea de pago.** El pago aprobado es «la próxima subida de versión de `openai`», que no es una tarea de `TASKS.md`. Regla 1 de `TECHNICAL_DEBT.md`: debe tener tarea. Se asigna TASK-040 («al subir `openai`»), por el precedente de TD-146. Pendiente de confirmar por el Orchestrator.
3. **Líneas tras el ciclo 1.** El informe de security (ciclo 0) cita `provider.ts:74` y `:76`. El ciclo 1 añadió el try/catch y desplazó 3 líneas. En disco hoy: `:77` (`fetchOptions: { redirect: "error" }`) y `:79` (`Authorization`). Las filas de TD usan las líneas actuales.
4. **TD-005 severidad.** La deuda aprobada para TD-005 es LOW, pero la fila original es MEDIUM. Se mantiene MEDIUM en la fila; la parte añadida es LOW.
5. **TASK-015 sin dependencia declarada.** Su DoD usa `providerConfigFromRecord` de `@agentlab/providers/presets` (TASK-020), pero su «Depende de» es TASK-008 y TASK-013. No se modifica: no es la tarea que se cierra. Se propone al Orchestrator añadir TASK-020 a sus dependencias.
6. **Motivo de TASK-050.** La instrucción de cierre pide «actualizar el motivo». Su texto propio no se modifica (solo BLOCKED→READY puede cambiarlo). Se actualiza el motivo en la cabecera «Tareas READY», que es donde aparece.
7. **Tests con BD.** TASK-020 tiene viñetas 6 a 8 con tests de integración contra PostgreSQL. El tester no los ejecutó: los ejecutó el humano con `make test` (web 36/36). El informe de TEST lo indica como ⚠️.
8. **Hallazgos que no se han tocado.** Los NIT y MINOR de REVIEW del ciclo 0 que no entraron en el ciclo 1 quedan en TD-178 a TD-186 (MINOR de web: `withDatabase` y modelos de otro proyecto, en TD-038 y TD-179).

## Avisos

- `docs/reports/TASK-020-plan.md` contiene el plan íntegro. Este informe lo enlaza.
- `docs/ARCHITECTURE.md` (§2, §6, §7, §10 y las correcciones de §1:16 y §3.1:73) lo modificó el architect en el cierre, no docs-keeper. `docs/adr/**` y `docs/TECHNICAL_SPEC.md` no se han tocado.
- README raíz: sin cambios. Ninguna instalación ni comando cambia (`make test` y `make validate` siguen igual). La única mención a la API es `GET /api/health` (línea 52), que sigue siendo cierta. El comentario del árbol (`README.md:14`, «UI y API (GET /api/health)») sigue siendo válido, aunque no lista `/api/providers` ni `/projects`; no se ha tocado porque la estructura de directorios no cambia.
- Sin CI: `make test` y `make validate` los ejecutó el humano el 2026-11-23.

---

## PLAN (architect)

Ver `docs/reports/TASK-020-plan.md` (íntegro en ese fichero; aprobado el 2026-11-20).

---

## IMPLEMENTATION — TASK-020 (por pasos) — Resumen guardado por el Orchestrator

### Paso 0 · devops · 2026-11-21
- `apps/web/package.json`: añadida `"@agentlab/providers": "workspace:*"` en `dependencies`, tras `@agentlab/persistence`.
- `pnpm-lock.yaml`: +3/−0, solo en el importer `apps/web` (`link:../../packages/providers`). Ninguna versión externa cambia.
- Comprobado en contenedor:
  - `install --lockfile-only --ignore-scripts`: OK.
  - `--frozen-lockfile --ignore-scripts`: en verde.
  - `pnpm why`: enlace confirmado.
- Sin desviaciones, deuda ni bloqueos.

### Paso 1 · core-dev · 2026-11-21
- errors.ts:10 añade el código `PROVIDER_CONFIG_INVALID`.
- errors.ts:76-80 añade `ProviderConfigInvalidError`, con `retryable: false`.
- Tests: fila nueva en errors.test.ts; index.test.ts fija el export. `index.ts` usa `export *` y no se ha tocado.
- env.ts:
  - nuevo `hasNoEmbeddedCredentials`, con `URL.canParse`;
  - `httpUrl()` usa `.refine` con el mensaje fijo «must not contain embedded credentials»;
  - se aplica a `OLLAMA_BASE_URL` y `OTEL_EXPORTER_OTLP_ENDPOINT`.
- env.test.ts prueba `user:CANARY@`, `user@` y `:CANARY@`. Ni el mensaje ni `cause` contienen el canario.
- Resultados en contenedor:
  - `-r typecheck` en verde en 6 paquetes;
  - lint y format OK;
  - core 173/173, con cobertura de errors.ts y env.ts al 100 %.
- Bloqueos de bash-guard, citados y sin rodear:
  - (1) `sed -i.bak` fuera del scope. Pasó a Edit.
  - (2) `rm -f` sobre un fichero de entorno: «no se leen ficheros .env…». No hacía falta.
  - (3) `mkdir w` relativo dentro del contenedor. Pasó a ruta absoluta en el /tmp del contenedor.
- Nota para el paso 3: `assertHttpUrl` de providers necesita su propio rechazo de credenciales (TD-141 L1).

### Pasos 2-3 · providers-dev · 2026-11-21
- Ficheros nuevos en src:
  - presets.ts(+test)
  - no-redirect-fetch.ts(+test)
  - openai-compatible/hardening.test.ts
  - gemini/hardening.test.ts
- Ficheros modificados:
  - package.json (`exports["./presets"]`)
  - registry.ts(+test)
  - retry.ts(+test)
  - index.test.ts
  - openai-compatible/provider.ts(+test), test-server.ts (`BASE` pasa a https) y timer-cleanup.test.ts
  - gemini/provider.ts
- **DoD 1 (`ProviderConfigInvalidError`).** Lo lanzan:
  - `assertHttpUrl` (openai-compatible/provider.ts:33 y :41);
  - registry.ts:18 y :21;
  - retry.ts:61;
  - el `default` de `createProvider` (registry.ts:75, con `satisfies never`);
  - presets.ts:80-84.
  - Los tests se han migrado y hay un test nuevo para un type desconocido, con canario.
- **DoD 2 (`assertHttpUrl`, provider.ts:33-44).** Rechaza usuario y contraseña en la URL, y `http:` cuando hay clave. `http:` sin clave sigue permitido (Ollama).
- **DoD 3 (redirecciones).**
  - openai: `redirect:"error"` (provider.ts:74).
  - Gemini: `httpOptions.fetch` con `noRedirectFetch` (gemini/provider.ts:57).
  - Tests con 301, 302, 307 y 308, también en `listModels`. Comprueban 1 petición al origen y 0 al destino (con `http.all`), «connection failed», `retryable:false` y `cause` indefinido.
- **DoD 4.** provider.ts:75-77 fija `Authorization` de forma explícita, o `null` si no hay clave. Test con un `Bearer attacker` en el entorno. Una cabecera ajena sigue pasando (OD-064).
- **DoD 5.**
  - presets.ts:10, :52 y :96, todo congelado.
  - `base_url` se ignora (test con 169.254.169.254).
  - `requireKey`/`requireNoKey` (:86-94).
  - Capacidades D3 con igualdad exacta.
  - Test estático de imports (solo core y `import type` de registry).
  - `GeminiProvider.capabilities === GEMINI_CAPABILITIES`.
- **Regla 13.** De 3 mutaciones, fallan 15 tests. Antes, un handler `http.post` dejaba pasar 301/302; se pasó a `http.all`.
- **Resultados en contenedor.** typecheck, lint y prettier OK. 366/366 en 23 ficheros. Cobertura 100/99.39/100/100.
- **Desviaciones.**
  - Exports adicionales: `GEMINI_CAPABILITIES` e `isProviderType`.
  - `BASE` de los tests pasa a https.
  - timer-cleanup.test.ts en el caso de error: `toBe(0)` pasa a `≤1`, porque msw/undici deja un timer con `redirect:"error"`. **Sin verificar con una mutación de `clearTimeout`**: lo tienen que comprobar el tester o el reviewer.
  - R3 queda documentado en un comentario, sin test.
- **Incidencias de proceso.**
  - **Rodeo declarado:** reescribió la parte final de presets.ts con un `python3 -I -B` en línea en vez de Edit. El hook no lo bloqueó. Revisado en disco.
  - Bloqueo de bash-guard, citado: «escritura por shell en 'src/openai-compatible/provider.ts' fuera del scope…» (un `sed -i` dentro del contenedor). Siguió con Edit.
  - Un `grep --include` dio un falso positivo «.env» y lo reescribió de otra forma.
- **Deuda propuesta (LOW).**
  - El timer de msw tras un fallo con `redirect:"error"`.
  - `GEMINI_CAPABILITIES` e `isProviderType` quedan como API pública del sub-export.

### Pasos 4-7 · web-dev · 2026-11-21

**Ficheros** (en apps/web)
- Nuevos:
  - src/server: db.ts, providers.ts, projects.ts, test-rows.ts.
  - Tests sin BD: providers.test.ts, projects.test.ts, static.test.ts.
  - Tests con BD: projects.integration.test.ts, app/api/providers/route.integration.test.ts y no-leak.integration.test.ts.
  - app/api/providers/route.ts y app/(app)/projects/page.tsx y [id]/page.tsx.
- Modificado: next.config.ts (`transpilePackages` + `@agentlab/providers`).

**DoD**
- **6.**
  - route.ts:4: `force-dynamic`.
  - providers.ts:28 y :94: `no-store`.
  - :70: capacidades del preset.
  - :34-39: modelos, con `default_model` y los de los agentes, sin duplicados.
  - :51-61: fila inválida.
  - :96-99: 500 fijo.
- **7.**
  - no-leak.integration.test.ts: canarios, todos los caminos, incluida la BD caída con canario en `DATABASE_URL`.
  - static.test.ts: sin `process.env` ni `SecretResolver`.
- **8.**
  - Páginas: `listProjectSummaries` (projects.ts:96) y [id] con `notFound()` (:27).
  - Marcas: projects.ts:47-67.
  - Tests: `buildProjectView` 5 unitarios; el test estático comprueba que no hay "use client" ni "use server", ni escrituras.
- **9.**
  - `next build`: sin `openai` ni `@google/genai` en standalone ni en server.
  - Test estático: no se importa el índice ni los SDK.
  - Pendiente del reviewer: citar `compose.yaml` y el lockfile.
- **10.** Typecheck, lint y `prettier --check apps/web` OK; 19 tests sin BD en verde; `next build` OK con una `DATABASE_URL` ficticia.

**Pendiente: los tests con BD no se ejecutaron.** Son projects.integration, route.integration y no-leak.integration, y se ejecutan con `make test` del humano. Tampoco se corrió `--coverage` completo ni `format:check` de la raíz.

**Desviaciones:** test-rows.ts; `listProjectSummaries`; `withDatabase` (`max 1`, 2 s, cierre en finally).

**Fuera de scope:** apps/web/vitest.config.ts no tiene `globalSetup`, así que los tests de integración dependen de que antes migre persistence (igual que /api/health).

**Bloqueo:** `mkdir -p` sobre `(app)/projects/[id]`, citado. Se resolvió con Write.

**Deuda propuesta**
- N+1 consultas y un pool por petición; `loadEnv` en cada petición. Amplían TD-038 y se pagan en TASK-014.
- La marca de configuración de otro proyecto solo muestra el id (LOW, TASK-034).
- `provider_type` en escritura debe pasar por `isProviderType`.

### Ciclo de corrección 1 · providers-dev · 2026-11-23 · COMPLETO

**Corrección**
- openai-compatible/provider.ts: `new OpenAI` va dentro de try/catch (`} catch {` en :82).
- El catch lanza `ProviderConfigInvalidError` con plantilla fija: el `id` del proveedor, sin `cause` y sin la clave.

**Tests nuevos** (openai-compatible/client-build.test.ts, 4 tests)
1. Clave con CR/LF.
2. Clave con NUL (entra por el resolver).
3. Nombre de cabecera inválido en `OPENAI_CUSTOM_HEADERS`, con canario.
4. El mismo caso que el 3, sin clave.

En `make test` del humano fallaron los tests 3 y 4. La causa estaba en el propio test: una variable de entorno se trunca en el NUL. Se reformularon con un nombre que no es token (`"CANARY-xyz bad: v"`). El SDK cita ese nombre en el error (openai headers.js:54-55; el parseo está en client.js:257-261 y :263).

Hallazgo adicional: esto también filtraba el canario a través del nombre de la cabecera. La misma corrección lo cubre.

**Regla 13**
- Con el catch cambiado por `throw e`, los 4 tests fallan.
- Después se revirtió el cambio.

**Verificación** (en contenedor, `--network none`)
- `-r typecheck`, lint y `format:check`: OK. `format:check` pasó tras un arreglo de Prettier.
- providers: 371/371, cobertura 100/99.39/100/100.
- Sin bloqueos.

---

## TEST — TASK-020 (tester) — 2026-11-21 — Veredicto: PASS

(Resumen guardado por el Orchestrator.)

**Comandos en contenedor**
- Instalación frozen, `-r typecheck`, `-r lint` y `format:check` en la raíz: OK.
- providers con `--network none`: 366/366, cobertura 100/99.39.
- core: 173/173.
- web sin BD: 19/19.
- `next build`: OK, rutas en ƒ. Ni en standalone ni en server hay openai ni genai. Las 3 coincidencias de texto son falsos positivos: el package.json de providers, el override de ws y la instrumentación OTel de Next.

**Tests con BD:** no los ejecutó; se cita el resultado del humano (`make test` 6/6, web 36; `make validate` exit 0).

**Comprobaciones de repo**
- Lockfile: +3, solo en `apps/web`.
- `compose.yaml` sin cambios. `*_API_KEY` solo en worker (:84-85); web (:54-58) no tiene ninguna.
- Sin `process.env` ni `console` en src nuevo.
- md5 idéntico salvo el test añadido.

**DoD**
- ✅ 1-5, 9 y 10.
- ⚠️ 6, 7 y 8: los tests con BD los ejecutó el humano y el tester solo los leyó.
- N/A 11.
- Evidencias:
  - 1: lanzadores en provider.ts:33 y :41, registry.ts:18, :21 y :75, retry.ts:61 y presets.ts:80-84.
  - 3: hardening.test (4 códigos × 2 adaptadores).
  - 4: M3 muerta.
  - 5: presets.test.
  - 7: no-leak.integration y static.test (M12 muerta).
  - 8: muertas M11, M13 y M14 de `buildProjectView`.

**Mutaciones**
- Muertas: M1, M2, M2b, M3, M4a, M4c, M5a, M5b, M6a, M6b, M7, M9, M10, M11, M12, M13 y M14.
- **M7 (sin `clearTimeout`) la mata `timer-cleanup` en éxito y en error, así que la rebaja a ≤1 queda verificada.**
- M4b (solo contraseña, `https://:pw@`) sobrevivía. Era un hueco del DoD 2 y lo mata el test añadido.
- No se mutaron `retryable`, los lanzadores de registry y retry ni la congelación.

**Test añadido**
- packages/providers/src/openai-compatible/url-credentials.test.ts: la suite pasa a 367.

**Huecos (no bloquean)**
1. Faltan tests de render de las páginas: 404 y marcas.
2. no-leak no cubre una fila cuyo `api_key_env` apunta a un nombre sin canario. Basta para la viñeta.
3. Los tests de web dependen de que persistence migre antes, porque no hay `globalSetup`.

**Problemas**
- Cobertura de web sin BD: 45 %.
- `static.test` depende de una lista fija (`files.length ≥ 5`).

**Deuda LOW propuesta**
- Tests de render de las páginas (TASK-014).
- El timer residual de msw.
- Una pasada de mutación sobre `retryable` y los lanzadores de registry y retry.

**Bloqueos citados**
- `grep -v '^.env$'` → «no se leen ficheros .env»; se rehízo sin el patrón.
- Escritura de run1.sh → se pasó a Write.
- `mkdir -p cp` → se usó el montaje.

**Incidencia**
- Fichero `dummy-never-used` creado fuera del scratchpad y borrado con `rm -f`. El Orchestrator comprobó que ya no existe.

## TEST — TASK-020, ciclo 1 — 2026-11-23 — Veredicto: PASS

**Ejecución en contenedor** (`--network none`, store offline)
- typecheck, lint y format:check en la raíz: OK.
- providers: 371/371, cobertura 100/99.39/100/100.
- core: 173/173.
- web sin BD: 19/19.
- `next build`: OK, sin SDK en standalone.
- Tests con BD: se cita el resultado del humano.
- md5 del repo intacto.

**MEDIUM cerrado** (provider.ts:82-83)
- Muertas: C1, C1b, C2 (`cause`) y C3 (`String(e)`), con 4/4 de client-build en cada una.
- Re-muertas: M1, M2, M2b, M3, M4b y M7.
- Ninguna sobrevive.

**DoD**
- ✅ 1-5, 9 y 10.
- ⚠️ 6-8: tests con BD ejecutados por el humano.
- N/A 11.

**Tests añadidos y bloqueos**
- Sin tests añadidos.
- Bloqueo: `> out4.txt` con ruta relativa. Se repitió con ruta absoluta, que el hook acepta.

---

## REVIEW — TASK-020 (reviewer), ciclo 0 — 2026-11-21 — Veredicto: APPROVED

(Resumen guardado por el Orchestrator.)

Sin BLOCKER ni MAJOR. Lectura completa del diff y de los SDK en el scratchpad; sin sondas.

**MINOR**
1. **apps/web/src/server/providers.ts:83-88.** A `toProviderView` solo le llegan los agentes del mismo proyecto. Si un agente de otro proyecto usa la configuración, su `model_id` no sale en `models`, y D2 dice que debería. El integration test lo confirma: el agente de fuera no aparece. Corrección: recoger los agentes de todos los proyectos, o dejarlo como deuda para TASK-034.
2. **apps/web/src/server/db.ts:14-17.** `withDatabase` solo pone plazo a la conexión; la consulta no tiene plazo, y el plan pedía 2 s como en /api/health. Corregirlo exige tocar `createPool` de persistence, y D7 no lo permite. Deuda para TASK-014, junto con TD-038.

**NIT**
- timer-cleanup.test.ts:58: el título ya no es cierto con `≤1`.
- [id]/page.tsx:78-86: hay 5 `<th>` para 6 `<td>`; falta «Issues».
- projects.ts:20: el comentario no cubre el caso de configuración inválida.
- static.test.ts:48: no detecta un `import()` dinámico ni `/testing`.
- presets.ts:24: `GEMINI_CAPABILITIES` es API pública extra. El architect debe listarla en ARCHITECTURE §2 (DoD 11).

**Puntos revisados**
- Las desviaciones de providers-dev y de web-dev son aceptables.
- R3: el `signal` del adaptador llega al `fetch` (genai index.mjs:14075 y :14078; `patchHttpOptions` :13922-13923), y lo cubre el test de timeout.
- `Authorization` explícito: correcto en openai 7.45.1 (client.js:263, :1415-1416; headers.js:57-63, con `null` que borra y minúsculas).
- R1: el índice no entra; solo `/presets` (server/providers.ts:18).
- El contrato §4 se cumple (providers.ts:39-44, :100-104, :32; route.ts:4).
- Las pantallas se cumplen ([id]/page.tsx:27, projects.ts:56).
- Huecos del tester: ninguno es MAJOR. El no-leak con `api_key_env` sin canario ya lo cubre el unitario.
- url-credentials.test.ts es válido.
- Higiene limpia; dirección web → providers/presets → core.
- DoD 9: compose.yaml:54-57 (web solo tiene `DATABASE_URL`, `LOG_LEVEL` y `LANGCHAIN_TRACING_V2`), sin `env_file`; las `*_API_KEY` solo están en worker (:84-85).

**Cumplimiento:** SPEC, ARCHITECTURE, ADR, DoD 1-10 y plan ✅ (salvo los dos MINOR). El diff de SPEC §13 no se leyó (ver bloqueo); se contrastó con el plan y con TASKS.md.

**Deuda propuesta (LOW)**
- Plazo de consulta en `withDatabase` → TASK-014.
- Modelos de agentes de otro proyecto → TASK-034.
- Tests de render de las páginas → TASK-014 o TASK-034.
- `globalSetup` en los tests de web → TASK-014.
- Timer residual de msw → TASK-022.
- Más los LOW que ya prevé el plan en §7.

**Para security**
- `OPENAI_CUSTOM_HEADERS` sigue inyectando las cabeceras que no son `Authorization`.
- `noRedirectFetch` depende del `globalThis.fetch`.
- R7: DNS rebinding.
- El preset de Ollama usa http y no lleva clave.
- El `id` del proveedor aparece en los mensajes.

**Bloqueo (literal):** «BLOCKED by bash-guard: no se leen ficheros .env desde Claude Code (si .env es un patrón de búsqueda, escápalo: '\.env')», al lanzar `git diff -- pnpm-lock.yaml` y `git diff` de SPEC filtrado por OD. Paró sin rodearlo. Para el +3 del lockfile se apoyó en devops y en el tester.

**Proceso:** leyó entero presets.ts, que providers-dev había escrito con `python3`, y es correcto.

## REVIEW — TASK-020, ciclo 1 (limitado al MEDIUM) — 2026-11-23 — Veredicto: APPROVED

Sin BLOCKER, MAJOR ni MINOR.

**NIT**
- provider.ts:84 y :65-66: el mensaje y el comentario hablan del «value», pero los tests 3 y 4 fallan por el nombre de la cabecera (headers.js:54-55). Corregir la redacción.
- client-build.test.ts:41-62: no hay caso para un `\r` en el valor de `OPENAI_CUSTOM_HEADERS` (client.js:257-261). Lo cubre el catch y añadir el test es opcional.

**Comprobado**
- **Alcance:** solo `new OpenAI` (:67-81). `assertHttpUrl` (:53) y `resolveApiKey` (:57) quedan fuera del try.
- **Mensaje:** plantilla fija con el `id`; `catch {` sin variable.
- **Tests:** cubren el vector. La explicación del owner (NUL en el env; nombre de cabecera citado en headers.js:54-55, regex :6) es correcta, y el hallazgo adicional es real.
- **Regresiones:** ninguna (hardening.test.ts:106-123; errors.ts:97).

**Cumplimiento:** ✅
**Deuda:** ninguna.

**Para security**
- Decidir si hace falta la validación opcional en `resolveApiKey`.
- El caso del `\r` en el valor no tiene test.

Sin bloqueos.

---

## SECURITY — TASK-020 — 2026-11-21 — Veredicto: APPROVED

(Resumen guardado por el Orchestrator.)

**Método**
- Lectura del plan, de los 3 informes y del diff completo.
- SDK revisados:
  - openai (client.js :254-264, :1386-1387, :1398-1418; headers.js :48-72);
  - genai (index.mjs :13895-13963, :14070).
- Sondas sobre una copia (scratchpad/sec020) en contenedor `--network none`. Las 5 suites de hardening dan 35/35.
- Sin bloqueos.

**[MEDIUM] regresión del arreglo de TD-142** (openai-compatible/provider.ts:76, en `new OpenAI` :65)
- Qué pasa: con `OPENAI_CUSTOM_HEADERS` definida, el SDK construye las cabeceras en el constructor (`buildHeaders([parsed, defaultHeaders])`). Si la clave lleva CR/LF o NUL, undici lanza un `TypeError` crudo con la clave dentro. Ese error sale de `createProvider` sin pasar por `toProviderError`.
- Sonda:
  - `CTOR TypeError: Headers.append: "Bearer CANARYa\r\nb" is an invalid header value.` LEAK=true
  - Con NUL, igual.
- Sin fuga en estos casos:
  - el código de HEAD;
  - sin `OPENAI_CUSTOM_HEADERS`;
  - Gemini.
- Por qué no bloquea:
  - hacen falta dos fallos del operador a la vez;
  - compose no pasa la variable (:75-88);
  - hoy no hay consumidor (TASK-015 está BLOCKED);
  - web no construye adaptadores.
- Impacto: la clave saldría en los logs del worker o en el error de una ejecución.
- Corrección:
  - envolver `new OpenAI` en try/catch y lanzar `ProviderConfigInvalidError` con mensaje fijo y sin `cause`;
  - opcional: validar `/^[\x21-\x7E]+$/` en `resolveApiKey` (api-key.ts:14) y lanzar `ProviderAuthError` fijo.
- Test: `vi.stubEnv("OPENAI_CUSTOM_HEADERS","X-A: b")` con la clave `"CANARY\r\nx"`; el canario no debe aparecer.
- Pago: tarea fix o viñeta en el DoD de TASK-015, antes del primer consumidor.

**[LOW] R7, sin autenticación** (providers.ts:78-91 y [id]/page.tsx:92)
- Un DNS rebinding puede leer ids, tipos, modelos y nombres. No hay secretos.
- La enumeración global es así por diseño (OD-092 a).
- No hay escrituras. Sin CORS no hay lectura cross-origin.
- Pago: TD-005 → TASK-014 (`Host`/`Origin`).

**[LOW] pool por petición y consultas sin plazo** (db.ts:14-17)
- El MINOR 2 del reviewer no sube de severidad.
- Riesgo: agotar `max_connections` y dejar sin conexiones al worker, solo disponibilidad. Lo acotan 127.0.0.1, `max 1`, 2 s de conexión y que son SELECT simples.
- Pago: ampliar TD-038 → TASK-014.

**[LOW] preset de Ollama** (presets.ts:44)
- URL constante y nunca recibe clave (`requireNoKey` :91-94; `Authorization: null` :76).
- Riesgo sin verificar: sin el perfil `local`, el DNS de Docker reenvía `ollama` al resolver del host, y los prompts irían en claro a un host de la LAN con ese nombre.
- Pago: TASK-050 (falla cerrado); que TASK-021 lo documente.

**[LOW] `noRedirectFetch` depende de `globalThis.fetch`** (no-redirect-fetch.ts:9)
- Un envoltorio de `fetch` que pierda `redirect` reabriría TD-141.
- Pago: nota para TASK-027 (OTel), con hardening repetido con la instrumentación.

**Puntos**
- No fuga: `toProviderView` :35-76; catch :100-104 fijo, sin log; RSC solo con `Link` (href, className, nombre); pg no incluye la contraseña en el log.
- SSRF: `providerConfigFromRecord` no lee `baseUrl` (:96-127); `isProviderType` usa `.some`, así que `__proto__` no pasa.
- Redirecciones: ningún camino las sigue (oai client.js:1386, sin paginación; genai `request` con `patchedHttpOptions.fetch`, sin `retryOptions`).
- Cabeceras: correctas. El resto de `OPENAI_CUSTOM_HEADERS` es aceptable (OD-064 a).
- Claves en web:
  - compose:54-57, sin `env_file`;
  - `.dockerignore` deja fuera `**/.env*`;
  - web.Dockerfile sin ARG;
  - sin cambios en compose, docker, Makefile ni .github.
- Deuda: TD-141, TD-142, TD-143 y TD-171 pagadas. TD-012 con la parte 1 pagada; queda OPEN con pago en TASK-050 y TASK-037.
- Dependencias:
  - diff del lockfile: solo `68a69,71`, el workspace link en apps/web;
  - package.json de web, +1 línea;
  - sin dependencias externas.
- Garantías: task-scope solo se estrecha; `.githooks` y `settings.json` sin cambios.

**Verificados (fichero:línea):**
- provider.ts:37, :38, :74, :76
- gemini/provider.ts:57
- core errors.ts:78
- retry.ts:61
- registry.ts:74
- env.ts:19

**Deuda propuesta:** el MEDIUM (fix o TASK-015) y los 4 LOW de arriba.

## SECURITY — TASK-020, ciclo 1 — 2026-11-23 — Veredicto: APPROVED

El MEDIUM queda cerrado. Las sondas se hicieron en contenedor con `--network none` y comprueban `util.inspect`, `String`, `JSON` y `console`.

**Sondas: ningún canario sale (LEAK=false en todas)**
- Construcción con `OPENAI_CUSTOM_HEADERS` (A1-A4): clave con CRLF, NUL, CR o €. Todas dan `ProviderConfigInvalidError` fijo y sin `cause`.
- A5: una clave válida construye el cliente (sin regresión).
- B1-B4: CR en el valor de una cabecera y nombre inválido, con clave y sin ella. Todas dan `ProviderConfigInvalidError` fijo.
- Sin `OPENAI_CUSTOM_HEADERS`, al hacer la petición (C1-C3, en gen y list): `ProviderResponseError` fijo.
- Gemini (G1-G3): `ProviderResponseError` fijo.
- `console`: 0 llamadas.
- Suites: client-build 4, hardening de oai 8, hardening de gemini 5 y no-leak de gemini 14; en total 31/31.

**Respuestas a los puntos**
- Validar la clave en `resolveApiKey` no hace falta para la confidencialidad. Solo daría un diagnóstico más temprano: queda como LOW opcional.
- El alcance del catch es correcto. Los demás `throw` del SDK 7.45.1 no se alcanzan con las opciones fijadas (data-residency.js:15-26) y el código falla en cerrado.
- No se abre nada nuevo. Sin cambios en dependencias ni en `.githooks`/`settings`; `task-scope` solo cambia `updated_at`.

**LOW**
1. api-key.ts:14: una clave con caracteres de control falla tarde y con un error genérico. Arreglo opcional: validar con `/^[\x21-\x7E]+$/` y devolver `ProviderAuthError` fijo. Pago: un fix o el DoD de TASK-015.
2. provider.ts:82: el catch vacío atribuye cualquier fallo futuro del SDK a la clave o a las cabeceras. Solo afecta al diagnóstico. Revisarlo en la próxima subida de versión de `openai`.

**Hallazgos verificados**
- provider.ts:82-84.
- client-build.test.ts:55.

Sin bloqueos.
