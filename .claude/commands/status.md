---
description: "Reconstruye el estado del proyecto desde docs/ y git (≤ 15 líneas). Se ejecuta solo al arrancar el Orchestrator."
---

Reconstruye el estado de AgentLab **sin usar la conversación**. Orden:

1. `Read docs/TASKS.md` → hito actual, tareas `IN_PROGRESS`, `REVIEW` y `READY` (cabecera + buscar esos estados con `Grep`).
2. `Glob docs/reports/*.md` → el informe más reciente; léelo si hay una tarea `IN_PROGRESS` o `REVIEW`.
3. `Read .claude/task-scope.json` → si `task` no es `null`, hay una tarea a medias: dilo.
4. `Grep "OPEN" docs/TECHNICAL_DEBT.md` y `Read docs/TECHNICAL_SPEC.md` sección §13 → deuda y OPEN DECISIONS que afecten a las tareas READY.
5. `Bash: git status --porcelain && git log --oneline -10` → trabajo sin commitear y últimos commits.

Devuelve al humano, en ≤ 15 líneas:
- Hito actual y criterio de salida pendiente.
- Tarea en curso (si la hay) y en qué fase (implementación / verificación / cierre / commit).
- Tareas READY (ID y título).
- Bloqueos: OPEN DECISIONS que impidan avanzar, deuda HIGH/CRITICAL abierta.
- Estado de git (limpio / N ficheros sin commitear).
- Sugerencia de siguiente paso (`/next-task`, `/verify-task TASK-NNN`, `/commit`, …).

No propongas planes ni empieces nada. Para.
