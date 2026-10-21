# ADR-000 — Índice y plantilla de decisiones

| Campo | Valor |
|---|---|
| Estado | Accepted |
| Fecha | 2026-10-20 |
| Decisores | Responsable humano |

## Índice

| ADR | Título | Estado |
|---|---|---|
| ADR-001 | Monorepo pnpm + Turborepo con paquetes por responsabilidad | Accepted |
| ADR-002 | LangGraph.js como motor de grafos con checkpointer PostgreSQL | Accepted |
| ADR-003 | Capa de proveedores: interfaz común + adaptadores (OpenAI-compatible, Gemini) | Accepted |
| ADR-004 | Worker único sobre tabla `runs`; sin cola externa en v1 | Accepted |
| ADR-005 | Presupuesto interno comprobado antes de cada llamada | Accepted |
| ADR-006 | Sistema de agentes de desarrollo con Claude Code y política de commits | Accepted |
| ADR-007 | PostgreSQL como fuente de verdad; eventos con `seq` y `LISTEN/NOTIFY` | Accepted |
| ADR-008 | Licencia Apache-2.0 | Proposed (se acepta en M5) |
| ADR-009 | Ejecución de TypeScript en runtime con tsx | Accepted (§7: fallback `node --import tsx` activado en TASK-008, 2026-10-21) |
| ADR-010 | `tsx` también en `packages/persistence` para `db:migrate` y `db:reset` | Accepted (2026-10-20; `tsx` dev de `persistence`, amplía ADR-009 §2) |
| ADR-011 | Imágenes `worker` y `migrate` construidas con `pnpm deploy` | Accepted (2026-10-21, con dos condiciones: lockfile congelado en cada stage de deploy; limpieza del `package.json` raíz en `migrate` como deuda LOW) |
| ADR-012 | Build e imagen de `apps/web`: Next.js `standalone` con webpack | Accepted (2026-10-21, TASK-007; OD-039 a, OD-040 a; `web` sale con 143 bajo `SIGTERM` por diseño de Next, documentado en el DoD y no tratado como fallo; versiones por OD-042: `next 16.4.2` con excepción de seguridad, `react`/`react-dom 19.3.0` sin excepción; la imagen requiere un `tmpfs` en `.next/cache`, que provee compose, TASK-007 verificada 2026-10-21) |

## Reglas

- Un ADR se escribe cuando una decisión afecta a más de un paquete, cambia una garantía de seguridad o resuelve una OPEN DECISION.
- Solo el `architect` crea ADRs y siempre en estado `Proposed`. Solo el humano los pasa a `Accepted`.
- Un ADR `Accepted` prevalece sobre `TECHNICAL_SPEC.md` si se contradicen: es una decisión fechada y explícita; cuando chocan, casi siempre es el SPEC el que no se actualizó. El `docs-keeper` actualiza el SPEC en la misma tarea.
- Un ADR no se edita para cambiar la decisión: se escribe otro que lo sustituye (`Superseded by ADR-0XX`).

## Plantilla

```markdown
# ADR-0NN — Título

| Campo | Valor |
|---|---|
| Estado | Proposed · Accepted · Superseded by ADR-0XX |
| Fecha | AAAA-MM-DD |
| Decisores | Responsable humano · architect |
| Relacionado | SPEC §x; ARCHITECTURE §y; TASK-NNN |

## Contexto
## Decisión
## Alternativas consideradas
| Alternativa | Por qué se descarta |
## Consecuencias
## Verificación
```
