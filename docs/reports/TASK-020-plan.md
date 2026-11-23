# TASK-020 — Plan: `GET /api/providers` y selección por agente desde `provider_configs`

Fecha: 2026-11-20 · Autor: architect · Estado: **APROBADO (2026-11-20, humano)**.

Respuestas literales del humano (2026-11-20, AskUserQuestion):
- OD-088 a OD-093: «Aceptar todas (Recommended)» → OD-088 (b), OD-089 (b), OD-090 (a), OD-091 (c), OD-092 (a), OD-093 (a). Registradas como RESUELTAS en SPEC §13.
- Capacidades de OD-090: «Confirmar (Recommended)» → la tabla de D3, tal cual.
- Plan: «Aprobar todo (Recommended)».

El egress (OD-093 (a)) no se ejecuta en esta tarea: va a TASK-050 (§8) con [ADR-014](../adr/ADR-014-salida-restringida-egress-gateway.md) (Proposed).

## 1. Contexto

- TASK-019 dejó en `packages/providers` el `ProviderRegistry` (clave `provider.id`), `createProvider(config, { secretResolver })` y `generateWithRetry`. No hay nada que lea `provider_configs`: según TASK-019 D2, el mapeo de filas a `ProviderConfig` es trabajo de TASK-020.
- `apps/web` solo tiene `/`, que enlaza a un `/projects` que devuelve 404 (OD-046), y `GET /api/health`. No depende de `@agentlab/providers`. En `compose.yaml`, `web` no recibe ninguna `*_API_KEY` (`compose.yaml:53-56`). ARCHITECTURE §1 dice que `web` no hace llamadas salientes y que está en la red `egress` solo para publicar el puerto.
- El DoD literal mezcla cuatro cosas de cuatro owners: la API y la UI (web-dev), el endurecimiento de `providers` y `core` (deuda TD-012/141/142/143/171), y la salida restringida de `worker` y `web` (TD-018, compose: devops), que exige un servicio nuevo. El scope literal (`apps/web/src/app/api/providers/**`, `apps/web/src/app/(app)/projects/**`) solo cubre la primera.

### 1.1 Fuentes leídas

| Fuente | Lo relevante |
|---|---|
| TASKS.md:435-437 | DoD literal y scope literal. |
| ROADMAP M2 (`:45-58`) | Entregables: «`GET /api/providers` con capacidades y modelos disponibles (sin claves)» y «Selección de proveedor/modelo por agente desde `provider_configs`». Criterio de salida: «cambiar de proveedor en `provider_configs` sin modificar ninguna definición de agente ni el grafo». |
| SPEC §2.1, §6, §8, §9 | Ollama en `http://ollama:11434/v1/`. `provider_configs` guarda solo configuración no secreta. `GET /api/providers`: «Proveedores configurados y capacidades (nunca claves)». §9.7: allowlist de destinos y bloqueo de rangos privados y de metadatos. |
| SPEC §13 | OD-046 (`/projects` lo añade TASK-020 o TASK-034), OD-057 (`id` como clave), OD-064/TD-142, OD-065/TD-143, OD-079 (`base_url` se ignora para `gemini`, «lo documenta TASK-020»), OD-080/TD-164, OD-085 a OD-087. Última OD: OD-087. |
| ARCHITECTURE §1, §2, §3.1, §3.3, §6, §7, §9 | Redes (`backend` y `test-db` internas; `egress` para `web`, `worker` y `ollama`). Dirección de dependencias (`web` puede importar `providers`). Sub-exports permitidos. `provider_configs` (`provider_type`, `base_url`, `default_model`, `api_key_env`). En `web`, la lógica va en `apps/web/src/server/**`, sin estado global y con Server Components para leer. Regla de las dos semanas. |
| ADR-003 §2 | OpenRouter y Ollama son **configuraciones** del adaptador `openai-compatible`. |
| TASK-018, TASK-019 y sus planes | `createProvider` y el registry, sin DB (D2). Deuda con pago en TASK-020. Riesgos de los SDK. |
| TECHNICAL_DEBT | Filas completas de TD-012, TD-018, TD-141, TD-142, TD-143, TD-164 y TD-171. Relacionadas: TD-005, TD-038, TD-145, TD-159. |
| Código en disco (HEAD 2cf65ed) | Ver §1.2. |
| `role-guard.sh` | Contrastado en §5 (regla 12). |

### 1.2 Estado del código (verificado en disco)

- `packages/persistence`:
  - `provider_configs` existe (`schema/provider-configs.ts`). `provider_type` es `text NOT NULL` sin lista cerrada y `base_url` es `text NULL`. No tiene columna de capacidades ni de nombre.
  - El repositorio (`repositories/provider-configs.ts`) tiene `create`, `get` y `listByProject`, y solo valida `api_key_env`. El test de integración usa `providerType: "openai-compatible"`.
  - `agent_definitions` tiene `provider_config_id` (FK `restrict`) y `model_id NOT NULL`. Su repositorio no tiene `update`.
- `packages/core`:
  - `AgentDefinitionSchema` tiene `providerId: uuid` y `modelId: string.min(1)`. Por tanto, el `id` del proveedor en el registry es el `id` de la fila de `provider_configs`.
  - `AgentLabErrorCode` no tiene código de configuración (`errors.ts:4-13`).
  - `httpUrl()` (`env.ts:12`) solo comprueba el esquema.
- `packages/providers`:
  - `createProvider` (`registry.ts:56-71`) no tiene rama `default` (TD-171).
  - `assertHttpUrl` (`openai-compatible/provider.ts:31-42`) acepta `user:pass@` y `http` con clave.
  - El cliente OpenAI no fija `fetchOptions.redirect` (`:57-69`) y Gemini no pasa `httpOptions.fetch` (`gemini/provider.ts:62-67`).
  - Las capacidades de Gemini son una constante dentro del adaptador, que importa el SDK.
  - Hay un único export `.`, más `./testing`.
- `apps/web`:
  - `transpilePackages: ["@agentlab/core", "@agentlab/persistence"]`.
  - Cada petición a `/api/health` abre su propio pool (TD-038).
  - No hay `(app)/`.
- `apps/worker` no construye proveedores (lo hará TASK-015).

### 1.3 Verificaciones de los SDK (tarballs del registro npm en el scratchpad, solo lectura, sin ejecutar Node; 2026-11-20)

- **`openai@7.45.1`:**
  - `client.js:254-264`: `OPENAI_CUSTOM_HEADERS` se lee y se fusiona como `options.defaultHeaders = buildHeaders([parsed, options.defaultHeaders])`, así que **las `defaultHeaders` explícitas prevalecen sobre las del entorno**.
  - `client.js:1415-1416`: al montar la petición, las `defaultHeaders` van después de `authenticationHeaders`, y ese es el camino por el que el entorno sustituye a `Authorization` (TD-142).
  - `internal/headers.js:48-72`: en `buildHeaders`, la última entrada gana y `null` borra.
  - `client.js:1386-1387`: `fetchOptions` se esparce en el `RequestInit`, así que `fetchOptions: { redirect: "error" }` llega a `fetch` (TD-141 L2).
- **`@google/genai@2.32.0`** (`dist/node/index.mjs`):
  - `HttpOptions.fetch` existe (`genai.d.ts:8688`), `getFetch()` lo devuelve (`:13814`) y `apiCall` lo usa en lugar del `fetch` global (`:14070`).
  - Si se pasa `fetch`, el SDK deja de añadir su dispatcher «sin timeouts» (`:13957-13962`). Ese dispatcher delega en el dispatcher global de undici (`:13635-13650`).
- **Node `NODE_USE_ENV_PROXY`:** disponible para `fetch()` desde v22.21.0 (Node.js, «Enterprise network configuration», https://nodejs.org/en/learn/http/enterprise-network-configuration, consultado el 2026-11-20). El proyecto usa 22.23.4. Es cooperativo: un agente o dispatcher explícito lo anula.

## 2. Decisiones de diseño (decididas el 2026-11-20, §9)

### D1 — Se parte la tarea: el egress va a una tarea nueva de devops (OD-088 (b))

- TASK-020 se queda con la API, la UI, el mapeo `provider_configs` → proveedor y el endurecimiento de `core` y `providers`.
- La salida restringida de `worker` y `web` (TD-018 y la mitad de allowlist de TD-012) pasa a la tarea nueva **TASK-050** (número libre en TASKS.md, comprobado el 2026-11-20). Owners: devops y engine-dev. Lleva su ADR y `security REQUIRED`. Su diseño está en §8.
- *Descartado*: una sola tarea con cinco owners. Mezcla un servicio nuevo de infraestructura (con ADR, verificación manual con red real y otra superficie de ataque) con una API de lectura. Además, el egress no depende de nada de la API (§8).

### D2 — `web` no recibe claves ni llama a proveedores; los modelos son los declarados (OD-089 (b))

- `GET /api/providers` devuelve, para cada fila de `provider_configs`:
  - las capacidades del preset de su tipo (D3);
  - los modelos **declarados**: `default_model` más los `model_id` de los agentes que usan esa configuración.
- `web` no construye adaptadores, no resuelve secretos y no hace red. Las claves siguen solo en `worker`.
- *Descartado* (a), listar en vivo con `listModels()` desde `web`:
  - Obliga a dar las claves a `web`, el único proceso con un puerto que el navegador alcanza, sin autenticación (TD-005) y sin las protecciones de `Host`/`Origin` de TASK-014.
  - Precedente: CVE-2025-55182, RCE sin autenticación en los endpoints de React Server Components (CVSS 10, en el catálogo KEV de CISA; React, 2025-12-03, https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components). Un fallo así en `web` expondría las claves. El `worker` no tiene listener.
- *Descartado* (c), catálogo en BD refrescado por el `worker`: tabla o columna nueva más un bucle nuevo en el `worker`, que aún no construye proveedores (TASK-015). No se abre ahora; si algún día se piden modelos en vivo, sería una tarea propia.

### D3 — Tipos cerrados con preset: `openrouter`, `ollama` y `gemini`; `base_url` se ignora (OD-090 (a))

- `provider_type` ∈ `PROVIDER_TYPES = ["openrouter", "ollama", "gemini"]`. Cada tipo tiene un preset con el adaptador, la URL constante, la regla de clave y las capacidades:

  | Tipo | Adaptador | URL base (constante) | `api_key_env` | Capacidades (confirmadas por el humano el 2026-11-20; criterio de OD-078: lo que hace el adaptador; por modelo es TD-145) |
  |---|---|---|---|---|
  | `openrouter` | `openai-compatible` | `https://openrouter.ai/api/v1` | obligatorio | tools ✓, structuredOutput ✓, streaming ✗, maxContextTokens `null`, reportsUsage ✓, reportsCost ✗ |
  | `ollama` | `openai-compatible` | `http://ollama:11434/v1/` (SPEC §2.1) | debe ser `null` | tools ✓, structuredOutput ✓, streaming ✗, maxContextTokens `null`, reportsUsage ✓, reportsCost ✗ |
  | `gemini` | `gemini` | la de OD-079, en el adaptador | obligatorio | las de OD-078 (sin cambios) |

- `provider_configs.base_url` se ignora en los tres tipos. OD-079 ya lo hacía con `gemini`; este plan lo documenta, tal como pedía OD-079. Así **ninguna URL que venga de la BD o de la UI llega nunca a un adaptador**, y el riesgo de SSRF de TD-012 por ese camino desaparece por diseño.
- El `id` del proveedor es el `id` (uuid) de la fila, que es lo que referencia `AgentDefinition.providerId`.
- Una fila con un tipo desconocido, o que incumple la regla de clave, no tumba nada: aparece como `valid: false` con `PROVIDER_CONFIG_INVALID`.
- La lista cerrada vive en `providers` (`./presets`), no en `core`, porque `persistence` no la necesita (D7).
- *Descartado* (b), tipo genérico `openai-compatible` con `base_url` validada, una allowlist de hosts en una variable de entorno y una columna `capabilities jsonb` con migración: abre exactamente el camino de SSRF que TD-012 describe y añade una migración y una variable nueva para un caso (LM Studio, vLLM…) que M2 no pide.
- *Descartado* (c), presets más un genérico con capacidades conservadoras: mismo problema de URL, aunque más acotado.

### D4 — «Selección por agente» = resolución de solo lectura y mapeo compartido; editar es de TASK-034 (OD-091 (c))

- Cada agente usa la configuración `agent.provider_config_id` y el modelo `agent.model_id`, que ya existen en el esquema y en `AgentDefinition`.
- TASK-020 entrega dos cosas:
  1. **`providerConfigFromRecord(row)`** en `@agentlab/providers/presets`. Es el mapeo fila → `ProviderConfig` (con `id` = uuid de la fila) que usarán `web` ahora y el `worker` en TASK-015 (`RunExecutor` «construye dependencias desde `provider_configs`»), sin duplicar el `switch`.
  2. **Las pantallas `/projects` y `/projects/[id]`**, de solo lectura (Server Components). Muestran cada configuración (tipo, modelo por defecto, capacidades, validez) y cada agente con su proveedor y su modelo. Marcan dos incoherencias: un agente cuya configuración es inválida o pertenece a otro proyecto (la FK no lo impide).
- Ni Server Actions ni API de escritura: el primer camino de escritura desde `web` llega con las protecciones de TASK-014, y el editor es TASK-034, cuyo scope ya incluye `api/agents/**`.
- OD-046: TASK-020 crea `/projects`. El architect ajusta ARCHITECTURE §7 en el cierre.
- *Descartado* (a), selector editable con Server Action:
  - Es el primer camino de escritura y llega antes de TASK-014.
  - Un DNS rebinding podría cambiar el modelo de un agente por uno de pago de OpenRouter con la clave del usuario, contra P1 (coste 0).
  - Las Server Functions son justo la superficie de CVE-2025-55182.
- *Descartado* (b), `model_id` anulable con `default_model` como valor por defecto: migración y cambio de `AgentDefinitionSchema` y de `packages/agents`. Solo es necesario si el criterio de salida de M2 se lee como «sin tocar las filas de `agent_definitions`». La lectura fijada por OD-091 (c) es «sin tocar el código de definiciones (`packages/agents`) ni el grafo».

### D5 — Contrato: listado global sin parámetros (OD-092 (a))

Contrato completo en §4. Resumen:
- Lista todas las configuraciones, con `projectId`, porque SPEC §8 no define parámetros y el uso es monousuario.
- La página de proyecto llama a la función de servidor directamente con el `projectId`, sin pasar por HTTP.
- Errores `{ code, message }` (ARCHITECTURE §7) con un único código propio para el fallo interno, hasta que TASK-014 fije el catálogo.

### D6 — Endurecimiento de `providers` y `core`: aquí se paga la deuda que es de TASK-020

- **TD-143**:
  - Nueva subclase en `core`, `ProviderConfigInvalidError` (`PROVIDER_CONFIG_INVALID`, `retryable: false`, mensaje de plantilla fija).
  - La usan `assertHttpUrl`, el constructor de `ProviderRegistry`, `resolvePolicy`, la rama `default` de `createProvider` y `providerConfigFromRecord`.
- **TD-171**: `default: { const unknown: never = config; throw new ProviderConfigInvalidError(...) }`. El mensaje no incluye el valor de `type`.
- **TD-141**:
  - L1: `assertHttpUrl` rechaza `username`/`password`.
  - L3: con `apiKeyEnv !== null`, exige `https:`.
  - L2: `fetchOptions: { redirect: "error" }` en el cliente OpenAI.
  - Gemini: `httpOptions.fetch` envolvente que llama a `globalThis.fetch(input, { ...init, redirect: "error" })` en el momento de la llamada, para que msw lo intercepte en los tests. Va en `src/no-redirect-fetch.ts`, compartido.
- **TD-142**: con clave, `defaultHeaders: { Authorization: \`Bearer ${apiKey}\` }` explícito. Como las explícitas prevalecen sobre `OPENAI_CUSTOM_HEADERS` (§1.3), el entorno ya no puede sustituir la autenticación. Sin clave ya existe `Authorization: null`. El resto de cabeceras del entorno quedan aceptadas por OD-064 (a). `compose` no pasa `OPENAI_CUSTOM_HEADERS` a ningún servicio.
- **TD-012 (parte de credenciales)**: `httpUrl()` de `core` rechaza las URL con `username` o `password`, con un mensaje que no incluye el valor.
- Las capacidades de Gemini pasan del adaptador a `presets.ts`, y el adaptador las importa de ahí: una sola fuente, y `presets` no importa ningún SDK.
- *Descartado*: un `fetch` envolvente que reescriba `Authorization` en cada petición. Es más código, más frágil, y duplica lo que el SDK ya ordena.

### D7 — `persistence` no cambia

- El listado global usa `projects.list()` más `providerConfigs.listByProject()` y `agentDefinitions.listByProject()` de cada proyecto. Son N+1 consultas con N pequeño (monousuario).
- La lista cerrada de tipos se aplica al leer (D3), no al escribir: hoy nada fuera de los tests escribe en `provider_configs`.
- *Descartado*: añadir `list()` y validar `provider_type` en `create`. Mete a persistence-dev, cambia el fixture `"openai-compatible"` y no aporta nada mientras no haya escritura. Esa validación al escribir queda como deuda LOW con pago en TASK-034, que es la tarea que añade escritura (§7).

### D8 — `web` importa solo `@agentlab/providers/presets`

- Sub-export nuevo, `./presets`. Solo puede contener imports de valor de `@agentlab/core` e imports de tipo de `registry.ts`.
- Así ni `openai` ni `@google/genai` entran en el bundle del servidor de `web` ni en `.next/standalone`.
- Dependencia de workspace `@agentlab/providers: workspace:*` en `apps/web/package.json`, y `transpilePackages` ampliado.
- *Descartado*: importar el índice de `providers`. Arrastra los dos SDK al bundle de `web`, que no los usa.

## 3. Pasos y reparto por owner (OD-088 (b))

| # | Owner | Paso | Ficheros |
|---|---|---|---|
| 0 | devops | `"@agentlab/providers": "workspace:*"` en `apps/web` y lockfile. Solo cambia el importer `apps/web`: ninguna versión externa nueva ni cambiada. `pnpm install --frozen-lockfile --ignore-scripts` en verde. | `apps/web/package.json`, `pnpm-lock.yaml` |
| 1 | core-dev | `ProviderConfigInvalidError` + código `PROVIDER_CONFIG_INVALID` (TD-143). `httpUrl()` rechaza credenciales embebidas (TD-012, parte 1). Tests. | `packages/core/src/errors.ts`, `errors.test.ts`, `env.ts`, `env.test.ts`, `index.test.ts` |
| 2 | providers-dev | `presets.ts`: `PROVIDER_TYPES`, `PROVIDER_PRESETS`, `providerConfigFromRecord`, capacidades de Gemini movidas. Sub-export `./presets`. | `packages/providers/src/presets.ts`, `presets.test.ts`, `packages/providers/package.json` (`exports`), `src/gemini/provider.ts` |
| 3 | providers-dev | TD-143 (usos), TD-171, TD-141 (L1, L2, L3, Gemini) y TD-142, con sus tests (msw). | `src/registry.ts`, `registry.test.ts`, `src/retry.ts`, `retry.test.ts`, `src/no-redirect-fetch.ts` (+ test), `src/openai-compatible/provider.ts`, `provider.test.ts`, `construction-no-request.test.ts`, `no-leak.test.ts`, `src/gemini/provider.ts`, `provider.test.ts`, `no-leak.test.ts`, `src/index.ts`, `src/index.test.ts` |
| 4 | web-dev | Función de servidor del listado y vista de proyecto (puras más lectura por petición), y helper de BD por petición (pool `max: 1`, plazo de 2 s, como `/api/health`; un único sitio que TASK-014 sustituirá por el pool compartido, TD-038). | `apps/web/src/server/db.ts`, `apps/web/src/server/providers.ts`, `apps/web/src/server/projects.ts` (+ `*.test.ts` e `*.integration.test.ts`) |
| 5 | web-dev | `GET /api/providers` (`route.ts` solo compone) y test de no fuga. | `apps/web/src/app/api/providers/route.ts`, `route.integration.test.ts`, `no-leak.integration.test.ts` |
| 6 | web-dev | Pantallas `/projects` y `/projects/[id]` (Server Components, `dynamic = "force-dynamic"`, `notFound()` si el id no es uuid o no existe). Sin Client Components ni Server Actions. | `apps/web/src/app/(app)/projects/page.tsx`, `apps/web/src/app/(app)/projects/[id]/page.tsx` |
| 7 | web-dev | `transpilePackages` + `@agentlab/providers`. | `apps/web/next.config.ts` |
| 8 | owners | `typecheck`, `lint`, `format:check`, `test --coverage` y `next build` en contenedor. Comprobar que `.next/standalone` no contiene `node_modules/openai` ni `node_modules/@google/genai`. | — |
| 9 | architect | Cierre: ARCHITECTURE §2 (sub-export `./presets`), §6 (tipos cerrados; `base_url` ignorada en los tres), §7 (`/projects`, `/projects/:id`, contrato de `/api/providers`; OD-046) y §10 (código nuevo). | `docs/ARCHITECTURE.md` |
| 10 | docs-keeper | TASKS y deuda (§7). | `docs/TASKS.md`, `docs/TECHNICAL_DEBT.md` |

Orden: 0 y 1 en paralelo. El 2 necesita el 1. El 3 necesita el 2. Los pasos 4 a 7 necesitan el 0 y el 2.

## 4. Contratos públicos nuevos o cambiados

**`@agentlab/core`**
```ts
export type AgentLabErrorCode = /* …existentes… */ | "PROVIDER_CONFIG_INVALID";
export class ProviderConfigInvalidError extends AgentLabError {   // retryable: false
  constructor(message: string, options?: AgentLabErrorOptions);
}
// env.ts: httpUrl() rechaza user/password (cambio de comportamiento; firma igual)
```

**`@agentlab/providers/presets`** (sub-export nuevo)
```ts
export const PROVIDER_TYPES: readonly ["openrouter", "ollama", "gemini"];
export type ProviderType = (typeof PROVIDER_TYPES)[number];
export function isProviderType(value: string): value is ProviderType;
export interface ProviderPreset {
  readonly adapter: "openai-compatible" | "gemini";
  readonly apiKey: "required" | "none";
  readonly capabilities: ProviderCapabilities;     // congeladas
}
export const PROVIDER_PRESETS: Readonly<Record<ProviderType, ProviderPreset>>;
export interface ProviderConfigRecord {            // estructural: ProviderConfigRow lo cumple
  readonly id: string;
  readonly providerType: string;
  readonly apiKeyEnv: string | null;
}
export function providerConfigFromRecord(record: ProviderConfigRecord): ProviderConfig; // ProviderConfigInvalidError
```

**`@agentlab/providers`** (índice): sin exports nuevos. Cambia el error de configuración inválida (`PROVIDER_RESPONSE` → `PROVIDER_CONFIG_INVALID`) en el registry, `resolvePolicy`, `assertHttpUrl` y `createProvider`.

**`GET /api/providers`** (`dynamic = "force-dynamic"`, `cache-control: no-store`, `content-type: application/json`)
```jsonc
// 200
{ "providers": [
  { "id": "<uuid provider_configs.id>", "projectId": "<uuid>",
    "type": "openrouter" | "ollama" | "gemini" | null,     // null si la fila no es válida
    "valid": true | false,
    "error": null | { "code": "PROVIDER_CONFIG_INVALID" },
    "defaultModel": "<texto>",
    "capabilities": { /* ProviderCapabilities */ } | null,  // null si no es válida
    "models": [ { "id": "<model id>" } ]                   // default_model primero, luego los model_id de sus agentes, sin duplicados
  } ] }
// 500 (cualquier fallo, incluida la BD) — mensaje fijo, nunca el de la excepción
{ "code": "INTERNAL", "message": "Internal server error" }
```
- Nunca salen `base_url`, `api_key_env` ni el `provider_type` crudo si no está en la lista. Orden: proyectos por `created_at, id` y, dentro de cada uno, el de `listByProject`.
- Un entorno inválido (`loadEnv()`) se trata como en `/api/health`: el 500 por defecto de Next (OD-044).

**Funciones de servidor de `web`** (internas de la app)
```ts
// apps/web/src/server/providers.ts
export interface ProviderView { /* forma de cada item de arriba */ }
export function toProviderView(row: ProviderConfigRow, agents: readonly AgentDefinitionRow[]): ProviderView; // pura
export async function listProviderViews(db: Database): Promise<ProviderView[]>;
export async function providersResponse(databaseUrl: string): Promise<Response>;
// apps/web/src/server/projects.ts
export function buildProjectView(project, providerRows, agentRows): ProjectView;  // pura; marca incoherencias
export async function getProjectView(db: Database, projectId: string): Promise<ProjectView | null>;
```

## 5. Scope frente a role-guard (regla 12)

- devops: `apps/web/package.json` y `pnpm-lock.yaml` → `role-guard.sh` (devops: `pnpm-lock.yaml`, `apps/*/package.json`) ✓. web-dev también podría editar `apps/web/package.json`, pero no el lockfile, así que los dos van a devops (precedente: OD-083).
- core-dev: `packages/core/**` ✓.
- providers-dev: `packages/providers/**`, incluido su `package.json` ✓.
- web-dev: `apps/web/**` ✓. El **scope literal se amplía** (aprobado el 2026-11-20) con `apps/web/src/server/{db,providers,projects}*.ts` (ARCHITECTURE §7: la lógica va en `server/**`) y `apps/web/next.config.ts`.
- architect: `docs/ARCHITECTURE.md` ✓. SPEC fuera de §13 no (aviso de `role-guard.sh`): el contrato va a ARCHITECTURE §7 y SPEC §8 no se toca.
- docs-keeper: `docs/TASKS.md`, `docs/TECHNICAL_DEBT.md` ✓.
- `deps_allowed`: `["@agentlab/providers@workspace:*"]`, solo para el paso 0. No entra ninguna dependencia externa, así que la regla de las dos semanas (ARCHITECTURE §9, OD-067) no se aplica. Evidencia: el diff del lockfile solo toca el importer `apps/web`, y `pnpm why openai --filter web` no cambia de versión.
- **Scope fijado por owner** (aprobado el 2026-11-20; `packages/core/src/index.ts` no cambia porque reexporta `errors.js` con `export *`):
  - devops (paso 0): `apps/web/package.json`, `pnpm-lock.yaml`.
  - core-dev (paso 1): `packages/core/src/errors.ts`, `packages/core/src/errors.test.ts`, `packages/core/src/env.ts`, `packages/core/src/env.test.ts`, `packages/core/src/index.test.ts`.
  - providers-dev (pasos 2 y 3): `packages/providers/**`.
  - web-dev (pasos 4 a 7): `apps/web/src/app/api/providers/**`, `apps/web/src/app/(app)/projects/**`, `apps/web/src/server/**`, `apps/web/next.config.ts`.
  - architect (paso 9, cierre): `docs/ARCHITECTURE.md` (§2, §6, §7 y §10).
  - docs-keeper (paso 10): `docs/TASKS.md`, `docs/TECHNICAL_DEBT.md`.
- **`task-scope.json` (unión de los pasos de código):** `apps/web/package.json`, `pnpm-lock.yaml`, `packages/core/src/errors.ts`, `packages/core/src/errors.test.ts`, `packages/core/src/env.ts`, `packages/core/src/env.test.ts`, `packages/core/src/index.test.ts`, `packages/providers/**`, `apps/web/src/app/api/providers/**`, `apps/web/src/app/(app)/projects/**`, `apps/web/src/server/**`, `apps/web/next.config.ts`. `deps_allowed`: `["@agentlab/providers@workspace:*"]`.

## 6. DoD refinado (fijado; para TASKS.md)

1. **Error de configuración (TD-143).**
   - `core` exporta `ProviderConfigInvalidError` (`code: "PROVIDER_CONFIG_INVALID"`, `retryable: false`).
   - La lanzan, con mensaje de plantilla fija sin URL, tipo ni clave: `assertHttpUrl`, el constructor de `ProviderRegistry` (id vacío o repetido), `resolvePolicy` (policy inválida), `createProvider` con un `type` desconocido en ejecución (rama `default` con `never`, TD-171) y `providerConfigFromRecord`.
   - Los tests que esperaban `ProviderResponseError` en esos casos pasan a esperar la clase nueva.
2. **URL base (TD-141, TD-012 parte 1).**
   - `assertHttpUrl` rechaza `user:pass@` y `user@`, y también `http:` cuando hay `apiKeyEnv`.
   - `httpUrl()` de `core` rechaza credenciales embebidas.
   - En ambos casos hay un canario en la contraseña que no aparece en el mensaje.
3. **Redirecciones (TD-141).**
   - Los dos adaptadores fallan ante 301/302/307/308 sin seguir la redirección: `fetchOptions.redirect: "error"` en OpenAI, `httpOptions.fetch` envolvente en Gemini.
   - Test con msw: exactamente una petición, ninguna al destino de la redirección (que tampoco recibe la clave) y error «connection failed» con `retryable: false` sin `cause`.
4. **`OPENAI_CUSTOM_HEADERS` (TD-142).**
   - Con `vi.stubEnv("OPENAI_CUSTOM_HEADERS", "Authorization: Bearer attacker")`, el servidor msw recibe `Authorization: Bearer <clave del resolver>`.
   - Sin clave, no recibe `Authorization`.
5. **Presets (OD-090 (a)).**
   - `@agentlab/providers/presets` exporta `PROVIDER_TYPES`, `PROVIDER_PRESETS` (congelados) y `providerConfigFromRecord`.
   - `id` = `record.id`. `base_url` se ignora en los tres tipos: un registro con `baseUrl: "http://169.254.169.254/"` produce la URL del preset.
   - `openrouter` y `gemini` exigen `apiKeyEnv` y `ollama` lo exige `null`. Si no se cumple, o el tipo es desconocido, da `ProviderConfigInvalidError`.
   - `presets.ts` no importa `openai` ni `@google/genai` (test estático), y las capacidades de Gemini salen de ahí.
   - `index.test.ts` cubre el sub-export.
6. **`GET /api/providers`** con el contrato de §4:
   - `dynamic = "force-dynamic"`, `cache-control: no-store`;
   - capacidades del preset y modelos declarados;
   - fila inválida → `valid: false`, `type: null`, `capabilities: null`;
   - nunca `base_url` ni `api_key_env`;
   - fallo de BD → 500 `{ code: "INTERNAL", message }` fijo.
   - Tests de handler contra PostgreSQL real (`agentlab_test`), con filas de los tres tipos, una inválida y una BD vacía.
7. **No fuga de `*_API_KEY`.**
   - Cada nombre de `EnvSchema` que cumple `isApiKeyEnvName`, más `GOOGLE_API_KEY`, `OPENAI_API_KEY` y un `FOO_API_KEY` no declarado, recibe un canario distinto con `vi.stubEnv`.
   - En todos los caminos (vacío, válido, inválido, BD caída con un canario también en la contraseña de `DATABASE_URL`), ni el cuerpo ni las cabeceras contienen ningún canario, ni en crudo ni escapado en JSON.
   - Un test estático comprueba que `apps/web/src/server/**` y `apps/web/src/app/api/providers/**` no contienen `process.env`, `createSecretResolver` ni `SecretResolver`.
8. **Pantallas (OD-091 (c), OD-046).**
   - `/projects` lista los proyectos. `/projects/[id]` muestra las configuraciones (tipo, modelo por defecto, capacidades, validez) y los agentes (nombre, rol, proveedor, modelo, `enabled`).
   - Marcan los agentes cuya configuración es inválida o es de otro proyecto. Un id que no es uuid, o que no existe, da 404.
   - Son Server Components, sin Server Actions, sin Client Components y sin escrituras.
   - `buildProjectView` tiene tests unitarios y `getProjectView` tests de integración.
9. **Sin red, claves ni SDK en `web`.**
   - `compose.yaml` sigue sin pasar ninguna `*_API_KEY` a `web` (cita del reviewer).
   - `.next/standalone` no contiene `openai` ni `@google/genai`.
   - El paso 0 solo cambia el importer `apps/web` del lockfile, y `pnpm install --frozen-lockfile --ignore-scripts` está en verde.
10. **Calidad.**
    - Tests sin red real y sin timers reales.
    - Cobertura de `providers` ≥ 90 % (OD-066).
    - `typecheck`, `lint`, `format:check`, `test` y `next build` en verde en contenedor.
11. **Cierre.** ARCHITECTURE §2, §6, §7 y §10 actualizados por el architect.

**security REQUIRED: sí.** Motivos: API nueva sin autenticación que expone configuración, garantía de no fuga de secretos, endurecimiento contra SSRF y redirecciones con reenvío de clave, y cabeceras de autenticación. **Dependencias nuevas:** ninguna externa; solo el enlace de workspace del paso 0.

## 7. Deuda

| TD | Qué se hace | Dónde |
|---|---|---|
| TD-143 | **PAID**: código y clase en `core`, más los cinco usos (DoD 1). | TASK-020 |
| TD-171 | **PAID** (DoD 1). | TASK-020 |
| TD-141 | **PAID**: L1, L2, L3 y la redirección de Gemini (DoD 2 y 3). | TASK-020 |
| TD-142 | **PAID**: `Authorization` ya no se puede sustituir (DoD 4). El resto de cabeceras del entorno quedan aceptadas por OD-064 (a). | TASK-020 |
| TD-012 | **Parcial**: credenciales rechazadas (DoD 2), y las URL de BD/UI ya no llegan a los adaptadores (D3). La allowlist de host pasa a TASK-050 junto con TD-018. `postgresUrl()` laxa: pago en TASK-037 (sin SSRF; la fija el operador). | TASK-020 / TASK-050 / TASK-037 |
| TD-018 | Aplazada a **TASK-050** (OD-088 (b)). | TASK-050 |
| TD-164 | Aplazada solo a **TASK-027** (se quita TASK-020 del pago). Con OD-089 (b), `web` no instancia Gemini y la exposición no crece. TASK-027 la cierra como aceptada si no hay nada más que hacer sin parchear el SDK (OD-080 (b) se descartó). | TASK-027 |
| TD-038 | Se amplía a las rutas y páginas nuevas, que pasan por `server/db.ts`, el único sitio que TASK-014 tiene que cambiar. | TASK-014 |

Deuda nueva que prevé el plan (LOW, aprobada con el plan el 2026-11-20; la registra docs-keeper en el cierre):
- `provider_type` sin validación al escribir. Pago en TASK-034, la primera escritura desde la UI.
- `OLLAMA_BASE_URL` declarada en `core` y pasada al `worker`, pero sin consumidor: el preset usa la URL de SPEC §2.1. Pago en TASK-021, que decide si se usa o se retira.
- Listado global con N+1 consultas. Pago en TASK-014 (pool compartido) o cuando N crezca.

## 8. Salida restringida (para TASK-050, OD-088 (b) y OD-093 (a))

**Mecanismo decidido (OD-093 (a), 2026-11-20):** un servicio `egress-gateway` propio, en Node, sin imagen ni dependencia nueva.
- Usa el stage `runtime` de `docker/worker.Dockerfile`, con `command: ["node", "--import", "tsx", "src/egress-gateway/main.ts"]`.
- El código va en `apps/worker/src/egress-gateway/**` (engine-dev; encaja en `role-guard.sh` sin tocar hooks).
- Seguridad del contenedor: `cap_drop: [ALL]`, `no-new-privileges`, `read_only: true`, sin variables de entorno, sin `DATABASE_URL`, uid 1000. Puertos > 1024.

**Topología:**

| Red | `internal` | Miembros |
|---|---|---|
| `backend` | sí | `db`, `migrate`, `web`, `worker`, `ollama` (sin cambios) |
| `egress` | no | `egress-gateway`, `ollama` (`web` y `worker` **salen** de ella) |
| `worker-egress` (nueva) | sí | `worker`, `egress-gateway` |
| `web-ingress` (nueva) | sí | `web`, `egress-gateway` |

- `127.0.0.1:3000` lo publica `egress-gateway`, que reenvía TCP a `web:3000`. El reenvío TCP conserva `Host`, que necesita TASK-014, y deja pasar SSE.
- `web` y `worker` quedan solo en redes internas: sin ruta a internet aunque el proceso ignore el proxy (falla cerrado).

**Proxy de salida (`:3128`):**
- Solo `CONNECT host:443`, con `host` en coincidencia exacta con una allowlist constante: `openrouter.ai` y `generativelanguage.googleapis.com`, los hosts de los presets, con un test que las compara.
- Comprobaciones antes de conectar:
  1. Resuelve con un resolver inyectable.
  2. Rechaza si **alguna** dirección cae en 0/8, 10/8, 100.64/10, 127/8, 169.254/16 (metadatos `169.254.169.254`, incluido), 172.16/12, 192.0.0/24, 192.168/16, 198.18/15, 224/4, 240/4, `::1`, `::`, `fc00::/7` (incluido `fd00:ec2::254`), `fe80::/10` o en IPv4 mapeadas (`::ffff:0:0/96`).
  3. Conecta a la dirección comprobada, no vuelve a resolver.
  4. Comprueba que el SNI del ClientHello coincide con el host del `CONNECT`, contra el domain fronting en CDN.
- Todo lo demás da 403 y cierra: otro método, HTTP en claro, una IP literal, otro puerto u otro host.
- Lleva plazos de inactividad y un tope de conexiones.
- El `worker` usa `HTTPS_PROXY=http://egress-gateway:3128`, `NO_PROXY=ollama` y `NODE_USE_ENV_PROXY=1` (Node ≥ 22.21.0, §1.3).
- `web` usa el mismo proxy y la misma allowlist: «restringida igual», como pide el DoD. Hoy no lo necesita (OD-089 (b)).

**Ollama (perfil `local`, TASK-021):**
- `worker` → `ollama` va por `backend`, directo, sin proxy.
- `ollama` conserva `egress` para descargar modelos. Si esas descargas pasan por el proxy, con `registry.ollama.ai` en la allowlist, lo decide TASK-021.
- Ollama nativo en el host (`host.docker.internal`, habitual en macOS por la GPU) queda **bloqueado por diseño**: es acceso al host. TASK-021 lo documenta en `docs/PROVIDERS.md`.

**Verificación:**
- Tests unitarios de la política con resolver falso: cada rango, IPv6 e IPv4 mapeada, una resolución mixta (pública y privada), puerto, método, SNI distinto, IP literal.
- Tests de integración en proceso con sockets locales, y un clasificador inyectado para el camino feliz.
- Prueba manual del humano, en Docker Desktop (macOS) y, si puede, en Linux. Se documenta en el informe y se ejecuta con `docker compose exec` dentro de los contenedores (nunca Node en el host):
  - desde `worker`, `fetch` a `https://example.com`, `http://169.254.169.254/`, `10.0.0.1`, `192.168.1.1` y `host.docker.internal` falla;
  - desde `worker`, `https://openrouter.ai/api/v1/models` y `https://generativelanguage.googleapis.com/` devuelven una respuesta HTTP (prueba de conectividad, sin clave);
  - desde `web`, toda salida directa falla;
  - desde el host, `curl http://127.0.0.1:3000/api/health` da 200.
- Un target de Makefile, `egress-check`, del que el reviewer comprueba que la CI no lo llama.

**ADR:** [ADR-014](../adr/ADR-014-salida-restringida-egress-gateway.md), «Salida restringida de `worker` y `web` con un `egress-gateway` propio», redactado el 2026-11-20 (Proposed). ARCHITECTURE §1 se actualiza cuando el ADR se acepte y TASK-050 se cierre. **security REQUIRED.**

### 8.1 TASK-050 fijada

- **Depende de:** TASK-020 (entrega `@agentlab/providers/presets`, contra el que se prueba la allowlist, y el `fetch` de Gemini sin redirecciones) y ADR-014 en `Accepted` (precedente: TASK-048 con ADR-013). Nace BLOCKED.
- **Owners:** devops (compose, Makefile, manifiesto y lockfile) y engine-dev (`apps/worker/src/egress-gateway/**`). Architect en el cierre (ARCHITECTURE §1).
- **Scope:** devops → `compose.yaml`, `Makefile`, `apps/worker/package.json`, `pnpm-lock.yaml`, `docker/worker.Dockerfile` (solo si el stage `runtime` no incluye ya `src/egress-gateway/**`); engine-dev → `apps/worker/src/egress-gateway/**`; architect → `docs/ARCHITECTURE.md` §1. Todo encaja en `role-guard.sh` (devops: `compose*.yaml`, `Makefile`, `docker/**`, `apps/*/package.json`, `pnpm-lock.yaml`; engine-dev: `apps/worker/**`).
- **`deps_allowed`:** `@agentlab/providers@workspace:*`, solo en `devDependencies` de `apps/worker` y solo para el test de la allowlist. Al ser `devDependencies`, `pnpm deploy --prod` (ADR-011) no la lleva a la imagen `runtime`. Ninguna dependencia externa.
- **Comparación de la allowlist:** el host de `openrouter` sale de `providerConfigFromRecord` (`baseUrl` del preset). El de `gemini` no está en `./presets` (D3: la URL de OD-079 vive en el adaptador), así que el test lo compara con la constante de OD-079 citada en SPEC §13.
- **Paga:** TD-018 y el resto de TD-012 que es de red (allowlist de host). La parte de `postgresUrl()` laxa no es de red y tiene pago en TASK-037 (§7).
- **DoD de TASK-050** (fijado; para TASKS.md):
  1. **Topología** (ADR-014 §3). `web` y `worker` solo en redes `internal: true`: `backend` más `web-ingress` o `worker-egress`, respectivamente. `egress-gateway` en `egress`, `worker-egress` y `web-ingress`, y no en `backend`. `db`, `migrate`, `test` y `ollama` sin cambios de red. El reviewer cita las líneas de `compose.yaml`.
  2. **Contenedor del gateway.** Stage `runtime` de `docker/worker.Dockerfile` con `command: ["node", "--import", "tsx", "src/egress-gateway/main.ts"]`; `cap_drop: [ALL]`, `no-new-privileges`, `read_only: true`, uid 1000, puertos > 1024, sin variables de entorno de la aplicación y sin `DATABASE_URL`. Ninguna imagen ni dependencia externa nueva.
  3. **Entrada a `web`.** `127.0.0.1:3000` lo publica `egress-gateway` y lo reenvía por TCP a `web:3000`, sin interpretar HTTP (conserva `Host` y deja pasar SSE). `web` ya no publica puertos.
  4. **Allowlist.** El proxy `:3128` solo acepta `CONNECT host:443` con `host` en coincidencia exacta con la constante `openrouter.ai`, `generativelanguage.googleapis.com`. Un test la compara con el host de `providerConfigFromRecord` para `openrouter` y con la constante de OD-079 para `gemini`. Otro método, HTTP en claro, una IP literal, otro puerto u otro host dan 403 y cierre.
  5. **Antes de conectar.** Resuelve con un resolver inyectable. Rechaza si alguna dirección cae en 0/8, 10/8, 100.64/10, 127/8, 169.254/16, 172.16/12, 192.0.0/24, 192.168/16, 198.18/15, 224/4, 240/4, `::1`, `::`, `fc00::/7`, `fe80::/10` o `::ffff:0:0/96`. Conecta a la dirección comprobada sin volver a resolver. Exige que el SNI del ClientHello coincida con el host del `CONNECT`; distinto, ausente, mal formado o truncado da cierre. Plazos de inactividad y tope de conexiones como constantes.
  6. **Clientes.** `worker` y `web` con `HTTPS_PROXY=http://egress-gateway:3128`, `NO_PROXY=ollama` y `NODE_USE_ENV_PROXY=1` en `compose.yaml`. Ningún código de la aplicación lee esas variables (`process.env` sigue solo en `core`).
  7. **Tests sin red.** Unitarios de la política con resolver falso: cada rango de la viñeta 5, IPv6 e IPv4 mapeadas, resolución mixta pública y privada, puerto, método, IP literal, host fuera de la lista y cada caso de SNI. Integración en proceso con sockets locales y un clasificador inyectado para el camino feliz, incluido el reenvío TCP. Sin red real ni timers reales.
  8. **Prueba manual del humano** en Docker Desktop (macOS) y, si puede, en Linux, con `docker compose exec` dentro de los contenedores (nunca Node en el host), documentada en el informe: desde `worker`, `fetch` a `https://example.com`, `http://169.254.169.254/`, `10.0.0.1`, `192.168.1.1` y `host.docker.internal` falla; desde `worker`, `https://openrouter.ai/api/v1/models` y `https://generativelanguage.googleapis.com/` devuelven una respuesta HTTP (sin clave); desde `web`, toda salida directa falla; desde el host, `curl http://127.0.0.1:3000/api/health` da 200.
  9. **Makefile.** Target `egress-check` que ejecuta la prueba de la viñeta 8. El reviewer cita `.github/workflows` (file:line) y confirma que la CI no lo llama. `make test` y `make validate` siguen en verde.
  10. **Dependencias.** `@agentlab/providers: workspace:*` solo en `devDependencies` de `apps/worker`. El diff del lockfile solo toca el importer `apps/worker`, `pnpm install --frozen-lockfile --ignore-scripts` está en verde y la imagen `runtime` no contiene `node_modules/openai` ni `node_modules/@google/genai`.
  11. **Calidad y cierre.** `typecheck`, `lint`, `format:check` y `test` en verde en contenedor. TD-018 PAID y TD-012 PAID en su parte de red (allowlist de host); `postgresUrl()` laxa sigue con pago en TASK-037. ARCHITECTURE §1 actualizado por el architect con ADR-014 en `Accepted`.

## 9. Decisiones resueltas (SPEC §13, 2026-11-20, humano)

| OD | Decisión | Descartadas (traza en SPEC §13) |
|---|---|---|
| OD-088 | (b) Partir: TASK-020 sin el egress (§3); TASK-050 (devops + engine-dev) para TD-018 y la allowlist de TD-012 (§8); TASK-022 depende de las dos | (a) una tarea con seis owners; (c) solo el egress del `worker` |
| OD-089 | (b) Modelos declarados (`default_model` y los `model_id` de los agentes); `web` sin claves ni red | (a) `listModels()` en vivo desde `web`; (c) catálogo en BD, que no se abre |
| OD-090 | (a) Presets cerrados `openrouter`, `ollama` y `gemini` con URL constante (`base_url` se ignora) y las capacidades de D3, confirmadas tal cual | (b) genérico `openai-compatible`; (c) presets más un genérico |
| OD-091 | (c) Solo lectura y `providerConfigFromRecord` compartido; la edición queda para TASK-034 | (a) selector con Server Action; (b) `model_id` anulable |
| OD-092 | (a) Listado global sin parámetros, con `projectId` en cada item; 500 `{ code: "INTERNAL" }` fijo | (b) `?projectId=` obligatorio; (c) `?projectId=` opcional |
| OD-093 | (a) `egress-gateway` propio: CONNECT con allowlist, rangos privados, IP fijada, SNI y reenvío TCP para `web` (ADR-014, TASK-050) | (b) Squid más reenviador; (c) bridge sin NAT |

No queda ninguna alternativa abierta en este plan.

## 10. Estrategia de tests

- `core`: `errors.test.ts` (código, `retryable`, `name`); `index.test.ts` (export); `env.test.ts` (URLs con credenciales rechazadas y canario ausente del mensaje).
- `providers`:
  - `presets.test.ts`: tabla completa, `Object.isFrozen`, cada regla de clave, tipo desconocido y `base_url` ignorada. Test estático de imports.
  - Tests de los adaptadores: msw con `onUnhandledFrame: "error"` para las redirecciones (307/308 a otro origen y conteo de peticiones por origen), `OPENAI_CUSTOM_HEADERS` y la comprobación de URL.
  - `registry.test.ts`: `type` desconocido forzado (`as never`).
  - Mutaciones que debe intentar el tester: quitar `redirect: "error"`, invertir la regla de `https` o quitar el `Authorization` explícito.
- `web`:
  - Tests unitarios de `toProviderView` y `buildProjectView`.
  - Tests de integración contra PostgreSQL real (`agentlab_test`, en serie), con datos sembrados mediante los repositorios y `@agentlab/persistence/testing`.
  - Las rutas se invocan llamando a `GET(new Request(...))`, como en `/api/health`.
  - El test de no fuga es el del DoD 7.
- Sin red real ni timers reales en ningún paquete.

## 11. Riesgos

- **R1 — Bundling de `./presets` en Next** (`extensionAlias`, `transpilePackages`). Mitigación: `next build` en contenedor y la comprobación de `standalone` (DoD 9).
- **R2 — Cambio de `code`** (`PROVIDER_RESPONSE` → `PROVIDER_CONFIG_INVALID`) en el registry, `resolvePolicy` y `assertHttpUrl`. Hoy no hay consumidores (TASK-013 y TASK-015 están bloqueadas). Se actualizan los tests de TASK-019.
- **R3 — Plazos con el `fetch` de Gemini.** Con `httpOptions.fetch`, el SDK quita su dispatcher sin plazos y se aplican los 300 s por defecto de undici. Si `timeoutMs` es mayor, `UND_ERR_HEADERS_TIMEOUT`/`UND_ERR_BODY_TIMEOUT` están en la lista blanca de OD-086 y se reintentan. Aceptable; se documenta.
- **R4 — Redirecciones bloqueadas.** `redirect: "error"` rompe una redirección legítima (un cambio de ruta de OpenRouter). Falla cerrado, con «connection failed» no reintentable.
- **R5 — Presets cerrados.** Otros proveedores compatibles (LM Studio, vLLM, Groq) no se pueden configurar hasta que haya un preset. Es coherente con ADR-003 §2 (son configuraciones del mismo adaptador).
- **R6 — Modelos declarados.** Pueden no existir en el proveedor, y el fallo llega en `generate` (400/404 → `ProviderResponseError`). Lo cubren TASK-022 y TD-145.
- **R7 — DNS rebinding.** Sin las protecciones de TASK-014 (TD-005), un DNS rebinding puede leer `/api/providers` y `/projects`: ids, tipos y nombres de modelo, sin secretos. No se añade escritura.
- **R8 — Pool por petición** en 3 superficies nuevas (TD-038), concentrado en `server/db.ts`.
- **R9 — Filas con el tipo antiguo.** Las filas `provider_type = "openai-compatible"` de BD de desarrollo aparecen como inválidas. No falla nada.
- **R10 — TASK-050 (egress):**
  - `NODE_USE_ENV_PROXY` es cooperativo, pero el control real es la topología: falla cerrado.
  - Docker Desktop y Linux pueden diferir en la red.
  - Un proxy propio es código sensible: lo mitigan la allowlist exacta, la IP fijada, el SNI, los tests y security.
  - El M2 también depende de TASK-050.

## 12. Validación fuera del repo (regla 11)

- Solo lectura de los tarballs `openai-7.45.1.tgz` y `genai-2.32.0.tgz`, descargados del registro npm al scratchpad de la sesión, para las citas de §1.3. Nada se ejecutó y no hubo Node en el host.

Fuentes web (consultadas el 2026-11-20):
- [Node.js — Enterprise network configuration](https://nodejs.org/en/learn/http/enterprise-network-configuration)
- [Docker — Port publishing and mapping](https://docs.docker.com/engine/network/port-publishing/)
- [Docker — Bridge network driver](https://docs.docker.com/engine/network/drivers/bridge/)
- [React — Critical Security Vulnerability in React Server Components](https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components)
- [NVD — CVE-2025-55182](https://nvd.nist.gov/vuln/detail/CVE-2025-55182)
- [OpenRouter — List models (requiere autenticación)](https://openrouter.ai/docs/api/api-reference/models/get-models)
- [Docker Hub — ubuntu/squid tags](https://hub.docker.com/r/ubuntu/squid/tags)
