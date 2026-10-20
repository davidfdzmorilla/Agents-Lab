---
name: testing-conventions
description: "Convenciones de tests de AgentLab (Vitest, PostgreSQL real, FakeProvider, integración y e2e). Precargado en los subagentes que escriben o ejecutan tests."
---

# Convenciones de tests

## Dónde
- Unitarios: junto al código, `src/**/<nombre>.test.ts`. Sin red, sin DB, deterministas.
- Integración: `tests/integration/**` o `packages/<pkg>/src/**/*.integration.test.ts` cuando necesitan PostgreSQL. Corren contra `agentlab_test` (`DATABASE_URL_TEST`).
- E2E (M3+): `tests/e2e/**` con Playwright, contra `docker compose` levantado.

## Reglas
1. **PostgreSQL real** para repositorios y handlers. Nunca SQLite, nunca mocks del ORM. Antes de cada suite: `pnpm db:reset` (o el helper `resetTestDb()` de `@agentlab/persistence/testing`).
2. **`FakeProvider`** (`@agentlab/providers/testing`) para cualquier test que invoque un modelo. Los tests contra proveedores reales viven en `tests/integration/providers/` y se saltan con `it.skipIf(!process.env.OPENROUTER_API_KEY)` mostrando el aviso.
3. Cada test prueba **un comportamiento** y lo nombra: `it("marks the run partial when review iterations are exhausted")`.
4. Sin `sleep`/timers reales: `vi.useFakeTimers()` o `AbortSignal` controlado.
5. Sin secretos en fixtures. Las variables de entorno de test se cargan desde `tests/.env.test.example` (sin valores reales).
6. Un test que falla por infraestructura (DB caída) **falla**, no se salta. Levantar la DB es trabajo de `devops`, no del test.
7. Cobertura: `vitest --coverage` (v8). Objetivos por paquete en el DoD de cada tarea; `core` y `policies` ≥ 90 %.
8. Tests de transición de estados: tabla exhaustiva (todas las combinaciones de `ARCHITECTURE.md §5`), no muestras.
9. Tests de seguridad (M4+): en `tests/security/`; siempre con el vector nombrado en el título.

## Comandos
```
pnpm --filter @agentlab/<pkg> test          # unitarios del paquete
pnpm test                                   # todo el monorepo (turbo)
pnpm test:integration                       # necesita docker compose up db
pnpm --filter <pkg> exec vitest run --coverage
```
