# ADR-006 — Sistema de agentes de desarrollo con Claude Code y política de commits

| Campo | Valor |
|---|---|
| Estado | Accepted |
| Fecha | 2026-10-20 |
| Decisores | Responsable humano |
| Relacionado | AGENTS.md; DEVELOPMENT_WORKFLOW.md; `.claude/`; `.githooks/` |

## Contexto
AgentLab se desarrolla con Claude Code. Se quiere independencia entre quien implementa y quien valida, permisos verificables por mecanismo, sesiones reanudables desde `docs/`, y commits sin atribución a IA. Mismo esquema que proyectos anteriores del autor, adaptado a un monorepo TypeScript.

## Decisión
1. **El Orquestador es el agente de sesión** (`.claude/agents/orchestrator.md`, `claude --agent orchestrator`), no un subagente: un subagente no puede sostener el ciclo ni recibir la confirmación humana del commit. Su `tools: Agent(<roster>)` restringe por mecanismo a quién puede delegar; `initialPrompt` reconstruye el estado al arrancar. `CLAUDE.md` replica las reglas como respaldo para `claude` a secas.
2. **12 subagentes** en `.claude/agents/` con `tools` mínimos, modelo y `effort` por rol (AGENTS §3). `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1`: solo el Orquestador delega. `permissions.deny` de `Agent(fork)`, `Agent(general-purpose)`, `Agent(claude)`, `Agent(Explore)`, `Agent(Plan)` cierra las vías alternativas.
3. **Encadenamiento secuencial por tarea**: owner → tester → reviewer → security (si aplica) → docs-keeper → committer, con informes estructurados. Cada subagente arranca desde el TASK PACKET y `docs/`, sin la conversación.
4. **Garantías por hook** (PreToolUse): `scope-guard.sh` (scope de la tarea, escrito por el Orquestador en `.claude/task-scope.json`), `role-guard.sh` (rutas por rol, en el frontmatter de cada subagente), `bash-guard.sh` (git, dependencias, secretos). `reviewer` y `security` sin `Edit`/`Write`.
5. **Commits**: el `committer` ejecuta el commit **local** en dos fases (`PREPARE` → confirmación humana → `EXECUTE`), solo con `commit_allowed: true` que escribe el Orquestador tras los veredictos. Triple barrera anti-atribución: `attribution` vacío en `settings.json`, `bash-guard.sh` y `.githooks/commit-msg`. Push, merge, rebase, reset: solo el humano, fuera de Claude Code.
6. Modelos por alias (`opus`, `sonnet`, `haiku`), nunca por versión fija.
7. No se usan agent teams ni subagentes anidados en v1: el pipeline es lineal y dependiente.

## Alternativas consideradas
| Alternativa | Por qué se descarta |
|---|---|
| Un único agente que hace todo | Sin independencia de validación; contexto saturado; no auditable |
| Orquestador como subagente | No puede mantener el estado de sesión ni la confirmación humana del commit |
| Agent teams desde el inicio | Más tokens, coordinación lateral innecesaria, conflictos de ficheros sin worktrees |
| Committer solo prepara, humano ejecuta | Válido; se elige ejecutar porque es local, reversible y gateado. Cambiarlo es una línea en `commands/commit.md` |

## Consecuencias
- Positivas: permisos verificables; informes archivados; sesiones reanudables.
- Negativas: latencia por arranque de subagentes; el TASK PACKET debe ser autosuficiente.

## Verificación
`make verify-hooks`: intenta un commit con `Co-Authored-By` y una edición fuera de scope; ambas deben fallar. El prompt inicial (`docs/CLAUDE_CODE_INITIAL_PROMPT.md`) lo ejecuta y se detiene si algo pasa.
