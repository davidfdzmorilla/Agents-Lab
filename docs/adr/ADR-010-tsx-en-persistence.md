# ADR-010 — `tsx` también en `packages/persistence` para `db:migrate` y `db:reset`

| Campo | Valor |
|---|---|
| Estado | Accepted (2026-10-20, aprobado por el responsable humano con una precisión) |
| Fecha | 2026-10-20 |
| Decisores | Responsable humano · architect |
| Relacionado | ADR-009 (§2 de Decisión, que este ADR amplía); ADR-002 (§7: `setup()` en `pnpm db:migrate`); ARCHITECTURE §2, §9; TASK-005 (`docs/reports/TASK-005-plan.md`) |

> **Decisión humana (2026-10-20, literal):** "ADR-010: Accepted. Precisión: tsx es devDependency de packages/persistence (sus scripts db:*) y dependencia de runtime solo de apps/worker; ADR-010 lo registra como ampliación de ADR-009 §2, no como contradicción."
>
> La propuesta original ponía `tsx` en `dependencies` de `persistence`. La precisión lo cambia a `devDependencies`; el texto de abajo ya la incorpora.

## Contexto
ADR-009 §2 dice que `tsx` va en `dependencies` de `apps/worker` y que «no va en la raíz ni en otros workspaces». TASK-005 necesita que `pnpm db:migrate` y `pnpm db:reset` ejecuten TypeScript del propio `packages/persistence`. Esos scripts:

- leen la configuración con `loadEnv()` de `@agentlab/core`, que exporta `.ts` sin build (ADR-001);
- aplican las migraciones de Drizzle con `migrate()` de `drizzle-orm/node-postgres/migrator`;
- ejecutan `setup()` de `PostgresSaver` sobre el esquema `langgraph` (ADR-002 §7).

Se ejecutan en dos sitios, y ninguno de los dos tiene la toolchain del host:

- el servicio one-shot `migrate` de `compose.yaml`;
- el contenedor de `make test`, que llama a `db:reset` sobre `agentlab_test`.

`persistence` es el dueño de las migraciones (ARCHITECTURE §2), así que el punto de entrada debería vivir ahí.

## Decisión
1. `tsx` **`4.23.15`**, la misma versión exacta de ADR-009, entra en **`devDependencies`** de `packages/persistence`, solo para sus scripts `db:*`. Como dependencia de runtime, `tsx` sigue estando **solo** en `apps/worker` (ADR-009 §2). Esto amplía ADR-009 §2 («no va en otros workspaces»): no lo contradice. Verificado con `npm view tsx@4.23.15` el 2026-10-20: es `latest`, `engines.node >=18.0.0` y trae `esbuild ~0.28.0`. El lockfile ya la resuelve por `apps/worker`, así que no añade una versión nueva.
2. Scripts de `packages/persistence/package.json`: `db:migrate` = `tsx src/cli/migrate.ts` y `db:reset` = `tsx src/cli/reset.ts`. Los scripts homónimos de la raíz delegan con `pnpm --filter @agentlab/persistence <script>`.
3. El resto de ADR-009 no cambia. El worker conserva su `tsx` de runtime, `apps/web` sigue sin usarlo y no hay build.
4. Regla general: cualquier workspace que declare `tsx` usa la versión exacta fijada en ARCHITECTURE §9, y `pnpm why tsx` muestra una sola versión.

## Alternativas consideradas
| Alternativa | Por qué se descarta |
|---|---|
| `tsx` en `dependencies` de `persistence` (propuesta original) | Precisión humana del 2026-10-20: `tsx` es de runtime solo en `apps/worker` |
| Punto de entrada de las migraciones en `apps/worker`, reutilizando su `tsx` | Saca las migraciones del paquete que las posee (ARCHITECTURE §2). La imagen `migrate` dependería de la app worker, y `apps/worker` es de TASK-008 (otro owner, fuera de scope) |
| `tsx` en `devDependencies` de la raíz | Pone `tsx` a disposición de todo el monorepo y no del paquete que lo usa; ADR-009 §2 lo excluye expresamente de la raíz |
| `drizzle-kit migrate` (CLI) más un script aparte para `setup()` | `drizzle-kit` es dependencia de desarrollo y exige `dbCredentials` en `drizzle.config.ts`, lo que supone leer `process.env` fuera de `core`. `setup()` seguiría necesitando un ejecutor de TS |
| Script `.mjs` sin TypeScript | Leería `process.env` fuera de `core`, no podría importar `@agentlab/core` (exporta `.ts`) y se quedaría sin comprobación de tipos |
| Type stripping nativo de Node | Ya descartado en ADR-009: los imports con especificador `.js` no se resuelven a `.ts` y el `tsconfig` no se lee |

## Consecuencias
- Positivas:
  - Las migraciones y su punto de entrada viven en `persistence`.
  - Hay un solo transpilador en todo el monorepo y en la misma versión.
  - `pnpm --filter @agentlab/persistence list --prod` no muestra `tsx`: la clasificación de runtime de ADR-009 se mantiene.
- Negativas:
  - Como `tsx` es de desarrollo, la imagen `migrate` no puede instalar `persistence` solo con `--prod`: necesita sus `devDependencies` (`tsx`, `drizzle-kit`, `@types/pg`), con `esbuild` (binario nativo) y el `esbuild` 0.25.x que trae `drizzle-kit`. Cómo se construye esa imagen queda en el plan de TASK-005 (decisión 16) y lo revisa security.
  - `drizzle-kit 0.31.11` (dev) trae otro `esbuild` (`^0.25.4` → `0.25.12`) además del de `tsx` (`0.28.x`).
- Obligaciones:
  - TASK-005: `tsx` en `deps_allowed` como `devDependency` de `persistence`.
  - ARCHITECTURE §9: la fila de `tsx` dice «`apps/worker` (`dependencies`); `packages/persistence` (dev, scripts `db:*`)».
  - ADR-009: se le añade en «Relacionado» la referencia «ampliado por ADR-010». Su decisión no se reescribe.

## Verificación
- `pnpm --filter @agentlab/persistence list --dev` muestra `tsx 4.23.15`; `list --prod` no lo muestra.
- `pnpm why tsx` muestra una sola versión.
- `docker compose up --build` ejecuta `migrate` (`pnpm db:migrate`) y sale con 0.
- Dentro del contenedor de `make test`, `pnpm db:reset` recrea `agentlab_test`.
