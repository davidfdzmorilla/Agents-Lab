---
description: "Cierre documental de una tarea verificada: informes archivados, TASKS.md → DONE, deuda, README. Uso: /close-task TASK-NNN"
---

`$ARGUMENTS` = tarea en `REVIEW` con `TEST: PASS`, `REVIEW: APPROVED` y `SECURITY: APPROVED` (si aplicaba). Si falta alguno, para: no hay cierre sin veredictos.

1. Deuda propuesta en los informes: preséntala al humano con severidad y tarea de pago propuesta. Solo lo que apruebe se registra. HIGH/CRITICAL requieren su aprobación explícita.
2. OPEN DECISIONS detectadas durante la tarea que aún no estén en SPEC §13: ejecuta `/open-decision` para cada una antes de cerrar.
3. Escribe en `.claude/task-scope.json` → `"allow": ["docs/**", "README.md", "examples/**", "**/README.md", "LICENSE", "NOTICE", "SECURITY.md"]` manteniendo `task` y poniendo `"owner": "docs-keeper"`.
4. Delega a `docs-keeper` con TASK PACKET que incluya **íntegros** los informes `PLAN` (si hubo), `IMPLEMENTATION`, `TEST`, `REVIEW`, `SECURITY`, la deuda aprobada (con severidad y tarea de pago) y si cambió instalación/comandos. Pide informe `CLOSURE`.
5. Comprueba (con `Read`) que `docs/reports/TASK-NNN.md` existe y que `TASKS.md` marca `DONE` y ha desbloqueado dependientes. Si no, corrígelo tú (está en tu rol) y anótalo.
6. Resume al humano en ≤ 8 líneas y sugiere `/commit`.

Si la tarea cierra un hito (última `DONE` del hito): pide además a `docs-keeper` el `docs/reports/M<n>-closure.md` con el criterio de salida verificado (el `tester` lo habrá verificado en la tarea de cierre) y **pide al humano que acepte el hito** antes de pasar "Hito actual" en `TASKS.md`.
