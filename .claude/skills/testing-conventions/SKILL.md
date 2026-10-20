---
name: testing-conventions
description: "Convenciones de tests de AgentLab (Vitest, PostgreSQL real, FakeProvider, integración y e2e). Precargado en los subagentes que escriben o ejecutan tests."
---

# Convenciones de tests

## Dónde
- Unitarios: junto al código, `src/**/<nombre>.test.ts`. Sin red, sin DB, deterministas.
- Integración con PostgreSQL: `packages/<pkg>/src/**/*.integration.test.ts`. Corren en serie contra `agentlab_test` (`DATABASE_URL_TEST`). Los tests contra proveedores reales (regla 2) van aparte, en `tests/integration/providers/`.
- E2E (M3+): `tests/e2e/**` con Playwright, contra `docker compose` levantado.

## Reglas
1. **PostgreSQL real** para repositorios y handlers. Nunca SQLite, nunca mocks del ORM. `resetTestDatabase(testUrl)` de `@agentlab/persistence/testing` se ejecuta una vez por ejecución en el `globalSetup` de Vitest, y se niega si la base no termina en `_test`. Al inicio de cada test, `truncateAll(db)`.
2. **`FakeProvider`** (`@agentlab/providers/testing`) para cualquier test que invoque un modelo. Los tests contra proveedores reales viven en `tests/integration/providers/` y se saltan si no hay clave, mostrando el aviso. La presencia de la clave se obtiene vía `@agentlab/core`, nunca leyendo `process.env`: `const hasKey = Boolean(createSecretResolver()("OPENROUTER_API_KEY"))` (`createSecretResolver` solo resuelve nombres `*_API_KEY` declarados en `env.ts`; alternativa: `loadEnv().OPENROUTER_API_KEY`), y `it.skipIf(!hasKey)(...)` con un `console.warn` de aviso cuando `!hasKey`.
3. Cada test prueba **un comportamiento** y lo nombra: `it("marks the run partial when review iterations are exhausted")`.
4. Sin `sleep`/timers reales: `vi.useFakeTimers()` o `AbortSignal` controlado.
5. Sin secretos en fixtures. `DATABASE_URL_TEST` se documenta en `.env.example` (vacía, sin valores reales) y la lee `loadTestDatabaseUrl()` de `@agentlab/core`; nadie lee `process.env` fuera de `core/env.ts`.
6. Un test que falla por infraestructura (DB caída) **falla**, no se salta. Levantar la DB es trabajo de `devops`, no del test.
7. Cobertura: `vitest --coverage` (v8). Objetivos por paquete en el DoD de cada tarea; `core` y `policies` ≥ 90 %.
8. Tests de transición de estados: tabla exhaustiva (todas las combinaciones de `ARCHITECTURE.md §5`), no muestras.
9. Tests de seguridad (M4+): en `tests/security/`; siempre con el vector nombrado en el título.
10. **Lo que corre en el host (Makefile, hooks, scripts) se prueba en macOS y en Linux.** Motivo: en TASK-003 `.SHELLFLAGS` funcionaba en GNU Make ≥ 3.82 (Linux) pero se ignoraba en GNU Make 3.81 (macOS), y bsdtar y GNU tar difieren.
11. **Tests de integración contra PostgreSQL en serie.** Se nombran `*.integration.test.ts` y corren en serie: un solo runner y `fileParallelism: false` para esos ficheros. Motivo: comparten la base `agentlab_test` y sus resets chocarían entre paquetes (decisión humana en el plan de TASK-005, riesgo R6).

## Comandos
```
pnpm --filter @agentlab/<pkg> test          # unitarios del paquete
pnpm test                                   # todo el monorepo (turbo)
make test                                   # integración en contenedor (dos fases); deja db en marcha, `make down` la para
pnpm --filter <pkg> exec vitest run --coverage
```
