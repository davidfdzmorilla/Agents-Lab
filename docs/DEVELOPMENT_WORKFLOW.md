# AgentLab — Flujo de desarrollo

| Campo | Valor |
|---|---|
| Versión | 1.1 (2026-10-20) |
| Jerarquía | ADR > SPEC > ARCHITECTURE > **AGENTS + WORKFLOW** > ROADMAP > TASKS |

## 1. Principio rector

**El estado vive en `docs/` y en git, nunca en la conversación.** Cualquier sesión de Claude Code debe poder retomarse otro día leyendo solo `docs/`. Si algo importante se decidió en una conversación y no está en un documento, no se decidió.

## 2. Orden de lectura al arrancar una sesión

1. `docs/TASKS.md` — hito actual, tareas READY/IN_PROGRESS.
2. `docs/reports/` — último informe de tarea (estado real del código).
3. `docs/TECHNICAL_DEBT.md` — deuda abierta que afecte a la tarea.
4. `docs/TECHNICAL_SPEC.md §13` — OPEN DECISIONS pendientes.
5. `git status` y `git log --oneline -10` — ¿hay trabajo sin commitear?
6. Solo si la tarea lo requiere: `ARCHITECTURE.md`, `TECHNICAL_SPEC.md` completos, ADRs relacionados.

El comando `/status` ejecuta exactamente esto y devuelve un resumen de ≤ 15 líneas.

## 3. Reglas inamovibles

1. **Una tarea `IN_PROGRESS` a la vez** por sesión. Dos solo con autorización explícita del humano y scopes disjuntos. Una tarea a la vez por defecto; si el humano autoriza dos, el scope de `task-scope.json` es la unión de ambos.
2. **Los agentes no inventan requisitos.** Lo que SPEC/ARCHITECTURE no definen se registra como `OPEN DECISION` (`/open-decision`) y, si bloquea, la tarea queda `BLOCKED`. Una suposición "razonable" sin registrar es un defecto.
3. **`DONE` exige**: tester `PASS` + reviewer `APPROVED` + security `APPROVED` cuando aplica + informe en `docs/reports/TASK-NNN.md`. Nunca se salta, ni "por esta vez".
4. **Una tarea `DONE` no se reabre.** Se crea `TASK-NNN-fix-<n>` que la referencia.
5. **Commits sin atribución a IA.** Ni `Co-Authored-By`, ni "Generated with", ni menciones a Claude/Anthropic. Preparar y ejecutar el commit son pasos separados con confirmación humana en medio.
6. **Arquitectura real sin sobrearquitectura.** Se respetan los límites de paquete y la dirección de dependencias; no se crean paquetes, abstracciones ni capas que la tarea no necesite. Si parece necesario, se propone en el informe, no se hace.
7. **Scope cerrado.** El owner solo edita lo que `task-scope.json` permite. Si necesita tocar otra cosa, lo dice en el informe y el Orquestador decide (ampliar scope con aprobación humana o crear tarea).
8. **Sin secretos jamás** en código, tests, fixtures, docs, mensajes de commit ni informes. Los tests usan `FakeProvider` o variables de entorno leídas en runtime.
9. **Tests contra PostgreSQL real**, nunca SQLite ni mocks del ORM para repositorios.
10. **Informes, no volcados.** Un subagente devuelve el informe estructurado de §5; nunca pega ficheros enteros ni logs completos (máx. 30 líneas de log relevante).
11. **Validación del architect fuera del repo.** El architect puede validar en un directorio temporal fuera del repo y debe decirlo en el informe PLAN; dentro del repo, nunca sin `deps_allowed`.

## 4. TASK PACKET

El Orquestador delega **siempre** con este paquete (formato completo en `.claude/skills/task-packet/SKILL.md`). Es autosuficiente: el subagente arranca sin la conversación.

```
TASK PACKET — TASK-NNN · <título>
Owner: <subagente>
Hito: M<n>
Objetivo (1-3 frases): …
Scope (rutas permitidas): …
Dependencias autorizadas (deps_allowed): …      # vacío si ninguna
Documentos de referencia: SPEC §x, ARCHITECTURE §y, ADR-00z
DoD (copiado literalmente de TASKS.md):
  - …
Plan aprobado (si lo hubo): resumen de 5-10 líneas o enlace a docs/reports/TASK-NNN-plan.md
Restricciones específicas: …
Entregable: informe IMPLEMENTATION según .claude/skills/reports/SKILL.md
```

## 5. Formatos de informe

Todos los informes se devuelven en el mensaje final del subagente y `docs-keeper` los archiva en `docs/reports/TASK-NNN.md`. Formato detallado en `.claude/skills/reports/SKILL.md`.

| Informe | Autor | Campos obligatorios |
|---|---|---|
| `PLAN` | architect | contexto, decisiones, pasos, ficheros afectados, riesgos, OPEN DECISIONS detectadas |
| `IMPLEMENTATION` | owner | qué se hizo, ficheros creados/modificados, cómo probarlo, desviaciones del plan, deuda propuesta, dudas |
| `TEST` | tester | comandos ejecutados, resultado por DoD (✅/❌/⚠️ manual), cobertura, veredicto `PASS`/`FAIL` |
| `REVIEW` | reviewer | hallazgos por severidad (BLOCKER/MAJOR/MINOR/NIT) con fichero:línea, cumplimiento de ARCHITECTURE, deuda propuesta, veredicto `APPROVED`/`CHANGES_REQUESTED` |
| `SECURITY` | security | vectores revisados, hallazgos, veredicto `APPROVED`/`BLOCKED` |
| `CLOSURE` | docs-keeper | qué documentos cambió, estado final en TASKS.md |
| `COMMIT` | committer | fase (`PREPARE`/`EXECUTE`), ficheros, mensaje, hash si EXECUTE |

## 6. Convención de commits

Conventional Commits en inglés, cuerpo opcional, **trailer obligatorio** `Task: TASK-NNN` (o `Task: none` para cambios de repositorio sin tarea, que solo hace el humano).

```
feat(persistence): add runs repository with SKIP LOCKED claim

- claimNext uses SELECT ... FOR UPDATE SKIP LOCKED
- transition enforces canTransition from core

Task: TASK-005
```

Tipos: `feat`, `fix`, `test`, `docs`, `chore`, `refactor`, `ci`, `build`. Scope = paquete o app (`core`, `persistence`, `web`, `worker`, `docker`, `docs`). Un commit por tarea salvo que el humano pida otra cosa.

## 7. Ramas

`main` protegida (fuera de Claude Code). Trabajo en `main` local en v0 (un solo desarrollador); cuando haya segunda persona o CI exija MR, se pasa a `task/TASK-NNN-<slug>` — decisión del humano, se registra aquí.

## 8. Cuando algo falla

| Situación | Qué hace el Orquestador |
|---|---|
| Tester `FAIL` | Devuelve al owner el informe TEST completo; el owner corrige **dentro del scope**; vuelta a `/verify-task`. Máximo 3 ciclos; después, humano. |
| Reviewer `CHANGES_REQUESTED` con BLOCKER/MAJOR | Igual que arriba. Los MINOR/NIT se pueden aceptar como deuda LOW si el humano lo aprueba. |
| Security `BLOCKED` | Tarea vuelve a `IN_PROGRESS`; no hay cierre posible sin `APPROVED`. |
| Hook bloquea una edición | El owner lo reporta; el Orquestador revisa el scope. Nunca se desactiva el hook. |
| Dependencia nueva necesaria | Owner lo reporta sin instalarla; humano aprueba; Orquestador añade a `deps_allowed` y relanza. |
| OPEN DECISION descubierta | `/open-decision` la registra en SPEC §13; si bloquea, tarea `BLOCKED` y se pasa a la siguiente READY. |
| Worker/DB no arranca en tests | `devops` primero; nunca se "arregla" un test para que pase sin DB. |

## 9. Cierre de sesión

Antes de terminar, el Orquestador entrega al humano (y `docs-keeper` registra en `docs/reports/SESSION-<fecha>.md` si la sesión tocó más de una tarea):

- Hecho (tareas DONE con hash de commit).
- Pendiente (tarea IN_PROGRESS y en qué punto).
- Bloqueos y OPEN DECISIONS nuevas.
- Deuda nueva.
- Estado de `git status` (limpio o qué queda sin commitear y por qué).

`task-scope.json` queda en `{"task": null, "allow": ["*"], "deps_allowed": [], "commit_allowed": false}`.

## 10. Para quien no ha usado Claude Code

```bash
make setup          # instala git hooks y comprueba herramientas
make up             # levanta el entorno Docker
make orchestrator   # abre Claude Code como Orquestador; la primera vez pega docs/CLAUDE_CODE_INITIAL_PROMPT.md
/next-task          # elige y planifica
/execute-task TASK-001
/verify-task TASK-001
/close-task TASK-001
/commit
```

Si prefieres no usar el agente de sesión, `claude` a secas carga `CLAUDE.md` con las mismas reglas, pero **sin** la restricción mecánica de `Agent(…)`: úsalo solo para consultas.
