# TASK-004 — packages/core: esquemas Zod, errores tipados, env

| Campo | Valor |
|---|---|
| Tarea | TASK-004 · packages/core: esquemas Zod, errores tipados, env |
| Hito | M0 |
| Owner | core-dev (paso 0: devops) |
| Fecha | 2026-10-20 |
| Plan | `docs/reports/TASK-004-plan.md` (aprobado por el humano) |
| Ciclos de corrección | 1 (de 3) |

## Veredictos finales

| Rol | Ciclo | Veredicto |
|---|---|---|
| tester | 1 | PASS |
| reviewer | 1 | APPROVED |
| security | 1 | APPROVED (4 LOW, todos registrados en deuda o aceptados) |

## Decisiones humanas citadas (2026-10-20)

- **OD-009…OD-016**: "A Vitest en la raíz. Sí. / B Ids UUID (v7 si la librería lo da sin dependencia nueva; si no, v4 de crypto.randomUUID). Sí. / C Tipado mínimo de eventos con la tabla del plan. Sí. / D NO: se mantienen run.partial y run.resumed. Son 15 eventos, no 13 ... El architect corrige SPEC §8, no ARCHITECTURE. / E Tipos auxiliares mínimos para M1. Sí. / F ... con una condición: ningún campo opcional "por si acaso"; lo que M1 no use, fuera. / G Solo DATABASE_URL obligatoria; el resto con los valores por defecto de ARCHITECTURE y .env.example. Sí. LANGCHAIN_TRACING_V2 entra ya en env.ts con valor por defecto "false" ... / H Códigos de error e InvalidTransitionError en core. Sí."
- **Dependencias aprobadas**: "zod 4.6.7 en core; vitest 5.0.5, @vitest/coverage-v8 5.0.5 y vite 8.3.4 en la raíz (dev). Paso previo de devops con engines >=22.12 <23. Ampliación de scope aprobada tal como la propone el plan. 3. Plan aprobado."
- **OD-017**: "core exporta un `SecretResolver` (`(envName) => string | undefined`) construido en env.ts; los adaptadores lo reciben inyectado y nunca tocan process.env" + "(c) ... solo `^[A-Z][A-Z0-9_]*_API_KEY$` y además declarado en env.ts."
- **security REQUIRED en TASK-004**: "Sí, con security."
- **TASK-010**: "Un adaptador cuyo api_key_env no resuelve (nombre no permitido o variable vacía) lanza ProviderAuthError en la construcción, nunca en la primera llamada."
- **Deuda**: "TD-011 (loadEnv expone secretos → TASK-027) y TD-012 (URLs de Ollama/OTEL sin validar → TASK-020), ambas LOW. El test de que ningún valor de prueba aparece en errores va al DoD de TASK-010 ... Matiz a TD-011: hasta que se pague, regla para todos los devs en monorepo-conventions: el objeto de loadEnv() no se pasa entero a ningún logger ni se serializa; se leen campos sueltos."
- **OD-018**: "(a): .env.example son ejemplos; env.ts no fija valores por defecto para OLLAMA_BASE_URL, AGENTLAB_PROVIDER ni DATABASE_URL_TEST. Las credenciales de la base de pruebas no van en código. Si falta DATABASE_URL_TEST, los tests de integración fallan con mensaje claro, no se saltan."

## Ficheros

- **Creados**: `packages/core/tsconfig.config.json`, `packages/core/vitest.config.ts`, `packages/core/src/{run-status, errors, json-schema, provider-capabilities, budget, agent-invocation-result, agent-definition, team-definition, run-request, run-event, model-provider, tool, env}.ts`, `packages/core/src/{run-status, errors, schemas, run-event, contracts, env, index}.test.ts`.
- **Modificados**: `package.json` (raíz), `packages/core/package.json`, `pnpm-lock.yaml`, `packages/core/src/index.ts`, `packages/core/src/env.ts`, `packages/core/src/env.test.ts`, `packages/core/src/run-event.ts`, `packages/core/src/run-event.test.ts`, `packages/core/src/contracts.test.ts`.

## Comando de validación

```
docker run --rm -v "$PWD":/work -v agentlab-pnpm-store:/pnpm-store -e npm_config_store_dir=/pnpm-store -e TURBO_TELEMETRY_DISABLED=1 -w /work node:22 bash -c 'corepack enable && corepack prepare pnpm@9.15.9 --activate && rm -rf node_modules && pnpm install --frozen-lockfile && pnpm -r typecheck && pnpm -r lint && pnpm test && pnpm format:check'
```

## Versiones

- Node 22.23.2 (contenedor `node:22`), engines `>=22.12 <23`
- pnpm 9.15.9
- zod 4.6.7 (dependencia de `packages/core`)
- vitest 5.0.5, @vitest/coverage-v8 5.0.5, vite 8.3.4 (devDependencies de la raíz)

---

## PLAN — TASK-004 (resumen; completo en docs/reports/TASK-004-plan.md)

Validado fuera del repo (copia en scratchpad, node:22 22.23.2, pnpm 9.15.9). deps: zod 4.6.7 (core deps), vitest 5.0.5 + @vitest/coverage-v8 5.0.5 + vite 8.3.4 (raíz dev). Ampliación de scope: paso 0 devops (package.json raíz, packages/core/package.json, pnpm-lock.yaml); ARCH §9 por architect. Decisiones: tests en src/**/*.test.ts + tsconfig.config.json para vitest.config.ts (paga TD-010); test = vitest run --coverage con umbral 90 %; z.strictObject; AgentLabError abstracta + EnvValidationError; loadEnv(source = process.env); canTransition sobre tabla + isTerminalRunStatus; interfaces ARCH §3 literales con expectTypeOf; sin DEFAULT_BUDGET. Riesgos: Vitest 5 reciente; Node ≥22.12; zod duplicado con @langchain/core (TASK-013); claves en Env; process.env en TASK-010; z.uuid estricto. OD-A…H → OD-009…OD-016 resueltas por el humano; OD-017 SecretResolver (allowlist). Ajuste posterior: 15 eventos, ids v4 (Node 22 no tiene randomUUIDv7; zod solo valida v7), TeamDefinition sin coordination, run.completed sin status/partialReason, LANGCHAIN_TRACING_V2 default "false", createSecretResolver con allowlist.

## IMPLEMENTATION — TASK-004 (paso 0, devops)

Deps fijadas sin ^ y lockfile regenerado en node:22. Raíz: vitest 5.0.5, @vitest/coverage-v8 5.0.5, vite 8.3.4 (dev); packages/core: zod 4.6.7; engines.node ">=22.12 <23"; engines.pnpm y packageManager intactos; JSON editados con Edit. Modificados: package.json, packages/core/package.json, pnpm-lock.yaml. node -v v22.23.2; pnpm install exit 0 sin warn/peer/ERR; frozen-lockfile "Already up to date"; typecheck/lint OK 4/4; pnpm test 0 tareas exit 0; format:check OK; list --prod core → zod 4.6.7; Node 26 local falla por engines. Desviaciones/fuera de scope/deps/OD/deuda: ninguna.

## IMPLEMENTATION — TASK-004 (core-dev)

packages/core según el plan: contratos Zod (z.strictObject, z.uuid()), RunEventSchema 15 tipos, interfaces ModelProvider/Tool ARCH §3, errores tipados, canTransition/isTerminalRunStatus, loadEnv(source = process.env), createSecretResolver con allowlist OD-017 (solo OPENROUTER_API_KEY y GEMINI_API_KEY; cualquier otro → undefined sin lanzar ni revelar; "" también), LANGCHAIN_TRACING_V2 default "false", index.ts único export; sin DEFAULT_BUDGET, coordination ni generador de ids. Creados: tsconfig.config.json, vitest.config.ts; src/{run-status, errors, json-schema, provider-capabilities, budget, agent-invocation-result, agent-definition, team-definition, run-request, run-event, model-provider, tool, env}.ts; tests {run-status, errors, schemas, run-event, contracts, env, index}.test.ts. Modificados: package.json (typecheck con ambos tsc; test = vitest run --coverage), src/index.ts; rootDir intacto. node:22 frozen: typecheck OK, lint OK (no-dynamic-delete corregido), 149 tests, cobertura 100 % (index/model-provider/tool 0/0 por ser tipos), format OK, list --prod zod 4.6.7. Desviaciones: schemas.test.ts único; constructor protected (code, message, retryable, options); AgentLabErrorOptions; SecretResolver con allowlist por cambio de requisito. Fuera de scope: hooks bloquearon leer .env.example y tsconfig.base.json (no sorteado). Dudas: variables de EnvSchema del plan sin releer .env.example; OLLAMA_BASE_URL string no vacío; EnvValidationError guarda ZodError como cause.

## TEST — TASK-004 (ciclo 0)

node:22: install frozen sin warn/peer; typecheck/lint 4/4; 149 tests, cobertura 100 %; list --prod zod 4.6.7; umbral 90 % falla en copia (funciones 88.23 %). DoD 12/12 ✅: 15 eventos = SPEC §8; z.uuid() sin generador; EnvSchema ↔ .env.example sin discrepancias (12 + LANGCHAIN_TRACING_V2; defaults WORKER_CONCURRENCY 1, HEARTBEAT 15000, STALE 60000, SHUTDOWN_GRACE 30000, LOG_LEVEL info); SecretResolver con casos y canario; interfaces = ARCH §3.1/§3.2; 13 tests de errores; loadEnv falla nombrando DATABASE_URL; 49 transiciones = ARCH §5 (10 permitidas); zod 4.6.7 sin ^; rootDir intacto. Tests añadidos: ninguno. Observación: OLLAMA_BASE_URL string no vacío. Veredicto: PASS

## REVIEW — TASK-004 (ciclo 0)

- [MAJOR] env.test.ts:99-183 — falta test de inventario de la allowlist ({OPENROUTER_API_KEY, GEMINI_API_KEY}) y casos Gemini_API_KEY, OPENROUTER_API_KEYS, OPENROUTER_API_KEY_OLD, X_OPENROUTER_API_KEY, " GEMINI_API_KEY", "FOO\nGEMINI_API_KEY", DATABASE_URL_TEST; riesgo: una *_API_KEY futura sería resoluble sin fallo.
- [MINOR] env.ts:22-23 — OLLAMA_BASE_URL string vs OTEL z.url() (acepta file:/javascript:) → z.url({protocol:/^https?$/}).
- [MINOR] env.ts:13 — DATABASE_URL_TEST sin validar como postgres(ql).
- [NIT] errors.ts:22-28 firma de constructor distinta del plan (aceptable). [NIT] contracts.test.ts:61 aserción trivial. [NIT] arrays exportados mutables (Object.freeze opcional). [NIT] canTransition lanza TypeError con valor fuera de RunStatus (TASK-005 debe parsear con RunStatusSchema). [NIT] run-event.ts:37-38 used/max negativos.
Bien: ARCH §3/§5, SPEC §4.4/§4.5/§8, OD-014, process.env solo en env.ts, sin console/throw new Error/any/singletons, exports desde index.ts, zod exacto, rootDir y TD-010 pagada, docs coherentes. OD propuesta: valores de .env.example ¿defaults o ejemplos? (recomienda ejemplos). Deuda: TD URL si no se corrige → TASK-010. Security: sí (allowlist, ZodError cause, Env con claves, SSRF, cadena de suministro). Veredicto: CHANGES_REQUESTED.

## IMPLEMENTATION — TASK-004 (corrección 1/3)

[MAJOR] env.test.ts: test de inventario con Object.keys(EnvSchema.shape) y canario → resolubles exactamente {GEMINI_API_KEY, OPENROUTER_API_KEY}; test con los casos que faltaban. [MINOR] env.ts:11-12, 24-26 postgresUrl() y httpUrl() (z.url({protocol:/^https?$/})); OLLAMA_BASE_URL y OTEL httpUrl().optional(); tests http/https sí, file:/javascript:/ftp: no. [MINOR] env.ts:14 DATABASE_URL_TEST postgresUrl().optional(); tests. [NIT] contracts.test.ts solo expectTypeOf. [NIT] run-event.ts:37-38 nonnegative + 2 tests. Extra: EnvValidationError.cause sin canario (message, issues, JSON.stringify, stack). Sin cambios en defaults, errors.ts, Object.freeze ni canTransition. Modificados: env.ts, env.test.ts, run-event.ts, run-event.test.ts, contracts.test.ts. node:22: 156 tests, 100 %. En macOS vitest falla por binding nativo de rolldown (entorno). Desviaciones: ninguna.

## TEST — TASK-004 (ciclo 1)

node:22: install frozen sin warn/peer; typecheck/lint OK; 156 tests; 100 % (umbral 90 %); list --prod zod 4.6.7; mutación EXTRA_API_KEY en EnvSchema (copia, repo :ro) → falla el test de inventario. DoD 12/12 ✅ (+ ⚠️ OD de defaults de .env.example pendiente). Correcciones: MAJOR ✅ (verificado por mutación), MINOR httpUrl ✅, MINOR postgresUrl ✅, NIT ✅, extra cause ✅. Tests añadidos: ninguno. Veredicto: PASS

## REVIEW — TASK-004 (ciclo 1)

MAJOR → RESUELTO (env.test.ts:220-229 inventario; :231-245 casos límite). MINOR URLs → RESUELTO (env.ts:12,25-26; tests :94-112). MINOR DATABASE_URL_TEST → RESUELTO (env.ts:11,16; tests :114-125). NIT contracts → RESUELTO. NIT nonnegative → RESUELTO (run-event.ts:37-38; tests :86-87). Extra cause → válido (env.test.ts:127-146). NITs aceptados sin cambios. Regresiones: ninguna; process.env solo env.ts:42,59. Aviso: node_modules del contenedor no sirve en el host darwin. Cumplimiento: SPEC ✅ ARCH ✅ ADRs ✅ DoD ✅ plan ✅. Sobrearquitectura: ninguna. Deuda nueva: ninguna. Security: sí. Veredicto: APPROVED

## SECURITY — TASK-004

Vectores: secretos ✅ · inyección ✅ (RunRequest strictObject rechaza budget, schemas.test.ts:106) · SSRF ✅ (n/a M0/M1) · presupuesto ✅ · autoaprobación n/a · docker/ci n/a · garantías dev n/a · dependencias ✅.
Evidencia (copia en scratchpad, node:22): 14 nombres de bypass del SecretResolver (__proto__, constructor, toString, hasOwnProperty, minúsculas, ZWSP, \n, Ｏ ancho completo, espacio, DATABASE_URL, PATH, LANGCHAIN_API_KEY) con fuente propia y heredada → undefined; process.env solo env.ts:42/59. 8 casos de fuga en EnvValidationError (zod 4.6.7) → el canario no aparece en String(e), stack, util.inspect, JSON.stringify, cause.issues ni String(cause); issues sin input. pnpm audit --prod y pnpm audit: sin vulnerabilidades. Ningún paquete con pre/post/install scripts; producción de core solo zod 4.6.7. Sin patrones de secretos en tests/fixtures. 156/156, 100 %.
Hallazgos: [LOW] env.ts:42-50 Env con secretos enumerables (→ TD-011, TASK-027); [LOW] env.ts:11-12 httpUrl admite credenciales y cualquier host, postgresUrl laxa (→ TD-012, TASK-020); [LOW] env.ts:53-56 allowlist derivada de EnvSchema.shape (diseño OD-017; mantener test de inventario; sin deuda); [LOW] errors.ts:22-28 message/cause aportados por quien lanza: adaptadores no deben envolver errores con cabeceras/request (→ DoD de TASK-010 con test canario). OD defaults: solo DATABASE_URL_TEST tiene impacto; recomienda sin default. Veredicto: APPROVED

---

## Deuda registrada

- **TD-011** (LOW, introducida en TASK-004, OPEN): `loadEnv()` devuelve `Env` con `DATABASE_URL` (con contraseña) y `*_API_KEY` como propiedades enumerables. Se paga en TASK-027.
- **TD-012** (LOW, introducida en TASK-004, OPEN): `httpUrl()` (OLLAMA_BASE_URL, OTEL_EXPORTER_OTLP_ENDPOINT) admite credenciales embebidas y cualquier host; `postgresUrl()` es laxa. Se paga en TASK-020.
- Regla provisional para monorepo-conventions (TD-011): el objeto de `loadEnv()` no se pasa entero a ningún logger ni se serializa; se leen campos sueltos. Pendiente de aplicar por el humano (`.claude/skills/**` fuera del alcance de docs-keeper).

## OPEN DECISIONS registradas

- **OD-009 a OD-016**: resueltas por el humano (ver decisiones citadas).
- **OD-017** (SecretResolver con allowlist): resuelta por el humano.
- **OD-018** (defaults de `.env.example` frente a `env.ts`): resuelta por el humano (a): `env.ts` sin valores por defecto para `OLLAMA_BASE_URL`, `AGENTLAB_PROVIDER` ni `DATABASE_URL_TEST`.
- Sin OPEN DECISIONS pendientes de esta tarea.
