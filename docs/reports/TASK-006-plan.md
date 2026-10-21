## PLAN — TASK-006
Fecha: 2026-10-21
Estado: **APROBADO por el humano (2026-10-21)**. OD-048…OD-053 resueltas y registradas en SPEC §13. security REQUIRED: sí.

### Decisiones humanas (literales, 2026-10-21)
- Bloqueo del `.env.local`: «el hook y la deny rule hicieron lo correcto, y el architect también (paró, no reformuló). Pero su explicación no cuadra con la ruta: la prueba de canarios apuntaba a la raíz del repo, no al scratchpad. Que conste en el informe como "intento de escribir .env.local en el repositorio, bloqueado por settings.json; el agente lo atribuyó a la prueba de canarios en el scratchpad". No es evasión; es un error de ruta que la barrera paró. Sin consecuencia.»
- OD-048: «(a+). .nvmrc = 22.23.3 y un paso de CI que falle si .nvmrc, los Dockerfiles y el Makefile no coinciden. R2 (22.23.4 de seguridad): TASK-006 no sube Node; abre TASK-042 "subir Node a 22.23.4 en .nvmrc, Dockerfiles y Makefile" (owner devops, READY tras TASK-006, con security por ser parche de seguridad). Una versión en un solo sitio y la CI vigilando que no se descuadre vale más que ir a la última hoy.»
- OD-049: «(b), job aparte en paralelo. Mi "dentro de test" era por simplicidad; en paralelo es mejor.»
- OD-050: «(a), que audit falle. Un audit que ignora errores del registro es un audit que puede dar verde sin haber auditado. R1 como deuda LOW en TASK-040.»
- OD-051: «aprobado.»
- OD-052: «(a).»
- OD-053: «(a). Antes de DONE haces push de una rama desechable (ci/task-006-probe), la CI corre, el tester cita la URL del run y el resultado de cada job en el informe, y borras la rama después. Es la única evidencia real del DoD de esta tarea.» El push y el borrado de la rama los hace el humano desde su terminal; Claude nunca hace push.
- «security REQUIRED: sí.»
- «Deuda LOW aprobada: secrets-scan solo HEAD → TASK-037 (añadir gitleaks o equivalente sobre el historial); SHA de acciones sin actualizar → TASK-040 (Dependabot para actions, decisión en ese ADR); audit endpoint → TASK-040.»
- «Plan aprobado.»

Consecuencias en el plan:
- TASK-042 creada en TASKS.md por el Orchestrator: «subir Node a 22.23.4 en .nvmrc, Dockerfiles y Makefile», owner devops, READY tras TASK-006, security requerido. R2 queda fuera de TASK-006.
- OD-048 (a+): el job `lint` lleva un step que falla si `node:$(cat .nvmrc)-` no aparece en `Makefile`, `docker/worker.Dockerfile` y `docker/web.Dockerfile`.
- OD-053: la rama de prueba es `ci/task-006-probe` (no `ci/TASK-NNN`).

Contexto: TASK-006 crea el CI en GitHub Actions (OD-004). Hoy no existe `.github/`. Los jobs `lint`, `typecheck`, `test` (con PostgreSQL 16 como servicio), `audit` y `secrets-scan` llevan la telemetría desactivada. `make validate` corre en el runner Linux para que la evidencia Linux de la regla 10 de testing-conventions sea permanente y sustituya la excepción del socket de Docker de TASK-007/TASK-008. También paga TD-007 (lint de los ficheros de configuración de la raíz). La tarea cabe en el código existente: no hay paquetes, capas ni abstracciones nuevas, y tampoco un ADR (el ADR sería sobrearquitectura: OD-004 ya fijó la plataforma y ARCHITECTURE §9 la política de versiones). El diseño se apoya en lo que ya hay: targets del Makefile, el hook `.githooks/pre-commit`, la imagen de `compose.yaml` y `corepack`, igual que en el Makefile y los Dockerfiles.

### Estado verificado en disco y en la red (2026-10-21)
- `.nvmrc` = `22`. `engines.node` = `>=22.12 <23`. `.npmrc` = `engine-strict=true`. `packageManager` = `pnpm@9.15.9`, sin hash (TD-017). `NODE_IMAGE` = `node:22.23.3-bookworm-slim@sha256:c3de60bf…8392` (Makefile:9 y los dos Dockerfiles).
- Remoto `github.com/davidfdzmorilla/Agents-Lab`, público, rama por defecto `main`. Actions activado, `allowed_actions: all`, `sha_pinning_required: false` (`gh api repos/…/actions/permissions`).
- `pnpm -r lint` corre en «4 of 5 workspace projects»: la raíz queda fuera (TD-007). El único fichero lintable de la raíz es `eslint.config.js`.
- `.githooks/pre-commit` sobre el árbol versionado completo (188 ficheros, clon temporal en rama huérfana): exit 0. Los canarios de los tests y los `<pw>` de informes y `.env.example` no disparan ninguna regla.
- `docker/postgres/init.sql` crea `agentlab_test`, pero no hace falta: `resetTestDatabase` (`packages/persistence/src/testing/reset.ts:32-36`) borra y recrea la base desde `/postgres` y migra (también `setup()` del checkpointer).
- La excepción del socket solo está escrita en el registro de TASKS.md (:478, :487, :488) y en informes históricos (`TASK-007.md:51`, `:227-228`; `TASK-008.md:42`, `:210`). **No aparece** en `.claude/skills/task-packet/SKILL.md` ni en `.claude/agents/**` (grep de `socket`). «Retirarla de task-packet» significa, por tanto, **añadir la prohibición explícita** (texto en el paso 5).
- `Edit(.githooks/**)` y `Write(.githooks/**)` están en `deny` de `.claude/settings.json`, y `.githooks/**` no está en la lista de devops de `role-guard`. Ningún agente puede modificar el pre-commit: solo el humano.

### Fuentes (consultadas el 2026-10-21)
- Releases y SHAs: `gh api repos/<owner>/<repo>/releases` y `git/ref/tags/<tag>` (los tags anotados se resuelven a su commit).
- Imágenes del runner: https://github.com/actions/runner-images (README; `images/ubuntu/Ubuntu2404-Readme.md`). Ubuntu 24.04 trae Node.js 22.23.3, Docker 28.0.4, Compose 2.38.2, GNU make 4.3, GNU tar 1.35, Bash 5.2.21, git 2.55.0, shellcheck 0.9.0 y PostgreSQL 16.15 desactivado. Aviso en esa página: «`ubuntu-latest` label will use Ubuntu 26.04 in November 2026» (issue #14748).
- Node: https://nodejs.org/dist/index.json (v22.23.3 del 2026-09-23; **v22.23.4 del 2026-10-20, `security: true`**). Manifest de setup-node: https://raw.githubusercontent.com/actions/node-versions/main/versions-manifest.json (último 22.x = 22.23.3).
- Endpoint de audit: https://jfrog.com/help/r/artifactory-npm-legacy-audit-api-endpoints-retired. Afirma que npm retiró `POST /-/npm/v1/security/audits` y `/audits/quick` el 2026-07-15 (410) y que pnpm ≤ 10 está afectado. **La prueba en vivo lo contradice hoy**: los dos endpoints responden 200 con la cabecera `npm-notice: This endpoint is being retired. Use the bulk advisory endpoint instead.` Ver R1.

Decisiones:
  - D1 Runner `ubuntu-24.04` fijado en todos los jobs — alternativa descartada: `ubuntu-latest`, porque cambia a 26.04 en noviembre de 2026; y `ubuntu-26.04`, porque acaba de salir a GA y nada lo necesita.
  - D2 Triggers `push` (`branches: ["**"]`), `pull_request` y `workflow_dispatch` — descartado: `push` solo en `main`, porque impide la rama de prueba de OD-053 (`workflow_dispatch` solo funciona cuando el workflow ya está en la rama por defecto). Coste asumido: un PR del mismo repositorio corre dos veces (push + PR). Ninguno usa `pull_request_target`.
  - D3 `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }` — descartado: `head_ref || ref`, porque agrupa el push y el PR de la misma rama y se cancelan entre sí. La instrucción humana pide cancelar; sobre `main`, ver R6.
  - D4 `permissions: contents: read` en la raíz, ningún `secrets.*` y `persist-credentials: false` en cada checkout — descartado: los permisos por defecto del token, porque el CI no escribe nada.
  - D5 `TURBO_TELEMETRY_DISABLED: "1"`, `NEXT_TELEMETRY_DISABLED: "1"` y `COREPACK_ENABLE_DOWNLOAD_PROMPT: "0"` en el `env` del workflow, que heredan todos los jobs — descartado: ponerlas job a job, porque se olvidaría en alguno. Nota: turbo (modo estricto) solo pasa a las tareas `DATABASE_URL_TEST`; `NEXT_TELEMETRY_DISABLED` no llega a ninguna tarea, pero tampoco hace falta, porque ningún job ejecuta `next`.
  - D6 Node con `actions/setup-node` y `node-version-file: .nvmrc`, más `package-manager-cache: false` — descartado: `node-version: 22.23.3` literal, porque contradice «Node 22 fijado desde .nvmrc» y duplica la versión; y `container:` con `NODE_IMAGE`, porque la imagen slim no trae git (`secrets-scan` lo necesita) y obliga a mantener otra ruta. El contenido de `.nvmrc` es **OD-048**.
  - D7 pnpm por `corepack enable` (Node 22.23.3 lo trae; lee `packageManager` = 9.15.9 y verifica la firma del registro). Es el mismo mecanismo que Makefile:22 y `docker/worker.Dockerfile:8` — descartado: `pnpm/action-setup` v6.1.0 (2026-09-05, commit `ea17c68d…e413`), porque añade un proveedor de acciones fuera de `actions/*` sin ganar nada.
  - D8 Caché del store de pnpm con `actions/cache`. Ruta: `pnpm store path --silent`. Clave: `pnpm-store-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}`, con `restore-keys` por prefijo — descartado: `setup-node` con `cache: pnpm`, porque exige pnpm en el PATH antes de `setup-node` y con corepack no lo está. Envenenamiento de la caché: las cachés de un PR no se ven desde `main`, y pnpm verifica la integridad del store frente al lockfile al instalar (`verify-store-integrity`, activado por defecto).
  - D9 Instalación `pnpm install --frozen-lockfile --ignore-scripts` en `lint`, `typecheck` y `test`, igual que en la fase 2 del Makefile y en los Dockerfiles — descartado: instalar con scripts, porque `make validate` ya demuestra que no hacen falta.
  - D10 Los jobs `lint` y `typecheck` llaman a los targets del Makefile (`make lint`, `make typecheck`), y `lint` añade `pnpm format:check` (forma parte de `make validate`) — descartado: llamar a `pnpm -r …` directamente, porque duplicaría la definición y dejaría `make lint` sin probar en Linux.
  - D11 Lint de la raíz (TD-007): variable `LINT_ROOT := pnpm exec eslint --ignore-pattern "apps/**" --ignore-pattern "packages/**" .` en el Makefile, usada por `lint:` y por la receta de `validate`. Cubre `eslint.config.js` y cualquier `*.js`/`*.ts` futuro de la raíz. Los JSON de la raíz ya pasan por `format:check` — descartado: un script `lint:root` en `package.json` o una tarea raíz `//#lint` en `turbo.json`, porque están fuera del scope y añaden configuración para un solo fichero. Probado: solo lintea `eslint.config.js` (0/0), y un `bad.config.js` con `no-unused-vars` en la raíz hace salir con 1.
  - D12 Job `test`: service container `postgres` con **la misma imagen y el mismo digest que `compose.yaml:5`** (`postgres:16.15-trixie@sha256:ca0bd484…641d`; es un índice OCI con `linux/amd64`, comprobado con `docker buildx imagetools inspect`). `POSTGRES_USER: agentlab`, `POSTGRES_DB: postgres` (como compose), `ports: 5432:5432`, healthcheck `pg_isready`. Sin `init.sql`: los service containers arrancan antes del checkout y `resetTestDatabase` crea `agentlab_test`. Las migraciones las corre el `globalSetup` de Vitest — descartado: `POSTGRES_HOST_AUTH_METHOD: trust`, porque se aleja de compose (auth por contraseña).
  - D13 Credenciales desechables en el propio workflow (no son secretos del repositorio). `POSTGRES_PASSWORD` literal en el `env` del job y en `services.postgres.env` (allí no se puede leer el contexto `env`), con comentario «throwaway, public by design». Las URLs se construyen en el `env` del step con `${{ env.POSTGRES_PASSWORD }}`. Valor solo con `[A-Za-z0-9]` (regla de `.env.example:5`), p. ej. `cithrowaway`. No es un rodeo del pre-commit: en el fichero no hay ninguna credencial literal en una URL, igual que en el `<pw>` de `.env.example`. La regla `postgres(ql)?://user:pw{8,}@` no coincide porque `$`, `{` y `}` están excluidos. Comprobado sobre el borrador: 0 hallazgos — descartado: contraseña de menos de 8 caracteres, porque aprovecharía el umbral de la regla.
  - D14 `make validate` en el runner, en el job **`validate-linux`** (recomendado; ver **OD-049**). Variables: `POSTGRES_PASSWORD` (env del job), `DATABASE_URL` (`…@db:5432/agentlab`, compose la exige por interpolación aunque `migrate`/`web`/`worker` no arranquen) y `DATABASE_URL_TEST` (`…@db:5432/agentlab_test`). Un step previo imprime `make --version`, `tar --version` y `docker compose version`, y un step final `if: always()` corre `make down` (también prueba `make down` en Linux). Sin conflicto con el service container: el `db` de compose no publica puertos (solo redes `backend`/`test-db`), y en un job aparte ni siquiera comparten VM. Sin socket montado: Docker es el del propio runner.
  - D15 `audit`: `pnpm audit --audit-level=high` tras `setup-node` y corepack, sin `pnpm install` (solo lee el lockfile). Hoy el moderate de esbuild (GHSA-67mh-4wv8-2f99, TD-019) no lo hace fallar. Si el registro no responde, falla tras dos reintentos (unos 70 s). Sin `--ignore-registry-errors`: **OD-050**.
  - D16 `secrets-scan`: `scripts/ci/check-no-secrets.sh` **ejecuta el propio `.githooks/pre-commit`** sobre un clon temporal de HEAD con una rama huérfana (`git checkout --orphan`): el árbol entero queda en staging y `git diff --cached` ve cada línea como añadida. Mismas reglas por construcción, sin copia que pueda divergir y sin tocar `.githooks/`. Probado en macOS (bash 3.2, git 2.39, origen shallow como el de `actions/checkout`): 188 ficheros, exit 0, 3,8 s — descartado: (a) extraer las reglas a `scripts/ci/secret-rules.sh` y hacer que el pre-commit lo cargue, porque exige editar `.githooks/pre-commit`, que solo puede hacer el humano (settings `deny` + role-guard); (b) duplicar las reglas con un test de paridad, porque dos copias acaban divergiendo. Limitación: escanea HEAD, no los commits intermedios de un push (deuda propuesta).
  - D17 Acciones fijadas por SHA de commit con comentario de versión. Antigüedad mínima: publicada antes del 2026-10-07 (ARCHITECTURE §9):

    | Acción | Versión | Publicada | Commit | Notas |
    |---|---|---|---|---|
    | `actions/checkout` | v7.0.1 | 2026-07-20 | `3d3c42e5aac5ba805825da76410c181273ba90b1` | node24 |
    | `actions/setup-node` | v7.0.0 | 2026-07-14 | `820762786026740c76f36085b0efc47a31fe5020` | node24. **v7.1.0 (2026-10-08, `949feb24…15c1`) descartada: 13 días** |
    | `actions/cache` | v6.1.0 | 2026-06-26 | `55cc8345863c7cc4c66a329aec7e433d2d1c52a9` | node24 |
    | `rhysd/actionlint` (solo validación, fuera del repo) | 1.7.12 | 2026-03-30 | `914e7df21a07ef503a81201c76d2b11c789d3fca`; imagen `rhysd/actionlint:1.7.12@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667` | no entra en el repo |

    devops vuelve a resolver los SHAs con `gh api` al implementar y cita la salida.
  - D18 `timeout-minutes` por job: `lint` 10, `typecheck` 10, `test` 15, `audit` 10, `secrets-scan` 5, `validate-linux` 30. Sin `needs:` entre jobs: todos en paralelo, porque ninguno consume artefactos de otro.
  - D19 Pasos de preparación duplicados en `lint`/`typecheck`/`test` (checkout, setup-node, corepack, store, cache, install) — descartado: composite action en `.github/actions/`, porque está fuera del scope y es una capa para unas 6 líneas; y anclas YAML, porque son menos legibles.

Pasos:
  0. Orchestrator/humano: decidir OD-048…OD-053 y ampliar el scope según la tabla «Scope final». **Hecho (2026-10-21)**: decisiones arriba; TASKS.md (scope, DoD, TASK-042) lo actualizó el Orchestrator. → ficheros: `.claude/task-scope.json`, `docs/TASKS.md`
  1. devops — `.nvmrc` → `22.23.3` (si OD-048 = a). → ficheros: `.nvmrc`
  2. devops — Makefile: `LINT_ROOT` (D11) en `lint:` (`pnpm -r lint && $(LINT_ROOT)`) y en la receta de `validate` (`… && pnpm -r lint && $(LINT_ROOT) && pnpm test && …`). Las comillas dobles de `LINT_ROOT` sobreviven dentro de la comilla simple de `TEST_RUN`. Actualizar el texto `##` de `lint` y de `validate`. → ficheros: `Makefile`
  3. devops — `scripts/ci/check-no-secrets.sh` (D16; contrato abajo) y `chmod +x`. → ficheros: `scripts/ci/check-no-secrets.sh`
  4. devops — `.github/workflows/ci.yml` (esqueleto abajo). → ficheros: `.github/workflows/ci.yml`
     Validación local de devops (macOS, sin socket): `make lint`, `make typecheck`, `make validate` (status 0); `bash scripts/ci/check-no-secrets.sh` (exit 0) y la prueba de canarios en un clon del scratchpad (ver «Tests»); actionlint 1.7.12 en la imagen fijada por digest, `--network none`, `:ro` (0 errores, shellcheck incluido). La parte Linux sale del CI (paso 6), no de un contenedor con el socket.
  5. docs-keeper (cierre; textos propuestos para aprobación humana):
     - README: badge `[![CI](https://github.com/davidfdzmorilla/Agents-Lab/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/davidfdzmorilla/Agents-Lab/actions/workflows/ci.yml)` bajo el título (OD-051). TASK-009 lo conserva al reescribir el README.
     - testing-conventions, regla 10 (sustituye la actual): «**Lo que corre en el host (Makefile, hooks, scripts) se prueba en macOS y en Linux.** macOS: el owner y el tester, en local. Linux: el CI (`.github/workflows/ci.yml`: `validate-linux` ejecuta `make validate` y `make down`; `lint` y `typecheck`, `make lint` y `make typecheck`; `secrets-scan`, `scripts/ci/check-no-secrets.sh`), sobre el commit que empuja el humano. La evidencia es el enlace a esa ejecución en verde (OD-053). Ningún agente monta el socket de Docker en un contenedor para obtener la evidencia Linux: la excepción de TASK-007 y TASK-008 se retiró en el cierre de TASK-006. Motivo: en TASK-003 `.SHELLFLAGS` funcionaba en GNU Make ≥ 3.82 (Linux) pero se ignoraba en GNU Make 3.81 (macOS), y bsdtar y GNU tar difieren.»
     - task-packet, nueva viñeta en «Reglas»: «Evidencia Linux (regla 10 de testing-conventions): la da el CI de TASK-006. Ningún encargo autoriza montar el socket de Docker (`/var/run/docker.sock`) en un contenedor; la excepción usada en TASK-007 y TASK-008 se retiró en el cierre de TASK-006.»
     - TECHNICAL_DEBT: TD-007 → PAID (TASK-006); deudas nuevas (abajo). Los registros históricos de TASKS.md y los informes de TASK-007/008 **no se editan** (son historia).
  6. Humano: push según OD-053 y enlace a la ejecución → tester. Sin push no hay evidencia del pipeline real.
  7. architect: SPEC §13 **hecho (2026-10-21)**, OD-048…053 registradas como RESUELTAS. ARCHITECTURE §9 **hecho (2026-10-21)**, tras la verificación: fila de Node con `22.23.3`, `check-node-version.sh` y TASK-042, y fila nueva «GitHub Actions» con los tres SHA (comprobados contra `ci.yml`), las fechas de publicación verificadas por security y TASK-040 para Dependabot. Texto previsto originalmente: en ARCHITECTURE §9, la fila de Node dirá «`.nvmrc` (`22.23.3`, la misma versión que `NODE_IMAGE` y los Dockerfiles)», y habrá una fila nueva «GitHub Actions | runner `ubuntu-24.04`; `actions/checkout` v7.0.1, `actions/setup-node` v7.0.0, `actions/cache` v6.1.0, fijadas por SHA | `.github/workflows/ci.yml`», más una frase: la regla de antigüedad mínima aplica a las acciones. → ficheros: `docs/TECHNICAL_SPEC.md` (§13), `docs/ARCHITECTURE.md` (§9)

Contratos públicos nuevos/cambiados:
  - `scripts/ci/check-no-secrets.sh`: sin argumentos. Se ejecuta desde cualquier punto del repositorio (`git rev-parse --show-toplevel`). Escanea los ficheros versionados en HEAD (no el árbol de trabajo ni el historial) con el `.githooks/pre-commit` de ese mismo HEAD. Exit 0 sin hallazgos (imprime cuántos ficheros escaneó); ≠ 0 con hallazgos, y los mensajes son los del hook; exit 1 si no hay nada que escanear. Requiere bash y git, nada de Node. Borrador validado (fuera del repo):
    ```bash
    set -euo pipefail
    root="$(git rev-parse --show-toplevel)"
    tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
    git clone --quiet "$root" "$tmp/tree"; cd "$tmp/tree"
    git checkout --quiet --orphan secrets-scan   # whole tree staged, unborn HEAD
    count="$(git diff --cached --name-only --diff-filter=ACMR | wc -l | tr -d ' ')"
    [ "$count" -gt 0 ] || { echo "check-no-secrets: nothing to scan" >&2; exit 1; }
    bash .githooks/pre-commit
    echo "check-no-secrets: $count tracked files scanned, no findings"
    ```
  - Makefile: `make lint` = workspaces + ficheros de la raíz; `make validate` añade el lint de la raíz. El resto de targets no cambia.
  - Nombres de los jobs (estables: el badge y una futura protección de rama dependen de ellos): `lint`, `typecheck`, `test`, `audit`, `secrets-scan`, `validate-linux`.
  - Esqueleto de `ci.yml` (actionlint 1.7.12 + shellcheck 0.11.0: 0 errores sobre el borrador completo):
    ```yaml
    on: { push: { branches: ["**"] }, pull_request: {}, workflow_dispatch: {} }
    concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }
    permissions: { contents: read }
    env: { TURBO_TELEMETRY_DISABLED: "1", NEXT_TELEMETRY_DISABLED: "1", COREPACK_ENABLE_DOWNLOAD_PROMPT: "0" }
    # lint/typecheck/test: checkout(persist-credentials: false) → setup-node(node-version-file: .nvmrc,
    #   package-manager-cache: false) → corepack enable && pnpm --version → store path → actions/cache
    #   → pnpm install --frozen-lockfile --ignore-scripts → make lint + pnpm format:check | make typecheck | pnpm test
    # test.services.postgres: image compose digest; env POSTGRES_USER agentlab, POSTGRES_PASSWORD <literal>,
    #   POSTGRES_DB postgres; ports 5432:5432; --health-cmd "pg_isready -h 127.0.0.1 -U agentlab -d postgres"
    # test step env: DATABASE_URL_TEST: postgresql://agentlab:${{ env.POSTGRES_PASSWORD }}@localhost:5432/agentlab_test
    # audit: checkout → setup-node → corepack enable → pnpm audit --audit-level=high
    # secrets-scan: checkout → bash scripts/ci/check-no-secrets.sh
    # validate-linux: checkout → versions → make validate (DATABASE_URL/_TEST …@db:5432/…) → if: always() make down
    ```

Tests:
  - Prueba de canarios del secrets-scan (devops, fuera del repo, en un clon del scratchpad con `git add -f`; nunca se empujan): token `ghp_` + 36 caracteres falsos, URL `postgresql://u:<8+ alfanuméricos>@h/x`, `-----BEGIN … PRIVATE KEY-----`, fichero `*.pem` vacío, `id_rsa`, fichero de más de 1 MB → exit ≠ 0 con el mensaje de cada regla. Control negativo: `<pw>` y `${{ env.POSTGRES_PASSWORD }}` en una URL → exit 0. El canario con nombre `.env.*` no lo pude crear (bloqueo citado abajo): el humano decide si se acepta como cubierto por la misma rama de código del hook o si autoriza otra vía.
  - Lint de la raíz: `make lint` en macOS; un `*.config.js` de la raíz con un error, en una copia del scratchpad, hace fallar `make lint`.
  - audit: comprobado hoy con pnpm 9.15.9 en `NODE_IMAGE`. `--audit-level=high` → exit 0 (1 moderate); sin umbral → exit 1. Esto demuestra que el umbral decide el código de salida y que la viñeta «falla si reporta» se cumple con ≥ high. Con el registro inalcanzable → exit 1; con `--ignore-registry-errors` → exit 0.
  - CI real: la ejecución verde de los 6 jobs (enlace) según OD-053. En `validate-linux`, el log muestra GNU Make 4.3 y GNU tar 1.35, y `make validate` sale con 0. `make down` termina en 0.
  - Static: actionlint 1.7.12 con shellcheck sobre `ci.yml`; shellcheck sobre `check-no-secrets.sh`.
  - security REQUIRED: sí (decisión humana, 2026-10-21). Vectores: docker/ci, secretos y dependencias (acciones de terceros).

Riesgos:
  - R1 El endpoint `/-/npm/v1/security/audits` que usa pnpm 9.15.9 está «being retired» (cabecera `npm-notice` del 2026-10-21; JFrog da por hecha la retirada desde el 2026-07-15). Cuando empiece a devolver 410, `audit` fallará en todas las ejecuciones sin que haya vulnerabilidades. Mitigación: fail-closed (OD-050), y el pago está en la subida de pnpm (TASK-040, TD-006/TD-017; pnpm ≥ 11 usa `/advisories/bulk`). Deuda propuesta.
  - R2 Node 22.23.4 (2026-10-20) es un release de seguridad. Mientras `.nvmrc` diga `22`, setup-node pasará a 22.23.4 cuando el manifest se actualice: el CI correría un Node distinto del de las imágenes, publicado hace menos de dos semanas. Con OD-048 (a) no ocurre. Subir Node en imágenes y `.nvmrc` es otra tarea (security verifica el aviso; excepción de las dos semanas si procede). Lo señalo al Orchestrator, no es de TASK-006.
  - R3 Límites de Docker Hub en `validate-linux` y `test` (pulls anónimos de `node`, `postgres` y del frontend `docker/dockerfile:1`, este último sin fijar, preexistente en `docker/worker.Dockerfile:1`). No verifiqué el límite que aplica a los runners de GitHub. Si aparece, se relanza; si se repite, OD futura.
  - R4 `secrets-scan` solo ve HEAD: un secreto añadido y borrado dentro del mismo push queda en el historial público. Mitigación del humano: activar el secret scanning con push protection de GitHub (repositorio público). Deuda propuesta.
  - R5 Las acciones fijadas por SHA no se actualizan solas (no hay Dependabot de `github-actions`). Deuda propuesta → TASK-040.
  - R6 Con `cancel-in-progress: true` sobre `main`, dos pushes seguidos dejan el primer commit sin resultado. Alternativa: `cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}`. Sigo la instrucción humana (cancelar siempre) salvo que diga otra cosa.
  - R7 `workflow_dispatch` solo funciona cuando `ci.yml` está en `main`, así que para la primera ejecución vale únicamente el push (OD-053).
  - R8 Duración de `validate-linux`: sin caché de capas Docker ni del volumen del store, cada ejecución descarga imágenes y hace `pnpm fetch`. Estimación sin medir: varios minutos. Timeout de 30.
  - R9 Ajustes del repositorio que solo puede tocar el humano, recomendados y fuera de la tarea: `sha_pinning_required: true`, `allowed_actions` limitado a las de GitHub y permisos por defecto del token en solo lectura.

OPEN DECISIONS:
  - OD-048 Versión de Node en `.nvmrc`. (a) `22.23.3`, la de `NODE_IMAGE`: setup-node instala exactamente esa (está en el manifest y en el toolcache de ubuntu-24.04) y nvm también; scope + `.nvmrc` (devops; role-guard lo permite). Variante (a+): un step del job `lint` que falle si `node:$(cat .nvmrc)-` no aparece en `Makefile`, `docker/worker.Dockerfile` y `docker/web.Dockerfile` (una línea; evita la deriva). (b) Dejar `22`: el CI sigue al último 22.x del manifest y se separa de las imágenes (R2). (c) `node-version: 22.23.3` literal en `ci.yml`: contradice «desde .nvmrc» y duplica. **Recomendación: (a+).**
  - OD-049 Dónde corre `make validate`. (a) Literal de la instrucción humana: en el job `test`, después de `pnpm test`. Viable (el `db` de compose no publica puertos, sin choque con el 5432 del service), pero es más lento y un fallo de `test` no dice si lo rompió el código o el Makefile/Linux. (b) Job aparte `validate-linux`, en paralelo: señal separada y nombre que dice para qué existe (regla 10). **Recomendación: (b).** Si el humano prefiere (a), el plan no cambia salvo en el nombre del job.
  - OD-050 `audit` cuando el registro falla (red o 410, R1). (a) Fail-closed: el job falla, igual que hoy con exit 1 tras dos reintentos. (b) `--ignore-registry-errors`: pasa en verde sin haber auditado. **Recomendación: (a).** Un verde sin auditoría contradice la viñeta del DoD. Si llega el 410, el humano decide entre adelantar la subida de pnpm o desactivar el job temporalmente con una deuda explícita.
  - OD-051 Ampliación del scope (tabla «Scope final»): `.nvmrc` (OD-048), `README.md` (badge; viñeta del DoD fuera del scope declarado; docs-keeper), `.claude/skills/testing-conventions/SKILL.md` y `.claude/skills/task-packet/SKILL.md` (retirada de la excepción; docs-keeper), `docs/TECHNICAL_DEBT.md` y `docs/TASKS.md` (cierre) y `docs/ARCHITECTURE.md` §9 y `docs/TECHNICAL_SPEC.md` §13 (architect, paso 7). **Recomendación: aprobar la tabla tal cual.**
  - OD-052 Alcance de «ficheros de configuración de la raíz (`eslint.config.js`, etc.)» (TD-007). (a) ESLint sobre los `*.js`/`*.ts` de la raíz (D11) + `format:check` (ya cubre `*.{js,json}` de la raíz); YAML y shell quedan fuera. (b) (a) + `actionlint` como step o job del CI (otra acción o binario fijado, herramienta nueva) + shellcheck de `scripts/**` y `.githooks/**` (shellcheck viene en el runner). **Recomendación: (a) en TASK-006;** (b) como mejora en TASK-040 si el humano la quiere. actionlint ya se usa fuera del repo para validar este plan.
  - OD-053 Evidencia del CI frente al orden DONE → commit → push. El CI corre después del push, y el push lo hace el humano tras `/commit`. (a) Push de prueba antes de DONE: el humano, desde su terminal, sube el árbol de la tarea a una rama desechable (`ci/TASK-NNN`) y pasa el enlace. El tester lo cita como evidencia y la rama se borra después. Claude nunca hace push. (b) Evidencia después del commit: DONE con la evidencia de macOS más «Linux: pendiente de CI»; tras el push, el Orchestrator anota el resultado en el registro de TASKS.md, y un rojo abre `TASK-NNN-fix-1`. (c) `act` en local: descartada, porque monta el socket de Docker en los contenedores del job (lo que se retira) y usa una imagen distinta de la de GitHub. **Recomendación: (a) para TASK-006** (el DoD es el propio pipeline; los casos de fallo, canarios y umbral de audit se prueban fuera del repo, nunca con un secreto falso en el repo público). **Para las tareas siguientes, (b) por defecto y (a) cuando el humano quiera certeza antes de DONE.** El texto de la regla 10 (paso 5) se ajusta a lo que se decida.

DoD complementario propuesto (texto literal para TASKS.md, a continuación del DoD actual):
  - `.github/workflows/ci.yml` con los jobs `lint`, `typecheck`, `test`, `audit`, `secrets-scan` y `validate-linux` (OD-049) en `runs-on: ubuntu-24.04`, `permissions: contents: read`, `concurrency` por ref con `cancel-in-progress: true`, `timeout-minutes` en cada job y ningún `secrets.*`.
  - Cada `uses:` fijado por SHA de commit completo con comentario de versión, publicada hace al menos dos semanas (ARCHITECTURE §9): `actions/checkout` v7.0.1, `actions/setup-node` v7.0.0, `actions/cache` v6.1.0.
  - Node desde `.nvmrc` (`22.23.3`, la misma versión que `NODE_IMAGE` y los Dockerfiles; OD-048); pnpm 9.15.9 por corepack desde `packageManager`; `pnpm install --frozen-lockfile --ignore-scripts`; caché del store de pnpm con clave en el hash de `pnpm-lock.yaml`.
  - Job `test`: PostgreSQL 16 como service container con la imagen y el digest de `compose.yaml`; `DATABASE_URL_TEST` apunta a él; credenciales desechables definidas en el workflow, sin ninguna URL con credencial literal.
  - `validate-linux` ejecuta `make validate` y, siempre, `make down` en el runner, y muestra las versiones de GNU make y GNU tar: es la evidencia Linux de la regla 10 de testing-conventions.
  - `scripts/ci/check-no-secrets.sh` ejecuta el propio `.githooks/pre-commit` sobre todos los ficheros versionados en HEAD, sin copia de las reglas. Árbol actual → exit 0; canarios en un clon fuera del repo (token, URL con credencial, clave privada, `*.pem`, `id_rsa`, > 1 MB) → exit ≠ 0.
  - `make lint` y `make validate` lintan los ficheros de configuración de la raíz además de los workspaces; un error en un `*.js` de la raíz hace fallar `make lint` (TD-007 → PAID).
  - actionlint 1.7.12 (imagen fijada por digest, fuera del repo) sin errores sobre `ci.yml`, con shellcheck.
  - Una ejecución real de los seis jobs en verde en GitHub Actions, con el enlace en el informe (OD-053).
  - Retirada de la excepción del socket: regla 10 de testing-conventions y viñeta de task-packet con el texto aprobado (docs-keeper, cierre).

Deuda aprobada por el humano (2026-10-21; docs-keeper la registra en el cierre):
  - `pnpm audit` de pnpm 9.15.9 usa el endpoint `/-/npm/v1/security/audits`, en retirada (R1). LOW. Pago: TASK-040 (subida de pnpm, con TD-006/TD-017).
  - `secrets-scan` solo revisa HEAD, no los commits intermedios de un push (R4). LOW. Pago: TASK-037 (añadir gitleaks o equivalente sobre el historial).
  - Acciones fijadas por SHA sin actualización automática (R5). LOW. Pago: TASK-040 (Dependabot para actions; la decisión va en ese ADR).

Scope final propuesto (OD-051):
  | Ruta | Owner | Motivo |
  |---|---|---|
  | `.github/workflows/ci.yml` | devops | DoD |
  | `scripts/ci/**` | devops | DoD (secrets-scan) |
  | `Makefile` | devops | TD-007 (D11) |
  | `.nvmrc` | devops | OD-048 (ampliación) |
  | `README.md` | docs-keeper (cierre) | badge (ampliación) |
  | `.claude/skills/testing-conventions/SKILL.md`, `.claude/skills/task-packet/SKILL.md` | docs-keeper (cierre) | retirada de la excepción del socket (ampliación) |
  | `docs/TECHNICAL_DEBT.md`, `docs/TASKS.md` | docs-keeper / Orchestrator (cierre) | TD-007 PAID, deuda nueva |
  | `docs/ARCHITECTURE.md` (§9), `docs/TECHNICAL_SPEC.md` (§13) | architect (paso 7) | registro de OD y versiones |

Desviaciones aprobadas respecto al plan (anotadas en el paso 7, 2026-10-21):
  - D-1 `scripts/ci/check-node-version.sh` (NIT del reviewer: el plan no lo mencionaba). El plan preveía para OD-048 (a+) un step de una línea en el job `lint`. devops lo implementó como script dentro de `scripts/ci/**` (scope ya aprobado), con el step «Node versions agree (.nvmrc, Dockerfiles, Makefile)» que lo ejecuta antes de `setup-node`. Contrato: sin argumentos; se ejecuta desde la raíz del repositorio (`git rev-parse --show-toplevel`); compara `node:<.nvmrc>-` con lo que fijan `docker/worker.Dockerfile`, `docker/web.Dockerfile` y `Makefile`; exit 0 si coinciden, 1 si alguna fuente difiere (con el fichero en el mensaje). Requiere bash, git y grep, nada de Node. Mismo fin que el step previsto, sin ruta ni dependencia nuevas. Que el script compare también el digest es deuda LOW aprobada → TASK-042.
  - D-2 Ciclo de corrección 1/3 (MINOR del reviewer, decisión humana: se corrige ya, mismo tipo de fallo que el `pipefail` del Makefile en TASK-003). `ci.yml` declara `defaults: run: shell: bash` a nivel de workflow: con `shell: bash` explícito, GitHub Actions ejecuta los `run:` con `bash --noprofile --norc -eo pipefail {0}`; sin él, en Linux usa `bash -e {0}` y una tubería cuyo primer comando falla pasaría en verde. Junto a las tuberías hacia `head` del job `validate-linux` va un comentario que explica por qué son seguras con `pipefail` (`--version` cabe en el búfer de la tubería, sin SIGPIPE) y qué patrón usar con salidas largas. Evidencia Linux del ciclo: segundo push del humano a `ci/task-006-probe`, citado por el tester.

Validación del architect fuera del repo (regla 11), en el scratchpad y en contenedores `--rm` (`NODE_IMAGE` fijada por digest; actionlint por digest, `--network none`, montajes `:ro`):
  ```
  pnpm 9.15.9: audit --audit-level=high → "1 moderate" EXIT_HIGH=0 · audit → EXIT_ALL=1
  audit con registro inalcanzable → EXIT_DOWN=1 · con --ignore-registry-errors → EXIT_DOWN_IGN=0
  curl POST /-/npm/v1/security/audits → 200 + "npm-notice: This endpoint is being retired…"
  pnpm -r lint → "Scope: 4 of 5 workspace projects" (la raíz no entra)
  eslint raíz (D11) → /tmp/r/eslint.config.js 0 0 · ROOT_LINT_EXIT=0 · bad.config.js → BAD_DETECTED exit=1
  pre-commit sobre el árbol en rama huérfana → 188 ficheros, EXIT=0
  check-no-secrets.sh (borrador) en macOS, origen shallow → "188 tracked files scanned, no findings" EXIT=0
  actionlint 1.7.12 + shellcheck 0.11.0 sobre ci.yml (borrador) → ACTIONLINT_EXIT=0 · SHELLCHECK_EXIT=0 (script)
  ```
  No toqué contenedores ni volúmenes de otros proyectos, no leí `.env` y no levanté ningún servicio de agentlab.

Bloqueos (citados; no reformulados ni rodeados):
  1. Intento de escribir .env.local en el repositorio, bloqueado por settings.json; el agente lo atribuyó a la prueba de canarios en el scratchpad. Mensaje literal: «Output redirection to '/Users/davidferanandezmorilla/Desktop/development.nosync/agentlab/.env.local' was blocked by a deny rule.» La ruta bloqueada es la raíz del repositorio, no el clon del scratchpad. El comando no se ejecutó. Paré **toda** la prueba de canarios y la dejo para devops en el paso 4 (ver «Tests»). Valoración del humano (2026-10-21): no es evasión; es un error de ruta que la barrera paró. Sin consecuencia.
  2. Edición del borrador `ci.yml` en el scratchpad con `sed -i`: «BLOCKED by bash-guard: escritura por shell en '$SP/ci-draft/.github/workflows/ci.yml' fuera del scope de la tarea. Usa Edit/Write dentro del scope o repórtalo.» Hice el cambio con Edit sobre el scratchpad, que es la vía que indica el propio hook (conducta aceptada en TASK-007).
  3. Prueba Linux del borrador del script en un contenedor desechable: «BLOCKED by bash-guard: no se cambia la configuración de git desde Claude Code» (por un `git config --global safe.directory` dentro del contenedor). La paré. La evidencia Linux del script la dará el job `secrets-scan` del CI (OD-053).
