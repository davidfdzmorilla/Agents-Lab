# ADR-007 — PostgreSQL como fuente de verdad; eventos con `seq` y `LISTEN/NOTIFY`

| Campo | Valor |
|---|---|
| Estado | Accepted |
| Fecha | 2026-10-20 |
| Decisores | Responsable humano |
| Relacionado | SPEC §6, §8; ARCHITECTURE §1, §3.4, §6; TASK-005, TASK-024 |

## Contexto
Reiniciar un contenedor no puede borrar el historial. Los clientes SSE necesitan recuperar eventos perdidos al reconectar. `web` y `worker` son procesos separados sin HTTP entre ellos.

## Decisión
1. PostgreSQL 16 es la única fuente de verdad: configuración, runs, tareas, invocaciones, eventos, checkpoints, evaluaciones. Nada vive solo en memoria.
2. `run_events` con `seq` entero monótono por run, asignado atómicamente en `EventsRepository.append`; `unique(run_id, seq)`. El `id` SSE es el `seq`; `Last-Event-ID` permite recuperar huecos.
3. Un evento se persiste **antes** de `NOTIFY run_events, '<runId>'`. El handler SSE de `web` hace `LISTEN` y lee por `seq`.
4. Drizzle como ORM; migraciones versionadas; tests contra PostgreSQL real (`agentlab_test`).
5. Secretos: `provider_configs.api_key_env` guarda el **nombre** de la variable de entorno. Prompts persistidos pasan por `redactSecrets()`.

## Alternativas consideradas
| Alternativa | Por qué se descarta |
|---|---|
| Redis pub/sub para eventos | Segunda fuente de estado; eventos no durables sin trabajo extra |
| Eventos solo en memoria + SSE directo | Se pierden al reiniciar; imposible reconectar |
| Prisma | Drizzle es más ligero y SQL-first; mejor para `SKIP LOCKED` y `NOTIFY` |

## Consecuencias
- Positivas: un solo servicio de estado; recuperación trivial.
- Negativas: `LISTEN` necesita una conexión dedicada en `web` (se gestiona en `persistence/notify`).

## Verificación
TASK-005, TASK-024 (reconexión recupera huecos), TASK-026 (`seq` continuo tras reanudar).
