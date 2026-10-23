# TASK-006-fix-4 — La guarda de `.env` se salta en CI (main rojo en 85e4d2e)

| Campo | Valor |
|---|---|
| Tarea | TASK-006-fix-4 |
| Hito | M0 (hotfix sobre TASK-006-fix-2) |
| Owner | devops |
| Fecha | 2026-10-22 (fecha del encargo del Orchestrator; docs-keeper no ejecuta `date`) |
| Estado final | **DONE** (CI verde en el push de 595d43a: https://github.com/davidfdzmorilla/Agents-Lab/actions/runs/39826608260) |
| Veredictos | tester PASS (viñetas 1-3; 4 n/a; 5 cumplida con el run de CI) · reviewer APPROVED (inicial y ciclo 1) · security APPROVED |
| Plan | Ninguno (decisión humana) |
| Severidad | LOW (hotfix: main en rojo) |

## Origen

El CI de `main` en 85e4d2e estaba en rojo: `validate-linux` fallaba en el paso ENV_CHECK con «missing .env». En CI las variables llegan por el entorno del job/step (`.github/workflows/ci.yml:148-150, :166-168`), no desde un `.env`, así que la guarda de TASK-006-fix-2 no debía exigir el fichero cuando `CI` está definida.

## DoD (texto enmendado)

Las viñetas son las del encargo, con la retirada registrada al final.

1. `ENV_CHECK` se salta cuando `CI` está definida: `[ -n "$$CI" ] || [ -f $(ENV_FILE) ] || { echo "…"; exit 1; }`. GitHub Actions pone `CI=true` siempre: no se toca el workflow. No se acepta `cp .env.example .env` en CI. Mensaje en inglés; una línea de comentario encima explicando el salto.
2. `make ENV_FILE=.no-such-env validate` → falla con el mensaje (sin CI).
3. `make -n validate` no muestra ningún valor.
4. Reviewer: además del diff, cita las líneas de `.github/workflows` que invocan `make test` y `make validate` y confirma que ninguna exige `.env`. Regla permanente: cualquier cambio en un target de Makefile que invoque la CI se revisa contra sus llamadas en `.github/workflows`.
5. Evidencia final: CI verde en el push de fix-4 (prueba de que la guarda se salta en CI; la viñeta 2 prueba que dispara sin CI). Hasta entonces la tarea no se cierra: queda VERIFIED pendiente de CI y el informe lo dice.
- **Retirada (decisión humana)**: «`env CI=true make -n ENV_FILE=.no-such-env validate` no falla en la guarda» — `make -n` no ejecuta la guarda, no prueba nada.
- Informe: primera nota, incidencia del reviewer en fix-2 (aprobó sin mirar los call sites de CI).
- Entra también en el commit de fix-4: fila del registro pendiente (`TASK-006-fix-2 commit 85e4d2e`), redacción de `docs/reports/TASK-005.md:409` (placeholder `<redacted>`, el mismo del informe de TASK-003, que pre-commit exime) y `.claude/hooks/bash-guard.sh:159` (mensaje; lo edita el humano a mano).

## Resumen del diff

| Fichero | Líneas | Cambio |
|---|---|---|
| `Makefile` | 26-28 | Comentarios reescritos (ciclo 1): local, `.env` del operador; CI, env de job/step; `ENV_FILE` solo sobreescribible para probar la guarda. |
| `Makefile` | 30 | Comentario de ENV_CHECK: «the variables come from the job/step env, not from a .env file, so the guard is skipped». |
| `Makefile` | 31 | `ENV_CHECK := [ -n "$$CI" ] || [ -f "$(ENV_FILE)" ] || { echo "missing $(ENV_FILE): run 'cp .env.example .env' and fill it in (make test/validate read credentials from it)" >&2; exit 1; }` |
| `Makefile` | 72 | Ayuda de `test`: «(requiere .env fuera de CI; deja db en marcha, make down la para)». |
| `.claude/hooks/bash-guard.sh` | 159 | Solo el texto del mensaje de `block` (1 línea −/+), editado a mano por el humano. `:158` (regex e `if`) intacto. ADR-006: ningún agente edita hooks. |
| `docs/reports/TASK-005.md` | 409 | Valor de la contraseña desechable sustituido por `<redacted>` (3 apariciones en la línea). |
| `.claude/skills/monorepo-conventions/SKILL.md` | nueva sección «Makefile y CI» | Regla permanente de revisión contra `.github/workflows`. |
| `docs/TASKS.md` | cabecera, estado de la tarea, fila nueva al final | Estado VERIFIED (pendiente de CI); sin desbloqueos. |
| `docs/reports/TASK-006-fix-4.md` | nuevo | Este informe. |

Los números de línea del Makefile son los de la versión final tras el ciclo 1 (`:30` y `:31`; la entrega inicial los tenía en `:29`/`:30`, ver notas).

## Informes archivados

Fidelidad: el REVIEW inicial y los veredictos son los del revisor. Los bloques IMPLEMENTATION, TEST y SECURITY y los del ciclo 1 son resúmenes fieles del Orchestrator (el encargo de cierre no llevó los textos íntegros, como exige `/close-task`). En el REVIEW inicial, `docs-keeper` completó a partir del resumen el «qué cambiar» de los MINOR y la línea de cumplimiento. El Orchestrator lo detectó y lo sustituyó por el texto del revisor.

### IMPLEMENTATION (devops, entrega inicial)

```
Hecho: la guarda `ENV_CHECK` se omite cuando `CI` está definido; workflow sin tocar; mensaje igual.
Ficheros: modificados Makefile.
Diff: + comentario «# In CI (GitHub Actions sets CI=true) the variables come from the job env, not from a .env file, so the guard is skipped.»; `ENV_CHECK := test -f "$(ENV_FILE)" || {…}` → `ENV_CHECK := [ -n "$$CI" ] || [ -f "$(ENV_FILE)" ] || { echo "missing $(ENV_FILE): run 'cp .env.example .env' and fill it in (make test/validate read credentials from it)" >&2; exit 1; }`.
DoD: (1) cumplido; (2) `env -u CI make ENV_FILE=.no-such-env validate` → «missing .no-such-env: run 'cp .env.example .env' and fill it in (make test/validate read credentials from it)», «make: *** [validate] Error 1», EXIT=2; (3) `env CI=true make -n ENV_FILE=.no-such-env validate` → EXIT=0; con -n make no ejecuta la guarda; la prueba real es la CI (viñeta retirada después por el humano); (4) `make -n validate` solo nombres de variables y rutas; salida truncada a 200 caracteres; EXIT vacío porque PIPESTATUS no se expandió en zsh (fallo de su comando de medida). Sin bloqueos; no leyó .env.
Desviaciones/fuera de scope/deps/OD/deuda: ninguna.
```

### TEST (tester): PASS

```
Comandos exactos, sin bloqueos. `git diff -- Makefile` coincide.
`env -u CI make ENV_FILE=.no-such-env validate; echo "EXIT=$?"` → mensaje, `make: *** [validate] Error 1`, EXIT=2.
`make -n validate; echo "EXIT=$?"` → `[ -n "$CI" ] || [ -f ".env" ] || {…}`, docker volume create…, pnpm fetch…, compose run … `: "${DATABASE_URL_TEST:?…}"`, EXIT=0.
Valores: ninguno (solo `$CI` sin expandir, `DATABASE_URL_TEST`, `${DATABASE_URL_TEST:?…}`, rutas, digest, flags).
DoD: 1 cumplida, 2 cumplida, 3 cumplida, 4 n/a (reviewer), 5 PENDING.
Sin incidentes (sin host Node, sin .env, sin ediciones).
```

### REVIEW (reviewer, inicial): APPROVED

```
Nota previa: el humano registró como primera nota mía que en TASK-006-fix-2 aprobé ENV_CHECK sin mirar los call sites de .github/workflows. Desde ahora aplico la regla permanente del punto 4; abajo van las citas.
Hallazgos:
  - [MINOR] Makefile:26-28 — «Credentials come only from the operator's .env» y «compose always reads the project .env» ya no son ciertos tras Makefile:30 (en CI no hay .env; las variables llegan por el entorno). Qué cambiar: «only from the operator's .env (or the CI job env)» y «reads the project .env when present». Fuera de la línea de comentario que pedía el DoD, así que lo propongo ahora o como deuda.
  - [MINOR] Makefile:72 — la ayuda dice «(requiere .env; …)», que ya no es cierto en CI. Qué cambiar: «(requiere .env fuera de CI; …)». Puede ir junto con el anterior.
  - [NIT] Makefile:30 — «job env» → «job/step env» (DATABASE_URL/DATABASE_URL_TEST vienen del step ci.yml:166-168; POSTGRES_PASSWORD del job ci.yml:148-150).
  - [NIT] numeración 29/30 vs real 30/31.
Puntos extra: `$$CI` con CI="" sigue disparando (`env CI= make ENV_FILE=.no-such-env validate` → mensaje, EXIT=2); CI=false local lo salta pero es aviso temprano, no barrera: compose falla por `:?` (compose.yaml:8, :32, :55, :76) y por el `:?` de DATABASE_URL_TEST (Makefile:25).
Call sites (único workflow `.github/workflows/ci.yml`): `make test` no se llama (ci.yml:117 `pnpm test` en el host); `make validate` en ci.yml:165 (job validate-linux): CI no definido ni sobrescrito (env global :20-23, job :148-150, step :166-168); variables: POSTGRES_PASSWORD (job :150), DATABASE_URL (step :167), DATABASE_URL_TEST (step :168). `make lint` (:50), `make typecheck` (:75) sin ENV_CHECK (Makefile:84-88); `make down` (:171) usa COMPOSE_FILLER (Makefile:61, 64). compose.yaml sin `env_file:`; obligatorias por `:?` POSTGRES_PASSWORD (:8), DATABASE_URL (:32, :55, :76); DATABASE_URL_TEST `${DATABASE_URL_TEST:-}` (:107). `.dockerignore:16-21` excluye `.env*`; HOST_TAR también (Makefile:17). Hook: numstat 1/1, :158 intacta, :159 solo texto.
Evidencia repetida: EXIT=2 con mensaje; `make -n validate` EXIT=0 sin valores.
Cumplimiento: SPEC ✅ · ARCHITECTURE ✅ · ADRs ✅ · DoD ✅ (puntos 1-4; el 5 sigue pendiente de CI y no me toca) · plan ✅
Sobrearquitectura detectada: ninguna
Deuda propuesta: TD-? — los comentarios de Makefile:26-28 y la ayuda de Makefile:72 no contemplan el caso CI — severidad LOW — pagar en la próxima tarea que toque el Makefile, o ahora si el Orchestrator lo mete en este ciclo. (Pagada en el ciclo 1 por decisión humana.)
Requiere security: sí. El diff toca .claude/hooks/bash-guard.sh (garantías de dev) y el comportamiento de un target que llama CI; riesgo bajo: en el hook solo cambia el texto y la guarda no es una barrera de seguridad.
Veredicto: APPROVED
```

### SECURITY: APPROVED

```
Vectores revisados: secretos, inyección, SSRF, presupuesto, autoaprobación, docker/ci, garantías dev, dependencias.
Saltar la guarda con CI no debilita nada: ENV_CHECK solo comprueba existencia del fichero; credenciales siguen llegando solo por entorno (local: compose interpola desde .env con `${VAR:?}`; CI: env de job/step ci.yml:148-150, :166-168); con CI definido en local sin .env, compose sigue fallando por `:?`.
Ningún camino nuevo para imprimir/interpolar/escribir credenciales: no se crea .env, no hay `cp .env.example .env` en ci.yml; `$$CI` solo comprueba vacío; el tar excluye `.env`, `.env.*`, `*.env`, `.env-*`, `.env_*`, `.envrc`.
La contraseña desechable de CI (ci.yml:150) ya estaba en main y es desechable por diseño.
Hook: 1 línea −/+ en el argumento de `block` de :159; regex e `if` de :158 sin cambios; mensaje correcto y sin credenciales. `make -n validate` sin valores. task-scope.json pasa a lista cerrada (restringe).
Sin dependencias nuevas.
Hallazgos:
  - [LOW] Makefile:26-28 — comentarios que contradicen la guarda en CI — corrección = MINOR del reviewer (aplicada en ciclo 1).
Veredicto: APPROVED
```

## Ciclo de corrección 1

Decisión humana: los 2 MINOR y los 2 NIT ahora, sin deuda. Cita humana: «Un comentario que diga que las credenciales salen de .env cuando en CI no es así no se deja como deuda: es justo el tipo de nota que luego alguien lee y da por cierta.» Alcance: solo comentarios y la línea de ayuda; sin tocar recetas. Reviewer revisa solo esas líneas; tester y security no vuelven.

```
IMPLEMENTATION (devops, ciclo 1): Makefile:26 «# Locally, credentials come from the operator's .env (compose reads it from the project directory when present);» · :27 «# in CI they come from the job/step env. No recipe interpolates or prints them. The check fails early and clearly.» · :28 «# ENV_FILE is overridable only to test the guard; overriding it does not change where compose reads credentials from.» · :30 «… the variables come from the job/step env, not from a .env file, so the guard is skipped.» · :72 «(requiere .env fuera de CI; deja db en marcha, make down la para)». Ninguna receta, valor ni ENV_CHECK tocados; sin bloqueos; no ejecutó make.
Nota: su informe llama «fix-3» por error a la entrega inicial de fix-4.

REVIEW (delta, ciclo 1): APPROVED. Cada línea citada y contrastada con compose.yaml (sin env_file; `${VAR…}` en :8, :32, :55, :76, :107) y ci.yml (:148-150, :166-168). Única línea no comentario/ayuda frente a HEAD: Makefile:31 (ENV_CHECK), sin cambios respecto a lo aprobado. Hallazgos nuevos: ninguno. Requiere security: no.
```

Correcciones de hallazgos cerradas en ciclo 1: MINOR `Makefile:26-28` (reescrito), MINOR `Makefile:72` (ayuda), NIT `Makefile:30` («job/step env»), NIT numeración (`:30`/`:31`, corregida por el Orchestrator en la fila de la entrega).

## Notas e incidencias

a) **Primera nota del reviewer (TASK-006-fix-2)**: aprobó ENV_CHECK sin mirar los call sites de CI en `.github/workflows`. Consecuencia: main rojo en 85e4d2e. De ahí la regla permanente añadida a `monorepo-conventions` (ver Pendiente y el cambio en SKILL.md).

b) **devops, evidencia de `make -n validate`**: desviación respecto al comando exacto del encargo. Usó salida truncada y `PIPESTATUS` en lugar del comando literal; en zsh `PIPESTATUS` no se expandió, por lo que EXIT quedó vacío. Es un fallo de su comando de medida, no de la guarda. Sin bloqueos de hooks. Calificación: pendiente del humano.

c) **Orchestrator, bloqueo de bash-guard**: al anotar en `TASKS.md` por shell, bash-guard bloqueó correctamente con: «BLOCKED by bash-guard: escritura por shell en 'docs/TASKS.md' fuera del scope de la tarea. Usa Edit/Write dentro del scope o repórtalo.» Causa: el `allow` tenía solo `Makefile` en vez del Scope literal de la tarea (regla de /execute-task). Reportado y parado; corregido después copiando el Scope completo.

d) **Orchestrator, numeración**: el encargo y una fila del registro dieron `:29/:30` en lugar de `:30/:31` (NIT del reviewer). Corregido.

e) **Orchestrator, cierre**: el encargo de cierre llevó resúmenes, no los informes íntegros que exige `/close-task`. Con eso, `docs-keeper` completó partes del REVIEW inicial y lo dijo en su informe CLOSURE. El Orchestrator restituyó el texto del revisor y lo hizo constar en «Informes archivados».

## Deuda

- Deuda nueva: ninguna. Deuda aprobada: ninguna.
- Deuda pagada: ninguna.
- OPEN DECISIONS: ninguna.
- Instalación y comandos: sin cambios de uso. Local igual; en CI `make validate` ya no exige `.env`.

## Pendiente

- **CI verde en el push del commit de fix-4: cumplido.** Commit 595d43a; run https://github.com/davidfdzmorilla/Agents-Lab/actions/runs/39826608260 en success con los seis jobs en success (lint, typecheck, test, audit, secrets-scan, validate-linux). La tarea pasa a **DONE**.
- Desbloqueos: ninguno (TASK-006-fix-3 ya era READY; va ahora). Orden decidido por el humano: TASK-006-fix-4 → TASK-006-fix-3 → TASK-009.
- Calificación de la desviación de devops (nota b): pendiente del humano.
