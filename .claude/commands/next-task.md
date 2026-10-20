---
description: "Elige la siguiente tarea READY (o la indicada), obtiene el plan del architect si procede y espera aprobación humana. Uso: /next-task [TASK-NNN]"
---

Argumento opcional: `$ARGUMENTS` (un ID de tarea). Si no hay argumento, elige la tarea `READY` de menor número en `docs/TASKS.md`.

1. Comprueba que no hay otra tarea `IN_PROGRESS` ni `REVIEW`. Si la hay, informa y para (salvo que el humano haya autorizado dos en paralelo con scopes disjuntos).
2. Comprueba que todas las dependencias de la tarea están `DONE` y que ninguna OPEN DECISION de la que dependa sigue abierta. Si no: la tarea no es READY; corrige `TASKS.md` (→ `BLOCKED`), dilo y propón otra.
3. Decide si hace falta plan del `architect`:
   - **Sí** si la tarea crea un paquete, toca ARCHITECTURE/ADR/SPEC, tiene más de ~6 viñetas de DoD, o es la primera de un hito.
   - **No** si es acotada y el DoD es inequívoco (p. ej. un endpoint, un Dockerfile).
4. Si hace falta plan: delega al `architect` con un TASK PACKET (skill `task-packet`) pidiendo informe `PLAN`. Resume el plan al humano (≤ 20 líneas) con sus OPEN DECISIONS y riesgos.
5. Si no hace falta: resume al humano qué se va a hacer (objetivo, owner, scope, deps que harían falta) en ≤ 10 líneas.
6. **Espera aprobación humana explícita.** Hasta entonces no ejecutes `/execute-task`. Si el humano cambia algo, actualiza `TASKS.md` (DoD/scope) y el plan en `docs/reports/TASK-NNN-plan.md` (vía `architect`) antes de seguir.
