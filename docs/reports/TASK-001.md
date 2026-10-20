# TASK-001 — Monorepo pnpm + Turborepo + TypeScript estricto

| Campo | Valor |
|---|---|
| Tarea | TASK-001 · Monorepo pnpm + Turborepo + TypeScript estricto |
| Hito | M0 |
| Owner | devops |
| Fecha | 2026-10-20 |
| Veredicto tester | PASS (ciclo 2) |
| Veredicto reviewer | APPROVED (ciclo 2) |
| Security | No aplica (confirmado por reviewer: el diff no toca providers, tools, policies, API, docker, compose, CI, `.claude` ni `.githooks`) |
| Ciclos de corrección | 2 (corrección 1/3: `.pnpm-store/`; corrección 2/3: imports relativos entre paquetes y `globalDependencies`) |
| Plan | `docs/reports/TASK-001-plan.md` |

## Decisiones humanas citadas (2026-10-20)

- "TASK-001 — amplía el scope en TASKS.md con: apps/*/src/index.ts, packages/*/src/index.ts, apps/*/tsconfig.json, packages/*/tsconfig.json. Sustituye .eslintrc.cjs por eslint.config.js ... deps_allowed para TASK-001 (solo devDependencies en la raíz): typescript, turbo, eslint, @eslint/js, typescript-eslint, prettier, eslint-config-prettier, @types/node."
- "TASK-001: plan aprobado con ESLint 10.13.0 ... DoD: "ESLint última major estable, flat config". Añade a la DoD: `.npmrc` con `engine-strict=true` y `engines` en package.json (node 22, pnpm 9.15.9) ...; devops valida con Node 22 (nvm o contenedor), no con el Node de la máquina."
- "Decido ya: TypeScript 5.9.3 y @types/node 22"
- "pnpm-lock.yaml: confirmado"
- "Sí: ciclo de corrección con devops — .pnpm-store/ en .gitignore, borrar la carpeta, y el comando de validación en Docker con el store fuera del repo ..."
- "Deuda de devops: acepto las tres como LOW. Pago: TypeScript 6/7 y pnpm → una tarea nueva "ADR de herramientas" al cerrar M0 (que docs-keeper la cree como TASK-040, owner architect, BLOCKED por TASK-009). "pnpm -r lint no cubre la raíz" → corregir en TASK-006 (añadir lint de raíz al pipeline de CI); amplía su DoD."
- "Deuda: aprobadas las tres pendientes, LOW, con esas tareas de pago. En la de rootDir, que la fila diga explícitamente "rootDir se mantiene; decidir include/tsconfig aparte", para que nadie lo "arregle" quitándolo."

## Ficheros

- **Creados**: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.nvmrc`, `.npmrc`, `eslint.config.js`, `.prettierrc`, `.editorconfig`, `apps/web/{package.json,tsconfig.json,src/index.ts}`, `apps/worker/{package.json,tsconfig.json,src/index.ts}`, `packages/core/{package.json,tsconfig.json,src/index.ts}`, `packages/persistence/{package.json,tsconfig.json,src/index.ts}`.
- **Modificados**: `.gitignore` (añadido `.pnpm-store/`). `Makefile` sin cambios.

## Comando de validación definitivo

```
docker volume create agentlab-pnpm-store
docker run --rm -v "$PWD":/work -v agentlab-pnpm-store:/pnpm-store -e npm_config_store_dir=/pnpm-store -e TURBO_TELEMETRY_DISABLED=1 -w /work node:22 bash -c 'corepack enable && corepack prepare pnpm@9.15.9 --activate && rm -rf node_modules && pnpm install --frozen-lockfile && pnpm -r typecheck && pnpm -r lint && pnpm test && pnpm format:check'
```

## Versiones instaladas

typescript 5.9.3 · turbo 2.11.9 · eslint 10.13.0 · @eslint/js 10.0.1 · typescript-eslint 8.72.0 · prettier 3.9.10 · eslint-config-prettier 10.1.8 · @types/node 22.20.5 · packageManager pnpm@9.15.9 · .nvmrc 22 · engines node ">=22 <23", pnpm "9.15.9".

---

## PLAN — TASK-001 (resumen; completo en docs/reports/TASK-001-plan.md)

Probado en repo de prueba en el scratchpad (fuera del proyecto) con Node 26.11.1 y pnpm 9.12.2. Versiones: typescript 5.9.3, turbo 2.11.9, eslint 9.39.5 (luego 10.13.0 por decisión humana), @eslint/js 9.39.5 (luego 10.0.1), typescript-eslint 8.72.0, prettier 3.9.10, eslint-config-prettier 10.1.8, @types/node 22.20.5, pnpm@9.15.9, .nvmrc 22. Decisiones: module ESNext + bundler + verbatimModuleSyntax (NodeNext incompatible con bundler TS5095; Preserve mantiene CJS); tsconfig base + uno por workspace con extends + include src, sin project references; herramientas solo en raíz, scripts typecheck/lint por workspace; sin script test en workspaces, raíz `turbo run test` (exit 0); defineConfig/globalIgnores + tseslint.configs.strict sin type-aware + prettier al final; workspaces @agentlab/core, @agentlab/persistence, web, worker; Prettier {}; Makefile y .gitignore intactos. Riesgos: role-guard no permitía src/index.ts (resuelto por el humano); ESLint 9 EOL y pnpm 9 sin mantenimiento; Node 26 en la máquina; telemetría de turbo; eslint.config.js de raíz no lo cubre `pnpm -r lint`. OD: A ESLint 9 vs 10 (→ 10 por decisión humana); B "última estable" vs peers (→ TS 5.9.3); C TS en runtime (→ OD-007); D telemetría turbo (→ decidido, DoD TASK-003/006).

## IMPLEMENTATION — TASK-001 (ciclo 0)

Esqueleto creado y validado en Node 22: 4 workspaces vacíos con src/index.ts (`export {};`): apps/web, apps/worker, @agentlab/core, @agentlab/persistence (exports["."]="./src/index.ts"). Herramientas solo en raíz, versiones exactas sin ^; workspaces solo con scripts typecheck y lint. Makefile y .gitignore sin tocar. Sin commit.
Creados: raíz package.json, pnpm-workspace.yaml, turbo.json, tsconfig.base.json, .nvmrc, .npmrc, eslint.config.js, .prettierrc, .editorconfig; por workspace package.json, tsconfig.json, src/index.ts; pnpm-lock.yaml generado.
En node:22 (pnpm 9.15.9, TURBO_TELEMETRY_DISABLED=1): pnpm install → Done 3.2s sin WARN ni peer; pnpm -r typecheck 4/4; pnpm -r lint 4/4; pnpm test → "0 successful, 0 total" exit 0; format:check OK.
Sondas negativas (eliminadas): no-restricted-imports '@agentlab/core/src/index.ts'; TS2375 exactOptionalPropertyTypes; TS2322 noUncheckedIndexedAccess.
Node 26.11.1 local: `pnpm install --frozen-lockfile` exit 1 "Expected version: >=22 <23 / Got: v26.11.1".
Versiones (pnpm list): typescript 5.9.3, turbo 2.11.9, eslint 10.13.0, @eslint/js 10.0.1, typescript-eslint 8.72.0 (peers eslint ^10, typescript >=4.8.4 <6.1.0), prettier 3.9.10, eslint-config-prettier 10.1.8, @types/node 22.20.5.
DoD 8/8 ✅. Desviaciones: ninguna. Fuera de scope: ninguno. Deuda propuesta (LOW): TS 6/7; pnpm 9 sin mantenimiento; eslint.config.js y raíz fuera de pnpm -r lint. Dudas: bash-guard bloqueó `2>&1` tras pnpm install (resuelto separando comandos); make lint/typecheck usan pnpm -r, scripts raíz usan turbo run.

## IMPLEMENTATION — TASK-001 (corrección ciclo 1/3)

Hallazgo del Orchestrator: `.pnpm-store/` (96 MB) creado en la raíz por la validación en Docker y no ignorado.
`.pnpm-store/` añadido a .gitignore (existente intacto) y carpeta borrada. Validación repetida en node:22 con store en volumen `agentlab-pnpm-store` montado en /pnpm-store (comando definitivo arriba). Install: +102 paquetes, Done 1.1s, cero WARN de peers; typecheck y lint 4/4; test exit 0; prettier OK. No se recreó caché en el repo; .pnpm-store/ y node_modules/ ignorados. node_modules del contenedor no usable fuera (binarios Linux, Node 26 local). Node 26 local: ERR_PNPM_UNSUPPORTED_ENGINE exit 1. Deuda propuesta: target `make validate` (LOW).

## TEST — TASK-001 (ciclo 0)

node:22, pnpm 9.15.9, node_modules borrado: install --frozen-lockfile +102, grep warn/peer vacío (solo banner "Update available"); typecheck 4/4; lint 4/4; test exit 0 ("No tasks were executed"); format:check OK; pnpm list = declarado. Node 26 local falla por engines. Sondas en *.test.ts temporal (borrado): no-restricted-imports + TS2307; TS2375; TS2322. eslint latest 10.13.0; typescript-eslint@8.72.0 peers eslint ^8.57||^9||^10, typescript >=4.8.4 <6.1.0. git status: solo ficheros del scope; .turbo/ ignorado.
DoD: 1 ✅ · 2 ✅ · 3 ✅ (tsc --showConfig; "type":"module" en los 5 package.json) · 4 ✅ · 5 ✅ · 6 ✅ · 7 ✅ · 8 ✅. Veredicto: PASS

## REVIEW — TASK-001 (ciclo 0)

- [MAJOR] eslint.config.js:12-23 + {apps,packages}/*/tsconfig.json:1-4 — imports relativos entre paquetes no detectados (probado en copia: `../../persistence/src/index` y `../../../apps/web/src/index` desde core → eslint y tsc exit 0). Incumple ARCHITECTURE §2 y Verificación de ADR-001. Cambio: `"compilerOptions": { "rootDir": "src" }` en cada tsconfig de workspace (TS6059 en import relativo; @agentlab/core por symlink sigue pasando). no-restricted-imports relativo no basta; eslint-plugin-import no autorizado.
- [MINOR] turbo.json:1-9 — faltan globalDependencies: tocar tsconfig.base.json o eslint.config.js no cambia el hash de #typecheck/#lint. Cambio: `"globalDependencies": ["tsconfig.base.json", "eslint.config.js"]`.
- [NIT] apps/web/src/index.ts:1 — placeholder ajeno a App Router; TASK-007 debe sustituirlo.

Revisado sin hallazgos: nombres de workspace, exports, type module, private; engines y versiones exactas; lockfile coherente; turbo.json resto; ESLint flat; .editorconfig/.gitignore; tsconfig del plan.
Cumplimiento: SPEC ✅ · ARCHITECTURE ❌ (§2) · ADRs ❌ (Verificación ADR-001) · DoD ✅ · plan ✅. Sobrearquitectura: ninguna. Deuda: placeholder web → TASK-007; globalDependencies → TASK-006 si no se corrige. Security: no. Veredicto: CHANGES_REQUESTED

## IMPLEMENTATION — TASK-001 (corrección ciclo 2/3)

[MAJOR] `"compilerOptions": { "rootDir": "src" }` en los 4 tsconfig de workspace. [MINOR] turbo.json `"globalDependencies": ["tsconfig.base.json", "eslint.config.js"]`. [NIT] no tocado. Modificados: turbo.json y 4 tsconfig.json. Suite completa verde en node:22. Sonda negativa en copia: TS6059 para persistence y apps/web, typecheck exit 2 (antes 0). Sonda positiva en copia con "@agentlab/core": "workspace:*" solo en la copia → exit 0. Hash turbo typecheck 68ef4fcbc2579894 → e4e02d269dd10e63 al tocar tsconfig.base.json (solo en copia). Sin cachés nuevas. DoD ✅. Desviaciones/fuera de scope/deps/OD/deuda nueva: ninguna.

## TEST — TASK-001 (ciclo 2)

Copia del repo en scratchpad, docker node:22, pnpm 9.15.9. Suite completa EXIT=0 (typecheck 4/4, lint 4/4, test 0 tareas, format OK; salida de install no visible en esta pasada, EXIT=0, ausencia de warnings confirmada en ciclo 0 y lockfile sin cambios). tsc --showConfig core: bundler, strict, rootDir ./src, include src. Import relativo cruzado → TS6059 exit 2. @agentlab/core/src/index → no-restricted-imports. Import válido @agentlab/core → typecheck 0, lint 0. Hashes @agentlab/core typecheck cfd183a5→bac56ffa (tsconfig.base)→1803631c (eslint.config); lint c69068a2→90a3557e→d4cb7014. Node 26 local → ERR_PNPM_UNSUPPORTED_ENGINE (también pnpm 9.12.2 vs 9.15.9). Scope OK; sin dist ni tsbuildinfo; .turbo ignorado.
DoD 8/8 ✅. Correcciones: MAJOR ✅, MINOR ✅. Veredicto: PASS

## REVIEW — TASK-001 (ciclo 2, limitada)

MAJOR → RESUELTO (rootDir en los 4 tsconfig:3; comprobado TS6059 y @agentlab/core exit 0). MINOR → RESUELTO (turbo.json:3). NIT → deuda TASK-007. Sin hallazgos nuevos. Notas: emit futuro a dist/ encaja con outputs; rootDir choca con .ts fuera de src en include (vitest.config.ts TASK-004, next.config.ts TASK-007): no rompe hoy. Verificación ADR-001: CUMPLIDA (typecheck TS6059 + ESLint @agentlab/*/src/**). Cumplimiento: SPEC ✅ · ARCHITECTURE ✅ · ADRs ✅ · DoD ✅ · plan ✅. Sobrearquitectura: ninguna. Deuda: rootDir vs config/tests (TASK-004, TASK-007); placeholder web (TASK-007). Security: no. Veredicto: APPROVED

## SECURITY — TASK-001

No aplica (confirmado por reviewer: el diff no toca providers, tools, policies, API, docker, compose, CI, `.claude` ni `.githooks`).

---

## Deuda registrada

- TD-006 · TypeScript fijado en 5.9.3 (typescript-eslint 8.72.0 exige `<6.1.0`) y pnpm 9.15.9 sin mantenimiento. LOW. Se paga en TASK-040.
- TD-007 · `pnpm -r lint` no cubre los ficheros de configuración de la raíz (`eslint.config.js`, etc.). LOW. Se paga en TASK-006.
- TD-008 · Sin target `make validate` para la validación en Docker `node:22` con store fuera del repo. LOW. Se paga en TASK-003.
- TD-009 · `apps/web/src/index.ts` es un placeholder ajeno a App Router. LOW. Se paga en TASK-007.
- TD-010 · `rootDir: src` en los tsconfig de workspace impide tipar ficheros de config/tests fuera de `src` (vitest.config.ts, next.config.ts). LOW. **rootDir se mantiene; decidir include/tsconfig aparte** (rootDir es lo que cumple la Verificación de ADR-001; no quitarlo). Se paga en TASK-004 y TASK-007.

## OPEN DECISIONS registradas

- Ninguna nueva. Resueltas durante la tarea: A (ESLint 9 vs 10 → 10, decisión humana), B ("última estable" vs peers → TypeScript 5.9.3), D (telemetría de turbo → desactivada, DoD de TASK-003 y TASK-006).
- Sigue abierta OD-007 (TypeScript en runtime), que bloquea TASK-003 y TASK-008. No la resuelve esta tarea.
