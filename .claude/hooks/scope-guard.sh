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

# Fuera del repositorio (scratchpad, temporales) el scope no aplica: se permite.
case "$rel" in OUTSIDE:*) exit 0 ;; esac

# Ficheros que nunca se editan desde Claude Code, con scope o sin él.
case "$rel" in
  .env|.env.*|*/.env|*/.env.*) [ "$rel" = ".env.example" ] || block "los ficheros .env solo los edita el humano" ;;
  .claude/settings.json|.claude/hooks/*|.githooks/*) block "cambiar hooks o settings requiere aprobación humana fuera del flujo (ADR-006)" ;;
esac

# Siempre permitido, con o sin tarea activa: el fichero de scope y la contabilidad del flujo
# (TASKS.md, deuda, informes). Quién puede escribirlos lo decide role-guard, no el scope.
case "$rel" in
  .claude/task-scope.json|docs/TASKS.md|docs/TECHNICAL_DEBT.md|docs/reports/*) exit 0 ;;
esac

task="$(scope_get task)"
allow="$(scope_get allow)"

if [ -z "$allow" ]; then
  block "no hay scope definido (.claude/task-scope.json sin 'allow'); ejecuta /execute-task primero"
fi

if any_match "$rel" <<< "$allow"; then
  exit 0
fi

block "'$rel' está fuera del scope de ${task:-<sin tarea>}. Rutas permitidas: $(printf '%s' "$allow" | tr '\n' ' ')"