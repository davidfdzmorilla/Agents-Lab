#!/usr/bin/env bash
# PreToolUse (Edit|Write|MultiEdit|NotebookEdit), global para la sesión y todos los subagentes.
# Bloquea cualquier edición fuera del scope de la tarea activa (.claude/task-scope.json → allow[]).
# El Orchestrator escribe task-scope.json en /execute-task y lo deja en {"allow":["*"]} al terminar.

HOOK_NAME="scope-guard"
. "$(dirname "$0")/lib.sh"
read_input

rel="$(target_path)"
# Fail-closed: una edición sin ruta legible no se permite.
[ -n "$rel" ] || block "no se pudo determinar el fichero objetivo"

case "$rel" in
  OUTSIDE:*) block "edición fuera del repositorio: ${rel#OUTSIDE:}" ;;
esac

# Ficheros que nunca se editan desde Claude Code, con scope o sin él.
case "$rel" in
  .env|.env.*|*/.env|*/.env.*) [ "$rel" = ".env.example" ] || block "los ficheros .env solo los edita el humano" ;;
  .claude/settings.json|.claude/hooks/*|.githooks/*) block "cambiar hooks o settings requiere aprobación humana fuera del flujo (ADR-006)" ;;
esac

# Siempre permitido: el fichero de scope (solo lo escribe el Orchestrator; role-guard lo restringe por rol).
[ "$rel" = ".claude/task-scope.json" ] && exit 0

task="$(scope_get task)"
allow="$(scope_get allow)"

if [ -z "$allow" ]; then
  block "no hay scope definido (.claude/task-scope.json sin 'allow'); ejecuta /execute-task primero"
fi

if any_match "$rel" <<< "$allow"; then
  exit 0
fi

block "'$rel' está fuera del scope de ${task:-<sin tarea>}. Rutas permitidas: $(printf '%s' "$allow" | tr '\n' ' ')"
