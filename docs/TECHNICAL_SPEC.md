# AgentLab — Especificación técnica

| Campo | Valor |
|---|---|
| Versión | 1.0 (2026-10-20) |
| Estado | Vigente |
| Fuente | Documento "AgentLab: especificación técnica y hoja de ruta" del responsable humano |
| Jerarquía | ADR aceptado > **TECHNICAL_SPEC** > ARCHITECTURE > AGENTS + WORKFLOW > ROADMAP > TASKS > TECHNICAL_DEBT > código |

> **Nota de vocabulario.** En este repositorio conviven dos sistemas de agentes que no deben confundirse:
> - **Agentes del producto** (Manager, Researcher, Analyst, Writer, Critic, Evaluator): los que AgentLab ejecuta en tiempo de ejecución. Viven en `packages/agents` y se describen aquí y en `ARCHITECTURE.md`.
> - **Agentes de desarrollo** (architect, core-dev, engine-dev, …): los subagentes de Claude Code que construyen AgentLab. Viven en `.claude/agents/` y se describen en `AGENTS.md`.
>
> Cuando un documento dice "agente" sin más, se refiere a un agente del producto. "Orquestador" sin más es el motor LangGraph del producto; el orquestador de Claude Code se llama siempre **Orchestrator (sesión)**.

## 1. Objetivo del producto

AgentLab es una plataforma open source para **definir, ejecutar, observar y evaluar equipos de agentes de IA** sin depender de un proveedor concreto de modelos.

El usuario crea una tarea, elige un equipo de agentes y observa cómo colaboran para resolverla. La primera versión cubre tareas de investigación, análisis, redacción y resolución de problemas. Las herramientas especializadas y la ejecución de código llegan después (M4+).

### 1.1 Principios de diseño (no negociables)

| # | Principio | Consecuencia práctica |
|---|---|---|
| P1 | Coste de inferencia objetivo: 0 € | Modelos gratuitos (cuota) o locales (Ollama). El sistema arranca sin ninguna clave configurada. |
| P2 | Sin dependencia obligatoria de ningún proveedor | Interfaz interna común; cada proveedor es un adaptador intercambiable. |
| P3 | TypeScript en frontend, backend y orquestación | `strict: true` en todo el monorepo; sin `any` implícitos. |
| P4 | Despliegue reproducible con Docker Compose | `docker compose up --build` levanta todo el entorno. |
| P5 | Ejecuciones persistentes y recuperables | PostgreSQL es la fuente de verdad; checkpoints de LangGraph en PostgreSQL. |
| P6 | Límites explícitos de llamadas, tiempo, concurrencia y tokens | Presupuesto interno comprobado **antes** de cada llamada; nunca delegado al proveedor. |
| P7 | Resultados verificables y supervisión humana | Salidas estructuradas (Zod), revisión independiente, aprobación humana para acciones sensibles. |
| P8 | Licencia open source definida antes de publicar | Apache-2.0 como candidata (ADR-008, Proposed). |

### 1.2 Fuera de alcance (v1)

- Ejecución de código arbitrario por parte de los agentes (M5+ y solo en contenedor aislado).
- Multiusuario con autenticación real (v1 es monousuario local; la "autorización" es por proyecto y presupuesto).
- Cola distribuida de trabajos (un único worker; ver ADR-004).
- Despliegue público (opcional; no es requisito del MVP).
- Cualquier proveedor de pago como requisito.

## 2. Arquitectura objetivo (resumen)

```
┌──────────────────────────────────────────────────────────────┐
│ apps/web — Next.js (App Router) · React · Tailwind            │
│ Proyectos · Editor de equipos · Ejecuciones · Trazas          │
│ Route Handlers = API HTTP + SSE                                │
├──────────────────────────────────────────────────────────────┤
│ API y control de ejecución — Node.js · TypeScript · Zod       │
│ Autorización · Cuotas · Validación · Eventos · Cancelación    │
├──────────────────────────────────────────────────────────────┤
│ apps/worker — Motor de agentes                                │
│   orchestrator (LangGraph.js: grafo + estado + checkpoints)   │
│   agents (roles, objetivos, contratos)                        │
│   tools (registro, permisos explícitos, validación Zod)       │
│   policies (presupuesto, cuotas, guardrails)                  │
├──────────────────────────────────────────────────────────────┤
│ providers — interfaz común + adaptadores                      │
│   OpenAI-compatible (OpenRouter, Ollama /v1) · Gemini (SDK)   │
├──────────────────────────────────────────────────────────────┤
│ PostgreSQL (config, estado, eventos, métricas, checkpoints)   │
│ Docker (entorno aislado para herramientas futuras)            │
└──────────────────────────────────────────────────────────────┘
```

Detalle de capas, flujos y contratos en `ARCHITECTURE.md`.

### 2.1 Decisión clave: una API común, sin fingir que todos los modelos son iguales

- OpenRouter y Ollama se consumen por su interfaz compatible con OpenAI (Ollama: `http://ollama:11434/v1/`).
- Gemini tiene adaptador propio sobre el SDK de Google GenAI.
- Internamente existe una **única interfaz** `ModelProvider` que normaliza mensajes, respuestas, errores, uso de tokens y **capacidades declaradas** (`tools`, `structuredOutput`, `maxContextTokens`, `streaming`).
- El motor pide una generación declarando las capacidades que requiere; si el modelo no las soporta, el adaptador **falla rápido** con un error tipado, nunca degrada en silencio.

## 3. Stack definitivo de la primera versión

| Capa | Elección | Motivo |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | Paquetes separados sin monolito; cachés de build |
| Lenguaje | TypeScript 5.x `strict` | P3 |
| Frontend | Next.js App Router + Tailwind | Interfaz completa en TS; Route Handlers como API |
| Validación | Zod | Contratos de tareas, resultados, eventos y configuración |
| Orquestación | LangGraph.js | Grafos, ciclos, checkpoints, interrupciones para aprobación humana |
| Persistencia | PostgreSQL 16 | Fuente de verdad duradera |
| ORM | Drizzle | Tipado y migraciones versionadas |
| Streaming | SSE | Eventos de ejecución en tiempo real, reconexión con `Last-Event-ID` |
| Modelos | SDK de OpenAI (endpoints compatibles) + SDK de Google GenAI | Adaptadores intercambiables |
| Contenedores | Docker Compose | P4 |
| Tests | Vitest | Unitarios e integración (contra PostgreSQL real) |
| Observabilidad | OpenTelemetry + trazas propias en PostgreSQL | Diagnóstico y comparación de ejecuciones |

**Sin cola externa en v1.** Un worker Node.js separado del servidor web reclama ejecuciones de la tabla `runs` (`SELECT … FOR UPDATE SKIP LOCKED`). Cuando haga falta más de un worker, reintentos distribuidos o volumen alto, se incorporará una cola específica (ADR-004).

Versiones concretas de dependencias: fijadas en `ARCHITECTURE.md §9` con su compatibilidad verificada en ADR-002 (Accepted; OD-001 resuelta en TASK-002).

## 4. Motor multiagente

### 4.1 Modelo mental

- Un **agente es una definición reutilizable**: rol, modelo, instrucciones, herramientas autorizadas y límites. No es un proceso permanente.
- Una **ejecución (run) es una instancia independiente de un flujo** (grafo) que invoca agentes cuando les toca actuar.
- Un **equipo** es un conjunto de definiciones de agentes más reglas de coordinación (qué grafo, qué roles, qué límites).

### 4.2 Roles iniciales del producto

| Rol | Responsabilidad | Herramientas iniciales |
|---|---|---|
| Manager | Descomponer la petición en subtareas y coordinar | `task.create`, `task.status` |
| Researcher | Investigar una cuestión | `web.search`, `source.read` (M4; en M1 trabaja solo con el contexto) |
| Analyst | Comparar datos y argumentos | `artifact.read` |
| Writer | Elaborar el resultado final | `artifact.write` |
| Critic | Detectar errores y lagunas | `artifact.read`, validación |
| Evaluator | Comprobar criterios objetivos | esquemas Zod, tests declarativos |

No todos los equipos usan los seis roles. El MVP (M1) usa **Manager + dos especialistas + Critic** (ROADMAP M1).

### 4.3 Flujo de referencia

```
Petición del usuario
  → Validar permisos y presupuesto (policies)
  → Manager: crear plan
  → Validar el plan (schema + límites)
  → Investigación (puede dividirse en subtareas paralelas, máx. `maxConcurrentAgents`)
  → Análisis
  → Redacción
  → Revisión independiente (Critic/Evaluator)
  → ¿Cumple los criterios?
      No → Corregir o replanificar (máx. `maxReviewIterations`)
      Sí → Guardar resultado y métricas → Entregar al usuario
```

Reglas del flujo:
- La revisión tiene un máximo de iteraciones. Agotado el límite, el sistema entrega un **resultado parcial marcado como tal** (`status: partial`) en lugar de entrar en bucle.
- Ningún nodo del grafo puede modificar el presupuesto de la ejecución.
- La revisión la hace un agente distinto del que produjo el artefacto.

### 4.4 Contrato de un agente (`AgentDefinition`)

Campos mínimos (esquema Zod en `packages/core`):

| Campo | Tipo | Notas |
|---|---|---|
| `id`, `name`, `role` | string / enum | `role` ∈ roles §4.2 |
| `systemPrompt` | string | |
| `promptVersion` | string (semver) | Toda modificación del prompt incrementa la versión |
| `providerId`, `modelId` | string | Referencia a `provider_configs` |
| `toolAllowlist` | string[] | Nombres de herramientas registradas; vacío = sin herramientas |
| `maxCalls`, `maxTokens`, `timeoutMs` | number | Límites por invocación del agente dentro de una ejecución |
| `outputSchema` | JSON Schema (derivado de Zod) | Estructura esperada del resultado |
| `enabled` | boolean | Permite desactivar sin borrar |

### 4.5 Contrato de resultado de invocación (`AgentInvocationResult`)

| Campo | Tipo |
|---|---|
| `content` | unknown validado contra `outputSchema` |
| `status` | `ok` \| `invalid_output` \| `error` \| `timeout` \| `budget_exceeded` |
| `errors` | `{ code, message, retryable }[]` |
| `references` | `{ kind, uri, title? }[]` — fuentes/artefactos usados |
| `usage` | `{ inputTokens?, outputTokens?, costReported? }` — solo si el proveedor lo facilita; nunca estimado |

## 5. Control de costes y observabilidad

### 5.1 Presupuesto interno

AgentLab mantiene un presupuesto por ejecución comprobado **antes** de cada llamada a modelo o herramienta. Nunca confía solo en el proveedor.

**Perfil predeterminado de experimentación** (configurable por proyecto; no son límites de proveedor):

| Límite | Valor inicial |
|---|---|
| Llamadas a modelos por ejecución | 20 |
| Agentes activos concurrentes | 3 |
| Iteraciones de revisión | 2 |
| Timeout total de ejecución | 5 min |
| Tokens por llamada | **OD-002** (propuesta: 4 000 de salida) |
| Tokens acumulados por ejecución | **OD-002** (propuesta: 60 000) |
| Tamaño máximo de contexto enviado | **OD-002** (propuesta: 80 % del `maxContextTokens` del modelo) |
| Herramientas por invocación | **OD-002** (propuesta: 5) |
| Longitud máxima de un resultado | **OD-002** (propuesta: 20 000 caracteres) |
| Profundidad máxima del grafo | **OD-002** (propuesta: 12 pasos) |

Si no hay datos fiables de coste o uso, el sistema **no finge conocerlos**: el campo queda `null` y la interfaz lo muestra como "no informado".

Cuota gratuita de OpenRouter (consultada en la fecha de la especificación): ~50 solicitudes/día y 20/min para modelos gratuitos; varía según cuenta y momento. Por eso el perfil por defecto es conservador y el modo local (Ollama) permite experimentar sin consumir cuota externa.

### 5.2 Trazas

Cada llamada a modelo o herramienta genera una traza con:

- Identificadores de proyecto, ejecución, agente y paso.
- Proveedor y modelo.
- Duración, estado, reintentos y errores.
- Tokens de entrada/salida (si disponibles) y coste informado por el proveedor (si existe).
- Herramientas invocadas y duración de cada una.
- Resultado de validación y motivo de rechazo.

La interfaz permite reconstruir el flujo, localizar el paso fallido y comparar dos ejecuciones de la misma tarea.

**Nunca** se incluyen en trazas, eventos ni prompts persistidos: claves API, cabeceras de autorización ni secretos de configuración.

## 6. Modelo de datos

PostgreSQL es la fuente de verdad. Nada vive solo en memoria del proceso.

| Entidad | Contenido |
|---|---|
| `projects` | Proyectos y configuración general (perfil de presupuesto) |
| `agent_definitions` | Roles, instrucciones (con versión), límites |
| `team_definitions` | Agentes y reglas de coordinación |
| `provider_configs` | Tipo de proveedor, modelo y configuración **no secreta** |
| `runs` | Petición, estado, presupuesto, resultado final |
| `tasks` | Subtareas, dependencias, asignación y estado |
| `agent_invocations` | Cada llamada a un agente |
| `tool_invocations` | Herramientas utilizadas y resultados |
| `run_events` | Registro ordenado de eventos (secuencia monótona por run) |
| `run_checkpoints` | Relación run ↔ checkpoint de LangGraph |
| `evaluations` | Criterios, puntuaciones y resultados de validación |

- Los checkpoints de LangGraph se guardan mediante un **checkpointer persistente respaldado por PostgreSQL**; `run_checkpoints` solo los relaciona con las ejecuciones de AgentLab, no los duplica.
- Las claves API se leen del entorno (`.env`, nunca en repositorio) o de un almacén cifrado; `provider_configs` guarda únicamente el **nombre de la variable de entorno** que contiene la clave.
- Máquina de estados de `runs`: `queued → running → (awaiting_approval ↔ running) → completed | partial | failed | cancelled`. Transiciones y quién las dispara en `ARCHITECTURE.md §5`.

## 7. Estructura del repositorio

Monorepo pnpm + Turborepo. **No se crean paquetes vacíos**: cada paquete nace cuando aporta una separación útil (ROADMAP indica en qué hito aparece cada uno).

```
agentlab/
├── apps/
│   ├── web/                  # Next.js: interfaz y API (Route Handlers)
│   └── worker/               # Ejecución de flujos
├── packages/
│   ├── core/                 # Tipos, estados, contratos Zod, errores tipados   (M0)
│   ├── providers/            # OpenAI-compatible, Gemini, Ollama               (M1 básico, M2 completo)
│   ├── orchestrator/         # Grafos LangGraph y coordinación                 (M1)
│   ├── agents/               # Roles y definiciones de agentes del producto     (M1)
│   ├── policies/             # Presupuesto, permisos y límites                 (M1)
│   ├── persistence/          # Drizzle, migraciones y repositorios             (M0)
│   ├── observability/        # Eventos, trazas, métricas, OTel                 (M3)
│   ├── tools/                # Registro y herramientas                         (M4)
│   └── evaluations/          # Evaluadores y datasets                          (M5)
├── examples/                 # research-team, analysis-team                    (M4)
├── tests/                    # integration/, e2e/
├── docker/
├── docs/
├── compose.yaml
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

### 7.1 Contratos entre componentes

- El núcleo no conoce detalles de ningún proveedor: el motor pide una generación a `ModelProvider.generate(request)` donde `request` lleva mensajes, configuración y capacidades requeridas. Cada adaptador traduce a su API.
- Un agente **no puede ejecutar cualquier función de Node.js**: solo herramientas registradas en `ToolRegistry`, validadas con Zod y autorizadas por `policies` contra su `toolAllowlist`.
- Las dependencias entre paquetes son estrictamente en una dirección: `core ← persistence ← policies ← providers ← orchestrator ← agents ← worker/web`. Un paquete nunca importa de otro "más alto".

## 8. API inicial

Route Handlers de Next.js en `apps/web/app/api/**`. La API crea la ejecución y devuelve su id; **nunca** ejecuta agentes en el proceso web.

| Método | Ruta | Función |
|---|---|---|
| GET | `/api/health` | Estado del servicio y de la conexión a PostgreSQL |
| GET | `/api/providers` | Proveedores configurados y capacidades (nunca claves) |
| GET | `/api/agents` | Listar definiciones de agentes |
| POST | `/api/runs` | Crear una ejecución (`status: queued`) |
| GET | `/api/runs/:id` | Estado, presupuesto consumido, pasos |
| GET | `/api/runs/:id/events` | SSE; acepta `Last-Event-ID` para recuperar eventos perdidos |
| POST | `/api/runs/:id/cancel` | Solicitar cancelación (cooperativa) |
| POST | `/api/runs/:id/resume` | Reanudar una ejecución en `awaiting_approval` o recuperable |
| GET | `/api/runs/:id/result` | Resultado final (o parcial) |

Eventos SSE tipados (discriminated union Zod en `core`): `run.started`, `run.step`, `agent.started`, `agent.completed`, `agent.failed`, `tool.started`, `tool.completed`, `run.awaiting_approval`, `run.cancelled`, `run.completed`, `run.failed`, `budget.warning`, `budget.exceeded`. Cada evento lleva `seq` (entero monótono por run) e `id` = `seq` para SSE.

Autenticación de la API: **fuera de alcance v1** (monousuario local). `OD-003`: si se expone públicamente, mínimo un token estático en cabecera; se decide en M5.

## 9. Seguridad desde la primera versión

Un agente con herramientas puede hacer más que responder texto. Restricciones vigentes desde M0:

1. Claves API solo en secretos de entorno o almacén cifrado; nunca en repositorio, tablas, eventos, prompts ni trazas.
2. Ollama y PostgreSQL no se exponen públicamente (solo red interna de Compose).
3. Herramientas con permisos explícitos (`toolAllowlist`) y validación Zod de parámetros.
4. Ejecución de código arbitrario **deshabilitada** en el MVP.
5. Las herramientas de shell futuras corren en contenedores aislados, sin privilegios, con límites de CPU, memoria, tiempo y red.
6. Ningún agente aprueba sus propias acciones sensibles ni modifica sus límites de presupuesto.
7. Herramientas HTTP con allowlist de destinos; bloqueo de rangos privados, `localhost` y endpoints de metadatos (`169.254.169.254`, etc.).
8. Resultados de páginas web y documentos = **datos no confiables**; nunca instrucciones. Se envuelven y etiquetan como tal antes de entrar en un prompt.
9. **Las aprobaciones humanas están separadas de las decisiones del modelo**: el modelo solicita; `policies` decide si está autorizado; si requiere humano, el grafo se interrumpe (`awaiting_approval`).

Política completa y gestión de vulnerabilidades: `docs/security/SECURITY_POLICY.md` (M5; esqueleto desde M0).

## 10. Qué significa «coste cero»

| Recurso | Estrategia |
|---|---|
| Código y framework | Open source |
| Base de datos | PostgreSQL local |
| Infraestructura de desarrollo | Docker en el ordenador del desarrollador |
| Inferencia | APIs gratuitas o Ollama local |
| Observabilidad | Instrumentación propia y herramientas autoalojables |
| CI | Ejecución local + cuota gratuita del proveedor elegido (`OD-004`: GitLab CI vs GitHub Actions; depende de dónde se publique) |
| Despliegue público | Opcional; no necesario para el MVP |

El sistema funciona **sin ninguna clave configurada** mientras haya un proveedor local disponible.

## 11. Licencia y publicación

- Candidata: **Apache-2.0** (ADR-008, Proposed; se acepta en M5 tras revisar licencias de dependencias y condiciones de cada proveedor).
- La licencia del código no cubre pesos de modelos ni datos de entrenamiento.
- Antes de publicar el repositorio debe incluir: README con instalación desde cero, `.env.example` sin secretos, guía de proveedores y cuotas, diagrama de arquitectura, ejemplos reproducibles, tests automatizados, política de seguridad, licencia y avisos de terceros.

## 12. Criterio de "hecho" para el primer sprint (M0 + M1)

Poder escribir una petición en la web, lanzar el equipo de agentes, ver cómo colaboran, consultar el resultado y **entender por qué ha terminado** — sin pagar por inferencia y sin perder el control de las llamadas.

## 13. OPEN DECISIONS

Decisiones que la especificación **no** fija. Los agentes de desarrollo no las inventan: las registran aquí y el `architect` propone; el humano decide.

| ID | Decisión pendiente | Quién decide | Cuándo |
|---|---|---|---|
| OD-001 | ~~Versiones concretas de LangGraph.js, checkpointer PostgreSQL, Drizzle, Next.js~~ **RESUELTA (2026-10-20, TASK-002)**: `@langchain/langgraph 1.5.1`, `@langchain/langgraph-checkpoint 1.2.0`, `@langchain/langgraph-checkpoint-postgres 1.1.0` (`PostgresSaver`, esquema `langgraph`), `@langchain/core 1.2.18`, `drizzle-orm 0.45.4`, `drizzle-kit 0.31.11`, `pg 8.23.1` (driver único), `next 16.4.2`. Tabla y razones en ARCHITECTURE §9; compatibilidad y fuentes (npm registry, GitHub Releases langgraphjs #2961, docs de Route Handlers de Next.js) en ADR-002 (Accepted) | architect → humano | M0 (TASK-002) |
| OD-002 | Valores de los límites de tokens/contexto/herramientas/longitud/profundidad | humano | M1 (antes de TASK-013) |
| OD-003 | Autenticación de la API si se expone públicamente | humano | M5 |
| OD-004 | Plataforma de CI (GitLab CI vs GitHub Actions) | humano | M0 (TASK-006) |
| OD-005 | Modelo local por defecto para Ollama en `compose.yaml` (tamaño vs calidad) | humano | M2 |
| OD-006 | Modelo de persistencia de artefactos (tabla `artifacts` vs columna JSON en `tasks`) | architect → humano | M4 |
| OD-007 | Ejecución de TypeScript en runtime (`apps/worker` y consumo de paquetes que exportan `.ts`): `tsx`, bundle o type stripping de Node | architect → humano | M0, antes de TASK-003 (bloquea TASK-003 y TASK-008; no TASK-001) |

### OD-007 — Propuesta (`PROPUESTA — pendiente de decisión humana`)

Contexto: `tsconfig.base.json` usa `module: ESNext` + `moduleResolution: bundler` + `verbatimModuleSyntax` (imports relativos sin extensión) y los paquetes exportan `./src/index.ts` sin build (plan de TASK-001). `apps/web` no está afectada: Turbopack transpila automáticamente los paquetes del workspace ([`transpilePackages`](https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages), lastUpdated 2026-05-27); Vitest y drizzle-kit cargan TS por sí mismos. El problema es arrancar `apps/worker` (dev, contenedor de TASK-003 y proceso hijo del test de TASK-008). Versiones consultadas con `npm view` el 2026-10-20.

| Opción | Dependencias | Pros | Contras |
|---|---|---|---|
| (a) `tsx` en dev y en runtime: `node --import tsx src/index.ts` | `tsx 4.23.15` (2026-09-20; trae `esbuild ~0.28.0`) en `apps/worker`; uso `--import` documentado en [tsx/docs/dev-api/node-cli.md](https://github.com/privatenumber/tsx/blob/master/docs/dev-api/node-cli.md) | Sin cambios en `tsconfig` ni en imports; resuelve imports sin extensión y `exports` a `.ts` del workspace; mismo comando en dev, test y Docker; con `--import` no hay proceso envoltorio, así que `SIGTERM` llega directo al worker | Transpilador (esbuild, binario nativo) dentro de la imagen de producción; coste de arranque; no comprueba tipos (`tsc --noEmit` sigue en CI) |
| (b) Bundle del worker a JS (`esbuild --bundle --platform=node --format=esm`, dependencias de terceros externas, paquetes `@agentlab/*` incluidos) | `esbuild 0.28.2` (2026-08-08) o `tsup 9.0.0` (2026-10-14, exige Node `^22.18.0`); para dev además `tsx` o `node --watch` sobre el bundle | La imagen ejecuta `node dist/index.js` sin TS en runtime; encaja con `moduleResolution: bundler` (el nombre lo dice); `turbo build` pasa a tener sentido real | Paso de build y sourcemaps que mantener; dev y prod ejecutan artefactos distintos; probablemente dos dependencias |
| (c) Type stripping nativo de Node (activo por defecto desde 22.18.0, sin aviso; [docs Node 22](https://nodejs.org/docs/latest-v22.x/api/typescript.html), consultadas 2026-10-20) | Ninguna; exige fijar Node `>=22.18` en `.nvmrc`/Dockerfiles | Cero dependencias; ejecuta exactamente el fuente | Estabilidad 1.2 (*release candidate*); exige extensión `.ts` en **todos** los imports relativos → cambiar `tsconfig` (`allowImportingTsExtensions` o `rewriteRelativeImportExtensions`, `erasableSyntaxOnly`) y reescribir la convención de TASK-001; sin `enum`, *parameter properties* ni `namespace` con valores; no lee `tsconfig`; rechaza `.ts` bajo `node_modules` (los enlaces de pnpm se resuelven a `packages/*` por realpath, pero hay que verificarlo) |

**Recomendación del architect: (a) `tsx 4.23.15`**, exacta, como dependencia de `apps/worker`, invocada como `node --import tsx`. Es la única opción que no cambia la convención de módulos ya aprobada en TASK-001 y usa un solo comando en dev, test y contenedor. (c) queda como vía de migración cuando el type stripping sea estable, y (b) si el tamaño o el arranque de la imagen llegan a importar. La decisión final se registrará en un ADR antes de TASK-003 (encargo aparte) y requiere añadir `tsx` a `deps_allowed`.
