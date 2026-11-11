## PLAN — TASK-010
Fecha: 2026-11-10

Contexto: primera tarea de M1. Crea `packages/providers` (hoy no existe) con el adaptador `openai-compatible` sobre el SDK de OpenAI (OpenRouter y Ollama son configuraciones del mismo adaptador, ADR-003 §2) y el `FakeProvider` determinista en `@agentlab/providers/testing` (ADR-003 §6), que necesitan TASK-013, TASK-015 y TASK-017. `core` ya tiene todos los contratos: `ModelProvider`, `GenerateRequest`/`GenerateResponse` (`model-provider.ts`), `ProviderCapabilities` (`provider-capabilities.ts`), las cinco subclases de error de proveedor (`errors.ts`) y `SecretResolver`/`isApiKeyEnvName` (`env.ts`). **Esta tarea no cambia `core`.**

### 1. Referencias que gobiernan la tarea

| Fuente | Qué fija |
|---|---|
| `TASKS.md:296-307` | DoD literal (7 viñetas). Scope `packages/providers/**`. Owner providers-dev. |
| `TASKS.md:9` | TASK-010 READY; «Después de TASK-047, TASK-010 va antes que las demás tareas de proveedores». TASK-047 está DONE. |
| ADR-003 (Accepted) | Interfaz en `core`; adaptador `openai-compatible` parametrizado por `baseUrl` + `apiKeyEnv`; fallo **antes** de la red si falta una capacidad; `usage` y `costReported` `null` si no se informan, nunca estimados; `FakeProvider` en `@agentlab/providers/testing`. |
| SPEC §2.1 | «si el modelo no las soporta, el adaptador **falla rápido** con un error tipado, nunca degrada en silencio». |
| SPEC §3 | SDK de OpenAI para endpoints compatibles. |
| SPEC §9.1 | Claves nunca en repositorio, tablas, eventos, prompts ni trazas. |
| SPEC §13 OD-017 (resuelta) | Clave solo vía `SecretResolver` inyectado; solo nombres `^[A-Z][A-Z0-9_]*_API_KEY$` declarados en `env.ts` (hoy `OPENROUTER_API_KEY` y `GEMINI_API_KEY`). |
| ARCHITECTURE §2 | `providers` depende solo hacia abajo (`core ← persistence ← policies ← providers`); contiene registry, adaptadores, normalización de errores, reintentos y timeout. Sub-export **previsto** `@agentlab/providers/testing`, cubierto por el test de exports. |
| ARCHITECTURE §3.1 | Firmas de `ModelProvider`; `requires.tools` sin capacidad → `ProviderCapabilityError` antes de la red; todos los errores con `retryable`. `raw` «solo en modo debug; nunca persistido». |
| ARCHITECTURE §6 (`:219`) | `provider_configs.api_key_env` es `text NULL` («Ollama no tiene clave»). |
| ARCHITECTURE §9 | Versión exacta sin `^`; publicada hace ≥ 2 semanas (excepción solo con aviso GHSA/CVE verificado por security). |
| ARCHITECTURE §10 | Errores: subclases de `AgentLabError`, lista cerrada de códigos en `core/errors.ts`; sin `console.*`; `process.env` solo en `core/env.ts`. |
| `TASK-004.md:26-27, :90` | Decisión humana: `ProviderAuthError` en construcción. Security (LOW, `errors.ts:22-28`): los adaptadores no deben envolver errores con cabeceras o request → test canario en esta tarea. |
| `TECHNICAL_DEBT.md` | **Ninguna TD tiene su pago en TASK-010.** Relacionadas, sin pago aquí: TD-011 (regla de no pasar `loadEnv()` entero; pago en TASK-027) y TD-012/TD-018 (URLs y salida sin restringir; pago en TASK-020). |
| testing-conventions | Regla 1: unitarios sin red. Regla 2: `FakeProvider` para todo test que invoque un modelo. Regla 4: sin timers reales, `vi.useFakeTimers()` o `AbortSignal` controlado. Regla 7: el objetivo de cobertura lo fija el DoD. Regla 13: el test de un fix tiene que fallar sin el fix. |
| TASK-019 (BLOCKED) | `ProviderRegistry`, reintentos con backoff y `retryAfterMs`, descontados del presupuesto. **TASK-010 no reintenta.** |

**Incoherencias que hay que avisar (no son de diseño; las corrige quien tenga permiso):**
- `.claude/agents/providers-dev.md:29` dice «La clave se lee de `process.env[apiKeyEnv]` en construcción». Contradice OD-017 y el DoD. Solo el humano edita `.claude/agents/**` (ADR-006). Hasta que se corrija, el TASK PACKET de providers-dev tiene que decir de forma explícita que manda el DoD (`secretResolver(apiKeyEnv)`).
- ~~SPEC `:479` (OD-054) dice que la tarea del sandbox (TASK-048, hoy BLOCKED) «debería ir antes de TASK-010». `TASKS.md:9` la deja READY después de TASK-047. Esto lo confirma el Orchestrator con el humano, no el plan.~~ Resuelta el 2026-11-10: «TASK-010 ahora» (SPEC `:489`).

### 0. Decisiones humanas (2026-11-10)

**Estado: plan aprobado.** Decisiones literales tomadas con AskUserQuestion el 2026-11-10:
- OD-A…OD-J: «Aceptar todas (Recommended)». Se aplican todas las recomendaciones de §7, registradas en SPEC §13 (`TECHNICAL_SPEC.md:388-397`):

  | Letra | Número | Decisión |
  |---|---|---|
  | OD-A | OD-057 | (a) `id: string` en las opciones |
  | OD-B | OD-058 | (a) `apiKeyEnv: string \| null`; con `null`, sin resolver y sin `Authorization` |
  | OD-C | OD-059 | Tabla de estados propuesta; la cancelación del llamador relanza `signal.reason` |
  | OD-D | OD-060 | (b) `requires` y también presencia de `tools`/`responseSchema` |
  | OD-E | OD-061 | (a) rol por defecto `req.model`, con `roleOf` opcional |
  | OD-F | OD-062 | (a) `msw` |
  | OD-G | OD-063 | (a) `pnpm-lock.yaml` entra en el scope |
  | OD-H | OD-064 | (a) se acepta `OPENAI_CUSTOM_HEADERS` y se registra como deuda LOW (TASK-020/027) |
  | OD-I | OD-065 | (a) `ProviderResponseError` con mensaje fijo + deuda LOW (código propio en TASK-020) |
  | OD-J | OD-066 | (a) cobertura del 90 % y `listModels` con 10 000 ms |
- Orden: «TASK-010 ahora (Recommended)». TASK-010 va antes de TASK-048, que sigue BLOCKED por ADR-013 (Proposed) y por `.claude/settings.local.json`. SPEC `:489` ajustada.
- Dependencias: «openai@7.45.1 + msw@3.0.3 (Recommended)», fijadas sin `^`. `openai` 7.45.1 en `dependencies` de `packages/providers`; `msw` 3.0.3 en `devDependencies`. `undici` queda descartada. El Orchestrator las pone en `deps_allowed`.
- Deuda que registra la tarea al cerrar: OD-064 (LOW) y OD-065 (LOW).
- **OD-067 (decisión humana, 2026-11-11, ciclo de corrección 3, por el MEDIUM M1 de security).** Decisión: «Overrides ahora (Recommended)». La antigüedad mínima de dos semanas rige también para las transitivas que entran nuevas o cambian en el lockfile (SPEC §13 OD-067; ARCHITECTURE §9 `:258`).
- **Paso de devops (antes de cerrar TASK-010).** Hay 12 transitivas de `msw@3.0.3` con menos de 14 días: `@inquirer/{ansi,confirm,core,figures,type}`, `tldts` y `tldts-core` 7.4.21, `@mswjs/interceptors@0.45.12`, `ansi-regex@6.6.0`, `cookie@2.0.2`, `tough-cookie@6.1.0` y `set-cookie-parser@3.2.2`.
  - Se fijan en `pnpm.overrides` del `package.json` raíz, con selectores padre>hijo cuyos padres hoy solo llegan a través de msw; 9 de los 13 tienen padre distinto de msw (deuda L6: acotar por versión del padre, TASK-040). Se fijan en versiones publicadas antes del 2026-10-28 y dentro de los rangos `^` que piden sus padres.
  - Después, `pnpm install` regenera `pnpm-lock.yaml`.
  - El scope de TASK-010 se amplía con `package.json` (raíz); `pnpm-lock.yaml` ya estaba por OD-063.
  - Evidencia: fecha de publicación de cada versión fijada (registry, campo `time`) y `pnpm why` de cada paquete.
  - Security vuelve a verificar M1 con cita del lockfile.
  - La automatización (resolution-mode / minimumReleaseAge) queda para TASK-040.

En el resto del plan, las referencias usan ya el número (OD-057…OD-066). §7 conserva las opciones tal como se presentaron.

### 2. Diseño

**Ficheros** (todos dentro de `packages/providers/**`, salvo el lockfile de OD-063):

```
packages/providers/
├── package.json            # @agentlab/providers; exports "." y "./testing"
├── tsconfig.json           # extends ../../tsconfig.base.json, rootDir src (igual que core)
├── tsconfig.config.json    # typecheck de vitest.config.ts (igual que core)
├── vitest.config.ts        # coverage v8; umbral según OD-J
└── src/
    ├── index.ts                         # OpenAICompatibleProvider + tipo de opciones
    ├── index.test.ts                    # exports, mapa de sub-exports, escaneo estático de process.env
    ├── capabilities.ts                  # assertCapabilities(id, caps, req): interno (no se exporta)
    ├── capabilities.test.ts
    ├── openai-compatible/
    │   ├── provider.ts                  # clase; SDK en campo #private
    │   ├── mapping.ts                   # GenerateRequest → params del SDK; respuesta → GenerateResponse
    │   ├── errors.ts                    # toProviderError(err, ctx), parseRetryAfterMs(headers, nowMs)
    │   ├── mapping.test.ts              # puros, sin servidor
    │   ├── errors.test.ts               # puros: tabla de estados y Retry-After
    │   ├── provider.test.ts             # con servidor HTTP falso (OD-062)
    │   └── no-leak.test.ts              # canario: clave y cabeceras fuera de errores e instancia
    └── testing/
        ├── index.ts                     # FakeProvider y sus tipos
        ├── fake-provider.ts
        └── fake-provider.test.ts
```

El índice no reexporta `testing/` (los fakes quedan fuera del punto de entrada de runtime). No hay `ProviderRegistry` (es de TASK-019) ni logger (el adaptador no registra nada).

**`package.json`:**
```json
{
  "name": "@agentlab/providers",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts", "./testing": "./src/testing/index.ts" },
  "scripts": {
    "typecheck": "tsc --noEmit && tsc --noEmit -p tsconfig.config.json",
    "lint": "eslint .",
    "test": "vitest run --coverage"
  },
  "dependencies": { "@agentlab/core": "workspace:*", "openai": "7.45.1" },
  "devDependencies": { "msw": "3.0.3" }
}
```
(`msw` depende de OD-062. `vitest`, `vite`, `@vitest/coverage-v8` y `typescript` ya están en la raíz.)

**Contratos públicos** (todos nuevos; ninguno de `core` cambia):

```ts
// @agentlab/providers
export interface OpenAICompatibleProviderOptions {
  readonly id: string;                      // OD-057 (el DoD no lo lista y ModelProvider.id lo exige)
  readonly baseUrl: string;
  readonly apiKeyEnv: string | null;        // OD-058 (null = sin clave, Ollama)
  readonly capabilities: ProviderCapabilities;
  readonly secretResolver: SecretResolver;
}
export class OpenAICompatibleProvider implements ModelProvider {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;   // copia congelada (Object.freeze)
  constructor(options: OpenAICompatibleProviderOptions);
  listModels(): Promise<ModelInfo[]>;            // GET /models → [{ id }]
  generate(req: GenerateRequest, signal: AbortSignal): Promise<GenerateResponse>;
}

// @agentlab/providers/testing
export type FakeStep =
  | { readonly kind: "respond"; readonly content?: string | null; readonly toolCalls?: readonly ToolCall[];
      readonly usage?: GenerateResponse["usage"]; readonly costReported?: number | null }
  | { readonly kind: "rateLimit"; readonly retryAfterMs?: number }
  | { readonly kind: "timeout" }
  | { readonly kind: "invalidOutput"; readonly content?: string };
export interface FakeCall { readonly role: string; readonly request: GenerateRequest }
export interface FakeProviderOptions {
  readonly id?: string;                                        // por defecto "fake"
  readonly capabilities?: ProviderCapabilities;                // por defecto: ver más abajo
  readonly script: Readonly<Record<string, readonly FakeStep[]>>;
  readonly roleOf?: (req: GenerateRequest) => string;          // OD-E
  readonly models?: readonly ModelInfo[];                      // por defecto []
}
export class FakeProvider implements ModelProvider {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;
  readonly calls: readonly FakeCall[];          // registro para las aserciones de los tests
  constructor(options: FakeProviderOptions);
  listModels(): Promise<ModelInfo[]>;
  generate(req: GenerateRequest, signal: AbortSignal): Promise<GenerateResponse>;
}
```

Clase y no función `buildX(deps)`: el DoD nombra `OpenAICompatibleProvider({ … })` y exige que la clave no esté en propiedades enumerables. Un campo `#private` lo da sin estado de módulo. Ninguna de las dos clases guarda estado de módulo: el cursor del guion y `calls` son de cada instancia.

**Construcción del adaptador (orden):**
1. `baseUrl`: tiene que ser una URL `http:`/`https:` no vacía. Si no lo es, error en construcción (OD-065). Motivo: con `baseURL` vacío, el SDK cae en `https://api.openai.com/v1` (`client.ts:598` de openai 7.45.1, `baseURL || …`) y mandaría la clave de OpenRouter a OpenAI. El mensaje no incluye la URL, porque puede llevar credenciales (TD-012).
2. Clave: si `apiKeyEnv !== null`, `const key = secretResolver(apiKeyEnv)` **una sola vez**. Si es `undefined` o `""`, se lanza `ProviderAuthError` y no se crea cliente. El mensaje cita el nombre solo si `isApiKeyEnvName(apiKeyEnv) && apiKeyEnv.length <= 40` (la misma regla que `InvalidApiKeyEnvError`). Si no la cumple, el mensaje es fijo y no lo cita: un `api_key_env` mal configurado podría ser la propia clave pegada por error (SPEC §9.1). El DoD dice «cita el nombre, nunca un valor». Con esta regla se cumplen las dos cosas.
3. `#client = new OpenAI({ apiKey, baseURL, organization: null, project: null, adminAPIKey: null, webhookSecret: null, maxRetries: 0, logLevel: "off", … })`. Todas las opciones explícitas, porque el SDK lee `process.env` para cualquier opción que llegue `undefined`. En openai 7.45.1 (`client.ts:554-561`, `:651`, `:658`) lee `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `OPENAI_ADMIN_KEY`, `OPENAI_ORG_ID`, `OPENAI_PROJECT_ID`, `OPENAI_WEBHOOK_SECRET` y `OPENAI_LOG`. Los valores por defecto de la desestructuración solo se evalúan con `undefined`, así que con `null` o un valor explícito esas lecturas no ocurren. Queda una sin opción para evitarla: `OPENAI_CUSTOM_HEADERS` (OD-064).
   - `maxRetries: 0` es obligatorio. El SDK reintenta 2 veces por defecto, y esas llamadas no pasarían por el presupuesto. Los reintentos son de TASK-019.
   - `logLevel: "off"`. Si no, el SDK escribe con `console` (`client.ts:645`), que está prohibido en paquetes, y en `debug` registraría las peticiones.
4. `id` y `capabilities` (copia congelada) son las únicas propiedades públicas. El cliente del SDK, que expone `apiKey` como propiedad pública suya, solo vive en `#client`. No se guarda `key` en ningún otro campo. No hace falta `toJSON`: `JSON.stringify` serializa solo `id` y `capabilities`, y el test lo comprueba.

**`generate(req, signal)` (orden):**
1. `assertCapabilities` → `ProviderCapabilityError` antes de la red (alcance según OD-060).
2. Si `signal.aborted`, se cancela sin red (semántica según OD-059).
3. Timeout por petición: `AbortController` propio + `setTimeout(abort, req.timeoutMs)` + `AbortSignal.any([signal, own.signal])`. Se pasa como `signal` al SDK, con `timeout: req.timeoutMs` y `maxRetries: 0` también por petición. `clearTimeout` en `finally`. Se usa `setTimeout` y no `AbortSignal.timeout()` para que `vi.useFakeTimers()` lo controle (testing-conventions, regla 4).
4. `client.chat.completions.create(toChatParams(req), { signal, timeout, maxRetries: 0 })`, sin streaming.
5. `fromChatCompletion(res)`.
6. Cualquier excepción pasa por `toProviderError(err, { id, callerAborted: signal.aborted, timedOut: own.signal.aborted })`.

**Mapeo de la petición (`mapping.ts`):** `model`; `messages` (`role`/`content` tal cual); `max_tokens: req.maxOutputTokens` (Ollama documenta `max_tokens` y no `max_completion_tokens`; docs.ollama.com/api/openai-compatibility, consultado el 2026-11-10); `temperature` solo si viene definida (`exactOptionalPropertyTypes`); `tools` → `[{ type: "function", function: { name, description, parameters } }]` si vienen; `responseSchema` → `response_format: { type: "json_schema", json_schema: { name: "response", schema } }` sin `strict` (el modo estricto de OpenAI exige que todo sea `required` y `additionalProperties: false`, y la validación real del resultado es Zod en el orquestador). `stream: false`.

**Mapeo de la respuesta:**
- Sin `choices[0]` → `ProviderResponseError` (`retryable: false`).
- `content` = `message.content` (`string | null`).
- `toolCalls`: solo `type: "function"` → `{ id, name, arguments }`. `arguments` es `JSON.parse` del string. Si no es JSON válido, se deja el string tal cual: `ToolCall.arguments` es `unknown`, y la validación Zod de la herramienta lo rechaza aguas abajo. Alternativa descartada: lanzar `ProviderResponseError`, porque convierte una salida inválida del modelo en un error de proveedor (en la invocación quedaría `error` en lugar de `invalid_output`). Un tipo que no sea `function` → `ProviderResponseError`, para no ignorarlo en silencio.
- `usage`: `inputTokens = usage.prompt_tokens` y `outputTokens = usage.completion_tokens`, cada uno `null` si falta o no es un entero ≥ 0. Si no hay `usage`, los dos son `null`. No se calculan a partir de `total_tokens` (ADR-003 §5).
- `costReported`: `usage.cost` si es un número finito ≥ 0 (OpenRouter lo devuelve siempre, «Cost in credits»; openrouter.ai/docs/use-cases/usage-accounting, consultado el 2026-11-10); si no, `null`.
- `raw`: no se rellena nunca. No hay «modo debug» definido, y es un canal más de fuga.
- La respuesta del SDK se lee con guardas de tipo, sin `as`. Sin Zod en `providers`: no es dependencia del paquete, y añadirla iría a `deps_allowed`.

**Mapeo de errores (`errors.ts`).** Las tres primeras filas las fija el DoD; el resto está en OD-059:

| Origen | Error de `core` | `retryable` |
|---|---|---|
| HTTP 401 | `ProviderAuthError` | false |
| HTTP 429 | `ProviderRateLimitError` con `retryAfterMs` si hay cabecera | true |
| Timeout propio vencido o `APIConnectionTimeoutError` del SDK | `ProviderTimeoutError` | true |
| `signal` del llamador abortado | OD-059 | — |
| 403 / 408 / 409, 5xx / otros 4xx / error de conexión / respuesta mal formada / desconocido | OD-059 (recomendación allí) | — |

`parseRetryAfterMs(headers, nowMs)`: lee `retry-after-ms` (número ≥ 0, la misma cabecera que usa el SDK, `client.ts:2177`), luego `retry-after` en segundos (×1000) y luego `retry-after` como fecha HTTP (`max(0, fecha − nowMs)`). Si nada de eso es válido, `undefined` (y `retryAfterMs` no se pasa, `exactOptionalPropertyTypes`). Sin tope: la política es de TASK-019.

**Cómo se garantiza que no se filtran la clave ni las cabeceras:**
1. **Mensajes con plantilla fija**: solo el `id` del proveedor, el estado HTTP y un texto constante (por ejemplo, `Provider "openrouter" rate limited the request (HTTP 429)`). **Nunca** el `message` del SDK: `APIError.makeMessage` (`core/error.ts:37-55` del SDK) incluye el cuerpo de error del servidor, y un servidor o proxy que devuelva la cabecera `Authorization` en el cuerpo filtraría la clave. Tampoco la `baseUrl` ni la URL de la petición.
2. **Sin `cause`**: el error del SDK no se adjunta (lleva `headers` de respuesta, `error` con el cuerpo y, en conexión, el `TypeError` de fetch). Se pierde detalle de diagnóstico. A cambio, ningún canal depende de redactar bien. Volver a meter detalle saneado es tarea de `redactSecrets` (TASK-027).
3. **Instancia**: la clave solo vive dentro de `#client` (con `JSON.stringify`, `Object.keys`, `Object.getOwnPropertyNames` e `util.inspect`, incluso con `showHidden`, no se ven los campos `#private`; el test lo comprueba en lugar de suponerlo, ver riesgos).
4. **Sin logs**: `logLevel: "off"`; el adaptador no recibe logger.
5. **Sin lectura de `process.env`** en el código del paquete; las opciones explícitas del SDK evitan sus lecturas (punto 3 de la construcción), salvo `OPENAI_CUSTOM_HEADERS` (OD-064).

**`FakeProvider`:**
- Guion por rol: `script[role]` es una lista de pasos que se consume en orden y por separado para cada rol. El rol sale de `roleOf(req)` (OD-061).
- Pasos:
  - `respond` devuelve `content`, `toolCalls` (por defecto `[]`), `usage` (por defecto los dos campos `null`, nunca estimado) y `costReported` (por defecto `null`).
  - `rateLimit` lanza `ProviderRateLimitError` con `retryAfterMs`.
  - `timeout` lanza `ProviderTimeoutError` al momento, sin esperar: es determinista y no usa reloj.
  - `invalidOutput` devuelve un `content` que no cumple ningún esquema (por defecto, un texto fijo que no es JSON).
- Si el guion de un rol se agota o el rol no existe, se lanza `ProviderResponseError` (`retryable: false`) con el nombre del rol. Así se falla de forma visible en lugar de repetir el último paso.
- Aplica el mismo `assertCapabilities` y la misma semántica de `signal` abortado (OD-059) que el adaptador, para que los tests del orquestador ejerzan esos caminos.
- Capacidades por defecto: `{ tools: true, structuredOutput: true, streaming: false, maxContextTokens: null, reportsUsage: true, reportsCost: false }`.
- Sin aleatoriedad, sin timers y sin red. Registra cada llamada en `calls`.

### 3. Dependencias nuevas (aprobadas por el humano el 2026-11-10: `openai@7.45.1` y `msw@3.0.3`; ver «Decisiones humanas»)

Verificado el 2026-11-10 contra registry.npmjs.org (campo `time`) y la API de avisos de GitHub (`api.github.com/advisories?ecosystem=npm&affects=<pkg>`). El corte de las dos semanas es el 2026-10-27.

| Paquete | Versión propuesta | Workspace | Publicada | Notas |
|---|---|---|---|---|
| `openai` | `7.45.1` | `providers` `dependencies` | 2026-10-27T15:49Z (14 días el 2026-11-10T15:49Z) | `latest` es 7.55.0 (2026-11-10). Todas las 7.46+ tienen menos de dos semanas. 7.45.1 es la más reciente que cumple: solo arregla documentación y Vertex (CHANGELOG). Sin `dependencies`, sin scripts de instalación, `engines.node >=22.0.0`, Apache-2.0, procedencia SLSA. Sus peers (`zod`, `ws`, `undici`, `@smithy/*`, `google-auth-library`, `@aws-sdk/*`) son **todos opcionales**. Tamaño desempaquetado: 23 MB. Avisos GitHub: **ninguno**. Es la dependencia que fija SPEC §3; no hay alternativa sin ella. |
| `msw` | `3.0.3` | `providers` `devDependencies` | 2026-10-10 | Solo si OD-062 = (a). `latest` es 3.0.4 (2026-11-06, menos de dos semanas). `engines.node >=22.12.0` y peer opcional `typescript >=5.9.x`: el monorepo cumple los dos. 12 dependencias directas con `^` (`yargs`, `@inquirer/confirm`, `tough-cookie`, `@mswjs/interceptors`…): security tiene que revisar el árbol transitivo en el lockfile (fechas y avisos). Avisos GitHub para `msw`: ninguno. |
| ~~`undici`~~ (descartada: OD-062 = (a)) | `8.12.3` | `providers` `devDependencies` | 2026-10-19 | Solo si OD-062 = (b). Sin dependencias, `engines.node >=22.19.0` (Node 22.23.3 cumple). **Las 8.x anteriores a 8.12.2 tienen varios avisos HIGH de 2026-10-23/27** (por ejemplo GHSA-2m5v-pch6-74hx y GHSA-4w7w-5xrc-9h26). 8.12.3 está parcheada. |

Alternativa sin dependencia de test: OD-062 (c).

### 4. Pasos para providers-dev

0. **Antes de empezar** (Orchestrator/humano): decisiones OD-057…OD-066 (tomadas el 2026-11-10); `deps_allowed` con las versiones aprobadas; scope ampliado con `pnpm-lock.yaml` (OD-063); TASK PACKET que deje claro que la clave se obtiene con `secretResolver`, no con `process.env` (ver la incoherencia de `providers-dev.md:29`).
1. Esqueleto del paquete e instalación → ficheros: `packages/providers/package.json`, `tsconfig.json`, `tsconfig.config.json`, `vitest.config.ts`, `src/index.ts`, `pnpm-lock.yaml` (OD-063). `pnpm install` solo con las dependencias aprobadas, y `pnpm why openai` en el informe.
2. Comprobación de capacidades → `src/capabilities.ts`, `src/capabilities.test.ts`.
3. Errores y `Retry-After` (puros) → `src/openai-compatible/errors.ts`, `errors.test.ts`.
4. Mapeo de petición y respuesta (puro) → `src/openai-compatible/mapping.ts`, `mapping.test.ts`.
5. Adaptador → `src/openai-compatible/provider.ts`, `provider.test.ts`, `no-leak.test.ts`. Antes de escribirlo, verificar contra el paquete instalado las opciones del SDK citadas en este plan (`client.ts` de 7.45.1).
6. FakeProvider → `src/testing/fake-provider.ts`, `src/testing/index.ts`, `src/testing/fake-provider.test.ts`.
7. Exports y escaneo estático → `src/index.ts`, `src/index.test.ts`.
8. `pnpm --filter @agentlab/providers typecheck lint test` y `pnpm -r typecheck lint` (por si el paquete nuevo rompe la raíz), por el camino habitual de la tarea (contenedor o `make`), y el informe IMPLEMENTATION.

### 5. Tests

Todos unitarios, sin red real y sin timers reales.

- **Servidor HTTP falso** (OD-062). Con msw: `setupServer` de `msw/node` en `beforeAll`, **antes** de construir cualquier cliente, porque el SDK captura `globalThis.fetch` en su constructor (`shims.ts:11-13`, `Shims.getDefaultFetch()`). Peticiones no previstas → error. Un handler por caso, que registra método, ruta y cabeceras recibidas.
- **Clave y resolver** (viñetas 1 y 2):
  - El resolver (`vi.fn`) se llama una vez, en la construcción, con `apiKeyEnv`, y ninguna vez en `generate`.
  - El servidor recibe `Authorization: Bearer <canario>`. Es el control positivo: sin él, los tests de fuga podrían pasar en vacío.
  - Resolver que devuelve `undefined` o `""` → `ProviderAuthError` en `new`, y el servidor no recibe ninguna petición.
  - El mensaje contiene el nombre cuando cumple el patrón, y no contiene el nombre cuando no lo cumple (por ejemplo `apiKeyEnv: "sk-canary-value"`).
  - Con `apiKeyEnv: null` (OD-058), no se llama al resolver y la petición sale sin `Authorization`.
- **Fuera de la instancia**: el canario no aparece en `JSON.stringify(provider)`, en `Object.keys`/`getOwnPropertyNames` ni en `util.inspect(provider, { showHidden: true, depth: Infinity })`.
- **`process.env`** (viñeta 1):
  - (i) Escaneo estático de `src/**/*.ts` (sin `*.test.ts`): ninguna aparición de `process.env`, `process[`, `globalThis.process` ni `node:process`.
  - (ii) Prueba de comportamiento: con `vi.stubEnv` se ponen valores canario en `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_ORG_ID`, `OPENAI_PROJECT_ID` y `OPENAI_LOG=debug`. La petición tiene que ir a `baseUrl`, con la clave del resolver, sin cabeceras `OpenAI-Organization`/`OpenAI-Project`, y sin ninguna llamada a `console.*` (espía). `vi.stubEnv` escribe en el entorno, no lo lee, y `restoreMocks`/`unstubEnvs` lo deshace. El reviewer no debe tomarlo por una lectura.
- **Canario en errores** (viñeta 3). Para 401, 403, 429, 500, 400 y error de red (`HttpResponse.error()`) y para el timeout, el servidor responde con un cuerpo de error que **repite** la cabecera `Authorization` recibida y una cabecera de respuesta con el canario. El canario no puede aparecer en `err.message`, `String(err.cause)`, `err.stack`, `JSON.stringify(err)` ni `util.inspect(err, { showHidden: true, depth: Infinity })`. Para la regla 13: el implementador muestra que, si se pasa el `message` del SDK o se adjunta `cause`, el test falla.
- **Timeout y mapeo** (viñeta 4):
  - Handler que no responde nunca (promesa que solo se resuelve con `request.signal`). Con `vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })` y `advanceTimersByTimeAsync(timeoutMs)` → `ProviderTimeoutError`, `retryable: true`.
  - El `signal` del llamador abortado antes o durante la llamada da el resultado de OD-059, no `ProviderTimeoutError`.
  - 401 → `ProviderAuthError`; 429 con `retry-after: 2` → `retryAfterMs: 2000`; 429 con `retry-after-ms`; 429 sin cabecera → `retryAfterMs` `undefined`.
  - Tabla pura en `errors.test.ts` para el resto de estados y para las fechas HTTP.
  - Con `maxRetries: 0`, ante un 500 el servidor recibe una sola petición.
- **Capacidades**: `requires.tools` (y `structuredOutput`) con la capacidad a `false` → `ProviderCapabilityError` y **cero** peticiones al servidor (alcance según OD-060).
- **`usage`** (viñeta 5): con `usage` completo pasa tal cual; sin `usage`, `{ inputTokens: null, outputTokens: null }`; con un campo suelto ausente, solo ese a `null`; `cost` presente o ausente → `costReported` número o `null`.
- **Mapeo**: `max_tokens`, `temperature` ausente cuando no viene, `tools`, `response_format`, tool call con argumentos no JSON (se queda el string), respuesta sin `choices` → `ProviderResponseError`. `listModels` → `[{ id }]`.
- **FakeProvider** (viñeta 6): orden del guion por rol e independencia entre roles; mismo guion, misma secuencia en dos instancias (determinismo); `rateLimit` con y sin `retryAfterMs`; `timeout`; `invalidOutput`; guion agotado → `ProviderResponseError`; `calls` registra cada llamada; capacidad no soportada → `ProviderCapabilityError`; `signal` abortado.
- **Exports** (viñeta 6): `Object.keys` de `./index.js` = `["OpenAICompatibleProvider"]`; `Object.keys` de `./testing/index.js` = `["FakeProvider"]`; el campo `exports` de `package.json` es exactamente `{ ".", "./testing" }` y los ficheros existen (mismo patrón que `persistence/src/index.test.ts`).
- **Cobertura**: OD-066.

### 6. Riesgos

- **R1 — El SDK lee el entorno.** Con todas las opciones explícitas no lee ninguna variable salvo `OPENAI_CUSTOM_HEADERS` (OD-064). Una versión nueva del SDK podría añadir otra. Mitigación: el test de comportamiento (ii) y fijar la versión exacta. Cualquier subida del SDK repite ese test.
- **R2 — `util.inspect` y los campos `#private`.** Hoy Node no los muestra (discusión abierta en nodejs/node#27404). Si alguna versión de Node empezara a mostrarlos, el test de la instancia falla y hay que revisar (cierre en lugar de campo privado). El test lo detecta; no se supone.
- **R3 — msw y los timers falsos.** msw 3 ya no parchea `setTimeout` frente a los timers falsos (notas de la versión 3.0.0, github.com/mswjs/msw/releases/tag/v3.0.0, consultadas el 2026-11-10). Hay que falsificar solo `setTimeout`/`clearTimeout`/`Date` y avanzar con la variante asíncrona. Si msw se cuelga con los timers falsos, la alternativa es el `AbortSignal` controlado de la regla 4: se aborta el controlador propio desde el test mediante un `setTimeout` falso.
- **R4 — Cadena de suministro.** `openai` 7.x publica casi a diario (11 versiones del 2026-10-27 al 2026-11-10). La versión fijada envejece rápido, pero subirla es una tarea aparte. Los transitivos de `msw` entran con `^`: security revisa el lockfile y el `audit` del CI (fail-closed, OD-050).
- **R5 — undici dentro de Node.** El SDK usa el `fetch` global, es decir, el undici que trae Node 22.23.3. Hay avisos HIGH de undici del 2026-10-23/27. La subida de Node a 22.23.4 es TASK-042; security tiene que valorar si debe ir antes de usar el adaptador contra proveedores reales (TASK-017).
- **R6 — Menos diagnóstico.** Sin `cause` ni el cuerpo del error, un 400 de OpenRouter solo dice «HTTP 400». Es un coste aceptado hasta `redactSecrets` (TASK-027).
- **R7 — Capacidades declaradas por configuración.** `capabilities` las pone quien construye el adaptador. Si una configuración declara `structuredOutput: true` en un modelo de Ollama que no lo soporta, el error llega del servidor (400 → `ProviderResponseError`), no antes de la red. Comprobar las capacidades reales es de TASK-019/TASK-022.
- **R8 — Scope.** Instalar dependencias toca `pnpm-lock.yaml` en la raíz, fuera de `packages/providers/**` (OD-063). Si no se amplía, providers-dev queda bloqueado en el paso 1.
- **R9 — Documentación que queda por actualizar al cerrar** (HECHO el 2026-11-11: ARCHITECTURE §2 `:60` y §9 `:279-280`) (fuera del scope de implementación): filas de `openai` (y `msw`/`undici`) en ARCHITECTURE §9, y «previsto» → «actual» para `@agentlab/providers/testing` en ARCHITECTURE §2. Lo hace architect o docs-keeper en el cierre.

**Security: REQUIRED.** La tarea maneja secretos (resolver, clave en memoria, errores), abre salida de red hacia URLs configurables y añade dependencias de runtime (`openai`) y de test. Vectores: secretos, SSRF (`baseUrl`; el endurecimiento es de TD-012, en TASK-020) y dependencias.

### 7. OPEN DECISIONS

**Todas RESUELTAS el 2026-11-10 por el humano** con la opción recomendada (ver §0 y SPEC §13 `:388-397`). Se conservan las opciones tal como se presentaron.

- **OD-057 — `id` del proveedor.** `ModelProvider.id` es obligatorio y la firma del DoD no lo incluye. (a) Añadir `id: string` a las opciones; es la clave con la que TASK-019 registrará el proveedor y la que citan los mensajes. (b) Constante `"openai-compatible"`: OpenRouter y Ollama serían indistinguibles en eventos y errores. (c) Derivarlo del host de `baseUrl`: frágil, y expone la URL. **Recomiendo (a).**
- **OD-058 — `apiKeyEnv` nulo (Ollama).** ARCHITECTURE §6 admite `api_key_env NULL` («Ollama no tiene clave»), y el DoD solo trata el caso de un nombre que no resuelve. El SDK exige alguna clave (`client.ts:631-633`). (a) `apiKeyEnv: string | null`: con `null` no se llama al resolver, el SDK recibe un marcador fijo no secreto y la cabecera `Authorization` se elimina con `defaultHeaders: { Authorization: null }` (el SDK aplica `defaultHeaders` después de las cabeceras de autenticación, `client.ts:791-799`). (b) Obligar a declarar una `OLLAMA_API_KEY` ficticia en `env.ts`: toca `core`, fuera de scope, y obliga a una clave falsa. (c) Mandar `Authorization: Bearer <marcador>` sin quitarla: Ollama la ignora, pero envía una cabecera que no significa nada. **Recomiendo (a).**
- **OD-059 — Resto del mapeo de errores y cancelación externa.** El DoD fija 401, 429 y timeout. Para lo demás no hay regla en SPEC ni en ARCHITECTURE. Propuesta: 403 → `ProviderAuthError`; 408 → `ProviderTimeoutError`; 409 y 5xx → `ProviderResponseError` con `retryable: true` (los mismos estados que el SDK considera transitorios); otros 4xx → `ProviderResponseError` con `retryable: false`; error de conexión → `ProviderResponseError` con `retryable: true`; respuesta mal formada o error desconocido → `ProviderResponseError` con `retryable: false`. Para la **cancelación por el `signal` del llamador**: (a) relanzar `signal.reason` tal cual (semántica estándar de `AbortSignal`; el orquestador la distingue por `cancelRequested`); (b) `ProviderTimeoutError`: incorrecto, porque es `retryable` y TASK-019 reintentaría una llamada cancelada; (c) código nuevo `PROVIDER_ABORTED` en `core`: toca `core`, fuera de scope y amplía la lista cerrada. **Recomiendo la tabla propuesta y (a).**
- **OD-060 — Alcance de la comprobación de capacidades.** ARCHITECTURE §3.1 solo dice «si `req.requires.tools` y `capabilities.tools === false`». SPEC §2.1 (que prevalece) dice «nunca degrada en silencio». (a) Comprobar solo `requires.tools` y `requires.structuredOutput` (literal), y si `tools` o `responseSchema` vienen sin `requires`, mandarlos igualmente. (b) Comprobar `requires` **y** también la presencia de `tools` o `responseSchema` cuando la capacidad es `false`. (c) Comprobar `requires`, y omitir en silencio `tools`/`responseSchema` cuando no hay capacidad. Esto es degradación silenciosa y va contra SPEC. **Recomiendo (b).** Además: el DoD de TASK-010 no menciona la comprobación, pero ARCHITECTURE y SPEC la ponen en el adaptador. Recomiendo hacerla aquí, en `capabilities.ts`, compartida con `FakeProvider`, y que TASK-019 la reutilice en el registry.
- **OD-061 — Cómo sabe `FakeProvider` el rol.** `GenerateRequest` no lleva rol (OD-013 lo dejó mínimo). (a) Por defecto `req.model` (cada agente de test usa un `modelId` distinto), con `roleOf` opcional para sustituirlo. (b) `roleOf` obligatorio, sin valor por defecto. (c) Añadir `role` a `GenerateRequest`: cambia `core` y ARCHITECTURE §3.1, y el contrato del proveedor no debería conocer roles. **Recomiendo (a).** Dos cosas que vigilar: TASK-012 (`teams/research.ts`) y TASK-015 (`AGENTLAB_PROVIDER=fake`) tienen que dar a cada rol un `modelId` distinto o pasar su propio `roleOf`.
- **OD-062 — Servidor HTTP falso (el DoD deja elegir).** (a) `msw` 3.0.3 (dev): intercepta el `fetch` global dentro del proceso, sin red (regla 1), sin tocar la API pública; trae unas 12 dependencias directas. (b) `undici` 8.12.3 (dev) con `MockAgent`: sin dependencias, pero hay que pasarlo al SDK, con `setGlobalDispatcher` (la compatibilidad entre undici 8 y el undici 6.x que trae Node 22 no está verificada) o con una opción `fetch` en el constructor (un punto de inyección solo para tests en la API pública). (c) Sin dependencia: opción interna `fetch` y un `fetch` falso escrito a mano que devuelve `Response`. Es cero cadena de suministro, pero se aparta de la letra del DoD («msw o undici mock») y también abre la API para los tests. **Recomiendo (a).** Si el humano prefiere no añadir dependencias de test, (c) con la viñeta del DoD reescrita.
- **OD-063 — Ampliación de scope.** `pnpm install` modifica `pnpm-lock.yaml` (raíz), que está fuera de `packages/providers/**`. (a) Añadir `pnpm-lock.yaml` al scope de TASK-010. (b) Paso 0 de devops (como en TASK-004): `package.json` del paquete con las dependencias, e instalación. **Recomiendo (a):** un único fichero, generado, y lo revisa security.
- **OD-064 — `OPENAI_CUSTOM_HEADERS`.** openai 7.45.1 la lee siempre (`client.ts:658`), sin opción para evitarlo, y añade sus cabeceras a todas las peticiones. Hoy el `worker` de Compose solo recibe variables explícitas (`compose.yaml:75-85`), así que no le llega; en el host (tests, desarrollo) sí podría. (a) Aceptarlo y documentarlo como deuda LOW, con pago en TASK-020 (endurecimiento de salida) o TASK-027. (b) Envolver `fetch` con una lista blanca de cabeceras: más código y más superficie en el camino crítico. **Recomiendo (a).**
- **OD-065 — Error para configuración inválida (`baseUrl`).** Una `baseUrl` vacía hace que el SDK use `api.openai.com` y le mande la clave. La lista cerrada de códigos de `core` no tiene ninguno de configuración. (a) `ProviderResponseError` (`retryable: false`) con un mensaje fijo que no incluye la URL, más deuda LOW para crear un código propio en TASK-020. (b) Código nuevo `PROVIDER_CONFIG_INVALID` en `core`: hay que ampliar el scope a `packages/core/src/errors.ts` y sus tests, y añadir core-dev. (c) No validar: deja abierto el envío de la clave a OpenAI. **Recomiendo (a).** Hay que decidirlo antes del paso 5.
- **OD-066 — Cobertura y timeout de `listModels`.** El DoD no fija cobertura (testing-conventions, regla 7) y `listModels()` no recibe `timeoutMs` (ARCHITECTURE §3.1). Si no se fija, se queda con el valor por defecto del SDK, 10 minutos. (a) Umbral del 90 % como `core`, y una constante del adaptador de 10 000 ms para `listModels`. (b) Sin umbral, y `listModels` con el valor por defecto del SDK. **Recomiendo (a).** Los dos valores son propuesta; el humano los fija.
