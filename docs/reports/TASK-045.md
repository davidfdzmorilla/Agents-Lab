# TASK-045 — Informe de cierre

| Campo | Valor |
|---|---|
| Tarea | TASK-045 · Volcados con redirección, `pnpm -F/-C … add` y destinos de escritura dinámicos |
| Hito | M0 posterior al cierre |
| Owner | humano (ADR-006: ningún agente edita barreras; verifican `tester`, `reviewer` y `security`) |
| Dependencias | TASK-044 (DONE) |
| Fecha | 2026-11-05 |
| Plan | `/Users/davidferanandezmorilla/Desktop/development.nosync/agentlab/docs/reports/TASK-045-plan.md` (architect; 4 007 líneas: plan original, CC1, CC2, CC2.20 y CC3). Citado, no copiado. |
| Veredictos finales | **TEST PASS · REVIEW APPROVED · SECURITY BLOCKED** |

> **SECURITY BLOCKED: security no aprobó esta tarea.** El cierre es una decisión humana del 2026-11-05 tomada tras agotar los tres ciclos de corrección. No es el cierre ordinario de `docs/AGENTS.md` §4, que exige security APPROVED.

## 1. Decisión de cierre (literal)

Registro de `docs/TASKS.md`, entrada del 2026-11-05 (decisión humana tras agotar los 3 ciclos):

«Opción 1: cerrar TASK-045 con lo que ha pasado (cierra los dos huecos del ciclo 2, sin regresiones) y abrir TASK-047 para (a), (b) y (c), prioritaria, deuda HIGH con tarea propia, con los arreglos de security como plan y el mismo método (suite, comparación con el ciclo anterior, COPY.md).»

## 2. Resumen del cierre

- **Cierra:** N-2 (TD-062, volcados con redirección), N-3 (TD-063, `pnpm -F/-C/--dir/--prefix … add`) y TD-061 (destinos de escritura calculados; X12, entradas 77 y 78). TD-061, TD-062 y TD-063 pasan a `PAID (TASK-045)`.
- **No cierra:** los HIGH (a), (b) y (c) de security del ciclo 3. Quedan registrados como TD-111, TD-112 y TD-113, con pago en TASK-047.
- **Regresiones:** ninguna. TEST y REVIEW del ciclo 3 dan 0 BLOCK→PASS frente a TASK-044 (t44), G7, BR, QR y GL. SECURITY del ciclo 3 confirma que «el ciclo no tiene regresiones». Frente a HEAD hay 82 BLOCK→PASS, que son las 76 excepciones aceptadas más 6 de OD-45h.
- **Suite:** `make verify-hooks` con EXIT 0, 790 OK / 0 FAIL.
- **DoD 8:** cumplido con el reparto de las 14 MEDIUM de TASK-044 (decisión del 2026-11-05, ver §8).

## 3. Estado del disco y verificación

- md5 finales: `bash-guard.sh` b0fd0b8a…, `shell_scan.py` 0f3822fe…, `verify-hooks.sh` 3859846f…. `lib.sh` f66d6aad… y `settings.json` 2b5ebc02… sin cambios.
- ADR, ARCHITECTURE y SPEC sin cambios (DoD 7).
- Dependencias nuevas: ninguna.

## 4. IMPLEMENTATION (evidencia por referencia)

La implementación la copió el humano por pasos (ADR-006); no hay un fichero IMPLEMENTATION. La evidencia es:

- Registro de cambios de `docs/TASKS.md`, entradas del 2026-11-02 al 2026-11-04: copias de `t045/COPY.md` (14 pasos), `t045c1/COPY.md` (16 pasos), `t045c2/COPY.md` (9 pasos) y `t045c3` (6 pasos, con `run-c3.sh`). Cada paso tiene md5, recuento OK/FAIL y EXIT observados.
- Logs de la copia: `S/t045/` (14 `vh-<paso>.log`), `S/t045c1/`, `S/t045c2/logs/` y `S/t045c3/logs/`. `S` es `/private/tmp/claude-501/-Users-davidferanandezmorilla-Desktop-development-nosync-agentlab/3fa7c665-c570-4833-afbe-b934a451dd31/scratchpad`.

## 5. PLAN

Citado, no copiado: `/Users/davidferanandezmorilla/Desktop/development.nosync/agentlab/docs/reports/TASK-045-plan.md`. Contiene el plan original, el ciclo 1 (CC1, desde su línea 1370), el ciclo 2 (CC2, desde 2207), la adenda CC2.20 y el ciclo 3 (CC3, desde 3258). OD de plan en §14.

## 6. Informes íntegros

Orden: revisión inicial, ciclo de corrección 1, ciclo de corrección 2 y ciclo de corrección 3. Cada bloque es la copia íntegra del informe, sin cambios.

### 6.1 Revisión inicial

#### 6.1.1 TEST (revisión inicial)

## TEST — TASK-045 — 2026-11-02
(Copia del informe del tester guardada por el Orchestrator.)

**Veredicto global: PASS** (DoD 1–7 ✅; el 8 es del cierre).
- md5 disco = §9 (a7b4645d…, 439e5184…, 0d2d8c85…; lib.sh f66d6aad…, settings.json 2b5ebc02… sin cambios). `bash -n` OK (bash 3.2), `ast.parse` OK.
- `make verify-hooks` real, una vez (74 s): EXIT=0, 546 OK / 0 FAIL. Log `scratchpad/t045-tester-vh.log` (554 líneas; recontado por el Orchestrator). Los 450 de TASK-044 siguen en OK (`comm` vacío frente a `t044-c3-tester-vh-E11.log`); 96 OK nuevos.
- Diferencial (runner `t045-tester/run.py`, corpus `arch045/c45_final.jsonl` 27 707, md5 ff0b6121…):
  - t44=B→disco=P: 0 (27 531 + 176 rutas absolutas reescritas a `t045-tester/fr_*`).
  - HEAD=B→disco=P: 82 = 76 + 6 de OD-45h.
  - t44=P→disco=B: 195. Timeouts: 0.
  - Desviación: tres hooks ejecutados en 8 000 casos (aa, ab); en ac–ag (19 707) solo disco, HEAD y t44 tomados del corpus grabado (coinciden en los 8 000 salvo `rm -rf <arch045/fr_core>`, ruta absoluta al repo falso). Motivo: carga 200–290.
- X12 (77, 78): HEAD/t44/disco = B/P/B, motivo «destino de escritura que se calcula al ejecutar … o que monta una barrera alrededor de una variable». Las 76: B/P/P.
- DoD 1: los 5 literales N-2 bloquean (+ `env &> f`, `{ env; } > f`, `declare -px >> …`, `export -p 2>&1 | tee x`).
- DoD 2: `pnpm -F core add x`, `-C`, `--dir`, `--prefix`, `-F core i x`, `yarn workspace core add x`, `npm --prefix pkg install left-pad` bloquean; `pnpm -F core add zod` con `deps_allowed=["zod"]` pasa.
- DoD 3: bloquean `> $(…)`, `` > `…` ``, `> {a,b}`, `> $X/.claude/hooks/…`, `> ${X}/.githooks/…`, `> "$X/settings.json"`, `> $X/.git/config`, `> $X/task-scope.json`, `> ${X:-/tmp}/y`, `> packages/core/*`, `X=.claude/hooks; > $X/…`, `>> $(pwd)/.claude/task-scope.json`. Pasan `> "$LOG"`, `> $TMPDIR/x.log`, `> ${TMPDIR}/x.log`, `f=$(mktemp); … > "$f"`.
- DoD 5: 15 controles de uso diario en P (`pnpm -F core test`, `pnpm -C packages/core build`, `make test 2>&1 | tail`, `env FOO=1 pnpm test 2>&1 | tail`, `printenv PATH`, `(( n > 1 ))`, `[[ $a > $b ]]`, `> /dev/null 2>&1`, `git status 2>&1 | head`…).
- DoD 7: `git diff --stat` solo hooks, verify-hooks, task-scope.json, TASKS.md; untracked el plan.
- 7 FP de §11 bloquean y sus alternativas pasan (`pnpm -r test > $(mktemp)` no probado literal; `echo x > $(mktemp)` sí).
- Error de expectativa en `alt45.jsonl`: `(( a > b * 2 ))` marcado P pero bloquea ya en HEAD y t44 (FP previo documentado en §11).
- Rendimiento (carga 215): típico 0,25 s sin cambio; peor caso 1,38→1,46 s; laboratorio 199×env 3,07→4,93 s, 7 000×for 1,34→2,08 s. < 10 s.
- task-scope.json md5 7e93a1b2… antes y después; sin `__pycache__`.
- Bloqueos literales: «BLOCKED by bash-guard: escritura por shell en 'an.py' fuera del scope de la tarea. Usa Edit/Write dentro del scope o repórtalo.» y el mismo con 't045-tester/old.txt' (rutas relativas; repetido con absolutas / Edit).
- Hallazgos y deuda: ninguno. OD: ninguna.

#### 6.1.2 REVIEW (revisión inicial)

## REVIEW — TASK-045 — 2026-11-02
(Copia del informe del reviewer guardada por el Orchestrator.)

**Veredicto: CHANGES_REQUESTED.** Lo copiado es byte a byte lo del plan; el cambio aprobado abre un BLOCK→PASS en dependencias (DoD 5, ADR-006).

Byte a byte (propio, desde `git show 71f9fe4:`): 16 diffs del plan (sin la variante a) con las md5 de §9; cadena con `patch -o` rc=0 sin fuzz; md5 por paso = §9; `cmp` = disco en los tres: bash-guard a7b4645d… (545), shell_scan 439e5184… (608), verify-hooks 0d2d8c85… (728). lib.sh y settings.json sin cambios. verify-hooks: 66 blocks + 30 passes.

Hallazgos:
- [BLOCKER] `bash-guard.sh:203`, `:210`: `sed -E "s/$deps_re//"` toma la coincidencia más larga; con la alternativa nueva (opción + valor), `-w add` se lee como opción con valor, `i` pasa a subcomando y el paquete no se revisa. Pasan con `deps_allowed: []`: `pnpm -w add i`, `pnpm -w add add`, `pnpm -w add install`, `pnpm -w i add`, `pnpm -D install add`, `npm -g i install`, `pnpm -w add i 2>&1 | tail`; con `["lodash"]`, `pnpm -w add i lodash`. HEAD y t44 bloquean. Corrección: paquetes desde la primera palabra `add|i|install` alcanzable (lectura más corta); casos `blocks`. **Reproducido por el Orchestrator** sobre el disco (rc=0 en `pnpm -w add i`, `pnpm -w add install`, `npm -g i install`).
- [MAJOR] `shell_scan.py:99`: la nota 1 no marca la asignación al principio de un `-c`: el lookbehind de `ASSIGN` no admite `'` ni `"`; `:434/551/555` solo heredan `self.tainted`. Pasan (también con `allow=*`): `bash -c 'X=.claude/hooks/lib.sh; echo x > $X'`, `zsh -c "S=.claude/settings.local.json; echo x > \$S"`, `bash -c 'for f in .githooks/*; do echo x > "$f"; done'`. Con `true; ` delante bloquea. Contradice §8.4 (DoD 3, nota 1). Corrección: añadir `'"` a la clase o `Scan(body, self.tainted | taint(body))`; casos. **Reproducido por el Orchestrator** (rc=0 en el primero, con el scope de la tarea, que no incluye lib.sh).
- [MINOR] `shell_scan.py:384`: modificador zsh sin llaves cuenta como variable simple (`$X:h`, `$X:s/a/b/`, `$X:a`). `X=.claude/hookz; echo x > $X:s/z/s//scope-guard.sh` pasa; comprobado en zsh que escribe la ruta sustituida. Corrección: `:` + letra tras VAR → Dynamic.
- [MINOR] `shell_scan.py:324`: grupo de glob zsh a mitad del destino pasa con `allow=*` (`echo x > ./.claude/hook(s)/scope-guard.sh`); ya pasaba en t44; fuera de `*?[` de OD-45c. Corrección: `(` que corta la palabra de destino → Dynamic. Severidad, a security.
- [MINOR] `shell_scan.py:52/311`: `BRACES` cuadrática: `echo x > {` + n puntos: 20 000 → 5,9 s; 40 000 → 22 s; 64 000 → 83 s (t44 0,86 s). Supera el timeout de 10 s (fallo cerrado solo por `onFailure: block`, como TD-102); contradice §12. Corrección: `re.finditer(r"\{([^{}]*)\}")` + `,`/`..` (0,002 s con 64 000).
- [MINOR] `shell_scan.py:79`: `normpath` sobre el literal unido resuelve `..` a través de la variable: `X=.; Y=/hooks; echo x > $X/.git$Y/../config` pasa con `allow=*`. Familia de evasión deliberada (§8.4). Corrección: trozos también sobre el texto sin normalizar.
- [NIT] `S/arch045/alt45.jsonl:7`: espera P para `(( a > b * 2 ))`, que bloquea en HEAD y t44; §3.8 y §11 correctos.

Sin hallazgos: G1 awk (bloquea `env>f`, `env 1>&2`, `env 3<>f`, `printenv>/dev/null`, `declare -p > f`; pasan `printenv PATH>f`, `env NODE_ENV=… 2>&1|tail`, X10 con `<(:)`); estado 5 falla cerrado; `python3 -I`, stdlib, comentarios en inglés; casos por familia.

Cumplimiento: SPEC ✅ · ARCHITECTURE ✅ · ADRs ❌ (ADR-006) · DoD ❌ (5 por el BLOCKER, 3 por el MAJOR; 7 ✅) · plan ✅ en lo copiado, ❌ en §3.2, §8.4 y §12.

Deuda propuesta si los MINOR no se corrigen: modificadores zsh sin llaves (LOW, TASK-046); grupo `( )` a TD-083 (MEDIUM); BRACES cuadrática (LOW, TASK-046 con TD-102); normpath a través de la variable (LOW, OD-054/055).

Requiere security: sí (BLOCKER y grupo `( )` con `allow=*`).

Bloqueos literales: (1) «destino de escritura que se calcula al ejecutar (sustitución, llaves, expansión o comodín) o que monta una barrera alrededor de una variable: no se puede revisar; escribe la ruta literal (una variable sola, > "$LOG", sí se admite)» (`git show … > $S/…/bash-guard.sh`; repetido con ruta literal); (2) «expansión indirecta o eval no permitidos (podrían exponer secretos por nombre compuesto)» (heredoc con `eval`; reescrito sin `eval`); (3) «escritura por shell en 'd/hooks/f' fuera del scope de la tarea…» (`mkdir … && cd … && printf > d/hooks/f`; separado y con `cd <ruta literal> &&`).

Desviación: `zsh -f -c` en `S/rv045/z/` (ficheros falsos) para confirmar los huecos de zsh. Ficheros en `S/rv045/`.

#### 6.1.3 SECURITY (revisión inicial, antes del ciclo 1)

## SECURITY — TASK-045 (antes del ciclo de corrección 1) — 2026-11-02
(Copia del informe de security guardada por el Orchestrator.)

**Veredicto: BLOCKED** (2 HIGH). Hashes del disco = encargo; lib.sh, settings.json, ADR, ARCHITECTURE, SPEC sin cambios (DoD 7 ✅). Sin dependencias nuevas.

### Para el ciclo 1
- **HIGH-1** `bash-guard.sh:203/:210` (BLOCKER confirmado, regresión, DoD 5, ADR-006): coincidencia más larga de `sed "s/$deps_re//"`. Familia: cualquier opción booleana delante + paquete `i`/`install`/`add`. Pasan con `[]`: `pnpm -r add i`, `pnpm --save-dev add i`, `bun -d add i`, `yarn -W add i`, `pnpm -w add -D i`, `pnpm -w install i`, `pnpm -D add install`, `pnpm -F core --workspace-root add i` (este también en HEAD). Corrección: paquetes desde la primera palabra `add|i|install` (awk) y quitar `glued`. Cierra los 11, no abre ninguno; con `["lodash"]` siguen pasando `pnpm -w/-F core/-C dir add lodash`.
- **HIGH-2** `shell_scan.py:434/:551/:555/:100`: nota 1 incompleta, con tarea activa.
  - (a) cuerpos `-c`: `bash -c 'X=.claude/hooks/lib.sh; echo x > $X'`, `sh -c`, `zsh -c "S=…; echo x > \$S"`, `env bash -c`, `command bash -c`, `bash -c $'X=…'`, `bash -lc`, `echo x | bash -c '…; cat > $X'`, `bash -c 'for f in .githooks/*; do echo x > "$f"; done'`. Corrección: `Scan(body, self.tainted | taint(body))` en los tres sitios.
  - (b) valor con `$( … )` con blancos: `F=$(git rev-parse --show-toplevel)/.claude/settings.json; echo x > "$F"`. Corrección: `` \$\([^()]*\)|`[^`]*`| `` en `WORD`.
- **MEDIUM-1** `shell_scan.py:550-553`: heredoc sin comillas a un shell no desescapa `\$`. Con `allow=*`: `X=.claude/hooks/lib.sh bash <<E⏎echo x > \$X⏎E`. **Hueco previo de `.env`** (HEAD, t44, disco): `bash <<E⏎cat \\.env⏎E` pasa. Corrección: si `not h["quoted"]`, `body = re.sub(r'\\([$`\\\n])', r"\1", body)` antes del `Scan`.
- **MEDIUM-2** `shell_scan.py:43-45`: faltan `scope-guard`, `role-guard`, `commit-msg` en `BARRIER`. `cd .claude/hooks && echo x > "$PWD/role-guard.sh"` pasa con tarea activa (también en HEAD).
- **MEDIUM-3** `shell_scan.py:375`: grupo `( )` zsh a mitad del destino (`> .claude/hoo(ks)/bash-guard.sh`, `.clau(de)/…`, `.githook(s)/pre-commit`) con `allow=*`. Deliberado, no regresión. Corrección: `(` que corta la palabra (salvo `=(`, `>(`, `<(`) → Dynamic. FP nuevo: `echo x > apps/web/x(N)`, aceptable.
- **MEDIUM-4** `shell_scan.py:384-386`: modificador zsh sin llaves (`X=.claude/hookz; echo x > $X:s/z/s//scope-guard.sh`), con tarea activa. Corrección: `:[A-Za-z&]` tras VAR → Dynamic.
- **LOW** `shell_scan.py:52/:311`: `BRACES` cuadrática; hook con `{`+64 000 `.`: 37,2 s disco, 1,13 s prototipo; falla cerrado por `onFailure: block`. Corrección: `\{([^{}]*)\}` + `,`/`..`.

### Deuda (no entra)
- MEDIUM: `.git/config` vía variable (`X=.git; echo x > $X/config`, `GIT_DIR=$(git rev-parse --git-dir); echo x >> "$GIT_DIR/config"`), también en HEAD; riesgo `core.hooksPath`; OD-054/055 o «/» final en `barrier()` + `/config`.
- MEDIUM: `cd` a variable marcada + escritura relativa (`X=.claude/hooks; cd "$X" && echo x > lib.sh`, solo `allow=*`) → TD-083.
- MEDIUM: `tee`/`cp`/`sed -i` con variable marcada (`f=.claude/settings.json; sed -i '' s/a/b/ "$f"`) → OD-45f, no se reabre.
- LOW: variables deliberadas (`Y=$X`, `read`, `printf -v`, `: ${X:=…}`, `set --`, `$_`), arrays, `for f (…)`, `select`; `normpath` a través de la variable (OD-054/055).
- LOW: volcados deliberados `env <<< x`, `env {fd}>f`; siguen TD-109 y TD-092.
- LOW previos, dependencias: `npm in|it|isntall|install-test x`, `yarn global add x`, `pnpm -F c exec pnpm add x`, `corepack pnpm add x` (TD-068).

### Verificado sin hallazgos
G1 frente a `proto3e`: 79 casos, solo difieren `printenv >(cat)` y `printenv <(:) PATH` (buscado con OD-45a b). Bloquean `env|tee`, `printenv > >(…)`, `set > f`, `declare -x > f`, `typeset`, `1>|`, `>!`, `&>>`, `{ env; } > f`, `exec/command/nohup env > f`, `env > "$LOG"`, `env <&-`. Pasan `printenv PATH > f`, `env NODE_ENV=… cmd 2>&1|tail`, `set -o > f`. Estado 5 falla cerrado. Ningún camino nuevo abre `.env` ni secretos. Corpus: sin BLOCK→PASS fuera de 76 + 6.

### Casos para el tester
- `[]` → «no autorizada»: `pnpm -w add i`, `pnpm -r add install`, `npm -g i install`, `pnpm --save-dev add add`, `pnpm -F core --workspace-root add i`.
- `["lodash"]`: pasan `pnpm -w add lodash`, `pnpm -F core add lodash`; bloquea `pnpm -w add i lodash`.
- Tarea activa → «destino de escritura»: `bash -c 'X=.claude/hooks/lib.sh; echo x > $X'`, `sh -c 'X=.githooks/pre-commit; echo x > "$X"'`, `zsh -c "S=.claude/settings.local.json; echo x > \$S"`, `bash -c $'X=.claude/hooks/lib.sh; echo x > $X'`, `bash -c 'for f in .githooks/*; do echo x > "$f"; done'`, `F=$(git rev-parse --show-toplevel)/.claude/settings.json; echo x > "$F"`, `cd .claude/hooks && echo x > "$PWD/role-guard.sh"`, `X=.claude/hookz; echo x > $X:s/z/s//scope-guard.sh`.
- `allow=*` → bloquean: `X=.claude/hooks/lib.sh bash <<E⏎echo x > \$X⏎E`, `echo x > .claude/hoo(ks)/bash-guard.sh`, `echo x > ./.claude/hook(s)/scope-guard.sh`.
- Core: `bash <<E⏎cat \\.env⏎E` bloquea por `.env`.
- Pasan: `bash -c 'f=$(mktemp); echo x > "$f"'`, `bash -c 'LOG=/tmp/claude-scratch/l; echo x > "$LOG"'`, `F=$(git rev-parse --show-toplevel)/README.md; wc -l "$F" > /tmp/claude-scratch/n`, `echo x > >(cat)`, `echo x > =(:) apps/web/x` (`allow=*`).
- Rendimiento: `echo x > {` + 64 000 `.` < 10 s.

### Evidencia
Prototipo `scratchpad/sec045/p/bash-guard.sh` (8d29d42b…) y `p/shell_scan.py` (f0c730a6…); diffs `sec045/proto-bash-guard.diff`, `sec045/proto-shell_scan.diff`. verify-hooks en sandbox: disco 546/0/0, prototipo 546/0/0. Corpus 27 707 con el prototipo (`sec045/cres.jsonl`): 76/76 en PASS; 0 BLOCK→PASS reales (103 son rutas absolutas al fake-root antiguo); bloqueos nuevos: 2 `( )` sobre barreras + FP `> x(N)`.

Bloqueos literales: «destino de escritura que se calcula al ejecutar (sustitución, llaves, expansión o comodín) o que monta una barrera alrededor de una variable: no se puede revisar; escribe la ruta literal (una variable sola, > "$LOG", sí se admite)» (dos veces, `cat … > $D/p/lib.sh` y `… > $D/fr/.claude/task-scope.json`; rehecho con Python y rutas como argumentos).
Desviaciones: verify-hooks solo en sandbox; corpus con runner propio en segundo plano de la herramienta (sin `&`); `=(:) apps/web/x` recomprobado a mano tras afinar el prototipo.

### 6.2 Ciclo de corrección 1

#### 6.2.1 TEST (ciclo de corrección 1)

## TEST — TASK-045 (ciclo de corrección 1) — 2026-11-03
(Copia del informe del tester guardada por el Orchestrator.)

**Veredicto: PASS** (DoD 1–7). Salvedad: diferencial completo (27 707) no terminó en 75 min por la carga (~330); sustituido por una muestra determinista de 6 927 (uno de cada cuatro) con 4 versiones.

- md5 disco = CC1.13 (bash-guard 8d29d42b…, shell_scan f0c730a6…, verify-hooks 619f3192…, lib.sh f66d6aad…, settings.json 2b5ebc02…); task-scope.json ef76050e… igual antes y después. `bash -n` y `ast.parse` OK; sin `__pycache__`.
- `make verify-hooks` real, una vez: EXIT=0, 610 OK / 0 FAIL (`S/t045c1-tester-vh.log`, recontado por el Orchestrator). Los 546 de G7 (y los 450 de TASK-044) siguen en OK (`comm`). Comprobación de tiempo de BRACES pasó dentro de la suite. X12 en la suite como `blocks` (`verify-hooks.sh:633-634`, `:762-763`).
- DoD 1 ✅ (N-2 literales bloquean); 2 ✅ (`-F`, `-C`, `--dir`, `--prefix` con `[]`); 3 ✅ (13/13); 4 ✅ (X12 B en disco, G7 y HEAD; P en t44); 5 ✅; 6 ✅; 7 ✅ (`git diff --stat` solo los 3 ficheros + task-scope + TASKS.md; sin `h1segs.txt`).
- Diferencial (muestra 6 927, `S/t045c1-tester/ch/r_s_*.jsonl`, 0 timeouts): disco vs G7 0 diferencias (la muestra no contiene casos del ciclo; probados a mano); vs t44 0 B→P, 54 P→B (TD-061/062/063); vs HEAD 22 B→P = 21 de las 76 + `printenv x$(:) FOO_API_KEY` (OD-45h). Las 76: 76/76 en PASS (`ex78_r.jsonl`). Sin FP nuevos de uso diario frente a G7.
- A mano (`own_r.jsonl`, `lod_r.jsonl`; 75 casos × 4 versiones): con `[]` bloquean `pnpm -w add i`, `pnpm -r add install`, `npm -g i install`, `pnpm --save-dev add add`, `pnpm -F core --workspace-root add i`, `pnpm -w add add`, `pnpm -w i add`, `yarn -W add i`; pasan `pnpm install --frozen-lockfile`, `pnpm -F core test`, `pnpm -w install`, `pnpm -F core exec vitest -t add`. Con `["lodash"]` pasan `pnpm -w add lodash`, `pnpm -F core add lodash`, `pnpm -C packages/core add -D lodash`, `pnpm add lodash@4.17.21 2>&1 | tail`; bloquean `pnpm -w add i lodash`, `pnpm -F core add lodash zod`. Tarea activa: bloquean `bash -c`/`sh -c`/`zsh -c`/`bash -c $'…'` con asignación, `for f in .githooks/*` dentro de `bash -c`, `F=$(git rev-parse --show-toplevel)/.claude/settings.json; …`, `role-guard`/`scope-guard`/`commit-msg` vía `$PWD`, `$X:s/z/s/` (G7 y t44 pasaban los 10). `allow=*`: bloquean heredoc con `\$X`, `hoo(ks)`, `hook(s)`. `bash <<E⏎cat \\.env⏎E` bloquea por `.env`. Pasan los casos benignos de security. FP de CC1.15 bloquean y sus alternativas pasan.
- Rendimiento (load ~330): típico 0,26 s; `> {` + 64 000 `.` 1,72 s (G7 54,33 s); `env A=1 pnpm x 2>&1` × 199 8,74 s (G7 9,53 s, t44 3,88 s) — margen estrecho frente a 10 s, no empeora frente a G7.
- Bloqueos: ninguno. Desviaciones: pasada completa en segundo plano de la herramienta cortada con `pkill` sobre su `run.py`; un lote «lodash» repetido por error de scope propio.
- Hallazgos: ninguno. OD sugerida: margen de `env … 2>&1` × 199. Pendiente sugerido: diferencial completo con la máquina tranquila.

#### 6.2.2 REVIEW (ciclo de corrección 1)

## REVIEW — TASK-045 (ciclo de corrección 1) — 2026-11-03
(Copia del informe del reviewer guardada por el Orchestrator.)

**Veredicto: CHANGES_REQUESTED.** Código byte a byte el del plan; los 5 hallazgos suyos del ciclo, cerrados. Pero M1 abre un BLOCK→PASS frente a G7 (con `allow=**`) y la variante `.env` de MEDIUM-1 sigue abierta (MAJOR). Frente a HEAD y t44, 0 BLOCK→PASS.

Byte a byte: 16 diffs de CC1 extraídos (`S/rv045c1/extract.py`), md5 = CC1.13; `patch -o` desde su G7 rc=0, sin fuzz; md5 por paso = CC1.13; `cmp` = disco y = `S/sec045/p/`. Líneas 545/615/836. `bash -n`, `ast.parse` OK; stdlib. Sin cambios en ADR/ARCHITECTURE/SPEC.

Hallazgos anteriores (t44 · G7 · final):
- [x] BLOCKER: bloquean `pnpm -w add i`, `-w add add`, `-w add install`, `-w i add`, `-D install add`, `npm -g i install`, `… 2>&1 | tail`, `--filter=core add i`, tabuladores, y con `["lodash"]` `pnpm -w add i lodash`. Pasan `pnpm install --frozen-lockfile`, `-w install`, `-F core exec vitest -t add`. `bash-guard.sh:209`.
- [x] MAJOR nota 1 en `-c`: bloquean (también `allow=**`) `bash -c 'X=…lib.sh; echo x > $X'`, `zsh -c "S=…; … \$S"`, `for f in .githooks/*` en `bash -c`, `-c` anidados, `X=".claude/hooks"/lib.sh`. `shell_scan.py:439`, `:558`, `:562`.
- [x] MINOR zsh: bloquean `$X:s/z/s//x.sh`, `"$X:h/y"`; pasa `${X}:h`. `shell_scan.py:389`.
- [x] MINOR `( )`: bloquean `hook(s)` con `>`, `2>`, `&>`, `<>`, `>|` y `".claude/hook"(s)`; pasan `>(cat)`, `=(:)`. `shell_scan.py:376`.
- [x] MINOR BRACES: `> {` + 64 000 `.` 0,61 s. `shell_scan.py:312`.
- MINOR `normpath`: sigue, deuda LOW (OD-054/055), como decidido.
- [x] NIT `alt45.jsonl:7` corregido.

Nuevos:
- [MAJOR] `shell_scan.py:557` («`body = re.sub(r'\\([$`\\\n])', r"\1", body)`») y su gemela en `:438`: el desescape convierte `\\$X` en `\$X` y el subescáner lo trata como `$` escapado; el shell exterior deja `\` y expande `$X`. Confirmado en zsh y bash con ficheros falsos.
  - BLOCK en G7, PASS en final (`allow=**`): `X=.claude/hooks/lib.sh; bash <<E⏎echo x > \\$X⏎E` (también `sh`, sin espacio, `X=… bash <<E`), `` bash <<E⏎echo x > \\`echo .claude/hooks/lib.sh`⏎E ``. Contradice CC1.14.
  - MEDIUM-1 sigue abierto con el scope normal (PASS también en HEAD): `` bash <<E⏎cat .e\\`echo n`v⏎E `` y `` bash -c "cat .e\\`echo n`v" `` leen `.env`.
  - Previo (HEAD): `X=…lib.sh; bash -c "echo x > \\$X"` (`allow=**`).
  - Corrección: con `\\` justo antes de `$` o `` ` ``, quitar la `\` resultante (p. ej. `\\\\(?=[$`])` → "" antes de la general, misma pasada) o bloquear con número par (≥2) de `\` antes de `$`/`` ` ``. Casos: los cuatro en `blocks`; `\\\$X` (impar) en `passes`.
- [MINOR] `shell_scan.py:101` (H2b): `X=.git/$(printf "refs\057heads")/../../config; echo x > $X` BLOCK en G7, PASS en final y HEAD (= `.git/config`). No abre nada nuevo: `X=.git; echo x > $X/config` ya pasa (MEDIUM de security, OD-054/055).
- [NIT] `bash-guard.sh:199-202`: el comentario no explica por qué se lee desde la primera `add|i|install` (CC1.19).

Rendimiento de las regex nuevas < 0,35 s. Casos de verify-hooks por hallazgo y paso. FP de OD-45i como se esperaba; `pnpm --filter=i add lodash` pasa.

Cumplimiento: SPEC ✅ · ARCHITECTURE ✅ · ADRs ✅ · DoD 1, 2, 4, 6, 7 ✅; 5 ✅ frente a HEAD y t44; 3 ❌ (MEDIUM-1 y nota 1 en heredoc) · plan ✅ en lo copiado, ❌ en CC1.14 (M1).
Deuda propuesta: LOW `.git/config` por `normpath` + `$( )` con blancos (dentro de la MEDIUM de OD-054/055); LOW comentario del `awk` (TASK-046); `normpath` LOW ya decidida.
Requiere security: sí.
Bloqueo literal: «mkdir to '/Users/davidferanandezmorilla/Desktop/development.nosync/agentlab/.claude/hooks' was blocked by a deny rule.» (`cd <scratchpad>/z && mkdir -p .claude/hooks`; repetido con rutas neutras).
Desviaciones: bash y zsh reales (`-f`/`--norc`) sobre ficheros falsos en `S/rv045c1/z/`; ningún proceso vivo al terminar.

**Reproducción del Orchestrator** (scope de la tarea, allow = los 3 ficheros; `orc045/probe2.py`): `X=.claude/hooks/lib.sh; bash <<E⏎echo x > \\$X⏎E` rc=2 (bloquea por scope; el PASS del reviewer es con `allow=**`); `` bash <<E⏎cat .e\\`echo n`v⏎E `` rc=0 y `` bash -c "cat .e\\`echo n`v" `` rc=0 (confirmado: pasan).

#### 6.2.3 SECURITY (tras el ciclo de corrección 1)

## SECURITY — TASK-045 (tras el ciclo de corrección 1) — 2026-11-03
(Copia del informe de security guardada por el Orchestrator.)

**Veredicto: BLOCKED.** M1 abre regresiones frente a HEAD y frente a G7 (una con el scope normal); la composición de `.env` con `\\` sigue abierta. Ciclo 2 necesario; prototipo listo, sin BLOCK→PASS.

Identidad: `cmp` disco = `S/sec045/p/` (8d29d42b…, f0c730a6…); lib.sh, settings sin cambios.
Casos: diff `t045c1/base/verify-hooks.sh` → disco: 0 quitadas, 108 añadidas (63 casos + 1 de tiempo); ninguno toca uno previo; no cubren la familia nueva. Suite adaptada 610/0 en disco y prototipo.

Hallazgos:
- **HIGH-A** `shell_scan.py:557` («`body = re.sub(r'\\([$`\\\n])', r"\1", body)`») y `:438` («`body = re.sub(r'\\([$`"\\\n])', r"\1", m.group(1))`»): tras un número par de `\`, el shell exterior expande `$`/`` ` `` y el escáner lo lee como escapado. Regresión frente a G7 con scope normal: `X=.claude/hooks/lib.sh; bash <<E⏎echo x > \\${X}⏎E`, `X=…; bash <<E⏎echo x > \⏎$X⏎E`. Con `allow=**`: `\\$X` con `bash`, `sh`, `zsh`, `env bash`, `<<-`, `echo x | bash <<E`, y `` \\`echo <hook>` ``. HIGH por §4.1.1 y §4.1.5.
- **HIGH-B** mismas líneas: `\⏎` se convierte en `⏎` cuando el shell lo elimina. Regresión frente a HEAD (DoD 5): `bash <<E⏎cat .e\⏎nv⏎E` lee `.env` con scope normal (HEAD y G7 BLOCK, disco PASS); `bash <<E⏎echo x > .claude/hoo\⏎ks/lib.sh⏎E` con `allow=**`. En `-c`, abiertos desde HEAD: `bash -c "cat .e\⏎nv"`, `sh -c …`, `bash -c "echo x > .claude/hoo\⏎ks/lib.sh"`.
- **HIGH-C** `.env` por `\\` + sustitución (desde HEAD; el humano exige cerrarlo): `` .e\\`echo n`v `` en `bash`/`sh`/`zsh`/`env bash` `<<E` y `<<-E`, `bash -c "…"`, `zsh -c`, `sh -c`, `env bash -c`, y anidados. Deliberado (§4.1.3), entra por decisión humana.
- Corrección mínima: prototipo `S/sec045c1/p2/shell_scan.py` (md5 b45c1e117c60827b7333890fe110e1b4, 635 líneas; bash-guard sin cambios). Función `outer_unescape(body, esc)` en `:159`, usada en `:458` (`'$`"\n'`) y `:577` (`'$`\n'`): (1) `\⏎` precedido de número impar de `\` se elimina; (2) cada serie de `\` se reduce como el shell exterior y `$`/`` ` `` tras número par queda sin `\` (expansión viva). Diff `S/sec045c1/proto-shell_scan.diff`; solo M1b `S/sec045c1/proto-M1b-only.diff` (97713afc…).
- Diferencial del prototipo: fuzz generativo con bash y zsh reales (`S/sec045c1/fuzz.py`), 504 casos (0–5 `\` × 6 formas × 7 contextos): peligrosos que pasan HEAD 122, G7 58, disco 56, prototipo 0; BLOCK→PASS frente a G7 0, frente a HEAD 0. Corpus `c45_final.jsonl` (27 706, 795 con `\`): 0 diferencias en `sanitize`/`code` disco↔p y p↔p2. Suite ampliada 634/0 con p2; con el disco fallan 18 de 22 casos M1b. FP: 1 nueva (5 `\` + `⏎$X`); desaparece el FP del disco `X=/tmp/…; bash <<E … \\$X`.
- Casos para el tester: `S/sec045c1/cases-tester.txt` (12 tras `verify-hooks.sh:68` con scope de tarea: 8 `.env`, 2 escritura, 2 `passes`; 10 tras `:809` con `allow=*`: 8 `blocks`, 2 `passes`; 2 del MINOR antes del último restaurado del scope). Suite completa `S/sec045c1/verify-hooks.c3.sh`.
- **MEDIUM (propone ciclo 2)**, MINOR del reviewer `shell_scan.py:101` (`WORD`): `X=.git/$(printf "refs\057heads")/../../config; echo x > $X` bloqueaba en G7 y pasa (§4.1.1, §4.1.5). En p2, `barrier()` (`:78-86`) comprueba también el prefijo antes de `$(`/`` ` ``: 5 líneas, 0 cambios en corpus; `X=$(git rev-parse …)/apps/web/x` sigue pasando.
- **NIT** `bash-guard.sh:199-202`: comentario del awk; ciclo 2 si sale gratis, si no deuda LOW (TASK-046).

Deuda propuesta:
- MEDIUM (decisión del humano, por su postura sobre `.env`): `.env` montado con variable o sustitución fuera o dentro de subshell, abierto en HEAD, G7, disco y prototipo: `Y=.e; cat ${Y}nv`, `cat $(printf .e%s nv)`, `Y=.e; bash <<E⏎cat ${Y}nv⏎E`. Deliberado; ninguna regla de desescape lo cierra: hace falta seguir el valor de la variable.
- MEDIUM con tarea que lo cierre (§4.1.5): el valor de una variable se ejecuta como código en el subshell: `X='x; echo y > .claude/hooks/lib.sh'; bash <<E⏎$X⏎E`, `X='x; cat .env'; bash <<E⏎$X⏎E`. Abierto desde HEAD.
- LOW: FP nuevo `\\\\\⏎$X`.

Bloqueos literales: «BLOCKED by bash-guard: destino de escritura que se calcula al ejecutar (sustitución, llaves, expansión o comodín) o que monta una barrera alrededor de una variable: no se puede revisar; escribe la ruta literal (una variable sola, > "$LOG", sí se admite)» dos veces (`git show HEAD:… > $W/head/bash-guard.sh` → identificó HEAD por md5; `diff … > $W/proto-shell_scan.diff` → ruta literal).
Desviaciones: bash y zsh reales solo con `printf` y cadenas, sin `.env`; una tanda pasó sola a segundo plano y terminó con rc 0; ningún proceso vivo.

**Reproducción del Orchestrator** (`orc045/probe2.py`, scope de la tarea): disco rc=0 en `bash <<E⏎cat .e\⏎nv⏎E` y en `X=.claude/hooks/lib.sh; bash <<E⏎echo x > \\${X}⏎E` (confirmado); prototipo `sec045c1/p2/` rc=2 en esos dos y en los cinco de `cases2.json`.

### 6.3 Ciclo de corrección 2

#### 6.3.1 SECURITY (ciclo 2, clasificación acotada para OD-45m)

## SECURITY — TASK-045 (ciclo 2, clasificación acotada para OD-45m) — 2026-11-03
(Copia del informe de security guardada por el Orchestrator.)

Disco = BR (8d29d42b…, f0c730a6…); p2 shell_scan b45c1e11….

Extracción: 16 tandas, 4 480 casos, 1 484 peligrosos según bash/zsh reales. 56 aperturas pasan en head, t44, g7, BR, fin y p2 (17 en tandas 0–4, 39 en 5–15), dos familias (40 `hk`, 16 `env`).

Causa raíz: `shell_scan.py:418` `if ln.buf or not (ln.shell and ln.c_run):` y `:441` `self.emit("\n" + "".join(sub.out) + "\n")`. Solo la primera cadena entre comillas de la palabra `-c` se escanea como código interno; si empieza sin comillas, nada. El resto de la palabra sale como palabra suelta del comando externo: la redirección queda sin destino y la cola se lee con una capa de desescapado menos. `shell_c_string` idéntica en p2 y en `c_NT` del architect.

- **HIGH Familia 1 (escritura sobre barreras)**, scope normal (core-dev), BR, p2 y fin: `bash -c "echo x > ".claude/hooks/lib.sh`, `sh -c "echo x >> "packages/../.githooks/pre-commit`, `bash -c "echo x > ".git/config`, `bash -c "echo x > "docs/TASKS.md` (fuera de scope), `bash -c "tee ".claude/hooks/lib.sh`, `bash -c echo' x > .claude/hooks/lib.sh'`, `bash -c """echo x > .claude/hooks/lib.sh"`; con `allow=*` `bash -c "rm -rf ".claude`. Natural (§4.1; estilo `sh -c "cmd > "$OUT`); en todo caso §4.1.5.
- **HIGH Familia 2 (lectura de `.env`)**, scope normal, BR, p2 y fin: `bash -c "cat "'.e\nv'`, `bash -c "cat ".e\\nv`, `bash -c "cat "'.e""nv'`, `bash -c "cat ".e\'\'nv`, `bash -c "cat "\\.env`, `bash -c c'at .e\nv'`, `bash -c ''"cat .e\\nv"`. Deliberada pero léxica y estática (no requiere seguir valores): no elegible para deuda según el precedente del humano.

Corrección mínima: prototipo `S/sec045c2/p3/` (copia de p2, +18 líneas; diff `S/sec045c2/p3-vs-p2.diff`). Excepción `Glued`, estado 6, mensaje propio en bash-guard. El script de `-c` debe ser una sola cadena (`'…'`, `"…"`, `$'…'`) o una palabra simple; bloquea si hay texto pegado tras la comilla de cierre (se admiten blanco, `;&|()`, `<>`), una comilla dentro de una palabra `-c` sin comillas, o `\` en una palabra `-c` sin comillas.
- 56/56 aperturas bloqueadas; 0 fallos sobre 1 484 peligrosos; 0 B→P frente a fin. Casos manuales A*, E*, W* bloqueados. 24 usos legítimos de `-c` pasan (`bash -c "make test"`, `bash -c ls`, `find -exec sh -c '…' _ {} \;`, `bash -c "x">log`, `bash -c -- '…'`, `bash -ec $'…'`, `bash -c \⏎ '…'`…).
- 120 FP nuevos en el corpus, todos de la forma cadena + trozo pegado; aceptables por §4.1.6; alternativa: todo el script en una sola cadena.
- Suite adaptada: p2 610/0; p3 608/2. Los 2 FAIL («S7: comillas partidas» `bash -c "git"' push origin main'` y «S7: bash -c git\ push») siguen bloqueados pero con el mensaje de `Glued`; ajustar esas 2 expectativas o anteponer las reglas git al estado 6.

Recomendación OD-45m: las dos familias al ciclo 3 (o al ciclo en curso), una sola corrección barata; no deuda.

Bloqueos literales: (1) «BLOCKED by bash-guard: destino de escritura que se calcula al ejecutar (sustitución, llaves, expansión o comodín) o que monta una barrera alrededor de una variable: no se puede revisar; escribe la ruta literal (una variable sola, > "$LOG", sí se admite)» (`> $D/...`; ruta literal). (2) «BLOCKED by bash-guard: no se leen ficheros .env desde Claude Code (si .env es un patrón de búsqueda, escápalo: '\.env')» con `| sed -E 's/real=.*  /  /'` (posible FP preexistente; siguió sin ese `sed`). (3) El mismo con `zsh -f -c 'printf "[%s]" .e\nv'` (bloqueo correcto).

Desviaciones: una sonda del primer arnés ejecutó de verdad `bash -c "rm -rf ".claude` dentro de `S/sec045c2/z` (vacío; sin efecto); arnés corregido. Sin variantes con `git`. Sin procesos vivos.

Veredicto: BLOCKED (2 HIGH previos al ciclo).

**Reproducción del Orchestrator** (`orc045/cases4.json`, scope de la tarea): disco rc=0 en `bash -c "echo x > ".claude/hooks/lib.sh`, `bash -c "cat "\\.env` y `bash -c c'at .e\nv'`; p3 rc=2 en los tres; `bash -c "make test"` pasa en ambos. md5 p3: bash-guard a48664bb…, shell_scan 99977ba0…, lib.sh f66d6aad….

#### 6.3.2 TEST (ciclo de corrección 2)

## TEST — TASK-045 (ciclo de corrección 2) — 2026-11-04
(Copia del informe del tester guardada por el Orchestrator.)

**Veredicto: PASS** (DoD 1–7). Evidencia: S/t045c2-tester/.

**Disco y suite**
- md5 del disco = CC2.20.4 (bash-guard 8905e6ed…, shell_scan c6f04056…, verify-hooks 827bf344…, lib.sh f66d6aad…, settings 2b5ebc02…).
- `bash -n` y `ast.parse` OK, sin `__pycache__`. task-scope 758b02a4… antes y después.
- `make verify-hooks` real, una vez: EXIT=0, 703 OK / 0 FAIL (S/t045c2-tester-vh.log; recontado por el Orchestrator).
- `comm`: los 610 de BR y los 546 de G7 siguen en OK. Los 450 de TASK-044 van dentro de los 546.

**DoD**
- DoD 1 ✅: los 5 N-2 bloquean.
- DoD 2 ✅: `-F`, `-C`, `--dir` y `--prefix` bloquean.
- DoD 3 ✅. Los «lodash» con el scope `deps` son error del fichero de casos (ya visto en el ciclo 1); con el scope `lod` pasan.
- DoD 4 ✅: X12 77 y 78 bloquean.
- DoD 7 ✅.
- DoD 5 ✅, corpus `arch045c2/full_c2.jsonl` (27 707; normalizado un `scope` mal formado en la línea 432; 0 timeouts):
  - frente a HEAD (= a19fb48, 2fdf25ed): 82 BLOCK→PASS, que son las 76 (las 76 en PASS) + 6 de OD-45h;
  - frente a t44 (71f9fe4), G7, BR y QR: 0 BLOCK→PASS;
  - frente a QR: 19 casos `Glued`, que son 6 PASS→BLOCK (1 FP real: el `jq`) y 13 que cambian de mensaje. = CC2.20.6.
- Generativa (4 480 = p3_bs; peligro recalculado con bash y zsh reales, 0 desacuerdos), peligrosos que pasan: HEAD 1 484, t44 828, G7 452, BR 342, QR 56, disco 0.
- Inocuos que bloquean, disco 1 564 (QR 1 444, BR 1 260). Frente a BR son +304, de la cuenta 192 (OU) + 120 (GL) − 8.

**Casos manuales y rendimiento**
- Casos manuales de CC2.20.12: 48/48 como se esperaba (man_r.jsonl). Los HIGH y los `Glued` bloquean; los 6 legítimos de `-c` pasan; `bash -c "echo "$HOME""` = FP LOW aceptado.
- Rendimiento (carga ~25):

  | Caso | Disco | BR |
  |---|---|---|
  | Mediana del hook | 0,148 s | 0,142 s |
  | `bash -c` + 64 000 `\` | 0,94 s | — |
  | `> {` + 64 000 `.` | 1,13 s | — |
  | `env A=1 pnpm x 2>&1` × 199 | 3,14 s | 3,12 s |

**Bloqueos, desviaciones y cierre**
- Bloqueo literal: «BLOCKED by bash-guard: escritura por shell en 'smp.jsonl' fuera del scope de la tarea. Usa Edit/Write dentro del scope o repórtalo.» (ruta relativa; repetido con ruta absoluta).
- Desviaciones:
  - «HEAD» medido contra a19fb48, la referencia de las 82, porque 71f9fe4 = t44;
  - esperas con un bucle de Python que comprueba si existe el fichero de salida;
  - pasadas en segundo plano de la herramienta.
- Sin procesos vivos. Sin hallazgos ni OD.

#### 6.3.3 REVIEW (ciclo de corrección 2)

## REVIEW — TASK-045 (ciclo de corrección 2) — 2026-11-04
(Copia del informe del reviewer guardada por el Orchestrator.)

**Veredicto: APPROVED** (sin BLOCKER ni MAJOR).

**Identidad ✅**
- Las 5 md5 del disco coinciden.
- Los 10 diffs, aplicados con `patch -o` desde BR y en orden, dan las md5 de cada paso; el final es `cmp` igual al disco.
- Los 10 bloques `diff` del plan (`:2322`…`:2999`) coinciden byte a byte con `arch045c2/diffs`.
- shell_scan = p3 + QR y bash-guard = p3 + NT, ambos por `cmp`.
- `bash -n` y `ast.parse` OK.

**Hallazgos**

| Severidad | Dónde | Qué |
|---|---|---|
| MINOR | `shell_scan.py:475` | FP nuevo: un `-c` dentro de `` `…` `` se toma por `Glued` (`` X=`bash -c "echo hi"` ``, `` echo `sh -c 'pwd'` ``, `` echo "`bash -c 'date +%F'`" ``). En HEAD y BR pasaba; con `$( )` pasa. Arreglo: la `` ` `` de cierre cuenta como fin de palabra solo dentro de `top("`")`. Lo propone como deuda. |
| NIT | `shell_scan.py:227` | El ejemplo del comentario lleva las `\` dobladas. |
| NIT | `shell_scan.py:172-173,181` | El comentario no describe lo que hace el código (deja un número par de `\`), y `and c` sobra. Es código de p2: no se toca. |

**Código**
- `outer_unescape` da la misma salida que p2 en 4 431 078 entradas.
- Frente a bash real: 0 diferencias en 6 560 + 6 560 cuerpos.
- Es lineal: 64 000 `\` en 0,001 s.
- `barrier()`, el estado 6 y su mensaje están bien; `Glued` falla cerrado también en los sub-escaneos.

**verify-hooks**
- 93 casos nuevos (92 `blocks`/`passes` + 1 de tiempo).
- Los 2 `-` son las 2 de S7: siguen como `blocks`, ahora con el mensaje de `Glued`.
- No se ha borrado ni debilitado ningún caso.

**Dentro de lo ya aceptado** (no reabierto; lo debe confirmar security): con `allow=*` pasan `Y=refs/heads; X=.git/$Y/../../config; echo x > $X` y `X=.gi$(printf t/refs)/../config; echo x > $X`. Ya pasaban en HEAD y BR. Es la familia de `normpath` (OD-054/055).

**Deuda propuesta:** LOW, el FP del `-c` dentro de `` `…` `` → TASK-046.

**Bloqueo literal:** «BLOCKED by bash-guard: destino de escritura que se calcula al ejecutar (sustitución, llaves, expansión o comodín) o que monta una barrera alrededor de una variable: no se puede revisar; escribe la ruta literal (una variable sola, > "$LOG", sí se admite)». Repetido con la ruta literal.

**Cierre:** sin desviaciones ni procesos vivos. Evidencia: S/rv045c2/.

#### 6.3.4 SECURITY (ciclo de corrección 2, tras la copia)

## SECURITY — TASK-045 (ciclo de corrección 2, tras la copia) — 2026-11-04
(Copia del informe de security guardada por el Orchestrator.)

**Veredicto: BLOCKED.**
- El ciclo cierra todo lo que se le pidió y no tiene regresiones.
- Bloquea por 2 familias HIGH **previas**: pasan ya en a19fb48, HEAD = t44, G7, BR y p3. GL no las abre.

**Identidad**
- md5 del disco = tabla.
- Frente a p3 solo cambian el hunk de QR (`shell_scan.py:174-176`, con la misma salida, CC2.3) y las 4 `#` de NT (`bash-guard.sh:203-206`).
- GL es monótono.

**Cerrado en disco**

| Hallazgo | Dónde | Comprobación |
|---|---|---|
| HIGH-A/B/C | `shell_scan.py:474`, `:595` | 18 M1b dan `blocks`; las variantes también |
| MEDIUM `.git/` vía `$( )` | `:94` | Bloquea con `$(…)` y con `` `…` `` |
| OD-45m (escritura y `.env`) | `:476` | 87 casos en c1–c5: disco = p3 y 56 con `Glued`. Variantes nuevas bloqueadas: `\⏎` tras la comilla, `$"…"`, `${E}"…"`, `{"…",}`, `/bin/bash`, `BASH`, `=bash`, `command`, `--norc`, `( )`, `$( )`, `-xc` |
| NIT | `bash-guard.sh:204` | — |

**Lo nuevo del ciclo**
- Los 50 de GLv dan lo esperado (34 B con `Glued`, 16 P).
- Las 2 de S7 dan OK (`t045c2-tester-vh.log:261-262`).
- GL no abre nada frente a QR ni BR.

**Hallazgos nuevos, previos al ciclo**
- **HIGH 1 — `shell_scan.py:163`** «`self.c_run = False`».
  - Qué pasa: una opción con argumento (`-o posix`) o un `+x` tras `-c` reinicia `c_run`, y el script no se lee como código.
  - Pasan con core-dev: `bash -c -o posix "echo x > .claude/hooks/lib.sh"`, `bash -c +x "…"`, `zsh -c -o shwordsplit …`, `bash -c -o posix "cat .e\\nv"` y `… "echo x > docs/TASKS.md"`.
  - Corrección: en `end_word`, `+…` cuenta como opción, y la palabra que sigue a un grupo con `o`/`O` no reinicia `c_run`.
- **HIGH 2 — `bash-guard.sh:541`** «`if printf '%s' "$flat" | grep -Eq '\$\{![A-Za-z_]|(^|[;&| ])eval[[:space:]]'; then`».
  - Qué pasa: `eval` solo se busca en `$flat`.
  - Pasan con core-dev: `(eval "echo x > <hook>")`, `e""val …`, `\eval …`, `$(eval …)`, `bash -c 'eval "echo x > <hook>"'`, `bash -c "eval 'cat .e\\nv'"` y `e''val 'cat .e\nv'`.
  - Corrección: la regla sobre cada línea de `$sanitized`, `^[ \t]*((env|command|builtin|exec|nice|time|nohup)[ \t]+)*eval([ \t]|$)`. Cierra los 7 y no bloquea `grep "eval"`, `rg -n 'eval'` ni `echo evaluate`.
- **Severidad:** las dos son formas léxicas y estáticas, el mismo precedente que OD-45m. Decide el humano: ciclo 3 o deuda.

**Avisos del reviewer**
- (1) `Y=refs/heads; X=.git/$Y/../../config`: entra en la LOW de `normpath` (OD-054/055).
- (2) `X=.gi$(printf t/refs)/../config` **es otra cosa**: un nombre de barrera partido por una variable o una sustitución. También pasan `X=.gi$(printf t)/config; echo x > $X` y `Z=t; echo x > .gi${Z}/config`, con core-dev y en HEAD. Hay que seguir valores y es deliberado. Propone MEDIUM con tarea: TASK-046 + OD-054, en la familia de TD-061.

**MINOR del reviewer** (`` X=`bash -c "echo hi"` ``)
- Es solo un FP: falla cerrado.
- Al arreglarlo, `` X=`bash -c "echo x > <hook>"` `` y `` X=`bash -c 'cat .e\nv'` `` deben seguir como `blocks`.
- LOW en TASK-046.

**Deuda aceptada:** nada nuevo. `bash -c "$(printf 'echo x > <hook>')"` entra en la del valor calculado.

**Bloqueos literales**
- «BLOCKED by bash-guard: push/merge/rebase/reset --hard/config de git dentro de un intérprete o de una cadena (bash -c, <<<, | bash, python3…): no se ejecutan desde Claude Code (ADR-006)»
- «BLOCKED by bash-guard: destino de escritura que se calcula al ejecutar […]»
- «BLOCKED by bash-guard: expansión indirecta o eval no permitidos (podrían exponer secretos por nombre compuesto)»
- «BLOCKED by bash-guard: escritura por shell en 'r_w.txt' fuera del scope de la tarea. Usa Edit/Write dentro del scope o repórtalo.»

Todos se rehicieron sin rodear el bloqueo. Sin desviaciones ni procesos vivos. Evidencia: S/sec045c2b/.

**Reproducción del Orchestrator** (`orc045/cases5.json`, guard del disco, scope de la tarea con owner devops):

| Caso | rc |
|---|---|
| `bash -c -o posix "echo x > .claude/hooks/lib.sh"` | 0 |
| `bash -c +x "…lib.sh"` | 0 |
| `bash -c -o posix "cat .e\\nv"` | 0 |
| `(eval "echo x > …lib.sh")` | 0 |
| `bash -c 'eval "echo x > …lib.sh"'` | 0 |
| `e''val 'cat .e\nv'` | 0 |
| `bash -c "echo x > …lib.sh"` (control) | 2 |
| `eval "echo x"` (control) | 2 |
| `bash -c "make test"` | 0 |

### 6.4 Ciclo de corrección 3

#### 6.4.1 TEST (ciclo de corrección 3)

## TEST — TASK-045 (ciclo de corrección 3) — 2026-11-04
(Copia del informe del tester guardada por el Orchestrator.)

**Veredicto: PASS** (DoD 1–7). Evidencia en S/t045c3-tester/. Sin hallazgos ni OD.

**Disco y suite**
- md5 del disco = CC3.8: b0fd0b8a…, 0f3822fe…, 3859846f…, f66d6aad…, 2b5ebc02….
- `bash -n` y `ast.parse` OK, sin `__pycache__`.
- task-scope b729a8e4… al empezar y al terminar.
- `make verify-hooks` real, una vez: EXIT=0 y **790 OK / 0 FAIL** (S/t045c3-tester-vh.log; recontado por el Orchestrator).
- Con `comm`, siguen en OK los 703 de GL, los 610 de BR y los 546 de G7.

**DoD**
- DoD 1, 2 y 3 ✅: 85 casos manuales de CC2 y CC3, 0 inesperados.
- DoD 4 ✅, verificado por los casos: `head_exceptions_78.txt` no está en el scratchpad.
- DoD 7 ✅.
- DoD 6 ✅.

**DoD 5 ✅: corpus entero (27 707, 0 timeouts)**
- Frente a HEAD: 82 BLOCK→PASS, la misma lista que en el ciclo 2.
- Frente a t44, G7, BR, QR y GL: 0 BLOCK→PASS.
- Frente a GL: 28 PASS→BLOCK, que es exactamente la lista de CC3.9: 25 de `eval` y 3 de `zsh $(:) -c` (CE).

**DoD 5: generativas** (bash y zsh reales; HOME y ZDOTDIR en una carpeta vacía)

Peligrosos que pasan:

| Generativa | HEAD | t44 | G7 | BR | QR | GL | Disco |
|---|---|---|---|---|---|---|---|
| CC2 (4 452) | 1 456 | 828 | 452 | 342 | 56 | 0 | **0** |
| Nueva (3 544) | 2 086 | 1 584 | 1 584 | 1 584 | 1 584 | 1 584 | **144** |

- Los 144 del disco en la generativa nueva son todos de OD-45p (`e$(:)val`, `e${E}val`).
- Frente a HEAD hay 2 BLOCK→PASS peligrosos, los 2 de OD-45p ya descritos en CC3.9. Frente al resto de versiones, 0.
- FP nuevos: solo los de CC3.10.

**Casos manuales y rendimiento**
- Casos manuales de CC3.16: 37/37 como se esperaba.
- Rendimiento (carga de 47 a 214), sin regresión apreciable:

  | Caso | Disco | GL |
  |---|---|---|
  | Mediana | 0,147 s | 0,153 s |
  | 64 000 `\` | 0,99 s | 0,93 s |
  | `> {` | 1,20 s | 1,15 s |
  | `env` × 199 | 3,44 s | 2,99 s |

**Bloqueos literales** (ninguno rodeado)
1. «BLOCKED by bash-guard: escritura por shell en 't045c3-tester/vh.clean' fuera del scope de la tarea. Usa Edit/Write dentro del scope o repórtalo.»
2. «BLOCKED by bash-guard: destino de escritura que se calcula al ejecutar […]»
3. «BLOCKED by bash-guard: no se leen ficheros .env desde Claude Code (si .env es un patrón de búsqueda, escápalo: '\.env')». Salió con un `sed -i` sobre `run.py`; posible FP. Hizo el cambio con Edit.

**Desviaciones**
- Esperas con un bucle de Python.
- Pasadas en segundo plano de la herramienta.
- Oráculo de zsh sin `-f`, con ZDOTDIR vacío.
- a19fb48 no tiene `shell_scan.py`.

**Procesos:** ninguno propio vivo (queda un `uv run pytest` ajeno, de otra sesión).

#### 6.4.2 REVIEW (ciclo de corrección 3)

## REVIEW — TASK-045 (ciclo de corrección 3) — 2026-11-04
(Copia del informe del reviewer guardada por el Orchestrator.)

**Veredicto: APPROVED.** Sin BLOCKER ni MAJOR. Hay 2 huecos previos, de la misma familia que el ciclo, que tiene que graduar security.

**Identidad ✅**
- md5 del disco = la tabla.
- GL + los 6 diffs dan el disco por `cmp`.
- Los 6 bloques del plan (`:3418-3482`, `:3488-3573`, `:3585-3638`, `:3644-3660`, `:3674-3695` y `:3701-3722`) son iguales a `arch045c3/diffs`.
- verify-hooks: 0 líneas borradas y 87 casos nuevos (61 blocks y 26 passes).

**Hallazgos**
- **MINOR (para security)** en `shell_scan.py:570` y `:573`.
  - Dentro de `"…"`, un `$( )` o `` ` ` `` corta la línea de shell, y CR solo aplica `opt_state`/`resume` en `top()` (`:252-259`).
  - Pasan: `bash -e"$(:)" -c "echo x > .claude/hooks/lib.sh"`, `bash -o "$(printf posix)" -c …`, `` bash -e"`:`" -c … `` y `bash -o pos"$(:)"ix -c …`.
  - Pasaban ya en HEAD y en GL.
- **MINOR (para security)** en `bash-guard.sh:545`.
  - Delante de `eval` solo se admiten `-…`, `coproc`, `repeat N` y `[[ ]]`, y C1 (`:75`) solo quita envoltorios al principio de la línea.
  - Pasan: `repeat 1 builtin e''val x`, `if [[ 1 ]] builtin e''val x`, `repeat 1 X=1 e''val x`, `coproc builtin e''val x` y `repeat 1 time -p e''val x`. zsh real ejecuta los 3 primeros.
  - Pasaban ya en GL.
- **MINOR:** FP nuevo de EV con `grep $(pwd) -e eval`. La alternativa es `grep -e eval "$(pwd)"`.
- `opt_state`/`resume` no dejan ningún estado inconsistente. Las formas del plan bloquean y los usos diarios pasan.

**DoD** 3, 5 y 7 ✅.

**Deuda propuesta**
- MEDIUM: `"$( )"` antes de `-c` (TASK-046).
- MEDIUM: prefijo zsh + envoltorio delante de `eval` (TASK-046, con OD-45p).
- LOW: el FP de `grep $(pwd) -e eval`.

Si security sube alguno a HIGH, el humano decide antes del cierre.

**Bloqueos literales** (ninguno rodeado)
- El de destino de escritura dinámico.
- El de `.env`, que salió 2 veces sin `.env` en la orden (posible FP).
- El de `eval`, por un heredoc de datos (FP de OD-45q).

**Cierre:** sin desviaciones ni procesos vivos. Evidencia en S/rv045c3/.

#### 6.4.3 SECURITY (ciclo de corrección 3)

## SECURITY — TASK-045 (ciclo de corrección 3) — 2026-11-04
(Copia del informe de security guardada por el Orchestrator.)

**Veredicto: BLOCKED.** El ciclo no tiene regresiones. Bloquea por 2 HIGH previos de la misma familia que tenía que cerrar, (a) y (b). Los dos pasan en HEAD y en GL.

**Identidad**
- Las 5 md5 coinciden.
- De GL al disco solo cambian:
  - en `shell_scan.py`, los hunks de CR y CE (`:41-44`, `:143`, `:163-172`, `:252-259`, `:456-469`, `:508-511`);
  - en `bash-guard.sh`, el hunk de EV (`:540-545`).

**Sus HIGH del ciclo 2**
- 165 casos de v/w: todos bloquean en disco, salvo 4 de deuda o inocuos.
- HIGH 1 (`shell_scan.py:168`): cerrado en su forma literal. La familia sigue abierta por (a).
- HIGH 2 (`bash-guard.sh:545`): cerrado en su forma literal. La familia sigue abierta por (b). Las 21 formas con palabra reservada delante bloquean.

**Lo nuevo**
- Los 87 casos de CRv/EVv/CEv dan lo esperado.
- 3 056 casos: 0 B→P frente a GL.
- Los FP de CC3.10 son solo FP.

**(a) HIGH — `shell_scan.py:570`, `:573` y `:252-259`.** Una palabra de opción antes de `-c` con `$( )` o `` ` ` ``.
- Es la familia de HIGH 1. No es OD-45p.
- Pasan con core-dev, y bash y zsh reales escriben en el hook o leen `.env`:
  - los 4 del reviewer;
  - `bash -e$(:)c "…"`, `` bash -e`:`c ``, `bash -$(:)c "…"` y `bash -c$(:) "…"`.
- Causa: `opt_state` no guarda `ln.buf`, y `double()` no lo llama.
- Corrección mínima (≈5 líneas): guardar y restaurar `ln.buf` en `opt_state`/`resume` (`:464`, `:469`) y envolver `:570` y `:573` como `:252-259`.
- Alternativa que falla cerrada: `raise Glued()` en `$(`/`` ` `` con `ln.shell` y (`ln.arg` o palabra parcial `-`/`+`).

**(b) HIGH — `bash-guard.sh:545` y C1 (`:65-88`).** Prefijo de zsh más envoltorio delante de `eval`.
- Es la familia de HIGH 2. No es OD-45p.
- Pasan los 5 del reviewer y 13 combinaciones más (`repeat`, `coproc`, `if [[ ]]` con `time`, `command`, `exec`, `env`, `nohup`, `noglob`, `nocorrect`, `X=1` y `repeat` anidado).
- En zsh real, que es la shell del Bash tool en esta máquina, escriben en el hook y leen `.env`.
- Corrección mínima: en `cn_awk` (`:74`), soltar `coproc`, `repeat N` y `[[ … ]]` como prefijo (≈3-4 líneas). Solo para (b) basta 1 línea en `:545`.

**HIGH previo de otra familia (prefijos de zsh en C1)**
- Pasan: `repeat 1 printenv`, `coproc printenv`, `if [[ 1 ]] printenv`, `repeat 1 export -p`, `repeat 1 typeset -x`, `repeat 1 chflags nouchg x` y `coproc chflags …`.
- Estaban en HEAD, en GL y en el disco.
- Lo cierra la misma corrección de `cn_awk`.

**Deuda**
- LOW: los FP de CC3.10 (TASK-046).
- Si el humano acepta (a), (b) y C1 como deuda, deberían ser HIGH con tarea propia.

**Bloqueos literales:** 2, rehechos sin rodearlos:
- el de destino de escritura dinámico;
- el de `eval` en un heredoc de datos.

**Desviaciones**
- Ejecutó el guard del disco desde su ruta.
- Hizo `cp` de un task-scope de prueba desde `S/arch045c3/fr_commit`.
- Usó 3 trabajos con `run_in_background`.
- Sin procesos vivos.

**Reproducción del Orchestrator** (`orc045/cases6.json`, guard del disco, scope de la tarea)

| Caso | rc |
|---|---|
| `bash -e"$(:)" -c "echo x > .claude/hooks/lib.sh"` | 0 |
| `bash -$(:)c "…lib.sh"` | 0 |
| `bash -e$(:)c "cat .e\\nv"` | 0 |
| `repeat 1 builtin e''val '…lib.sh'` | 0 |
| `coproc builtin e''val 'cat .e\nv'` | 0 |
| `repeat 1 printenv` | 0 |
| `coproc printenv` | 0 |
| Control: `bash -c -o posix "…lib.sh"` | 2 |
| Control: `printenv` | 2 |
| `bash -o pipefail -c 'make test'` | 0 |

## 7. Veredicto final y estado

- **TEST:** PASS (ciclo 3; 790 OK / 0 FAIL).
- **REVIEW:** APPROVED (ciclo 3, sin BLOCKER ni MAJOR).
- **SECURITY:** **BLOCKED** (ciclo 3). Security no aprobó. Los HIGH (a), (b) y (c) quedan como TD-111, TD-112 y TD-113, con pago en TASK-047.
- **Cierre:** decisión humana del 2026-11-05 (opción 1), citada en §1.
- **DoD 1–7:** verificados por TEST y REVIEW del ciclo 3. DoD 8: cumplido con el reparto del 2026-11-05 (§8).

## 8. Deuda registrada

Registrada en `/Users/davidferanandezmorilla/Desktop/development.nosync/agentlab/docs/TECHNICAL_DEBT.md` el 2026-11-05.

| TD | Descripción breve | Severidad | Pago | Origen |
|---|---|---|---|---|
| TD-061 | Destino de escritura calculado al ejecutar (X12) | MEDIUM | PAID (TASK-045) | TASK-044 (ciclo 3) |
| TD-062 | Volcado del entorno con redirección (N-2) | MEDIUM | PAID (TASK-045) | TASK-044 (ciclo 3) |
| TD-063 | `pnpm -F/-C/--dir/--prefix … add` sin `deps_allowed` (N-3) | MEDIUM | PAID (TASK-045) | TASK-044 (ciclo 3) |
| TD-111 | (a) opción con `$( )` o `` ` `` antes de `-c` | HIGH | TASK-047 | TASK-045 (ciclo 3, security) |
| TD-112 | (b) prefijo de zsh más envoltorio delante de `eval` | HIGH | TASK-047 | TASK-045 (ciclo 3, security) |
| TD-113 | (c) prefijos de zsh en C1 | HIGH | TASK-047 | TASK-045 (ciclo 3, security) |
| TD-114 | `.env` montado con variable o sustitución | MEDIUM | TASK-048 (irrelevante con sandbox por `denyRead`); lo que quede, TASK-046 | TASK-045 (ciclo 1, security) |
| TD-115 | Valor de variable ejecutado como código en subshell | MEDIUM | TASK-048 (barreras y `.env`); lo que quede, TASK-046 | TASK-045 (ciclo 1, security) |
| TD-116 | Nombre de barrera partido por variable o sustitución | MEDIUM | TASK-048 (`denyWrite .git/config`) | TASK-045 (revisión inicial) |
| TD-117 | OD-45p, nombre de orden calculado | MEDIUM | TASK-046 (con OD-054) | TASK-045 (ciclo 3) |
| TD-118 | FP de OU (192 y `\\\\\⏎$X`) | LOW | TASK-046 | TASK-045 (ciclo 2) |
| TD-119 | FP de GL (120 de cadena más trozo pegado) | LOW | TASK-046 | TASK-045 (ciclo 2) |
| TD-120 | FP de `-c` dentro de `` `…` `` | LOW | TASK-046 | TASK-045 (ciclo 2) |
| TD-121 | `.git/config` por `normpath` a través de variable | LOW | TASK-048 | TASK-045 (revisión inicial) |
| TD-122 | OD-45q, FP previos de la regla de `$flat` | LOW | TASK-046 | TASK-045 (ciclo 3) |
| TD-123 | FP de CC3.10 (CR, EV, CE) | LOW | TASK-046 | TASK-045 (ciclo 3) |
| TD-124 | FP nuevo de EV (`grep $(pwd) -e eval`) | LOW | TASK-046 | TASK-045 (ciclo 3) |
| TD-125 | FP aceptados de TD-061 (OD-45g y OD-45i) | LOW | TASK-046 | TASK-045 (ciclo 1) |
| TD-126 | Variables asignadas por otro canal (LOW de security; plan §16 la graba MEDIUM) | LOW | TASK-048 (barreras); lo que quede, TASK-046 | TASK-045 (revisión inicial) |

Nota: TD-083 absorbe, según el plan, el `cd` a variable marcada y `tee`/`cp`/`sed -i` con variable (CC1.19, OD-45f). Su texto no se ha modificado.

### 8.1 Reparto de las 14 MEDIUM de TASK-044 (DoD 8, decisión humana del 2026-11-05)

| Pago | Deudas |
|---|---|
| TASK-047 | TD-077, TD-085, TD-087, TD-089, TD-090, TD-092, TD-093 |
| TASK-048 | TD-081, TD-086 |
| Irrelevante con sandbox: se cierra al cerrar TASK-048, tras comprobarla | TD-074, TD-078, TD-083, TD-088, TD-091 |

En las de la última fila, lo que quede fuera del scope y no sea barrera vuelve a TASK-046.

## 9. Propuesto, sin registrar

Estas observaciones no tienen aceptación humana explícita en el registro de TASKS.md ni en el encargo. No se registran en TECHNICAL_DEBT.md.

1. **MEDIUM, plan §16 «TD-061 resto 1»:** variables asignadas por otro canal (`printf -v X …; > "$X"`, `read`, `mapfile`, `source`, `set -- …`). El plan la graba MEDIUM; security la graba LOW en el mismo grupo (TD-126, registrada como LOW). Conflicto de severidad a decidir por el humano. Pago propuesto: OD-054/055.
2. **MEDIUM, plan §16:** `set $(:)` y `` set `:` `` vuelcan el entorno en zsh (pasan en HEAD, `t44` y G7). Sin tarea de pago fijada.
3. **MEDIUM, plan §16:** rendimiento de la rama `env`/`printenv` (1,72 s con 199 `env … $(:)` en t44). Sin tarea de pago fijada.
4. **LOW, plan §16:** `pnpm install --filter core` toma el valor como paquete (alternativa `pnpm --filter core install`). Sin tarea de pago fijada.
5. **LOW, CC1.19:** destino literal con `{` sin `,` ni `..` (`echo x > apps/web/{x`), pago propuesto TD-083.
6. **LOW, CC1.19:** `WORD` no lee un `$(…)` con paréntesis dentro (`X=$(cd a && (pwd))/.claude/hooks/x`).
7. **LOW, CC1.19:** 399 segmentos `pnpm … install` cuestan unos 8 s de CPU en t44; pago propuesto TASK-046.
8. **LOW, posible FP de H1 (CC1.15):** `pnpm --filter i add lodash`; alternativa comprobada `pnpm --filter=i add lodash`.
9. **Observación de entorno:** varios agentes vieron el bloqueo «no se leen ficheros .env desde Claude Code (si .env es un patrón de búsqueda, escápalo: '\.env')» con un `sed` o un heredoc sin `.env` real (sec c2, rv c3, test c3). Posible FP previo, no es deuda.

No son deuda: NIT de comentarios (reviewer ciclo 2, `shell_scan.py:227` y `:172-173,181`; el de `:172-181` es código de p2, no se toca). Los del ciclo 1 y 2 (`awk` de H1, `BRACES`, `normpath` de la revisión inicial) están resueltos o registrados.

## 10. OPEN DECISIONS registradas

Decisiones de plan (OD-45a…q, pauta §14 del plan). Van en este informe, no en SPEC §13.

| OD | Decisión | Fecha | Notas |
|---|---|---|---|
| OD-45a | (b): variante de §5.1 para N-2 | 2026-11-02 | Mantiene las 76 excepciones |
| OD-45b | (a): G4, bloquear `${X…}` no simple | 2026-11-02 | |
| OD-45c | (a): G5, bloquear comodines en destino | 2026-11-02 | |
| OD-45d | (a, con `task-scope`): G6, lista de trozos | 2026-11-02 | `task-scope` es añadido del architect |
| OD-45e | (b): G7, asignaciones del mismo comando | 2026-11-02 | |
| OD-45f | (a): solo redirecciones; argumentos de comandos a TD-083 | 2026-11-02 | |
| OD-45g | Aceptar los 7 FP de §11 con su alternativa | 2026-11-02 | Registrados en TD-125 |
| OD-45h | (a): lista de excepciones frente a HEAD pasa a 82 (76 + 6) | 2026-11-02 | |
| OD-45i | (a): aceptar los 3 FP de CC1.15 | 2026-11-02 | Registrados en TD-125 |
| OD-45j | (a): la comprobación de tiempo se queda en la suite | 2026-11-02 | |
| OD-45k | (a): copiar NT (comentarios) | 2026-11-03 | |
| OD-45l | (b): copiar QRv/QR (`outer_unescape` lineal) | 2026-11-03 | |
| OD-45m | Parche p3 de security (estado 6 `Glued`) en el ciclo 2, par GLv/GL | 2026-11-03 | Aprobado con la adenda CC2.20 (2026-11-04). Sus 120 FP, en TD-119 |
| OD-45n | No formalizada. Se aplicó la recomendación (a) al aprobar CC2.20 (ajuste de las 2 expectativas de S7) | 2026-11-04 | Sin decisión explícita separada |
| OD-45o | (a): copiar CEv/CE | 2026-11-04 | El FP de CE, en TD-123 |
| OD-45p | (a): nombre de orden calculado, deuda MEDIUM con OD-054 | 2026-11-04 | TD-117 |
| OD-45q | (a): FP previos de la regla de `$flat`, deuda LOW | 2026-11-04 | TD-122 |

Decisiones de fondo (SPEC §13, no tocadas por este cierre):
- **OD-054 = (b)**: sandbox nativo de Claude Code con `denyWrite`/`denyRead` y `excludedCommands` exactos (2026-11-05).
- **OD-055 = (b)**: `uchg` sobre las barreras, sin target de `make` (2026-11-05).
- **OD-056 = (b)**: C6 a TASK-047, con los añadidos de security (2026-11-05).

ADR-013 (sandbox del camino Bash) está en Proposed: bloquea TASK-048.

## 11. Estado de las tareas relacionadas

| Tarea | Estado tras el cierre | Motivo |
|---|---|---|
| TASK-045 | DONE (2026-11-05) | Cierre por decisión humana con SECURITY BLOCKED |
| TASK-047 | READY (prioritaria) | Sin dependencias pendientes: TASK-045 DONE y decisiones resueltas |
| TASK-048 | BLOCKED | ADR-013 (Proposed) y decisión sobre `.claude/settings.local.json`. Ya no depende de TASK-045 |
| TASK-046 | BLOCKED | Depende de M1 y de TASK-048 |

## 12. Bloqueos y desviaciones del cierre (docs-keeper)

- **Fecha:** el encargo trae la fecha 2026-11-05 y el contexto la confirma. No pude ejecutar `date +%F` (no tengo shell); la fecha no se ha tomado de memoria.
- **Lectura:** `docs/TASKS.md` y `docs/TECHNICAL_DEBT.md` completos; plan citado por ruta, sin copiar; los 13 informes del scratchpad, íntegros. No se abrieron `COPY.md` ni los logs.
- **Sin `.env`:** no se creó, leyó, copió ni mostró ningún `.env`.
- **Hooks:** no hubo bloqueos durante el cierre.
- **Fuera de scope:** ninguno. Solo se tocaron `docs/TASKS.md`, `docs/TECHNICAL_DEBT.md` y este informe. No se tocaron ADR, ARCHITECTURE, SPEC, README ni hooks.
- **Observación para el Orchestrator:** TD-064 a TD-073, TD-075, TD-076, TD-079, TD-080 y TD-082 siguen con pago «por crear» u OD-054 (ya resuelto). No estaban en el reparto del 2026-11-05, así que no se han tocado. Conviene reasignarlas.
