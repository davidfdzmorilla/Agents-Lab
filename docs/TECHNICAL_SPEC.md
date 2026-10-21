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

Route Handlers de Next.js en `apps/web/src/app/api/**` (OD-041). La API crea la ejecución y devuelve su id; **nunca** ejecuta agentes en el proceso web.

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

Eventos SSE tipados (discriminated union Zod en `core`), 15 tipos: `run.started`, `run.step`, `agent.started`, `agent.completed`, `agent.failed`, `tool.started`, `tool.completed`, `run.awaiting_approval`, `run.resumed`, `run.cancelled`, `run.completed`, `run.partial`, `run.failed`, `budget.warning`, `budget.exceeded`. Cada evento lleva `seq` (entero monótono por run) e `id` = `seq` para SSE.

- `run.partial`: el run termina en el estado terminal `partial` (§6, `ARCHITECTURE.md §5`); lo emite `persist.result` en lugar de `run.completed` cuando se agota el límite de iteraciones o el presupuesto con resultado utilizable (`ARCHITECTURE.md §4`). Lleva el motivo (`partialReason`).
- `run.resumed`: un run reanudado desde su último checkpoint tras la recuperación por heartbeat caducado (`ARCHITECTURE.md §4`); conserva su secuencia `seq`. Se emite desde M3 (TASK-026).

Payload de cada tipo: mínimo tipado en `core` (OD-011, TASK-004).

Autenticación de la API: **fuera de alcance v1** (monousuario local). `OD-003`: si se expone públicamente, mínimo un token estático en cabecera; se decide en M5. Mientras tanto (TD-005), la API sin autenticación se protege con las comprobaciones de `Host`, `Origin` y `Content-Type` y las cabeceras de seguridad del DoD de TASK-014 (requisito de security en TASK-007, decisión humana del 2026-10-21). `GET /api/health` (TASK-007) ya responde sin autenticación.

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
| CI | Ejecución local + cuota gratuita de GitHub Actions (repositorio en GitHub; `OD-004` resuelta): `.github/workflows/ci.yml` |
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
| OD-004 | ~~Plataforma de CI (GitLab CI vs GitHub Actions)~~ **RESUELTA (2026-10-20)**: GitHub + GitHub Actions; TASK-006 con `.github/workflows/ci.yml` (lint, typecheck, test con PostgreSQL 16 como servicio, audit, secrets-scan, caché de pnpm) | humano | M0 (TASK-006) |
| OD-005 | Modelo local por defecto para Ollama en `compose.yaml` (tamaño vs calidad) | humano | M2 |
| OD-006 | Modelo de persistencia de artefactos (tabla `artifacts` vs columna JSON en `tasks`) | architect → humano | M4 |
| OD-007 | ~~Ejecución de TypeScript en runtime (`apps/worker` y consumo de paquetes que exportan `.ts`): `tsx`, bundle o type stripping de Node~~ **DECIDIDA (2026-10-20): tsx — ADR-009 (Accepted)**: `tsx 4.23.15` exacta en `dependencies` de `apps/worker`; dev `tsx watch src/index.ts`, Docker `tsx src/index.ts`; `apps/web` lo resuelve Next; sin build del worker en v1 | architect → humano | M0, antes de TASK-003 (bloquea TASK-003 y TASK-008; no TASK-001) |
| OD-009 | ~~Dónde se instalan Vitest y sus herramientas (raíz vs cada paquete)~~ **RESUELTA (2026-10-20)**: raíz, `devDependencies` exactas `vitest 5.0.5`, `@vitest/coverage-v8 5.0.5`, `vite 8.3.4`; `engines.node` pasa a `>=22.12 <23` (ARCHITECTURE §9) | humano | M0 (TASK-004) |
| OD-010 | ~~Formato de los identificadores de los contratos~~ **RESUELTA (2026-10-20)**: UUID; v7 si la librería lo da sin dependencia nueva, si no v4 de `crypto.randomUUID`. Verificado: ni `zod 4.6.7` (solo valida, `z.uuidv7()`) ni Node 22.23.2 (`crypto` solo tiene `randomUUID`) generan v7 → **v4** (`crypto.randomUUID`, y `gen_random_uuid()` en PostgreSQL 16) | humano | M0 (TASK-004) |
| OD-011 | ~~Payload de cada tipo de evento~~ **RESUELTA (2026-10-20)**: payload tipado mínimo por tipo según la tabla del plan de TASK-004 | humano | M0 (TASK-004) |
| OD-012 | ~~`run.partial` y `run.resumed` fuera de la lista de eventos de §8~~ **RESUELTA (2026-10-20)**: se mantienen ambos; son **15 eventos**, no 13. `run.partial` es estado terminal propio (§6) y `run.resumed` lo exige la recuperación de M3 (ARCHITECTURE §4). Se corrige §8, no ARCHITECTURE | humano | M0 (TASK-004) |
| OD-013 | ~~Tipos auxiliares citados en ARCHITECTURE §3 sin definir (`Message`, `ModelInfo`, `ToolCall`, `ToolSpec`, `JsonSchema`, `ToolContext`)~~ **RESUELTA (2026-10-20)**: mínimos para M1 | humano | M0 (TASK-004) |
| OD-014 | ~~Campos de `AgentDefinition`, `TeamDefinition`, `RunRequest` y `Budget` no fijados~~ **RESUELTA (2026-10-20)**: propuesta concreta del plan de TASK-004, con la condición de **ningún campo opcional "por si acaso"**: lo que M1 no use, fuera | humano | M0 (TASK-004) |
| OD-015 | ~~`env.ts`: obligatoriedad, valores por defecto y secretos~~ **RESUELTA (2026-10-20)**: solo `DATABASE_URL` obligatoria; el resto con los valores por defecto de ARCHITECTURE y `.env.example`; `LANGCHAIN_TRACING_V2` entra ya con valor por defecto `"false"` (DoD de TASK-013) | humano | M0 (TASK-004) |
| OD-016 | ~~Códigos de error fuera de la lista del DoD y ubicación de `InvalidTransitionError`~~ **RESUELTA (2026-10-20)**: códigos de error del plan e `InvalidTransitionError` en `core` | humano | M0 (TASK-004) |
| OD-017 | ~~Cómo obtienen los adaptadores sus claves sin leer `process.env` fuera de `core/env.ts`~~ **RESUELTA (2026-10-20)**: `core` exporta `SecretResolver` (`(envName: string) => string \| undefined`) construido en `env.ts`; los adaptadores lo reciben inyectado y nunca tocan `process.env`. El resolver solo resuelve nombres que cumplen `^[A-Z][A-Z0-9_]*_API_KEY$` **y** están declarados en el esquema de `env.ts`; cualquier otro nombre → `undefined`. Descartadas: (a) resolver cualquier nombre y (b) lista negra de no secretos, porque falla por omisión (cualquier variable no declarada —`PATH`, `HOME`, las de LangSmith, las del sistema— seguiría siendo legible) | humano | M0 (afecta TASK-004 y TASK-010) |
| OD-018 | ~~Valores de `.env.example` para `OLLAMA_BASE_URL`, `AGENTLAB_PROVIDER` y `DATABASE_URL_TEST`: ¿defaults de `env.ts` o ejemplos?~~ **RESUELTA (2026-10-20)**: son ejemplos; `env.ts` no fija defaults para esas tres; credenciales de la base de pruebas fuera del código; sin `DATABASE_URL_TEST` los tests de integración fallan con mensaje claro, no se saltan (testing-conventions, regla 6; TASK-005) | humano | M0 (TASK-004) |
| OD-019 | ~~Red y mecanismo de `make test`/`make validate` hacia `db`~~ **RESUELTA (2026-10-20)**: dos fases: instalación con red (`pnpm fetch --ignore-scripts`); servicio `test` de compose solo en la red interna de `db` (`backend`), sin internet. `make test` deja `db` en marcha; se para con `make down` (README). Superusuario y alcance del contenedor de test: los evalúa security en la verificación | architect → humano | M0 (TASK-005) |
| OD-020 | ~~Cómo obtienen `DATABASE_URL_TEST` los tests y `db:reset` sin `DATABASE_URL`~~ **RESUELTA (2026-10-20)**: `loadTestDatabaseUrl()` en `core/env.ts`; sin valor por defecto (OD-018) y con mensaje que no incluye la URL | architect → humano | M0 (TASK-005) |
| OD-021 | ~~Detalle del esquema que ARCHITECTURE §6 no fija (tipos, nulabilidad, FK, índices, `CHECK` de estados)~~ **RESUELTA (2026-10-20)**: la tabla del plan de TASK-005, con la misma condición que OD-014: **ninguna columna "por si acaso"**; lo que M1 no use, fuera. Detalle en ARCHITECTURE §6 | architect → humano | M0 (TASK-005) |
| OD-022 | ~~Asignación de `seq`: el SQL de ARCHITECTURE §3.4 falla en PostgreSQL 16 (`FOR UPDATE is not allowed with aggregate functions`)~~ **RESUELTA (2026-10-20)**: bloqueo de la fila del run (`SELECT … FROM runs … FOR UPDATE`) y `COALESCE(MAX(seq),0)+1` en la misma transacción; ARCHITECTURE §3.4 corregido con el SQL probado | architect → humano | M0 (TASK-005) |
| OD-023 | ~~Guarda de `provider_configs.api_key_env` y fuga del valor rechazado~~ **RESUELTA (2026-10-20)**: **sin `CHECK` en la base** (un valor rechazado no debe aparecer en los logs de `db`; se descarta la opción recomendada). La valida el repositorio antes del `INSERT` con la regla de OD-017 importada de `core`, lanzando un error tipado que no incluye el valor; test que lo comprueba. Sin deuda | architect → humano | M0 (TASK-005) |
| OD-024 | ~~Dónde vive la tabla de control de migraciones de Drizzle~~ **RESUELTA (2026-10-20)**: esquema `drizzle` (`drizzle.__drizzle_migrations`), excepción documentada en ARCHITECTURE §6 | architect → humano | M0 (TASK-005) |
| OD-025 | ~~Contratos mínimos de repositorio que el DoD no detalla~~ **RESUELTA (2026-10-20)**: `create`/`get`/`list` (`listByProject` en `AgentDefinitionsRepository`); `get` y `transition` devuelven `null` si el id no existe (la API lo traduce a 404); sin `NotFoundError` y sin métodos que nadie consuma todavía | architect → humano | M0 (TASK-005) |
| OD-026 | ~~Cómo instala `tsx` la imagen `migrate` si es `devDependency` de `persistence` (ADR-010)~~ **RESUELTA (2026-10-20)**: opción (a). "Stage propio para migrate con las devDependencies de persistence, sin ejecutar scripts; security lo revisa en la verificación. Que la imagen de migrate no se reutilice para worker ni web." Stages `migrate-deps`/`migrate` en `docker/worker.Dockerfile`, `pnpm fetch` e `install` con `--ignore-scripts`; ningún otro servicio ni stage parte de ellos (ARCHITECTURE §1) | architect → humano | M0 (TASK-005) |
| OD-027 | ~~Qué error tipado lanza la validación de `api_key_env`~~ **RESUELTA (2026-10-20)**: opción (a). "InvalidApiKeyEnvError, code API_KEY_ENV_INVALID, en core." **Amplía la lista de códigos de OD-016** con `API_KEY_ENV_INVALID` (`retryable: false`, mensaje fijo sin el valor) | architect → humano | M0 (TASK-005) |
| OD-028 | ~~Las tres tablas de §6 sin uso en M1 (`tool_invocations`, `run_checkpoints`, `evaluations`) frente a «las 11 tablas» del DoD~~ **RESUELTA (2026-10-20)**: opción (c). "0000_init crea 8 tablas; tool_invocations nace en TASK-030, run_checkpoints en TASK-023, evaluations en TASK-036, cada una con su migración. DoD de TASK-005 pasa a 8; ARCHITECTURE §6 anota en qué tarea nace cada una de las tres. La regla 'lo que M1 no use, fuera' manda sobre un número escrito antes de tenerla." | architect → humano | M0 (TASK-005) |
| OD-029 | ~~Ampliación del scope de TASK-008 (`compose.yaml`, `.dockerignore`, `Makefile`, `pnpm-lock.yaml`, `package.json` raíz, `persistence`, `.env.example`, docs)~~ **RESUELTA (2026-10-21)**: opción (a), "aprobado tal cual (con package.json raíz, ya que OD-034 es (a))". Lista final de rutas y owners en el plan de TASK-008 | architect → humano | M0 (TASK-008) |
| OD-030 | ~~Logger del worker con `redact`~~ **RESUELTA (2026-10-21)**: opción (a), `pino 10.4.0` exacta, dependencia de runtime (`dependencies`) de `apps/worker`; autorizada en `deps_allowed`. El `redact` se prueba en la implementación con un test que inyecta un valor canario en `DATABASE_URL` y en una `*_API_KEY` y comprueba que no aparece en la salida | architect → humano | M0 (TASK-008) |
| OD-031 | ~~Construcción de las imágenes `worker` y `migrate`~~ **RESUELTA (2026-10-21)**: opción (a), `pnpm deploy` → [ADR-011](adr/ADR-011-imagenes-runtime-pnpm-deploy.md) **Accepted** con dos condiciones: (1) cada stage de deploy verifica que el lockfile no cambia (mecanismo fijado en ADR-011: `pnpm install --frozen-lockfile --lockfile-only` en el mismo stage, antes del `deploy`); (2) la limpieza del `package.json` raíz en `migrate` queda como deuda LOW, a revisar cuando pnpm lo soporte de forma nativa | architect → humano | M0 (TASK-008) |
| OD-032 | ~~Activar ya el fallback `node --import tsx src/index.ts` (ADR-009 §7)~~ **RESUELTA (2026-10-21)**: opción (a), "node --import tsx desde ya". ADR-009 §7 lo autoriza sin ADR nuevo; nota en ADR-009 y ARCHITECTURE §8. El test de `SIGTERM` con el worker ocupado (bucle de eventos bloqueado > 30 ms) entra en el DoD, con código de salida 0 | architect → humano | M0 (TASK-008) |
| OD-033 | ~~Estado del run cuando vence `SHUTDOWN_GRACE_MS`~~ **RESUELTA (2026-10-21)**: opción (a), se queda `running` y lo recupera TASK-026. Mitigación en TASK-008 (al DoD): al arrancar, el worker marca `failed` (`error.code` `WORKER_INTERRUPTED`) cualquier run `running` con su propio `worker_id` anterior o con heartbeat caducado; es la mitad de TASK-026 sin la reanudación y corrige TD-002 en su parte de «queda colgado». Diseño (decisión 21 del plan de TASK-008) **aprobado (2026-10-21)**: "worker_id = <hostname>/<uuid>; failOrphaned en una sentencia al arrancar, tras comprobar el esquema. WORKER_INTERRUPTED solo como valor de runs.error.code." Ampliado con el barrido periódico de OD-038 | architect → humano | M0 (TASK-008) |
| OD-034 | ~~«Un solo runner» con un segundo paquete con tests de integración~~ **RESUELTA (2026-10-21)**: opción (a), `"test": "turbo run test --concurrency=1"` en el `package.json` raíz | architect → humano | M0 (TASK-008) |
| OD-035 | ~~`node_modules` del servicio `test` con uid 1000~~ **RESUELTA (2026-10-21)**: opción (a), sin volumen de `node_modules` (vive en la capa del contenedor, `--rm`); cierra la parte correspondiente de TD-017 | architect → humano | M0 (TASK-008) |
| OD-036 | ~~Intervalo de sondeo en reposo del worker~~ **RESUELTA (2026-10-21)**: opción (b), `WORKER_POLL_MS` declarada en `core/env.ts` con valor por defecto `1000` (y en `.env.example`). "Es una línea y evita una OD en TASK-015" | architect → humano | M0 (TASK-008) |
| OD-037 | ~~Forma del jsonb `runs.error` y evento `run.failed` en el barrido de runs huérfanos~~ **RESUELTA (2026-10-21)**: opción (a), "Forma InvocationError {code, message fijo, retryable:false}; run.failed llega con TASK-015." El barrido escribe `{ code: "WORKER_INTERRUPTED", message: <fijo>, retryable: false }` (tipo `InvocationError` de `core`, impuesto en la firma de `failOrphaned`) y no emite eventos en M0; TASK-015 añade `run.failed` para los ids que devuelve `failOrphaned` y usa la misma forma para los fallos del grafo. `WORKER_INTERRUPTED` no entra en `AgentLabErrorCode` | architect → humano | M0 (TASK-008) |
| OD-038 | ~~¿Barrido de runs huérfanos solo al arrancar o también periódico?~~ **RESUELTA (2026-10-21)**: opción (b), "Al arrancar y además cada WORKER_STALE_MS, solo por heartbeat caducado. Cierra R12 y es la mitad de TASK-026 que ya estamos haciendo; TASK-026 queda solo con la reanudación desde checkpoint." El barrido periódico no usa el criterio de host y nunca marca los runs del propio worker; un error de base de datos en él es `warn` y no detiene el worker. Diseño en la decisión 21 del plan de TASK-008 | architect → humano | M0 (TASK-008; recorta TASK-026) |
| OD-039 | ~~Bundler de `web` frente a los imports relativos `.js` de los paquetes del workspace~~ **RESUELTA (2026-10-21)**: opción (a), "webpack con extensionAlias. Turbopack cuando resuelva los imports .js→.ts del workspace; deuda LOW a revisar en TASK-040. Los builds más lentos no importan en M0." `next dev --webpack` / `next build --webpack` con `extensionAlias: { ".js": [".ts", ".tsx", ".js"] }` → [ADR-012](adr/ADR-012-build-e-imagen-de-web.md) **Accepted** | architect → humano | M0 (TASK-007) |
| OD-040 | ~~`new URL("../migrations", import.meta.url)` de `runMigrations` rompe el bundle de `web`~~ **RESUELTA (2026-10-21)**: opción (a), "runMigrations sale del índice; se importa desde @agentlab/persistence/migrate (sub-export explícito, como /testing). Ampliar el test de exports." `packages/persistence/package.json` gana `"./migrate": "./src/migrate.ts"`; el test de exports cubre el índice (sin `runMigrations`, con `pingDatabase`) y el mapa de sub-exports | architect → humano | M0 (TASK-007) |
| OD-041 | ~~Ubicación del App Router (`apps/web/app` frente a `rootDir: src`)~~ **RESUELTA (2026-10-21)**: opción (a), `apps/web/src/app`. §8 corregido; los scopes de las tareas futuras pasan de `apps/web/app/**` a `apps/web/src/app/**` en TASKS.md (Orchestrator) | architect → humano | M0 (TASK-007) |
| OD-042 | ~~Versiones con menos de dos semanas (`next 16.4.2`, `react`/`react-dom 19.3.1`)~~ **RESUELTA (2026-10-21)**: opción (a), con condición: "La excepción a las dos semanas se concede solo si security verifica, con cita del aviso (GHSA o CVE, URL y fecha), que 16.4.2 y 19.3.1 son los parches y que la versión anterior estable es vulnerable. Si no lo puede verificar, se usan las últimas versiones con más de dos semanas y la actualización va como tarea fix al confirmarse el aviso. R2 entra en la misma verificación de security." **Resolución final (2026-10-21, tras el veredicto de security)**: "next 16.4.2 con la excepción concedida (security cita el aviso en ADR-012 y en el plan: identificador, URL, fecha, versión vulnerable), react/react-dom 19.3.0 y @types 19.3.0 sin excepción." Avisos: GHSA-2464-fhr4-w9xw (CVE-2026-96889), GHSA-673q-mjm6-r5xr y GHSA-p3m5-59mp-jv5r en `next` `<=16.4.0` (parche 16.4.1; 16.4.2 los contiene); GHSA-xqc2-xf4c-x3h3 y GHSA-h3gv-c5rc-p453 en `react-server-dom-*` 19.3.0 (parche 19.3.1), corregidos en la copia que incluye `next ≥ 16.4.1` (R2 verificado). Ningún aviso afecta a `react`/`react-dom`. Plan B descartado (`next 16.4.0` vulnerable, CRITICAL). Citas completas en [ADR-012](adr/ADR-012-build-e-imagen-de-web.md) y en el plan de TASK-007 | architect → humano | M0 (TASK-007) |
| OD-043 | ~~Qué es `version` en `/api/health`~~ **RESUELTA (2026-10-21)**: opción (a), el campo `version` de `apps/web/package.json`, embebido en el build | architect → humano | M0 (TASK-007) |
| OD-044 | ~~Logger de `web` en M0~~ **RESUELTA (2026-10-21)**: opción (a), ninguno. `pingDatabase` devuelve `boolean`; el entorno inválido sale como 500 de Next. TASK-014 decide entre duplicar el logger del worker y adelantar `observability` | architect → humano | M0 (TASK-007) |
| OD-045 | ~~Ampliación del scope de TASK-007~~ **RESUELTA (2026-10-21)**: opción (a), la tabla «Scope final» del plan de TASK-007 tal cual (más `packages/persistence/package.json` y `packages/persistence/src/migrate.integration.test.ts` por OD-040) | architect → humano | M0 (TASK-007) |
| OD-046 | ~~`/projects` en M0~~ **RESUELTA (2026-10-21)**: opción (a), 404 por defecto de Next en M0; la tarea que cree las pantallas de proyectos (TASK-020 o TASK-034) añade `/projects` o corrige ARCHITECTURE §7 | architect → humano | M0 (TASK-007) |
| OD-047 | ~~Veredicto parcial de security sobre OD-042: ¿la condición se aplica por paquete (`next` por un lado, `react`/`react-dom` por otro) o en bloque? ¿Y si los avisos se verifican pero R2 (copia de React Server Components dentro de `next`) no?~~ **CERRADA SIN EFECTO (2026-10-21)**: la premisa de OD-042 (19.3.1 como parche) era falsa | architect → humano | M0 (TASK-007, antes del paso 2) |
| OD-048 | ~~Versión de Node en `.nvmrc` (`22` frente a la versión exacta de `NODE_IMAGE`)~~ **RESUELTA (2026-10-21)**: opción (a+), ".nvmrc = 22.23.3 y un paso de CI que falle si .nvmrc, los Dockerfiles y el Makefile no coinciden." TASK-006 no sube Node: la subida a 22.23.4 (release de seguridad) va en TASK-042 (devops, con security), "subir Node a 22.23.4 en .nvmrc, Dockerfiles y Makefile". "Una versión en un solo sitio y la CI vigilando que no se descuadre vale más que ir a la última hoy." | architect → humano | M0 (TASK-006) |
| OD-049 | ~~Dónde corre `make validate` en el CI~~ **RESUELTA (2026-10-21)**: opción (b), job aparte `validate-linux`, en paralelo con el resto. "Mi 'dentro de test' era por simplicidad; en paralelo es mejor." | architect → humano | M0 (TASK-006) |
| OD-050 | ~~`audit` cuando el registro falla (red o 410 del endpoint en retirada)~~ **RESUELTA (2026-10-21)**: opción (a), fail-closed, sin `--ignore-registry-errors`. "Un audit que ignora errores del registro es un audit que puede dar verde sin haber auditado." El endpoint en retirada que usa pnpm 9.15.9 queda como deuda LOW, pago en TASK-040 | architect → humano | M0 (TASK-006) |
| OD-051 | ~~Ampliación del scope de TASK-006~~ **RESUELTA (2026-10-21)**: aprobada la tabla «Scope final» del plan de TASK-006 tal cual (`.nvmrc`, `README.md`, skills `testing-conventions` y `task-packet`, `docs/TECHNICAL_DEBT.md`, `docs/TASKS.md`, ARCHITECTURE §9 y SPEC §13) | architect → humano | M0 (TASK-006) |
| OD-052 | ~~Alcance de «ficheros de configuración de la raíz» (TD-007)~~ **RESUELTA (2026-10-21)**: opción (a), ESLint sobre los `*.js`/`*.ts` de la raíz (`LINT_ROOT` en `make lint` y `make validate`) más `format:check`; YAML y shell quedan fuera de TASK-006 | architect → humano | M0 (TASK-006) |
| OD-053 | ~~Evidencia del CI frente al orden DONE → commit → push~~ **RESUELTA (2026-10-21)**: opción (a). Antes de DONE, **el humano** hace push desde su terminal de una rama desechable (`ci/task-006-probe`); la CI corre, el tester cita en su informe la URL del run y el resultado de cada job, y el humano borra la rama después. "Es la única evidencia real del DoD de esta tarea." Claude nunca hace push | architect → humano | M0 (TASK-006) |

OD-008 no existe a propósito: se mencionó en sesión como "no abierta" y su número no se reutiliza.

### OD-007 — Propuesta (~~`PROPUESTA — pendiente de decisión humana`~~ **DECIDIDA 2026-10-20 → ADR-009, Accepted**)

> **Decisión humana (2026-10-20):** opción (a) `tsx`, pero invocada como CLI `tsx src/index.ts` (no `node --import tsx` como recomendaba la propuesta) y `tsx watch src/index.ts` en dev. Se descartan (b) y (c). Detalle, consecuencias (proceso padre de `tsx` y reenvío de `SIGTERM`) y verificación en [ADR-009](adr/ADR-009-ejecucion-typescript-runtime.md). El texto de abajo se conserva como registro de la propuesta.

Contexto: `tsconfig.base.json` usa `module: ESNext` + `moduleResolution: bundler` + `verbatimModuleSyntax` (imports relativos sin extensión) y los paquetes exportan `./src/index.ts` sin build (plan de TASK-001). `apps/web` no está afectada: Turbopack transpila automáticamente los paquetes del workspace ([`transpilePackages`](https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages), lastUpdated 2026-05-27) *(nota 2026-10-21: no con imports relativos `.js`; `web` usa webpack con `extensionAlias`, [ADR-012](adr/ADR-012-build-e-imagen-de-web.md), OD-039)*; Vitest y drizzle-kit cargan TS por sí mismos. El problema es arrancar `apps/worker` (dev, contenedor de TASK-003 y proceso hijo del test de TASK-008). Versiones consultadas con `npm view` el 2026-10-20.

| Opción | Dependencias | Pros | Contras |
|---|---|---|---|
| (a) `tsx` en dev y en runtime: `node --import tsx src/index.ts` | `tsx 4.23.15` (2026-09-20; trae `esbuild ~0.28.0`) en `apps/worker`; uso `--import` documentado en [tsx/docs/dev-api/node-cli.md](https://github.com/privatenumber/tsx/blob/master/docs/dev-api/node-cli.md) | Sin cambios en `tsconfig` ni en imports; resuelve imports sin extensión y `exports` a `.ts` del workspace; mismo comando en dev, test y Docker; con `--import` no hay proceso envoltorio, así que `SIGTERM` llega directo al worker | Transpilador (esbuild, binario nativo) dentro de la imagen de producción; coste de arranque; no comprueba tipos (`tsc --noEmit` sigue en CI) |
| (b) Bundle del worker a JS (`esbuild --bundle --platform=node --format=esm`, dependencias de terceros externas, paquetes `@agentlab/*` incluidos) | `esbuild 0.28.2` (2026-08-08) o `tsup 9.0.0` (2026-10-14, exige Node `^22.18.0`); para dev además `tsx` o `node --watch` sobre el bundle | La imagen ejecuta `node dist/index.js` sin TS en runtime; encaja con `moduleResolution: bundler` (el nombre lo dice); `turbo build` pasa a tener sentido real | Paso de build y sourcemaps que mantener; dev y prod ejecutan artefactos distintos; probablemente dos dependencias |
| (c) Type stripping nativo de Node (activo por defecto desde 22.18.0, sin aviso; [docs Node 22](https://nodejs.org/docs/latest-v22.x/api/typescript.html), consultadas 2026-10-20) | Ninguna; exige fijar Node `>=22.18` en `.nvmrc`/Dockerfiles | Cero dependencias; ejecuta exactamente el fuente | Estabilidad 1.2 (*release candidate*); exige extensión `.ts` en **todos** los imports relativos → cambiar `tsconfig` (`allowImportingTsExtensions` o `rewriteRelativeImportExtensions`, `erasableSyntaxOnly`) y reescribir la convención de TASK-001; sin `enum`, *parameter properties* ni `namespace` con valores; no lee `tsconfig`; rechaza `.ts` bajo `node_modules` (los enlaces de pnpm se resuelven a `packages/*` por realpath, pero hay que verificarlo) |

**Recomendación del architect: (a) `tsx 4.23.15`**, exacta, como dependencia de `apps/worker`, invocada como `node --import tsx`. Es la única opción que no cambia la convención de módulos ya aprobada en TASK-001 y usa un solo comando en dev, test y contenedor. (c) queda como vía de migración cuando el type stripping sea estable, y (b) si el tamaño o el arranque de la imagen llegan a importar. La decisión final se registrará en un ADR antes de TASK-003 (encargo aparte) y requiere añadir `tsx` a `deps_allowed`.
