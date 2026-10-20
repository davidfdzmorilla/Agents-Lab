# ADR-002 — LangGraph.js como motor de grafos con checkpointer PostgreSQL

| Campo | Valor |
|---|---|
| Estado | Proposed (se acepta al resolver OD-001 en TASK-002) |
| Fecha | 2026-10-20 |
| Decisores | Responsable humano · architect |
| Relacionado | SPEC §3, §4, §6; ARCHITECTURE §4; TASK-002, TASK-013, TASK-023 |

## Contexto
El motor necesita grafos con ciclos (revisión → replanificación), pausas para aprobación humana, cancelación y reanudación tras reinicio. Implementarlo a mano es posible pero reinventa checkpoints, interrupciones y estado.

## Decisión
1. **LangGraph.js** como motor de grafos. Los nodos genéricos (`gate.budget`, `agent.invoke`, `fanout.tasks`, `review`, `decide.review`, `approval.wait`, `persist.result`) viven en `packages/orchestrator`.
2. Checkpointer **persistente sobre PostgreSQL** con `thread_id = runId`, enlazado por `run_checkpoints`. En M1 se usa `MemorySaver` (deuda TD-002) y en M3 se sustituye.
3. Aprobación humana mediante `interrupt()`; el run pasa a `awaiting_approval` y `POST /resume` reanuda desde checkpoint.
4. Las versiones exactas de LangGraph.js y del checkpointer se fijan en TASK-002 tras verificar compatibilidad; este ADR pasa a `Accepted` entonces.

## Alternativas consideradas
| Alternativa | Por qué se descarta |
|---|---|
| Máquina de estados propia | Reimplementar checkpoints/interrupciones; más código que mantener sin beneficio claro en v1 |
| Mastra, CrewAI-like TS | Menos control sobre estado y checkpoints; acoplan proveedores |
| Temporal / cola durable | Sobredimensionado para un worker local a coste cero |

## Consecuencias
- Positivas: ciclos, pausas y recuperación resueltos por la librería; patrón conocido.
- Negativas: dependencia de la API de LangGraph.js (cambios entre versiones); se encapsula en `orchestrator` para que `agents`, `providers` y `web` no la importen.

## Verificación
TASK-013 (grafo con `FakeProvider`), TASK-023 (reanudación desde checkpoint), TASK-026 (muerte del worker).
