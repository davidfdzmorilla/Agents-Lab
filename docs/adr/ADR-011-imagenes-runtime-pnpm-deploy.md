# ADR-011 — Imágenes `worker` y `migrate` construidas con `pnpm deploy`

| Campo | Valor |
|---|---|
| Estado | Accepted (2026-10-21, decisión humana, con las dos condiciones de la sección «Condiciones de aceptación») |
| Fecha | 2026-10-20 (propuesta) · 2026-10-21 (aceptación) |
| Decisores | Responsable humano · architect |
| Relacionado | ARCHITECTURE §1 (`migrate`, `test`), §8; ADR-009, ADR-010; SPEC §13 OD-026; TECHNICAL_DEBT TD-015, TD-020, TD-022; TASK-008 (`docs/reports/TASK-008-plan.md`, OD-031); TASK-040 |

## Contexto
`docker/worker.Dockerfile` (TASK-003 y TASK-005) copia el monorepo entero (`COPY . .`) en las imágenes finales `runtime` y `migrate`, que parten de un stage con corepack y pnpm.

- TD-015: la imagen `worker` lleva pnpm, corepack y el monorepo completo. `.dockerignore` es una lista de exclusión, así que un `*.pem`/`*.key` nuevo acabaría dentro.
- TD-020: la imagen `migrate` contiene las devDependencies de la raíz (`eslint`, `vitest`, `turbo`…). Con `--frozen-lockfile`, pnpm 9 instala siempre el importer raíz.
- TD-022: `fetch`/`install` del stage `prod` no llevan `--ignore-scripts`.

El DoD de TASK-008 pide imágenes solo con los `node_modules` de producción del worker más `tsx`, sin pnpm ni corepack, y sin devDependencies de la raíz en `worker` ni en `migrate`. También pide probar `pnpm deploy` antes de comprometerse.

Pruebas del 2026-10-20 en el scratchpad, fuera del repo, con pnpm 9.15.9 y `node:22.23.3-bookworm-slim` fijado por digest. Detalle en el plan de TASK-008:

1. `pnpm --filter worker deploy --prod --ignore-scripts /out` funciona. `/out/node_modules/.bin` solo contiene `tsx`. `@agentlab/core` y `@agentlab/persistence` se inyectan como copias (`file:`), y `tsx` ejecuta sus `.ts` desde `node_modules`.
2. `deploy --offline` **falla** (`ERR_PNPM_NO_OFFLINE_META` para `zod@4.6.7`). En pnpm 9, `deploy` ejecuta un `install` sin `frozenLockfile` (fuente: `releasing/plugin-commands-deploy/src/deploy.ts`, tag `v9.15.9`) y vuelve a resolver los paquetes inyectados. Necesita los metadatos del registro, así que necesita red. Las versiones resultantes (38 entradas en `worker`, 51 en `migrate`) coinciden todas con `pnpm-lock.yaml`, salvo las dos entradas `file:` de los paquetes del workspace.
3. `pnpm --filter @agentlab/persistence deploy --ignore-scripts /out`, sin `--prod`, **vuelve a meter las devDependencies de la raíz**: `.bin` acaba con `eslint`, `prettier`, `turbo`, `vitest`, `tsc`… Si antes se borra `devDependencies` del `package.json` raíz dentro del stage de build, el resultado solo tiene las devDependencies de `persistence`: `.bin` contiene `drizzle-kit` y `tsx`. `migrate` aplica las migraciones contra PostgreSQL 16.15 con `cap_drop: ALL` y sale con 0.
4. Con un `.dockerignore` en modo lista de inclusión, los canarios `*.pem`, `*.key`, `.env.local`, `x.env` y `.envrc`, plantados en la raíz, en `apps/worker`, en `packages/core/src` y en `packages/persistence`, no aparecen en ninguna de las dos imágenes. Tampoco hay `pnpm`, `corepack`, `npm`, `npx` ni `yarn`.

## Decisión
1. Un stage `deps` ejecuta `pnpm fetch --ignore-scripts` (lockfile, workspace y `.npmrc`; el store completo). Dos stages de build parten de él:
   - `worker-deploy`: `pnpm --filter worker deploy --prod --ignore-scripts /out`.
   - `migrate-deploy`: `npm pkg delete devDependencies` sobre el `package.json` raíz **de la copia del stage** y después `pnpm --filter @agentlab/persistence deploy --ignore-scripts /out`. Este stage incluye las devDependencies de `persistence` (OD-026, ADR-010) y ninguna de la raíz.
   - Ningún `deploy` usa `--offline`: necesitan el registro para los metadatos. Con `--ignore-scripts` no se ejecuta código de ningún paquete.
2. Las imágenes finales parten de un stage `slim`, que es la imagen de Node fijada por digest sin corepack, npm, npx ni yarn (`rm -rf` de sus rutas), con `NODE_ENV=production` y `PATH=/app/node_modules/.bin:$PATH`:
   - `runtime`: `COPY --from=worker-deploy /out /app`, `USER node`. El comando es el de ADR-009 en la forma que se decida en TASK-008 (`tsx src/index.ts` o, con el fallback de ADR-009 §7, `node --import tsx src/index.ts`).
     *Anotación (2026-10-21, OD-032 a):* se decidió el fallback de ADR-009 §7; el comando es `CMD ["node", "--import", "tsx", "src/index.ts"]`.
   - `migrate`: `COPY --from=migrate-deploy /out /app`, `USER node`, `CMD ["tsx", "src/cli/migrate.ts"]`. Es el mismo punto de entrada que ejecuta `pnpm db:migrate` (ADR-010 §2), pero sin pnpm en la imagen.
3. Ningún stage parte de `migrate-deploy` ni de `migrate`, y `runtime` no copia nada de ellos. `deps` es un ancestro común que solo contiene el store y nunca se copia a una imagen final. Así se mantiene la condición de OD-026: la imagen de `migrate` no se reutiliza para `worker` ni para `web`.
4. `.dockerignore` pasa a ser una **lista de inclusión** (`*` y después `!package.json`, `!pnpm-lock.yaml`, `!pnpm-workspace.yaml`, `!.npmrc`, `!apps/`, `!packages/`). Además excluye en cualquier nivel los mismos patrones que `HOST_TAR` (Makefile) más `**/*.pem` y `**/*.key`.
5. El servicio `test` usa un stage propio, `test` (`base` con `/work` del usuario `node` y `USER node`). Nunca parte de `deps`, `*-deploy`, `slim` ni de las imágenes finales.

## Condiciones de aceptación (decisión humana, 2026-10-21)
Decisión humana (literal): *"OD-031 / ADR-011: (a) pnpm deploy. ADR-011 Accepted con dos condiciones escritas en el ADR: (1) el stage de deploy verifica que el lockfile no cambia (`git diff --exit-code pnpm-lock.yaml` o `pnpm install --frozen-lockfile` previo en el mismo stage) para cubrir el riesgo del modo no estricto; (2) la limpieza del package.json raíz en migrate queda documentada como deuda LOW a revisar cuando pnpm lo soporte de forma nativa."*

1. **Lockfile congelado en cada stage de deploy.** Mecanismo fijado: el primer `RUN` de `worker-deploy` y de `migrate-deploy`, después de copiar el contexto y **antes** de cualquier cambio de manifiestos, es

   ```
   pnpm install --frozen-lockfile --lockfile-only --ignore-scripts --offline
   ```

   Si algún `package.json` del workspace no coincide con `pnpm-lock.yaml`, pnpm falla con `ERR_PNPM_OUTDATED_LOCKFILE` y el build se para. En `migrate-deploy` va antes de `npm pkg delete devDependencies`: después de quitarlas, el manifiesto raíz ya no coincide con el lockfile y la comprobación fallaría siempre.

   Por qué este mecanismo y no los otros dos:
   - `git diff --exit-code pnpm-lock.yaml`: el contexto de build no tiene `.git` (la lista de inclusión de `.dockerignore` no lo incluye) y la imagen no tiene `git`.
   - Hash del lockfile antes y después del `deploy`: en pnpm 9.15.9, `deploy` llama a `install` con `saveLockfile: false` y `useLockfile: true` (`releasing/plugin-commands-deploy/src/deploy.ts`, tag `v9.15.9`, consultado el 2026-10-21). Nunca reescribe el lockfile, así que el hash no cambia aunque haya deriva.
   - El riesgo real del modo no estricto (`frozenLockfile: false`) es un manifiesto que ya no coincide con el lockfile: en ese caso `deploy` resuelve versiones nuevas contra el registro sin avisar. Es exactamente lo que detecta `--frozen-lockfile`.

   Pruebas del 2026-10-21 en el scratchpad (copia filtrada del repo sin `.env`, pnpm 9.15.9, `node:22.23.3-bookworm-slim` fijado por digest; nada instalado en el repo):

   | Caso | Resultado |
   |---|---|
   | Lockfile del repo sin tocar, con red | exit 0 |
   | Ídem, `--offline` tras `pnpm fetch --ignore-scripts` | exit 0 en ≈0,25 s: no necesita red |
   | Lockfile alterado (importer `apps/worker`: `tsx` `4.23.15` → `4.23.14`) | exit 1, `ERR_PNPM_OUTDATED_LOCKFILE … specifiers in the lockfile ({"tsx":"4.23.14"}) don't match specs in package.json ({"tsx":"4.23.15"})` |
   | Manifiesto alterado sin tocar el lockfile (`packages/core`: `zod` `4.6.7` → `^4.6.0`) | exit 1, `ERR_PNPM_OUTDATED_LOCKFILE` |
   | La misma deriva, sin la comprobación: `deploy` y hash del lockfile antes/después | `deploy` exit 0; hash idéntico antes y después (el hash no detecta nada) |
   | Comprobación después de `npm pkg delete devDependencies` | exit 1 (por eso va antes) |

   La comprobación no enlaza paquetes (`--lockfile-only`) ni ejecuta scripts. No sustituye a la evidencia de Verificación que compara `/app/node_modules/.pnpm` con el lockfile: esa cubre la re-resolución de los paquetes inyectados.
2. **Limpieza del `package.json` raíz en `migrate`.** `npm pkg delete devDependencies` dentro de `migrate-deploy` es un rodeo de una limitación de pnpm 9 (prueba 3 del Contexto). Queda registrada como deuda **LOW**, que se paga en TASK-040: al subir pnpm, comprobar si `deploy` deja de instalar las devDependencies de la raíz (o tiene una opción nativa para excluirlas) y, si es así, quitar la limpieza. El registro en TECHNICAL_DEBT lo hace el Orchestrator.

## Alternativas consideradas
| Alternativa | Por qué se descarta |
|---|---|
| `install --frozen-lockfile --prod --filter worker...` y `COPY` selectivo de `node_modules`, `apps/worker` y cada `packages/<x>` | Funciona sin red y con el lockfile congelado. Pero obliga a listar en el Dockerfile el cierre de paquetes del worker, que crece en M1 (`policies`, `providers`, `orchestrator`, `agents`), y deja sin resolver TD-020 en `migrate`. Queda como plan B si se rechaza la red en el build |
| `deploy` de `persistence` sin quitar las devDependencies de la raíz | No paga TD-020: mete `eslint`, `vitest`, `turbo` y `prettier` en `migrate` (prueba 3) |
| `deploy --prod` de `persistence` y `tsx` tomado de la imagen del worker | ADR-010 ya lo descartó: `migrate` dependería de la app worker |
| `tsx` en `dependencies` de `persistence` | Contradice la precisión humana de ADR-010 |
| Imagen final distroless o Debian con solo el binario de Node | Quitaría también los bytes de corepack/npm de la capa base. Pero añade otra imagen base que fijar y vigilar. Con `rm` los binarios ya no se pueden ejecutar; los bytes siguen en la capa inferior (riesgo anotado) |
| Bundle del worker | Descartado en ADR-009 |

## Consecuencias
- Positivas:
  - Paga TD-015, TD-020 y la parte de TD-022 sobre `--ignore-scripts` y `.dockerignore`.
  - Las imágenes finales solo contienen el paquete desplegado y su cierre de dependencias.
  - El cierre de paquetes del worker lo calcula pnpm, no el Dockerfile.
  - Ni pnpm ni corepack se pueden ejecutar en `worker` ni en `migrate`.
- Negativas:
  - El paso `deploy` necesita red **con el contexto del repo ya copiado**. Solo se ejecuta código de pnpm (`--ignore-scripts`; el repo no tiene `.pnpmfile.cjs`). Lo revisa security.
  - En pnpm 9, `deploy` no es `frozen`. Las versiones coinciden hoy con el lockfile porque pnpm reutiliza las entradas que ya existen y las dependencias directas de los paquetes inyectados están fijadas sin `^`. Si se añade un rango en un paquete del workspace, el resultado podría variar. TASK-040 (subida de pnpm) revisa el `deploy` de pnpm 10 o superior, que usa el lockfile compartido. Mitigación (condición 1): la comprobación `--frozen-lockfile` previa para el build si un manifiesto no coincide con el lockfile.
  - `npm pkg delete devDependencies` reescribe el `package.json` raíz dentro de un stage de build. El fichero del repo no se toca.
  - Los paquetes inyectados se copian enteros (incluidos `*.test.ts` y `src/testing/**`), porque no declaran `files`.
  - `migrate` deja de ejecutar `pnpm db:migrate` y ejecuta directamente `tsx src/cli/migrate.ts`. Hay que actualizar ARCHITECTURE §1. La línea de Verificación de ADR-010 («ejecuta `migrate` (`pnpm db:migrate`)») la anota docs-keeper sin cambiar su decisión.
  - El servicio `test` deja de usar el stage `base` (ARCHITECTURE §1).

## Verificación
- `docker run --rm --entrypoint ls <imagen worker> /app/node_modules/.bin` → solo `tsx`. Para `migrate` → `drizzle-kit` y `tsx`.
  - Nota (2026-10-21, TASK-008): desde OD-030 la imagen `runtime` contiene en `/app/node_modules/.bin` `pino` y `tsx`, los bins de sus dependencias directas; `migrate` contiene `drizzle-kit` y `tsx`. La decisión no cambia.
- `command -v pnpm corepack npm npx yarn` no encuentra nada en ninguna de las dos imágenes.
- Prueba de canarios `*.pem`, `*.key` y `.env*` en varios niveles del contexto: ningún canario en ninguna de las dos imágenes.
- La lista de `/app/node_modules/.pnpm` coincide con `pnpm-lock.yaml`, salvo las entradas `file:` del workspace.
- Condición 1: el build falla con `ERR_PNPM_OUTDATED_LOCKFILE` si se altera el especificador de una dependencia en `pnpm-lock.yaml` o en un `package.json` sin regenerar el lockfile (prueba manual en una copia, con la salida en el informe de TASK-008).
  - Nota (2026-10-21): verificada por el tester en TASK-008: el build de `runtime` y el de `migrate` fallan con `ERR_PNPM_OUTDATED_LOCKFILE`.
- `docker compose up --build`: `migrate` sale con 0 y `worker` arranca. `docker compose stop worker` termina con 0 (TASK-008).
