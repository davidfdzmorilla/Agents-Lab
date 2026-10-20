---
name: monorepo-conventions
description: "Convenciones del monorepo de AgentLab (pnpm + Turborepo, paquetes, dirección de dependencias, nombres, errores, env, logging). Precargado en los subagentes que escriben código."
---

# Convenciones del monorepo

Fuente: `docs/ARCHITECTURE.md §2, §10` y ADR-001. Esto es un resumen operativo; ante duda, manda ARCHITECTURE.

## Paquetes y dependencias
- Nombres: `@agentlab/core`, `@agentlab/persistence`, `@agentlab/policies`, `@agentlab/providers`, `@agentlab/orchestrator`, `@agentlab/agents`, `@agentlab/observability`, `@agentlab/tools`, `@agentlab/evaluations`; apps: `web`, `worker`.
- Dirección: `core ← persistence ← policies ← providers ← orchestrator ← agents ← {worker, web}`. `observability` solo depende de `core`; `tools` de `core` + `policies`; `evaluations` de `core` + `persistence`. Un paquete **nunca** importa de uno "más alto".
- Exports solo desde `src/index.ts`. Importar `@agentlab/x/src/…` está prohibido (ESLint lo bloquea). Sub-exports permitidos: `@agentlab/providers/testing`, `@agentlab/persistence/testing`.
- No crees un paquete que ROADMAP no asigne a tu hito. No crees paquetes vacíos.

## Plantilla de paquete
```
packages/<name>/
├── package.json        # name, type: module, exports: {".": "./src/index.ts"}, scripts: typecheck/lint/test
├── tsconfig.json       # extends ../../tsconfig.base.json
├── vitest.config.ts
└── src/index.ts
```

## Código
- ESM, TypeScript `strict`. Nada de `any`, `as unknown as`, `!` no justificado, `@ts-ignore`.
- Ficheros `kebab-case.ts`. Tipos `PascalCase`. Esquemas Zod `XxxSchema` + `type Xxx = z.infer<…>`.
- Errores: subclase de `AgentLabError` con `code` estable en SCREAMING_SNAKE. Nunca `throw new Error()` fuera de tests.
- `process.env` solo en `@agentlab/core` (`env.ts`). El resto recibe config por parámetros.
- El objeto que devuelve `loadEnv()` contiene secretos (claves, contraseña de la base de datos): **no se pasa entero a ningún logger, error ni serialización**; se leen campos sueltos y las claves de proveedor solo mediante el `SecretResolver` (TD-011, hasta TASK-027).
- Logging: logger inyectado (`pino` hasta M3; `@agentlab/observability` después). Nunca `console.*` en paquetes.
- Nada de singletons ni estado de módulo mutable. Dependencias por inyección en funciones de construcción (`buildX(deps)`).
- Comentarios solo cuando el porqué no es evidente. Sin comentarios que narren el qué.
- Un commit por tarea; el mensaje lo prepara `committer`.

## Comandos
```
pnpm install                       # nunca con paquetes nuevos sin deps_allowed
pnpm -r typecheck · pnpm -r lint · pnpm -r test
pnpm --filter @agentlab/<pkg> <script>
pnpm db:migrate · pnpm db:reset    # requieren DATABASE_URL / DATABASE_URL_TEST
```
