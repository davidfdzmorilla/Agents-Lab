---
description: "Verificación independiente: tester → reviewer → security (si aplica). Devuelve hallazgos al owner hasta 3 ciclos. Uso: /verify-task TASK-NNN"
---

`$ARGUMENTS` = tarea `IN_PROGRESS` con informe `IMPLEMENTATION` recibido. Marca la tarea `REVIEW` en `docs/TASKS.md`.

Ejecuta **en secuencia**, cada uno con su TASK PACKET (skill `task-packet`) que incluya el DoD literal y el informe `IMPLEMENTATION`:

1. `tester` → informe `TEST`. Si `FAIL`: salta a "Ciclo de corrección".
2. `reviewer` → informe `REVIEW` (incluye también el `TEST`). Si `CHANGES_REQUESTED` con BLOCKER/MAJOR: "Ciclo de corrección". MINOR/NIT: anótalos como deuda LOW propuesta para el cierre (el humano los acepta en `/close-task`).
3. `security` → informe `SECURITY` **solo si**: la tarea dice `security REQUIRED`, o el diff toca `packages/providers`, `packages/tools`, `packages/policies`, `apps/web/app/api`, `docker/`, `compose*.yaml`, CI, `.claude/` o `.githooks/`, o el reviewer lo pide. Si `BLOCKED`: "Ciclo de corrección".

**Ciclo de corrección** (máximo 3 por tarea; cuenta en `TASKS.md` registro de cambios):
- `TASKS.md` → `IN_PROGRESS`.
- Delega al owner con el packet original + los informes con hallazgos, pidiendo corregir **solo** los hallazgos dentro del scope.
- Vuelve al paso 1 (tester repite la suite completa; reviewer y security pueden limitarse a los hallazgos).
- Al tercer ciclo fallido: para y escala al humano con los tres informes.

Al terminar con todos los veredictos positivos: resume al humano (veredictos + deuda propuesta + OPEN DECISIONS detectadas) en ≤ 12 líneas y sugiere `/close-task TASK-NNN`. Guarda los informes íntegros en tu contexto para el cierre (o pídelos de nuevo si se perdieron: los subagentes los pueden reproducir desde el diff).
