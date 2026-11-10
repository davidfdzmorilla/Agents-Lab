# TASK-047 — Informe de cierre

| Campo | Valor |
|---|---|
| Tarea | TASK-047 · bash-guard: opciones calculadas antes de `-c`, prefijos de zsh, C6 y `uchg` |
| Hito | M0 posterior al cierre (prioritaria, decisión humana del 2026-11-05) |
| Owner | humano (ADR-006: ningún agente edita barreras; el architect planifica, el devops monta el kit en el scratchpad y el humano copia) |
| Dependencias | TASK-045 (DONE) |
| Fecha | 2026-11-10 (fecha del encargo de cierre; esta sesión no pudo ejecutar `date +%F`) |
| Plan | `docs/reports/TASK-047-plan.md` (architect; plan base, anexo CC1 en 1188–1261, CC2 en 1262–1722 y CC3 rev.4 en 1723–2902; md5 del plan 84db387a…, md5 del tramo CC3 9c51b7ad…). Citado, no copiado. |
| Veredictos finales | **TEST PASS · REVIEW APPROVED · SECURITY APPROVED**, todos sobre el disco final, 2026-11-10 |

Scratchpad citado como `S` = `/private/tmp/claude-501/-Users-davidferanandezmorilla-Desktop-development-nosync-agentlab/3fa7c665-c570-4833-afbe-b934a451dd31/scratchpad`. Se borra; el contenido sustancial de cada informe queda aquí (§2, §4 y §9).

Cierre ordinario: los tres veredictos finales son PASS / APPROVED / APPROVED sobre el disco. No es un cierre excepcional como el de TASK-045. La deuda que queda abierta la aceptó el humano («Congelar rev.4 + deuda», §3).

## 1. Objetivo y alcance

- Endurecer las barreras de Claude Code: `.claude/hooks/bash-guard.sh`, `shell_scan.py`, `lib.sh`, `role-guard.sh`, `scope-guard.sh`, `scripts/verify-hooks.sh` y `docs/AGENTS.md` §4.2.
- Pagar los HIGH (a), (b) y (c) de security de TASK-045 (TD-111, TD-112 y TD-113), y del reparto de TASK-044: TD-085, TD-092 y TD-093 quedan PAID; TD-077, TD-087, TD-089 y TD-090 se amplían y siguen OPEN.
- Marca `uchg` (OD-055 b) en `.claude/hooks`, `.githooks` y `.claude/settings.json`, puesta y quitada solo por el humano (AGENTS.md §4.2), y el caso «4b) uchg» de `make verify-hooks`.
- C6: cada hook empieza por `#!/bin/bash` y fija `PATH=/usr/bin:/bin`. `xcrun_nocache=1` en los cuatro hooks.
- Fuera de alcance: ADR, ARCHITECTURE, SPEC y `.claude/settings.json` (TASK-048). Dependencias nuevas: ninguna. Instalación y comandos: sin cambios (`make verify-hooks` igual).
- Método: kit por pasos montado en el scratchpad por el devops (md5, suite real, diferencial de 27 707 casos); copia del humano con script (`orc047/run-047.sh`, `run-cc2.sh`, `run-cc3.sh`).

## 2. Ciclos (CC0 a CC3)

### CC0 (2026-11-05 a 2026-11-06): kit inicial
- Kit de 13 pasos (`S/t047/`, log de implementación en `S/impl047-report.md`). Copia del humano con `run-047.sh`; observado = esperado en todos los pasos. El único FAIL de Uv era «falta uchg».
- **TEST PASS**: `make verify-hooks` 934 OK / 0 FAIL, EXIT 0. DoD 1–8 OK. Diferencial 27 707 casos frente a 145f4d4: 0 B→P y 57 P→B. Frente a a19fb48, en los 85 candidatos: 82 B→P, las vigentes, ninguna nueva. Los 26 controles de uso diario pasan. Quedó pendiente la prueba manual del humano con `touch`/`chmod` sobre `uchg` (TD-087).
- **REVIEW CHANGES_REQUESTED**:
  - MAJOR `docs/AGENTS.md:82`: decía que ningún proceso del usuario puede escribir sobre las barreras, lo que contradice SPEC §13 OD-055 y ADR-013:83 («freno, no pared»).
  - MINOR `docs/AGENTS.md:86` y `:90`: `ls -lO <dir>` lista el contenido, no la marca del directorio; debe ser `ls -ldO`, como `verify-hooks.sh:1202`.
  - MINOR y NIT de código: TD-090 (`cat "${:-}"(.e)nv`, `cat "$(:)"(.e)nv`), TD-077 (awk `print | "cmd"`, `|&`), TD-089 (`git reset HEAD $X`, `git switch $F main`), TD-075 (`git checkout <ruta>`) y `verify-hooks.sh:1202` (no mira ocultos ni subdirectorios).
  - Para security: aritmética `$((x))` y caché `xcrun_db` (`/usr/bin/python3` es un shim de xcrun).
- **SECURITY BLOCKED** (2 HIGH previos y 2 MEDIUM):
  - HIGH (a) `shell_scan.py:166` (`Line.end_word`): una palabra de opción calculada con `${…}`, `$x` o llaves, sin `$( )`, oculta el script de `-c`. Pasan `bash -e${x}c "…"`, `bash -c${x} "…"`, `bash -{e,c} 'cat .env'`, `bash -c{,} "…"`.
  - HIGH (b)/(c) `bash-guard.sh:82` (`cn_awk`): tras `repeat N` o `[[ … ]]`, zsh admite `do`/`then` sin `;`, y `cn_awk` no los suelta. Pasan `repeat 1 do printenv; done`, `if [[ 1 ]] then chflags nouchg x; fi`, `repeat 1 do tee .claude/task-scope.json < …; done`.
  - MEDIUM: TD-090 (resto), aritmética (familia de TD-115) y xcrun (`cp … $TMPDIR/xcrun_db` pasa el guard).
  - LOW: `chflags` dentro de `S/t047/tools/prepU.sh` del devops (§6, incidencia 3) y `docs/AGENTS.md:82` sin `bash x.sh`.

### CC1 (2026-11-06): texto de AGENTS.md
- Tres líneas (82, 86 y 90) con el texto literal del anexo CC1 del plan (1188–1261). `docs-keeper` las aplicó; el Orchestrator comprobó que `diff` frente al previo da solo 82c82, 86c86 y 90c90. md5 de `docs/AGENTS.md`: 722abce9… (antes 109490f5…).
- **TEST PASS** tras CC1: 934 OK / 0 FAIL, EXIT 0; las 6 md5 de barreras iguales; `uchg` puesto (`S/test047/vh-cc1.log`).
- **REVIEW APPROVED**: MAJOR y MINOR resueltos, coherentes con SPEC:462, ADR-013:83 y `verify-hooks.sh:1202`.
- No hay informe de security tras CC1. Los HIGH de security no los tocaba un cambio de texto; pasaron a CC2.

### CC2 (2026-11-07): cadena de copias y correcciones de security
- Kit de nueve pasos más N y U a mano por el humano (`S/t047cc2/COPY.md`, `steps.tsv`). Cadena Kv, K, Rv, R, Bv, B, Xv, X, U (OD-CC2-1 (a)). Partida: las 6 md5 de CC0.
- Cambios: K marca como calculada una palabra con `$( )` o `` ` `` en línea de shell, trata `*?[` sin comillas y `~` inicial como calculados, y `resume()` ya no pierde `ln.buf`. R suelta `else` y `elif` en `cn_awk` y el tope de 16 falla cerrado. Que los HIGH (a), (b) y (c) queden cerrados se verifica en la prerrevisión de CC3 y en los veredictos finales (§4). B quita la `{` inicial antes de las reglas de `.env` y escritura. `find … -exec bash {} \;` deja de dar FP (`w == "{}"` excluido). X añade `xcrun_nocache=1` en la línea 5 de los cuatro hooks (OD-CC2-2).
- **TEST PASS**: `make verify-hooks` 990 OK / 0 FAIL, EXIT 0. Diferencial 27 707: 0 B→P y 0 P→B frente a fin2; frente a a19fb48, las mismas 82. Controles de uso diario: 60 + 26 pasan.
- **REVIEW CHANGES_REQUESTED** con dos BLOCKER y un MINOR:
  - BLOCKER K (`shell_scan.py:262-266`, `:257-261`, `:474-477`): `-c` o `c` que procede de una sustitución no se ve. Pasan (rc=0) `bash $(echo -c) '…'`, `bash -$(echo c) '…'`, `zsh $(echo -c)`, `` sh `printf -- -c` '…' ``, los globs `bash -[c]` y `-?`, y `bash ~n`.
  - BLOCKER B (`shell_scan.py:182` y regla de `.env`): pasan `{bash -c '…task-scope.json'}`, `{sh -c 'cp … lib.sh'}`, `{cat .env}`, `{ cat .env}`, `{grep KEY .env}` y `{ source .env}`.
  - MINOR: `find . -name x -exec bash {} \;` daba rc=2 (FP).

### CC3 (2026-11-09 a 2026-11-10): prerrevisión, rev.3 y rev.4
- **Prerrevisión del anexo CC3 (reviewer, CHANGES_REQUESTED; `S/rv047cc3-report.md`)**:
  - BLOCKER 1, K (`shell_scan.py:181-195`): la palabra calculada pone `c_run`, pero no suma su posible `o` a `arg`, y la literal siguiente lo apaga. Pasan `bash $(echo -co) posix '…'`, `-$(echo co) posix`, `` `echo -co` ``, `-[c]o posix`, `-e${x}co posix`, `-{c,o} posix`, `bash ~ posix` (con HOME=-co), `bash $X posix` y `zsh $(echo -co) shwordsplit`. Es regresión: `bash -co$(:) posix` daba rc=2 y pasaba a rc=0. Corrección: flag `dyn_c` persistente.
  - BLOCKER 2, B (`bash-guard.sh:414`): el destino se toma como la última palabra tras partir por blancos. Pasan `cp /tmp/x .claude/task-scope.json 2>/dev/null` (igual con `> /dev/null`, `2>&1` o `</dev/null`), `sed -i "" s/a/b/ .claude/task-scope.json 2>/dev/null`, `echo x | tee .claude/task-scope.json>/dev/null`, `rm .claude/task-scope.json</dev/null` y `{tee .claude/task-scope.json}</dev/null`. Corrección: quitar del segmento las redirecciones antes de leer el destino (`san_wa`).
  - MINOR: `bash x.sh "$(date +%F)" --tag="v1"` da rc 6 (FP; alternativa `--tag=v1`). NIT: la regla de `docker exec … env` corta también en `:`.
- **Prerrevisión de security del diseño (BLOCKED; `S/sec047cc3-report.md`)**: dos HIGH previos.
  - HIGH en `san_br` (`B/bash-guard.sh:68` y `:99`): en zsh, una `}` pegada seguida de `always`, `else`, `elif`, `then`, `do` o `fi` en la misma línea deja la orden a mitad. Pasan `{true} always {cp … .claude/task-scope.json}`, `if false; then {true} else cp … .claude/task-scope.json; fi` e `if {true} then printenv; fi`.
  - HIGH en K (`shell_scan.py:186`): ksh `-T mask` toma argumento y el escáner apaga `c_run`. Pasan `ksh -cT 1 'echo x > .claude/task-scope.json'` y `ksh -cT 1 'printenv'`.
  - MEDIUM: `tcsh -c 'cp … task-scope.json'` y `csh -c 'printenv'` dan rc=0 porque csh y tcsh no están en `SHELLS`. Sube OD-CC3-2 a HIGH.
- **Decisiones humanas tras la prerrevisión** (§3): OD-CC3-1 y OD-CC3-2 como deuda HIGH; OD-CC3-3 (a); csh y tcsh entran; OD-CC3-5 (a).
- **Rev.3** (`S/rv047cc3-report.md`, «recheck antes del kit»): **REVIEW APPROVED**. Los BLOCKER 1 y 2 quedan cerrados: 113 de 120 formas `-co` bloquean, y `san_wa` cubre 9 formas con destino tras redirección. **Security BLOCKED**: `san_br` deja pasar la redirección entre la `}` pegada y la palabra reservada (`if true; then {printenv}>/tmp/claude-scratch/o fi`, `{true} always {printenv}>…`, y con `allow=*`, `{cp … .claude/task-scope.json}>/dev/null fi`); la redirección pegada al nombre de la orden (`chflags>/dev/null nouchg x`, `repeat 1 printenv>…`); y MEDIUM `csh -fc 'setenv'` rc=0. K y csh/tcsh quedan cerrados.
- **Rev.4** (plan CC3 rev.4, 1723–2902; `S/cc3-plan-impl-reports.md`): `san_rd` antes de `san_br` separa las redirecciones antes de leer las líneas (cierra `git 2>/dev/null push`, `git>/dev/null reset --hard`, `git 2>&1 commit -m x` y `gh 2>/dev/null auth token`); `san_br` marca ` +(8 palabras) ` sin exigir la `}` y corta solo en palabras reservadas (OD-CC3-5 (a)); `setenv` sin argumentos cuenta como volcado. **REVIEW APPROVED** (`S/rv047cc3-report.md`, rechecks de rev.4): 242 de 263 formas bloquean; las 21 que pasan son las de rev.3 más `{f}>… printenv`, que ningún shell ejecuta; 101 FP de uso diario sin cambio, salvo el ya listado. **Security BLOCKED** (`S/sec047cc3r4-report.md`): dos HIGH previos, sin corrección dentro del guard para el segundo:
  - `printenv {fd}>/dev/null` y `export -p {fd}>/dev/null` (corrección probada en `S/sec047cc3/r4/fix/`: añadir `s/([[:space:]])[{][A-Za-z_][A-Za-z0-9_]*[}](&?[<>])/\1\2/g` al primer `s///` de `san_rd`).
  - Un script de `-c` en una palabra suelta: `bash -c printenv`, `sh -c export`, `zsh -o posix -c env`, `tcsh -c setenv`.
  - Bloqueo literal de `.env` que security considera FP (`sed` con argumentos); no se rodeó.
- **«Congelar rev.4 + deuda»** (humano, 2026-11-10): se copia la rev.4 sin más cambios, y los dos HIGH pasan a deuda HIGH para TASK-046 (TD-130 y TD-131).
- **Copia del humano** (`S/t047cc3/logs-human/`): N, después `orc047/run-cc3.sh` (Kv 1028/82, K 1109/1, Bv 1172/156, B 1327/1), después U (`chflags -R uchg`). `make verify-hooks`: «todas las barreras funcionan». md5 finales en §5.
- **Kit**: los cuatro diffs del anexo CC3 (`patch -F0`, sin hunks fallidos; líneas 1892–2025, 2031–2224, 2230–2463, 2469–2603 del plan) dan `cmp` igual frente a arch047cc3r4.

## 3. Decisiones humanas

| Decisión | Contenido | Efecto en esta tarea |
|---|---|---|
| OD-47a (a), OD-47b (a), OD-47c (a) | Decisiones de CC0 (`S/impl047-report.md`). OD-47b: texto de AGENTS.md §4.2. | Aplicadas. Según el TEST, OD-47c deja `/usr/bin/p(r)intenv` fuera de TD-090. |
| OD-CC2-1 (a) | Cadena de copias B: N, Kv, K, Rv, R, Bv, B, Xv, X, U; N y U a mano por el humano con `chflags`. | Aplicada; ningún agente ni script ejecuta `chflags`. |
| OD-CC2-2 | `xcrun_nocache=1` en los cuatro hooks. | Aplicada (línea 5). `verify-hooks.sh` sin la línea: TD-134. |
| OD-CC2-3 | Nombre de orden calculado (`x=bash; $x -c '…'`, `bash$(echo ' -c')`, `$SHELL -c`, `{bash,-c,'…'}`). | Deuda HIGH: TD-127, pago TASK-048 + TASK-046. |
| OD-CC3-1 | Datos que pasan a código (`echo '…' \| bash`, `bash <<< '…'`, `bash -c "$X"`, `set -- -c '…'; bash "$@"`). | Deuda HIGH: TD-128, pago TASK-048 + TASK-046. |
| OD-CC3-2 | Argumentos de escritura con llaves, variable o comodín (`tee .claude/{task-scope.json,} < f`, `rm .claude/task-sc{o,}pe.json`, …). Security la subió a HIGH. | Deuda HIGH: TD-129, pago TASK-048 + TASK-046. |
| OD-CC3-3 (a) | `{bash -c '…'}` sigue en rc 6; alternativa `{ bash -c '…'; }`. | FP aceptado: TD-135. |
| OD-CC3-4 | csh y tcsh entran en `SHELLS` ahora. | Aplicada en rev.3/rev.4. Las formas `-c` en palabra suelta quedan en TD-131. |
| OD-CC3-5 (a) | El corte de `san_br` se limita a las palabras reservadas. | Aplicada en rev.4. |
| Prerrevisión CC3 | Rev.3 y rev.4 revisadas por reviewer y security antes de copiar. | El humano copió tras la prerrevisión. |
| «Congelar rev.4 + deuda» (2026-11-10) | Tras el BLOCKED de security a la rev.4. | Rev.4 copiada tal cual; TD-130 y TD-131 como deuda HIGH para TASK-046. |

## 4. Veredictos finales y evidencia

### 4.1 TEST — PASS (addendum CC3, 2026-11-10; `S/test047cc3/`)
- Identidad: las 7 md5 coinciden con la rev.4. `uchg` está en `.claude/hooks`, `.githooks`, `.claude/settings.json` y en sus ficheros.
- `make verify-hooks` real, una vez: EXIT 0, **1328 OK / 0 FAIL**, «todas las barreras funcionan». Recontado por el Orchestrator. Los 990 OK de CC2 siguen en OK.
- Casos: `cases-cc3` 338/338; `sec3` 7/7 con rc=2; `sec4`: las 6 primeras con rc=0 (deuda aceptada TD-130 y TD-131) y las 2 últimas con rc=2.
- Diferencial 27 707 casos: 0 B→P; 42 P→B (16 por otro motivo); frente a a19fb48, las mismas 82 excepciones y ninguna nueva.
- Controles: 47 de 48 como se esperaba; los FP aceptados del anexo bloquean. Observación: `csh -c setenv` sin comillas pasa, de la clase de TD-131.
- Desviación: el tester dejó 4 bucles `until grep -q EXIT` vivos; el Orchestrator los paró con TaskStop (§6).

### 4.2 REVIEW — APPROVED (final sobre el disco; `S/rv047cc3fin-report.md`)
- Identidad: el disco es la base CC2 más los cuatro diffs del anexo, sin nada más. Igual a `t047cc3` y `arch047cc3r4`.
- Pruebas: 97 formas de uso diario con el mismo veredicto que rev.4; 42 de 42 bloqueos dan rc=2.
- Deuda consolidada que propone el reviewer: MEDIUM, ampliar TD-090, TD-077 y TD-089 (TASK-046); MINOR, TD-087 no pasa a PAID sin la prueba del humano; NIT, ampliar TD-075; LOW para TASK-046: ocultos y subdirectorios en `verify-hooks.sh`, FP rc 6 (TD-135), `docker exec … env` y `san_wa` frente a `san_rd`.
- Ya acordadas: aritmética, `xcrun_nocache`, HIGH OD-CC3-1, OD-CC3-2, `{fd}>` y `bash -c` sin comillas.
- Cerrada: el mensaje de rc 6 ya cubre las palabras sin comillas (`bash-guard.sh:46`).
- Incidencia: un `printf` del Orchestrator con el texto «git reset HEAD» fue bloqueado por bash-guard; se guardó con Write (§6).

### 4.3 SECURITY — APPROVED (final sobre el disco; `S/sec047final-report.md`)
- Identidad: `bash-guard.sh` e21e7012…, `shell_scan.py` 23efd8e0… y `verify-hooks.sh` cd011277…; `lib.sh` sin cambios desde CC2; `uchg` en los cinco hooks.
- Sonda contra el guard del disco: 192 formas, 174 con rc=2. Las 18 con rc=0 son de tres clases: controles que deben pasar; formas que bash y zsh no ejecutan; `printenv {fd}>/dev/null` (deuda aceptada TD-130) y `{f}>… printenv` (no vuelca nada).
- Deuda consolidada presentada: 5 HIGH (TD-127 a TD-131), 3 MEDIUM (TD-132, TD-133 y el resto de TD-090) y 2 LOW (xcrun en `verify-hooks.sh`, FP rc 6).
- Fuera de esa deuda no queda ningún HIGH ni CRITICAL. Bloqueos de hook: ninguno. Procesos vivos: ninguno.

### 4.4 Verificación del Orchestrator
- md5 del disco comparadas con las de la tabla de §5. `uchg` comprobado con `ls -ldO` en `.claude/hooks`, `.githooks` y `settings.json`.
- Los HIGH de CC0 (`shell_scan.py:166` y `bash-guard.sh:82`) los verifica security en la prerrevisión de CC3 (`S/sec047cc3-report.md`): «Los HIGH anteriores, shell_scan.py:167 y bash-guard.sh:88, están cerrados: 19/19 con rc=2». Esas líneas son las del kit de CC3, no las de CC0.

## 5. md5 finales del disco

| Fichero | md5 |
|---|---|
| bash-guard | e21e7012da7e73c87a8f3f6d19d9ec97 |
| shell_scan | 23efd8e0a06446ef0edc3e6a3ad0e4b1 |
| verify-hooks | cd011277cfd73f07c9628f2a623b49a8 |
| lib | afb37cc783df33d9c4a7ede03e380c62 |
| role | a1a9cc09676a11c21057a482448ef538 |
| scope | ea8b118909239c8f2c5e86c2b56f9fc1 |
| AGENTS.md | 722abce9168795ef721e3462b4b657b8 |

Sin cambios de ADR, ARCHITECTURE, SPEC ni `.claude/settings.json`. Dependencias nuevas: ninguna.

## 6. Incidencias de proceso

1. **Órdenes que el harness pasó a segundo plano.** Ocurrió en CC0 (devops y tester, tandas de más de 180 s), en CC2 y en CC3 (architect, con dos órdenes; security rev.3 lanzó dos baterías en un mismo bloque, contra la regla). Todas terminaron con exit 0. Sin procesos vivos al cierre, según los informes.
2. **Bucles de espera del tester parados por el Orchestrator.** En CC3 el tester dejó cuatro bucles `until grep -q EXIT` vivos. El Orchestrator los paró con TaskStop. Los resultados se recontaron a mano.
3. **`chflags` del devops en CC0.** `S/t047/tools/prepU.sh:12` ejecutó `chflags -R uchg` sobre el repo falso dentro de un script lanzado con `bash`; bash-guard no mira dentro de los scripts. Security lo marcó LOW, como rodeo de E9 y de `docs/AGENTS.md:62`. Solo invalida la evidencia «U simulado 934/0»: DoD 5 se sostiene con el `U` del humano y con la suite real. El repo real no se tocó. La marca sigue en `S/t047/fr/UvU/` (pendiente del humano, §8).
4. **Bloqueos literales de bash-guard, citados y no rodeados:**
   - «BLOCKED by bash-guard: destino de escritura que se calcula al ejecutar (sustitución, llaves, expansión o comodín) o que monta una barrera alrededor de una variable: no se puede revisar; escribe la ruta literal (una variable sola, > "$LOG", sí se admite)». Varias veces, en CC0 con `sed`, en CC2 y en CC3. Se rehizo con Write o con ruta literal.
   - «BLOCKED by bash-guard: escritura por shell en '…' fuera del scope de la tarea. Usa Edit/Write dentro del scope o repórtalo.» Con `steps.tsv`, `vk.sh`, `r_w.txt` y un `sed -i` relativo. Se rehizo con Write.
   - «BLOCKED by bash-guard: push/merge/rebase/reset --hard/config de git dentro de un intérprete o de una cadena (bash -c, <<<, | bash, python3…): no se ejecutan desde Claude Code (ADR-006)». Con git dentro de un heredoc de casos (CC2 y CC3) y con el `printf` del Orchestrator que contenía «git reset HEAD» (CC3). Se rehizo con Write.
   - «chflags no se usa desde Claude Code…», en el `chflags -R nouchg …/fr/UvU` del devops (CC0). Se sustituyó por el script descrito en la incidencia 3.
   - «BLOCKED by bash-guard: no se leen ficheros .env desde Claude Code (si .env es un patrón de búsqueda, escápalo: '\.env')». Lo reporta security como FP (CC0 con `grep \.env` y `cat res-*.txt | sed`; CC3 rev.4 con `sed`). No se rodeó; queda como FP reportado. No es un juicio del subagente.
5. **Observación para el humano.** En el scratchpad no hay informe de security de CC1 ni de CC2. El veredicto de security que cierra es `S/sec047final-report.md`.

## 7. Deuda registrada

| TD | Qué | Sev | Pago | Estado |
|---|---|---|---|---|
| TD-111 | HIGH (a) de TASK-045: opción calculada antes de `-c` | HIGH | TASK-047 | PAID (TASK-047) |
| TD-112 | HIGH (b) de TASK-045: prefijo de zsh más envoltorio delante de `eval` | HIGH | TASK-047 | PAID (TASK-047) |
| TD-113 | HIGH (c) de TASK-045: prefijos de zsh en C1 | HIGH | TASK-047 | PAID (TASK-047) |
| TD-085 | N-4: `${(P)x}` | MEDIUM | TASK-047 (reparto) | PAID (TASK-047) |
| TD-092 | n-1: `local` vuelca parámetros | MEDIUM | TASK-047 (reparto) | PAID (TASK-047) |
| TD-093 | n-4: 17 `nohup` superan el tope de 16 | MEDIUM | TASK-047 (reparto) | PAID (TASK-047) |
| TD-087 | `repeat`/`coproc` y `chmod` sobre hooks; ampliada: no PAID sin la prueba del humano con `uchg` | MEDIUM | TASK-047 (prueba del humano) | OPEN |
| TD-077 | Ampliada con awk `print \| "cmd"` y `\|&` | MEDIUM | TASK-046 | OPEN |
| TD-089 | Ampliada con `git reset HEAD $X` y `git switch $F main` | MEDIUM | TASK-046 | OPEN |
| TD-090 | Ampliada con `cat "${:-}"(.e)nv` y `cat "$(:)"(.e)nv` | MEDIUM | TASK-046, o `denyRead .env` en TASK-048 | OPEN |
| TD-075 | Ampliada (NIT) con `git checkout <ruta>` | MEDIUM | sin cambio | OPEN |
| TD-127 | H1 (OD-CC2-3): nombre de orden calculado | HIGH | TASK-048 + TASK-046 | OPEN |
| TD-128 | H2 (OD-CC3-1): datos que pasan a código | HIGH | TASK-048 + TASK-046 | OPEN |
| TD-129 | H3 (OD-CC3-2): argumentos de escritura con llaves, variable o comodín | HIGH | TASK-048 + TASK-046 | OPEN |
| TD-130 | H4: `{fd}>` delante de una redirección | HIGH | TASK-046 | OPEN |
| TD-131 | H5: script de `-c` en una palabra suelta | HIGH | TASK-046 | OPEN |
| TD-132 | M2: inyección aritmética, familia de TD-115 | MEDIUM | TASK-048 + TASK-046 | OPEN |
| TD-133 | M3: órdenes que lanzan otra orden sin analizar (`xargs`, `find -exec`, `cp`); junto a TD-077 y TD-078 | MEDIUM | TASK-048 | OPEN |
| TD-134 | L1: `xcrun_nocache=1` en `verify-hooks.sh` (OD-CC2-2) | LOW | TASK-046 | OPEN |
| TD-135 | L2: FP rc 6 aceptados con alternativa (OD-CC3-3); junto a TD-125 | LOW | TASK-046 | OPEN |
| TD-136 | L3: `.claude/hooks/*` no comprueba ocultos ni subdirectorios | LOW | TASK-046 | OPEN |
| TD-137 | L4: `docker exec … env` corta también en `:` | LOW | TASK-046 | OPEN |
| TD-138 | L5: unificar `san_wa` con `san_rd` | LOW | TASK-046 | OPEN |
| TD-139 | L6: `docs/AGENTS.md:82` sin `bash x.sh` | LOW | TASK-046 | OPEN |

Resumen: pagadas 3 HIGH de TASK-045 (TD-111 a TD-113) y 3 MEDIUM de TASK-044 (TD-085, TD-092 y TD-093). Nuevas 13: 5 HIGH, 2 MEDIUM y 6 LOW (TD-127 a TD-139). Ampliadas y abiertas, sin pago en esta tarea: TD-075, TD-077, TD-087, TD-089 y TD-090. TD-078 no cambia de estado; su relación con TD-133 queda escrita en esta tabla.

## 8. Pendientes del humano

1. Prueba manual de TD-087: `touch` y `chmod` sobre un hook con `uchg`. Solo después se decide si TD-087 pasa a PAID.
2. Quitar `uchg` de `S/t047/fr/UvU/` (repo falso del devops, marcado por `prepU.sh`).
3. Decisiones antiguas, pendientes sin cambios: TD-126 (LOW de security o MEDIUM del plan §16); los puntos de TASK-045 §9; ADR-013 (sigue Proposed y bloquea TASK-048); la regla deny de `.claude/settings.local.json` (TASK-048); la prueba manual de `onFailure`.
4. Ninguna tarea desbloqueada: TASK-048 sigue BLOCKED (ADR-013 y `settings.local.json`) y TASK-046 sigue BLOCKED (M1 y TASK-048).

## 9. Informes archivados (resumen)

| Tipo | Ciclo | Fichero en `S` | Veredicto |
|---|---|---|---|
| IMPLEMENTATION | CC0/CC1 | `impl047-report.md` | Kit de 13 pasos y consolidado |
| IMPLEMENTATION | CC2 | `t047cc2/COPY.md`, `t047cc2/steps.tsv` | Cadena de 10 pasos |
| IMPLEMENTATION | CC3 | `cc3-plan-impl-reports.md` | Kit rev.4 y copia del humano |
| TEST | CC0, CC1, CC2, CC3 | `test047-report.md` | PASS en todos |
| REVIEW | CC0, CC1, CC2 | `rv047-report.md` | CHANGES_REQUESTED, APPROVED (CC1), CHANGES_REQUESTED (CC2) |
| REVIEW | prerrevisión CC3, rev.3, rev.4 y final | `rv047cc3-report.md`, `rv047cc3fin-report.md` | CHANGES_REQUESTED, APPROVED, APPROVED, APPROVED |
| SECURITY | CC0 | `sec047-report.md` | BLOCKED |
| SECURITY | prerrevisión CC3, rev.3, rev.4 | `sec047cc3-report.md`, `sec047cc3r3-report.md`, `sec047cc3r4-report.md` | BLOCKED en las tres |
| SECURITY | final | `sec047final-report.md` | APPROVED |

Los informes íntegros están en el scratchpad, que se borra. Esta sección recoge lo sustancial de cada uno (veredicto, hallazgos y evidencia). La skill de informes pide archivar el texto íntegro; el encargo de cierre pidió lo sustancial, y se sigue el encargo.

Plan en el repo: `docs/reports/TASK-047-plan.md` (untracked en el momento del cierre).
