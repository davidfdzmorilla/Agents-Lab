# PLAN — TASK-004 · packages/core: esquemas Zod, errores tipados, env

| Campo | Valor |
|---|---|
| Tarea | TASK-004 (M0) · owner de implementación: core-dev |
| Autor del plan | architect |
| Fecha | 2026-10-20 |
| Estado | Propuesto: pendiente de aprobación humana (deps_allowed, ampliación de scope, OPEN DECISIONS) |

## Contexto

`packages/core` hoy solo tiene `export {};`, un `package.json` con `typecheck`/`lint` y un `tsconfig.json` con `rootDir: src` + `include: ["src"]` (TASK-001). La tarea crea los contratos de los que dependen TASK-005 (persistence: `RunStatus`, `canTransition`, eventos), TASK-010 (providers: `ModelProvider`, errores de proveedor, capacidades), TASK-011 (policies: `Budget`, `BudgetExceededError`), TASK-012 (agents: `AgentDefinition`, `TeamDefinition`) y TASK-013 (orchestrator; añadirá `LANGCHAIN_TRACING_V2` a `env.ts` más adelante). Es la primera tarea con tests: introduce Vitest en el monorepo y paga TD-010 en `core`.

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

Versiones consultadas con `npm view` el 2026-10-20:

| Paquete | Versión | Publicada | Notas |
|---|---|---|---|
| `zod` | 4.6.7 (`latest`) | 2026-10-12 | Sin dependencias; ESM. Cumple `^3.25.32 \|\| ^4.2.0` (peer de `@langchain/langgraph` 1.5.1) y `^3.25.76 \|\| ^4` (dependencia de `@langchain/core` 1.2.18), reverificados hoy |
| `vitest` | 5.0.5 (`latest`) | 2026-10-15 | engines `^22.12.0 \|\| ^24 \|\| >=26`; peer **no opcional** `vite ^6.4 \|\| ^7 \|\| ^8`; peer opcional `@types/node ^22` (22.20.5 ✅) |
| `@vitest/coverage-v8` | 5.0.5 | 2026-10-15 | peer `vitest 5.0.5` exacto |
| `vite` | 8.3.4 (`latest`) | 2026-10-08 | engines `^20.19 \|\| >=22.12`; peer opcional `esbuild ^0.27 \|\| ^0.28` (compatible con el `tsx` de ADR-009) |
| `vitest` 4.x (alternativa) | 4.1.12 (`V4`) | 2026-10-15 | Trae `vite` como dependencia (no peer); engines `^20 \|\| ^22 \|\| >=24` |

Guía de migración a Vitest 5 (https://vitest.dev/guide/migration, consultada 2026-10-20, sin fecha en la página): Vite pasa a peer; Node ≥ 22.12; `coverage.include` relativo a la raíz del proyecto; ya no busca la config en directorios padre.

## Dependencias propuestas (`deps_allowed`, pendiente de aprobación humana)

| Paquete | Versión exacta | Dónde | Tipo | Motivo |
|---|---|---|---|---|
| `zod` | `4.6.7` | `packages/core` | `dependencies` | Única dependencia de runtime de core (DoD). Zod 4 frente a 3.25.x: `z.toJSONSchema` nativo (SPEC §4.4: `outputSchema` "JSON Schema derivado de Zod") sin añadir `zod-to-json-schema`; `z.prettifyError` para `loadEnv` |
| `vitest` | `5.0.5` | raíz | `devDependencies` | Runner de SPEC §3 |
| `@vitest/coverage-v8` | `5.0.5` | raíz | `devDependencies` | Cobertura v8 (testing-conventions §7) |
| `vite` | `8.3.4` | raíz | `devDependencies` | Peer obligatorio de Vitest 5; declararlo explícitamente evita que lo fije `auto-install-peers` sin control |

Ver OD-A para raíz frente a `packages/core`.

## Ampliación de scope propuesta (decide el humano)

El scope literal (`packages/core/**`) no basta: instalar cualquier dependencia reescribe `pnpm-lock.yaml`.

| Ruta fuera de `packages/core/**` | Por qué | Quién (role-guard) |
|---|---|---|
| `package.json` (raíz) | `devDependencies`: `vitest`, `@vitest/coverage-v8`, `vite` (solo con OD-A = raíz) | devops |
| `pnpm-lock.yaml` | Lo regenera `pnpm add`/`pnpm install` (nunca a mano) | devops |
| `docs/ARCHITECTURE.md` §9 (tras el cierre) | ARCH §9 dice "`zod` se fija en TASK-004": añadir la fila `zod 4.6.7 · core` (y Vitest si el humano quiere que conste) | architect |

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
11. **Sin `DEFAULT_BUDGET` en core**: los valores por defecto dependen de OD-002 (TD-003 los asigna a TASK-011) y del `budget_profile` del proyecto. Nada que el DoD no pida: sin `BudgetSnapshot`, `Usage` de policies, `Checkpointer` wrapper, helpers de lectura de secretos ni `LANGCHAIN_TRACING_V2`.

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

`ModelInfo`, `Message`, `ToolSpec`, `ToolCall`, `JsonSchema`, `ToolContext`: ver OD-E.

Tabla de ARCHITECTURE §5 (`run-status.ts`), transiciones permitidas (10 pares; el resto de las 49 combinaciones → `false`):

| Desde | Hacia |
|---|---|
| `queued` | `running`, `cancelled` |
| `running` | `awaiting_approval`, `completed`, `partial`, `failed`, `cancelled`, `queued` |
| `awaiting_approval` | `running`, `cancelled` |
| `completed`, `partial`, `failed`, `cancelled` | — (terminales) |

Resto de exports (los campos concretos dependen de OD-B…OD-G):

```ts
RunStatusSchema / RunStatus            // 7 estados de ARCH §5
canTransition(from: RunStatus, to: RunStatus): boolean
TERMINAL_RUN_STATUSES / isTerminalRunStatus(s: RunStatus): boolean
AgentRoleSchema / AgentRole            // 6 roles de SPEC §4.2
AgentDefinitionSchema / AgentDefinition
TeamDefinitionSchema / TeamDefinition
RunRequestSchema / RunRequest
BudgetSchema / Budget; BudgetLimit = keyof Budget
RunEventSchema / RunEvent; RUN_EVENT_TYPES   // 13 tipos de SPEC §8, discriminante "type"
AgentInvocationResultSchema / AgentInvocationResult (+ InvocationErrorSchema, InvocationUsageSchema)
ProviderCapabilitiesSchema / ProviderCapabilities
JsonSchemaSchema / JsonSchema
EnvSchema / Env; loadEnv(source?: Readonly<Record<string, string | undefined>>): Env
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
class InvalidTransitionError   // INVALID_TRANSITION, retryable false, from/to (solo si OD-H = sí)
```

Los 13 tipos de evento, literales de SPEC §8: `run.started`, `run.step`, `agent.started`, `agent.completed`, `agent.failed`, `tool.started`, `tool.completed`, `run.awaiting_approval`, `run.cancelled`, `run.completed`, `run.failed`, `budget.warning`, `budget.exceeded`. Sobre común (ARCH §3.4): `type`, `runId`, `seq`, `ts`, `payload`.

Variables de entorno que existen hoy (`.env.example`; SPEC/ARCH no añaden otras): `DATABASE_URL`, `DATABASE_URL_TEST`, `WORKER_CONCURRENCY`, `WORKER_HEARTBEAT_MS`, `WORKER_STALE_MS`, `SHUTDOWN_GRACE_MS`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `OLLAMA_BASE_URL`, `AGENTLAB_PROVIDER`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `LOG_LEVEL`. `LANGCHAIN_TRACING_V2` **no** se añade (TASK-013). Obligatoriedad y valores por defecto: OD-G.

## Pasos

0. **devops** (scope ampliado, deps aprobadas), en `node:22` con store fuera del repo: `pnpm add -w -D -E vitest@5.0.5 @vitest/coverage-v8@5.0.5 vite@8.3.4` y `pnpm --filter @agentlab/core add -E zod@4.6.7`; comprobar cero avisos de peers y `pnpm why vite` = 8.3.4 única. → `package.json`, `packages/core/package.json` (`dependencies`), `pnpm-lock.yaml`.
1. **core-dev**: herramientas del paquete. → `packages/core/package.json` (scripts `typecheck` = `tsc --noEmit && tsc --noEmit -p tsconfig.config.json`, `test` = `vitest run --coverage`), `packages/core/tsconfig.config.json`, `packages/core/vitest.config.ts`. `tsconfig.json` sin cambios.
2. Estados de run. → `src/run-status.ts`, `src/run-status.test.ts`.
3. Errores. → `src/errors.ts`, `src/errors.test.ts`.
4. Esquemas base y compartidos. → `src/json-schema.ts`, `src/provider-capabilities.ts`, `src/budget.ts`, `src/agent-invocation-result.ts` (+ `*.test.ts` de cada uno).
5. Definiciones y petición. → `src/agent-definition.ts`, `src/team-definition.ts`, `src/run-request.ts` (+ tests).
6. Eventos. → `src/run-event.ts`, `src/run-event.test.ts`.
7. Interfaces (solo tipos). → `src/model-provider.ts`, `src/tool.ts`, `src/contracts.test.ts` (aserciones de tipos frente a los literales de §3.1/§3.3).
8. Entorno. → `src/env.ts`, `src/env.test.ts`.
9. API pública. → `src/index.ts`, `src/index.test.ts` (los exports de valor existen; el test sirve de inventario).
10. Validación en `node:22` (comando de TASK-001 con `--frozen-lockfile`): `pnpm -r typecheck`, `pnpm -r lint`, `pnpm test`, `pnpm format:check`; `pnpm --filter @agentlab/core list --prod` muestra solo `zod`. Formatear con `pnpm exec prettier --write packages/core`.
11. **architect** tras el cierre (scope aparte): fila `zod 4.6.7` en ARCHITECTURE §9 y, si se aprueba OD-D, corrección de ARCH §4 (eventos).

## Tests (unitarios, sin red ni DB; Vitest 5 + v8)

- `run-status`: tabla exhaustiva 7×7 = 49 casos (`it` por par) contra la lista literal de 10 pares de §5 escrita en el test, independiente de la implementación; `isTerminalRunStatus` para los 7 estados; ningún terminal tiene salida.
- Esquemas: cada uno acepta un ejemplo canónico y rechaza al menos campo obligatorio ausente, clave desconocida y valor fuera de rango/enum. `RunRequest` rechaza un `budget` inyectado. `AgentDefinition` rechaza `promptVersion` no semver y `role` fuera de §4.2.
- `RunEventSchema`: `RUN_EVENT_TYPES` es exactamente el conjunto literal de SPEC §8 (13); un evento válido por tipo (`it.each`); rechaza tipo desconocido, `seq` 0 o no entero, `ts` sin formato ISO y payload de otro tipo.
- Errores: `instanceof AgentLabError` y de su clase, `code`, `retryable`, `cause` conservado, `name`, `retryAfterMs`, `limit`.
- `env`: falta `DATABASE_URL` → `EnvValidationError` cuyo mensaje nombra la variable; valores por defecto; `""` = no definida; número inválido; enum inválido; el mensaje **no contiene el valor** recibido (canario no secreto, p. ej. `"not-a-url-canary-123"`); una prueba con `vi.stubEnv` cubre el parámetro por defecto.
- Tipos: `expectTypeOf` (lo verifica `tsc` en `typecheck`, porque los tests están en `src`).
- Cobertura: umbrales globales 90 % en `vitest.config.ts`; `pnpm test` en `node:22` sin PostgreSQL (core no lo necesita; no requiere `docker compose`).

## Riesgos

- Vitest 5 tiene 7 semanas (5.0.0 el 2026-09-03). Si aparece un bloqueo, la alternativa es `vitest`/`@vitest/coverage-v8` `4.1.12` (rama `V4` mantenida, sin `vite` explícito).
- `vitest`/`vite` exigen Node ≥ 22.12 y `engines` raíz admite `>=22 <23`: con `engine-strict` un Node 22.0–22.11 falla al instalar. `node:22` (22.23.2) cumple. Afinar `engines` es de devops, fuera de esta tarea.
- Zod duplicado cuando entre `@langchain/core` (su dependencia `^3.25.76 || ^4` podría resolver un 4.x más nuevo) → dos instancias de Zod. TASK-013 debe comprobarlo con `pnpm why zod` (o `pnpm.overrides`), igual que con `@langchain/core`.
- `Env` contendrá las API keys si OD-G las incluye: quien registre el objeto completo las filtra. Mitigación: mensajes de error sin valores (test) y nota para TASK-010/TASK-027 (`redactSecrets`).
- TASK-010 dice "`apiKey` leído de `process.env[apiKeyEnv]`" y monorepo-conventions dice "`process.env` solo en `core/env.ts`": contradicción a resolver al planificar TASK-010 (fuera de esta tarea).
- `z.uuid()` de Zod 4 valida RFC 9562 estricto: los fixtures deben usar UUID válidos (`gen_random_uuid()` genera v4 válidos).
- Cualquier cambio posterior de contratos (p. ej. `Message` con rol `tool` en M4, `LANGCHAIN_TRACING_V2` en TASK-013) exige scope de `packages/core/**` en esa tarea.

## OPEN DECISIONS

- **OD-A — Dónde van Vitest y compañía.** (a) Raíz `devDependencies` (como TypeScript/ESLint en TASK-001): versión única, los paquetes siguientes (persistence, policies, providers…) no necesitan `deps_allowed` nuevo; requiere paso 0 de devops. (b) `packages/core/devDependencies`: core-dev lo hace todo, solo amplía `pnpm-lock.yaml`; cada paquete futuro repite tres devDependencies con la misma versión exacta. **Recomiendo (a)** con Vitest 5.0.5 + vite 8.3.4 + coverage-v8 5.0.5.
- **OD-B — Formato de identificadores.** SPEC §4.4 dice `string`; las tablas usan `uuid`. (a) `z.uuid()` para `id`, `runId`, `projectId`, `teamId`, `agentIds[]`, `providerId` (referencia a `provider_configs.id`); `modelId` = string no vacío. (b) string no vacío en todos. **Recomiendo (a)**. Consecuencia: el equipo de ejemplo de TASK-012 necesitará UUID fijos.
- **OD-C — Payload de cada uno de los 13 eventos** (SPEC/ARCH no lo definen). (a) Payload tipado mínimo por tipo; propuesta: `run.started` `{}` · `run.step` `{ node, step }` · `agent.started` `{ agentDefinitionId, role, step, attempt }` · `agent.completed` `{ agentDefinitionId, role, step, durationMs, usage }` · `agent.failed` `{ agentDefinitionId, role, step, error: { code, message, retryable } }` · `tool.started` `{ toolName, step }` · `tool.completed` `{ toolName, step, durationMs }` · `run.awaiting_approval` `{ toolName }` · `run.cancelled` `{}` · `run.completed` (ver OD-D) · `run.failed` `{ error }` · `budget.warning` / `budget.exceeded` `{ limit: BudgetLimit, used, max }`. (b) `payload: Record<string, unknown>` en todos y tiparlos en TASK-013, que tendría que tocar core. Sobre: `seq` entero ≥ 1 (ARCH §3.4: `COALESCE(MAX,0)+1`), `ts` ISO-8601 con zona (JSON/SSE/`jsonb`). **Recomiendo (a)**.
- **OD-D — `run.partial` y `run.resumed`.** ARCH §4 menciona "emite `run.completed|partial`" y `run.resumed`, que no están entre los 13 de SPEC §8 (y SPEC prevalece). (a) Mantener 13: `run.completed` con `{ status: "completed" | "partial", partialReason?: string }`; `run.resumed` se añade en M3 (TASK-025/026) con cambio de SPEC. (b) Añadir `run.partial` ahora (14 tipos): cambia SPEC y el DoD. **Recomiendo (a)**, y que el architect corrija ARCH §4 en otra tarea.
- **OD-E — Tipos citados en ARCH §3 sin definir.** (a) Mínimos: `JsonSchema = Record<string, unknown>`; `ModelInfo { id: string }`; `Message { role: "system" | "user" | "assistant"; content: string }` (M1 no usa herramientas; TASK-030 lo amplía con rol `tool`); `ToolCall { id: string; name: string; arguments: unknown }` (JSON ya parseado por el adaptador); `ToolSpec { name: string; description: string; parameters: JsonSchema }`; `ToolContext { runId: string; signal: AbortSignal }`. (b) Completos ya (mensajes `tool`/`assistant` con `toolCalls`, `ModelInfo` con contexto): se adelanta M4. **Recomiendo (a)**.
- **OD-F — Campos de esquemas no fijados.** `AgentRole` en minúsculas (`manager`, `researcher`, `analyst`, `writer`, `critic`, `evaluator`); `promptVersion` con la regex oficial de semver.org; `maxCalls`/`maxTokens`/`timeoutMs` enteros > 0; `outputSchema` = `JsonSchema`. `TeamDefinition` = `{ id, name, graphBuilder: string no vacío (el registro vive en orchestrator), agentIds: uuid[] (≥ 1), coordination: Record<string, unknown> }` (se valida de verdad en TASK-034). `RunRequest` = `{ projectId, teamId, input: string recortado no vacío }`: nombre del campo (`input` / `prompt` / `request`) y longitud máxima por decidir; **sin `budget`** (TASK-014: presupuesto del proyecto). `Budget`: 10 campos obligatorios sin valores por defecto; enteros > 0, salvo `maxReviewIterations` y `maxToolsPerInvocation` ≥ 0, y `maxContextRatio` en (0, 1]. `AgentInvocationResult.usage` con campos **opcionales** como dice SPEC §4.5 (ARCH §3.1 usa `number | null` en `GenerateResponse`: son dos contratos distintos); `references[].kind` y `uri` como strings no vacíos (no URL: también hay artefactos internos). **Recomiendo todo lo anterior**; alternativa: enums cerrados para `graphBuilder`/`kind`, que obligan a tocar core en M4.
- **OD-G — `env.ts`: obligatoriedad, valores por defecto y secretos.** Propuesta: obligatoria solo `DATABASE_URL` (URL `postgres`/`postgresql`); opcionales con el valor de `.env.example`/ARCH §8/ADR-004 como defecto: `WORKER_CONCURRENCY=1`, `WORKER_HEARTBEAT_MS=15000`, `WORKER_STALE_MS=60000`, `SHUTDOWN_GRACE_MS=30000`, `LOG_LEVEL=info` (enum de niveles de pino: `fatal|error|warn|info|debug|trace|silent`); opcionales sin defecto: `DATABASE_URL_TEST`, `OLLAMA_BASE_URL`, `OTEL_EXPORTER_OTLP_ENDPOINT` (URL), `AGENTLAB_PROVIDER` (`fake|openai-compatible|gemini`), `OPENROUTER_API_KEY`, `GEMINI_API_KEY` (string no vacío). La cadena vacía cuenta como no definida (`.env.example` y Compose las pasan vacías). Para las claves: (a) declararlas y devolverlas en `Env`; (b) validarlas pero no devolverlas; (c) no declararlas (contradice "una variable no declarada no existe", ARCH §10). **Recomiendo (a)** con el test de que los mensajes no incluyen valores.
- **OD-H — Errores fuera de la lista explícita del DoD.** Códigos propuestos (siguiendo el patrón de ARCH §10: `BUDGET_EXCEEDED`, `PROVIDER_RATE_LIMIT`): `PROVIDER_AUTH`, `PROVIDER_TIMEOUT`, `PROVIDER_CAPABILITY`, `PROVIDER_RESPONSE`, `ENV_INVALID`; `retryable` por clase como en Contratos. Además, `InvalidTransitionError` (`INVALID_TRANSITION`, con `from`/`to`): (a) en core ahora, porque pertenece al contrato de la máquina de estados, la lanza TASK-005 y la traduce a 409 web (TASK-014/025), y persistence-dev no puede editar core; (b) que la defina TASK-005 en persistence. **Recomiendo (a)**.
