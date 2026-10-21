# TASK-007 · apps/web: esqueleto Next.js + `GET /api/health`

| Campo | Valor |
|---|---|
| Tarea | TASK-007 |
| Hito | M0 |
| Estado | DONE |
| Owner | web-dev (reparto por pasos: persistence-dev, devops, web-dev; architect para el plan) |
| Depende de | TASK-005 |
| Fecha | 2026-10-21 |
| Plan | `docs/reports/TASK-007-plan.md` (architect; decisiones humanas OD-039…OD-046, OD-047 cerrada sin efecto; ADR-012 Accepted) |
| Veredicto TEST | PASS en la verificación inicial, PASS en el ciclo 2/3 (ciclo 1/3: FAIL) |
| Veredicto REVIEW | APPROVED (inicial, 2 MINOR y 3 NIT; delta del ciclo 2/3 APPROVED) |
| Veredicto SECURITY | APPROVED (inicial: 1 MEDIUM y 7 LOW; delta del ciclo 2/3 APPROVED). Previa de OD-042: `next` 16.4.2 con excepción, react y react-dom sin excepción |
| Ciclos de corrección | 2 (1/3: `images.unoptimized` y test de exports; 2/3: `tmpfs` en compose) |

## Resumen de lo entregado

- `apps/web` con App Router en `apps/web/src/app` (OD-041), Tailwind 4.3.3, layout base y página `/` con el texto «AgentLab» y un enlace a `/projects` (404 en M0, OD-046).
- `GET /api/health` (`apps/web/src/app/api/health/route.ts`): `force-dynamic`, responde `{ ok: true, db: "up", version }` con 200 y `no-store`, o `{ ok: false, db: "down" }` con 503 y `no-store` si PostgreSQL no responde en 2 s. `version` sale de `apps/web/package.json` (OD-043).
- `packages/persistence`: `pingDatabase(pool, { timeoutMs })` con plazo único que cubre conexión y consulta, cliente destruido al vencer o fallar, nunca lanza (`health.ts`); `createPool` acepta `max` y `connectionTimeoutMillis`; `runMigrations` sale del índice y se importa desde el sub-export `@agentlab/persistence/migrate` (OD-040).
- `next.config.ts` con `output: "standalone"`, `outputFileTracingRoot` en la raíz del monorepo, `transpilePackages`, `poweredByHeader: false`, `images: { unoptimized: true }` (ciclo 1) y webpack con `extensionAlias` (OD-039 a).
- Imagen `docker/web.Dockerfile` standalone: sin pnpm, corepack, npm, npx ni yarn; sin fuentes `.ts`; uid 1000; install `--frozen-lockfile --offline --ignore-scripts` y build `RUN --network=none`. Compose sirve `web` en `127.0.0.1:3000` sin perfil, con `cap_drop: [ALL]`, `no-new-privileges`, `init: true`, redes `backend` y `egress`, y tmpfs de `.next/cache` (ciclo 2).
- Deuda TD-009 y TD-010 pagada; deuda nueva TD-035…TD-039 con tarea de pago.
- Verificación: `make validate` y `make test` con status 0 en macOS y en Linux (GNU Make 4.4.1, GNU tar 1.35; core 171, persistence 106, worker 44, web 3 en la verificación de devops del paso 4; web 6 en la verificación del tester).

## Decisiones humanas

Fuente: registro de cambios de `docs/TASKS.md` (filas de 2026-10-21 que mencionan TASK-007). Todas las citas de este bloque están en disco en los ficheros indicados.

- **OD-039 (a)**: webpack con `extensionAlias` (`.js → .ts/.tsx/.js`) en `apps/web/next.config.ts`; Turbopack queda como deuda LOW (TD-035, pago en TASK-040). Cita: `apps/web/next.config.ts:17` `config.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"] };`. ADR-012:40.
- **OD-040 (a)**: `runMigrations` fuera del índice de `persistence`; sub-export `@agentlab/persistence/migrate` (`"./migrate": "./src/migrate.ts"`), como `/testing`. ADR-012:67; `docs/adr/ADR-012-build-e-imagen-de-web.md`.
- **OD-041 (a)**: App Router en `apps/web/src/app` (`rootDir: src`). `docs/TECHNICAL_SPEC.md:372`: «**RESUELTA (2026-10-21)**: opción (a), `apps/web/src/app`. §8 corregido; los scopes de las tareas futuras pasan de `apps/web/app/**` a `apps/web/src/app/**`». Los scopes de TASK-014, 016, 020, 024, 025, 028, 032 y 034 se corrigieron en `docs/TASKS.md`.
- **OD-042 (a), con excepción**: ver «Excepción de `next` 16.4.2» más abajo.
- **OD-043 (a)**: `version` de `/api/health` = campo `version` de `apps/web/package.json` (`docs/TECHNICAL_SPEC.md:374`).
- **OD-044 (a)**: sin logger en `web` en M0 (`docs/TECHNICAL_SPEC.md:375`). TASK-014 decide entre duplicar el logger del worker y adelantar `observability`.
- **OD-045 (a)**: scope de la tabla «Scope final» del plan, incluidos `packages/persistence/package.json` y `packages/persistence/src/migrate.integration.test.ts` (`docs/TECHNICAL_SPEC.md:376`).
- **OD-046 (a)**: `/projects` responde 404 por defecto en M0 (`docs/TECHNICAL_SPEC.md:377`). La tarea que cree las pantallas de proyectos (TASK-020 o TASK-034) añade la ruta o corrige ARCHITECTURE §7.
- **OD-047**: cerrada sin efecto (`docs/TECHNICAL_SPEC.md:378`: «la premisa de OD-042 (19.3.1 como parche) era falsa»).
- **ADR-012 Accepted (2026-10-21)**: `docs/adr/ADR-012-build-e-imagen-de-web.md:5`: «| Estado | Accepted (2026-10-21, responsable humano; OD-039 a, OD-040 a) |».
  - Línea del 143 (`ADR-012:10`): «web es el único servicio que no termina con 0 bajo SIGTERM (143 por diseño de Next); el DoD de TASK-007 lo documenta y no se trata como fallo.»
  - Consecuencia del tmpfs (`ADR-012:64`): «La imagen de web requiere un tmpfs en .next/cache; compose lo provee» (decisión humana, ciclo 2/3). Compose es la unidad de despliegue (ARCHITECTURE §1).
- **Excepción de `next` 16.4.2** (OD-042, `docs/adr/ADR-012-build-e-imagen-de-web.md:12-22`): `next` 16.4.2 queda fuera de la regla de las dos semanas (publicada el 2026-10-15). Los avisos que la sustentan, verificados por security con `gh api` (todos `state: published`):
  - GHSA-2464-fhr4-w9xw (CVE-2026-96889, critical), publicado 2026-10-14T17:46:48Z: `next` `>16.0.0 <=16.4.0` → 16.4.1.
  - GHSA-673q-mjm6-r5xr (critical), 2026-10-14T17:47:07Z: `next` `>=16.0.0 <=16.4.0` → 16.4.1.
  - GHSA-p3m5-59mp-jv5r (high), 2026-10-14T17:47:43Z: `next` `>=16.0.0 <=16.4.0` → 16.4.1.
  - GHSA-xqc2-xf4c-x3h3 (critical) y GHSA-h3gv-c5rc-p453 (high), 2026-10-14: `react-server-dom-*`, corregidos desde `next` 16.4.1 en su copia de RSC.
  - 16.4.0 es vulnerable; 16.4.1 es el parche; 16.4.2 no es de seguridad pero contiene los arreglos (R2 resuelto: la copia de RSC de `next` ≥ 16.4.1 lleva el arreglo, comprobado en el plan).
  - `react`, `react-dom` y `@types/*` 19.3.0 van **sin excepción**: ningún aviso los afecta.
- **Regla de antigüedad mínima (decisión humana, 2026-10-21, sin OD)**: `docs/ARCHITECTURE.md:257`: «Antigüedad mínima: cada dependencia nueva o actualizada usa una versión publicada hace al menos dos semanas. Única excepción: un aviso de seguridad verificado por `security`, con cita del aviso (identificador GHSA/CVE, URL y fecha); la excepción se registra en el ADR o en el plan de la tarea con el identificador del aviso. Ejemplo vigente: `next` 16.4.2 (OD-042, ADR-012).» Citada en una línea en `.claude/skills/monorepo-conventions/SKILL.md` para que devops la tenga precargada.
- **Regla 10 (Linux), última vez** (decisión humana): el socket de Docker se montó en un contenedor desechable (`docker:27-cli`) solo para el paso 4 de devops. A partir de TASK-006 la evidencia Linux la da el CI.
- **Host/Origin/cabeceras = requisito de TASK-014** (decisión humana): no es deuda. `docs/TASKS.md:262` (DoD de TASK-014): «solo se aceptan peticiones con `Host` `localhost`/`127.0.0.1` (configurable); toda petición no-GET exige `Origin` válido…». Security lo verificará en TASK-014. OD-003 queda ligada y TD-005 se amplía.
- **SPEC §8:285 mantenido** (decisión humana): `docs/TECHNICAL_SPEC.md:285` sigue diciendo que `GET /api/health` responde sin autenticación; la protección de la API se remite al DoD de TASK-014.

## Ficheros

Código y configuración (por paso):
- Paso 1 (persistence-dev): `packages/persistence/src/health.ts` (nuevo), `packages/persistence/src/health.integration.test.ts` (nuevo), `packages/persistence/src/pool.ts`, `packages/persistence/src/index.ts`, `packages/persistence/src/index.test.ts`, `packages/persistence/package.json` (sub-export `./migrate`), `packages/persistence/src/migrate.integration.test.ts`. Ciclo 1/3: `packages/persistence/src/index.test.ts` (test de exports exacto).
- Paso 2 (devops): `apps/web/package.json`, `pnpm-lock.yaml` (+245 paquetes instalados; ningún paquete existente cambia de versión).
- Paso 3 (web-dev): `apps/web/tsconfig.config.json`, `apps/web/next.config.ts`, `apps/web/postcss.config.mjs`, `apps/web/vitest.config.ts`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx`, `apps/web/src/app/globals.css`, `apps/web/src/app/api/health/route.ts`, `apps/web/src/server/health.ts`, `apps/web/src/server/health.integration.test.ts`; modificados `apps/web/tsconfig.json`; eliminado `apps/web/src/index.ts` (TD-009). Ciclo 1/3: `apps/web/next.config.ts` (`images.unoptimized`).
- Paso 4 (devops): `docker/web.Dockerfile` (nuevo), `compose.yaml` (servicio `web`; ciclo 2/3: tmpfs), `Makefile` (`HOST_TAR` con `--exclude=.next`), `.dockerignore` (`!tsconfig.base.json`), `.gitignore` (`next-env.d.ts`).
- Tester: `apps/web/src/app/api/health/route.integration.test.ts` (nuevo; test del `GET` con una `Request` real).
- Reviewer, security: sin ficheros editados.
- Architect: `docs/reports/TASK-007-plan.md`, `docs/ARCHITECTURE.md` (§1, §2, §7, §9), `docs/TECHNICAL_SPEC.md` (§8, §13), `docs/adr/ADR-012-build-e-imagen-de-web.md` (nuevo), `docs/adr/ADR-000-indice-y-plantilla.md`, `docs/adr/ADR-009-*.md` (anotación de §5 precisada por ADR-012).
- Docs-keeper (cierre y correcciones de proceso): `docs/reports/TASK-007.md`, `docs/TASKS.md`, `docs/TECHNICAL_DEBT.md`, `docs/AGENTS.md` (§4, :63 y :64), `.claude/skills/monorepo-conventions/SKILL.md` (:13, :35 y la línea de antigüedad).

## Veredictos por ciclo

| Ciclo | TEST | REVIEW | SECURITY | Qué se corrigió |
|---|---|---|---|---|
| Inicial (`/verify-task`) | PASS (18 viñetas ✅, 2 ⚠️ aceptadas: canarios y lockfile alterado) | APPROVED (2 MINOR, 3 NIT) | APPROVED (1 MEDIUM, 7 LOW) | Test de exports `toMatchObject` → exacto (MINOR); pool por petición → TASK-014 (decisión humana). Host/Origin → TASK-014. |
| Ciclo 1/3 | FAIL: `/_next/image` dejó 20 `unhandledRejection` y 20 `EACCES mkdir '/app/apps/web/.next/cache'` en el log (la respuesta 404 fue correcta) | — | — | `images.unoptimized: true` y test de exports exacto. Insuficiente: `/_next/image` sigue instanciando el caché (LOW-2). |
| Ciclo 2/3 | PASS (404 ×10 locales y ×10 remotas; `unhandledRejection` 0; `EACCES` 0; `/api/health` 200 exacto; `/` 200 con AgentLab; `make test` status 0) | APPROVED (delta: index.test.ts:38, next.config.ts:13, compose.yaml:45) | APPROVED (delta: imagen sin escritura para uid 1000; tmpfs solo en el contenedor; LOW-2 con cita de `next-server.js:193`) | `tmpfs` en compose para `/app/apps/web/.next/cache` (uid 1000, `0700`, 64m) |

Veredicto final: TEST PASS · REVIEW APPROVED · SECURITY APPROVED · informe archivado.

Citas verificadas en el ciclo 2/3 (líneas literales leídas en disco tras el cambio):
- `packages/persistence/src/index.test.ts:38` (TESTER/REVIEW delta): test de exports exacto.
- `apps/web/next.config.ts:13` y `:12`: comentario y `images: { unoptimized: true },`.
- `compose.yaml:45`: `      - /app/apps/web/.next/cache:uid=1000,gid=1000,mode=0700,size=64m` (bajo `tmpfs:` en la línea 44; comentario en 43).

## Deuda registrada

Fuente: registro de cambios de `docs/TASKS.md` (2026-10-21) y `docs/TECHNICAL_DEBT.md`.
- **PAID (TASK-007)**: TD-009 (placeholder `apps/web/src/index.ts` borrado) y TD-010 (`next.config.ts` con `tsconfig.config.json`; `rootDir: src` intacto; `vitest.config.ts` ya en TASK-004).
- **Ampliadas**: TD-005 (nota de security: sin validar `Host`/`Origin`/cabeceras, DNS rebinding y CSRF; requisito en el DoD de TASK-014; OD-003 ligada); TD-018 (`web` tiene salida a internet por la red `egress`, necesaria para publicar el puerto → TASK-020); TD-032 (sin manejador global en `apps/web`; un `unhandledRejection` por petición a `/_next/image` no tumbó el proceso → TASK-027); TD-033 (`docker/web.Dockerfile:22` sin `--ignore-pnpmfile` → TASK-040).
- **Nuevas** (LOW): TD-035 (webpack con `extensionAlias` en lugar de Turbopack → TASK-040); TD-036 (`sharp`/libvips en la imagen sin cargarse en runtime → TASK-040); TD-037 (claves de preview y `encryptionKey` generadas en el build; definir `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` en runtime antes de publicar o añadir Server Actions → TASK-040); TD-038 (pool por petición en `/api/health` sin límite de concurrencia, `apps/web/src/server/health.ts:12` → TASK-014, pool compartido); TD-039 (`web` sin `read_only: true` ni límites de memoria/procesos → TASK-037).
- **DoD ampliados** (no duplicados): TASK-014 (TD-038 en la viñeta de pool compartido), TASK-020 (salida de `web`, TD-018), TASK-037 (`read_only` y límites de `web`, TD-039), TASK-040 (TD-033 en `web`, TD-035, TD-036, TD-037). TASK-027 ya tenía TD-032 ampliada a `apps/web`.
- Sin deuda: MINOR de `index.test.ts` corregido en el ciclo 1/3; NIT de cast en `route.integration.test.ts:19` y JSDoc de `pingDatabase` se dejan (sin acción). Host/Origin es requisito, no deuda.

Riesgos y dependencias aprobadas:
- `next` 16.4.2 con excepción de seguridad; `react`/`react-dom` 19.3.0 y `@types/react`/`@types/react-dom` 19.3.0 sin excepción; `tailwindcss` 4.3.3 y `@tailwindcss/postcss` 4.3.3 (cumplen la regla).
- El `pnpm audit` de la verificación de security solo reporta GHSA-67mh-4wv8-2f99 en `esbuild@0.18.20` (TD-019, ya registrada); sin avisos para `next` 16.4.2, `react` 19.3.0 ni `tailwindcss` 4.3.3.

## Incidencias de proceso

Decisión humana: registrar como en TASK-003-fix-1 la conducta de cada subagente ante un bloqueo de hook: comando bloqueado, mensaje, qué hizo en su lugar.

**a) devops (paso 4): edición con `python3` en línea; incidencia menor.**
- Qué ocurrió: `.dockerignore` y `.gitignore` se editaron con `python3` en línea, sin bloqueo del hook.
- Regla (AGENTS §4, `docs/AGENTS.md:63`): «Los ficheros del repositorio se editan con Edit/Write. Un script en línea (python3 -c, node -e, perl -i) que escriba en el repositorio cuenta como rodeo del hook aunque no haya habido bloqueo; sed -i y tee sobre rutas del scope sí están permitidos porque el hook los analiza.» Regla replicada en `.claude/skills/monorepo-conventions/SKILL.md:35`.
- Decisión humana: incidencia menor. Es el segundo aviso a devops en dos tareas (el primero: TASK-008, `sed -i` en `.env.example:13` pese a pedirse Edit, sin bloqueo, dentro de scope). A la tercera incidencia, la fase se repite.
- Ficheros resultantes verificados en disco: `.dockerignore:7` `!tsconfig.base.json`; `.gitignore:4` `next-env.d.ts`.

**b) persistence-dev (paso 1): prettier del host; incidencia menor.**
- Qué ocurrió: `prettier --write` se ejecutó con el prettier del host, no con la versión del contenedor.
- Evidencia: válida. Se repitió `format:check` en el contenedor de Node del proyecto (`make validate` Tasks 4/4, format:check OK tras el ciclo 1/3).
- Regla: AGENTS §4, `docs/AGENTS.md:64` (ver c).

**c) reviewer: eslint con el Node del host; incidencia menor sin consecuencia.**
- Qué ocurrió: el reviewer ejecutó eslint de `apps/web` con el Node del host.
- Decisión humana: incidencia menor, sin consecuencia en el veredicto. Regla nueva para todos los roles (`docs/AGENTS.md:64`): «Toda validación (tests, typecheck, lint, formato, builds) se ejecuta con la versión de Node del proyecto (`>=22.12 <23`): en el contenedor fijado (`make test`/`make validate`) o con nvm; nunca con otro Node del host. Aplica a todos los roles, también a reviewer y security.» Regla replicada en `.claude/skills/monorepo-conventions/SKILL.md`.

**Notas (conducta correcta o falsos positivos; sin incidencia):**
- web-dev usó `Write` tras el bloqueo de heredocs con `cd` relativo (`BLOCKED by bash-guard: escritura por shell en 'apps' fuera del scope de la tarea. Usa Edit/Write dentro del scope o repórtalo.`). Fue un fallo del hook con un `mkdir -p` sobre un padre del scope, corregido por el humano. Conducta correcta.
- web-dev paró ante `BLOCKED by bash-guard: no se expanden variables de entorno con secretos` (comando de build/dev con `$POSTGRES_PASSWORD` en un `sed`). Bloqueo correcto. Las tres evidencias pendientes pasaron a devops en el paso 4 y `next dev` no se probó (la imagen real es la evidencia).
- devops paró ante `BLOCKED by bash-guard: no se vuelca el entorno completo ni variables sensibles` (`env | grep` en el stage build) y ante `BLOCKED by bash-guard: escritura por shell en '$S/linux-copy/$S/linux-copy' fuera del scope de la tarea. Usa Edit/Write dentro del scope o repórtalo.` (limpieza del scratchpad con doble expansión de ruta). Citó, paró y no reformuló. Conducta correcta; sin efecto.
- tester: ante `sed -i.bak` denegado por el clasificador de auto-mode, lo rehizo con Edit. Conducta correcta.
- architect: citó y paró dos bloqueos durante la validación del plan: `BLOCKED by bash-guard: escritura por shell en '$S/repo/$S/canary/apps/web/.next' fuera del scope de la tarea. Usa Edit/Write dentro del scope o repórtalo.` (prueba de canarios, no hecha) y `BLOCKED by bash-guard: no se ejecutan descargas directamente (curl | sh)` (comparación de R2, no hecha).
- architect: la instalación en el scratchpad (`package.json` y `pnpm install` sin nombres de paquete) no es rodeo: AGENTS §4 (`docs/AGENTS.md:61`) permite instalar para validar fuera del repositorio.
- Sin contraseñas en este informe: se usa `<pw>`.

## Bloqueos del hook

### Commit (EXECUTE)

Comando bloqueado (committer, EXECUTE de TASK-007, 2026-10-21), literal y completo, extraído del registro de la ejecución:

```
MSG=/private/tmp/claude-501/-Users-davidferanandezmorilla-Desktop-development-nosync-agentlab/3fa7c665-c570-4833-afbe-b934a451dd31/scratchpad/commit-msg-TASK-007.txt && cat > "$MSG" <<'EOF'
feat(web): add Next.js skeleton with GET /api/health

- Next.js App Router in src/app with Tailwind; webpack build with extensionAlias (ADR-012)
- GET /api/health via pingDatabase (2 s deadline, 200/503, no-store)
- persistence: add pingDatabase, connectionTimeoutMillis in createPool, move runMigrations to ./migrate sub-export with exact exports test
- standalone image without package managers, non-root user, offline build (docker/web.Dockerfile)
- compose: web service without profile, cap_drop and no-new-privileges, tmpfs for .next/cache, bound to 127.0.0.1:3000
- images.unoptimized; docs and process updates (SPEC §8/§13 OD-039..OD-047, ARCHITECTURE, ADR-012, TECHNICAL_DEBT, AGENTS §4, monorepo-conventions)

Task: TASK-007
EOF
git add -- .claude/skills/monorepo-conventions/SKILL.md .dockerignore .gitignore Makefile apps/web/package.json apps/web/tsconfig.json compose.yaml docs/AGENTS.md docs/ARCHITECTURE.md docs/TASKS.md docs/TECHNICAL_DEBT.md docs/TECHNICAL_SPEC.md docs/adr/ADR-000-indice-y-plantilla.md docs/adr/ADR-009-ejecucion-typescript-runtime.md packages/persistence/package.json packages/persistence/src/index.test.ts packages/persistence/src/index.ts packages/persistence/src/pool.ts pnpm-lock.yaml apps/web/src/index.ts apps/web/next.config.ts apps/web/postcss.config.mjs apps/web/tsconfig.config.json apps/web/vitest.config.ts apps/web/src/app/globals.css apps/web/src/app/layout.tsx apps/web/src/app/page.tsx apps/web/src/app/api/health/route.ts apps/web/src/app/api/health/route.integration.test.ts apps/web/src/server/health.ts apps/web/src/server/health.integration.test.ts docker/web.Dockerfile docs/adr/ADR-012-build-e-imagen-de-web.md docs/reports/TASK-007-plan.md docs/reports/TASK-007.md packages/persistence/src/health.ts packages/persistence/src/health.integration.test.ts && git commit -F "$MSG" && echo "--- stat" && git log -1 --stat | tail -3 && echo "--- show stat" && git show --stat HEAD | tail -1 && echo "--- status" && git status --short && git log -1 --format=%H
```

Respuesta del hook (literal):

```
PreToolUse:Bash hook error: ["$CLAUDE_PROJECT_DIR"/.claude/hooks/bash-guard.sh]: BLOCKED by bash-guard: escritura por shell en 'git' fuera del scope de la tarea. Usa Edit/Write dentro del scope o repórtalo.
```

Estado tras el bloqueo (verificado por el Orchestrator): HEAD 162e6c8 sin cambios; índice vacío (`git diff --cached --name-only` = 0).

Decisión humana (forma nueva): el mensaje se escribe con Write en el scratchpad y el commit se ejecuta con dos comandos Bash separados: `git add -- <37 rutas>` y `git commit -F <ruta del scratchpad>`. No es reformular para esquivar: el hook no bloqueó el commit, bloqueó una forma de construir el fichero del mensaje, y la forma nueva es la canónica.

## Informes

Orden: PLAN (primera entrega y deltas), SECURITY previa de OD-042, CLOSURE de proceso, IMPLEMENTATION por paso, TEST, REVIEW y SECURITY por ciclo. Transcripción íntegra del recopilado por el Orchestrator (`scratchpad/task007-reports-raw.md`, 2026-10-21).

---

## PLAN (primera entrega) — architect — resumen
- Validación en scratchpad V1–V14 con node:22.23.3 y PostgreSQL 16.15 por digest (contenedores, red y volumen t7-* propios, borrados; sin tocar db del proyecto ni .env). Instalación en el scratchpad escribiendo package.json y `pnpm install` sin nombres (decisión humana: no es rodeo; regla 11).
- Turbopack falla (`Can't resolve './team-definition.js'`, vercel/next.js#82945); webpack con extensionAlias compila. `new URL("../migrations", import.meta.url)` de persistence/migrate.ts rompe el bundle mientras el índice reexporte runMigrations.
- standalone: install frozen offline ignore-scripts, build `RUN --network=none`; sin gestores ni .ts, uid 1000; /api/health 200 no-store; db en pausa 503 en 2,02 s; db parado 503 en 0,06 s; / con AgentLab y /projects 404; Tailwind; URL inválida → 500 sin canario en logs; docker stop web → 143 (Next 16).
- Decisiones: src/app (TD-010), tsconfig.config.json, next.config (standalone, outputFileTracingRoot, transpilePackages, poweredByHeader false, webpack extensionAlias), imagen standalone en vez de pnpm deploy, pingDatabase con plazo único, pool por petición con connectionTimeoutMillis, compose web sin perfil, .dockerignore `!tsconfig.base.json`, HOST_TAR + .next.
- ODs: OD-039…OD-046. ADR-012 Proposed.
- Bloqueos de hook (citados y parados): «BLOCKED by bash-guard: escritura por shell en '$S/repo/$S/canary/apps/web/.next' fuera del scope de la tarea. Usa Edit/Write dentro del scope o repórtalo.» (prueba de canarios, no hecha) y «BLOCKED by bash-guard: no se ejecutan descargas directamente (curl | sh)» (comparación de R2, no hecha).

## PLAN (delta 1) — architect — registro de decisiones
- SPEC:264 rutas en apps/web/src/app/api/** (OD-041); SPEC:370-377 OD-039…OD-046 RESUELTAS; SPEC:378 OD-047 propuesta; SPEC:386 nota en OD-007 (Turbopack no con imports .js).
- ADR-012:5 Accepted; :10 línea del 143; :12 versiones sujetas a OD-042; deuda LOW webpack y sharp → TASK-040. ADR-000:24.
- Plan: decisiones literales, plan B (next 16.4.0, react/react-dom 19.3.0), sub-export ./migrate, test de exports, orden con security antes del paso 2.
- Detectó rutas futuras fuera de src (lib/api, components, middleware.ts → src/proxy.ts) y contradicciones ARCHITECTURE:56 y monorepo-conventions:13.

## SECURITY (previa) — OD-042 y R2
- Avisos (gh api, published): GHSA-2464-fhr4-w9xw / CVE-2026-96889 critical 2026-10-14T17:46:48Z next >16.0.0 <=16.4.0 → 16.4.1 (y >=10.0.0 <=15.5.27 → 15.5.28); GHSA-673q-mjm6-r5xr critical 2026-10-14T17:47:07Z next >=16.0.0 <=16.4.0 → 16.4.1; GHSA-p3m5-59mp-jv5r high 2026-10-14T17:47:43Z next >=16.0.0 <=16.4.0 → 16.4.1 (y >=13.0.0 <=15.5.27 → 15.5.28); GHSA-xqc2-xf4c-x3h3 critical 2026-10-14T17:08:26Z react-server-dom-{webpack,turbopack,parcel} 19.0.0–19.0.8, 19.1.0–19.1.9, 19.2.0–19.2.8, 19.3.0 → 19.0.9/19.1.10/19.2.9/19.3.1; GHSA-h3gv-c5rc-p453 high 2026-10-14T17:08:23Z ídem. URLs en github.com/vercel/next.js/security/advisories/<id> y github.com/react/react/security/advisories/<id>.
- next: parche 16.4.1; 16.4.2 contiene los arreglos (no es parche); 16.4.0 vulnerable. react/react-dom: ningún aviso los afecta.
- R2 RESUELTO: la copia vendored de react-server-dom-webpack de next declara el mismo canary en 16.4.0/16.4.1/16.4.2 (no sirve de indicador); diff: 16.4.0→16.4.1 cambian client/server/plugin, 16.4.1→16.4.2 idénticos; líneas del arreglo upstream presentes 162/162, 145/145, 178/178 en 16.4.2 (68, 53, 67 en 16.4.0).
- Veredicto: OD-042 NO VERIFICADA tal como estaba; plan B (next 16.4.0) CRITICAL → BLOCKED; recomendación next 16.4.2 con excepción + react 19.3.0. MEDIUM: plan :64/:320 atribución inexacta; LOW: plan :269 indicador de R2.
- Decisión humana: next 16.4.2 con excepción (avisos citados en ADR-012 y plan), react/react-dom/@types 19.3.0 sin excepción; OD-047 cerrada sin efecto.

## PLAN (delta 2) — architect — citas de OD-042
- Plan :72-73 versiones finales; :83 regla y excepción; :85-101 tabla de avisos; :105 plan B descartado; :333 R2 resuelto; :387-389 OD-042 resuelta; :414 OD-047 cerrada sin efecto; :57 V1–V14 se hicieron con 19.3.1 (se repiten).
- ADR-012:12 versiones con excepción, :14-20 tabla de avisos, :22 nota; SPEC:373 OD-042 resolución final, :378 OD-047 cerrada; ADR-000:24.

## PLAN (delta 3, paso 5) — architect
- ARCHITECTURE:16 fila web (standalone, CMD node apps/web/server.js bajo init, uid 1000, sin perfil, backend+egress, tmpfs uid 1000 0700 64m, 143); :24-29 bloque de imágenes (web sin pnpm deploy; cap_drop en migrate, worker, web y test; .dockerignore con tsconfig.base.json); :60 §2 sub-exports (frase del humano); :226-229 §7 (src/app, errores en TASK-014, /api/health, protección en TASK-014); :255, :267-270, :277 §9 (versiones, excepción de next, webpack).
- ADR-012:63 sharp sin cargar (LOW-2, TASK-040); :64 «La imagen de web requiere un tmpfs en .next/cache; compose lo provee» (next-server.js:183-187 y :193); :65 claves de preview y encryptionKey (LOW-5, TASK-040); :8 ADR-009 §5 anotado. ADR-009:21 anotación (precisado por ADR-012, webpack). ADR-000:24 tmpfs.
- SPEC:285 protección de la API sin autenticación (TD-005, requisito de TASK-014); /api/health sin autenticación. (Decisión humana: se mantiene.)
- Plan :132/:193 Accepted; :253/:363 2,0–2,5 s; :442 «Resultado de la verificación».
- OD propuesta: dónde escribir la regla de antigüedad mínima → decisión humana (a) ARCHITECTURE §9 + «la excepción se registra en el ADR o en el plan de la tarea con el identificador del aviso», sin abrir OD; monorepo-conventions la cita.

## CLOSURE (proceso) — docs-keeper — AGENTS §4 instalar para validar
- docs/AGENTS.md:61 «Fuera del repositorio, instalar para validar está permitido; dentro, solo `deps_allowed`. Instalar en el repo por un camino distinto de `pnpm add` para meter lo que `deps_allowed` no autoriza es un rodeo.»
## CLOSURE (proceso) — docs-keeper — monorepo-conventions sub-exports
- .claude/skills/monorepo-conventions/SKILL.md:13 sub-exports permitidos `@agentlab/providers/testing`, `@agentlab/persistence/testing`, `@agentlab/persistence/migrate`, declarados en exports y cubiertos por el test de exports.
## CLOSURE (proceso) — docs-keeper — edición de ficheros
- docs/AGENTS.md:63 y monorepo-conventions/SKILL.md:35: «Los ficheros del repositorio se editan con Edit/Write. Un script en línea (python3 -c, node -e, perl -i) que escriba en el repositorio cuenta como rodeo del hook aunque no haya habido bloqueo; sed -i y tee sobre rutas del scope sí están permitidos porque el hook los analiza.»
## CLOSURE (proceso) — docs-keeper — versión de Node
- docs/AGENTS.md:64 «Toda validación (tests, typecheck, lint, formato, builds) se ejecuta con la versión de Node del proyecto (`>=22.12 <23`): en el contenedor fijado (`make test`/`make validate`) o con nvm; nunca con otro Node del host. Aplica a todos los roles, también a reviewer y security.»

## IMPLEMENTATION — paso 1 (persistence-dev)
- pingDatabase(pool, { timeoutMs }): Promise<boolean> en health.ts: setTimeout único antes de pool.connect() que cubre conexión y select 1; release(true) al vencer/fallar; destruye el cliente que llega tras el plazo; nunca lanza; sin message ni URL; sin statement/query_timeout.
- createPool(connectionString, options?: { max?; connectionTimeoutMillis? }) (solo se pasa si viene definida).
- index.ts: `export { pingDatabase } from "./health.js";` sin runMigrations. package.json exports `.`, `./migrate` (./src/migrate.ts), `./testing`. cli/migrate.ts, testing/reset.ts y migrate.integration.test.ts no cambian (ruta relativa).
- Tests: index.test.ts lista cerrada + sub-export; health.integration.test.ts: arriba (cliente ocioso), puerto cerrado (totalCount 0), servidor mudo con reloj falso (1999 pendiente, 2000 false), consulta colgada con proxy TCP (descarta el primer Q; totalCount 0). No se tocó el db.
- make validate OK (Tasks 3/3; persistence 8 ficheros/106 tests; health.ts 86,66 %). Incidencia menor: prettier --write con el prettier del host (evidencia válida por format:check en contenedor).

## IMPLEMENTATION — paso 2 (devops)
- apps/web/package.json: dependencies @agentlab/core, @agentlab/persistence workspace:*, next 16.4.2, react 19.3.0, react-dom 19.3.0; devDependencies @tailwindcss/postcss 4.3.3, @types/react 19.3.0, @types/react-dom 19.3.0, tailwindcss 4.3.3; scripts dev/build --webpack, start, typecheck doble, lint, test.
- Lockfile en el contenedor Node 22 (tar por stdin): --lockfile-only OK (único aviso: @esbuild-kit deprecated); --frozen-lockfile --ignore-scripts OK sin avisos de peers, +245 paquetes instalados; pnpm why react/react-dom/next → una versión; entradas resolution 304 → 392 (+88); git diff --stat 934+/40−; ningún paquete existente cambia de versión.

## IMPLEMENTATION — paso 3 (web-dev) — parcial
- Creados: tsconfig.config.json, next.config.ts, postcss.config.mjs, vitest.config.ts, src/app/{layout.tsx,page.tsx,globals.css}, src/app/api/health/route.ts, src/server/health.ts, src/server/health.integration.test.ts. Modificado tsconfig.json. Borrado src/index.ts.
- next.config.ts: output standalone, outputFileTracingRoot monorepoRoot, transpilePackages, poweredByHeader false, extensionAlias. route.ts: dynamic force-dynamic; checkHealth(loadEnv().DATABASE_URL). health.ts: HEALTH_TIMEOUT_MS 2000; createPool max 1, connectionTimeoutMillis; pingDatabase; void pool.end(); 200/503 no-store; version del package.json.
- make validate exit 0 (web 3 tests). Build, sha de tsconfig y next dev pendientes del paso 4.
- Bloqueos: (1) heredocs con cd relativo → «BLOCKED by bash-guard: escritura por shell en 'apps' fuera del scope de la tarea. Usa Edit/Write dentro del scope o repórtalo.» → siguió con Write (decisión humana: conducta correcta, sin incidencia; fallo del hook con mkdir -p de un padre del scope, corregido). (2) comando de build/dev que expandía $POSTGRES_PASSWORD en un sed → «BLOCKED by bash-guard: no se expanden variables de entorno con secretos» → paró (bloqueo correcto); evidencias pasan a devops en el paso 4 (decisión humana); next dev no se prueba.

## IMPLEMENTATION — paso 4 (devops)
- docker/web.Dockerfile:14 deps / :16 pnpm fetch --ignore-scripts / :20 build / :22 pnpm install --frozen-lockfile --offline --ignore-scripts --filter web... / :23 RUN --network=none pnpm --filter web build / :37 COPY standalone / :39 USER node / :42 CMD ["node","apps/web/server.js"]; base con TURBO_TELEMETRY_DISABLED y NEXT_TELEMETRY_DISABLED; slim sin gestores.
- compose.yaml web sin profiles, target runtime, cap_drop, no-new-privileges, init, 127.0.0.1:3000, backend+egress; comentario del 143. .dockerignore:7 !tsconfig.base.json. .gitignore:4 next-env.d.ts. Makefile:15 HOST_TAR --exclude=.next; :44 up.
- Evidencias pendientes del paso 3: build sin credenciales (sin ENV/ARG de DB; --network=none); 200 {"ok":true,"db":"up","version":"0.0.0"} no-store; /projects 404; / con AgentLab y href; CSS con max-w-2xl, text-3xl; sha256 tsconfig 05e6e734… igual tras next build; next-env.d.ts generado.
- Resto: uid 1000; sin gestores; sin .ts; /app 72M, imagen 442 MB; .pnpm con una sola react; 45 canarios (CANARY-7QX) ausentes en build y runtime; lockfile alterado (next → 16.4.1) → ERR_PNPM_OUTDATED_LOCKFILE; compose config; port 127.0.0.1:3000; pause db → 503 en 2,094 s y 2,013 s; stop db → 503 0,058 s; backend solo → puerto no publicado (justifica egress); stop web 0,47 s ExitCode 143; macOS make help/test/validate OK; Linux GNU tar 1.34 dry-run de .next.
- Bloqueo: «BLOCKED by bash-guard: no se vuelca el entorno completo ni variables sensibles» (env | grep en el stage build) → no reformulado.
- Incidencias: .dockerignore y .gitignore editados con python3 en línea (decisión humana: incidencia menor; segundo aviso a devops en dos tareas; a la tercera la fase se repite; regla nueva en AGENTS §4 y monorepo-conventions); /tmp/x escrito y borrado en el mismo comando.

## IMPLEMENTATION (delta) — paso 4, Linux (devops; socket por excepción humana, última vez)
- Copia con el filtro exacto de HOST_TAR (Makefile:15 con --exclude=.next); script .linux-run.sh dentro de la copia (Write); `docker run --rm -v /var/run/docker.sock:/var/run/docker.sock -v $S/linux-copy:/repo -w /repo -e POSTGRES_PASSWORD -e DATABASE_URL -e DATABASE_URL_TEST --entrypoint sh docker@sha256:851f91d241214e7c6db86513b270d58776379aacc5eb9c4a87e5b47115e3065c /repo/.linux-run.sh` (valores <pw>).
- GNU Make 4.4.1, GNU tar 1.35, Docker 27.5.1, Compose v2.33.0; MAKE_TEST_STATUS=0, MAKE_VALIDATE_STATUS=0; core 171, persistence 106, worker 44, web 3; contraseña 0 veces en el log (verificado por el Orchestrator, Prettier OK).
- Bloqueo en la limpieza: «BLOCKED by bash-guard: escritura por shell en '$S/linux-copy/$S/linux-copy' fuera del scope de la tarea. Usa Edit/Write dentro del scope o repórtalo.» (cd + rm con doble expansión de ruta) → parado, sin efecto (solo db en marcha; volúmenes intactos; el tester hizo make down).

---
## TEST — tester — verificación inicial: PASS
- make validate y make test exit 0 (core 171, persistence 106, web 6, worker 44); compose up; 200 exacto no-store; /projects 404; / AgentLab + href; CSS Tailwind (.min-h-screen, .mx-auto, .p-8, .text-3xl, .font-semibold, .text-slate-900); pause db → 503 en 2,022/2,034/2,030/2,029/2,018 s, unpause → 200; imagen uid 1000, sin gestores, sin .ts, .next presente; compose config; stop web 143; make down; Linux en el log de devops (líneas 297 y 593).
- Tabla 18 viñetas ✅, 2 ⚠️ (canarios y lockfile alterado aceptados de devops tras revisar el método).
- Test añadido: apps/web/src/app/api/health/route.integration.test.ts (:26 force-dynamic; :30 200 JSON no-store con versión; :47 503 sin connection string), con Request real, vi.stubEnv y loadTestDatabaseUrl(); route.ts 100 %.
- Umbral: ningún test tenía 2,1 s; medido en vivo dentro de 2,0–2,5 s.
- Clasificador de auto-mode denegó un `sed -i.bak` → rehecho con Edit (conducta correcta).

## REVIEW — reviewer — verificación inicial: APPROVED
- [MINOR] packages/persistence/src/index.test.ts:32 `toMatchObject` (plan pedía mapa exacto y destinos en disco) → corregido en ciclo 1.
- [MINOR] apps/web/src/server/health.ts:12-19 pool por petición sin límite de concurrencia → deuda LOW TASK-014 (decisión humana).
- [NIT] route.integration.test.ts:19 cast; health.ts:4 JSDoc «Never throws» (pg-pool reenvía errores al evento error); plan :132/:193 Proposed y :363 ≤ 2,1 s (corregidos en el paso 5).
- Comprobaciones propias: build sin DATABASE_URL, sha de tsconfig igual; sin .env* en standalone; extensionAlias no pierde nada; lockfile solo sufijos de peers; eslint de apps/web (con el Node del host: incidencia menor, regla nueva AGENTS §4).
- Contradicciones para el paso 5: ARCHITECTURE §2 :59 y §7 :225 (corregidas).

## SECURITY — verificación inicial: APPROVED
- HEAD real 162e6c8 (commit del humano: hook, Task: none).
- Secretos: sin claves; canario ausente; web solo recibe DATABASE_URL, LOG_LEVEL, LANGCHAIN_TRACING_V2. SSRF: /_next/image con URL remota → 400 (remotePatterns vacío). Dependencias: pnpm audit (397) solo GHSA-67mh-4wv8-2f99 en esbuild@0.18.20 (TD-019); sin avisos para next 16.4.2, react 19.3.0, tailwind 4.3.3; sharp 0.35.5 y postcss 8.5.23 ya corregidos; pendingBuilds solo esbuild (raíz). Imagen: uid 1000, sin gestores, 0 .ts, 0 .map, sin .env*/.pem/.key/.npmrc/.pnpmfile.cjs, nada escribible por node; standalone solo traza package.json de packages/*; telemetría desactivada. Endpoint: 503 no-store, POST 405, 404, sin x-powered-by; rutas solo /, /api/health, /_not-found, /_global-error.
- Hallazgos: LOW-1 sin validar Host/Origin ni cabeceras (→ decisión humana: requisito MEDIUM del DoD de TASK-014; TD-005 ampliada; OD-003 ligada); LOW-2 /_next/image activo sin uso (EACCES por petición; → images.unoptimized en ciclo 1 + tmpfs en ciclo 2); LOW-3 pool por petición (→ TASK-014); LOW-4 web con salida a internet (→ TD-018/TASK-020); LOW-5 claves de preview y encryptionKey en la imagen (→ TASK-040); LOW-6 falta --ignore-pnpmfile (→ TD-033); LOW-7 sin read_only ni límites (→ TASK-037).

---
## Ciclo de corrección 1/3
### IMPLEMENTATION — persistence-dev
- index.test.ts:33-38 `expect(exportsField).toEqual(expectedExports)` con `.`, `./migrate`, `./testing`; :39-42 existsSync de cada destino; imports :2-3. make validate: Tasks 4/4, format:check OK (exit no capturado por PIPESTATUS en zsh; primera pasada falló format:check, reformateado con Edit).
### IMPLEMENTATION — web-dev
- apps/web/next.config.ts:12-13 comentario + `images: { unoptimized: true },`; docker build --target build OK (exit no capturado), etiqueta borrada.
### TEST (delta) — tester: FAIL
- Test de exports falla con un sub-export ficticio (AssertionError en :38) ✅; make validate EXIT=0 ✅ (core 171, persistence 106, web 6, worker 44); /_next/image 404 ×20 ✅; /api/health 200 ✅; PERO 20 unhandledRejection y 20 EACCES `mkdir '/app/apps/web/.next/cache'` en el log ❌.
- Decisión humana: ciclo 2/3, tmpfs en compose (uid 1000, 64m); consecuencia en ADR-012; tester y security re-verifican; TD-032 ampliada a apps/web (TASK-027).

## Ciclo de corrección 2/3
### IMPLEMENTATION — devops
- compose.yaml:43-45 comentario + `tmpfs: - /app/apps/web/.next/cache:uid=1000,gid=1000,mode=0700,size=64m` (Edit). compose config lo muestra; 20 peticiones 404; unhandled=0 eacces=0; /api/health 200; stat node 700; mount tmpfs rw,nosuid,nodev,noexec,size=65536k,mode=700,uid=1000,gid=1000; find /app -writable fuera del tmpfs vacío; make test EXIT=0; make down 0.
### TEST (delta) — tester: PASS
- 404 ×10 locales y ×10 remotas; unhandledRejection 0; EACCES 0; log de web limpio (Next.js 16.4.2 Ready); /api/health 200 exacto; / 200 AgentLab; make test EXIT=0; make down.
### SECURITY (delta): APPROVED
- Imagen final sin compose ni tmpfs como uid 1000: find /app -writable vacío; find /app ! -user root vacío; .next/cache no existe; mkdir/touch Permission denied. tmpfs solo en el contenedor (compose config --no-interpolate); en agentlab-web-1 tmpfs nosuid,nodev,noexec,65536k,700,uid 1000; binario en tmpfs → rc 126; dd 100 MB cortado en 64 MiB. LOW-2: con unoptimized, render404 antes de validateParams y de cualquier fetch (next-server.js:193); sharp no se carga (0 mapeos); ImageOptimizerCache se construye antes del 404 (183-187) → necesita el tmpfs; deuda sharp LOW → TASK-040. LOW-7 sin cambio (/home/node, /tmp, /var/tmp, /run/lock escribibles en la capa del contenedor; TASK-037 read_only + tmpfs /tmp).
### REVIEW (delta): APPROVED
- Verificados con cita: index.test.ts:38 (+ :34-36, :40-41, :2-3); next.config.ts:13 (+ :12); compose.yaml:45 (+ :43-44). NITs: cast de route.integration.test.ts:19 y JSDoc de pingDatabase se dejan; plan :132/:193/:363 → paso 5 (hecho). Solo esos tres ficheros de código cambiaron en los ciclos. Sin deuda nueva.

## CLOSURE del cierre (docs-keeper)
- Registro de cambios: fila «TASK-007 → DONE» en `docs/TASKS.md` (última fila).
- Fechas: todas de `Fecha: 2026-10-21` (encargo del Orchestrator).
- Ver `Ficheros` de este informe para la lista completa de ficheros tocados por el cierre.
