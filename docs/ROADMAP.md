# AgentLab — Hoja de ruta

| Campo | Valor |
|---|---|
| Versión | 1.0 (2026-10-20) |
| Jerarquía | ADR > SPEC > ARCHITECTURE > AGENTS + WORKFLOW > **ROADMAP** > TASKS |

Seis hitos. El orden importa: primero una ejecución funcional de extremo a extremo, después persistencia y proveedores, por último capacidades avanzadas. **Sin fechas**: cada hito tiene un criterio de salida objetivo; el progreso se mide por criterios cumplidos, no por cantidad de código.

Un hito se cierra cuando (a) todas sus tareas en `TASKS.md` están `DONE`, (b) su criterio de salida se ha verificado y el informe está en `docs/reports/M<n>-closure.md`, (c) el humano lo acepta.

## M0 — Base: fundamentos y entorno

**Paquetes que nacen**: `core`, `persistence`, `apps/web` (solo `/api/health` y página vacía), `apps/worker` (bucle vacío con heartbeat).

Entregables:
- Monorepo pnpm + Turborepo, TypeScript estricto, ESLint + Prettier, `tsconfig.base.json`.
- `compose.yaml` con `web`, `worker`, `db`; perfil `local` con `ollama`.
- Drizzle configurado; migración inicial con **todas** las tablas de `ARCHITECTURE.md §6`.
- `core`: esquemas Zod de `AgentDefinition`, `TeamDefinition`, `RunRequest`, `RunEvent`, `Budget`, errores tipados, `env.ts`.
- `GET /api/health` comprobando la conexión a PostgreSQL.
- CI (OD-004) que ejecuta `lint`, `typecheck`, `test` contra PostgreSQL de servicio.
- `.env.example`, `README.md` con instalación desde cero, `.githooks` instalados.
- Versiones de dependencias fijadas (OD-001 resuelta).

**Criterio de salida**: `docker compose up --build` levanta el entorno, `curl localhost:3000/api/health` devuelve `{ ok: true, db: "up" }` y `pnpm test` pasa en limpio y en CI.

## M1 — MVP: primera ejecución multiagente

**Paquetes que nacen**: `providers` (solo `openai-compatible`), `policies`, `orchestrator`, `agents`.

Entregables:
- Adaptador OpenAI-compatible con timeout, errores normalizados y uso de tokens cuando llega.
- `BudgetGuard` con llamadas, concurrencia, iteraciones y timeout (los demás límites con los valores de OD-002).
- Grafo `research`: Manager → dos especialistas (Researcher, Analyst) → Critic → decisión → resultado. Sin herramientas externas: los agentes trabajan con el contexto de la petición.
- `POST /api/runs`, `GET /api/runs/:id`, `GET /api/runs/:id/result`; worker que reclama y ejecuta.
- Eventos persistidos en `run_events` (SSE llega en M3; en M1 la UI hace polling cada 2 s).
- Pantalla `/runs/:id` con pasos, estado de cada agente, presupuesto consumido y resultado final.
- Tests: flujo completo con proveedor **fake** determinista; límites (presupuesto agotado → `partial`); errores de proveedor (rate limit → reintento → fallo).

**Criterio de salida**: resolver una tarea de análisis con un modelo gratuito o local y mostrar todas las etapas en la interfaz, incluyendo por qué terminó (`completed`, `partial` o `failed` con motivo).

## M2 — Modelos: proveedores intercambiables

**Paquetes que crecen**: `providers` (`gemini`, `ollama` como perfil del OpenAI-compatible), `ProviderRegistry`.

Entregables:
- Adaptador Gemini con SDK de Google GenAI.
- Comprobación de capacidades declaradas; `ProviderCapabilityError` antes de red.
- Reintentos con backoff exponencial + jitter para errores `retryable`; respeto de `retryAfterMs`.
- `GET /api/providers` con capacidades y modelos disponibles (sin claves).
- Selección de proveedor/modelo por agente desde `provider_configs`.
- Modelo local por defecto en `compose.yaml` (OD-005) y guía de proveedores y cuotas en `docs/PROVIDERS.md`.
- Tests de contrato: el mismo suite corre contra fake, OpenRouter (si hay clave) y Ollama (si está levantado); se salta con aviso si no hay credenciales.

**Criterio de salida**: cambiar de proveedor en `provider_configs` sin modificar ninguna definición de agente ni el grafo y obtener un run `completed`.

## M3 — Control: persistencia y observabilidad

**Paquetes que nacen**: `observability`.

Entregables:
- Checkpointer PostgreSQL de LangGraph enlazado con `run_checkpoints`.
- SSE real: `GET /api/runs/:id/events` con `LISTEN/NOTIFY`, `Last-Event-ID`, pings.
- `POST /cancel` cooperativo y `POST /resume` desde checkpoint.
- Recuperación de runs huérfanos por heartbeat.
- Trazas OTel por run/agente/herramienta; exportador a collector (perfil `observability`).
- Métricas por run en UI; comparación de dos runs (`/runs/:id/compare/:otherId`).
- `redactSecrets()` sobre prompts persistidos + test de fuga.
- Tests de integración: matar el worker a mitad de run y comprobar reanudación sin duplicar eventos.

**Criterio de salida**: reiniciar el worker no destruye el historial y las ejecuciones recuperables se reanudan de forma segura (mismo `seq`, sin pasos repetidos).

## M4 — Extensión: herramientas y equipos configurables

**Paquetes que nacen**: `tools`; `examples/`.

Entregables:
- `ToolRegistry` + `web.search`, `source.read` (con allowlist HTTP y bloqueo de rangos privados), `artifact.read/write`.
- Resultados de herramientas envueltos como no confiables.
- Herramientas con `sensitivity: "approval"` → `approval.wait` → `awaiting_approval` → `resume`.
- Editor de equipos en la UI: crear/editar agentes y equipos; builder de grafo genérico desde `coordination jsonb`.
- Validación de salidas estructuradas por `outputSchema` con reintento guiado (`invalid_output` → una repetición con el error).
- Persistencia de artefactos (OD-006).
- `examples/research-team`, `examples/analysis-team` reproducibles con Ollama.

**Criterio de salida**: crear un equipo desde la interfaz, sin editar código fuente, y ejecutarlo hasta `completed`.

## M5 — Calidad: evaluación y publicación

**Paquetes que nacen**: `evaluations`.

Entregables:
- Dataset de tareas con criterios objetivos; evaluadores; tabla `evaluations`.
- Comparación de modelos y benchmarks reproducibles (`pnpm bench`).
- Pruebas de seguridad: inyección vía resultados de herramientas, SSRF en `source.read`, fuga de secretos, escalada de presupuesto.
- `docs/security/SECURITY_POLICY.md` completa; `SECURITY.md` en raíz.
- Licencia aceptada (ADR-008), `NOTICE` de terceros, revisión de licencias de dependencias.
- OD-003 decidida; instalación limpia verificada en máquina ajena.

**Criterio de salida**: publicar una versión que otra persona pueda instalar y evaluar con sus propias claves o modelos locales siguiendo solo el README.

## Dependencias entre hitos

```
M0 ──► M1 ──► M2 ──► M3 ──► M4 ──► M5
              │             ▲
              └─────────────┘  (M3 puede empezar la parte de SSE/checkpoints
                                en paralelo con M2 si hay dos sesiones; por
                                defecto, secuencial)
```
