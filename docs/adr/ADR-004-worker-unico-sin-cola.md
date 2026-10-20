# ADR-004 — Worker único sobre la tabla `runs`; sin cola externa en v1

| Campo | Valor |
|---|---|
| Estado | Accepted |
| Fecha | 2026-10-20 |
| Decisores | Responsable humano |
| Relacionado | SPEC §3; ARCHITECTURE §1, §8; TASK-008, TASK-026 |

## Contexto
La API no puede bloquearse durante una ejecución de minutos. Hace falta un proceso aparte, pero una cola (Redis/BullMQ, RabbitMQ) añade infraestructura que el MVP no necesita.

## Decisión
1. `apps/worker` es un proceso Node.js independiente que reclama runs `queued` con `SELECT … FOR UPDATE SKIP LOCKED`.
2. `WORKER_CONCURRENCY=1` en v1. Varios workers son posibles (el `SKIP LOCKED` lo permite) pero no se prueban hasta que haga falta.
3. Heartbeat cada 15 s; runs con heartbeat caducado (> 60 s) vuelven a `queued` y se reanudan desde checkpoint.
4. Se introducirá una cola específica solo cuando exista una necesidad medida: reintentos distribuidos, prioridad, volumen. Se registrará en un ADR nuevo.

## Alternativas consideradas
| Alternativa | Por qué se descarta |
|---|---|
| BullMQ + Redis | Un servicio más, otra fuente de estado; nada que PostgreSQL no cubra a esta escala |
| Ejecutar en el proceso web (`after()`/background) | Pierde el run al reiniciar web; no aislable |

## Consecuencias
- Positivas: una sola fuente de verdad; menos servicios.
- Negativas: sin prioridad ni reintentos distribuidos (TD-004).

## Verificación
TASK-005 (dos reclamaciones concurrentes no cogen el mismo run), TASK-026.
