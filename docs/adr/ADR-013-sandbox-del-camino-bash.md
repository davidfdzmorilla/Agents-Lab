# ADR-013 — Sandbox de Claude Code como primera barrera del camino Bash

| Campo | Valor |
|---|---|
| Estado | Proposed |
| Fecha | 2026-11-05 |
| Decisores | Responsable humano · architect |
| Relacionado | SPEC §13 (OD-054, OD-055, OD-056); ADR-006 §4 y Verificación; AGENTS.md §4 y §4.1; TASK-044; TASK-045; TASK-046; TASK-047; TASK-048 |

## Contexto

- ADR-006 §4 confía el camino Bash a `bash-guard.sh` (con `shell_scan.py` desde TASK-044): una criba de texto sobre la línea de comandos.
- TASK-045 agotó sus 3 ciclos de corrección (2026-11-02 a 2026-11-04). Tras cada revisión, security encontró HIGH nuevas del mismo tipo: construcciones de shell que la criba no modela, casi todas presentes ya en HEAD.
  - Revisión inicial: opción delante de `add` con un paquete `i`/`install`; asignaciones dentro de `-c` y `$( … )` con blancos.
  - Tras el ciclo 1: el desescape de heredocs, `\⏎` en heredoc y `.env` compuesto con `\\` más `` `…` ``.
  - Durante el ciclo 2: 56 aperturas por trozos pegados tras la comilla del `-c`.
  - Tras el ciclo 2: una opción con argumento tras `-c` y `eval` fuera de `$flat`.
  - Tras el ciclo 3: opción con `$( )` antes de `-c` (a), prefijo de zsh más envoltorio delante de `eval` (b) y prefijos de zsh en C1 (c).
  - Quedan además familias que exigen seguir el valor de las variables: `Y=.e; cat ${Y}nv` y el nombre de orden calculado `e$(:)val`.
- El patrón es estructural: cada arreglo léxico cierra la forma literal y deja la familia abierta. Un filtro de texto no puede ser la única capa justo cuando M2 lleva a `.env` las primeras claves reales.
- Decisión humana del 2026-11-05: cerrar TASK-045 con lo hecho y cambiar de fondo la defensa (OD-054, OD-055 y OD-056, citadas literalmente en SPEC §13).

## Decisión

1. **Primera barrera: el sandbox nativo de Claude Code** (Seatbelt en macOS) para Bash y sus procesos hijos, también dentro de los subagentes [SBX]. Se configura en `.claude/settings.json` del proyecto. Lo copia el humano (ADR-006: ningún agente edita `settings.json`).
2. **Segunda barrera: `bash-guard.sh`**, sin cambios de alcance. Sigue siendo la única capa para lo que no es acceso a ficheros (git destructivo, `-c core.hooksPath=…`, dependencias, atribución) y para los comandos excluidos.
3. **Tercera barrera, para lo excluido: `chflags -R uchg`** sobre `.claude/hooks`, `.githooks` y `.claude/settings.json`. La pone y la quita el humano a mano en cada cambio de barrera, sin target de `make`. E9 de bash-guard ya bloquea `chflags`.

### Configuración (consolida OD-054, OD-055 y OD-056)

Claves en `.claude/settings.json` (nombres verificados en [REF] y [SBX], 2026-11-05):

| Clave | Valor |
|---|---|
| `sandbox.enabled` | `true` |
| `sandbox.failIfUnavailable` | `true` |
| `sandbox.allowUnsandboxedCommands` | `false` |
| `sandbox.autoAllowBashIfSandboxed` | `false` (el valor por defecto es `true` [SBX]) |
| `sandbox.filesystem.denyRead` | `.env`, `.env.*`, `~/.config/gh`, `~/.netrc`, `~/.npmrc`, `~/.docker` |
| `sandbox.filesystem.allowRead` | `.env.example` |
| `sandbox.filesystem.denyWrite` | `.claude/hooks`, `.githooks`, `.claude/settings*.json`, `.claude/task-scope.json`, `.git/hooks`, `.git/config`, `scripts/verify-hooks.sh`, `Makefile`, `compose*.yaml`, `docker/**`, `/opt/homebrew/bin`, `~/.claude.json` y cada directorio del PATH del usuario |
| `sandbox.excludedCommands` | Solo los patrones exactos de `make` y `docker compose` que use el flujo. Cada patrón lleva su riesgo escrito en `TECHNICAL_DEBT.md` |
| `permissions.deny` (añadidos) | `Edit(~/.claude/**)`, `Edit(~/.zshrc)`, `Edit(~/.gitconfig)` y `Edit(...)` para cada directorio del PATH del usuario |

- Docker: `excludedCommands` acotados, como dice la decisión literal de OD-054. Se descarta `sandbox.network.allowUnixSockets` con el socket de Docker: según la documentación equivale a dar acceso al host [SBX, Security limitations], y además `docker` «is incompatible with the sandbox» [SBX].
- Rutas: en el sandbox, `/x` es absoluta, `~/x` cuelga del directorio personal y una ruta relativa se ancla en el directorio de trabajo principal. En las reglas `Edit(...)`/`Read(...)`, `//x` es absoluta y `/x` es relativa al proyecto [SBX, SET]. TASK-048 escribe cada entrada con la sintaxis de su capa.
- Las reglas `Read(...)`/`Edit(...)` deny se suman al sandbox [SBX]. Las de `.env` que ya están en `settings.json` pasan a ser también restricción del sistema operativo.
- `allowUnsandboxedCommands: false` en el fichero del proyecto **no** hace el sandbox «admin-required»: eso solo pasa desde managed o `--settings` [SBX]. Así que el proyecto conserva sus `excludedCommands`.
- C6 (shebang `#!/bin/bash` y PATH fijo al principio de cada hook) es trabajo de hooks y va en TASK-047 (OD-056).

### Lo que el sandbox no cubre

- Las herramientas Read, Edit, Write, WebFetch y WebSearch [SBX]. Siguen con `scope-guard.sh`, `role-guard.sh` y las reglas deny.
- Los hooks: se ejecutan con acceso completo [SBX].
- Lo que el humano teclea con `!` [SBX].
- Los comandos de `excludedCommands`: «no filesystem restrictions and no network proxy» [SBX]. Esto lo cubren `uchg` y bash-guard.
- Las órdenes que no son escritura de ficheros: `git push`, `reset --hard`, `-c core.hooksPath=…`, `pnpm add`. Sigue bash-guard.

## Alternativas consideradas

| Alternativa | Por qué se descarta |
|---|---|
| (a) Solo bash-guard, parcheando cada hueco | Tres ciclos de TASK-045 muestran que cada arreglo deja abierta la familia. El mantenimiento no tiene fin y `.env` depende de un filtro de texto |
| (c) Sandbox en managed settings (`/Library/Application Support/ClaudeCode/`) | Configuración de máquina fuera de git, que exige `sudo`. Queda como endurecimiento posterior si TASK-048 muestra que hace falta (SPEC §13, OD-054) |
| `uchg` solo si el sandbox se retrasa (b′) | El sandbox no protege lo excluido. `uchg` cubre justo ese hueco (OD-055) |
| `schg` o dueño `root` | Exigen `sudo` en cada cambio de hook y de git (descartado por el humano el 2026-10-28) |
| Docker por `allowUnixSockets` | Acceso al host por el socket. No resuelve la incompatibilidad documentada |
| Lista blanca de Write/Edit en scope-guard (OD-056 c) | Sigue siendo una capa del hook, no del sistema operativo. Queda como forma de fondo si la lista de PATH resulta frágil |

## Consecuencias

**Para ADR-006** (lo amplía; no lo sustituye):
- §4 deja de describir una sola capa para Bash. Pasa a tres: sandbox (sistema operativo), bash-guard (texto) y `uchg` (sistema de ficheros, para lo excluido). scope-guard y role-guard siguen siendo la única capa de Edit/Write, junto con las reglas deny.
- La Verificación de ADR-006 suma dos cosas: el caso `ls -lO` de `uchg` en `make verify-hooks` (TASK-047) y la matriz del sandbox (TASK-048).
- La regla «ningún agente edita `settings.json`» se mantiene. El humano copia el `settings.json` que preparan devops y security.

**Positivas:**
- Bajo el sandbox, la lectura de `.env*` y la escritura de las barreras quedan cerradas por el sistema operativo, sea cual sea la forma del comando: intérpretes, variables, heredocs, `cp -t`, `install`, `dd`, `rsync`… Así se cierran las HIGH (a), (b) y (c) de TASK-045 en su efecto, aunque TASK-047 las arregle también en bash-guard.
- Los huecos léxicos de `.env` y de escritura que hoy van a deuda se pueden reclasificar como defensa en profundidad. TASK-046 se reevalúa después de TASK-048.

**Negativas:**
- Los `excludedCommands` corren con acceso completo. `make` ejecuta el `Makefile`, `docker compose` lee `compose*.yaml`, y docker alcanza `.env` y el host (`docker run -v`, compose lee `.env` por diseño) [SBX]. Por eso hay `denyWrite` sobre `Makefile`, `compose*.yaml`, `docker/**`, `scripts/verify-hooks.sh` y `.claude/task-scope.json`: lo que ejecutan los excluidos no se edita por shell. Pero sí se puede editar con Edit/Write dentro del scope de una tarea, y el riesgo de cada patrón va a deuda.
- `uchg` es un freno, no una pared: el dueño lo quita sin `sudo`, y no lo ven `xargs`/`find -exec chflags`, `os.chflags` ni `SetFile`. Tiene que estar quitado para cualquier `git pull`/`checkout` que toque esas rutas, y un olvido rompe o desprotege. Por eso lleva su caso en la suite.
- `git checkout`/`merge` fallan con `unable to unlink old` sobre las rutas con `denyWrite` [SBX]. Sin reintento sin sandbox, esos comandos los ejecuta el humano. Esto ya es así: el humano hace pull y push.
- La red del sandbox empieza vacía. `curl` y los CLI de red preguntan o fallan. `gh` puede fallar TLS en macOS [SBX], y con `denyRead ~/.config/gh` no lee credenciales: los usos de solo lectura de `gh` desde Claude Code dejan de funcionar.
- `autoAllowBashIfSandboxed: false` mantiene el flujo de aprobación actual. No hay menos preguntas.

**Riesgos:**
- R1 · docker y los excluidos: lo dicho arriba. Es deuda permanente mientras docker sea incompatible con el sandbox. La mitigan bash-guard, `uchg` y el `denyWrite` de los ficheros que ejecutan.
- R2 · patrones de `excludedCommands` demasiado anchos: `make *` saca del sandbox cualquier target, incluidos los futuros. Cada patrón tiene que ser exacto, y su lista es el DoD de TASK-048.
- R3 · `.claude/settings.local.json` (gitignorado, existe en disco) está por encima del fichero del proyecto en precedencia [SET]. Un `sandbox.enabled: false` allí apaga el sandbox. Por Bash lo protegen las rutas protegidas por defecto y `denyWrite .claude/settings*.json`. Por Edit/Write, hoy solo hay reglas deny para `.claude/settings.json` (pregunta abierta 4).
- R4 · fallo abierto si se pierde la configuración: lo cubre `failIfUnavailable: true`. Una sesión lanzada con `--settings` puede cambiar las claves.

### Preguntas abiertas (para TASK-048; no se resuelven aquí)

1. ¿El scratchpad `/private/tmp/claude-501/…` es el «per-user temp directory» escribible? La documentación dice que Claude Code fija `$TMPDIR` a ese directorio [SBX], pero no que coincida con el scratchpad.
2. ¿Los PreToolUse (bash-guard) se ejecutan igual antes de un comando con sandbox? No consta en la documentación.
3. ¿`allowRead .env.example` reabre la lectura aunque `.env.*` de `denyRead` lo cubra? La documentación dice que `allowRead` «re-allows reading specific paths within a `denyRead` region» [SBX]. Se comprueba en la matriz.
4. ¿Hace falta `Edit(.claude/settings.local.json)` deny (R3), y es compatible con que Claude Code guarde ahí las aprobaciones «Yes, and don't ask again» [SET]? Lo decide el humano.
5. ¿Qué lista exacta de directorios del PATH, y qué patrones exactos de `make`/`docker compose`? (DoD de TASK-048).

## Verificación

**TASK-047** (owner humano, prioritaria):
- los arreglos de las HIGH (a), (b) y (c) de TASK-045 en bash-guard;
- C6;
- `uchg` puesto en las tres rutas, con un caso en `scripts/verify-hooks.sh` que falle si alguna no muestra `uchg` en `ls -lO`;
- el procedimiento de puesta y retirada en AGENTS.md §4.

**TASK-048** (devops + security preparan; el humano copia `settings.json`; antes de M1). Evidencia: estos comandos, ejecutados de verdad dentro del sandbox, fallan con EPERM:
- los de las HIGH (a), (b) y (c) de TASK-045;
- los 78 de la lista de TASK-044 que escriben barreras o leen `.env`;
- `touch ~/.zshrc`, una escritura en `.githooks/x` y en `~/.claude.json`, y la lectura de `~/.netrc`.

En la misma sesión tienen que funcionar:
- `cat .env.example`;
- los `make`/`docker compose` excluidos;
- `make verify-hooks`, `git status`/`add` y `git commit` vía /commit con pre-commit;
- escritura en el scratchpad;
- WebFetch.

Si la prueba rompe docker, pnpm (dentro del contenedor) o el scratchpad, la tarea se para y vuelve a SPEC §13. El sandbox no se relaja sobre la marcha.

## Fuentes (consultadas el 2026-11-05, Claude Code 2.1.318 instalado)

- [SBX] https://code.claude.com/docs/en/sandboxing: claves `sandbox.enabled`, `sandbox.failIfUnavailable`, `allowUnsandboxedCommands`, `autoAllowBashIfSandboxed` (por defecto `true`), `sandbox.excludedCommands` (casa por texto; «a script or `make` target that calls `docker` internally doesn't match»), `sandbox.filesystem.allowWrite`/`denyWrite`/`denyRead`/`allowRead`, `network.allowUnixSockets` (y su riesgo con `/var/run/docker.sock`); rutas protegidas por defecto; lo que queda fuera del sandbox; sandbox «admin-required»; sintaxis de rutas; `unable to unlink old`.
- [REF] https://code.claude.com/docs/en/settings-reference: índice con ámbito «Any file» para `sandbox.enabled`, `sandbox.failIfUnavailable`, `sandbox.allowUnsandboxedCommands`, `sandbox.autoAllowBashIfSandboxed`, `sandbox.excludedCommands`, `sandbox.filesystem.{allowWrite,denyWrite,denyRead,allowRead}`, `sandbox.network.allowUnixSockets` y `sandbox.network.allowAllUnixSockets`.
- [SET] https://code.claude.com/docs/en/settings: precedencia (managed > línea de comandos > local del proyecto > proyecto > usuario), listas que se combinan y `.claude/settings.local.json`.
