# AgentLab — Deuda técnica

| Campo | Valor |
|---|---|
| Última actualización | 2026-10-20 |

Deuda = decisión consciente de hacer algo peor de lo que ARCHITECTURE exige, con fecha de pago. Si no tiene fecha de pago (hito), no es deuda: es un bug o una OPEN DECISION.

- **Severidad**: `LOW` (cosmético/estructural) · `MEDIUM` (afecta mantenibilidad) · `HIGH` (afecta corrección o seguridad en algún escenario) · `CRITICAL` (bloquea un criterio de salida).
- `HIGH` y `CRITICAL` solo las acepta el humano. El `reviewer` puede proponerlas; no aceptarlas.
- Solo el Orchestrator (sesión), `reviewer` (proponer) y `docs-keeper` editan este fichero.

| ID | Descripción | Severidad | Introducida en | Se paga en | Estado |
|---|---|---|---|---|---|
| TD-001 | La UI de `/runs/:id` hace polling cada 2 s en lugar de SSE. | LOW | TASK-016 (M1) | TASK-024 (M3) | OPEN (prevista) |
| TD-002 | Checkpointer `MemorySaver` en M1: un reinicio del worker pierde el estado del grafo (el run queda `failed` por heartbeat, no se reanuda). | MEDIUM | TASK-013 (M1) | TASK-023 (M3) | OPEN (prevista) |
| TD-003 | Los límites de OD-002 (tokens, contexto, herramientas, longitud, profundidad) se aplican con los valores *propuestos* hasta que el humano los fije. | LOW | TASK-011 (M1) | OD-002 resuelta | OPEN (prevista) |
| TD-004 | Un solo worker con `WORKER_CONCURRENCY=1`; sin cola distribuida. Decisión de diseño (ADR-004), se revisa si aparece necesidad real. | LOW | ADR-004 | Revisión en M5 | OPEN (por diseño) |
| TD-005 | Monousuario sin autenticación en la API hasta OD-003. | MEDIUM | SPEC §8 | TASK-039 (M5) | OPEN (prevista) |

## Reglas

1. Cada entrada nueva necesita una tarea en `TASKS.md` que la pague (o un hito concreto), no una promesa.
2. Al pagarla se marca `PAID (TASK-NNN)`; nunca se borra la fila.
3. Deuda detectada por el `reviewer` sin tarea de pago → el Orchestrator la crea antes de dar la tarea por `DONE`.
