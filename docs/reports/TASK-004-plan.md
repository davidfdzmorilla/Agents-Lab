# PLAN — TASK-004 · packages/core: esquemas Zod, errores tipados, env

| Campo | Valor |
|---|---|
| Tarea | TASK-004 (M0) · owner de implementación: core-dev |
| Autor del plan | architect |
| Fecha | 2026-10-20 |
| Estado | **Aprobado (2026-10-20)** con las decisiones humanas de abajo; ajustado por architect el mismo día |

## Decisiones humanas (2026-10-20)

> "1. Las 8 OPEN DECISIONS, decididas: A Vitest en la raíz. Sí. B Ids UUID (v7 si la librería lo da sin dependencia nueva; si no, v4 de crypto.randomUUID). Sí. C Tipado mínimo de eventos con la tabla del plan. Sí. D NO: se mantienen run.partial y run.resumed. Son 15 eventos, no 13; run.partial es estado terminal propio (SPEC §6) y run.resumed lo exige la recuperación de M3 (ARCHITECTURE §4). El architect corrige SPEC §8, no ARCHITECTURE. E Tipos auxiliares mínimos para M1. Sí. F Propuesta concreta del plan para AgentDefinition, TeamDefinition, RunRequest y Budget. Sí, con una condición: ningún campo opcional "por si acaso"; lo que M1 no use, fuera. G Solo DATABASE_URL obligatoria; el resto con los valores por defecto de ARCHITECTURE y .env.example. Sí. LANGCHAIN_TRACING_V2 entra ya en env.ts con valor por defecto "false" (viene de la DoD de TASK-013). H Códigos de error e InvalidTransitionError en core. Sí.
> 2. Dependencias aprobadas: zod 4.6.7 en core; vitest 5.0.5, @vitest/coverage-v8 5.0.5 y vite 8.3.4 en la raíz (dev). Paso previo de devops con engines >=22.12 <23. Ampliación de scope aprobada tal como la propone el plan.
> 3. Plan aprobado."
>
> "Sobre TASK-010 y process.env: decidido ahora para no volver. core exporta un `SecretResolver` (`(envName) => string | undefined`) construido en env.ts; los adaptadores lo reciben inyectado y nunca tocan process.env."
>
> "(c), con la precisión de mi mensaje anterior: solo `^[A-Z][A-Z0-9_]*_API_KEY$` y además declarado en env.ts. (b) es una lista negra y falla por omisión: cualquier variable no declarada (PATH, HOME, las de LangSmith, las del sistema) seguiría siendo legible. (a) descartada. Actualiza OD-017 como resuelta con eso."

| OD del plan | Registro en SPEC §13 | Decisión | Efecto en este plan |
|---|---|---|---|
| OD-A | OD-009 | Vitest en la raíz | Paso 0 (devops) con `engines.node` `>=22.12 <23` |
| OD-B | OD-010 | UUID; v7 solo si sale gratis, si no v4 | **v4** (evidencia abajo); validación `z.uuid()` |
| OD-C | OD-011 | Payload tipado mínimo | Tabla de 15 payloads en Contratos |
| OD-D | OD-012 | **No** a la recomendación: 15 eventos | `run.partial` y `run.resumed` en `RUN_EVENT_TYPES`; SPEC §8 corregida; ARCH §4 intacta |
| OD-E | OD-013 | Tipos auxiliares mínimos | Sin cambios |
| OD-F | OD-014 | Propuesta, sin opcionales "por si acaso" | Fuera `TeamDefinition.coordination` y `run.completed.{status, partialReason?}` (ver Esquemas) |
| OD-G | OD-015 | Solo `DATABASE_URL` obligatoria | `LANGCHAIN_TRACING_V2` con defecto `"false"` |
| OD-H | OD-016 | Códigos e `InvalidTransitionError` en core | Sin cambios |
| — | OD-017 | `SecretResolver` en core; solo `^[A-Z][A-Z0-9_]*_API_KEY$` **y** declarado en `EnvSchema` | `createSecretResolver` en `env.ts` con allowlist (decisión 12) |

OD-008 no existe a propósito (se citó en sesión como "no abierta"; no se reutiliza). SPEC §8 y §13 y ARCHITECTURE §9 ya están actualizadas en este encargo; el antiguo paso 11 queda hecho.

**Evidencia OD-010 (UUID v7)**, verificado el 2026-10-20 fuera del repo (regla 11) en Docker `node:22` (v22.23.2) y sobre el tarball `zod-4.6.7.tgz` de npm, en el scratchpad: `typeof require("node:crypto").randomUUIDv7` → `undefined`; la única función UUID de `node:crypto` es `randomUUID` (v4). En zod 4.6.7, `uuidv7` (`v4/classic/schemas.js:390`) es solo un **esquema validador**; no hay generador. Conclusión: **v4 vía `crypto.randomUUID()`** (y `gen_random_uuid()`, v4, como `default` de PostgreSQL 16 en ARCH §6).

## Contexto

`packages/core` hoy solo tiene `export {};`, un `package.json` con `typecheck`/`lint` y un `tsconfig.json` con `rootDir: src` + `include: ["src"]` (TASK-001). La tarea crea los contratos de los que dependen TASK-005 (persistence: `RunStatus`, `canTransition`, eventos, `InvalidTransitionError`), TASK-010 (providers: `ModelProvider`, errores de proveedor, capacidades, `SecretResolver`), TASK-011 (policies: `Budget`, `BudgetExceededError`), TASK-012 (agents: `AgentDefinition`, `TeamDefinition`) y TASK-013 (orchestrator: `LANGCHAIN_TRACING_V2` ya validada aquí con defecto `"false"`). Es la primera tarea con tests: introduce Vitest en el monorepo y paga TD-010 en `core`.

## Validación hecha fuera del repo (DEVELOPMENT_WORKFLOW §3 regla 11)

Copia mínima del monorepo (configs raíz + `packages/core`) en el scratchpad de la sesión, fuera del repo, ejecutada en Docker `node:22` (v22.23.2), pnpm 9.15.9, store en volumen con nombre `agentlab-pnpm-store`, `TURBO_TELEMETRY_DISABLED=1`. Nada se instaló ni escribió en el repo.

| Comprobación | Resultado |
|---|---|
| `pnpm install` con `vitest 5.0.5`, `@vitest/coverage-v8 5.0.5`, `vite 8.3.4` (raíz, dev) y `zod 4.6.7` (core) | +148 paquetes, exit 0, **sin avisos de peers** |
| `pnpm -r typecheck` (tests `*.test.ts` dentro de `src`, `rootDir: src` intacto) | exit 0 |
| `tsconfig` con `include: ["src", "vitest.config.ts"]` | **TS6059** (`vitest.config.ts` no está bajo `rootDir`) → descartado |
| `tsconfig.config.json` aparte (`include: ["vitest.config.ts"]`, sin `rootDir`) | `tsc -p` exit 0 |
| `pnpm -r lint` (`eslint .` también sobre `vitest.config.ts`) | exit 0 |
| `pnpm test` → turbo → `vitest run --coverage` (v8) | 54 tests OK; con reporter `json-summary` desaparece el `WARNING no output files` de turbo (`outputs: coverage/**`) |
| Umbral 90 % con un fichero no importado y sin tests | exit 1 (`ERROR: Coverage for lines (76%) does not meet global threshold (90%)`): los ficheros no importados cuentan |
| Ficheros solo de tipos / barrel | 0/0 sentencias: no penalizan la cobertura |
| `loadEnv({ DATABASE_URL: "<valor inválido con un canario>" })` con `z.prettifyError` | Mensaje `✖ Invalid URL → at DATABASE_URL`; **el valor no aparece** |
| `z.strictObject` con clave `budget` extra | `unrecognized_keys` (rechazo, no descarte silencioso) |
| `z.toJSONSchema`, `z.iso.datetime`, `z.uuid`, `z.prettifyError`, `z.discriminatedUnion` en zod 4.6.7 | disponibles |
| UUID v7 sin dependencia nueva (2026-10-20, ajuste) | No: Node 22.23.2 sin `crypto.randomUUIDv7`; zod 4.6.7 solo valida v7. `z.uuid()` acepta un v4 de `crypto.randomUUID()` y también un v7 (migración futura sin cambiar contratos) |

Versiones consultadas con `npm view` el 2026-10-20:

| Paquete | Versión | Publicada | Notas |
|---|---|---|---|
| `zod` | 4.6.7 (`latest`) | 2026-10-12 | Sin dependencias; ESM. Cumple `^3.25.32 \|\| ^4.2.0` (peer de `@langchain/langgraph` 1.5.1) y `^3.25.76 \|\| ^4` (dependencia de `@langchain/core` 1.2.18), reverificados hoy |
| `vitest` | 5.0.5 (`latest`) | 2026-10-15 | engines `^22.12.0 \|\| ^24 \|\| >=26`; peer **no opcional** `vite ^6.4 \|\| ^7 \|\| ^8`; peer opcional `@types/node ^22` (22.20.5 ✅) |
| `@vitest/coverage-v8` | 5.0.5 | 2026-10-15 | peer `vitest 5.0.5` exacto |
| `vite` | 8.3.4 (`latest`) | 2026-10-08 | engines `^20.19 \|\| >=22.12`; peer opcional `esbuild ^0.27 \|\| ^0.28` (compatible con el `tsx` de ADR-009) |
| `vitest` 4.x (alternativa) | 4.1.12 (`V4`) | 2026-10-15 | Trae `vite` como dependencia (no peer); engines `^20 \|\| ^22 \|\| >=24` |

Guía de migración a Vitest 5 (https://vitest.dev/guide/migration, consultada 2026-10-20, sin fecha en la página): Vite pasa a peer; Node ≥ 22.12; `coverage.include` relativo a la raíz del proyecto; ya no busca la config en directorios padre.

## Dependencias (`deps_allowed`, aprobadas 2026-10-20)

| Paquete | Versión exacta | Dónde | Tipo | Motivo |
|---|---|---|---|---|
| `zod` | `4.6.7` | `packages/core` | `dependencies` | Única dependencia de runtime de core (DoD). Zod 4 frente a 3.25.x: `z.toJSONSchema` nativo (SPEC §4.4: `outputSchema` "JSON Schema derivado de Zod") sin añadir `zod-to-json-schema`; `z.prettifyError` para `loadEnv` |
| `vitest` | `5.0.5` | raíz | `devDependencies` | Runner de SPEC §3 |
| `@vitest/coverage-v8` | `5.0.5` | raíz | `devDependencies` | Cobertura v8 (testing-conventions §7) |
| `vite` | `8.3.4` | raíz | `devDependencies` | Peer obligatorio de Vitest 5; declararlo explícitamente evita que lo fije `auto-install-peers` sin control |

Raíz frente a `packages/core`: decidido raíz (OD-A → OD-009).

## Ampliación de scope (aprobada 2026-10-20)

El scope literal (`packages/core/**`) no basta: instalar cualquier dependencia reescribe `pnpm-lock.yaml`.

| Ruta fuera de `packages/core/**` | Por qué | Quién (role-guard) |
|---|---|---|
| `package.json` (raíz) | `devDependencies`: `vitest`, `@vitest/coverage-v8`, `vite`; `engines.node` → `>=22.12 <23` | devops |
| `packages/core/package.json` | `dependencies.zod` (solo esa clave; los `scripts` los toca core-dev en el paso 1) | devops |
| `pnpm-lock.yaml` | Lo regenera `pnpm add`/`pnpm install` (nunca a mano) | devops |
| `docs/ARCHITECTURE.md` §9 | Filas `zod`, `vitest`, `@vitest/coverage-v8`, `vite` y `engines` del Node | architect — **hecho** (2026-10-20, este ajuste) |

No hacen falta `turbo.json` (`test` ya tiene `outputs: ["coverage/**"]` y `dependsOn: ["^build"]` sin builds), `vitest.workspace.*` (turbo ya ejecuta `test` por paquete), `.gitignore` (`coverage/` ya ignorado) ni `eslint.config.js`.

Propuesta de reparto (recomendada): **paso 0 a cargo de devops** (raíz `package.json`, `packages/core/package.json` → `dependencies.zod`, `pnpm-lock.yaml`), y el resto **core-dev** en `packages/core/**`. Así un solo rol escribe el lockfile y core-dev no toca nada fuera de su scope. core-dev no debe ejecutar `pnpm add`/`pnpm install` sin `--frozen-lockfile` aunque el hook no lo detecte (el bash-guard no ve que pnpm escribe el lockfile): sería rodear el scope.

## Decisiones de diseño

1. **Tests en `src/**/*.test.ts` + `tsconfig.config.json` aparte para `vitest.config.ts` (paga TD-010 en core).** `rootDir: src` e `include: ["src"]` no cambian; los tests quedan dentro del programa de `tsc` (se tipan, incluidas las aserciones `expectTypeOf`). `vitest.config.ts` se tipa con `tsconfig.config.json` (`extends ../../tsconfig.base.json`, `include: ["vitest.config.ts"]`, sin `rootDir`) y `typecheck` = `tsc --noEmit && tsc --noEmit -p tsconfig.config.json`. Mismo patrón servirá para `next.config.ts` en TASK-007.
   — Descartadas: (a) añadir `vitest.config.ts` al `include` → TS6059 (verificado); (b) dejar `vitest.config.ts` sin tipar (solo ESLint sin tipos y su ejecución) → no paga TD-010, que habla de *tipar*; (c) quitar `rootDir` → prohibido por TD-010 y la Verificación de ADR-001.
2. **`test` = `vitest run --coverage` con umbrales 90 % (líneas, funciones, ramas, sentencias) en `vitest.config.ts`**, `include` y `coverage.include` = `src/**/*.ts`, `exclude` de `*.test.ts`, reporters `text` + `json-summary`. `pnpm test` falla por debajo del 90 %: el DoD lo comprueba la propia suite y luego CI.
   — Descartado: script `test:coverage` separado → `pnpm test` y CI podrían pasar con cobertura < 90 %.
3. **`import { describe, it, expect } from "vitest"` explícito, sin `globals`** → no hay que tocar `types` del `tsconfig`.
4. **Todos los esquemas de contrato con `z.strictObject`** (clave desconocida = error). Excepción: `EnvSchema` (`z.object`, porque `process.env` trae cientos de variables ajenas).
   — Descartado `z.object` (strip): en `RunRequest` descartaría en silencio un `budget` inyectado en vez de rechazarlo (SPEC §9.6, ADR-005.3) y en general oculta bugs.
5. **Ficheros planos en `src/` (kebab-case), un módulo por contrato**, re-exportados desde `src/index.ts` con `export *` (módulos con valores) y `export type *` (módulos solo de tipos), compatible con `verbatimModuleSyntax` (verificado).
   — Descartado `src/schemas/`, `src/errors/`…: subcarpetas sin necesidad para ~12 ficheros.
6. **`AgentLabError` abstracta**: ARCH §10 exige usar siempre subclases. Constructor `(code, message, { retryable, cause? })`; `name = new.target.name`; `cause` se pasa a `super(message, { cause })` solo si existe (compatible con `exactOptionalPropertyTypes`, verificado). Sin clase intermedia `ProviderError`: `retryable` basta para TASK-019.
7. **`EnvValidationError` (`ENV_INVALID`)** existe porque `loadEnv()` tiene que lanzar algo y ARCH §10 prohíbe `throw new Error`. Mensaje = cabecera + `z.prettifyError(error)`: nombra la variable y el problema, **nunca el valor** (Zod 4 no incluye el input en los issues salvo con `reportInput`).
8. **`loadEnv(source = process.env)`**: los tests pasan objetos y no mutan `process.env` (sin estado global; testing-conventions §4). `process.env` solo aparece en `env.ts` (monorepo-conventions).
9. **Interfaces de ARCH §3.1/§3.2 copiadas literalmente como `interface` TypeScript** (sin Zod salvo `ProviderCapabilitiesSchema`, que pide el DoD). `ProviderCapabilities` = `z.infer<typeof ProviderCapabilitiesSchema>`, y un test de tipos (`expectTypeOf<ProviderCapabilities>().toEqualTypeOf<{…literal de §3.1…}>()`) asegura que coincide campo a campo. Igual con `Budget` frente a la lista de §3.3.
10. **Máquina de estados como tabla `Readonly<Record<RunStatus, readonly RunStatus[]>>`** y `canTransition(from, to)` puro. La fila "— → `queued`" de §5 es la creación, no una transición entre estados: no entra en `canTransition` (`RunsRepository.create` inserta `queued`). Se exportan también `TERMINAL_RUN_STATUSES` e `isTerminalRunStatus`, porque §5 define literalmente los estados terminales y los consumen TASK-014 (409 si no es terminal) y TASK-024 (cerrar SSE).
    — Descartado `canTransition(from: RunStatus | null, …)`: mezcla creación y transición y complica `transition()` de TASK-005.
11. **Sin `DEFAULT_BUDGET` en core**: los valores por defecto dependen de OD-002 (TD-003 los asigna a TASK-011) y del `budget_profile` del proyecto. Nada que el DoD no pida: sin `BudgetSnapshot`, `Usage` de policies, `Checkpointer` wrapper ni más helpers de secretos que `SecretResolver` (decisión 12).
12. **`SecretResolver` (OD-017) en `env.ts`**: `type SecretResolver = (envName: string) => string | undefined` y `createSecretResolver(source: EnvSource = process.env): SecretResolver`. **Allowlist (OD-017, decisión humana)**: un nombre es resoluble solo si cumple **las dos** condiciones: (1) `SECRET_ENV_NAME_PATTERN = /^[A-Z][A-Z0-9_]*_API_KEY$/` (anclada, sin flags `g`/`y` para que `test()` no tenga estado `lastIndex`) y (2) `Object.hasOwn(EnvSchema.shape, envName)`. Hoy eso deja exactamente **`OPENROUTER_API_KEY` y `GEMINI_API_KEY`**, las dos `*_API_KEY` de `.env.example`, declaradas en `EnvSchema` como **opcionales sin defecto** (`""` = no definida); ninguna otra variable de `EnvSchema` cumple el patrón. Si el nombre no pasa la allowlist → `undefined` sin mirar la fuente. Si pasa, lee **en cada llamada** de la fuente inyectada (no copia el entorno al construirse) y devuelve el valor solo si `Object.hasOwn(source, envName)` y es `string` no vacío; en otro caso `undefined` (la cadena vacía cuenta como no definida, igual que en `loadEnv`; `hasOwn` evita miembros del prototipo de `process.env`). El conjunto permitido se deriva del esquema, no se duplica en una lista aparte: añadir un proveedor con clave nueva = declarar `XXX_API_KEY` opcional en `EnvSchema` (cambio en `packages/core/**`). `SECRET_ENV_NAME_PATTERN` es un detalle interno de `env.ts` (no se exporta). Nunca lanza, así que no puede filtrar valores por mensajes de error; el error "falta la clave" lo construye el adaptador con el **nombre** (TASK-010). `process.env` sigue apareciendo solo en `env.ts` (como parámetro por defecto de `loadEnv` y `createSecretResolver`).
    — Descartadas (decisión humana): (a) resolver cualquier nombre → un `provider_configs.api_key_env` = `DATABASE_URL` enviaría la URL de la base de datos a un tercero; (b) lista negra de no secretos de `EnvSchema` → falla por omisión: `PATH`, `HOME`, las de LangSmith y las del sistema seguirían siendo legibles. También descartado `Env` como fuente de secretos para los adaptadores → contradice OD-017.
13. **Ids UUID (OD-010)**: todos los ids de los contratos (`id`, `projectId`, `teamId`, `agentIds[]`, `providerId`, `agentDefinitionId`, `runId`) se validan con `z.uuid()` (RFC 9562, cualquier versión). Se generan como v4: `gen_random_uuid()` en la base de datos (ARCH §6) o `crypto.randomUUID()` cuando haga falta en código. `core` **no exporta generador** de ids: ningún consumidor de M1 lo necesita en core y sería una abstracción sobre una llamada de una línea.
    — Descartado `z.uuidv4()`: rechazaría un futuro v7 (PostgreSQL ≥ 18 o Node) sin aportar seguridad.

## Contratos públicos nuevos (todo desde `@agentlab/core`)

Literal de ARCHITECTURE §3.1 (`model-provider.ts`):

```ts
interface ModelProvider {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;
  listModels(): Promise<ModelInfo[]>;
  generate(req: GenerateRequest, signal: AbortSignal): Promise<GenerateResponse>;
}
interface ProviderCapabilities {
  tools: boolean; structuredOutput: boolean; streaming: boolean;
  maxContextTokens: number | null; reportsUsage: boolean; reportsCost: boolean;
}
interface GenerateRequest {
  model: string;
  messages: Message[];
  requires: Partial<Pick<ProviderCapabilities, "tools" | "structuredOutput">>;
  tools?: ToolSpec[];
  responseSchema?: JsonSchema;
  maxOutputTokens: number;
  temperature?: number;
  timeoutMs: number;
}
interface GenerateResponse {
  content: string | null;
  toolCalls: ToolCall[];
  usage: { inputTokens: number | null; outputTokens: number | null };
  costReported: number | null;
  raw?: unknown;
}
```

Literal de ARCHITECTURE §3.2 (`tool.ts`, `ZodType` importado como tipo de `zod`):

```ts
interface Tool<I, O> {
  name: string;
  description: string;
  input: ZodType<I>;
  output: ZodType<O>;
  sensitivity: "none" | "network" | "write" | "approval";
  execute(input: I, ctx: ToolContext): Promise<O>;
}
```

`ModelInfo`, `Message`, `ToolSpec`, `ToolCall`, `JsonSchema`, `ToolContext`: mínimos de OD-E (decidido, OD-013). Los opcionales de `GenerateRequest`/`GenerateResponse` (`tools?`, `responseSchema?`, `temperature?`, `raw?`) se mantienen porque son literales de ARCH §3.1 y el DoD exige "exactamente como ARCHITECTURE §3".

Tabla de ARCHITECTURE §5 (`run-status.ts`), transiciones permitidas (10 pares; el resto de las 49 combinaciones → `false`):

| Desde | Hacia |
|---|---|
| `queued` | `running`, `cancelled` |
| `running` | `awaiting_approval`, `completed`, `partial`, `failed`, `cancelled`, `queued` |
| `awaiting_approval` | `running`, `cancelled` |
| `completed`, `partial`, `failed`, `cancelled` | — (terminales) |

Resto de exports (campos concretos en "Esquemas" y "Eventos" más abajo):

```ts
RunStatusSchema / RunStatus            // 7 estados de ARCH §5
canTransition(from: RunStatus, to: RunStatus): boolean
TERMINAL_RUN_STATUSES / isTerminalRunStatus(s: RunStatus): boolean
AgentRoleSchema / AgentRole            // 6 roles de SPEC §4.2
AgentDefinitionSchema / AgentDefinition
TeamDefinitionSchema / TeamDefinition
RunRequestSchema / RunRequest
BudgetSchema / Budget; BudgetLimit = keyof Budget
RunEventSchema / RunEvent; RUN_EVENT_TYPES   // 15 tipos de SPEC §8, discriminante "type"
AgentInvocationResultSchema / AgentInvocationResult (+ InvocationErrorSchema, InvocationUsageSchema)
ProviderCapabilitiesSchema / ProviderCapabilities
JsonSchemaSchema / JsonSchema
type EnvSource = Readonly<Record<string, string | undefined>>
EnvSchema / Env; loadEnv(source?: EnvSource): Env              // por defecto process.env
type SecretResolver = (envName: string) => string | undefined  // OD-017
createSecretResolver(source?: EnvSource): SecretResolver       // por defecto process.env; nunca lanza; solo *_API_KEY declaradas en EnvSchema
type AgentLabErrorCode = "PROVIDER_AUTH" | "PROVIDER_RATE_LIMIT" | "PROVIDER_TIMEOUT"
  | "PROVIDER_CAPABILITY" | "PROVIDER_RESPONSE" | "BUDGET_EXCEEDED" | "ENV_INVALID" | "INVALID_TRANSITION"
abstract class AgentLabError extends Error { readonly code; readonly retryable: boolean; /* cause nativo */ }
class ProviderAuthError        // PROVIDER_AUTH, retryable false
class ProviderRateLimitError   // PROVIDER_RATE_LIMIT, retryable true, readonly retryAfterMs: number | undefined
class ProviderTimeoutError     // PROVIDER_TIMEOUT, retryable true
class ProviderCapabilityError  // PROVIDER_CAPABILITY, retryable false
class ProviderResponseError    // PROVIDER_RESPONSE, retryable por parámetro (por defecto false)
class BudgetExceededError      // BUDGET_EXCEEDED, retryable false, readonly limit: BudgetLimit (TASK-011)
class EnvValidationError       // ENV_INVALID, retryable false
class InvalidTransitionError   // INVALID_TRANSITION, retryable false, readonly from/to: RunStatus (OD-016)
```

### Esquemas (OD-014: propuesta del plan sin opcionales "por si acaso")

Todos `z.strictObject`, todos los campos **obligatorios**; ids con `z.uuid()` (decisión 13).

| Esquema | Campos |
|---|---|
| `AgentDefinitionSchema` | `id`, `name` (no vacío), `role: AgentRole`, `systemPrompt` (no vacío), `promptVersion` (regex semver.org), `providerId` (uuid), `modelId` (no vacío), `toolAllowlist: string[]` (`[]` = sin herramientas; lo consume `ToolAuthorizer.check` en TASK-011), `maxCalls`/`maxTokens`/`timeoutMs` (enteros > 0), `outputSchema: JsonSchema`, `enabled: boolean` — exactamente SPEC §4.4 |
| `TeamDefinitionSchema` | `id`, `name` (no vacío), `graphBuilder` (no vacío; M1: `research`), `agentIds: uuid[]` (≥ 1) |
| `RunRequestSchema` | `projectId`, `teamId` (uuid), `input` (string recortado no vacío). Sin `budget` (lo rechaza `strictObject`). Sin longitud máxima: ningún documento la define |
| `BudgetSchema` | Los 10 campos de ARCH §3.3, obligatorios, sin defectos: enteros > 0 salvo `maxReviewIterations` y `maxToolsPerInvocation` (≥ 0) y `maxContextRatio` ∈ (0, 1] |
| `AgentInvocationResultSchema` | Literal de SPEC §4.5: `content: unknown`, `status` (5 valores), `errors: InvocationError[]`, `references: { kind, uri, title? }[]`, `usage: { inputTokens?, outputTokens?, costReported? }`. Estos tres opcionales **se mantienen**: los define SPEC §4.5 ("solo si el proveedor lo facilita"), no son "por si acaso" |

**Eliminado respecto a la propuesta original** (M1 no lo usa):
- `TeamDefinition.coordination: Record<string, unknown>` → entra con TASK-034 (M4, "`coordination jsonb` validado"). La columna `coordination jsonb` de ARCH §6 es de TASK-005: necesitará `default '{}'` o `null` mientras el contrato no la tenga.
- `run.completed.payload.status: "completed" | "partial"` y `run.completed.payload.partialReason?` (alternativa (a) de OD-D, rechazada) → sustituidos por el evento `run.partial`.

### Eventos (OD-011 + OD-012: 15 tipos)

Sobre común (ARCH §3.4): `type`, `runId` (uuid), `seq` (entero ≥ 1), `ts` (ISO-8601 con zona), `payload`. Orden de SPEC §8:

| `type` | `payload` (strict, todo obligatorio) |
|---|---|
| `run.started` | `{}` |
| `run.step` | `{ node: string, step: int ≥ 0 }` |
| `agent.started` | `{ agentDefinitionId, role, step, attempt: int ≥ 1 }` |
| `agent.completed` | `{ agentDefinitionId, role, step, durationMs: int ≥ 0, usage: InvocationUsage }` |
| `agent.failed` | `{ agentDefinitionId, role, step, error: InvocationError }` |
| `tool.started` | `{ toolName, step }` |
| `tool.completed` | `{ toolName, step, durationMs }` |
| `run.awaiting_approval` | `{ toolName }` |
| `run.resumed` | `{}` (ARCH §4: conserva `seq`; lo emite TASK-026) |
| `run.cancelled` | `{}` |
| `run.completed` | `{}` |
| `run.partial` | `{ partialReason: string no vacío }` (mismo motivo que `result.partialReason` de TASK-013) |
| `run.failed` | `{ error: InvocationError }` |
| `budget.warning`, `budget.exceeded` | `{ limit: BudgetLimit, used: number, max: number }` |

### Entorno (OD-015)

Variables que existen hoy (`.env.example`) más `LANGCHAIN_TRACING_V2`. Obligatoria solo `DATABASE_URL` (URL `postgres`/`postgresql`). Con defecto: `WORKER_CONCURRENCY=1`, `WORKER_HEARTBEAT_MS=15000`, `WORKER_STALE_MS=60000`, `SHUTDOWN_GRACE_MS=30000`, `LOG_LEVEL=info` (niveles de pino), **`LANGCHAIN_TRACING_V2`** `z.enum(["true", "false"]).default("false")` (string, tal como lo lee LangChain). Opcionales sin defecto (en `.env.example`, `OLLAMA_BASE_URL`, `AGENTLAB_PROVIDER` y `DATABASE_URL_TEST` traen valores **de ejemplo**, no defaults de `env.ts` — OD-018; el resto van vacías): `DATABASE_URL_TEST`, `OLLAMA_BASE_URL`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `AGENTLAB_PROVIDER` (`fake|openai-compatible|gemini`), `OPENROUTER_API_KEY`, `GEMINI_API_KEY`. `""` = no definida. Las claves siguen en `Env` (OD-G (a), decidido), pero los adaptadores las obtienen **solo** con `SecretResolver` (OD-017), que únicamente resuelve estas dos (únicas `*_API_KEY` declaradas).

## Pasos

0. **devops** (scope ampliado, deps aprobadas), en `node:22` con store fuera del repo: `pnpm add -w -D -E vitest@5.0.5 @vitest/coverage-v8@5.0.5 vite@8.3.4` y `pnpm --filter @agentlab/core add -E zod@4.6.7`; `engines.node` de la raíz → `">=22.12 <23"`; comprobar cero avisos de peers y `pnpm why vite` = 8.3.4 única. → `package.json`, `packages/core/package.json` (`dependencies`), `pnpm-lock.yaml`.
1. **core-dev**: herramientas del paquete. → `packages/core/package.json` (scripts `typecheck` = `tsc --noEmit && tsc --noEmit -p tsconfig.config.json`, `test` = `vitest run --coverage`), `packages/core/tsconfig.config.json`, `packages/core/vitest.config.ts`. `tsconfig.json` sin cambios.
2. Estados de run. → `src/run-status.ts`, `src/run-status.test.ts`.
3. Errores. → `src/errors.ts`, `src/errors.test.ts`.
4. Esquemas base y compartidos. → `src/json-schema.ts`, `src/provider-capabilities.ts`, `src/budget.ts`, `src/agent-invocation-result.ts` (+ `*.test.ts` de cada uno).
5. Definiciones y petición. → `src/agent-definition.ts`, `src/team-definition.ts`, `src/run-request.ts` (+ tests).
6. Eventos. → `src/run-event.ts`, `src/run-event.test.ts`.
7. Interfaces (solo tipos). → `src/model-provider.ts`, `src/tool.ts`, `src/contracts.test.ts` (aserciones de tipos frente a los literales de §3.1/§3.3).
8. Entorno y secretos (`EnvSchema`, `loadEnv`, `SecretResolver`, `createSecretResolver`). → `src/env.ts`, `src/env.test.ts`.
9. API pública. → `src/index.ts`, `src/index.test.ts` (los exports de valor existen; el test sirve de inventario).
10. Validación en `node:22` (comando de TASK-001 con `--frozen-lockfile`): `pnpm -r typecheck`, `pnpm -r lint`, `pnpm test`, `pnpm format:check`; `pnpm --filter @agentlab/core list --prod` muestra solo `zod`. Formatear con `pnpm exec prettier --write packages/core`.
11. ~~**architect**: ARCHITECTURE §9~~ **Hecho** en el ajuste del 2026-10-20 (filas `zod`, `vitest`, `@vitest/coverage-v8`, `vite`, `engines`). ARCH §4 **no** se toca (OD-012).

## Tests (unitarios, sin red ni DB; Vitest 5 + v8)

- `run-status`: tabla exhaustiva 7×7 = 49 casos (`it` por par) contra la lista literal de 10 pares de §5 escrita en el test, independiente de la implementación; `isTerminalRunStatus` para los 7 estados; ningún terminal tiene salida.
- Esquemas: cada uno acepta un ejemplo canónico y rechaza al menos campo obligatorio ausente, clave desconocida y valor fuera de rango/enum. `RunRequest` rechaza un `budget` inyectado. `AgentDefinition` rechaza `promptVersion` no semver y `role` fuera de §4.2. `TeamDefinition` rechaza `coordination` (clave desconocida). Ids: aceptan un `crypto.randomUUID()` y rechazan un string no UUID.
- `RunEventSchema`: `RUN_EVENT_TYPES` es exactamente el conjunto literal de SPEC §8 (**15**, incluidos `run.partial` y `run.resumed`); un evento válido por tipo (`it.each` sobre los 15); rechaza tipo desconocido, `seq` 0 o no entero, `ts` sin formato ISO, payload de otro tipo y `run.partial` sin `partialReason`.
- Errores: `instanceof AgentLabError` y de su clase, `code`, `retryable`, `cause` conservado, `name`, `retryAfterMs`, `limit`.
- `env`: falta `DATABASE_URL` → `EnvValidationError` cuyo mensaje nombra la variable; valores por defecto; `""` = no definida; número inválido; enum inválido; el mensaje **no contiene el valor** recibido (canario no secreto, p. ej. `"not-a-url-canary-123"`); `LANGCHAIN_TRACING_V2` ausente → `"false"`, `"yes"` → error; una prueba con `vi.stubEnv` cubre el parámetro por defecto.
- `SecretResolver` (DoD: nunca expone valores en mensajes de error; allowlist de OD-017), todo con una fuente que **sí contiene** cada nombre probado: `OPENROUTER_API_KEY` y `GEMINI_API_KEY` presentes → su valor; ausentes o `""` → `undefined`; `*_API_KEY` válido por patrón pero **no declarado** (p. ej. `ANTHROPIC_API_KEY`) → `undefined`; `DATABASE_URL`, `DATABASE_URL_TEST`, `PATH`, `HOME` y `LANGCHAIN_TRACING_V2` → `undefined` aunque estén en la fuente; minúsculas (`openrouter_api_key`), mezcla (`Gemini_API_KEY`) o sin sufijo (`OPENROUTER`, `OPENROUTER_API_KEYS`, `OPENROUTER_API_KEY_OLD`) → `undefined`; regex anclada: `X_OPENROUTER_API_KEY`, `" GEMINI_API_KEY"`, `"GEMINI_API_KEY\n"` y `"FOO\nGEMINI_API_KEY"` → `undefined`; nombres del prototipo (`"toString"`) → `undefined`; inventario: el conjunto resoluble derivado de `EnvSchema` es exactamente `{OPENROUTER_API_KEY, GEMINI_API_KEY}` (falla si alguien declara otra variable que case el patrón sin revisarlo); nunca lanza (`expect(() => …).not.toThrow()` con entradas raras); refleja cambios de la fuente (lectura por llamada); con canarios en `OPENROUTER_API_KEY`/`GEMINI_API_KEY` y `DATABASE_URL` ausente, el mensaje de `EnvValidationError` no contiene ningún canario; `vi.stubEnv` cubre el defecto `process.env`.
- Tipos: `expectTypeOf` (lo verifica `tsc` en `typecheck`, porque los tests están en `src`).
- Cobertura: umbrales globales 90 % en `vitest.config.ts`; `pnpm test` en `node:22` sin PostgreSQL (core no lo necesita; no requiere `docker compose`).

## Riesgos

- Vitest 5 tiene 7 semanas (5.0.0 el 2026-09-03). Si aparece un bloqueo, la alternativa es `vitest`/`@vitest/coverage-v8` `4.1.12` (rama `V4` mantenida, sin `vite` explícito).
- `vitest`/`vite` exigen Node ≥ 22.12: resuelto en el paso 0 (`engines.node` `>=22.12 <23`, decisión humana). `node:22` (22.23.2) cumple; un Node local 22.0–22.11 dejará de instalar.
- Zod duplicado cuando entre `@langchain/core` (su dependencia `^3.25.76 || ^4` podría resolver un 4.x más nuevo) → dos instancias de Zod. TASK-013 debe comprobarlo con `pnpm why zod` (o `pnpm.overrides`), igual que con `@langchain/core`.
- `Env` contiene las API keys (OD-G (a)): quien registre el objeto completo las filtra. Mitigación: mensajes de error sin valores (test), adaptadores solo vía `SecretResolver` y nota para TASK-010/TASK-027 (`redactSecrets`).
- ~~Contradicción TASK-010 / `process.env`~~: resuelta por OD-017 (`SecretResolver` inyectado; TASK-010 ya actualizada por el Orchestrator).
- ~~`SecretResolver` resuelve cualquier nombre~~ (p. ej. `api_key_env` = `DATABASE_URL`): **mitigado** por la allowlist de OD-017 (patrón `*_API_KEY` + declarado en `EnvSchema`; tests de arriba).
- Consecuencia de la allowlist: un `provider_configs.api_key_env` con un nombre no declarado resuelve `undefined` y el adaptador de TASK-010 debe fallar con `ProviderAuthError` que cite el **nombre** (nunca un valor). Una clave de proveedor nueva exige tocar `EnvSchema` en `packages/core/**`.
- La allowlist se deriva de `EnvSchema.shape`: si `EnvSchema` deja de ser un `z.object` plano (p. ej. un `.transform` global), `shape` desaparece y typecheck lo detecta; en ese caso derivar de una constante de claves. Hoy los `""` → `undefined` se tratan por campo.
- `z.uuid()` de Zod 4 valida RFC 9562 estricto: los fixtures deben usar UUID válidos (`gen_random_uuid()` genera v4 válidos).
- Cualquier cambio posterior de contratos (p. ej. `Message` con rol `tool` en M4, `coordination` en TASK-034) exige scope de `packages/core/**` en esa tarea.

## OPEN DECISIONS

~~**Abierta tras el ajuste**: ¿restringe `SecretResolver` los nombres resolubles? (a) cualquier nombre; (b) lista negra de no secretos de `EnvSchema`; (c) solo sufijo `_API_KEY`. Recomendaba (b).~~ **RESUELTA (2026-10-20) dentro de OD-017**: (c) con precisión: `^[A-Z][A-Z0-9_]*_API_KEY$` **y** declarado en `EnvSchema`; (a) y (b) descartadas (recomendación (b) rechazada: falla por omisión). Ver decisión 12. Ninguna OPEN DECISION abierta en este plan.

**Registro de las 8 decisiones del plan original (todas RESUELTAS 2026-10-20; ver "Decisiones humanas")**: OD-A → OD-009 · OD-B → OD-010 · OD-C → OD-011 · OD-D → OD-012 (**recomendación rechazada**: 15 eventos) · OD-E → OD-013 · OD-F → OD-014 (sin opcionales "por si acaso") · OD-G → OD-015 (+ `LANGCHAIN_TRACING_V2`) · OD-H → OD-016. El texto siguiente se conserva como registro de la propuesta.

- **OD-A — Dónde van Vitest y compañía.** (a) Raíz `devDependencies` (como TypeScript/ESLint en TASK-001): versión única, los paquetes siguientes (persistence, policies, providers…) no necesitan `deps_allowed` nuevo; requiere paso 0 de devops. (b) `packages/core/devDependencies`: core-dev lo hace todo, solo amplía `pnpm-lock.yaml`; cada paquete futuro repite tres devDependencies con la misma versión exacta. **Recomiendo (a)** con Vitest 5.0.5 + vite 8.3.4 + coverage-v8 5.0.5.
- **OD-B — Formato de identificadores.** SPEC §4.4 dice `string`; las tablas usan `uuid`. (a) `z.uuid()` para `id`, `runId`, `projectId`, `teamId`, `agentIds[]`, `providerId` (referencia a `provider_configs.id`); `modelId` = string no vacío. (b) string no vacío en todos. **Recomiendo (a)**. Consecuencia: el equipo de ejemplo de TASK-012 necesitará UUID fijos.
- **OD-C — Payload de cada uno de los 13 eventos** (SPEC/ARCH no lo definen). (a) Payload tipado mínimo por tipo; propuesta: `run.started` `{}` · `run.step` `{ node, step }` · `agent.started` `{ agentDefinitionId, role, step, attempt }` · `agent.completed` `{ agentDefinitionId, role, step, durationMs, usage }` · `agent.failed` `{ agentDefinitionId, role, step, error: { code, message, retryable } }` · `tool.started` `{ toolName, step }` · `tool.completed` `{ toolName, step, durationMs }` · `run.awaiting_approval` `{ toolName }` · `run.cancelled` `{}` · `run.completed` (ver OD-D) · `run.failed` `{ error }` · `budget.warning` / `budget.exceeded` `{ limit: BudgetLimit, used, max }`. (b) `payload: Record<string, unknown>` en todos y tiparlos en TASK-013, que tendría que tocar core. Sobre: `seq` entero ≥ 1 (ARCH §3.4: `COALESCE(MAX,0)+1`), `ts` ISO-8601 con zona (JSON/SSE/`jsonb`). **Recomiendo (a)**.
- **OD-D — `run.partial` y `run.resumed`.** ARCH §4 menciona "emite `run.completed|partial`" y `run.resumed`, que no están entre los 13 de SPEC §8 (y SPEC prevalece). (a) Mantener 13: `run.completed` con `{ status: "completed" | "partial", partialReason?: string }`; `run.resumed` se añade en M3 (TASK-025/026) con cambio de SPEC. (b) Añadir `run.partial` ahora (14 tipos): cambia SPEC y el DoD. **Recomiendo (a)**, y que el architect corrija ARCH §4 en otra tarea.
- **OD-E — Tipos citados en ARCH §3 sin definir.** (a) Mínimos: `JsonSchema = Record<string, unknown>`; `ModelInfo { id: string }`; `Message { role: "system" | "user" | "assistant"; content: string }` (M1 no usa herramientas; TASK-030 lo amplía con rol `tool`); `ToolCall { id: string; name: string; arguments: unknown }` (JSON ya parseado por el adaptador); `ToolSpec { name: string; description: string; parameters: JsonSchema }`; `ToolContext { runId: string; signal: AbortSignal }`. (b) Completos ya (mensajes `tool`/`assistant` con `toolCalls`, `ModelInfo` con contexto): se adelanta M4. **Recomiendo (a)**.
- **OD-F — Campos de esquemas no fijados.** `AgentRole` en minúsculas (`manager`, `researcher`, `analyst`, `writer`, `critic`, `evaluator`); `promptVersion` con la regex oficial de semver.org; `maxCalls`/`maxTokens`/`timeoutMs` enteros > 0; `outputSchema` = `JsonSchema`. `TeamDefinition` = `{ id, name, graphBuilder: string no vacío (el registro vive en orchestrator), agentIds: uuid[] (≥ 1), coordination: Record<string, unknown> }` (se valida de verdad en TASK-034). `RunRequest` = `{ projectId, teamId, input: string recortado no vacío }`: nombre del campo (`input` / `prompt` / `request`) y longitud máxima por decidir; **sin `budget`** (TASK-014: presupuesto del proyecto). `Budget`: 10 campos obligatorios sin valores por defecto; enteros > 0, salvo `maxReviewIterations` y `maxToolsPerInvocation` ≥ 0, y `maxContextRatio` en (0, 1]. `AgentInvocationResult.usage` con campos **opcionales** como dice SPEC §4.5 (ARCH §3.1 usa `number | null` en `GenerateResponse`: son dos contratos distintos); `references[].kind` y `uri` como strings no vacíos (no URL: también hay artefactos internos). **Recomiendo todo lo anterior**; alternativa: enums cerrados para `graphBuilder`/`kind`, que obligan a tocar core en M4.
- **OD-G — `env.ts`: obligatoriedad, valores por defecto y secretos.** Propuesta: obligatoria solo `DATABASE_URL` (URL `postgres`/`postgresql`); opcionales con el valor de `.env.example`/ARCH §8/ADR-004 como defecto: `WORKER_CONCURRENCY=1`, `WORKER_HEARTBEAT_MS=15000`, `WORKER_STALE_MS=60000`, `SHUTDOWN_GRACE_MS=30000`, `LOG_LEVEL=info` (enum de niveles de pino: `fatal|error|warn|info|debug|trace|silent`); opcionales sin defecto: `DATABASE_URL_TEST`, `OLLAMA_BASE_URL`, `OTEL_EXPORTER_OTLP_ENDPOINT` (URL), `AGENTLAB_PROVIDER` (`fake|openai-compatible|gemini`), `OPENROUTER_API_KEY`, `GEMINI_API_KEY` (string no vacío). La cadena vacía cuenta como no definida (`.env.example` y Compose las pasan vacías). Para las claves: (a) declararlas y devolverlas en `Env`; (b) validarlas pero no devolverlas; (c) no declararlas (contradice "una variable no declarada no existe", ARCH §10). **Recomiendo (a)** con el test de que los mensajes no incluyen valores.
- **OD-H — Errores fuera de la lista explícita del DoD.** Códigos propuestos (siguiendo el patrón de ARCH §10: `BUDGET_EXCEEDED`, `PROVIDER_RATE_LIMIT`): `PROVIDER_AUTH`, `PROVIDER_TIMEOUT`, `PROVIDER_CAPABILITY`, `PROVIDER_RESPONSE`, `ENV_INVALID`; `retryable` por clase como en Contratos. Además, `InvalidTransitionError` (`INVALID_TRANSITION`, con `from`/`to`): (a) en core ahora, porque pertenece al contrato de la máquina de estados, la lanza TASK-005 y la traduce a 409 web (TASK-014/025), y persistence-dev no puede editar core; (b) que la defina TASK-005 en persistence. **Recomiendo (a)**.
