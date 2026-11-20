# TASK-019 — Plan: ProviderRegistry, comprobación de capacidades y reintentos con backoff

Fecha: 2026-11-17 · Autor: architect · Estado: **APROBADO por el humano (2026-11-18)**. Respuestas literales: plan «Aprobar todo (Recommended)»; OD-085 «No reintentar (Recommended)» → (b); OD-086 «Lista blanca de códigos (Recommended)» → (a); OD-087 «La envoltura, todas (Recommended)» → (a). Las tres OD están resueltas en SPEC §13 y el plan queda fijado con esas opciones, sin alternativas abiertas.

## 1. Contexto

- `packages/providers` ya tiene dos adaptadores (`OpenAICompatibleProvider`, `GeminiProvider`) y `FakeProvider`. Cada `generate` hace como máximo una petición, sin reintentos del SDK (`maxRetries: 0`; sin `retryOptions`). Los errores se normalizan con `retryable` y `retryAfterMs` (OD-059).
- Falta la capa de encima: registrar proveedores por `id`, comprobar capacidades antes de gastar presupuesto y reintentar con backoff descontando cada intento del presupuesto de llamadas.
- `BudgetGuard` **no existe todavía**: TASK-011 está BLOCKED por OD-002 y no hay `packages/policies`. El descuento se diseña contra un puerto mínimo que `BudgetGuard` cumplirá por tipado estructural.

### 1.1 Fuentes leídas

| Fuente | Qué fija |
|---|---|
| TASKS.md:411-413 | DoD literal de TASK-019; scope `packages/providers/**`; owner providers-dev |
| SPEC §2.1 | Fallar rápido con error tipado; nunca degradar en silencio |
| SPEC §5.1 | Presupuesto por run comprobado **antes** de cada llamada; 20 llamadas/run por defecto; OD-002 abierta |
| SPEC §5.2 | Las trazas registran «reintentos y errores» (M3) |
| SPEC §13 | OD-057 (`id` = clave del registry), OD-059 (mapeo y `retryable`; conexión → `retryable`), OD-060 (`assertCapabilities` compartida; «TASK-019 la reutiliza»), OD-065 (config inválida → `ProviderResponseError`), OD-069 (`maxCalls` por invocación = una + un reintento), OD-076..084 |
| ARCHITECTURE §2 `:51-53` | `policies` tiene `BudgetGuard` («comprueba y descuenta antes de cada llamada»); `providers` tiene `ProviderRegistry`, reintentos y backoff. Dirección `core ← persistence ← policies ← providers` |
| ARCHITECTURE §3.1, §3.3 | Contrato `ModelProvider`; `BudgetGuard.reserve(kind: "model" \| "tool", est?)` lanza `BudgetExceededError`; «`reserve` se llama siempre antes de la operación» |
| ARCHITECTURE §9 | Regla de dos semanas (no aplica: sin dependencias nuevas) |
| ROADMAP M1/M2 | «rate limit → reintento → fallo» con fake; M2: backoff + jitter, `retryAfterMs` |
| TASK-013 DoD (TASKS.md:333) | `buildResearchGraph(deps)` recibe `providerRegistry` y `budgetGuard` por inyección |
| TASK-010-plan, TASK-018-plan §3.6 y nota `:188`, TASK-018.md `:340-362` | Criterio actual «fetch failed» con `cause`; sondas de undici real (ECONNREFUSED/DNS/corte antes de cabeceras → retryable; «terminated» → no) |
| Código: `capabilities.ts`, `api-key.ts`, `index.ts`, `openai-compatible/{provider,errors}.ts`, `gemini/{provider,errors}.ts`, `testing/fake-provider.ts`, `core/src/{errors,budget,model-provider}.ts`, `persistence/src/schema/provider-configs.ts` | Estado real (§1.2) |
| TECHNICAL_DEBT | TD-143, TD-145, TD-161, TD-165, TD-167 |
| DEVELOPMENT_WORKFLOW §3 regla 12 y `.claude/hooks/role-guard.sh:28` | providers-dev → `packages/providers/**` |

### 1.2 Estado del código (verificado en disco)

- `assertCapabilities(providerId, capabilities, req)` (`capabilities.ts`) se llama como primera línea de los tres `generate` (`openai-compatible/provider.ts`, `gemini/provider.ts`, `testing/fake-provider.ts`). Gemini añade `assertRepresentable` (OD-082) justo después.
- `retryAfterMs` sin tope: `gemini/errors.ts:38` (`Math.ceil(seconds*1000)`) y `openai-compatible/errors.ts` `parseRetryAfterMs` (segundos, ms o fecha HTTP). TD-161.
- Conexión: openai-compatible → todo `APIConnectionError` es `retryable: true` (el SDK lo construye con `cause` = el error de `fetch`, `client.js:935-938` de `openai@7.45.1`). Un corte a mitad del cuerpo sale de `response.text()` como `TypeError("terminated")` sin envolver → «unexpected error», no retryable. Gemini → solo `TypeError("fetch failed")` con `cause` objeto es retryable (`gemini/errors.ts:53-58`). En los dos, un fallo TLS (`fetch failed` con `cause.code` `CERT_*`/`ERR_TLS_*`) es retryable. TD-165.
- `index.ts` exporta solo los dos adaptadores; `index.test.ts` fija esa lista.
- `core` ya tiene todo lo que hace falta: `AgentLabError.retryable`, `ProviderRateLimitError.retryAfterMs`, `ProviderCapabilityError`, `BudgetExceededError`. **No hay que tocar `core`.**

### 1.3 Valores de referencia verificados (lectura de tarballs en el scratchpad, sin ejecutar Node)

| Fuente | Valor |
|---|---|
| `openai@7.45.1` `client.js:101` | `maxRetries` por defecto = 2 |
| `openai@7.45.1` `client.js:1199-1206` | backoff `min(0.5 s · 2^n, 8 s)`, jitter multiplicativo `1 − random·0.25` |
| `openai@7.45.1` `client.js:1145-1171` | honra `retry-after-ms`/`retry-after` si `0 ≤ t ≤ 60 s`; si no, ignora la cabecera y usa su backoff |
| `@google/genai@2.32.0` `dist/node/index.mjs:13696-13700` | `attempts` 5 (incluida la primera), `initialDelay` 1 s, `maxDelay` 60 s, base 2, jitter 1 |
| undici v6.x `lib/web/fetch/index.js:230` | fallo de red: `new TypeError('fetch failed', { cause: response.error })` |
| undici v6.x `lib/web/fetch/index.js:2048` | corte del cuerpo: `new TypeError('terminated', { cause: reason })` |
| undici v6.x `docs/docs/api/Errors.md` | códigos `UND_ERR_SOCKET`, `UND_ERR_CONNECT_TIMEOUT`, `UND_ERR_HEADERS_TIMEOUT`, `UND_ERR_BODY_TIMEOUT`, … |

Consultadas el 2026-11-17: `https://registry.npmjs.org/openai/-/openai-7.45.1.tgz`, `https://registry.npmjs.org/@google/genai/-/genai-2.32.0.tgz`, `https://raw.githubusercontent.com/nodejs/undici/v6.x/docs/docs/api/Errors.md`, `https://raw.githubusercontent.com/nodejs/undici/v6.x/lib/web/fetch/index.js`. Validación fuera del repo (regla 11): solo lectura de esos ficheros en el scratchpad.

## 2. Decisiones de diseño

### D1 — `ProviderRegistry`: instancias, inmutable, clave `provider.id`

```ts
// src/registry.ts
export class ProviderRegistry {
  constructor(providers: readonly ModelProvider[]);
  get(id: string): ModelProvider | undefined;
  list(): readonly ModelProvider[];          // orden de alta
}
```

- Clave: `provider.id` (OD-057). Un `id` vacío o repetido → `ProviderResponseError` (`retryable: false`) en el constructor, con plantilla fija `Provider "<id>" is already registered` / `A provider id must not be empty` (precedente OD-065; el código propio es TD-143, TASK-020). El `id` viene de configuración y OD-057 ya lo cita en mensajes.
- `get` de un `id` desconocido devuelve `undefined`: el registry no decide el error (en TASK-020 el `id` puede llegar de una petición HTTP y no debe reflejarse en un mensaje; en TASK-013 lo mapea el nodo).
- Inmutable: sin `register()` posterior. El worker lo construye una vez; si cambia la configuración, se construye otro. Estado por instancia, nunca de módulo.
- Guarda **instancias** construidas: la clave se resuelve en la construcción del adaptador (DoD de TASK-010 y TASK-018) y el fallo de credenciales es temprano.
- *Descartado*: guardar fábricas perezosas (`id → () => ModelProvider`), porque retrasaría `ProviderAuthError` a la primera llamada, contra el DoD de TASK-010. *Descartado*: `register()` mutable, porque nada lo necesita y abre carreras entre runs.

### D2 — Construcción desde configuración: `createProvider`, sin DB

```ts
// src/registry.ts
export type ProviderConfig =
  | { readonly type: "openai-compatible"; readonly id: string; readonly baseUrl: string;
      readonly apiKeyEnv: string | null; readonly capabilities: ProviderCapabilities }
  | { readonly type: "gemini"; readonly id: string; readonly apiKeyEnv: string };

export function createProvider(
  config: ProviderConfig,
  deps: { readonly secretResolver: SecretResolver },
): ModelProvider;
```

- Unión discriminada que refleja las opciones de los adaptadores. No importa `persistence`, no conoce `provider_configs` ni `provider_type` (`openrouter`/`ollama` → `openai-compatible` lo mapea TASK-020). Sin Zod: providers no depende de `zod`, y validar filas es de TASK-020.
- `createProvider` es por entrada: quien construye (worker, web) decide si un proveedor sin clave tumba todo o se omite. El registry recibe el resultado: `new ProviderRegistry(configs.map((c) => createProvider(c, deps)))`.
- No hace red (los constructores actuales no la hacen; test con msw `onUnhandledRequest: "error"`).
- *Descartado*: `buildProviderRegistry(configs)` todo o nada, porque obliga a TASK-020 a elegir ya entre fallar o saltar; con la fábrica por entrada no hay que decidirlo aquí. *Descartado*: dejar la construcción entera a TASK-020, porque worker y web duplicarían el `switch` de adaptadores.

### D3 — Comprobación de capacidades: en `generateWithRetry`, antes del presupuesto, sin quitarla de los adaptadores

- `generateWithRetry` llama a `assertCapabilities(provider.id, provider.capabilities, req)` **antes del primer `budget.reserve`** y antes de la red. Una petición imposible no gasta presupuesto ni red.
- Los adaptadores la conservan como primera línea de `generate`: es la misma función (OD-060), no una copia, y protege a quien llame a `generate` sin la envoltura (SPEC §2.1: «el adaptador falla rápido»). El coste es una segunda comprobación idempotente y barata.
- `assertRepresentable` de Gemini (OD-082) sigue dentro del adaptador: depende de su mapeo. Si salta, lo hace después de reservar la primera llamada y sin red, y no se reintenta (`retryable: false`). Riesgo R3.
- *Descartado*: quitarla de los adaptadores, porque un `generate` directo degradaría en silencio. *Descartado*: un método nuevo en `ModelProvider` para validar sin llamar, porque cambia `core` y ARCHITECTURE §3.1 por un caso (R3) que solo cuesta una reserva.

### D4 — Envoltorio de reintentos: función, no decorador

```ts
// src/retry.ts
export interface CallBudget {
  reserve(kind: "model"): void;              // lanza BudgetExceededError (core) si no queda
}

export interface RetryPolicy {
  readonly maxRetries: number;               // reintentos, sin contar la primera llamada
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly jitterRatio: number;              // 0..1
  readonly maxRetryAfterMs: number;          // tope de retryAfterMs (TD-161)
}

export const DEFAULT_RETRY_POLICY: RetryPolicy; // { 2, 500, 8_000, 0.25, 60_000 }, congelado

export interface GenerateWithRetryOptions {
  readonly signal: AbortSignal;
  readonly budget: CallBudget;
  readonly policy?: Partial<RetryPolicy>;
  readonly sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  readonly random?: () => number;            // [0, 1)
}

export function generateWithRetry(
  provider: ModelProvider,
  req: GenerateRequest,
  options: GenerateWithRetryOptions,
): Promise<GenerateResponse>;
```

- **Función por llamada.** El presupuesto es por run y el registry vive lo que vive el proceso: un decorador `withRetry(provider)` habría que construirlo por run, y obliga a decidir qué hace `listModels`. La función deja `ModelProvider` intacto y el orquestador hace `generateWithRetry(registry.get(id), req, { signal, budget })`.
- **`budget` obligatorio.** Sin presupuesto no hay llamada: no existe un modo «sin descontar» por omisión. `CallBudget` es estructural: `BudgetGuard.reserve(kind: "model" | "tool", est?: number): void` (ARCHITECTURE §3.3) lo cumple sin adaptador, y providers no importa `policies` (que no existe). Los tests pasan un contador.
- **Sin `onRetry`/trazas.** SPEC §5.2 pide registrar reintentos en M3; añadir un callback opcional después no rompe nada. *Descartado* ahora por no pedirlo el DoD.
- **Sin reintentos en `listModels`**: el DoD habla de llamadas a modelo; `listModels` no gasta presupuesto de llamadas.

### D5 — Algoritmo (orden exacto)

```
validar policy (enteros/finitos ≥ 0, jitterRatio ∈ [0,1], baseDelayMs ≤ maxDelayMs)
  → si no: ProviderResponseError retryable:false, sin reservar
assertCapabilities(provider.id, provider.capabilities, req)
signal.throwIfAborted()
budget.reserve("model")                      // intento 0
loop retry = 0..:
  try return await provider.generate(req, signal)
  catch e:
    si signal.aborted → throw signal.reason
    si e no es AgentLabError o !e.retryable o retry == maxRetries → throw e
    si e es ProviderRateLimitError y e.retryAfterMs > maxRetryAfterMs → throw e   // OD-085 (b)
    delay = retryDelay(e, retry)             // ver D6
    budget.reserve("model")                  // reserva del siguiente intento, ANTES de esperar
    await sleep(delay, signal)               // abortable
    signal.throwIfAborted()
```

- El error que se propaga es el **original** (sin envolver, sin `cause` nuevo), para no tocar las garantías de no-fuga de TASK-010/018.
- `BudgetExceededError` de `reserve` se propaga tal cual y corta los reintentos: el orquestador lo convierte en `partial` (ROADMAP M1).
- *Reserva antes de esperar*: si el presupuesto está agotado no se esperan hasta 60 s para descubrirlo. Coste: si se cancela durante la espera, cuenta una llamada no hecha (sesgo conservador). *Descartado* reservar después de la espera por ese retraso inútil.

### D6 — Backoff, jitter y `retryAfterMs`

| Caso | Espera |
|---|---|
| `ProviderRateLimitError` con `retryAfterMs` definido y `≤ maxRetryAfterMs` | exactamente `retryAfterMs`, sin jitter |
| `ProviderRateLimitError` con `retryAfterMs > maxRetryAfterMs` | ninguna: no se reintenta ni se reserva otra llamada; se relanza el error original con su `retryAfterMs` (OD-085 (b), 2026-11-18) |
| Resto de `retryable` (429 sin `retryAfterMs`, timeout, 409/5xx, conexión transitoria) | `min(baseDelayMs · 2^retry, maxDelayMs) · (1 − random() · jitterRatio)` |

- Valores por defecto con fuente: `maxRetries: 2` (`openai` `client.js:101`); `baseDelayMs: 500` y `maxDelayMs: 8_000` (`client.js:1199-1200`); `jitterRatio: 0.25` (`client.js:1205`); `maxRetryAfterMs: 60_000` (`client.js:1169`, y `DEFAULT_RETRY_MAX_DELAY = 60` en `@google/genai` `index.mjs:13698`). Es el comportamiento del SDK que se desactivó en TASK-010, ahora con presupuesto.
- Con los límites de OD-069 (`maxCalls` = 2 por invocación) el orquestador pasará `maxRetries ≤ maxCalls − 1`, o su `budget` combinará el límite del agente con el del run. Lo decide TASK-013; aquí basta con que el máximo sea configurable por llamada.
- `retryAfterMs` se sigue informando tal cual en el error (dato para la UI); el tope se aplica donde se espera, para los tres proveedores a la vez. Así se paga TD-161 sin tocar los dos parsers.
- *Descartado*: «full jitter» (`random(0, min(cap, base·2^n))`). Con ≤ 3 agentes concurrentes (SPEC §5.1) apenas hay contención que repartir, y su espera puede ser ~0 justo tras un 5xx. *Descartado*: sumar jitter a `retryAfterMs`, porque «respeta `retryAfterMs`» significa esperar lo que dice el servidor.

### D7 — Espera abortable e inyección para tests

- `sleep` por defecto: `setTimeout` (no `AbortSignal.timeout`, para que los fake timers de vitest lo controlen, como en los adaptadores). Rechaza con `signal.reason` si el signal ya está abortado o se aborta durante la espera; limpia el timer y quita el listener en ambos caminos.
- `sleep` y `random` inyectables en `GenerateWithRetryOptions`. No hace falta reloj (`now`): `Retry-After` con fecha ya se convierte en el adaptador (`toProviderError(err, id, Date.now())`).

### D8 — TD-165: regla común de reintento de red (OD-086 (a), decidida 2026-11-18)

Módulo compartido `src/network-failure.ts`:

```ts
export function isTransientNetworkFailure(err: unknown): boolean;
```

- Recorre la cadena `cause` (máximo 5 eslabones, guardas `isRecord`) y lee solo `code` (string). Devuelve `true` si algún `code` está en la lista blanca: `ECONNRESET`, `ECONNREFUSED`, `ECONNABORTED`, `ETIMEDOUT`, `EPIPE`, `EAI_AGAIN`, `ENETUNREACH`, `EHOSTUNREACH`, `UND_ERR_SOCKET`, `UND_ERR_CONNECT_TIMEOUT`, `UND_ERR_HEADERS_TIMEOUT`, `UND_ERR_BODY_TIMEOUT`. Cualquier otro código (TLS `CERT_*`, `ERR_TLS_*`, `*_SELF_SIGNED_*`, `UNABLE_TO_*`, `ENOTFOUND`), o ninguno, da `false`. No copia nada del error.
- Gemini (`toGeminiProviderError`): `TypeError` con mensaje `"fetch failed"` **o** `"terminated"` → `ProviderResponseError` «connection failed» con `retryable: isTransientNetworkFailure(err)`. Los demás `TypeError` siguen siendo «unexpected», no retryable (MAJOR de TASK-018 intacto).
- openai-compatible (`toProviderError`): `APIConnectionError` → «connection failed», `retryable: isTransientNetworkFailure(err.cause)`; `TypeError("terminated")` (cuerpo cortado, sale sin envolver de `response.text()`) → «connection failed», `retryable: isTransientNetworkFailure(err)`. `APIConnectionTimeoutError` sigue siendo `ProviderTimeoutError`.
- Efecto: corte a mitad del cuerpo → reintentable en los dos adaptadores; fallo TLS → no reintentable en los dos; fallo sin código (incluido `HttpResponse.error()` de msw) → no reintentable. Modifica la línea «error de conexión → `retryable: true`» de OD-059; por eso se decidió como OD-086 (a), que deja OD-059 precisada como «error de conexión transitorio → `retryable: true`; TLS o sin código → `retryable: false`».

### D9 — TD-145: qué se paga aquí

Lo único que TASK-019 puede pagar sin red es el orden: capacidad comprobada antes del presupuesto y de la red (D3). Verificar las capacidades declaradas contra el modelo real exige llamadas reales, que es justo lo que hace la suite de contrato de TASK-022. **Aprobado con el plan (2026-11-18, «Aprobar todo (Recommended)»):** TD-145 sigue OPEN y su pago queda solo en TASK-022; lo anota docs-keeper en el cierre.

### D10 — TD-167

- `gemini/errors.ts:51`: el comentario de ~140 caracteres se reescribe en líneas ≤ 100 (el bloque cambia de todos modos con D8).
- `gemini/no-leak.test.ts:164`: el título pasa a describir lo que prueba, p. ej. `"a malformed 200 with %s is not retryable and carries no cause"`.

## 3. Pasos (owner: providers-dev salvo indicación)

| # | Paso | Ficheros |
|---|---|---|
| 1 | Regla OD-086 (a): `isTransientNetworkFailure` con su lista blanca (D8) y tests unitarios con errores con la forma de undici (`TypeError('fetch failed', {cause})`, `TypeError('terminated', {cause: {code:'UND_ERR_SOCKET'}})`, cadena de 2-3 eslabones, `AggregateError` con `code`, TLS `CERT_HAS_EXPIRED` y `ERR_TLS_CERT_ALTNAME_INVALID`, sin código, ciclos de `cause`) | `src/network-failure.ts`, `src/network-failure.test.ts` |
| 2 | Aplicar la regla OD-086 (a) (D8) en Gemini, y TD-167 | `src/gemini/errors.ts`, `src/gemini/errors.test.ts`, `src/gemini/provider.test.ts` (`:304-310`, `HttpResponse.error()` pasa a esperar `retryable: false`), `src/gemini/no-leak.test.ts` (`:164`, título; `:87` solo comprueba la ausencia del canario y no cambia) |
| 3 | Aplicar la regla OD-086 (a) (D8) en openai-compatible | `src/openai-compatible/errors.ts`, `src/openai-compatible/errors.test.ts` (`:113` con `cause` transitoria, TLS y sin `cause`; caso «terminated»), `src/openai-compatible/provider.test.ts` (`:297`) |
| 4 | `ProviderRegistry`, `ProviderConfig`, `createProvider` y tests | `src/registry.ts`, `src/registry.test.ts` |
| 5 | `generateWithRetry` (con el tope de `retryAfterMs` según OD-085 (b) y la reserva de todos los intentos según OD-087 (a)), `RetryPolicy`, `DEFAULT_RETRY_POLICY`, `CallBudget`, `sleep` por defecto y tests | `src/retry.ts`, `src/retry.test.ts` |
| 6 | Exportar y fijar la API pública | `src/index.ts`, `src/index.test.ts` |
| 7 | `typecheck`, `lint`, `format:check` y `test --coverage` en contenedor (nunca en el host) | — |
| 8 | Cierre: docs-keeper anota TD-161/165/167 pagadas y TD-145 según D9; como OD-087 salió (a), el architect añade en el cierre, con su propio encargo, una frase a ARCHITECTURE §3.3 («las llamadas a modelo las reserva `generateWithRetry` de `providers`, una por intento; el orquestador no reserva por su cuenta»); no se añade antes del cierre | `docs/TECHNICAL_DEBT.md`, `docs/TASKS.md` (docs-keeper); `docs/ARCHITECTURE.md` (architect) |

Los pasos 1-3 aplican la regla de OD-086 (a) tal como la describe D8, sin variantes.

### 3.1 Scope frente a role-guard (regla 12)

- Pasos 1-6: todo dentro de `packages/providers/**`; `role-guard.sh:28` lo permite a providers-dev. `src/index.ts` también lo puede tocar devops, pero no hace falta.
- **No se toca `packages/core`**: `CallBudget` es un tipo local y los errores ya existen. **No se toca `package.json` ni `pnpm-lock.yaml`**: sin dependencias nuevas.
- Paso 8 (cierre) fuera del scope de la tarea, como en TASK-018: docs-keeper y architect con su propio encargo.
- `deps_allowed`: vacío.

## 4. Contratos públicos nuevos (`@agentlab/providers`)

Nuevos exports del índice: `ProviderRegistry`, `createProvider`, `generateWithRetry`, `DEFAULT_RETRY_POLICY` (valores) y los tipos `ProviderConfig`, `CallBudget`, `RetryPolicy`, `GenerateWithRetryOptions`. Firmas en D1, D2 y D4. Sin cambios en `ModelProvider` ni en `core`. `isTransientNetworkFailure` es interno (no se exporta). `@agentlab/providers/testing` no cambia.

## 5. DoD refinado (aprobado por el humano el 2026-11-18, para TASKS.md)

1. `ProviderRegistry` se construye con `ModelProvider[]` y usa `provider.id` como clave (OD-057). Un `id` vacío o repetido da `ProviderResponseError` (`retryable: false`) en el constructor. `get(id)` devuelve el proveedor o `undefined`; `list()` respeta el orden de alta; no hay alta posterior. Sin DB ni `provider_configs`.
2. `createProvider(config, { secretResolver })` construye `OpenAICompatibleProvider` o `GeminiProvider` según `config.type` y propaga sus errores de construcción (`ProviderAuthError`, `baseUrl` inválida). Ninguna petición HTTP al construir (msw con `onUnhandledRequest: "error"`).
3. `generateWithRetry` lanza `ProviderCapabilityError` antes de cualquier `budget.reserve` y de la red: test con `FakeProvider` sin `tools`, con 0 reservas y 0 llamadas en `calls`.
4. Solo se reintenta un `AgentLabError` con `retryable: true`. Un error no reintentable, un error que no es `AgentLabError` o `signal.reason` se propagan sin reintento, tras exactamente una llamada y siendo el mismo objeto (`toBe`).
5. Backoff exponencial con jitter: la espera del reintento `n` es `min(baseDelayMs·2^n, maxDelayMs)·(1 − random·jitterRatio)`. Tests con `random` inyectado (0 y 0.999…) y `sleep` inyectado que registra las esperas exactas. `DEFAULT_RETRY_POLICY` = `{ maxRetries: 2, baseDelayMs: 500, maxDelayMs: 8000, jitterRatio: 0.25, maxRetryAfterMs: 60000 }`, congelado.
6. `retryAfterMs ≤ maxRetryAfterMs` → la espera es exactamente `retryAfterMs`, sin jitter. `retryAfterMs > maxRetryAfterMs` → no se reintenta (OD-085 (b)): se relanza el error original (`toBe`) con su `retryAfterMs` intacto, sin esperar y sin reservar otra llamada. Nunca se espera más de `maxRetryAfterMs` (TD-161): test con `retryAfterMs: 999_999_999_000` ⇒ 1 reserva, 1 llamada a `generate`, 0 esperas y el error original.
7. Máximo configurable por llamada (`policy.maxRetries`): como mucho `maxRetries + 1` llamadas a `generate`. Con `maxRetries: 0`, una llamada y el error original. Una `policy` inválida da `ProviderResponseError` (`retryable: false`) sin reservar ni llamar.
8. Descuento del presupuesto (OD-087 (a)): `budget` es obligatorio y `generateWithRetry` reserva todas las llamadas a modelo. Cada intento, el primero incluido, llama una vez a `budget.reserve("model")` antes de su `generate`; la reserva de un reintento ocurre antes de su espera. Un `BudgetExceededError` de `reserve` se propaga tal cual, sin más llamadas ni esperas. Test: N reintentos ⇒ N+1 reservas; presupuesto agotado tras 1 ⇒ 1 llamada y `BudgetExceededError`.
9. `AbortSignal`: abortado antes de empezar ⇒ `signal.reason`, 0 reservas y 0 llamadas. Abortado durante la espera ⇒ rechaza con `signal.reason` sin esperar al timer, sin más intentos, timer limpiado y listener retirado (fake timers: `vi.getTimerCount() === 0` tras el rechazo). Abortado durante `generate` ⇒ `signal.reason` sin reintento.
10. TD-165 (OD-086 (a)): la misma regla de lista blanca en los dos adaptadores, compartida en `src/network-failure.ts`. Un código de la lista blanca en la cadena `cause` da «connection failed» `retryable: true`. Un fallo TLS, `ENOTFOUND`, sin código o con un código desconocido da «connection failed» `retryable: false` (incluido `HttpResponse.error()` de msw). Un corte a mitad del cuerpo (`"terminated"` con `UND_ERR_SOCKET`) da `retryable: true` en los dos. Mensaje de plantilla fija y sin `cause` (los tests de no-fuga siguen en verde).
11. TD-167: comentario de `gemini/errors.ts` en líneas ≤ 100 caracteres; título del test de `no-leak.test.ts:164` renombrado.
12. `index.test.ts` fija la lista nueva de exports; ninguna ruta interna; `./testing` sin cambios.
13. Tests sin red real y sin timers reales (`sleep` inyectado o fake timers). Cobertura del paquete ≥ 90 % (OD-066). `typecheck`, `lint`, `format:check` y `test` en verde en contenedor. `package.json` y `pnpm-lock.yaml` sin cambios.

**security REQUIRED: sí.** Motivos: los reintentos multiplican llamadas (presupuesto, cuota gratuita, coste), el tope de `retryAfterMs` y la reclasificación de fallos TLS (no insistir contra un certificado inválido).

## 6. Estrategia de tests

- `retry.test.ts`: `FakeProvider` (`rateLimit` con y sin `retryAfterMs`, `timeout`, `respond`) y un stub mínimo de `ModelProvider` para 5xx retryable, 4xx no retryable y un error que no es `AgentLabError`. `budget` = contador `vi.fn`. `sleep` inyectado que registra `ms` y resuelve. Un bloque aparte usa el `sleep` por defecto con `vi.useFakeTimers()` para la cancelación y la limpieza.
- `network-failure.test.ts` y los `errors.test.ts`: errores construidos con la forma exacta de undici (§1.3), sin sockets. Los `provider.test.ts` con `HttpResponse.error()` de msw pasan a comprobar «connection failed» no retryable (msw no pone `code`).
- `registry.test.ts`: `FakeProvider` con ids distintos y repetidos; `createProvider` con `secretResolver` falso y msw en `onUnhandledRequest: "error"`.
- Mutaciones a cubrir (el tester las intentará): `>=`/`>` en `maxRetries` y en el tope; reserva después de la espera; jitter sumado en vez de restado; quitar `assertCapabilities` de la envoltura; quitar un código de la lista blanca.

## 7. Riesgos

- **R1 — Contrato con `BudgetGuard` sin diseñar (TASK-011).** Si TASK-011 empareja `reserve` con `commit` por intento, `CallBudget` necesitará `commit` y la envoltura tendrá que confirmar `null` en los intentos fallidos. Mitigación: `CallBudget` es mínimo y estructural; ampliarlo es un cambio aditivo en providers. Queda escrito para el plan de TASK-011.
- **R2 — Doble descuento.** Si TASK-013 reserva también en `gate.budget` antes de llamar a `generateWithRetry`, cada llamada cuenta dos veces. Mitigación: OD-087 y la frase en ARCHITECTURE §3.3.
- **R3 — `assertRepresentable` de Gemini después de la reserva.** Una petición no representable gasta una unidad de presupuesto sin red. Aceptado: no se reintenta y es un error de construcción del prompt (OD-082).
- **R4 — Cambio de comportamiento con msw.** Con OD-086 (a) (decidida), `HttpResponse.error()` deja de ser retryable. Los tests de adaptador ya no prueban el camino retryable con HTTP falso: lo cubren los tests unitarios con la forma de undici, respaldados por las sondas reales de TASK-018 (`TASK-018.md:357-362`). Si undici cambia la forma, falla del lado seguro (no reintenta).
- **R5 — Esperas largas dentro del run.** Con los valores por defecto, hasta 2 × 60 s de espera más los timeouts por llamada. Lo corta el `signal` del timeout del run (5 min, SPEC §5.1), y con OD-085 (b) (decidida) no se espera nunca más de `maxRetryAfterMs` ni antes de lo que pide el servidor.
- **R6 — Un corte a mitad del cuerpo se reintenta (OD-086 (a), decidida).** El servidor probablemente terminó la generación: el reintento repite inferencia y cuota. Lo acotan `maxRetries` y el presupuesto, que lo cuenta.
- **R7 — `ENOTFOUND` no se reintenta.** Si Ollama aún no resuelve en Docker al arrancar, el primer fallo es definitivo. Aceptable: un host inexistente suele ser configuración. Se revisa con TASK-021 si molesta.

## 8. Deuda

- **Se paga:** TD-161 (tope en la envoltura según OD-085 (b), D6, DoD 6), TD-165 (regla OD-086 (a), D8, DoD 10) y TD-167 (D10, DoD 11).
- **No se paga:** TD-145 (D9: recomendación de pasar su pago solo a TASK-022) y TD-143 (código `PROVIDER_CONFIG_INVALID`, TASK-020; este plan añade dos usos más de `ProviderResponseError` para configuración, en el registry y en la `policy`).
- **Deuda nueva que prevé el plan:** ninguna (las decisiones de OD-085/086/087 no añaden deuda).

## 9. OPEN DECISIONS — todas RESUELTAS el 2026-11-18 por el humano (SPEC §13)

Decisiones: **OD-085 → (b)** («No reintentar (Recommended)»), **OD-086 → (a)** («Lista blanca de códigos (Recommended)»), **OD-087 → (a)** («La envoltura, todas (Recommended)»). Se conserva abajo el resumen de opciones como traza.

- **OD-085 — `retryAfterMs` mayor que el tope.** (a) Esperar `min(retryAfterMs, maxRetryAfterMs)` y reintentar (letra de TD-161). (b) No reintentar y relanzar el error original con su `retryAfterMs`. (c) Ignorarlo y usar el backoff propio (lo que hace el SDK de OpenAI). **Recomendación: (b).**
- **OD-086 — Regla común de reintento de red (TD-165).** (a) Lista blanca de códigos transitorios en la cadena `cause`: el corte del cuerpo se reintenta, y TLS, sin código o desconocido no. (b) Lista negra de TLS sobre la regla actual, añadiendo «terminated». (c) Mantener la regla actual en los dos adaptadores y solo documentarla. **Recomendación: (a).** Modifica OD-059.
- **OD-087 — Quién reserva la primera llamada.** (a) `generateWithRetry` reserva todos los intentos y el orquestador no reserva llamadas a modelo. (b) El orquestador reserva la primera y la envoltura solo los reintentos. (c) La envoltura no toca el presupuesto y devuelve cuántos intentos hizo. **Recomendación: (a).**

No queda ninguna OPEN DECISION en este plan. Los pasos 1-3 aplican OD-086 (a); el paso 5 y los DoD 6 y 8 aplican OD-085 (b) y OD-087 (a); el paso 8 incluye la frase de ARCHITECTURE §3.3 que exige OD-087 (a).
