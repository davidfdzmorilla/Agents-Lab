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
4. Sin `sleep`/timers reales: `vi.useFakeTimers()` o `AbortSignal` controlado. Excepción acotada: `pg_sleep` se permite solo dentro de una transacción, en tests que verifican el reloj de la base, y con la pausa mínima que haga visible la diferencia (decenas de ms, no segundos). Fuera de eso sigue la regla. Motivo: TASK-006-fix-3 (`vi.useFakeTimers()` no mueve el reloj de PostgreSQL).
5. Sin secretos en fixtures. `DATABASE_URL_TEST` se documenta en `.env.example` (vacía, sin valores reales) y la lee `loadTestDatabaseUrl()` de `@agentlab/core`; nadie lee `process.env` fuera de `core/env.ts`.
6. Un test que falla por infraestructura (DB caída) **falla**, no se salta. Levantar la DB es trabajo de `devops`, no del test.
7. Cobertura: `vitest --coverage` (v8). Objetivos por paquete en el DoD de cada tarea; `core` y `policies` ≥ 90 %.
8. Tests de transición de estados: tabla exhaustiva (todas las combinaciones de `ARCHITECTURE.md §5`), no muestras.
9. Tests de seguridad (M4+): en `tests/security/`; siempre con el vector nombrado en el título.
10. **Lo que corre en el host (Makefile, hooks, scripts) se prueba en macOS y en Linux.** macOS: el owner y el tester, en local. Linux: el CI (`.github/workflows/ci.yml`: `validate-linux` ejecuta `make validate` y `make down`; `lint` y `typecheck`, `make lint` y `make typecheck`; `secrets-scan`, `scripts/ci/check-no-secrets.sh`), sobre el commit que empuja el humano. La evidencia es el enlace a esa ejecución en verde (OD-053). Ningún agente monta el socket de Docker en un contenedor para obtener la evidencia Linux: la excepción de TASK-007 y TASK-008 se retiró en el cierre de TASK-006. Motivo: en TASK-003 `.SHELLFLAGS` funcionaba en GNU Make ≥ 3.82 (Linux) pero se ignoraba en GNU Make 3.81 (macOS), y bsdtar y GNU tar difieren.
11. **Tests de integración contra PostgreSQL en serie.** Se nombran `*.integration.test.ts` y corren en serie: un solo runner y `fileParallelism: false` para esos ficheros. Motivo: comparten la base `agentlab_test` y sus resets chocarían entre paquetes (decisión humana en el plan de TASK-005, riesgo R6). Mecanismo entre paquetes: `pnpm test` en la raíz ejecuta `turbo run test --concurrency=1` (OD-034, TASK-008); cada paquete con integración mantiene `fileParallelism: false`.
12. **Credenciales**: los tests leen credenciales de `.env` del operador; ningún encargo ni informe contiene credenciales. `make test`/`make validate` cargan ese `.env` (TASK-006-fix-2).
13. **Un test que cubre un fix tiene que fallar sin el fix**: el informe IMPLEMENTATION dice cómo, y el tester lo comprueba antes de dar PASS. Motivo: en TASK-006-fix-3 el test pasaba también sin el fix.

## Comandos
```
pnpm --filter @agentlab/<pkg> test          # unitarios del paquete
pnpm test                                   # todo el monorepo (turbo)
make test                                   # integración en contenedor (dos fases); deja db en marcha, `make down` la para
pnpm --filter <pkg> exec vitest run --coverage
```
