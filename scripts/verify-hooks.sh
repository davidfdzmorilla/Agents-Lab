#!/usr/bin/env bash
# Verifica las barreras del sistema de agentes (ADR-006) sin tocar el repositorio real.
# 1) commit-msg rechaza atribución a IA; 2) scope-guard bloquea una edición fuera de scope;
# 3) bash-guard bloquea git push y un commit sin commit_allowed.
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"
export CLAUDE_PROJECT_DIR="$root"
fail=0
ok()   { printf '  \033[32mOK\033[0m   %s\n' "$1"; }
bad()  { printf '  \033[31mFAIL\033[0m %s\n' "$1"; fail=1; }

echo "1) commit-msg: atribución"
tmp="$(mktemp)"; printf 'feat(core): add schemas\n\nCo-Authored-By: Claude <noreply@anthropic.com>\n\nTask: TASK-004\n' > "$tmp"
if bash "$root/.githooks/commit-msg" "$tmp" 2>/dev/null; then bad "aceptó atribución"; else ok "rechaza atribución"; fi
printf 'feat(core): add schemas\n\nTask: TASK-004\n' > "$tmp"
if bash "$root/.githooks/commit-msg" "$tmp" 2>/dev/null; then ok "acepta mensaje válido"; else bad "rechazó mensaje válido"; fi
rm -f "$tmp"

echo "2) scope-guard: edición fuera de scope"
scope="$root/.claude/task-scope.json"; backup="$(cat "$scope")"
printf '{"task":"TASK-004","owner":"core-dev","allow":["packages/core/**"],"deps_allowed":[],"commit_allowed":false}' > "$scope"
if printf '{"tool_name":"Edit","tool_input":{"file_path":"%s/apps/web/page.tsx"}}' "$root" | bash "$root/.claude/hooks/scope-guard.sh" 2>/dev/null; then bad "permitió apps/web con scope core"; else ok "bloquea fuera de scope"; fi
if printf '{"tool_name":"Edit","tool_input":{"file_path":"%s/packages/core/src/index.ts"}}' "$root" | bash "$root/.claude/hooks/scope-guard.sh" 2>/dev/null; then ok "permite dentro de scope"; else bad "bloqueó dentro de scope"; fi
if printf '{"tool_name":"Edit","tool_input":{"file_path":"%s/packages/core/src/x.ts"}}' "$root" | bash "$root/.claude/hooks/role-guard.sh" web-dev 2>/dev/null; then bad "role-guard permitió core a web-dev"; else ok "role-guard bloquea core a web-dev"; fi
if printf '{"tool_name":"Edit","tool_input":{"file_path":"%s/docs/TASKS.md"}}' "$root" | bash "$root/.claude/hooks/role-guard.sh" orchestrator 2>/dev/null; then ok "role-guard permite TASKS.md al orchestrator"; else bad "role-guard bloqueó TASKS.md al orchestrator"; fi

if printf '{"tool_name":"Write","tool_input":{"file_path":"%s/packages/core/src/index.ts"}}' "$root" | bash "$root/.claude/hooks/role-guard.sh" devops 2>/dev/null; then ok "role-guard permite placeholder index.ts a devops"; else bad "role-guard bloqueó packages/core/src/index.ts a devops"; fi
if printf '{"tool_name":"Write","tool_input":{"file_path":"%s/packages/core/src/schemas.ts"}}' "$root" | bash "$root/.claude/hooks/role-guard.sh" devops 2>/dev/null; then bad "role-guard permitió código de core a devops"; else ok "role-guard bloquea código de core a devops"; fi
if printf '{"tool_name":"Bash","tool_input":{"command":"pnpm add lodash"}}' | bash "$root/.claude/hooks/bash-guard.sh" 2>/dev/null; then bad "permitió dependencia no autorizada"; else ok "bloquea dependencia no autorizada"; fi

echo "3) bash-guard: git"
if printf '{"tool_name":"Bash","tool_input":{"command":"git push origin main"}}' | bash "$root/.claude/hooks/bash-guard.sh" 2>/dev/null; then bad "permitió git push"; else ok "bloquea git push"; fi
if printf '{"tool_name":"Bash","tool_input":{"command":"git commit -m \\"feat(core): x\\""}}' | bash "$root/.claude/hooks/bash-guard.sh" 2>/dev/null; then bad "permitió commit sin commit_allowed"; else ok "bloquea commit sin commit_allowed"; fi
printf '{"task":"TASK-004","owner":"committer","allow":["packages/core/**"],"deps_allowed":[],"commit_allowed":true}' > "$scope"
if printf '{"tool_name":"Bash","tool_input":{"command":"git commit -m \\"feat(core): x\\""}}' | bash "$root/.claude/hooks/bash-guard.sh" 2>/dev/null; then ok "permite commit con commit_allowed"; else bad "bloqueó commit autorizado"; fi
if printf '{"tool_name":"Bash","tool_input":{"command":"git commit -m \\"feat(core): x\\n\\nCo-Authored-By: Claude\\""}}' | bash "$root/.claude/hooks/bash-guard.sh" 2>/dev/null; then bad "permitió commit con atribución"; else ok "bloquea commit con atribución"; fi
if printf '{"tool_name":"Bash","tool_input":{"command":"cat .env"}}' | bash "$root/.claude/hooks/bash-guard.sh" 2>/dev/null; then bad "permitió cat .env"; else ok "bloquea cat .env"; fi
if printf '{"tool_name":"Bash","tool_input":{"command":"pnpm -r test"}}' | bash "$root/.claude/hooks/bash-guard.sh" 2>/dev/null; then ok "permite pnpm -r test"; else bad "bloqueó pnpm -r test"; fi
printf '%s\n' "$backup" > "$scope"

[ $fail -eq 0 ] && echo "verify-hooks: todas las barreras funcionan" || { echo "verify-hooks: HAY BARRERAS QUE NO FUNCIONAN"; exit 1; }