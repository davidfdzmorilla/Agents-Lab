# TASK-019 — ProviderRegistry, comprobación de capacidades y reintentos con backoff

| Campo | Valor |
|---|---|
| Tarea | TASK-019 · ProviderRegistry, comprobación de capacidades y reintentos con backoff |
| Hito | M1 |
| Owner | providers-dev |
| Fecha de cierre | 2026-11-19 (tomada del encargo de cierre; docs-keeper no tiene shell para ejecutar `date`) |
| Ciclos de corrección | 0 |
| Plan | `docs/reports/TASK-019-plan.md` (aprobado por el humano el 2026-11-18; OD-085 (b), OD-086 (a) y OD-087 (a)) |
| Veredicto TEST | PASS (323/323 en 18 ficheros, más los 2 tests de `retry-extra.test.ts` incluidos en esa cuenta; cobertura 100/99.36/100/100; también con `--network none`) |
| Veredicto REVIEW | APPROVED (ciclo 0) |
| Veredicto SECURITY | REQUIRED. APPROVED (ciclo 0) |
| Verificación del humano | `make test` y `make validate` en verde, 2026-11-19 |
| Estado final | DONE |
| CI | Pendiente del push del humano |

## Resumen

- `packages/providers` gana tres piezas sobre los adaptadores existentes, sin tocar `core` ni `ModelProvider`:
  - `ProviderRegistry` (clave `provider.id`, inmutable, sin DB) y `createProvider(config, { secretResolver })`, que construye `OpenAICompatibleProvider` o `GeminiProvider` según `config.type`.
  - `generateWithRetry`: comprueba capacidades antes de reservar y de la red, reintenta solo `AgentLabError` con `retryable: true`, aplica backoff con jitter o `retryAfterMs` con tope, y reserva una llamada de presupuesto por intento (OD-087 (a)).
  - `network-failure.ts`: lista blanca de códigos de red transitorios (OD-086 (a)), compartida por Gemini y openai-compatible (TD-165).
- OD-085 (b): si `retryAfterMs` supera `maxRetryAfterMs` (60 000 ms), no se reintenta y se relanza el error original (TD-161).
- Ninguna dependencia nueva. `package.json` y `pnpm-lock.yaml` sin cambios.
- Ciclo de corrección: ninguno.
- Deuda registrada: TD-170 a TD-177 (todas LOW). TD-143 ampliada. Pagadas en este cierre: TD-161, TD-165, TD-167 (TASK-019) y TD-175 (redacción del DoD, PAID en este cierre).
- TD-145 no se paga aquí; su pago queda solo en TASK-022.

## Ficheros

- Creados (`packages/providers/src/`): `network-failure.ts`, `network-failure.test.ts`, `registry.ts`, `registry.test.ts`, `retry.ts`, `retry.test.ts`, `retry-extra.test.ts` (tester, 2 tests de M11 y M13).
- Modificados (`packages/providers/src/`): `index.ts`, `index.test.ts`, `gemini/errors.ts`, `gemini/errors.test.ts`, `gemini/provider.test.ts`, `gemini/no-leak.test.ts`, `openai-compatible/errors.ts`, `openai-compatible/errors.test.ts`, `openai-compatible/provider.test.ts`.
- Sin cambios: `package.json`, `pnpm-lock.yaml`, `packages/core`, `packages/agents`, `apps/**`.
- Documentación de cierre: `docs/reports/TASK-019.md` (este), `docs/TASKS.md`, `docs/TECHNICAL_DEBT.md`.
- Documentación del architect en el cierre (no tocada por docs-keeper): `docs/ARCHITECTURE.md:143` (§3.3, OD-087 (a)); `docs/TECHNICAL_SPEC.md` §13 (OD-085 a OD-087 resueltas, `:625`).
- README raíz: sin cambios. No cambia ninguna instalación ni comando, y el README no menciona `packages/providers` (ya anotado en TASK-012 y TASK-018).

## Decisiones

- **OD-085 (b)** (SPEC §13, resuelta el 2026-11-18): `retryAfterMs` mayor que `maxRetryAfterMs` → no se reintenta y se relanza el error original con su `retryAfterMs`. Implementación: `retry.ts:124-130`.
- **OD-086 (a)** (SPEC §13, resuelta el 2026-11-18): lista blanca de códigos transitorios en la cadena `cause`, común a los dos adaptadores. El corte del cuerpo (`"terminated"`) se reintenta; TLS, `ENOTFOUND`, sin código o código desconocido no. Modifica OD-059. Implementación: `network-failure.ts`.
- **OD-087 (a)** (SPEC §13, resuelta el 2026-11-18): `generateWithRetry` reserva todos los intentos, el primero incluido; el orquestador no reserva llamadas a modelo. Frase añadida en `docs/ARCHITECTURE.md:143`.
- Desviación del owner, aceptada en el ciclo 0 del reviewer: Gemini conserva `isRecord(err.cause)` en `gemini/errors.ts`, de modo que un «fetch failed» sin `cause` sigue siendo «unexpected error». Queda como asimetría con openai-compatible, registrada como TD-172.
- Desviaciones menores del owner, aceptadas por el reviewer: `nowMs` no se pasa a `toGeminiProviderError`; el `id` de `FakeProvider` es `call_<posición>`; los tests de timers aceptan ≤ 1 timer pendiente (TD-163, mismo criterio que TASK-018).

## Deuda registrada y pagada

Aprobada por el humano el 2026-11-19 («Aprobar toda»). Origen de todas: TASK-019.

| TD | Severidad | Descripción | Pago |
|---|---|---|---|
| TD-170 | LOW | Política de reintentos sin techo (`packages/providers/src/retry.ts:49-64`, `:76` y `:89-90`): con `maxDelayMs` o `maxRetryAfterMs` mayores que 2 147 483 647, `setTimeout` dispara a 1 ms; `maxRetries` sin tope; `random` fuera de [0,1) produce esperas negativas o NaN. No explotable hoy. Corrección: techo en `resolvePolicy`, `maxRetries` ≤ 10 y `backoffMs` acotado a [0, `maxDelayMs`]. | TASK-013 |
| TD-171 | LOW | `packages/providers/src/registry.ts:56-71`: `createProvider` sin rama `default` con comprobación `never`; un `type` desconocido en ejecución devuelve `undefined` (SPEC §2.1). | TASK-020 |
| TD-172 | LOW | Asimetría ante errores sin `cause`: `openai-compatible/errors.ts:66` no exige `isRecord(cause)` en `TypeError("terminated")`; `gemini/errors.ts:56-62` sí. Un error sin `cause` da «connection failed» en uno y «unexpected error» en el otro; ambos `retryable: false`. | TASK-013 (ampliación de scope a providers) |
| TD-173 | LOW | Tests de retry: integrar `retry-extra.test.ts` en `retry.test.ts` y sustituir el caso de `retry.test.ts:537-551`, que no mata M13; NIT en `retry-extra.test.ts:56` (`import()` dinámico en lugar de estático); NIT en `retry.test.ts:241` (el título dice «uses Math.random» y el test no lo verifica). | TASK-013 |
| TD-174 | LOW | `packages/providers/src/network-failure.ts:28-33`: basta con que un eslabón cualquiera de la cadena `cause` esté en la lista blanca; debería decidir el primer eslabón con `code` string. Con undici no es alcanzable. | TASK-013 |
| TD-175 | LOW | Redacción del DoD de TASK-019: `onUnhandledRequest` debe ser `onUnhandledFrame` (msw 3.0.3); `n = 0` en el primer reintento. | PAID (TASK-019, redacción corregida en el cierre) |
| TD-176 | LOW | `CallBudget` sin `commit` (riesgo R1, ADR-005). | TASK-011 |
| TD-177 | LOW | `generateWithRetry` tiene que recibir siempre el `BudgetGuard` real y nunca un `reserve` vacío (security). | TASK-013 |

Ampliada: **TD-143** (OD-065, `ProviderResponseError` para configuración inválida). Dos usos nuevos: el constructor de `ProviderRegistry` (id vacío o repetido, `registry.ts`) y `resolvePolicy` (policy inválida, `retry.ts`). Pago sin cambios: TASK-020.

Pagadas en este cierre, con evidencia:
- **TD-161** (`gemini/errors.ts:38`, `retryAfterMs` sin tope): PAID (TASK-019; OD-085 (b), `retry.ts:124-130`).
- **TD-165** (criterio de reintento de red): PAID (TASK-019; OD-086 (a), `network-failure.ts`).
- **TD-167** (NIT de código): PAID (TASK-019; `gemini/errors.ts:54-55` y `no-leak.test.ts:165`).

Cambio de pago:
- **TD-145** (capacidades por modelo): no se paga en TASK-019. Su tarea de pago queda solo **TASK-022** (aprobado con el plan, D9).

Sin TD nueva en el ciclo de desarrollo más allá de TD-170 a TD-177.

## OPEN DECISIONS

- OD-085, OD-086 y OD-087: resueltas por el humano el 2026-11-18 (SPEC §13, `:625` y siguientes). Ver «Decisiones».
- OD-005 (modelo local por defecto para Ollama, `TECHNICAL_SPEC.md:337`): sigue abierta. Bloquea TASK-021; ver «Dependientes».
- Ninguna OPEN DECISIONS nueva en IMPLEMENTATION, TEST, REVIEW ni SECURITY.

## Dependientes desbloqueadas

- **TASK-020**: depende solo de TASK-019 → BLOCKED → READY.
- **TASK-021**: depende de TASK-019 y de OD-005. TASK-019 ya está DONE, pero OD-005 no está resuelta en SPEC §13, así que sigue BLOCKED.
- **TASK-013**: depende también de TASK-011, TASK-012, OD-074 y OD-075; sigue BLOCKED. Su DoD tiene viñetas para TD-177 (`generateWithRetry` con el `BudgetGuard` real) y para TD-170 (endurecimiento de la política en `retry.ts`). No tiene viñeta para TD-172, TD-173 ni TD-174: quedan como deuda con pago en TASK-013, sin viñeta en su DoD (ver «Discrepancias» en el informe de cierre).
- **TASK-011**: depende también de OD-002; sigue BLOCKED. Ya tiene la viñeta de TD-176.

## Bloqueos de hooks citados literalmente

Ninguno se rodeó.

1. security (ciclo único): «BLOCKED by bash-guard: no se leen ficheros .env desde Claude Code (si .env es un patrón de búsqueda, escápalo: '\.env')». La orden de copia al scratchpad llevaba un filtro que excluía `.env` sin escapar. Security paró sin rodearlo; sin sondas propias. Ver «Incidencias de proceso».

## Incidencias de proceso

- providers-dev lanzó dos `python3` en el host sin `-I -B`, con heredoc vacío. No afectaron al repo (confirmado por el tester). Dejó un `x.txt` vacío en el scratchpad.
- security no pudo hacer sondas propias: bash-guard bloqueó la copia al scratchpad (ver «Bloqueos de hooks»). Revisó con análisis estático y la sonda del reviewer.
- Ningún Node en el host; todo se ejecutó en contenedor.

Ambas incidencias se citan aquí y no se registran como deuda, porque el humano no lo ha pedido.

## Avisos

- `docs/reports/TASK-019-plan.md` contiene el plan íntegro. Este informe lo enlaza, siguiendo el precedente de TASK-018.
- Los archivos `docs/ARCHITECTURE.md` (`:143`) y `docs/TECHNICAL_SPEC.md` (`:625`) los modificó el architect en su paso de cierre, no docs-keeper.
- Sin CI: `make test` y `make validate` los ejecutó el humano el 2026-11-19.
- DoD 2 del plan usa `onUnhandledFrame`. La errata se corrigió en `docs/TASKS.md` antes de este cierre, junto con la viñeta nueva de TASK-011, las dos de TASK-013 y el `n = 0` del DoD 5.

---

## PLAN (architect)

Ver `docs/reports/TASK-019-plan.md` (íntegro en ese fichero; aprobado el 2026-11-18).

---

## IMPLEMENTATION — TASK-019 (providers-dev) — 2026-11-18

(Resumen guardado por el Orchestrator.)

**Ficheros** (packages/providers/src)
- Nuevos: network-failure.ts(+test), registry.ts(+test), retry.ts(+test).
- Modificados: index.ts(+test), gemini/errors.ts(+test), gemini/provider.test.ts, gemini/no-leak.test.ts, openai-compatible/errors.ts(+test), openai-compatible/provider.test.ts.
- Sin cambios en package.json, lockfile, core ni docs.

**DoD (fichero:línea)**
1. registry.ts:15-25 y :28-34.
2. registry.ts:52. msw con `onUnhandledFrame: "error"` (es la opción de msw 3), más `vi.spyOn(fetch)`.
3. retry.ts:107 (capacidades) antes de :109 (reserve).
4. retry.ts:114-122.
5. retry.ts:84-93 y :28 (valor por defecto congelado).
6. retry.ts:123-130; test con 999_999_999_000.
7. retry.ts:112-122; resolvePolicy :44-60; 11 políticas inválidas.
8. Reservas en :109 y :133, antes de sleep (:134); test de orden.
9. :108, :115, :68-81 y :135; fake timers (getTimerCount de 1 a 0).
10. network-failure.ts (12 códigos, 5 eslabones, protección contra ciclos); gemini/errors.ts:103; openai-compatible/errors.ts:62 y :68.
11. TD-167 pagado; no-leak.test.ts:165 renombrado.
12. 6 exports de valor y 4 de tipo.
13. En contenedor: typecheck, lint y format:check OK; 323/323 en 18 ficheros; cobertura 100/99.36/100/100.

**Desviaciones**
- Gemini conserva `isRecord(err.cause)`: un «fetch failed» sin cause sigue siendo «unexpected error», como pedía el MAJOR de TASK-018. El architect puede decidir lo contrario; sería un cambio de una línea.
- Los tests de `HttpResponse.error()` pasan a esperar `retryable: false` (OD-086 (a), R4 del plan).

**Deuda propuesta (LOW)**
- `ProviderResponseError` para configuración inválida (registry y política) → se suma a TD-143 (TASK-020).
- `CallBudget` sin `commit` → R1 (TASK-011).

**Hooks y procesos**
- Sin bloqueos de hooks.
- Incidencia de proceso: lanzó en el host dos `python3` con heredoc vacío, sin `-I -B`, que no tocaron el repo.
- Dejó un `x.txt` vacío en el scratchpad.
- Ningún Node en el host.

---

## TEST — TASK-019 (tester) — 2026-11-18 — Veredicto: PASS

(Resumen guardado por el Orchestrator.)

**Comandos** (en contenedor)
- Frozen, `-r typecheck`, `-r lint` y format OK.
- providers: 323/323 en 18 ficheros, cobertura 100/99.36/100/100. Con `--network none`: 323/323.
- core: 171/171. agents: 89/89.
- Sin cambios en manifiestos, lockfile, apps, core ni agents.
- Sin `process.env` ni `console` en src (la única aparición es un comentario en gemini/mapping.ts:104, previo).
- md5 de los 34 `.ts` del repo intacto.

**DoD**: ✅ 1-13.
- 1: registry.ts:15-35
- 2: :52-71 y registry.test.ts:119-214
- 3: retry.ts:107 y retry.test.ts:117
- 4: :114-122 y test :158, :174, :186
- 5: :28 y :84-91
- 6: :124-130 y test :254-306
- 7: :49-64 y test :322-395
- 8: :109 y :133-134, test :412-486
- 9: test :490-570
- 10: network-failure.ts:5-35, gemini/errors.ts:102-105 y openai-compatible/errors.ts:62 y :68
- 11: awk sin resultados; no-leak.test.ts:165
- 12: index.test.ts:9-17

**Mutación**
- ~45 mutaciones (M1-M15, W1-W9, T1-T8, R1-R4b): mueren todas.
- Sobrevivían M11 (un objeto no AgentLabError con `retryable: true` se reintentaba) y M13 (sin `throwIfAborted` tras `sleep`). Quedan muertas con los tests nuevos.
- R4 era un no-op y se sustituyó por R4b, que muere.

**Tests añadidos**
- packages/providers/src/retry-extra.test.ts, con 2 tests (M11 y M13). Pasa prettier, eslint y tsc. Es un fichero nuevo y tiene que entrar en el commit. La suite pasa a 325.

**Observaciones y deuda propuesta (LOW)**
- El DoD dice `onUnhandledRequest`; en msw 3 es `onUnhandledFrame`. Basta con corregir la redacción.
- `n` del backoff empieza en 0; conviene dejarlo explícito en la SPEC.
- Confirmado: dos `python3` sin `-I -B` y `x.txt` del implementer, sin efecto en el repo.

Sin bloqueos.

---

## REVIEW — TASK-019 (reviewer), ciclo 0 — 2026-11-18 — Veredicto: APPROVED

(Resumen guardado por el Orchestrator.)

Sin BLOCKER ni MAJOR. El repo queda intacto: las mismas 20 entradas en `git status`.

**MINOR**
1. **Asimetría ante errores sin `cause`.**
   - gemini/errors.ts:56-62 exige `isRecord(cause)`; openai-compatible/errors.ts:66 no lo comprueba en `TypeError("terminated")`.
   - Un error sin `cause` sale como «unexpected» en Gemini y como «connection failed» en openai-compatible. En los dos casos es `retryable:false`.
   - undici siempre pone `cause`.
   - La letra de OD-086 dice «fetch failed/terminated = connection failed».
   - Recomendación: exigir `isRecord(cause)` también en openai-compatible:66 (una línea), o que el architect precise OD-086.
2. **Desbordamiento de `setTimeout`.**
   - `resolvePolicy` (retry.ts:49-64) no limita `maxDelayMs` ni `maxRetryAfterMs`.
   - Por encima de 2 147 483 647 ms, Node dispara a 1 ms. Sonda: `retryAfterMs` 3e9 con `maxRetryAfterMs` 1e10 dio 2 llamadas en 1 ms.
   - Con `baseDelayMs: 0` y `retry ≥ 1024`, la espera sale NaN y también dispara a 1 ms.
   - Los valores por defecto son seguros.
   - Corrección: rechazar valores > 2 147 483 647 y, opcionalmente, poner tope a `maxRetries`.
3. **`createProvider` sin `default`** (registry.ts:56-71). Un `type` desconocido en ejecución devuelve `undefined`, contra SPEC §2.1. Corrección: `never` + `ProviderResponseError`. Puede ir a TASK-020.
4. **Test de abort tras sleep** (retry.test.ts:537-551). No mata M13, porque FakeProvider hace `throwIfAborted` antes de registrar la llamada; la mata retry-extra.test.ts:55-70. Corrección: integrar retry-extra en retry.test.ts y reemplazar :537.

**NIT**
- retry-extra.test.ts:56: `import()` dinámico; mejor un import estático.
- retry.test.ts:241: el título dice «uses Math.random», pero el test no lo verifica.
- retry.test.ts:379: `as unknown as number`, aceptado en test.
- Redacción del DoD:
  - en el 2, `onUnhandledFrame` (msw 3.0.3);
  - en el 5, «n = 0 en el primer reintento».

**Puntos revisados**
- La lista blanca coincide con D8 y OD-086. El límite de 5 eslabones y la protección contra ciclos están justificados (cadena real de 2-3).
- D5 es idéntico al plan: :107 → :108 → :109; OD-085 (b) en :128, antes de la reserva en :133; `throwIfAborted` en :135.
- **Doble descuento.**
  - Siempre un `reserve` por cada `generate`.
  - Los SDK no reintentan (oai `maxRetries:0`; Gemini sin `retryOptions`).
  - Solo hay reserva sin red en R3 y en el abort durante la espera, ambos aceptados.
  - R2 depende de la frase de ARCHITECTURE §3.3 en el cierre.
- Higiene correcta: sin `any`, `throw new Error`, `process.env` ni `console`; imports solo de core y locales.

**Sonda** (con undici real)
| Caso | Gemini | oai |
|---|---|---|
| Corte del cuerpo | true | true (3 hits, 3 reserves) |
| ECONNREFUSED | true | true |
| ENOTFOUND | false | false |
| Desbordamiento | 1 ms | — |

**Cumplimiento**: SPEC, ARCHITECTURE, ADR-003, ADR-005, DoD 1-13 y plan ✅.

**Deuda propuesta (LOW)**
- Techo de `setTimeout` y tope de `maxRetries` → próxima tarea de providers o TASK-013.
- `default` en `createProvider` → TASK-020.
- Simetría sin `cause` o precisión de OD-086.
- Integrar retry-extra.
- TD-143 ampliada (TASK-020).
- `CallBudget` sin `commit` (TASK-011).

**Para security**
- El desbordamiento del MINOR 2.
- «Cualquier eslabón de la lista blanca gana»: un TLS externo con un ECONNRESET interno se reintentaría.
- Un `CallBudget` vacío con `maxRetries` sin tope da llamadas ilimitadas.
- R6: el corte del cuerpo repite el coste.
- El `id` del proveedor aparece en el mensaje (registry.ts:22).

Sin bloqueos de hooks.

---

## SECURITY — TASK-019 — 2026-11-18 — Veredicto: APPROVED

(Resumen guardado por el Orchestrator.)
- Sin HIGH ni CRITICAL. Revisión estática más la sonda del reviewer. Las sondas propias no se pudieron hacer porque el hook bloqueó la copia.
- Vectores:
  - Secretos: OK. Sin `cause` adjunto, con plantillas fijas, canarios ficticios y `secretResolver` (registry.ts:63 y :69).
  - Inyección y autoaprobación: N/A.
  - SSRF: sin destinos nuevos.
  - Docker/CI: sin cambios.
  - Garantías: `scope` estrechado.
  - Dependencias: sin cambios.
  - Presupuesto: OK (retry.ts:109, :128, :133 antes de :134).
- [LOW] retry.ts:49-64, :76, :89-90. Desbordamiento de `setTimeout` (> 2 147 483 647 → 1 ms), `random` fuera de [0,1) y `maxRetries` sin tope. Hoy no es explotable: no hay llamador externo, los valores por defecto son seguros y todo queda reservado. Corrección: techo en `resolvePolicy`, `maxRetries` ≤ ~10 y acotar `backoffMs` a [0, `maxDelayMs`]. Pago: fix de providers antes de TASK-013 o dentro de TASK-013, antes de que la política salga de la configuración de usuario.
- [LOW] network-failure.ts:28-33. «Cualquier eslabón gana». No se alcanza con undici: el TLS es hoja, a profundidad 2. Opcional: que decida el primer eslabón con `code`. Misma tarea.
- Llamadas ilimitadas: basta `CallBudget` obligatorio (OD-087 a). Viñeta para TASK-011 y TASK-013: «`generateWithRetry` recibe siempre el `BudgetGuard` real».
- R6: aceptado. Doble descuento: no hay (oai `maxRetries` 0 en :65, :77, :103; Gemini sin `retryOptions`). R2 depende de ARCHITECTURE §3.3 en el cierre.
- `id` en el mensaje (registry.ts:22): aceptable según OD-057. Validar su formato si en TASK-020 viene del usuario.
- Asimetría sin `cause`: sin impacto. Ningún MINOR del reviewer sube a bloqueante.
- Bloqueo de hook, literal: «BLOCKED by bash-guard: no se leen ficheros .env desde Claude Code (si .env es un patrón de búsqueda, escápalo: '\.env')». Lo disparó la orden de copia al scratchpad, que llevaba un filtro que excluía `.env` sin escapar. Paró sin rodearlo.
