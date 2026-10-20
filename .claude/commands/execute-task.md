---
description: "Abre el scope de la tarea, la marca IN_PROGRESS y delega al owner con el TASK PACKET. Uso: /execute-task TASK-NNN"
---

`$ARGUMENTS` debe ser un ID de tarea con plan aprobado (o sin plan por decisión explícita del humano en `/next-task`). Si falta la aprobación, para.

1. Lee la tarea en `docs/TASKS.md`: owner, scope, deps, DoD, referencias.
2. Escribe `.claude/task-scope.json`:
   ```json
   {
     "task": "TASK-NNN",
     "owner": "<owner>",
     "allow": [ "<cada ruta del Scope de TASKS.md, tal cual>" ],
     "deps_allowed": [ "<solo lo aprobado por el humano>" ],
     "commit_allowed": false,
     "updated_at": "<ISO ahora>"
   }
   ```
   Reglas para `allow`: copia el Scope literal; añade `docs/reports/TASK-NNN-plan.md` si el owner es `architect`; **no** añadas `docs/**` para owners de código. Para `deps_allowed`: dev-dependencies de test/lint estándar que el DoD implique (vitest, msw, @types/*) puedes incluirlas diciéndolo; cualquier otra, solo si el humano la aprobó.
3. En `docs/TASKS.md`: estado → `IN_PROGRESS`; añade línea al registro de cambios.
4. Construye el TASK PACKET (skill `task-packet`) con el DoD literal, el plan aprobado (resumen + ruta), referencias y restricciones. Delega al owner con `Agent` pidiendo informe `IMPLEMENTATION`.
5. Al recibir el informe:
   - Si reporta bloqueo por scope, dependencia u OPEN DECISION: no lo resuelvas tú. Pregunta al humano (scope/deps) o ejecuta `/open-decision` (decisión). Si bloquea del todo: `TASKS.md` → `BLOCKED`, scope a `{"task": null, "allow": ["*"], …}`.
   - Si está completo: resume al humano (≤ 10 líneas) y sugiere `/verify-task TASK-NNN`. No lo ejecutes sin que lo pida, salvo que el humano haya dicho "encadena".
