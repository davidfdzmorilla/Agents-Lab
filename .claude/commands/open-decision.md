---
description: "Registra una OPEN DECISION en TECHNICAL_SPEC §13 (vía architect) y bloquea la tarea si depende de ella. Uso: /open-decision <descripción breve>"
---

Una OPEN DECISION es algo que SPEC/ARCHITECTURE no definen y que un subagente necesitaba para avanzar. **Nunca se resuelve inventando.**

1. Formula la decisión en una línea: qué falta, por qué bloquea, en qué tarea apareció. Argumento: `$ARGUMENTS`.
2. Abre el scope para el architect: `.claude/task-scope.json` → `"owner": "architect"`, `"allow": ["docs/TECHNICAL_SPEC.md", "docs/adr/**", "docs/reports/TASK-*-plan.md"]` (mantén `task` si hay una activa).
3. Delega a `architect`: registrar `OD-nnn` (siguiente número) en SPEC §13 con "quién decide" y "cuándo", y añadir una propuesta con 2-3 opciones, pros/contras y recomendación marcada `PROPUESTA — pendiente de decisión humana`. Pide informe `PLAN` corto.
4. Restaura el scope anterior.
5. Si una tarea depende de ella: `docs/TASKS.md` → esa tarea `BLOCKED` con "Depende de: …, OD-nnn". Si la tarea en curso puede continuar sin ella (el resto del DoD no la necesita), sigue y deja constancia en el informe de cierre.
6. Presenta al humano la decisión y las opciones en ≤ 10 líneas. Cuando decida: `architect` actualiza SPEC §13 (resuelta, fecha, decisión) y, si procede, un ADR `Proposed`; tú desbloqueas la tarea.
