# AgentLab — Deuda técnica

| Campo | Valor |
|---|---|
| Última actualización | 2026-10-21 (cierre TASK-005: TD-019…TD-024 registradas; TD-011, TD-017 y TD-019 actualizadas; TD-008 PAID por TASK-003) |

Deuda = decisión consciente de hacer algo peor de lo que ARCHITECTURE exige, con fecha de pago. Si no tiene fecha de pago (hito), no es deuda: es un bug o una OPEN DECISION.

- **Severidad**: `LOW` (cosmético/estructural) · `MEDIUM` (afecta mantenibilidad) · `HIGH` (afecta corrección o seguridad en algún escenario) · `CRITICAL` (bloquea un criterio de salida).
- `HIGH` y `CRITICAL` solo las acepta el humano. El `reviewer` puede proponerlas; no aceptarlas.
- Solo el Orchestrator (sesión), `reviewer` (proponer) y `docs-keeper` editan este fichero.

| ID | Descripción | Severidad | Introducida en | Se paga en | Estado |
|---|---|---|---|---|---|
| TD-001 | La UI de `/runs/:id` hace polling cada 2 s en lugar de SSE. | LOW | TASK-016 (M1) | TASK-024 (M3) | OPEN (prevista) |
| TD-002 | Checkpointer `MemorySaver` en M1: un reinicio del worker pierde el estado del grafo (el run queda `failed` por heartbeat, no se reanuda). | MEDIUM | TASK-013 (M1) | TASK-023 (M3) | OPEN (prevista) |
| TD-003 | Los límites de OD-002 (tokens, contexto, herramientas, longitud, profundidad) se aplican con los valores *propuestos* hasta que el humano los fije. | LOW | TASK-011 (M1) | OD-002 resuelta | OPEN (prevista) |
| TD-004 | Un solo worker con `WORKER_CONCURRENCY=1`; sin cola distribuida. Decisión de diseño (ADR-004), se revisa si aparece necesidad real. | LOW | ADR-004 | Revisión en M5 | OPEN (por diseño) |
| TD-005 | Monousuario sin autenticación en la API hasta OD-003. | MEDIUM | SPEC §8 | TASK-039 (M5) | OPEN (prevista) |
| TD-006 | TypeScript fijado en 5.9.3 (typescript-eslint 8.72.0 exige `<6.1.0`) y pnpm 9.15.9 sin mantenimiento. | LOW | TASK-001 (M0) | TASK-040 (ADR de herramientas tras M0) | OPEN |
| TD-007 | `pnpm -r lint` no cubre los ficheros de configuración de la raíz (`eslint.config.js`, etc.). | LOW | TASK-001 (M0) | TASK-006 (lint de raíz en CI) | OPEN |
| TD-008 | Sin target `make validate` para la validación en Docker `node:22` con store fuera del repo. | LOW | TASK-001 (M0) | TASK-003 (M0) | PAID (TASK-003) |
| TD-009 | `apps/web/src/index.ts` es un placeholder ajeno a App Router. | LOW | TASK-001 (M0) | TASK-007 (M0) | OPEN |
| TD-010 | `rootDir: src` en los tsconfig de workspace impide tipar ficheros de config/tests fuera de `src` (vitest.config.ts, next.config.ts). **rootDir se mantiene; decidir include/tsconfig aparte** (no quitar rootDir: cumple la Verificación de ADR-001). | LOW | TASK-001 (M0) | TASK-004 y TASK-007 (M0) | OPEN (parcial: vitest.config.ts resuelto en TASK-004 con `tsconfig.config.json`; next.config.ts pendiente en TASK-007) |
| TD-011 | `loadEnv()` devuelve `Env` con `DATABASE_URL` (con contraseña) y `*_API_KEY` como propiedades enumerables: `util.inspect`/`JSON.stringify` las muestran. Mientras no se pague: el objeto de `loadEnv()` no se pasa entero a ningún logger ni se serializa; se leen campos sueltos (regla para monorepo-conventions). Además: `DrizzleQueryError` (drizzle-orm 0.45.4) mete los parámetros de la consulta en `message`; ningún logger debe registrar ese `message` tal cual (security, TASK-005). | LOW | TASK-004 (M0) | TASK-027 (M3: `redactSecrets`, rutas `*_API_KEY`, `DATABASE_URL*`, contraseña en URLs) | OPEN |
| TD-012 | `httpUrl()` (OLLAMA_BASE_URL, OTEL_EXPORTER_OTLP_ENDPOINT) admite credenciales embebidas y cualquier host; `postgresUrl()` es laxa. Sin SSRF real hoy (los fija el operador). | LOW | TASK-004 (M0) | TASK-020 (M2: rechazar user/password y allowlist de host, SPEC §9; las URLs pueden venir de BD/UI) | OPEN |
| TD-013 | La aplicación se conecta a PostgreSQL como superusuario. | LOW | TASK-003 (M0) | TASK-037 (M5: usuario de aplicación sin DDL; migraciones con otro rol) | OPEN |
| TD-014 | El contenedor `ollama` corre como root. | LOW | TASK-003 (M0) | TASK-021 (M2) | OPEN |
| TD-015 | La imagen de runtime del worker lleva pnpm, corepack y el monorepo completo; `.dockerignore` es una lista de exclusión, así que un futuro `*.pem`/`*.key` acabaría en la imagen. | LOW | TASK-003 (M0) | TASK-008 (M0: runtime solo con `node_modules` de producción del worker + `tsx`) | OPEN |
| TD-016 | Con `compose.override.yaml` activo, `db` queda en la red con salida a internet (para publicar 127.0.0.1:5432). Mitigación hasta el pago: aviso en `compose.override.example.yaml`. | LOW | TASK-003 (M0) | TASK-037 (M5), salvo que `security` lo suba | OPEN |
| TD-017 | pnpm 9.15.9 fijado por versión sin hash (`packageManager`, `docker/worker.Dockerfile`, `Makefile`); el volumen `agentlab-validate-node-modules` persiste entre ejecuciones y un script de dependencia podría alterar validaciones posteriores (integridad, no confidencialidad). Precisión (security, TASK-005): no hay canal de confidencialidad entre fases (la fase 1 solo ejecuta corepack y `pnpm fetch --ignore-scripts`); el riesgo es de integridad entre ejecuciones de la fase 2. | LOW | TASK-003 (M0) | TASK-040 | OPEN |
| TD-018 | El worker tiene salida a internet sin restricciones (RFC1918, metadatos cloud). Sin SSRF hoy: no hay herramientas HTTP. | LOW | TASK-003 (M0) | TASK-020 (M2, con la allowlist de host de TD-012) | OPEN |
| TD-019 | `drizzle-kit` 0.31.11 trae subdependencias obsoletas (`@esbuild-kit/core-utils` 3.3.2, `@esbuild-kit/esm-loader` 2.6.5); solo desarrollo. Además: GHSA-67mh-4wv8-2f99 (moderate) en `esbuild@0.18.20`, transitiva de `drizzle-kit`, también en la imagen `migrate`; solo afecta a `esbuild serve`, que no se usa. | LOW | TASK-005 (M0) | TASK-040 (al subir `drizzle-kit`) | OPEN |
| TD-020 | La imagen `migrate` contiene las devDependencies de la raíz (`eslint`, `vitest`, `prettier`, `turbo`, `vite`…): pnpm 9 con `--frozen-lockfile` siempre instala el importer raíz aunque el filtro lo excluya. Imagen one-shot, sin puertos, sin red externa, no reutilizada. | LOW | TASK-005 (M0) | TASK-008 (con TD-015, mismo mecanismo; previsiblemente `pnpm deploy`) | OPEN |
| TD-021 | El servicio `test` se conecta a PostgreSQL como superusuario y comparte la red `backend` (alcanza la base `agentlab` y, con el perfil `local`, `ollama`, que tiene salida a internet; con el override de TD-016, `db` también). | MEDIUM | TASK-005 (M0) | TASK-008 (red `internal: true` solo `db`+`test`) y TASK-037 (rol no superusuario, con TD-013) | OPEN |
| TD-022 | `migrate` y `worker` sin `cap_drop`/`no-new-privileges`; `test` corre como uid 0 (CapEff 0); `docker/worker.Dockerfile:12` y `:16` sin `--ignore-scripts`; `.dockerignore` excluye menos que `HOST_TAR` (`.envrc`, `*.env`, `.env-*`, `.env_*`) y ese contexto entra en la imagen `migrate`. | LOW | TASK-005 (M0) | TASK-008 | OPEN |
| TD-023 | Los CLI `db:migrate`/`db:reset` no tienen test automático (probados a mano), incluido que el error no lleve la URL. | LOW | TASK-005 (M0) | TASK-009 | OPEN |
| TD-024 | `packages/core/src/env.test.ts` (`loadEnv > reads process.env by default`) depende del `process.env` real, por donde llega `DATABASE_URL_TEST` vía turbo. | LOW | TASK-005 (M0) | TASK-027 | OPEN |

## Reglas

1. Cada entrada nueva necesita una tarea en `TASKS.md` que la pague (o un hito concreto), no una promesa.
2. Al pagarla se marca `PAID (TASK-NNN)`; nunca se borra la fila.
3. Deuda detectada por el `reviewer` sin tarea de pago → el Orchestrator la crea antes de dar la tarea por `DONE`.
