# PLAN — TASK-001 · Monorepo pnpm + Turborepo + TypeScript estricto

Autor: architect · Fecha: 2026-10-20 · Owner de la implementación: devops

## Contexto
Repositorio sin código: solo `docs/`, `.claude/`, `.githooks/`, `scripts/`, `Makefile` y `.gitignore`. TASK-001 crea el esqueleto (ADR-001, SPEC §7, ARCHITECTURE §2/§9/§10) con cuatro workspaces vacíos y las herramientas de calidad, sin dependencias de runtime. Todo el plan se ha **prototipado en un directorio temporal fuera del repo** (Node 26.11.1 local, pnpm 9.12.2): install limpio sin warnings de peer deps, `pnpm -r typecheck`, `pnpm -r lint`, `pnpm test` y la regla `no-restricted-imports` verificados.

## Versiones verificadas (npm registry, 2026-10-20)

| Paquete | Propuesta | `latest` hoy | Motivo |
|---|---|---|---|
| `typescript` | **5.9.3** | 7.0.2 | ARCHITECTURE §9 / SPEC §3 fijan "5.x". `typescript-eslint@8.72.0` declara peer `typescript >=4.8.4 <6.1.0` → 7.0.2 rompe el DoD (warning de peer). Ver OD-B. |
| `turbo` | 2.11.9 | 2.11.9 | — |
| `eslint` | **9.39.5** (DoD literal) | 10.13.0 | ESLint 9 es **EOL desde 2026-08-06**; `pnpm install` emite `WARN deprecated eslint@9.39.5`. Ver OD-A. |
| `@eslint/js` | 9.39.5 | 10.0.1 | Debe ir en la misma major que `eslint` (10.0.1 declara peer `eslint ^10`). |
| `typescript-eslint` | 8.72.0 | 8.72.0 | Peer `eslint ^8.57 \|\| ^9 \|\| ^10`. |
| `prettier` | 3.9.10 | 3.9.10 | — |
| `eslint-config-prettier` | 10.1.8 | 10.1.8 | Peer `eslint >=7`. |
| `@types/node` | **22.20.5** | 26.6.5 | Última de la línea 22, alineada con el runtime (Node 22). Ver OD-B. |
| pnpm (`packageManager`) | `pnpm@9.15.9` | 12.14.0 | Última 9.x (2025-03-10), según ARCHITECTURE §9. |
| Node (`.nvmrc`) | `22` | — | ARCHITECTURE §9: 22 LTS. |

Fuentes: `npm view <pkg> dist-tags|peerDependencies|time` (2026-10-20); https://eslint.org/version-support (consultado 2026-10-20: v9 EOL 2026-08-06, v10 Current desde 2026-02-06). Si al instalar alguna `latest` ha cambiado, devops la revalida contra los mismos criterios (peer deps + ARCHITECTURE) y la documenta en su informe.

Variante alternativa también prototipada con éxito y **sin ningún warning**: `eslint@10.13.0` + `@eslint/js@10.0.1` + `typescript@6.0.3`.

## Decisiones de diseño

1. **`module: "ESNext"` + `moduleResolution: "bundler"`** — descartado `NodeNext` porque es incompatible con `bundler` (TS5095); descartado `Preserve` (TS ≥5.4, también válido) porque conserva semántica CJS (`import x = require()`) que no queremos en un repo solo ESM. `ESNext` + `verbatimModuleSyntax` prohíbe sintaxis CJS y obliga a `import type`. `exactOptionalPropertyTypes` no interactúa con `module`/`moduleResolution`; su única fricción práctica son `.d.ts` de terceros escritos sin esa opción → `skipLibCheck: true`. Consecuencia de `bundler`: se permiten imports relativos sin extensión, así que el JS emitido no es ejecutable tal cual por Node ESM → OD-C (no bloquea esta tarea).
2. **Un `tsconfig.base.json` + un `tsconfig.json` mínimo por workspace (`extends` + `include: ["src"]`)**, sin `references`/`composite` — descartado project references porque los paquetes exportan fuente (`./src/index.ts`) y no hay build; añadirían `.tsbuildinfo` y `outDir` sin beneficio.
3. **Herramientas solo en la raíz; cada workspace solo declara scripts** (`typecheck: tsc --noEmit`, `lint: eslint .`) — pnpm añade `node_modules/.bin` de la raíz al PATH de los scripts de workspace y ESLint encuentra `eslint.config.js` subiendo directorios (verificado). Descartado: devDependencies por workspace (fuera de `deps_allowed`).
4. **Sin script `test` en workspaces** hasta TASK-004 (vitest). Raíz: `"test": "turbo run test"` → turbo imprime "No tasks were executed" y sale con 0 (verificado); `pnpm -r test` también sale con 0. Así `make test` funciona sin inventar un `test` de mentira. Descartado `echo` placeholder: falsearía un verde.
5. **Sin script `build`** en ningún workspace (exportan fuente; las apps reciben build en TASK-007/008). `turbo.json` define igualmente `build` para cumplir el DoD.
6. **ESLint**: `defineConfig` + `globalIgnores` de `eslint/config` (funciona en 9.39.5 y en 10.x, verificado), `js.configs.recommended`, `tseslint.configs.strict` (sin type-aware) y `eslint-config-prettier` al final. Descartado `tseslint.config()` porque está `@deprecated` en 8.72.0; descartado lint type-aware (`projectService`) porque duplica el coste de `tsc` sin que esta tarea lo pida (cubre `no-explicit-any`, `no-non-null-assertion`, `ban-ts-comment`, verificados).
7. **Nombres**: `@agentlab/core`, `@agentlab/persistence`; apps `web` y `worker` (literal de `monorepo-conventions`). Descartado `@agentlab/web` porque la convención no lo dice.
8. **Prettier con su configuración por defecto (`{}`)** — descartado fijar estilo propio porque SPEC/ARCHITECTURE no lo definen; cambiarlo luego es un reformat trivial. Los scripts `format`/`format:check` se limitan a código y configs JSON/JS (no `docs/**` ni YAML) para no reformatear ficheros de otros roles.
9. **`$schema` de turbo local** (`./node_modules/turbo/schema.json`, el paquete lo incluye) — descartada la URL remota porque el dominio ha cambiado entre versiones.
10. **`Makefile` y `.gitignore` sin cambios**: los objetivos actuales (`lint`/`typecheck` con `pnpm -r`, `test` con `pnpm test`) ya encajan y `.gitignore` ya cubre `node_modules/`, `dist/`, `.turbo/`, `coverage/`. Están en el scope solo por si acaso; no se tocan.

## Pasos (devops)

1. `.nvmrc` → `22`. `.editorconfig` → `root = true`; `[*]` utf-8, lf, `indent_style = space`, `indent_size = 2`, `insert_final_newline`, `trim_trailing_whitespace`; `[*.md]` `trim_trailing_whitespace = false`; `[Makefile]` `indent_style = tab`.
2. `pnpm-workspace.yaml` → `packages: ["apps/*", "packages/*"]`.
3. `package.json` (raíz): `name: "agentlab"`, `private: true`, `type: "module"`, `packageManager: "pnpm@9.15.9"`, scripts `build|typecheck|lint|test: turbo run <x>`, `format: prettier --write "{apps,packages}/**/*.{ts,tsx,js,json}" "*.{js,json}"`, `format:check` (igual con `--check`); `devDependencies` con las 8 versiones exactas de la tabla, **sin `^`**. Recomendado: escribir las versiones en el fichero y luego `pnpm install` a secas (el bash-guard trata como paquete cualquier token que no empiece por `-`, incluido `2>&1`: no añadir redirecciones al comando de instalación).
4. `tsconfig.base.json`: `target: "ES2023"`, `lib: ["ES2023"]`, `module: "ESNext"`, `moduleResolution: "bundler"`, `moduleDetection: "force"`, `verbatimModuleSyntax: true`, `isolatedModules: true`, `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `skipLibCheck: true`, `types: ["node"]`. Nada más.
5. `turbo.json`: `$schema` local; `tasks`: `build {dependsOn:["^build"], outputs:["dist/**"]}`, `typecheck {dependsOn:["^build"], outputs:[]}`, `lint {dependsOn:["^build"], outputs:[]}`, `test {dependsOn:["^build"], outputs:["coverage/**"]}`. (`^build` en las cuatro: lectura literal del DoD y correcto si un paquete añade build más adelante; hoy es no-op.)
6. `eslint.config.js` (ESM) según decisión 6, con:
   `'no-restricted-imports': ['error', { patterns: [{ group: ['@agentlab/*/src', '@agentlab/*/src/**'], message: 'Import from the package entry point (@agentlab/<pkg>), never from its src/.' }] }]`.
   Ignorar `**/dist/`, `**/.turbo/`, `**/.next/`, `**/coverage/`. No bloquea `@agentlab/persistence/testing` ni `@agentlab/providers/testing` (verificado).
7. `.prettierrc` → `{}`.
8. Workspaces `apps/web`, `apps/worker`, `packages/core`, `packages/persistence`: `package.json` (`name`, `version: "0.0.0"`, `private: true`, `type: "module"`, scripts `typecheck`/`lint`; **solo los paquetes** llevan `exports: {".": "./src/index.ts"}`), `tsconfig.json` (`extends: "../../tsconfig.base.json"`, `include: ["src"]`), `src/index.ts` con `export {};`. **Bloqueado por el role-guard (ver Riesgos).** `apps/web` sin next/react.
9. `pnpm install` en limpio, verificación (abajo), `pnpm format:check`, e informe con las versiones exactas instaladas.

## Contratos públicos nuevos/cambiados
Ninguna API TS. Contratos de herramienta: scripts raíz `build|typecheck|lint|test|format|format:check`; scripts por workspace `typecheck`, `lint`; paquetes `@agentlab/core` y `@agentlab/persistence` con `exports["."] = "./src/index.ts"`.

## Tests / verificación (tester)
Sin tests unitarios (vitest llega en TASK-004). Verificación por comandos:
- `rm -rf node_modules && pnpm install` → ninguna línea `WARN … peer` / "Issues with peer dependencies" (con ESLint 9 aparecerá `WARN deprecated eslint@9.39.5`, que no es de peer deps; ver OD-A).
- `pnpm -r typecheck` y `pnpm -r lint` → exit 0 en los 4 workspaces; `pnpm test` y `make test` → exit 0.
- Sondas negativas temporales (crear, comprobar fallo, borrar): import `@agentlab/core/src/index.ts` → `no-restricted-imports`; `const o: { a?: string } = { a: undefined }` → error TS (exactOptionalPropertyTypes); `const s: string = ([] as string[])[0]` → error TS (noUncheckedIndexedAccess).
- `pnpm --filter @agentlab/core exec tsc --showConfig` muestra las opciones del DoD; `grep '"\^' package.json` vacío; `pnpm turbo run build lint typecheck test --dry=json` lista las 4 tareas.

## Riesgos
1. **BLOQUEANTE — role-guard**: `.claude/hooks/role-guard.sh` (rol `devops`) no permite `apps/*/src/index.ts` ni `packages/*/src/index.ts`. devops no podrá completar el paso 8 ni el DoD "un `index.ts` cada uno". Lo resuelve el humano/Orchestrator (fuera del scope del architect).
2. **ESLint 9 EOL** (OD-A) y **pnpm 9 sin mantenimiento** (última 9.15.9 de 2025-03; `latest` es 12.x): ARCHITECTURE §9 lo fija; cambiarlo requiere ADR. Recomiendo abrir un ADR de toolchain tras M0.
3. **Entorno local ≠ objetivo**: la máquina tiene Node 26.11.1 sin corepack y pnpm 9.12.2. Las comprobaciones pasan también con Node 26, pero devops debe validar con Node 22 (nvm/fnm) y pnpm 9.15.9 (`pnpm self-update 9.15.9`) para que el lockfile sea representativo.
4. **Telemetría de Turborepo** activada por defecto (aviso en la primera ejecución). No es un secreto, pero contradice el espíritu "sin dependencias externas"; ver OD-D.
5. Ficheros de config raíz (`eslint.config.js`) no se lintan con `pnpm -r lint` (root excluido). Aceptable en M0.

## OPEN DECISIONS
- **OD-A — ESLint 9 (DoD literal) está EOL.** (a) 9.39.5 + `@eslint/js` 9.39.5: cumple el DoD, `WARN deprecated` en cada install, sin parches de seguridad. (b) 10.13.0 + `@eslint/js` 10.0.1: soportada, cero warnings, mismo `eslint.config.js` (verificado); requiere que el humano enmiende la viñeta del DoD ("ESLint ≥ 9 con flat config"). **Recomendación: (b).** Si no hay decisión, devops ejecuta (a) y lo anota como deuda.
- **OD-B — Cómo leer "última estable" cuando choca con ARCHITECTURE o con los peers.** `typescript` latest 7.0.2 (incompatible con `typescript-eslint`, contradice "5.x"); `@types/node` latest 26.x (tipa APIs que Node 22 no tiene). (a) Última estable compatible con ARCHITECTURE §9 y sin warnings de peer: TS 5.9.3, `@types/node` 22.20.5. (b) TS 6.0.3 (último compatible con typescript-eslint; obliga a actualizar ARCHITECTURE §9 vía ADR). **Recomendación: (a)**, con deuda LOW para subir a TS 6/7 cuando typescript-eslint soporte 7.
- **OD-C — Cómo se ejecuta TS en runtime (worker) y cómo se consumen paquetes que exportan `.ts`.** No bloquea TASK-001; sí TASK-003/TASK-008. Opciones: bundle (esbuild/tsup) · `tsx` · type stripping nativo de Node 22 (exigiría imports con `.ts` y choca con `moduleResolution: bundler` sin extensiones). Necesita dependencias fuera de `deps_allowed`. **Recomendación:** que el architect lo resuelva como ADR antes de TASK-003; registrar en SPEC §13.
- **OD-D — Telemetría de Turborepo.** (a) `TURBO_TELEMETRY_DISABLED=1` en Makefile/CI/Dockerfiles; (b) dejar al criterio de cada desarrollador (`turbo telemetry disable`). **Recomendación: (a)** en TASK-003/TASK-006 (no en esta tarea).
