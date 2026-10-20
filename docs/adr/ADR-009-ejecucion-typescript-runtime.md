# ADR-009 — Ejecución de TypeScript en runtime con `tsx`

| Campo | Valor |
|---|---|
| Estado | Accepted (2026-10-20, aprobado por el responsable humano) |
| Fecha | 2026-10-20 |
| Decisores | Responsable humano · architect |
| Relacionado | SPEC §13 OD-007; ARCHITECTURE §8, §9; ADR-001; TASK-003, TASK-008, TASK-023 |

## Contexto
TASK-001 dejó `tsconfig.base.json` con `module: ESNext`, `moduleResolution: bundler` y `verbatimModuleSyntax` (imports relativos sin extensión), `rootDir: src` por workspace, y todos los paquetes exportan `./src/index.ts` sin paso de build (ADR-001). `apps/web` no tiene el problema: Next transpila los paquetes del workspace. Vitest y drizzle-kit cargan TypeScript por sí mismos. Lo que falta es cómo arranca `apps/worker` en tres sitios: desarrollo, el contenedor de TASK-003 y el proceso hijo del test de TASK-008.

Decisión humana (2026-10-20, literal): *"OD-007: decidido, tsx. Desarrollo con `tsx watch`; la imagen Docker del worker ejecuta `tsx src/index.ts` (tsx como dependencia de runtime de apps/worker, no de la raíz); apps/web lo gestiona Next. Se descarta el type stripping de Node porque no cubre la sintaxis que usamos ni `moduleResolution: bundler`, y se descarta el bundle porque añade un paso de build sin beneficio en v1."*

## Decisión
1. `tsx` **`4.23.15`**, versión exacta sin `^`. Es `dist-tags.latest`, publicada el 2026-09-20; `engines.node >=18.0.0`, compatible con Node 22 LTS y con `engine-strict=true`; trae `esbuild ~0.28.0`. Verificado con `npm view tsx dist-tags engines dependencies time` el 2026-10-20. Coincide con la versión citada en la propuesta de OD-007.
2. Va en `dependencies` (runtime) de `apps/worker`. No va en la raíz ni en otros workspaces.
3. Desarrollo: script `dev` = `tsx watch src/index.ts`.
4. Runtime y contenedor: script `start` = `tsx src/index.ts`. `docker/worker.Dockerfile` ejecuta ese comando con `tsx` instalado en la etapa final de la imagen.
5. `apps/web` no usa `tsx`. Next resuelve los paquetes `.ts` del workspace (`transpilePackages` / Turbopack, TASK-007).
6. El worker no tiene build en v1: no hay `dist/` ni tarea `build` de turbo para `apps/worker`. La comprobación de tipos sigue siendo `tsc --noEmit` (`typecheck`), porque `tsx` no comprueba tipos.
7. Fallback autorizado (decisión humana, 2026-10-20): si en TASK-008 el apagado limpio por `SIGTERM` falla bajo el CLI de `tsx`, el worker pasa a arrancar con `node --import tsx src/index.ts` **sin nuevo ADR**. engine-dev lo documenta en su informe y docs-keeper anota el cambio en este ADR.

## Alternativas consideradas
| Alternativa | Por qué se descarta |
|---|---|
| Type stripping nativo de Node (≥22.18, sin dependencias) | No cubre la sintaxis que usamos ni `moduleResolution: bundler`: exige extensión `.ts` en todos los imports relativos, `erasableSyntaxOnly` y no lee `tsconfig`. Para revisarlo haría falta que fuera estable en el Node LTS fijado y una tarea que migre los imports y el `tsconfig` de TASK-001. |
| Bundle del worker a JS (`esbuild 0.28.2` / `tsup 9.0.0`) | Añade un paso de build y sourcemaps sin beneficio en v1, y desarrollo y producción ejecutarían artefactos distintos. Para revisarlo haría falta una necesidad medida de tamaño de imagen, tiempo de arranque o superficie de la imagen de runtime. |

## Consecuencias
- Positivas: no cambia nada de TASK-001 (`tsconfig`, imports sin extensión, exports a `./src/index.ts`). Dev, test y contenedor usan el mismo transpilador.
- Negativas: la imagen de runtime lleva `tsx` y `esbuild`, que incluye un binario nativo por plataforma. Eso aumenta el tamaño y la superficie de dependencias que revisa security. El arranque es algo más lento porque se transpila al cargar. Subir de versión es una tarea propia.
- Proceso padre: el CLI `tsx` lanza el script en un proceso hijo. Reenvía `SIGINT`/`SIGTERM` y sale con el código del hijo. Si el hijo no confirma la señal por IPC en unos ~30 ms, el padre le manda `SIGKILL` (fuente: `src/cli.ts` y `src/preflight.cts` de tsx, rama master, consultados el 2026-10-20). El hijo confirma la señal en cuanto la recibe, aunque haya un handler de usuario. Por eso el apagado limpio de ARCHITECTURE §8 debería funcionar, pero hay que verificarlo. En Docker el worker corre con `init: true`: tini es PID 1 y `tsx` es el proceso de la aplicación bajo tini (TASK-003).
- Para TASK-003 (decisión humana, 2026-10-20): su scope incluye `apps/worker/package.json` y `pnpm-lock.yaml`, y declara `tsx` `4.23.15` en `dependencies` de `apps/worker`. `worker.Dockerfile` ejecuta `tsx src/index.ts` y la etapa final tiene `tsx` instalado como dependencia de producción de `apps/worker`. `stop_grace_period` debe ser mayor que `SHUTDOWN_GRACE_MS`.
- Para TASK-008: no declara `tsx` (ya lo hizo TASK-003); usa `tsx` en los scripts `dev` (`tsx watch src/index.ts`) y `start` (`tsx src/index.ts`) de `apps/worker/package.json`, y el test del proceso hijo arranca el worker con `tsx`.
- Para TASK-023: guardar checkpoint antes de salir se verifica allí, donde existe el checkpointer persistente.
- Sin efecto: el `rootDir: src` (TD-010) y la tarea `build` de turbo. Con `engine-strict`, `tsx` no impone ningún rango que choque con Node 22.

## Verificación
- TASK-003: `tsx` `4.23.15` declarado en `dependencies` de `apps/worker` (y en `pnpm-lock.yaml`); `docker compose up --build` arranca el worker con `tsx src/index.ts`. Prueba de `SIGTERM`: `docker compose stop worker` hace que el contenedor termine en menos de `SHUTDOWN_GRACE_MS` con código 0.
- TASK-008: scripts `dev`/`start` con `tsx`; el test de integración lanza el worker en un proceso hijo con `tsx` y comprueba que el run pasa a `completed` y que el heartbeat se actualiza. Prueba de `SIGTERM`, enviado al proceso `tsx` y no al hijo: el worker deja de reclamar, espera al run en curso hasta `SHUTDOWN_GRACE_MS`, lo deja en estado coherente y sale con código 0. Si falla, se aplica el fallback del punto 7 de Decisión.
- TASK-023: con `SIGTERM`, el run en curso guarda checkpoint antes de salir.
