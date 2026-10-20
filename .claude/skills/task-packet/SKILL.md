---
name: task-packet
description: "Formato del TASK PACKET con el que el Orchestrator delega cualquier trabajo a un subagente de AgentLab. Precargado en el Orchestrator; útil también para entender qué debe traer un encargo."
---

# TASK PACKET

El subagente arranca **sin la conversación**. El packet es su único contexto además de `docs/`. Si falta algo aquí, el subagente no lo adivina: lo reporta.

## Plantilla

```
TASK PACKET — TASK-NNN · <título literal de TASKS.md>
Owner: <subagente>
Hito: M<n>
Fase: implementación | verificación(tester|reviewer|security) | corrección(ciclo k/3) | cierre | commit(PREPARE|EXECUTE) | plan | open-decision

Objetivo (1-3 frases):
  <qué debe existir al terminar y para qué sirve>

Scope (rutas permitidas, copiadas de TASKS.md):
  - <ruta/glob>
  - …

Dependencias autorizadas (deps_allowed):
  - <paquete>   # o "ninguna"

Documentos de referencia (leer antes de empezar):
  - docs/TECHNICAL_SPEC.md §x
  - docs/ARCHITECTURE.md §y
  - docs/adr/ADR-00z-…
  - docs/reports/TASK-NNN-plan.md   # si hay plan aprobado

DoD (literal de TASKS.md; cada viñeta se verifica):
  - …

Plan aprobado (resumen 5-10 líneas; si no hubo, "sin plan por decisión humana"):
  …

Restricciones específicas:
  - <lo que no debe hacerse en esta tarea aunque parezca razonable>

Contexto previo (solo en corrección/verificación/cierre):
  <informes anteriores íntegros, en orden>

Entregable:
  Informe <IMPLEMENTATION|TEST|REVIEW|SECURITY|CLOSURE|COMMIT|PLAN> según .claude/skills/reports/SKILL.md
```

## Reglas
- El DoD va **literal**, no parafraseado: es lo que el tester verificará.
- El scope del packet coincide con `.claude/task-scope.json`; si no, el hook bloqueará al owner.
- En verificación, el packet del `tester` incluye el `IMPLEMENTATION`; el del `reviewer` incluye `IMPLEMENTATION` + `TEST`; el del `security`, los tres.
- En `commit`, el packet incluye `allow` y, en EXECUTE, la cita de la confirmación humana, la lista exacta de ficheros y el mensaje exacto.
- Nunca incluyas secretos, ni siquiera "para que funcione el test".
