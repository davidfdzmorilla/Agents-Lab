## PLAN — TASK-018
Fecha: 2026-11-16
Estado: **APROBADO por el humano el 2026-11-16** («Aprobar todo (Recommended)»): opción (a) en OD-076 … OD-083, `@google/genai@2.32.0` en `deps_allowed` para devops con override de `ws` a 8.22.1, scope de §4 y security REQUIRED. Registradas en SPEC §13.

Contexto: segundo adaptador de `packages/providers`. ADR-003 §3 (Accepted) y SPEC §2.1 (`:73`) y §3 (`:89`) lo fijan: un adaptador `gemini` sobre el SDK de Google GenAI que implementa `ModelProvider` de `core`. Su comportamiento observable tiene que ser igual al de `OpenAICompatibleProvider` (TASK-010): capacidades antes de la red, errores normalizados según OD-059, cancelación según OD-059 (a), clave solo vía `SecretResolver` (OD-017) y sin fugas. **Esta tarea no cambia `core`.** `env.ts` ya declara `GEMINI_API_KEY` (`packages/core/src/env.ts:30`) y `compose.yaml:85` ya se la pasa al `worker`.

DoD literal (`TASKS.md:394-396`): «misma superficie que OpenAI-compatible; capacidades declaradas reales; mapeo de errores; tests con mock del SDK».

### 1. Referencias que gobiernan la tarea

| Fuente | Qué fija |
|---|---|
| ADR-003 (Accepted) §1, §3–§5 | Contrato `ModelProvider`. Adaptador `gemini` **con el SDK**. Fallo antes de la red. `usage`/`costReported` `null` si no se informan. |
| SPEC §2.1 `:73`, §3 `:89` | «Gemini tiene adaptador propio sobre el SDK de Google GenAI». Stack: «SDK de Google GenAI». |
| SPEC §9.1 | Claves fuera del repositorio, las tablas, los eventos, los prompts y las trazas. |
| SPEC §13: OD-017, OD-057…OD-067 | Resolver inyectado; `id` en las opciones; tabla de errores y cancelación; alcance de `assertCapabilities`; msw; cobertura del 90 % y `listModels` a 10 000 ms; antigüedad de las transitivas. |
| ARCHITECTURE §2 `:53`, §3.1 `:64-104` | `providers` contiene `gemini`. Firmas y errores con `retryable`. |
| ARCHITECTURE §9 `:256-258` | Versión exacta. Dos semanas de antigüedad, también para las transitivas (OD-067), con `pnpm.overrides` padre>hijo si no se cumple. |
| `TASK-010-plan.md`, `TASK-010.md` | Modelo a seguir: opciones explícitas del SDK, mensajes de error con plantilla fija y sin `cause`, `#client`, tests con msw, regla 13. |
| TECHNICAL_DEBT | **Ninguna TD se paga en TASK-018.** Afectan al diseño: TD-140 (overrides, TASK-040), TD-141 (redirecciones/URL, TASK-020), TD-144 (errores sin cuerpo, TASK-027), TD-145 (capacidades por modelo, TASK-019/022), TD-157 (scope frente a role-guard: se aplica en §4) y TD-158 (nada de Node en el host: este plan no ejecutó Node, pnpm ni npx). |
| `.claude/hooks/role-guard.sh:26,29` | providers-dev solo edita `packages/providers/**`. devops edita `package.json`, `pnpm-lock.yaml` y `packages/*/package.json`. |

**Incoherencia que sigue abierta (solo la corrige el humano, ADR-006):** `.claude/agents/providers-dev.md:29` dice «La clave se lee de `process.env[apiKeyEnv]` en construcción». Contradice OD-017. Igual que en TASK-010, el TASK PACKET de providers-dev tiene que decir de forma explícita que manda `secretResolver(apiKeyEnv)`.

### 2. Dependencia (verificado el 2026-11-16)

Fuentes: `registry.npmjs.org/<pkg>` (campo `time`, descargado con `curl`) y `api.github.com/advisories?ecosystem=npm&affects=<pkg>`. El tarball `@google/genai-2.32.0.tgz` se descargó y se leyó en el scratchpad. Su sha512 coincide con `dist.integrity` del registro. **No se ejecutó Node, pnpm ni npx.** Corte de las dos semanas: publicada el **2026-11-02 o antes**.

#### 2.1 Paquete directo

| Paquete | Versión | Publicada | Notas |
|---|---|---|---|
| `@google/genai` | **`2.32.0`** | 2026-10-29T06:40Z (18 días) | Es la última 2.x. `latest` es 3.3.0 (2026-11-12). La 3.0.0 (2026-11-06) es major y cumple las dos semanas el 2026-11-20. Licencia Apache-2.0. `engines.node >=20`. Sin procedencia SLSA. Avisos GitHub: **ninguno**. Dependencias: `google-auth-library ^10.3.0`, `protobufjs ^7.5.4`, `ws ^8.18.0`, `p-retry ^4.6.2`. Peer **opcional**: `@modelcontextprotocol/sdk`. `scripts.preinstall` es `echo 'preinstall: no-op'`, y todo el repo instala con `--ignore-scripts` (`ci.yml:49,74,116`, `Makefile:25`, Dockerfiles). 12,5 MB desempaquetado. |

`dependencies` de `packages/providers` con la versión exacta `"@google/genai": "2.32.0"`.

#### 2.2 Transitivas nuevas (OD-067)

Resolución hecha a mano: la versión más alta que satisface cada rango, sin overrides. Las que ya están en `pnpm-lock.yaml` (`debug@4.4.3`, `ms@2.1.3`, `base64-js@1.5.1`) no entran nuevas. Son **37 paquetes nuevos**, más `@types/node`/`undici-types` si pnpm no reutiliza `@types/node@22.20.5`.

| Paquete (versión resuelta) | Publicada | ≥ 14 días | Observaciones |
|---|---|---|---|
| **`ws` 8.23.0** (rango `^8.18.0`) | 2026-11-12 | ❌ **NO** (4 días) | Hay que fijarla: **`"@google/genai>ws": "8.22.1"`** (publicada el 2026-10-31, cumple; está parcheada frente a GHSA-96hv-2xvq-fx4p HIGH, `<8.21.0`, y GHSA-58qx-3vcg-4xpx). La 8.23.0 cumplirá el 2026-11-26; retirar el override es TASK-040 (TD-140). |
| `protobufjs` 7.6.6 | 2026-08-27 | ✅ | Parcheada frente a todos sus avisos de 2026 (el último, GHSA-j3f2-48v5-ccww, afecta a `<=7.6.4`). Tiene `postinstall: node scripts/postinstall`, que no corre por `--ignore-scripts`. |
| `long` 5.3.2 · `@protobufjs/{aspromise 1.1.2, base64 1.1.2, codegen 2.0.5, eventemitter 1.1.1, fetch 1.1.1, float 1.0.2, path 1.1.2, pool 1.1.0, utf8 1.1.2}` | 2017-01 … 2026-07 | ✅ | `@protobufjs/utf8` 1.1.2 está parcheada (GHSA-q6x5-8v7m-xcrf afecta a `<=1.1.0`). |
| `@types/node` (rango `>=13.7.0`, lo pide protobufjs) | 22.20.5 (2026-10-01) si se reutiliza; 26.6.6 (2026-10-28) si no | ✅ | Si entra 26.6.6, entra también `undici-types` 8.9.0 (2026-07-24, ✅). Recomendación: si `pnpm why @types/node` muestra dos versiones, devops fija `"protobufjs>@types/node": "22.20.5"` para tener una sola. |
| `google-auth-library` 10.9.1 | 2026-07-23 | ✅ | Se importa al cargar el módulo, pero con `apiKey` no se instancia (ver §3.3). |
| `gaxios` 7.3.1 · `gcp-metadata` 8.1.2 · `google-logging-utils` 1.1.3 y 1.2.0 · `jws` 4.0.1 · `jwa` 2.0.1 · `ecdsa-sig-formatter` 1.0.11 · `buffer-equal-constant-time` 1.0.1 · `safe-buffer` 5.2.1 · `json-bigint` 1.0.0 · `bignumber.js` 9.3.1 · `extend` 3.0.2 · `https-proxy-agent` 7.0.6 · `agent-base` 7.1.4 | 2013 … 2026-08 | ✅ | `jws` 4.0.1 está parcheada (GHSA-869p-cjfg-cm3x afecta a `=4.0.0`). |
| `node-fetch` 3.3.2 · `fetch-blob` 3.2.0 · `formdata-polyfill` 4.0.10 · `data-uri-to-buffer` 4.0.1 · `web-streams-polyfill` 3.3.3 · `node-domexception` 1.0.0 | 2021 … 2024 | ✅ | `node-domexception` está **deprecated** («Use your platform's native DOMException»). pnpm avisará, pero no hay ningún aviso de seguridad. |
| `p-retry` 4.6.2 · `retry` 0.13.1 · `@types/retry` 0.12.0 | 2019 … 2022 | ✅ | Sin avisos. |

**Conclusión:** solo `ws` incumple. Entra **un override nuevo**: `"@google/genai>ws": "8.22.1"`, y quizá el de `@types/node`. El día de la instalación, devops vuelve a comprobar las fechas sobre el lockfile real, porque un rango `^` puede resolver a una versión publicada entre hoy y ese día. Repite el procedimiento de TASK-010 (`pnpm why` y el campo `time` de cada versión nueva). Security revisa el árbol completo en el lockfile.

#### 2.3 Alternativa sin SDK: `fetch` directo a la API REST

| | SDK `@google/genai` 2.32.0 | `fetch` + REST `v1beta/models/{m}:generateContent` |
|---|---|---|
| Cumplimiento | Es lo que fijan SPEC `:73`/`:89` y ADR-003 §3 | **Contradice** SPEC §2.1, SPEC §3 y ADR-003 §3 (Accepted). Exige un ADR nuevo que sustituya ADR-003 §3 y editar SPEC: decisión humana. |
| Cadena de suministro | 38 paquetes nuevos (Google Auth, protobufjs, con 2 críticos y 8 altos en 2026 ya parcheados, `ws`, `node-fetch`…). Casi todos sirven a Vertex/Live/MCP, que no usamos. | Ninguna dependencia nueva |
| Entorno y `console` | Lee `GOOGLE_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_CLOUD_PROJECT` y `GOOGLE_CLOUD_LOCATION` siempre. Hace `console.warn` si hay dos claves en el entorno (§3.3, OD-080). | Ninguna lectura |
| Errores | `ApiError` solo trae `status` y `message` (el cuerpo serializado). Las cabeceras no llegan, así que `retryAfterMs` sale del cuerpo (`RetryInfo`). | Control total: cabeceras y cuerpo |
| Mantenimiento | El SDK sigue los cambios de la API (en 3.0 la versión por defecto pasa a `v1`) | Hay que mantener el mapeo de la API a mano. Superficie pequeña: `generateContent` y `models.list`. |
| Llamadas ocultas | Reintentos (solo con `retryOptions`), AFC (solo con `CallableTool`) y **continuación automática activada por defecto**. Las tres se desactivan de forma explícita (§3.3). | Ninguna |

Es OD-076. Recomiendo el SDK, porque lo exige la jerarquía de fuentes. Si el humano prefiere REST, el architect redacta el ADR antes de implementar.

### 3. Diseño

#### 3.1 Ficheros

```
packages/providers/src/
├── api-key.ts                 # NUEVO: resolveApiKey(id, apiKeyEnv, resolver), sale de openai-compatible/provider.ts
├── api-key.test.ts            # NUEVO
├── index.ts                   # + export GeminiProvider y el tipo GeminiProviderOptions
├── index.test.ts              # exports = ["GeminiProvider", "OpenAICompatibleProvider"]
├── openai-compatible/provider.ts   # solo cambia: importa resolveApiKey en lugar de su copia local
└── gemini/
    ├── provider.ts            # clase GeminiProvider; el SDK vive en #client
    ├── mapping.ts             # GenerateRequest → params del SDK; respuesta del SDK → GenerateResponse (puro)
    ├── errors.ts              # toGeminiProviderError(err, id, nowMs) y parseRetryDelayMs(body) (puro)
    ├── test-server.ts         # fixtures msw para https://generativelanguage.googleapis.com (excluido de cobertura por el glob existente)
    ├── mapping.test.ts
    ├── errors.test.ts
    ├── provider.test.ts
    ├── env-isolation.test.ts
    └── no-leak.test.ts
```

`capabilities.ts` no cambia: `assertCapabilities` se reutiliza tal cual (OD-060).

**Decisión: sacar `resolveKey` a `src/api-key.ts`.** Alternativa descartada: copiarla en `gemini/`. Motivo: es la regla de seguridad que decide si el mensaje cita el nombre de la variable (una clave pegada por error no debe aparecer), y dos copias pueden divergir. El cambio en `openai-compatible/provider.ts` es solo de import, y sus tests existentes lo cubren sin modificarlos.

**Decisión: la tabla de estados HTTP no se comparte.** Alternativa descartada: un `fromHttpStatus` común. Motivo: los errores de cada SDK tienen forma distinta (`APIError` con cabeceras frente a `ApiError` sin ellas) y la tabla ya está fijada por OD-059. Cada adaptador la prueba con su propia tabla de tests.

#### 3.2 Contratos públicos (nuevos; ninguno de `core` cambia)

```ts
// @agentlab/providers
export interface GeminiProviderOptions {
  readonly id: string;                  // como OD-057: clave del registry (TASK-019)
  readonly apiKeyEnv: string;           // no admite null: la API de Gemini siempre exige clave (ver abajo)
  readonly secretResolver: SecretResolver;
  // + `capabilities: ProviderCapabilities` SOLO si OD-078 = (b)
}
export class GeminiProvider implements ModelProvider {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;   // congelada
  constructor(options: GeminiProviderOptions);
  listModels(): Promise<ModelInfo[]>;
  generate(req: GenerateRequest, signal: AbortSignal): Promise<GenerateResponse>;
}
```

«Misma superficie» se cumple así: la interfaz `ModelProvider` es idéntica, y las opciones tienen la misma forma salvo `baseUrl` (OD-079) y, según OD-078, `capabilities`.

`apiKeyEnv: string`, no `string | null`. Alternativa descartada: admitir `null` como en OD-058. Con `apiKey` `undefined`, el SDK toma la clave de `GOOGLE_API_KEY`/`GEMINI_API_KEY` del entorno, saltándose el resolver, y además crea un `GoogleAuth`, que consulta el servidor de metadatos 169.254.169.254 (`dist/node/index.mjs:26920-26927`, `NodeAuth`).

#### 3.3 Construcción

Verificado contra `dist/node/index.mjs` de 2.32.0.

1. `const apiKey = resolveApiKey(id, apiKeyEnv, secretResolver)`, **una sola vez**. Con `undefined` o `""` lanza `ProviderAuthError`, que cita el nombre solo si cumple `isApiKeyEnvName` y tiene ≤ 40 caracteres. No se crea el cliente.
2. `#client = new GoogleGenAI({ apiKey, vertexai: false, apiVersion: "v1beta", httpOptions: { baseUrl: GEMINI_BASE_URL } })` con `GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/"`, una constante (OD-079). Cada opción es explícita por un motivo:
   - `vertexai: false` hace que `resolveCloudFlag` no lea `GOOGLE_GENAI_USE_ENTERPRISE`/`GOOGLE_GENAI_USE_VERTEXAI` (`:29416-29443`). Sin esto, una variable del host lo pasaría a Vertex con Google Auth.
   - `httpOptions.baseUrl` explícito: `getBaseUrl` (`:57-68`) solo mira `setDefaultBaseUrls` (estado global de módulo) y `GOOGLE_GEMINI_BASE_URL` del entorno cuando falta `baseUrl`. Sin él, una variable del host mandaría la clave a otro host.
   - `apiVersion: "v1beta"` explícito: es el valor por defecto de 2.32 (`:13617`), y la 3.x lee `GOOGLE_GENAI_API_VERSION` si falta (notas de la v3.0.0).
   - Sin `retryOptions`: **cero reintentos**. `apiCall` solo usa `pRetry` si existen (`:14068-14125`). Los reintentos son de TASK-019.
   - Sin `httpOptions.timeout`: el plazo lo pone el adaptador (§3.4), con un solo temporizador controlable por `vi.useFakeTimers()`.
   - Sin `project`/`location`/`googleAuthOptions`.
3. **Lecturas del entorno que no se pueden evitar** (`:29555-29560`, `:29655-29661`): el constructor lee siempre `GOOGLE_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_CLOUD_PROJECT` y `GOOGLE_CLOUD_LOCATION`. Con `apiKey` explícito y `vertexai: false`, esos valores **se descartan**: `this.apiKey = options.apiKey ?? env`, y `project`/`location` solo se usan en Vertex (`shouldPrependVertexProjectPath`, `:13874-13878`). Si `GOOGLE_API_KEY` y `GEMINI_API_KEY` están definidas a la vez, el SDK hace `console.warn('Both GOOGLE_API_KEY and GEMINI_API_KEY are set. Using GOOGLE_API_KEY.')`, un texto fijo sin valores. Es OD-080 (análoga a OD-064).
4. `id` y `capabilities` (congelada) son las únicas propiedades públicas. El SDK expone `apiKey` como propiedad pública en `GoogleGenAI`, `NodeAuth` y `ApiClient.clientOptions`, así que solo vive en `#client`.
5. La clave viaja en la cabecera `x-goog-api-key` (`:26918-26948`), **nunca en la URL**. El test lo comprueba como control positivo.

#### 3.4 `generate(req, signal)`

1. `assertCapabilities(id, capabilities, req)`: `ProviderCapabilityError` antes de la red.
2. `assertRepresentable(req)` (OD-082): mensajes `system` después de un mensaje no `system`, o ningún mensaje `user`/`assistant`, dan `ProviderCapabilityError` antes de la red.
3. `signal.throwIfAborted()`.
4. Plazo: `own = new AbortController()` y `setTimeout(() => own.abort(), req.timeoutMs)`. Se pasa `abortSignal: AbortSignal.any([signal, own.signal])` en `config`. Hay `clearTimeout` en `finally`.
5. `#client.models.generateContent({ model: req.model, contents, config })` con `config` de `mapping.ts`:
   - `systemInstruction`: los `system` iniciales unidos con `"\n\n"`. Los roles `user` → `user` y `assistant` → `model`, con `parts: [{ text }]`.
   - `maxOutputTokens: req.maxOutputTokens`. `temperature` solo si viene (`exactOptionalPropertyTypes`).
   - `tools: [{ functionDeclarations: req.tools.map(t => ({ name, description, parametersJsonSchema: t.parameters })) }]` si hay herramientas. Se usa `parametersJsonSchema` porque `ToolSpec.parameters` ya es JSON Schema; `parameters` es el subconjunto OpenAPI.
   - `responseMimeType: "application/json"` y `responseJsonSchema: req.responseSchema` si viene un esquema. Es la forma documentada para JS (ver fuentes). La validación real sigue siendo Zod en el orquestador.
   - `automaticFunctionCalling: { disable: true }`, por defensa: con declaraciones simples el SDK ya no lo usa (`shouldDisableAfc`, `:15315-15340`).
   - **`automaticContinuation: false`, obligatorio.** Por defecto vale `true` (`:15380-15389`), y `generateContentWithContinuation` (`:16381-16393`) repite la llamada HTTP mientras haya `continuationToken`. Serían llamadas fuera del presupuesto.
6. `fromGenerateContentResponse(res, id)` (§3.5).
7. En el `catch`: si `signal.aborted`, se relanza `signal.reason` (OD-059 a). Si `own.signal.aborted`, `ProviderTimeoutError`. Si no, `toGeminiProviderError(err, id, Date.now())`.

**Una sola petición HTTP por `generate`**: sin reintentos, sin AFC y sin continuación. Hay test que lo comprueba.

#### 3.5 Respuesta → `GenerateResponse`

Lectura de los campos del objeto, **nunca** con los getters `.text`/`.functionCalls`, que hacen `console.warn` si hay partes no textuales. Todo con guardas de tipo, sin `as`.

- Sin `candidates[0]` → `ProviderResponseError` (`retryable: false`), con un mensaje distinto si `promptFeedback.blockReason` existe. El valor del enum no se copia: el mensaje es fijo.
- `content`: concatenación de los `text` de las partes con `thought !== true`. Si no hay ninguno, `null`. Un candidato sin partes (`finishReason` `SAFETY`, `MAX_TOKENS`…) da `content: null` y `toolCalls: []`, que aguas abajo es `invalid_output`, igual que en el adaptador OpenAI-compatible.
- `toolCalls`: cada parte con `functionCall`. `name` es obligatorio; si falta, `ProviderResponseError`. `arguments = functionCall.args ?? {}` (ya es un objeto, no hace falta `JSON.parse`). `id = functionCall.id`, o `call_<índice>` si falta. Gemini 3 siempre lo trae y 2.5 no lo garantiza. Alternativa descartada: `randomUUID()`, que no es determinista en los tests. `thoughtSignature` se ignora (ver R4).
- `usage.inputTokens = promptTokenCount` (entero ≥ 0, o `null`). `usage.outputTokens` según OD-081.
  - *Nota (2026-11-17): OD-084 (SPEC §13, humano, ciclo de corrección 1) precisa OD-081. Regla vigente: `outputTokens = (candidatesTokenCount ?? 0) + (thoughtsTokenCount ?? 0)` si al menos uno existe; `null` si no existe ninguno. Cubre la respuesta con solo `thoughtsTokenCount` (R5).*
- `costReported: null` siempre. La API de Gemini no informa coste (ADR-003 §5).
- `raw`: nunca.

#### 3.6 Mapeo de errores (`errors.ts`)

`ApiError` de 2.32.0 (`:7828-7835`) solo tiene `status` y `message`, y `message` es `JSON.stringify` del cuerpo (`:14296-14325`). **No hay cabeceras.** El cuerpo solo se parsea para leer dos campos estructurados. Ningún texto del cuerpo se copia al error.

| Origen | Error de `core` | `retryable` |
|---|---|---|
| `ApiError` 401 o 403 | `ProviderAuthError` | false |
| `ApiError` 400 con `error.details[].reason === "API_KEY_INVALID"` | `ProviderAuthError` | false |
| `ApiError` 429 | `ProviderRateLimitError`, con `retryAfterMs` sacado de `details[]` `@type …google.rpc.RetryInfo` → `retryDelay` (`"37s"`, `"15.0029s"` → ms); sin él, no se pasa | true |
| `ApiError` 408 | `ProviderTimeoutError` | true |
| `ApiError` 409 o 5xx (incluidos 503 `UNAVAILABLE` y 504 `DEADLINE_EXCEEDED`) | `ProviderResponseError` | true |
| Resto de `ApiError` 4xx (400, 402, 404, 416, 499…) | `ProviderResponseError` | false |
| `TypeError` del `fetch` (conexión) | `ProviderResponseError` | true |
| Plazo propio vencido | `ProviderTimeoutError` | true |
| `signal` del llamador abortado | se relanza `signal.reason` | — |
| Respuesta mal formada o error desconocido | `ProviderResponseError` | false |

Es la tabla de OD-059 con dos añadidos propios de Gemini, sin decisión nueva:
- 400 `API_KEY_INVALID` → `ProviderAuthError`. La API devuelve 400 `INVALID_ARGUMENT` con `reason: API_KEY_INVALID` ante una clave mala; la doc nueva cita 401. Se cubren los dos casos.
- `RetryInfo`. Es la única forma en que Gemini informa del retraso (providers-dev.md: «429 lleva `retryAfterMs` si el proveedor lo informa»).

Mensajes con plantilla fija: `Provider "<id>" … (HTTP <status>)`. Sin `cause`, sin cuerpo y sin URL (TD-144).

> Nota (2026-11-17), sobre la fila «`TypeError` del `fetch` (conexión)»: solo `TypeError` con mensaje `"fetch failed"` y `cause` objeto (`errors.ts:53-58`) es conexión `retryable`; un corte a mitad del cuerpo (`"terminated"`) y cualquier otro `TypeError` son no `retryable` (ciclo de corrección 1). Útil para TASK-019.

#### 3.7 `listModels()`

Usa un plazo propio de 10 000 ms (constante, OD-066) y `abortSignal`. Llama a `#client.models.list({ config: { pageSize: 1000, abortSignal } })` y recorre el `Pager` con `for await`; el plazo acota el total. Mapeo: `name` `"models/gemini-2.5-flash"` → `{ id: "gemini-2.5-flash" }`, solo para los modelos cuyo `supportedActions` incluye `"generateContent"`. Alternativa descartada: devolverlos todos, porque los de embeddings no sirven para `generate`. Los errores pasan por la misma tabla.

*Errata (2026-11-17): el campo de wire de la API es `supportedGenerationMethods`; el SDK 2.32.0 lo expone en `Model` como `supportedActions` (`dist/node/index.mjs:12226-12230`). El código filtra por el campo del SDK (`supportedActions`) y los servidores falsos de los tests responden con el de wire.*

#### 3.8 Capacidades declaradas «reales» (OD-078)

Fuentes consultadas el 2026-11-16: `aistudio.google.com/docs/structured-output?generate-content=true` (antes `ai.google.dev/gemini-api/docs/generate-content/structured-output`, redirige con 301), `aistudio.google.com/docs/function-calling?generate-content=true`, `aistudio.google.com/docs/thinking?generate-content=true` y `aistudio.google.com/docs/api-errors`. Ninguna página muestra fecha de actualización.

| Capacidad | Valor | Fuente / motivo |
|---|---|---|
| `tools` | `true` | Function calling con `functionDeclarations` en `generateContent` (Gemini 2.5 y 3.x). |
| `structuredOutput` | `true` | `responseMimeType` + `responseJsonSchema`. Lista de modelos: Gemini 2.0 Flash y Flash-Lite, 2.5 Pro, Flash y Flash-Lite, y las series 3.x y 4. Combinarlo con herramientas está en *Preview* y solo en Gemini 3 y 4 (R3). |
| `streaming` | `false` | El SDK sabe hacer streaming (`generateContentStream`), pero `ModelProvider` no tiene método de streaming y el adaptador no lo implementa. Declarar `true` sería fingir. |
| `maxContextTokens` | `null` | Depende del modelo (`Model.inputTokenLimit`); la capacidad es por proveedor. «Desconocido, nunca inventado» (ARCHITECTURE §3.1). Afinarlo por modelo es TD-145 (TASK-019/022). |
| `reportsUsage` | `true` | `usageMetadata.promptTokenCount`/`candidatesTokenCount`/`thoughtsTokenCount`. |
| `reportsCost` | `false` | La respuesta no trae coste. |

Límite conocido (TD-145): los modelos Gemma servidos por la misma API no soportan function calling ni JSON Schema. Si se piden con `tools`, el error llega del servidor (400 → `ProviderResponseError`).

### 4. Scope real y quién edita (contrastado con role-guard, TD-157)

| Ruta | Quién | role-guard | Por qué |
|---|---|---|---|
| `packages/providers/package.json` (`"@google/genai": "2.32.0"`) | **devops** (paso 0) | ✅ `packages/*/package.json` (providers-dev también podría) | Va junto con el lockfile: si providers-dev lo edita antes, `--frozen-lockfile` falla en sus tests |
| `package.json` raíz (solo `pnpm.overrides`: `"@google/genai>ws": "8.22.1"` y, si hace falta, `"protobufjs>@types/node": "22.20.5"`) | **devops** | ✅ `package.json` | OD-067 |
| `pnpm-lock.yaml` | **devops** (`pnpm install --lockfile-only --ignore-scripts` en contenedor) | ✅ devops; ❌ providers-dev | TD-157 / TASK-012 |
| `packages/providers/src/gemini/**` | providers-dev | ✅ | DoD |
| `packages/providers/src/api-key.ts`, `api-key.test.ts`, `openai-compatible/provider.ts` (import) | providers-dev | ✅ | §3.1 |
| `packages/providers/src/index.ts`, `index.test.ts` | providers-dev | ✅ | export y test de exports |
| `docs/ARCHITECTURE.md` §9 (fila `@google/genai` y override de `ws`) | architect, en el cierre | ✅ architect | R9 de TASK-010 |
| `docs/TASKS.md`, `docs/TECHNICAL_DEBT.md` | docs-keeper / Orchestrator | ✅ | cierre |

`deps_allowed` (paso 0, devops): `["@google/genai@2.32.0"]`. El override de `ws@8.22.1` no es una dependencia declarada, pero sí entra en el lockfile; security lo revisa. `vitest.config.ts` no cambia: su glob ya excluye `src/**/test-server.ts` y el umbral del 90 % (OD-066) se aplica a todo el paquete.

### 5. Pasos

0. **devops** (scope: los tres ficheros de manifiesto y lock). Tareas:
   - añadir la dependencia y los overrides;
   - lanzar `pnpm install --lockfile-only --ignore-scripts` en contenedor;
   - lanzar `pnpm install --frozen-lockfile --ignore-scripts`;
   - lanzar `pnpm why @google/genai ws @types/node protobufjs google-auth-library`;
   - entregar una tabla con la fecha (`time`) de **cada** paquete nuevo o cambiado en el lockfile.

   Si alguno tiene menos de 14 días, lo fija con un override padre>hijo y lo informa.
1. **providers-dev**: `src/api-key.ts` + test; `openai-compatible/provider.ts` importa `resolveApiKey`. `pnpm --filter @agentlab/providers test` tiene que seguir en 109/109 más los nuevos.
2. `gemini/errors.ts` + `errors.test.ts` (puros).
3. `gemini/mapping.ts` + `mapping.test.ts` (puros; tipos del SDK solo con `import type`).
4. `gemini/provider.ts` + `test-server.ts` + `provider.test.ts` + `env-isolation.test.ts` + `no-leak.test.ts`. Antes de escribirlo, comprobar contra el paquete instalado cada línea del SDK que cita este plan (`dist/node/index.mjs` de 2.32.0).
5. `index.ts` + `index.test.ts`.
6. `pnpm --filter @agentlab/providers typecheck lint test` y `pnpm -r typecheck lint`, por el camino de contenedor de siempre. Después, el informe IMPLEMENTATION con la evidencia de la regla 13.
7. **Cierre (architect)**: ARCHITECTURE §9, con la fila `@google/genai` `2.32.0` en `providers` (`dependencies`) y la nota del override de `ws`.

### 6. Tests (unitarios, sin red real ni timers reales)

**Transporte (OD-077):** msw 3.0.3, que ya está en `devDependencies`, con `setupServer` y `onUnhandledRequest: "error"` sobre `https://generativelanguage.googleapis.com`. El SDK busca `fetch` en cada llamada (`fetchFn ?? fetch`, `:14070`), así que el orden de construcción no importa. `setupServer` de `msw/node` intercepta también `http`/`https`: una llamada a 169.254.169.254 haría fallar el test.

| Fichero | Casos |
|---|---|
| `errors.test.ts` | Tabla completa de §3.6, con un `ApiError` real de `@google/genai`. `parseRetryDelayMs`: `"37s"`→37000, `"15.0029s"`→15003 (redondeo hacia arriba), sin `RetryInfo`, `retryDelay` inválido (`"-1s"`, `"abc"`, número suelto), cuerpo que no es JSON. 400 con `API_KEY_INVALID` frente a 400 sin él. `TypeError` → conexión, `retryable`. Error desconocido → no `retryable`. |
| `mapping.test.ts` | `system` inicial → `systemInstruction`; `assistant` → `model`; `maxOutputTokens`; `temperature` ausente cuando no viene; `tools` → `parametersJsonSchema`; `responseSchema` → `responseMimeType` + `responseJsonSchema`; `automaticContinuation: false` y `automaticFunctionCalling.disable` siempre presentes. Respuesta: texto concatenado sin partes `thought`; `functionCall` con y sin `id` (`call_0`, `call_1`); `functionCall` sin `name` → `ProviderResponseError`; sin `candidates` → error; `promptFeedback.blockReason` → error de mensaje fijo; candidato sin partes → `content: null`; `usage` completo, parcial y ausente (según OD-081); `costReported` siempre `null`. OD-082: `system` intermedio y solo `system` → `ProviderCapabilityError`. |
| `provider.test.ts` | Clave: el resolver (`vi.fn`) se llama una vez y solo en la construcción. El servidor recibe `x-goog-api-key: <canario>` (control positivo) y la URL no contiene el canario. Resolver con `undefined`/`""` → `ProviderAuthError` en `new`, sin peticiones; el nombre se cita si es válido y no se cita si no lo es (`apiKeyEnv: "sk-canary…"`). Ruta exacta `POST /v1beta/models/<m>:generateContent`. **Una sola petición** ante 429, 500 y 503 (sin reintentos) y ante una respuesta con `continuationToken` (sin continuación). Capacidad ausente u OD-082 → `ProviderCapabilityError` con **cero** peticiones. Plazo: handler que nunca responde, `vi.useFakeTimers({ toFake: ["setTimeout","clearTimeout","Date"] })` y `advanceTimersByTimeAsync(timeoutMs)` → `ProviderTimeoutError` `retryable`. `signal` abortado antes (0 peticiones) y durante → `signal.reason`, no `ProviderTimeoutError`. `vi.getTimerCount() === 0` tras éxito y tras error. 429 con `RetryInfo` → `retryAfterMs`. 400 `API_KEY_INVALID` → `ProviderAuthError`. `HttpResponse.error()` → conexión `retryable`. `listModels`: dos páginas (`nextPageToken`), filtro por `supportedActions`, prefijo `models/` quitado, plazo de 10 000 ms. `capabilities` es igual a la tabla de §3.8 y está congelada. |
| `env-isolation.test.ts` | Con `vi.stubEnv`, que escribe y no lee: `GOOGLE_API_KEY` y `GEMINI_API_KEY` con canarios distintos del resolver, `GOOGLE_GEMINI_BASE_URL=http://evil.test`, `GOOGLE_GENAI_USE_VERTEXAI=true`, `GOOGLE_GENAI_USE_ENTERPRISE=true`, `GOOGLE_CLOUD_PROJECT`/`LOCATION` y `GOOGLE_GENAI_API_VERSION=v1alpha`. Resultado esperado: la petición va a `generativelanguage.googleapis.com/v1beta/…`, con `x-goog-api-key` = canario del resolver, sin `Authorization` y sin `/projects/`. Un espía en `console.*` comprueba que ninguna salida contiene un canario. El `console.warn` de las dos claves queda documentado como hecho conocido (OD-080). |
| `no-leak.test.ts` | Para 400, 401, 403, 429, 500, error de red y plazo, el servidor responde con un cuerpo que **repite** la cabecera `x-goog-api-key` recibida. El canario no aparece en `message`, `String(cause)`, `stack`, `JSON.stringify(err)` ni `inspect(err, { showHidden: true, depth: Infinity })`. Tampoco aparece en `JSON.stringify(provider)`, `Object.keys`/`getOwnPropertyNames` ni `inspect(provider, { showHidden: true, depth: Infinity })`. **Regla 13**: el implementador muestra que el test falla si se copia `err.message` o se adjunta `cause`. |
| `api-key.test.ts` | Valor definido; `undefined`/`""` → `ProviderAuthError`; nombre válido citado; nombre inválido o de más de 40 caracteres no citado. |
| `index.test.ts` | `Object.keys(providers)` = `["GeminiProvider", "OpenAICompatibleProvider"]`. El mapa `exports` no cambia. El escaneo estático de `process.env` cubre `gemini/**` y `api-key.ts`. |

Cobertura: umbral del paquete, 90 % (OD-066), sin cambios.

### 7. DoD refinado (propuesta para TASKS.md)

- `GeminiProvider` implementa `ModelProvider` de `core` y se exporta desde `@agentlab/providers`. Sus opciones son `{ id, apiKeyEnv, secretResolver }` (más `capabilities` si OD-078 = b). No se exporta ninguna ruta interna.
- La clave se obtiene **solo** con `secretResolver(apiKeyEnv)`, una vez, en la construcción. Si falta o está vacía, `ProviderAuthError` en `new` y ninguna petición. Viaja en `x-goog-api-key`, nunca en la URL. Ningún fichero de `src/**` contiene `process.env`.
- El cliente se construye con `vertexai: false`, `apiVersion: "v1beta"`, `httpOptions.baseUrl` constante y sin `retryOptions`. Test: las variables `GOOGLE_*`/`GEMINI_*` del entorno no cambian ni el destino ni la clave enviada, ni activan Vertex.
- Cada `generate` hace como máximo **una** petición HTTP: sin reintentos del SDK, sin AFC y con `automaticContinuation: false`. Hay test.
- Capacidades declaradas según la tabla de §3.8 (o la que decida OD-078), con fuentes y fecha en el plan. `ProviderCapabilityError` antes de la red para las capacidades ausentes (OD-060) y para los mensajes no representables (OD-082).
- Errores mapeados según la tabla de §3.6. Cada uno con `retryable` correcto, `retryAfterMs` desde `RetryInfo` cuando existe, y mensaje de plantilla fija sin cuerpo, URL ni `cause`. La cancelación del llamador relanza `signal.reason`. El plazo propio da `ProviderTimeoutError`.
- `usage` según OD-081; `costReported` siempre `null`; `raw` nunca.
  - *Nota (2026-11-17): OD-084 precisa OD-081: `outputTokens = (candidatesTokenCount ?? 0) + (thoughtsTokenCount ?? 0)` si al menos uno existe; `null` si ninguno.*
- El canario de la clave no aparece en errores, instancia ni `console` (`no-leak.test.ts`, que falla si se copia el `message` del SDK).
- Tests sin red real (msw sobre el SDK real, OD-077) y sin timers reales. Cobertura del paquete ≥ 90 %.
- `@google/genai` `2.32.0` exacta en `packages/providers`. Todas las transitivas nuevas o cambiadas en el lockfile con ≥ 14 días o fijadas por override, con evidencia (fecha en el registro y `pnpm why`). `pnpm install --frozen-lockfile --ignore-scripts` en verde.
- ARCHITECTURE §9 actualizado en el cierre.

**Security: REQUIRED.** La tarea maneja secretos (resolver, clave en memoria, errores, lecturas del entorno por el SDK), añade salida de red y añade una dependencia de runtime con 37–39 transitivas que entran en la imagen del `worker` (`pnpm deploy`). Vectores: secretos, SSRF (base URL por entorno o estado global, metadatos vía Google Auth), dependencias y `docker/ci` (SBOM de la imagen).

### 8. Riesgos

- **R1 — El SDK lee el entorno y usa `console`.** Detalle en §3.3. Mitigación: opciones explícitas, test de aislamiento y versión exacta. Cualquier subida del SDK repite el test. La 3.x añade `GOOGLE_GENAI_API_VERSION`, que queda neutralizada con `apiVersion` explícito.
- **R2 — El cuerpo del error se parsea.** Solo se leen `details[].reason` y `retryDelay` con guardas; nada se copia. Si Google cambia el formato, `retryAfterMs` queda `undefined` y la clave inválida acaba en `ProviderResponseError` 400 sin reintento. Es un fallo seguro.
- **R3 — Herramientas y esquema a la vez.** Gemini 2.x lo rechaza (400 → `ProviderResponseError`). Solo Gemini 3/4 lo admite, en *Preview*. Las capacidades son por proveedor (TD-145).
- **R4 — Llamadas a herramientas en varios turnos.** `Message` de `core` no tiene turnos de herramienta ni `thoughtSignature`, y Gemini 3 exige devolver las firmas. Hoy no aplica (M1 no usa herramientas; los turnos de herramienta llegan en M4, TASK-030), pero el contrato de `core` tendrá que crecer.
- **R5 — Thinking y `maxOutputTokens`.** Los modelos 2.5/3.x piensan por defecto, y el razonamiento consume tokens de salida. Con los `maxTokens` de OD-069 (2 000–4 000), una respuesta puede salir vacía (`MAX_TOKENS`). El plan no fija `thinkingConfig`: hacerlo sería un requisito nuevo. TASK-022 lo medirá.
- **R6 — Cadena de suministro.** `@google/genai` publica casi cada semana. Hay 38 paquetes nuevos en la imagen del `worker`, y protobufjs tiene historial de críticos (todos parcheados en 7.6.6). Los overrides crecen (TD-140, TASK-040). `audit` del CI fail-closed (OD-050).
- **R7 — msw y el `dispatcher` de undici que añade el SDK** (`:13957-13963`). msw sustituye `globalThis.fetch` y el `dispatcher` se ignora. Si msw no interceptara, `onUnhandledRequest: "error"` y la ausencia de red en el contenedor de tests lo detectarían. Alternativa en ese caso: `httpOptions.fetch`, pero abre un punto de inyección en la API pública (descartado en OD-062).
- **R8 — Redirecciones.** El `fetch` del SDK sigue redirecciones (TD-141). Con el host fijo de Google y HTTPS, el riesgo es bajo. Va con TD-141 a TASK-020.
- **R9 — Orden de hitos.** TASK-018 es de M2 y M1 sigue abierto (TASK-011, TASK-013 a TASK-017). TASKS la deja READY; el orden lo confirma el Orchestrator.

### 9. OPEN DECISIONS (~~propuestas; no resueltas~~ **RESUELTAS 2026-11-16, humano → (a) en las ocho**)

Registradas en SPEC §13 como OD-076 … OD-083 (antes OD-A … OD-H). Se conserva el texto de la propuesta como traza.

- **OD-076 — Dependencia.** (a) `@google/genai` **2.32.0** + override `@google/genai>ws: 8.22.1` (y `protobufjs>@types/node: 22.20.5` si `pnpm why` muestra dos versiones); `deps_allowed: ["@google/genai@2.32.0"]`. (b) Esperar al 2026-11-20 y usar 3.0.0 (major: `v1` por defecto, Node ≥ 22, rangos de `ws`/`protobufjs` ya parcheados); retrasa la tarea 4 días y solo puede ser 3.0.0. (c) Sin SDK, con `fetch` a REST: cero dependencias, pero exige un ADR que sustituya ADR-003 §3 y cambiar SPEC `:73`/`:89`. **Recomiendo (a).** Subir a 3.x es una tarea aparte (TASK-040). **Decisión (2026-11-16, humano): (a).**
- **OD-077 — «Tests con mock del SDK».** (a) msw, que ya es dependencia, sobre el SDK real: prueba lo que importa (cabecera de la clave, cero reintentos, continuación desactivada, entorno ignorado). La viñeta del DoD se reescribe como «tests sin red con transporte HTTP falso (msw) sobre el SDK real». (b) `vi.mock("@google/genai")`: es la letra del DoD, pero deja vacíos los tests de entorno, reintentos y continuación. (c) msw para todo, más `vi.mock` solo para errores que no salen por HTTP. **Recomiendo (a).** Las funciones puras (`mapping`, `errors`) se prueban sin servidor. **Decisión (2026-11-16, humano): (a).**
- **OD-078 — Capacidades.** (a) Fijas en el adaptador según la tabla de §3.8, sin opción `capabilities`: «reales» es literal y no se puede configurar mal. (b) Por configuración, como OpenAI-compatible, con la tabla como valor documentado: misma forma de opciones, pero nadie garantiza que sean reales. (c) Fijas, con `maxContextTokens` configurable. **Recomiendo (a).** Afinar por modelo es TD-145. **Decisión (2026-11-16, humano): (a).**
- **OD-079 — `baseUrl`.** (a) Constante `https://generativelanguage.googleapis.com/`, sin opción; `provider_configs.base_url` se ignora para `gemini` (lo documenta TASK-020). (b) Opción `baseUrl` validada como en OpenAI-compatible: abre la salida de la clave a otro host (TD-141/TD-012) sin requisito que la pida. **Recomiendo (a).** **Decisión (2026-11-16, humano): (a).**
- **OD-080 — Lecturas del entorno y `console.warn` del SDK que no se pueden evitar** (§3.3). (a) Aceptarlo y registrarlo como deuda LOW (como OD-064), con pago en TASK-020/TASK-027. Los valores leídos se descartan y el `worker` solo recibe `GEMINI_API_KEY` (`compose.yaml:85`). (b) Rodearlo: requiere parchear el SDK o cambiar `process.env` en tiempo de ejecución, más superficie y frágil. (c) OD-076 (c). **Recomiendo (a).** **Decisión (2026-11-16, humano): (a).**
- **OD-081 — `outputTokens` con thinking.** Gemini factura como salida `candidatesTokenCount + thoughtsTokenCount` («response pricing is the sum of output tokens and thinking tokens»). (a) `outputTokens = candidatesTokenCount + (thoughtsTokenCount ?? 0)` si `candidatesTokenCount` existe; `null` si no. Las dos cifras las informa el proveedor: no es una estimación, y el presupuesto descuenta lo que se factura. (b) Solo `candidatesTokenCount`: infravalora el consumo frente a `maxTotalTokens`. **Recomiendo (a).** **Decisión (2026-11-16, humano): (a).**
  - *Nota (2026-11-17): precisada por OD-084 (SPEC §13, humano, ciclo de corrección 1): si falta `candidatesTokenCount` pero existe `thoughtsTokenCount`, `outputTokens = thoughtsTokenCount`; `null` solo si no existe ninguno.*
- **OD-082 — Mensajes que Gemini no puede representar tal cual.** `system` después de un turno, o ningún turno `user`/`assistant`. (a) `ProviderCapabilityError` antes de la red (SPEC §2.1: nunca degradar en silencio). (b) Mover los `system` intermedios a `systemInstruction`: cambia el significado en silencio. (c) Convertirlos en turnos `user`: mezcla instrucciones de sistema con datos. **Recomiendo (a).** Hoy cada agente usa un único `systemPrompt` inicial (`packages/agents/src/role.ts:34-43`). **Decisión (2026-11-16, humano): (a).**
- **OD-083 — Scope y reparto.** (a) El de §4: devops hace el paso 0 (`packages/providers/package.json`, `package.json` raíz y `pnpm-lock.yaml`) y providers-dev escribe el código en `packages/providers/**` (con `api-key.ts` y el import en `openai-compatible/provider.ts`). (b) Scope literal de TASKS (`src/gemini/**`), con `resolveKey` duplicada y el export hecho por otro rol. **Recomiendo (a).** **Decisión (2026-11-16, humano): (a).**

Fuentes web (consultadas el 2026-11-16):
- https://registry.npmjs.org/@google%2fgenai y el resto de paquetes de §2.2 (campo `time`)
- https://api.github.com/advisories?ecosystem=npm&affects=<pkg>
- https://github.com/googleapis/js-genai/releases/tag/v3.0.0
- https://aistudio.google.com/docs/structured-output?generate-content=true
- https://aistudio.google.com/docs/function-calling?generate-content=true
- https://aistudio.google.com/docs/thinking?generate-content=true
- https://aistudio.google.com/docs/api-errors
- https://aistudio.google.com/docs/troubleshooting
- https://discuss.ai.google.dev/t/429-errors-despite-waiting-after-retrydelay/96899 (forma de `RetryInfo.retryDelay`)
- https://discuss.google.dev/t/gemini-api-returning-400-api-key-invalid-error-despite-correct-setup/267839 (400 `API_KEY_INVALID`)
