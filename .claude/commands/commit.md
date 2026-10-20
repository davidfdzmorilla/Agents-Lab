---
description: "Commit local de la tarea DONE en dos pasos: committer PREPARE → confirmación humana → committer EXECUTE. Uso: /commit [TASK-NNN]"
---

Tarea = `$ARGUMENTS` o la que esté en `.claude/task-scope.json`. Debe estar `DONE` en `docs/TASKS.md` con informe en `docs/reports/`. Si no, para.

1. Escribe `.claude/task-scope.json` → `"owner": "committer"`, `"commit_allowed": true` (mantén `task` y `allow`).
2. Delega a `committer` con packet `phase: PREPARE`, incluyendo el `allow` de la tarea (para que detecte ficheros fuera de scope) y el título de la tarea. Pide informe `COMMIT`.
3. Presenta al humano **literalmente**: lista de ficheros a incluir, ficheros excluidos y por qué, mensaje propuesto. Pregunta: «¿Confirmas el commit tal cual? (sí / cambios)».
4. **Espera la confirmación.** Si pide cambios en el mensaje o la lista, repite PREPARE con las instrucciones.
5. Con confirmación explícita: delega a `committer` con packet `phase: EXECUTE`, citando la confirmación humana, la lista exacta y el mensaje exacto.
6. Al recibir el hash: escribe `.claude/task-scope.json` → `{"task": null, "owner": null, "allow": ["*"], "deps_allowed": [], "commit_allowed": false, "updated_at": …}`. Añade el hash al registro de cambios de `docs/TASKS.md` (`| fecha | TASK-NNN commit <hash> |`).
7. Resume en 3 líneas. **Nunca** hagas push ni lo sugieras como algo que puedas hacer: es del humano.

Si el hook de commit rechaza (atribución, scope, secreto): muestra el motivo, deja `commit_allowed: false` y para. No lo "arregles" reformulando.
