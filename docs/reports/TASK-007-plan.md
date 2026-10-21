# PLAN — TASK-007 · apps/web: esqueleto Next.js + `GET /api/health`

| Campo | Valor |
|---|---|
| Autor | architect |
| Fecha | 2026-10-21 |
| Owners de la implementación | persistence-dev (paso 1) · devops (pasos 2 y 4) · web-dev (paso 3) · architect y docs-keeper (paso 5) |
| Estado | **Aprobado (2026-10-21)**: OD-039…OD-046 resueltas y [ADR-012](../adr/ADR-012-build-e-imagen-de-web.md) **Accepted** (sección «Decisiones humanas»). Veredicto de security sobre OD-042 registrado (2026-10-21): `next 16.4.2` con excepción, `react`/`react-dom 19.3.0` sin excepción; OD-047 cerrada sin efecto |
| security | REQUIRED (imagen y compose de `web`, endpoint HTTP, versiones con avisos críticos recientes, `.dockerignore`) |

## Contexto

`apps/web` es hoy un placeholder (`src/index.ts` = `export {}`, sin dependencias; TD-009). `compose.yaml` declara `web` tras el perfil `web` y sin Dockerfile (OD-G). `persistence` no tiene función de salud y su `index.ts` reexporta `runMigrations`.

TASK-007 es la primera vez que un bundler (Next) consume los paquetes del workspace, que exportan `.ts` sin build y escriben sus imports relativos con sufijo `.js`. Las pruebas de abajo muestran que eso decide el bundler (OD-039) y obliga a tocar el índice de `persistence` (OD-040). El resto cabe en el código existente.

## Decisiones humanas (2026-10-21, literales)

> «OD-039: (a) webpack con extensionAlias. Turbopack cuando resuelva los imports .js→.ts del workspace; deuda LOW a revisar en TASK-040. Los builds más lentos no importan en M0.
> OD-040: (a). runMigrations sale del índice; se importa desde @agentlab/persistence/migrate (sub-export explícito, como /testing). Ampliar el test de exports.
> OD-041: (a) src/app. El architect corrige SPEC §8 y los scopes de TASK-014, 016, 020, 024, 028, 032, 034 de apps/web/app/** a apps/web/src/app/** en el mismo turno; si no, los hooks bloquearán a web-dev en M1.
> OD-042: (a), con condición. La excepción a las dos semanas se concede solo si security verifica, con cita del aviso (GHSA o CVE, URL y fecha), que 16.4.2 y 19.3.1 son los parches y que la versión anterior estable es vulnerable. Si no lo puede verificar, se usan las últimas versiones con más de dos semanas y la actualización va como tarea fix al confirmarse el aviso. R2 entra en la misma verificación de security.
> OD-043: (a). OD-044: (a). OD-045: (a). OD-046: (a).
> ADR-012: Accepted, con una línea: web es el único servicio que no termina con 0 bajo SIGTERM (143 por diseño de Next); el DoD de TASK-007 lo documenta y no se trata como fallo.
> Dependencias aprobadas con esas versiones exactas, sujetas a OD-042. sharp en la imagen: deuda LOW, TASK-040 (next lo instala como opcional; excluir con pnpm deploy o config de images.unoptimized hasta que se use).
> Consulta del architect: no es rodeo. pnpm install sobre un package.json escrito a mano en el scratchpad es validación fuera del repo (regla 11), sin bloqueo que esquivar.»

Tras el veredicto de security sobre OD-042 (2026-10-21, literal):

> «1. (a): next 16.4.2 con la excepción concedida (security cita el aviso en ADR-012 y en el plan: identificador, URL, fecha, versión vulnerable), react/react-dom 19.3.0 y @types 19.3.0 sin excepción. OD-047 se cierra sin efecto, con la nota de que la premisa de OD-042 (19.3.1 como parche) era falsa. 2. … el architect corrige ARCHITECTURE §2 en el paso 5: "exporta desde src/index.ts y, opcionalmente, sub-exports declarados en package.json exports; nunca rutas internas".»

Registro: SPEC §13 (OD-039…OD-046 resueltas; OD-042 con su resolución final y OD-047 cerrada sin efecto, 2026-10-21), SPEC §8 (`apps/web/src/app/api/**`), ADR-012 → Accepted (sección «Versiones» con las citas) y ADR-000. Los scopes de TASKS.md los corrige el Orchestrator.

## Validación previa fuera del repo (scratchpad, regla 11)

Todo se hizo en `/private/tmp/claude-501/-Users-davidferanandezmorilla-Desktop-development-nosync-agentlab/3fa7c665-c570-4833-afbe-b934a451dd31/scratchpad/t7/` sobre una copia filtrada del repo (sin `.git`, `node_modules`, `.env*`, `.claude` ni `docs`). Herramientas: `node:22.23.3-bookworm-slim@sha256:c3de60bf…` (Node 22.23.3), pnpm 9.15.9, `postgres:16.15-trixie@sha256:ca0bd484…`, Docker 29.8.2 (darwin/arm64). Contenedores, red y volumen propios (`t7-*`, credencial desechable `throwaway7`, store en el volumen `t7-pnpm-store`, no en `agentlab-pnpm-store`), borrados al terminar. No se tocó el contenedor `db` del proyecto ni ningún contenedor de otro proyecto, ni se leyó ningún `.env`.

**Cómo se instalaron las dependencias nuevas en el scratchpad**: escribí el `package.json` de `apps/web` de la copia con Write y ejecuté `pnpm install --ignore-scripts` (sin nombres de paquete) dentro del contenedor. No usé `pnpm add`. La regla 11 y el packet autorizan validar fuera del repo sin `deps_allowed`. **Decisión humana (2026-10-21): no es rodeo**; la evidencia V1–V14 vale.

| # | Prueba | Resultado |
|---|---|---|
| V1 | `apps/web/package.json` con las versiones de la sección «Dependencias» + `pnpm install --ignore-scripts`; después `pnpm install --frozen-lockfile --ignore-scripts` | 245 paquetes añadidos, 176 entradas nuevas en `pnpm-lock.yaml`. **Sin avisos de peers ni de obsoletos**. `react`/`react-dom` resuelven a una sola versión, `19.3.1` (hecha con 19.3.1; se repite con 19.3.0, nota bajo la tabla) |
| V2 | `tsc --noEmit` y `tsc --noEmit -p tsconfig.config.json` en `apps/web` con `rootDir: src`, `include: ["src"]` (decisión 2), con `import packageJson from "../../package.json" with { type: "json" }` | Exit 0. `next build` **no modifica** `tsconfig.json` (diff vacío) y genera `apps/web/next-env.d.ts` (referencias a `next`, `next/image-types/global`, `./.next/types/routes.d.ts`, `./.next/types/root-params.d.ts`) |
| V3 | `next build` con Turbopack (por defecto en Next 16) | **Falla**: `Module not found: Can't resolve './team-definition.js'` en `packages/core/src/index.ts` y `Export loadEnv doesn't exist in target module`. Turbopack no traduce `.js → .ts` (vercel/next.js#82945, abierta) |
| V4 | `next build --webpack` con `extensionAlias: { ".js": [".ts", ".tsx", ".js"] }` | Primero **falla**: `Can't resolve '../migrations'` (`packages/persistence/src/migrate.ts`, `new URL("../migrations", import.meta.url)`). Sin `runMigrations` en el `index.ts` de persistence: compila en ≈35 s, **sin `DATABASE_URL`**. Rutas: `○ /`, `○ /_not-found`, `ƒ /api/health` |
| V5 | Turbopack con los imports relativos de `core`, `persistence` y `web` reescritos sin extensión (sed sobre la copia) | Compila en ≈8,6 s. Al volver a exportar `runMigrations`, el mismo error `Can't resolve '../migrations'`: el problema de V4 no depende del bundler |
| V6 | `output: "standalone"` + `outputFileTracingRoot` = raíz del monorepo | `.next/standalone` = 71 MB: `apps/web/server.js`, `node_modules/.pnpm` (21 entradas: `next`, `react`, `react-dom`, `styled-jsx`, `@swc/helpers`, `sharp` + `libvips` gnu y musl…), y de `packages/*` solo los `package.json`. Ningún `.ts`. `pg` y `drizzle` van dentro del chunk de la ruta |
| V7 | `pingDatabase` (borrador, decisión 6) contra PostgreSQL real: arriba, puerto cerrado (`127.0.0.1:1`) y un servidor TCP que acepta y nunca contesta | Arriba: `true` en 20 ms. Puerto cerrado: `false` en 2 ms (`ECONNREFUSED`). Sin respuesta: `false` a los 2003 ms, **pero sin `connectionTimeoutMillis` en el pool `pool.end()` seguía pendiente a los 4 s** (la conexión colgada retiene el pool). Con `connectionTimeoutMillis: 2000`: `end()` inmediato |
| V8 | Vitest con `vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })` sobre el servidor que no contesta | Pendiente a 1999 ms y `timeout` a 2000 ms; `pool.totalCount` = 0 tras `end()`. El primer intento dio `error` en vez de `timeout`: el temporizador de `connectionTimeoutMillis` del pool se armaba antes que el plazo propio. Corregido armando el plazo **antes** de `pool.connect()` |
| V9 | Test del handler (borrador) en `apps/web` con Vitest | 3 en verde: 200 `{ ok: true, db: "up", version: "0.0.0" }` con `cache-control: no-store`; 503 `{ ok: false, db: "down" }` con puerto cerrado y sin la contraseña canario en el cuerpo; 503 a los 2000 ms con reloj falso |
| V10 | `eslint .` en `apps/web` (config plana de la raíz, `tseslint.configs.strict`), con `next-env.d.ts` presente | Exit 0. No hace falta configuración de ESLint propia para `.tsx` ni para `next-env.d.ts` |
| V11 | Borrador de `docker/web.Dockerfile` (decisión 5) y `.dockerignore` con `!tsconfig.base.json` | Construye. `pnpm install --frozen-lockfile --offline --ignore-scripts --filter web...` en 0,5 s; `RUN --network=none pnpm --filter web build` **compila sin red**. Imagen de 442 MB; `/app` = 72 MB; `id` = `uid=1000(node)`; `command -v pnpm corepack npm npx yarn` → nada (exit 127); `find /app -name '*.ts' ! -name '*.d.ts'` vacío |
| V12 | Contenedor con `--init --cap-drop ALL --security-opt no-new-privileges:true -p 127.0.0.1:3700:3000` contra el PostgreSQL desechable | `/api/health` 200 `{"ok":true,"db":"up","version":"0.0.0"}`, `cache-control: no-store`, sin `x-powered-by`. `/` contiene `AgentLab` y `href="/projects"`; `/projects` → 404; el CSS servido contiene `text-3xl` y `max-w-2xl` (Tailwind). `db` en pausa → 503 en 2,02 s y 2,01 s. `db` parado → 503 en 0,06 s. `db` de vuelta → 200 |
| V13 | `DATABASE_URL` inválida (`mysql://u:<canario>@…`) | 500. Next registra el `EnvValidationError` con los issues de zod; el canario aparece **0** veces en los logs |
| V14 | `docker stop -t 10` del contenedor de `web` | Para en 0,14 s con código **143**: Next 16.4.2 sale con `128 + 15` tras su limpieza (`next/dist/server/lib/start-server.js`, `case 'SIGTERM': process.exit(143)`) |

**V1–V14 se hicieron con `react`/`react-dom 19.3.1`.** Las versiones finales son `19.3.0` (OD-042, decisión humana del 2026-10-21), así que hay que repetir con `next 16.4.2` + `react`/`react-dom 19.3.0` las pruebas que dependen de la instalación: V1 (peers sin avisos, una sola versión de `react`; devops, paso 2), V4 (`next build --webpack`; web-dev, paso 3), V11, V12 y V14 (imagen, contenedor y salida 143; devops, paso 4). Por metadatos del registro son compatibles: `next 16.4.2` declara peers `react`/`react-dom` `^18.2.0 || ^19.0.0`; `react-dom 19.3.0`, peer `react ^19.3.0`. No está compilado.

**No validado** (lo aporta devops en el paso 4 o el tester): la prueba de canarios de `.dockerignore` para `web` (bloqueo de hook, abajo), `docker compose up --build` con el `compose.yaml` real, `next dev --webpack` en macOS (el Node del host es 26 y `engine-strict` impide instalar), `make test`/`make validate` con el test de `web` y que una red solo `internal` impida publicar el puerto.

**Bloqueos de hook** (AGENTS.md §4; los cito, paré esa línea de validación y no la reformulé):

- `BLOCKED by bash-guard: escritura por shell en '$S/repo/$S/canary/apps/web/.next' fuera del scope de la tarea. Usa Edit/Write dentro del scope o repórtalo.` Era la prueba de canarios en una segunda copia dentro del scratchpad (`$S` = directorio del scratchpad). **Parece un falso positivo**: el guard concatenó la variable sin resolver a la raíz del repo. El juicio no es mío. La prueba no se hizo.
- `BLOCKED by bash-guard: no se ejecutan descargas directamente (curl | sh)`. Era `curl -s https://unpkg.com/next@<v>/dist/compiled/react-server-dom-webpack/package.json | python3 -I -c …`, para comparar la copia de React Server Components que incluye `next` 16.4.0, 16.4.1 y 16.4.2. **Parece un falso positivo** (la salida iba a un parser JSON, no a `sh`). No lo repetí por otra vía. Quedó como riesgo R2, que security resolvió en el paso 1b (2026-10-21; ver R2).

## Dependencias (versiones finales, OD-042 resuelta el 2026-10-21)

Consultadas con `npm view <pkg> dist-tags time peerDependencies engines dependencies` el 2026-10-21. Avisos de seguridad verificados por security con `gh api /repos/<owner>/<repo>/security-advisories/<id>` el mismo día (tabla abajo).

| Paquete | Versión | Workspace | Publicada | Antigüedad | Compatibilidad |
|---|---|---|---|---|---|
| `next` | `16.4.2` | `apps/web` (`dependencies`) | 2026-10-15 | **6 días: excepción OD-042** | Ya fijada en ARCHITECTURE §9 (ADR-002). `engines.node >=20.9.0`; peers `react`/`react-dom` `^18.2.0 \|\| ^19.0.0`; build con TS 5.9.3 (V4) |
| `react` | `19.3.0` | `apps/web` (`dependencies`) | 2026-09-09T17:21:30.071Z | 42 días | Satisface el peer de `next`; peer de `react-dom` 19.3.0 = `^19.3.0` |
| `react-dom` | `19.3.0` | `apps/web` (`dependencies`) | 2026-09-09T17:17:39.744Z | 42 días | Peer `react ^19.3.0`; dependencia `scheduler ^0.28.0` |
| `tailwindcss` | `4.3.3` | `apps/web` (`devDependencies`) | 2026-07-16 | 97 días | `engines.node >=20` |
| `@tailwindcss/postcss` | `4.3.3` | `apps/web` (`devDependencies`) | 2026-07-16 | 97 días | Depende de `postcss ^8.5.16`, `tailwindcss 4.3.3` y `@tailwindcss/oxide 4.3.3`, así que **no hace falta declarar `postcss`** |
| `@types/react` | `19.3.0` | `apps/web` (`devDependencies`) | 2026-09-09 | 42 días | `dist-tags.latest` y `ts5.9` = 19.3.0 |
| `@types/react-dom` | `19.3.0` | `apps/web` (`devDependencies`) | 2026-09-09 | 42 días | Peer `@types/react ^19.3.0` |

- `@agentlab/core` y `@agentlab/persistence` entran como `workspace:*` en `dependencies` (no son dependencias nuevas).
- **No se autorizan**: `postcss` (llega por `@tailwindcss/postcss`, y `next` trae su `postcss 8.5.23`), `eslint-config-next` (Next 16 ya no hace lint en el build; V10), librerías de test (Vitest está en la raíz y el handler se prueba sin el runtime de Next) ni `pino` (salvo que el humano elija OD-044 b: `pino 10.4.0`, ya en el lockfile).
- Transitivas relevantes para security: `sharp 0.35.5` (opcional de `next`, sin script `install`), `@next/swc-linux-*-{gnu,musl} 16.4.2`, `@tailwindcss/oxide-linux-*-{gnu,musl} 4.3.3`, `lightningcss 1.33.0` (más la `1.32.0` que ya trae `vite`), `postcss 8.5.23`, `styled-jsx 5.1.6`. Los binarios por plataforma son `optionalDependencies`: ninguno necesita scripts (V11 compila con `--ignore-scripts`).
- **Regla de las dos semanas**: solo `next 16.4.2` la incumple, con la **excepción concedida** (OD-042, decisión humana del 2026-10-21). `react`, `react-dom`, `@types/*` y `tailwindcss` la cumplen y van sin excepción.

### Avisos de seguridad (veredicto de security, 2026-10-21)

Consultados por security con `gh api /repos/<owner>/<repo>/security-advisories/<id>`; todos `state: published`. La API devuelve las URL de React bajo `github.com/react/react`. Ninguno estaba aún en la base global (`/advisories/<id>` → 404).

| ID | CVE | Severidad | Publicado (UTC) | Paquete: versión vulnerable → parche |
|---|---|---|---|---|
| [GHSA-2464-fhr4-w9xw](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw) | CVE-2026-96889 | critical | 2026-10-14T17:46:48Z | `next`: `>16.0.0 <=16.4.0` → 16.4.1; `>=10.0.0 <=15.5.27` → 15.5.28 |
| [GHSA-673q-mjm6-r5xr](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr) | — | critical | 2026-10-14T17:47:07Z | `next`: `>=16.0.0 <=16.4.0` → 16.4.1 |
| [GHSA-p3m5-59mp-jv5r](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r) | — | high | 2026-10-14T17:47:43Z | `next`: `>=16.0.0 <=16.4.0` → 16.4.1; `>=13.0.0 <=15.5.27` → 15.5.28 |
| [GHSA-xqc2-xf4c-x3h3](https://github.com/react/react/security/advisories/GHSA-xqc2-xf4c-x3h3) | — | critical | 2026-10-14T17:08:26Z | `react-server-dom-{webpack,turbopack,parcel}`: 19.0.0–19.0.8, 19.1.0–19.1.9, 19.2.0–19.2.8, 19.3.0 → 19.0.9 / 19.1.10 / 19.2.9 / 19.3.1 |
| [GHSA-h3gv-c5rc-p453](https://github.com/react/react/security/advisories/GHSA-h3gv-c5rc-p453) | — | high | 2026-10-14T17:08:23Z | Ídem (`react-server-dom-*`), mismos rangos y parches |

Conclusiones de security:

- `next`: el parche es **16.4.1** (2026-10-14T17:43Z; su release note cita los tres GHSA). **16.4.2** (2026-10-15T20:57Z) no es un parche de seguridad (backports de Turbopack y docs), pero contiene los arreglos. La estable anterior a 16.4.2 (16.4.1) no es vulnerable; **16.4.0 (2026-10-06) sí**. No existe `next` 16.x con más de dos semanas que no sea vulnerable; 15.5.28 tiene 7 días.
- `react`/`react-dom`: **ningún aviso los afecta**. De 19.3.0 a 19.3.1, `react` solo cambia la versión y `react-dom` endurece `react-dom-server` sin aviso asociado. Por eso 19.3.1 no es «el parche» y la premisa de OD-042 era falsa.
- Los avisos de React afectan a `react-server-dom-*`, que en `apps/web` llega solo como la copia compilada dentro de `next` (R2): `next ≥ 16.4.1` lleva el arreglo y 16.4.0 no.

### Plan B anterior: descartado

El plan B de OD-042 («últimas versiones con más de dos semanas»: `next 16.4.0`, `react`/`react-dom 19.3.0`) queda **descartado**: `next 16.4.0` es vulnerable a GHSA-2464-fhr4-w9xw, GHSA-673q-mjm6-r5xr (CRITICAL) y GHSA-p3m5-59mp-jv5r, y lleva la copia de `react-server-dom-*` sin el arreglo de GHSA-xqc2-xf4c-x3h3 (CRITICAL). Security verificó los avisos, así que la rama «no verificable» de OD-042 no se activa. `react`/`react-dom 19.3.0`, que eran parte del plan B, pasan a ser las versiones finales porque ningún aviso los afecta.

## Decisiones de diseño

1. **App Router en `apps/web/src/app`.** Así `rootDir: src` se mantiene (TD-010, DoD). Next admite `src/app` de forma nativa. Alternativa descartada: `apps/web/app`, que obligaría a quitar `rootDir` o a ampliar `include` fuera de `src`. **OD-041 (a), decidida**: SPEC §8 corregido (`apps/web/src/app/api/**`); scopes de TASKS.md, Orchestrator.
2. **TD-010.** `apps/web/tsconfig.json` mantiene `extends`, `rootDir: "src"` e `include: ["src"]` y añade `lib: ["ES2023", "DOM", "DOM.Iterable"]`, `jsx: "react-jsx"`, `noEmit: true`, `resolveJsonModule: true` y `plugins: [{ "name": "next" }]` (este último solo para el editor). `next.config.ts` y `vitest.config.ts` se tipan con un `tsconfig.config.json` aparte (`include: ["next.config.ts", "vitest.config.ts"]`), el mismo patrón que `core`, `persistence` y `worker`. `postcss.config.mjs` es JS y no se tipa. `next build` usa ese `tsconfig.json` sin reescribirlo (V2).
   - `next-env.d.ts` **no** entra en `include`. Solo hace falta para importar imágenes o módulos CSS tipados, que M0 no usa; `tsc` y `next build` pasan sin él (V2, V4). Va en `.gitignore`, como recomienda la documentación de Next (OD-045).
   - Alternativa descartada: `typescript.tsconfigPath` hacia un `tsconfig.build.json`. No hace falta: el `tsconfig.json` sirve para `tsc` y para Next.
3. **Bundler: webpack con `extensionAlias`** (OD-039, recomendación a; ADR-012). `next.config.ts`:

   ```ts
   const monorepoRoot = fileURLToPath(new URL("../..", import.meta.url));
   const nextConfig: NextConfig = {
     output: "standalone",
     outputFileTracingRoot: monorepoRoot,
     transpilePackages: ["@agentlab/core", "@agentlab/persistence"],
     poweredByHeader: false,
     webpack: (config: { resolve: { extensionAlias?: Record<string, string[]> } }) => {
       config.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"] };
       return config;
     },
   };
   ```

   Scripts: `dev` = `next dev --webpack`, `build` = `next build --webpack`. `poweredByHeader: false` quita la cabecera `x-powered-by` (V12). Es una línea y reduce lo que la API revela; si security lo considera fuera del DoD, se quita.
   - **OD-039 (a), decidida.** Deuda LOW → TASK-040 (sección «Deuda»).
4. **`transpilePackages`** con los dos paquetes del workspace que importa `web` (ADR-009 §5). Sin él, Next puede tratar `@agentlab/*` como paquete externo del servidor y cargar `.ts` con Node en runtime.
5. **Imagen de `web` con `output: "standalone"`, no con `pnpm deploy`** ([ADR-012](../adr/ADR-012-build-e-imagen-de-web.md), Accepted; amplía ADR-011, no lo cambia). Stages de `docker/web.Dockerfile` (borrador validado en V11):
   - `base`: Node fijado por digest, `TURBO_TELEMETRY_DISABLED=1`, `NEXT_TELEMETRY_DISABLED=1`, corepack + pnpm 9.15.9 (igual que `worker.Dockerfile`).
   - `deps`: `pnpm fetch --ignore-scripts`.
   - `build`: `COPY . .`, `pnpm install --frozen-lockfile --offline --ignore-scripts --filter web...` y `RUN --network=none pnpm --filter web build`.
   - `slim`: borra `npm`, `npx`, `corepack` y `yarn`; `NODE_ENV=production`, `NEXT_TELEMETRY_DISABLED=1`, `HOSTNAME=0.0.0.0`, `PORT=3000`.
   - `runtime`: `COPY --from=build /app/apps/web/.next/standalone ./` y `.next/static` → `./apps/web/.next/static`; `USER node`; `EXPOSE 3000`; `CMD ["node", "apps/web/server.js"]`. M0 no tiene `public/`; cuando exista, se copia igual que `static`.

   Por qué no `pnpm deploy`: necesita red con el contexto copiado (ADR-011, R1), arrastra a la imagen los binarios `@next/swc-*` (solo de build), los `.ts` de los paquetes inyectados y todo `node_modules` de producción, y el build tendría que hacerse dentro del directorio desplegado.

   Condiciones que pide el packet:
   - Lockfile verificado: `--frozen-lockfile` en el `install` del stage `build`, que es la condición 1 de ADR-011 en su forma nativa (aquí no hay `deploy`).
   - `--ignore-scripts` en `fetch` e `install`: no hace falta ningún script (V11).
   - El build no tiene red (`--network=none`): Next, Tailwind y `tsc` se ejecutan sin poder salir.
   - En la imagen final no hay gestores de paquetes, devDependencies ni fuentes `.ts`, y corre con uid 1000 (V11).
   - Los ficheros de la imagen son de root: el proceso no puede reescribir la aplicación. M0 no escribe en `.next/cache` (R4).
6. **`pingDatabase` en `persistence`** (`src/health.ts`, nuevo; persistence-dev):
   - Un plazo único de `timeoutMs` que cubre `pool.connect()` + `select 1`, armado **antes** de `connect()` (V8).
   - Si vence el plazo o hay error, el cliente se libera con `release(true)`: pg lo destruye (con una consulta activa, `end()` hace `stream.destroy()`) y nunca vuelve al pool. Si el `connect()` termina después del plazo, ese cliente también se destruye.
   - Nunca lanza. Devuelve `false` ante cualquier error, sin `message` ni URL (TD-011).
   - El llamante crea el pool con `connectionTimeoutMillis = timeoutMs` (decisión 7): sin eso, una conexión colgada retiene el pool (V7).

   Alternativas descartadas:
   - `statement_timeout`: lo aplica el servidor, así que no cubre un PostgreSQL que no contesta (V12, `db` en pausa).
   - `query_timeout` de pg: rechaza la promesa pero deja la consulta en vuelo en la conexión.
   - `Promise.race` sobre `pool.query`: deja el cliente ocupado y `pool.end()` pendiente (V7).
   - SQL en el handler: el DoD lo prohíbe.
7. **Pool en `web`: uno por petición de salud.** `createPool(url, { max: 1, connectionTimeoutMillis: 2000 })`, `pool.on("error", () => undefined)` (un error de un cliente ocioso no debe tumbar el proceso), `pingDatabase`, y `void pool.end().catch(() => undefined)` sin esperar para responder.
   - Sin estado de módulo, como pide monorepo-conventions. No se conecta al importar ni en `next build` (V4 y V11 compilan sin `DATABASE_URL`).
   - Cada comprobación abre una conexión real, que es lo que debe medir un health check.
   - `createPool` gana la opción `connectionTimeoutMillis` (aditiva).
   - Alternativa descartada: un pool perezoso por proceso. Es estado de módulo mutable, que la convención prohíbe, y M0 tiene una sola ruta. El pool compartido lo decide TASK-014, la primera tarea con varias rutas (R6).
8. **Contrato de `GET /api/health`.**
   - `src/app/api/health/route.ts` solo compone: `export const dynamic = "force-dynamic"` (nada de prerender ni caché en el build) y `export async function GET()`, que llama a `checkHealth(loadEnv().DATABASE_URL)`.
   - La lógica vive en `src/server/health.ts`. `route.ts` solo puede exportar los nombres que Next admite.
   - Respuestas (`Response.json`, `content-type: application/json`, `cache-control: no-store` en las dos):
     - 200 `{ "ok": true, "db": "up", "version": "<version>" }`.
     - 503 `{ "ok": false, "db": "down" }`.
     - Exactamente esas claves, sin `reason`, `code` ni mensaje.
   - Plazo: constante `HEALTH_TIMEOUT_MS = 2000` (DoD). No es variable de entorno: no está en `env.ts` y no se inventa.
   - `version` = campo `version` de `apps/web/package.json`, embebido en el build (`import … with { type: "json" }`; hoy `"0.0.0"`): OD-043.
   - Entorno inválido: con OD-044 (a), el `EnvValidationError` sale del handler → Next responde 500 y lo registra, sin valores (V13).
9. **Página y layout mínimos.**
   - `src/app/layout.tsx`: `<html lang="en">`, `<body>` con dos clases de Tailwind y `metadata.title = "AgentLab"`.
   - `src/app/globals.css`: `@import "tailwindcss";`.
   - `src/app/page.tsx`: `<h1>AgentLab</h1>` y `<Link href="/projects">Projects</Link>` con clases de Tailwind.
   - Sin componentes ni carpetas `components/` o `lib/`.
   - `/projects` da el 404 por defecto de Next en M0 (V12): OD-046.
10. **compose (`web`)** (devops):
    - Quitar `profiles: ["web"]` (OD-G). `build.target: runtime`.
    - `cap_drop: [ALL]`, `security_opt: ["no-new-privileges:true"]`, `init: true` (tini reenvía `SIGTERM`; V12 y V14 con esas opciones).
    - `ports: ["127.0.0.1:3000:3000"]` y `depends_on` (`db` healthy, `migrate` completed) sin cambios.
    - `networks: [backend, egress]`, sin cambios (ARCHITECTURE §1). `web` no hace llamadas salientes en M0, pero un contenedor conectado solo a redes `internal: true` no publica puertos en el host (comportamiento conocido de Docker, no documentado en la página del driver; devops lo comprueba). `egress` es la única red no interna.
    - `environment` sin cambios.
    - **Sin `healthcheck`**: ningún servicio depende de `web` y decidir si «web sana» incluye la base sería un requisito nuevo. `stop_grace_period` por defecto (V14: 0,14 s).
    - Alternativa descartada: `read_only: true`, que el DoD no pide y que Next necesitaría acompañar de un volumen para `.next/cache`.
11. **Makefile** (devops):
    - Texto de ayuda de `up`: «Levanta db, migrate, worker y web». El comando no cambia: `docker compose up --build -d` ya incluye `web` sin perfil.
    - `HOST_TAR` gana `--exclude=.next`, para que un `.next` de desarrollo en el host no viaje al contenedor de `make test`/`make validate`. Cierra más, no abre nada; `.dockerignore` ya excluye `**/.next`. Regla 10: probado en macOS y Linux.
12. **`.dockerignore`**: añadir `!tsconfig.base.json` después de `!.npmrc` (V11). No se toca ninguna exclusión: `HOST_TAR`, `*.pem` y `*.key` siguen igual. El `deploy` del worker no copia ese fichero a `/out`, así que TD-031 no cambia.
    - Alternativa descartada: copiar las opciones de la base en `apps/web/tsconfig.json` sin `extends`, que duplica la configuración estricta de TASK-001.
13. **Logger de `web`**: OD-044. Recomiendo (a), ninguno en M0. Con (a), `pingDatabase` devuelve `boolean`: un `reason`/`code` que nadie registra sería un campo «por si acaso» (OD-014, OD-025).
14. **¿ADR?** Sí: [ADR-012](../adr/ADR-012-build-e-imagen-de-web.md) (Accepted). La imagen de `web` usa otro mecanismo que ADR-011, y el bundler precisa ADR-009 §5 («Turbopack» → webpack). El resto implementa ARCHITECTURE §1, §7 y §9 sin cambiarlos.

## Scope final propuesto (ruta → owner)

Las rutas ✱ amplían el scope original de TASKS.md (`apps/web/**`, `docker/web.Dockerfile`, `compose.yaml`, `Makefile`). OD-045 (a) las aprobó; OD-040 (a) añade `packages/persistence/package.json` y `migrate.integration.test.ts`.

| Ruta | Owner | Paso | Por qué |
|---|---|---|---|
| ✱ `packages/persistence/src/health.ts` (nuevo), ✱ `packages/persistence/src/health.integration.test.ts` (nuevo) | persistence-dev | 1 | `pingDatabase` y sus tests (decisión 6) |
| ✱ `packages/persistence/src/pool.ts` | persistence-dev | 1 | Opción `connectionTimeoutMillis` en `createPool` (decisión 7) |
| ✱ `packages/persistence/src/index.ts`, ✱ `packages/persistence/src/index.test.ts` | persistence-dev | 1 | Exportar `pingDatabase`; quitar `runMigrations` del índice (OD-040 a); test de exports: índice y mapa de sub-exports |
| ✱ `packages/persistence/package.json` | persistence-dev | 1 | Sub-export `"./migrate": "./src/migrate.ts"` (OD-040 a) |
| ✱ `packages/persistence/src/migrate.integration.test.ts` | persistence-dev | 1 | En scope por OD-040; no necesita cambios (importa `./migrate.js` por ruta relativa). Solo se toca si el paso 1 lo rompe |
| `apps/web/package.json`, ✱ `pnpm-lock.yaml` | devops | 2 | Dependencias exactas y scripts |
| `apps/web/**` (el resto) | web-dev | 3 | App, configuración, handler y test |
| `docker/web.Dockerfile`, `compose.yaml`, `Makefile` | devops | 4 | Decisiones 5, 10 y 11 |
| ✱ `.dockerignore`, ✱ `.gitignore` | devops | 4 | `!tsconfig.base.json` (decisión 12); `next-env.d.ts` (decisión 2) |
| `docs/ARCHITECTURE.md` §1, §2, §7 y §9 | architect | 5 | Tras la implementación (§2: lista de sub-exports) |
| `docs/TECHNICAL_SPEC.md` §8 y §13, `docs/adr/ADR-012`, `docs/adr/ADR-000` | architect | hecho (2026-10-21) | Registro de las decisiones humanas |
| `docs/TECHNICAL_DEBT.md`, `docs/TASKS.md` | docs-keeper / Orchestrator | 5 | Cierre |

No hace falta tocar `turbo.json` (R15), `package.json` raíz, `.env.example` (ninguna variable nueva), `eslint.config.js` (V10) ni `docker/worker.Dockerfile`.

## Pasos

0. **Orchestrator**:
   - Scope de la tabla anterior en TASKS.md y `.claude/task-scope.json`; DoD complementario (hecho, 2026-10-21).
   - Scopes de las tareas futuras (OD-041 a; ver «Pendiente en TASKS.md» al final).
   - `deps_allowed` con las siete versiones finales de «Dependencias» (veredicto del paso 1b, 2026-10-21).
1. **persistence-dev** → `packages/persistence/src/{health.ts, health.integration.test.ts, pool.ts, index.ts, index.test.ts}`.
   - `pingDatabase` (decisión 6, firma en «Contratos»).
   - `createPool(url, { max?, connectionTimeoutMillis? })`.
   - Export de `pingDatabase` en `index.ts`; quitar `export { runMigrations } from "./migrate.js"` (OD-040 a). `cli/migrate.ts` y `testing/reset.ts` ya lo importan por ruta relativa y no cambian.
   - `package.json`: `exports` = `{ ".": "./src/index.ts", "./testing": "./src/testing/index.ts", "./migrate": "./src/migrate.ts" }`. Sin dependencias nuevas.
   - `index.test.ts` (test de exports, ampliado; detalle en «Tests»): índice cerrado con `pingDatabase` y sin `runMigrations`; mapa `exports` exacto con sus tres entradas y ficheros existentes; el módulo `./migrate.js` exporta exactamente `runMigrations`.
   - `migrate.integration.test.ts`: sin cambios.
   - Evidencia: `typecheck`, `lint` y tests de `persistence` en el contenedor fijado (`make test`).
1b. **security (solo lectura, OD-042)** — **hecho (2026-10-21)**. Avisos citados en «Avisos de seguridad»; `next 16.4.2` contiene los arreglos (el parche es 16.4.1) y 16.4.0 es vulnerable; ningún aviso afecta a `react`/`react-dom`; R2 resuelto (ver R2). Decisión humana: `next 16.4.2` con excepción, `react`/`react-dom`/`@types 19.3.0` sin excepción; OD-047 cerrada sin efecto.
2. **devops (dependencias)**, con `deps_allowed` actualizado → `apps/web/package.json`, `pnpm-lock.yaml`. Versiones finales de «Dependencias».
   - `dependencies`: `@agentlab/core` y `@agentlab/persistence` `workspace:*`, `next 16.4.2`, `react 19.3.0`, `react-dom 19.3.0`.
   - `devDependencies`: `@tailwindcss/postcss 4.3.3`, `@types/react 19.3.0`, `@types/react-dom 19.3.0`, `tailwindcss 4.3.3`.
   - Scripts: `dev` = `next dev --webpack`, `build` = `next build --webpack`, `start` = `next start` (solo local; la imagen usa `server.js`), `typecheck` = `tsc --noEmit && tsc --noEmit -p tsconfig.config.json`, `lint` = `eslint .`, `test` = `vitest run --coverage`.
   - Lockfile con `pnpm install --lockfile-only --ignore-scripts` en el contenedor fijado.
   - Evidencia (repite V1 con 19.3.0): `pnpm install --frozen-lockfile --ignore-scripts` sin avisos de peers; `pnpm why react` → solo 19.3.0; `pnpm --filter web ls --depth 0`.
3. **web-dev** → `apps/web/**`:
   - Borrar `src/index.ts` (TD-009).
   - `tsconfig.json` y `tsconfig.config.json` (decisión 2).
   - `next.config.ts` (decisión 3), `postcss.config.mjs` (`plugins: { "@tailwindcss/postcss": {} }`).
   - `vitest.config.ts`: `include: ["src/**/*.test.ts"]`, `fileParallelism: false`, `restoreMocks: true`, cobertura v8 sobre `src/**/*.ts`. Sin `globalSetup`: el test solo necesita que exista `agentlab_test`, que crea `init.sql`.
   - `src/app/{layout.tsx, page.tsx, globals.css}` (decisión 9).
   - `src/app/api/health/route.ts` y `src/server/health.ts` (decisión 8).
   - `src/server/health.integration.test.ts` («Tests»).
   - Imports relativos con sufijo `.js`, como el resto del monorepo (OD-039 a).
   - Evidencia en el contenedor fijado: `typecheck`, `lint`, `test`; `pnpm --filter web build` sin `DATABASE_URL` (repite V4 con `react`/`react-dom 19.3.0`), y `git diff --exit-code apps/web/tsconfig.json` después (Next no lo reescribe); `next dev --webpack` responde 200 en `/api/health` dentro del contenedor. En macOS, solo si hay Node 22 en el host (R13).
4. **devops (imagen, compose, Makefile, ignores)** → `docker/web.Dockerfile`, `compose.yaml`, `Makefile`, `.dockerignore`, `.gitignore` (decisiones 5, 10, 11 y 12; `.gitignore` + `next-env.d.ts`). Evidencias (repiten V11, V12 y V14 con `react`/`react-dom 19.3.0`):
   - Imagen: `id -u` = 1000; `command -v pnpm corepack npm npx yarn` vacío; `find /app -name '*.ts' ! -name '*.d.ts'` vacío; `ls /app/node_modules/.pnpm`.
   - Canarios `*.pem`, `*.key`, `.env.local`, `x.env` y `.envrc` en la raíz, `apps/web`, `apps/web/src/app`, `packages/core/src` y `packages/persistence`: ninguno en el stage `build` (`--target build`) ni en `runtime`. Es la prueba que no pude hacer.
   - Especificador alterado en `pnpm-lock.yaml` de una copia → el build falla con `ERR_PNPM_OUTDATED_LOCKFILE`.
   - `docker compose --profile '*' config`: `web` sin perfil, con `cap_drop`, `no-new-privileges`, `init`, redes y puerto `127.0.0.1:3000`.
   - `docker compose up --build -d` → `curl -si 127.0.0.1:3000/api/health` = 200 con el cuerpo exacto y `cache-control: no-store`.
   - `docker compose pause db` → 503 entre 2,0 s y 2,5 s (DoD vigente); `unpause` → 200. `docker compose stop db` → 503.
   - `docker compose port web 3000` = `127.0.0.1:3000`.
   - `docker compose stop web` → código 143 (V14, R5).
   - Comprobación de que con `networks: [backend]` sola el puerto no se publica, para justificar `egress`.
   - `make help`, `make test` y `make validate` en macOS (make 3.81, bsdtar) y en el contenedor Linux (GNU make y tar), por el cambio de `HOST_TAR` (regla 10). Salida literal en el informe.
5. **architect** (tras la verificación) → ARCHITECTURE §1 (fila `web`: imagen `standalone`, redes, `init`, `cap_drop`, salida 143), §2 (sub-exports `/testing` y `/migrate`; texto de la decisión humana del 2026-10-21: «exporta desde src/index.ts y, opcionalmente, sub-exports declarados en package.json exports; nunca rutas internas»), §7 (`src/app`, contrato de `/api/health`) y §9 (versiones instaladas: `next 16.4.2` con excepción OD-042, `react`/`react-dom 19.3.0`; bundler). SPEC §8 y §13 ya están (2026-10-21). **docs-keeper** → TECHNICAL_DEBT (sección «Deuda»), TASKS y la anotación en ADR-009 §5 (ADR-012 Accepted). La lista de sub-exports de `.claude/skills/monorepo-conventions/SKILL.md` gana `@agentlab/persistence/migrate` (quien tenga ese fichero en su rol).

Orden: (1 ∥ 1b) → 2 → 3 → 4 → verificación → 5. El 2 necesitaba el veredicto de 1b (hecho, 2026-10-21; OD-047 cerrada sin efecto). El 3 necesita 1 (`pingDatabase`, `createPool`) y 2 (dependencias). El 4 necesita 3 (algo que construir).

## Contratos públicos nuevos o cambiados

- `@agentlab/persistence`:

  ```ts
  /** true if `select 1` answers within timeoutMs, connection included. Never throws; a timed-out or failed client is destroyed. */
  export function pingDatabase(pool: pg.Pool, options: { readonly timeoutMs: number }): Promise<boolean>;

  export function createPool(
    connectionString: string,
    options?: { readonly max?: number; readonly connectionTimeoutMillis?: number },
  ): pg.Pool;

  // OD-040 (a): runMigrations sale del índice; firma sin cambios, ahora en el sub-export:
  // import { runMigrations } from "@agentlab/persistence/migrate";
  ```

  `packages/persistence/package.json`:

  ```json
  "exports": {
    ".": "./src/index.ts",
    "./testing": "./src/testing/index.ts",
    "./migrate": "./src/migrate.ts"
  }
  ```

  `web` nunca importa `@agentlab/persistence/migrate` (rompería el bundle, V4); hoy no lo importa nadie de fuera del paquete.
- `apps/web` (interno; la app no exporta nada):

  ```ts
  // src/server/health.ts
  export const HEALTH_TIMEOUT_MS = 2000;
  export function checkHealth(databaseUrl: string, timeoutMs?: number): Promise<Response>;
  // src/app/api/health/route.ts
  export const dynamic = "force-dynamic";
  export async function GET(): Promise<Response>;
  ```

- HTTP: `GET /api/health` → 200 `{ ok: true, db: "up", version }` | 503 `{ ok: false, db: "down" }`, ambas con `cache-control: no-store`. Con OD-044 (a), un entorno inválido da 500 (respuesta por defecto de Next).
- Imagen `web`: `CMD ["node", "apps/web/server.js"]`, uid 1000, puerto 3000 en `0.0.0.0` dentro del contenedor y `127.0.0.1:3000` en el host.
- Scripts de `apps/web`: `dev`, `build`, `start`, `typecheck`, `lint`, `test`.

## Tests

**persistence** (`src/health.integration.test.ts`, PostgreSQL real, sin `sleep`):

- Contra `agentlab_test` (`loadTestDatabaseUrl()`) → `true`; después `pool.end()` resuelve y `pool.totalCount` = 0.
- Puerto cerrado (`127.0.0.1:1`) → `false`, sin tocar el temporizador.
- Servidor que nunca contesta (`net.createServer` en `127.0.0.1:0` dentro del propio test) con `vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })`: sigue pendiente a 1999 ms y da `false` a 2000 ms. Después `pool.end()` resuelve y `totalCount` = 0 (V8).
- **Consulta colgada tras conectar** (recomendado): un proxy TCP del test reenvía a la base real y deja de reenviar el primer mensaje `Q` (Simple Query) del cliente. Con reloj falso: `false` al vencer el plazo, el socket del cliente se cierra (`release(true)`) y `pool.totalCount` = 0. Es el único caso que ejercita la destrucción de un cliente ya conectado.
- `index.test.ts` (test de exports, persistence-dev, paso 1):
  - «public API»: `Object.keys(persistence)` = la lista actual + `pingDatabase` − `runMigrations`.
  - «sub-exports»: el campo `exports` de `packages/persistence/package.json` (leído con `readFileSync` + `JSON.parse`, como ya hace `migrate.integration.test.ts` con sus ficheros) es exactamente `{ ".", "./testing", "./migrate" }` con esos destinos, y cada destino existe en disco.
  - «migrate sub-export»: `Object.keys(await import("./migrate.js"))` = `["runMigrations"]`. Así una exportación nueva en `migrate.ts` no entra en el sub-export sin que el test lo diga.
  - No se importa por el nombre del paquete (`@agentlab/persistence/migrate`) desde dentro de `persistence`: depende de la autorreferencia de paquetes en Vitest, que no he validado.
- `migrate.integration.test.ts`: sin cambios (sigue importando `./migrate.js`).

**web** (`src/server/health.integration.test.ts`):

- 200, cuerpo exactamente `{ ok: true, db: "up", version }`, con `version` igual a la de `apps/web/package.json`; `cache-control: no-store`; `content-type` empieza por `application/json`.
- Puerto cerrado, con una contraseña canario en la URL → 503, cuerpo exactamente `{ ok: false, db: "down" }` y sin el canario.
- Servidor que no contesta, con reloj falso → pendiente a 1999 ms y 503 a 2000 ms («PostgreSQL no responde en 2 s», DoD).

**Infra** (tester, con evidencia manual): todo lo del paso 4, más V12 repetido sobre `docker compose`: HTML de `/` con `AgentLab` y `href="/projects"`, CSS con utilidades de Tailwind y sin `x-powered-by`.

**Ejecución**: `make test` (servicio `test` en `test-db`, `turbo run test --concurrency=1`; el servidor TCP de los tests vive en el propio contenedor `test`, sin tocar `db`) y `make validate` (incluye `typecheck` y `lint` de `web`). El DoD no fija cobertura; se informa.

## Riesgos

- **R1** — webpack (OD-039 a, decidida; los builds lentos no importan en M0): una opción de Next 16 que no es la de por defecto. Si una versión futura la retira antes de que Turbopack resuelva `.js → .ts`, hará falta la opción (b). Deuda LOW → TASK-040.
- **R2** — **RESUELTO por security (2026-10-21).** `next` incluye su propia copia de React Server Components (`dist/compiled/react-server-dom-webpack*`). El `package.json` de esa copia **no sirve como indicador**: declara el mismo canary `19.3.0-canary-278794d7-20261002` en 16.4.0, 16.4.1 y 16.4.2. Security comparó el código: `diff -rq` da cambios en client/server/plugin de 16.4.0 a 16.4.1 y ninguno de 16.4.1 a 16.4.2. Las líneas del arreglo upstream (`react-server-dom-webpack` 19.3.0 → 19.3.1) están en `next 16.4.2`: `server.node.production.js` 162/162 (68/162 en 16.4.0; las 162 llegan de 16.4.0 a 16.4.1 y son exactamente las del arreglo), `server.edge.production.js` 145/145 (53/145 en 16.4.0) y `server.node.development.js` 178/178 (67/178 en 16.4.0). Conclusión: `next ≥ 16.4.1` lleva el arreglo de GHSA-xqc2-xf4c-x3h3 y GHSA-h3gv-c5rc-p453; 16.4.0 no.
- **R3** — `/_next/image` existe y `sharp` + `libvips` (≈36 MB, con la variante musl, que no se usa) entran en la imagen aunque M0 no usa `next/image`. GHSA-2464 está corregido en 16.4.1, así que `next 16.4.2` no es vulnerable. `images: { unoptimized: true }` y `outputFileTracingExcludes` reducirían superficie y tamaño, pero el DoD no lo pide. Decisión humana: deuda LOW, TASK-040.
- **R4** — ficheros de la imagen de root: si una tarea futura usa ISR u optimización de imágenes, necesitará un directorio escribible para `.next/cache`.
- **R5** — `docker compose stop web` sale con 143 por diseño de Next (V14). Aceptado en ADR-012 y en el DoD: se documenta y no se trata como fallo. Si TASK-024 (SSE) necesita cerrar conexiones con orden, existe `NEXT_MANUAL_SIG_HANDLE`.
- **R6** — un pool por comprobación: una conexión nueva por cada `/api/health`. Con una llamada manual es irrelevante. TASK-014 decide el pool compartido; ahí se planteará la excepción a «sin estado de módulo», porque Next no tiene raíz de composición.
- **R7** — sin logger en `web` (OD-044 a): `web` no registra una base caída (el worker sí, contra la misma base). Next registra el error de entorno inválido; V13 muestra que no lleva valores.
- **R8** — `next-env.d.ts` fuera de `include`: sin tipos globales de imágenes ni de módulos CSS. Cuando haga falta, se añade a `include` (es `.d.ts`, `rootDir` no lo rechaza).
- **R9** — `!tsconfig.base.json` mete un fichero no secreto en el contexto de todas las imágenes. La prueba de canarios de `web` no se ha hecho (bloqueo de hook): la aporta devops.
- **R10** — `RUN --network=none` necesita BuildKit (por defecto en Docker ≥ 23 y en `docker compose build`).
- **R11** — el cambio de `HOST_TAR` se prueba en macOS y Linux (regla 10).
- **R12** — superficie de cadena de suministro: +176 entradas en el lockfile, con binarios nativos por plataforma (`@next/swc`, `@tailwindcss/oxide`, `lightningcss`, `@img/sharp`). Mitigado con `--ignore-scripts` en todas las instalaciones y con el build sin red. El audit de dependencias llega con TASK-006.
- **R13** — en esta máquina el Node del host es 26: `engine-strict` impide `pnpm install` en el host. La evidencia de `next dev` se toma en el contenedor.
- **R14** — `next build` hace comprobaciones propias de Next (exports válidos de `route.ts`) que `make validate` no ejecuta: solo las cubren el build de la imagen y la CI de TASK-006 si incluye `build`.
- **R15** — `turbo.json` declara `outputs: ["dist/**"]` para `build`. Si alguien ejecuta `pnpm build` (turbo), `web#build` avisará de que no encuentra salidas y no cacheará `.next`. Nada lo ejecuta en M0. Si TASK-006 lo usa en CI, añade `.next/**` y `!.next/cache/**`.

## Deuda propuesta (la registra el Orchestrator)

- TD-009 → PAID (TASK-007). TD-010 → PAID (TASK-007): `next.config.ts` con `tsconfig.config.json`, `rootDir` intacto.
- **webpack en lugar de Turbopack** (OD-039 a, decidida). LOW. Se paga en TASK-040: cuando Next resuelva `.js → .ts` en Turbopack (vercel/next.js#82945), quitar `--webpack` y `webpack()` de `next.config.ts`; o aplicar la opción (b) de OD-039.
- **`sharp`/`libvips` trazados en la imagen de `web` sin uso** (decisión humana). LOW. Se paga en TASK-040: `next` los instala como opcionales; excluirlos (con `pnpm deploy` o `images.unoptimized`) hasta que se usen.
- OD-042 no genera tarea fix: el plan B quedó descartado (sección «Plan B anterior: descartado»).

## DoD complementario propuesto (texto para TASKS.md; lo aplica el Orchestrator)

Las viñetas actuales se mantienen. Se añaden:

- `Dependencias exactas, sin ^: next 16.4.2, react 19.3.0, react-dom 19.3.0 (dependencies de apps/web); tailwindcss 4.3.3, @tailwindcss/postcss 4.3.3, @types/react 19.3.0, @types/react-dom 19.3.0 (devDependencies de apps/web); pnpm install --frozen-lockfile sin avisos de peers (OD-042).`
- `pingDatabase(pool, { timeoutMs }) en persistence: plazo único que cubre conexión y consulta, cliente destruido al vencer o fallar, nunca lanza; test de integración arriba, puerto cerrado, servidor que no contesta (reloj falso) y consulta colgada tras conectar.`
- `La imagen de web parte de output: "standalone": sin pnpm, corepack, npm, npx ni yarn, sin fuentes .ts, uid 1000; install con --frozen-lockfile --offline --ignore-scripts y build con RUN --network=none; un lockfile alterado hace fallar el build (ADR-012).`
- `Prueba de canarios (*.pem, *.key, .env*, *.env, .envrc en varios niveles): ninguno en el stage build ni en la imagen de web.`
- `web en compose: sin perfil, cap_drop [ALL], no-new-privileges, init: true, redes backend + egress, 127.0.0.1:3000; con db en pausa, /api/health responde 503 entre 2,0 s y 2,5 s.`
- `HOST_TAR excluye .next; make test y make validate probados en macOS y Linux.`

## OPEN DECISIONS

OD-039…OD-046: resueltas el 2026-10-21 (literal en «Decisiones humanas»; registro en SPEC §13). Se conserva el análisis. OD-042 con su resolución final y OD-047 cerrada sin efecto (2026-10-21). Abiertas: ninguna.

**OD-039 — [RESUELTA 2026-10-21: (a)] Bundler de `web` frente a los imports `.js` de los paquetes del workspace.** Turbopack no resuelve `./x.js` a `./x.ts` (V3).
- (a) **webpack** (`--webpack` + `extensionAlias`). Sin cambios fuera de `apps/web`; validado (V4, V11, V12). Contras: R1.
- (b) **Turbopack + imports relativos sin extensión** en `core`, `persistence` y, por coherencia, `worker` (≈145 líneas en 50 ficheros), más una regla `no-restricted-syntax` en `eslint.config.js` que impida volver al `.js`. Validado el build (V5). Más rápido y es el bundler por defecto. Contras: amplía el scope a core-dev, persistence-dev, engine-dev y la raíz; hay que comprobar `drizzle-kit` y `tsx` con imports sin extensión.
- (c) Loader de Turbopack que quita el `.js`: rodeo no documentado, sin `import()` dinámico.
- **Recomendación: (a)**, con la deuda LOW de arriba. Mantiene el scope cerrado y se revierte con dos líneas.

**OD-040 — [RESUELTA 2026-10-21: (a), con sub-export `/migrate`] `new URL("../migrations", import.meta.url)` rompe el bundle de `web`** (V4, V5).
- (a) **Quitar `runMigrations` del índice público** de `persistence`. Solo lo usan `cli/migrate.ts` y `testing/reset.ts`, que lo importan por ruta relativa.
- (b) `migrationsFolder` obligatorio y la ruta por defecto en un módulo que solo importan `cli` y `testing`.
- (c) Sub-export `@agentlab/persistence/migrate`: amplía la lista cerrada de sub-exports de monorepo-conventions.
- **Recomendación: (a)**. Es lo mínimo, encaja con «sin métodos que nadie consuma» (OD-025) y está validada.

**OD-041 — [RESUELTA 2026-10-21: (a)] Ubicación del App Router.** SPEC §8 dice `apps/web/app/api/**`; el DoD de TASK-007 y TD-010 exigen mantener `rootDir: src`.
- (a) **`apps/web/src/app`**. Cambia el texto de SPEC §8 y los scopes de TASK-014 (`apps/web/app/api/runs/**`, `apps/web/lib/api/**`), TASK-016, TASK-020, TASK-024, TASK-025, TASK-028, TASK-032 y TASK-034 (`apps/web/app/…`, `apps/web/components/**` → `apps/web/src/…`). También el de TASK-039: `apps/web/middleware.ts` pasa a `apps/web/src/proxy.ts`, porque Next 16 renombró `middleware` a `proxy`.
- (b) `apps/web/app` y quitar `rootDir` en `web`: contradice el DoD y la Verificación de ADR-001 que motivó TD-010.
- **Recomendación: (a)**. El architect actualiza SPEC §8 y el Orchestrator los scopes.

**OD-042 — [RESUELTA 2026-10-21: (a) para `next`; `react`/`react-dom` sin excepción] Versiones con menos de dos semanas.**
- **Resolución final** (decisión humana tras el veredicto de security, literal en «Decisiones humanas»): `next 16.4.2` **con la excepción concedida**; `react`/`react-dom 19.3.0` y `@types/react`/`@types/react-dom 19.3.0` **sin excepción**. Avisos citados (identificador, URL, fecha, versión vulnerable y parche) en «Avisos de seguridad (veredicto de security, 2026-10-21)».
- **Corrección del análisis original**: decía que `next 16.4.2` y `react`/`react-dom 19.3.1` «corrigen» los avisos. Según security, el parche de `next` es 16.4.1 (16.4.2 contiene los arreglos, pero no es una versión de seguridad) y ningún aviso afecta a `react`/`react-dom`: 19.3.1 no es un parche. Los avisos de React afectan a `react-server-dom-*`, que `next ≥ 16.4.1` lleva corregido (R2).
- Opciones originales: (a) excepción para `next 16.4.2`, `react 19.3.1` y `react-dom 19.3.1`; (b) regla estricta (`next 16.4.0` + `react 19.3.0`), descartada porque `next 16.4.0` es vulnerable (CRITICAL); (c) `next 16.4.1` (7 días): tampoco cumple las dos semanas y contradice ARCHITECTURE §9.

**OD-043 — [RESUELTA 2026-10-21: (a)] Qué es `version` en `/api/health`.**
- (a) **`version` de `apps/web/package.json`** embebido en el build (hoy `"0.0.0"`; V12).
- (b) SHA de git por `--build-arg`: el contexto no tiene `.git` (ADR-011) y habría que pasarlo desde el Makefile y desde compose.
- (c) Variable de entorno nueva en `core/env.ts`: una variable más que mantener a mano.
- **Recomendación: (a)**.

**OD-044 — [RESUELTA 2026-10-21: (a)] Logger de `web` en M0.**
- (a) **Ninguno.** El handler no registra nada. La base caída ya la registra el worker. El entorno inválido sale como 500 de Next, que lo registra sin valores (V13). `pingDatabase` devuelve `boolean`.
- (b) Duplicar el logger de `apps/worker` (`pino 10.4.0` en `apps/web`, el mismo `redact` y el mismo serializador `err`, con su test de canarios). Con (b), el handler registra `warn` con `reason`/`code` y devuelve 500 `{ code, message }` (ARCHITECTURE §7) para el entorno inválido. Código duplicado hasta `observability` (TASK-027).
- (c) Mover el logger a un paquete compartido: ROADMAP no asigna ningún paquete nuevo a M0 (monorepo-conventions) y `core` no admite dependencias salvo `zod` (TASK-004).
- **Recomendación: (a)**. TASK-014, la primera tarea con errores 500 propios, decide entre (b) y adelantar `observability`.

**OD-045 — [RESUELTA 2026-10-21: (a)] Ampliación del scope de TASK-007.** Las rutas ✱ de «Scope final»: cinco ficheros de `packages/persistence/src/` (persistence-dev), `pnpm-lock.yaml`, `.dockerignore` y `.gitignore` (devops), más la reasignación de `apps/web/package.json` a devops y de `docker/web.Dockerfile`, `compose.yaml` y `Makefile` a devops (ya en el scope de la tarea, fuera del rol de web-dev).
- (a) Aprobar la tabla tal cual.
- (b) Sacar `persistence` a una tarea previa.
- **Recomendación: (a)**. Sin `pingDatabase` el DoD («sin SQL inline») no se cumple, y sin `.dockerignore` la imagen no compila (V11).

**OD-046 — [RESUELTA 2026-10-21: (a)] `/projects` en M0.** El DoD pide enlazar a `/projects`, pero ARCHITECTURE §7 lista `/` como pantalla de proyectos y `/projects/:id`, sin `/projects`, y ninguna tarea crea esa ruta de forma explícita (TASK-020 y TASK-034 tienen `apps/web/app/(app)/projects/**` en su scope).
- (a) **Aceptar el 404** por defecto de Next en M0 y que la tarea que cree las pantallas de proyectos (TASK-020 o TASK-034) añada `/projects` o corrija ARCHITECTURE §7. El texto del enlace sería `Projects`, en inglés como el resto del código, porque nada fija el idioma de la UI.
- (b) Una página `/projects` provisional: crea una ruta que nadie ha especificado.
- **Recomendación: (a)**.

**OD-047 — [CERRADA SIN EFECTO 2026-10-21] Veredicto parcial de security sobre OD-042.** La premisa de OD-042 (19.3.1 como parche) era falsa: no hubo veredicto parcial sobre `react`/`react-dom`, sino ningún aviso que los afecte, y R2 quedó verificado. Se conserva el análisis original:
- Granularidad: los avisos de `next` y los de React son independientes. ¿Plan B para todo si falla uno, o solo para el paquete que falle? `next 16.4.2` con `react`/`react-dom 19.3.0` es compatible por peers (`^19.0.0`).
- R2: si los avisos se verifican pero no la copia de RSC dentro de `next`, el plan B (`next 16.4.0`) lleva una copia más antigua: no reduce el riesgo de R2, lo aumenta.
- Opciones:
  - (a) **Por paquete, y R2 sin verificar no activa el plan B de `next`**: R2 queda como riesgo abierto con tarea fix si se confirma; la exposición es `127.0.0.1`.
  - (b) En bloque: cualquier hueco (R2 incluido) → plan B completo.
  - (c) Por paquete, pero R2 sin verificar → plan B de `next`.
- **Recomendación: (a)**. (b) y (c) cambian versiones parcheadas por vulnerables por algo que no se ha podido medir.

## Pendiente en TASKS.md (lo corrige el Orchestrator)

OD-041 (a) mueve todo `apps/web` bajo `src` porque `rootDir: "src"` + `include: ["src"]` dan TS6059 a cualquier fichero de `apps/web` fuera de `src` que importe la app. Las rutas `app/` ya están corregidas (TASK-014, 016, 020, 024, 025, 028, 032, 034). Quedan las que el texto de OD-041 (a) de este plan también citaba:
- TASK-014: `apps/web/lib/api/**` → `apps/web/src/lib/api/**`.
- TASK-016 y TASK-028: `apps/web/components/**` → `apps/web/src/components/**`.
- TASK-024: `apps/web/components/run-timeline/**` → `apps/web/src/components/run-timeline/**`.
- TASK-039: `apps/web/middleware.ts` → `apps/web/src/proxy.ts` (Next 16 renombró `middleware` a `proxy`).

## Fuentes (consultadas el 2026-10-21)

- npm registry: `npm view <pkg> time --json` de `next`, `react` y `react-dom` (plan B) y `npm view next@16.4.0 peerDependencies engines.node optionalDependencies`, `npm view react-dom@19.3.0 peerDependencies dependencies`; `npm view` de `next`, `react`, `react-dom`, `tailwindcss`, `@tailwindcss/postcss`, `@tailwindcss/oxide`, `postcss`, `@types/react`, `@types/react-dom`, `sharp` (dist-tags, time, peerDependencies, engines, dependencies, scripts).
- Avisos: `gh api /repos/facebook/react/security-advisories` (GHSA-xqc2-xf4c-x3h3, GHSA-h3gv-c5rc-p453) y `gh api /repos/vercel/next.js/security-advisories` (GHSA-2464-fhr4-w9xw, GHSA-673q-mjm6-r5xr, GHSA-p3m5-59mp-jv5r). Verificación de security con `gh api /repos/<owner>/<repo>/security-advisories/<id>`: las URL de la tabla «Avisos de seguridad» (las de React, bajo `github.com/react/react`, como las devuelve la API). Releases: https://github.com/facebook/react/releases, https://github.com/vercel/next.js/releases
- Turbopack sin `extensionAlias`: https://github.com/vercel/next.js/issues/82945 (abierta; PR #95426) y https://nextjs.org/docs/app/api-reference/turbopack (lastUpdated 2026-10-06; `--webpack`, `resolveAlias`, `resolveExtensions`).
- `output: "standalone"`, `outputFileTracingRoot`, `server.js`, `HOSTNAME`/`PORT`: https://nextjs.org/docs/app/api-reference/config/next-config-js/output (lastUpdated 2026-09-18).
- TypeScript en Next (`tsc` en el build, `next-env.d.ts` en `.gitignore`, `tsconfigPath`, `next.config.ts` con ESM): https://nextjs.org/docs/app/api-reference/config/typescript (lastUpdated 2026-08-25).
- Copia de RSC en `next`: https://unpkg.com/next@16.4.2/dist/compiled/react-server-dom-webpack/package.json (no sirve como indicador); comparación de código de `next` 16.4.0, 16.4.1 y 16.4.2 hecha por security (R2).
- Señales de Next: `next/dist/server/lib/start-server.js` de `next@16.4.2` (leído dentro de la imagen de prueba).
- Publicación de puertos con redes `internal`: https://docs.docker.com/engine/network/port-publishing/ e hilo https://forums.docker.com/t/port-expose-not-possible-without-network-which-is-not-internal/93395 (no hay frase explícita en la documentación oficial; devops lo verifica).

## Resultado de la verificación (2026-10-21)

Primera verificación: tester PASS (503 en 2,018–2,034 s), reviewer APPROVED (2 MINOR, 3 NIT), security APPROVED (7 LOW + 1 MEDIUM). La protección `Host`/`Origin`/cabeceras (MEDIUM) pasa a ser requisito del DoD de TASK-014 (decisión humana). Dos ciclos de corrección:

- **Ciclo 1/3.** persistence-dev: el test de exports de `persistence` compara el mapa `exports` exacto (`toEqual`) y comprueba que cada destino existe (`existsSync`); falla con un sub-export ficticio. web-dev: `images: { unoptimized: true }` en `apps/web/next.config.ts` (no carga `sharp` en runtime; R3). Re-verificación del tester: FAIL, porque `/_next/image` respondía 404 pero dejaba un `unhandledRejection` `EACCES mkdir '/app/apps/web/.next/cache'` por petición (R4).
- **Ciclo 2/3.** devops: `tmpfs` en `compose.yaml` para `/app/apps/web/.next/cache` (uid 1000, `0700`, 64m); la imagen sigue sin nada escribible en `/app`. Consecuencia en ADR-012: «la imagen de web requiere un tmpfs en .next/cache; compose lo provee». El tester comprueba 20 peticiones a `/_next/image` con 404 y log limpio; security vuelve a verificar que nada es escribible en `/app` en la imagen final.

Diferencias con este plan: la decisión 3 gana `images: { unoptimized: true }`; la decisión 10 gana el `tmpfs` (sigue sin `read_only`, que va a TASK-037); R4 deja de ser hipotético (Next escribe en `.next/cache` aunque M0 no use ISR ni `next/image`). ARCHITECTURE §1, §2, §7 y §9, ADR-012 (Consecuencias), ADR-009 §5 (anotación) y SPEC §8 quedan alineados con lo verificado.
