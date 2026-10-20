#!/usr/bin/env bash
# PreToolUse (Edit|Write|MultiEdit|NotebookEdit) declarado en el frontmatter de cada agente:
#   command: "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/role-guard.sh <rol>"
# Limita qué rutas puede editar cada rol (docs/AGENTS.md §3). Se combina con scope-guard (intersección).

HOOK_NAME="role-guard"
. "$(dirname "$0")/lib.sh"
read_input

role="${1:-}"
[ -n "$role" ] || block "role-guard invocado sin rol"

rel="$(target_path)"
[ -n "$rel" ] || block "no se pudo determinar el fichero objetivo"
case "$rel" in OUTSIDE:*) block "edición fuera del repositorio" ;; esac

# Patrones permitidos por rol (uno por línea). '*' = todo. Vacío = nada.
case "$role" in
  orchestrator) allow=$'docs/TASKS.md\ndocs/TECHNICAL_DEBT.md\ndocs/ROADMAP.md\ndocs/reports/**\n.claude/task-scope.json' ;;
  architect)    allow=$'docs/adr/**\ndocs/ARCHITECTURE.md\ndocs/TECHNICAL_SPEC.md\ndocs/reports/TASK-*-plan.md' ;;
  core-dev)     allow=$'packages/core/**\npackages/policies/**\npackages/observability/**' ;;
  persistence-dev) allow=$'packages/persistence/**\ndrizzle.config.ts\ndocker/postgres/**' ;;
  providers-dev) allow=$'packages/providers/**' ;;
  engine-dev)   allow=$'packages/orchestrator/**\npackages/agents/**\npackages/tools/**\npackages/evaluations/**\napps/worker/**\ndatasets/**' ;;
  web-dev)      allow=$'apps/web/**' ;;
  devops)       allow=$'package.json\npnpm-workspace.yaml\npnpm-lock.yaml\nturbo.json\ntsconfig*.json\n.eslintrc*\neslint.config.*\n.prettierrc*\n.editorconfig\n.nvmrc\nMakefile\ncompose*.yaml\ncompose*.yml\ndocker/**\n.gitlab-ci.yml\n.github/**\nscripts/**\n.env.example\n.dockerignore\n.gitignore\napps/*/package.json\npackages/*/package.json\napps/*/tsconfig*.json\npackages/*/tsconfig*.json\napps/*/Dockerfile\nvitest.workspace.*\napps/*/src/index.ts\npackages/*/src/index.ts' ;;
  tester)       allow=$'**/*.test.ts\n**/*.test.tsx\ntests/**\n**/testing/**\n**/__fixtures__/**\nvitest.config.*\nvitest.workspace.*\npackages/*/vitest.config.*\napps/*/vitest.config.*\ndocs/reports/M*-closure.md' ;;
  docs-keeper)  allow=$'docs/**\nREADME.md\nexamples/**\nLICENSE\nNOTICE\n**/README.md\nSECURITY.md' ;;
  reviewer|security|committer) allow='' ;;
  *) block "rol desconocido '$role'" ;;
esac

# Exclusiones por rol que el patrón amplio no debe cubrir.
case "$role" in
  docs-keeper)
    case "$rel" in
      docs/adr/*|docs/ARCHITECTURE.md|docs/TECHNICAL_SPEC.md) block "docs-keeper no edita ADRs, ARCHITECTURE ni SPEC (eso es del architect)" ;;
    esac ;;
  tester)
    # Un fichero de producción con sufijo .test.ts no es producción; pero un .ts sin sufijo sí.
    case "$rel" in
      *.test.ts|*.test.tsx|tests/*|*/testing/*|*/__fixtures__/*|vitest.*|*/vitest.*|docs/reports/M*-closure.md) ;;
      *) block "tester no toca código de producción: '$rel'" ;;
    esac ;;
  architect)
    [ "$rel" = "docs/TECHNICAL_SPEC.md" ] && echo "role-guard: architect edita SPEC solo en §13 OPEN DECISIONS; el reviewer lo comprobará" >&2 ;;
esac

[ -n "$allow" ] || block "el rol '$role' no edita ficheros (solo lectura)"

if any_match "$rel" <<< "$allow"; then
  exit 0
fi
block "el rol '$role' no puede editar '$rel'. Si la tarea lo necesita, repórtalo en el informe; el Orchestrator decidirá."