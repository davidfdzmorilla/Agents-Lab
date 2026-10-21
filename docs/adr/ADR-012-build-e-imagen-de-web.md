# ADR-012 — Build e imagen de `apps/web`: Next.js `standalone` con webpack

| Campo | Valor |
|---|---|
| Estado | Accepted (2026-10-21, responsable humano; OD-039 a, OD-040 a) |
| Fecha | 2026-10-21 |
| Decisores | Responsable humano · architect |
| Relacionado | ARCHITECTURE §1, §2, §7, §9; ADR-001; ADR-009 §5 (anotado: precisado por este ADR); ADR-011; TASK-007 (`docs/reports/TASK-007-plan.md`, OD-039, OD-040, OD-042, OD-047); TECHNICAL_DEBT TD-010 |

> **Aceptación (2026-10-21), condición del responsable humano:** web es el único servicio que no termina con 0 bajo SIGTERM (143 por diseño de Next); el DoD de TASK-007 lo documenta y no se trata como fallo.
>
> **Versiones (OD-042 resuelta, 2026-10-21):** `next 16.4.2` **con excepción** a la regla de las dos semanas (publicada el 2026-10-15); `react`/`react-dom 19.3.0` y `@types/react`/`@types/react-dom 19.3.0` **sin excepción**. La excepción se apoya en estos avisos, verificados por `security` con `gh api /repos/<owner>/<repo>/security-advisories/<id>` (todos `state: published`):
>
> | ID | Publicado (UTC) | Versión vulnerable → parche |
> |---|---|---|
> | [GHSA-2464-fhr4-w9xw](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw) (CVE-2026-96889, critical) | 2026-10-14T17:46:48Z | `next` `>16.0.0 <=16.4.0` → 16.4.1 |
> | [GHSA-673q-mjm6-r5xr](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr) (critical) | 2026-10-14T17:47:07Z | `next` `>=16.0.0 <=16.4.0` → 16.4.1 |
> | [GHSA-p3m5-59mp-jv5r](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r) (high) | 2026-10-14T17:47:43Z | `next` `>=16.0.0 <=16.4.0` → 16.4.1 |
> | [GHSA-xqc2-xf4c-x3h3](https://github.com/react/react/security/advisories/GHSA-xqc2-xf4c-x3h3) (critical) | 2026-10-14T17:08:26Z | `react-server-dom-*` 19.3.0 → 19.3.1 (y 19.0.9 / 19.1.10 / 19.2.9); en `web` llega como copia compilada dentro de `next`, corregida desde `next` 16.4.1 |
> | [GHSA-h3gv-c5rc-p453](https://github.com/react/react/security/advisories/GHSA-h3gv-c5rc-p453) (high) | 2026-10-14T17:08:23Z | Ídem |
>
> `next 16.4.0` (2026-10-06), la última 16.x con más de dos semanas, es vulnerable. 16.4.1 es el parche; 16.4.2 no es una versión de seguridad, pero contiene los arreglos. Ningún aviso afecta a `react`/`react-dom`, así que 19.3.1 no es un parche. Detalle (incluida la comprobación de la copia de RSC dentro de `next`) en el plan de TASK-007, «Avisos de seguridad» y R2. V1–V14 se hicieron con `react`/`react-dom 19.3.1`: las pruebas de instalación, build e imagen se repiten con 19.3.0 en TASK-007. La decisión no depende de la versión.

## Contexto

`apps/web` es la primera app que consume los paquetes del workspace (`@agentlab/core`, `@agentlab/persistence`) a través de un bundler. Esos paquetes exportan `./src/index.ts` sin build (ADR-001) y sus imports relativos llevan sufijo `.js` (`export * from "./errors.js"`), que `tsc` (`moduleResolution: bundler`), `tsx` y Vitest resuelven al `.ts`. ADR-009 §5 dio por hecho que «Next resuelve los paquetes `.ts` del workspace (`transpilePackages` / Turbopack, TASK-007)».

ADR-011 fija cómo se construyen `worker` y `migrate` (`pnpm deploy`), pero no cubre `web`.

Pruebas del 2026-10-21 en el scratchpad (copia filtrada del repo sin `.env`, `node:22.23.3-bookworm-slim` fijado por digest, pnpm 9.15.9, PostgreSQL 16.15 desechable en una red propia; nada instalado en el repo). Detalle en el plan de TASK-007 (V1–V14):

1. `next build` con Turbopack (el bundler por defecto de Next 16) **falla**: `Module not found: Can't resolve './team-definition.js'` en `packages/core/src/index.ts`. Turbopack no tiene equivalente a `resolve.extensionAlias` de webpack (vercel/next.js#82945, abierta; PR #95426 sin fusionar, consultado el 2026-10-21).
2. Con webpack (`next build --webpack`) y `extensionAlias: { ".js": [".ts", ".tsx", ".js"] }` compila. Turbopack también compila si los imports relativos de `core` y `persistence` se escriben sin extensión.
3. Con los dos bundlers, importar `@agentlab/persistence` falla mientras su `index.ts` reexporte `runMigrations`: `migrate.ts` declara `new URL("../migrations", import.meta.url)` a nivel de módulo y el bundler lo trata como un asset (`Can't resolve '../migrations'`). Sin ese export, compila (OD-040).
4. `output: "standalone"` con `outputFileTracingRoot` en la raíz del monorepo produce `.next/standalone` (71 MB): `apps/web/server.js`, un `node_modules/.pnpm` con 21 entradas (next, react, react-dom, sharp…), solo los `package.json` de `packages/*` (el código de los paquetes va dentro del bundle) y ningún `.ts`.
5. La imagen se construye con `pnpm install --frozen-lockfile --offline --ignore-scripts` sobre el store de `pnpm fetch` y `RUN --network=none pnpm --filter web build`: el build no necesita red ni scripts de instalación. La imagen final no tiene `pnpm`, `corepack`, `npm`, `npx` ni `yarn` y corre como uid 1000.

## Decisión

1. **Bundler: webpack** (`next dev --webpack`, `next build --webpack`) con `extensionAlias` para `.js → .ts/.tsx/.js` en `next.config.ts`. Los paquetes del workspace no cambian su convención de imports. Se vuelve a Turbopack cuando Next ofrezca la resolución equivalente (deuda LOW, se revisa en TASK-040). *(OD-039 a, 2026-10-21: «Turbopack cuando resuelva los imports .js→.ts del workspace; deuda LOW a revisar en TASK-040».)*
2. `transpilePackages: ["@agentlab/core", "@agentlab/persistence"]` (y los paquetes `@agentlab/*` que `web` importe en el futuro). Precisa ADR-009 §5: Next resuelve los paquetes `.ts` del workspace con `transpilePackages` y **webpack**, no con Turbopack.
3. **Imagen `web` con `output: "standalone"`**, no con `pnpm deploy`:
   - `deps`: `pnpm fetch --ignore-scripts` (igual que `docker/worker.Dockerfile`).
   - `build`: copia el contexto, `pnpm install --frozen-lockfile --offline --ignore-scripts --filter web...` y `RUN --network=none pnpm --filter web build`. El `--frozen-lockfile` cumple de forma nativa la condición 1 de ADR-011: si un manifiesto no coincide con el lockfile, el build falla.
   - `slim`: Node fijado por digest sin `npm`, `npx`, `corepack` ni `yarn` (mismo patrón que ADR-011).
   - `runtime`: copia `.next/standalone` y `.next/static`; `USER node`; `ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000`; `CMD ["node", "apps/web/server.js"]`. Bajo `init: true` en compose.
4. `.dockerignore` reincluye `tsconfig.base.json` (lo extiende `apps/web/tsconfig.json`; `next build` hace la comprobación de tipos con `tsc`). Ninguna exclusión cambia.
5. Ningún stage de `web` parte de los de `docker/worker.Dockerfile` ni al revés (son Dockerfiles distintos).

## Alternativas consideradas
| Alternativa | Por qué se descarta |
|---|---|
| Turbopack + imports relativos sin extensión en `core`, `persistence` (y `worker`, por coherencia) + regla de ESLint que lo imponga | Compila (prueba 2) y es más rápido (≈9 s frente a ≈35 s), pero obliga a reescribir ≈145 imports de tres workspaces fuera del scope de una tarea de `web` y a cambiar la configuración de ESLint de la raíz. Es la opción (b) de OD-039 |
| Loader de Turbopack que quita el `.js` de los imports (`turbopack.rules`) | Rodeo no documentado; no cubre `import()` dinámico (vercel/next.js#82945) |
| `pnpm deploy` de `web` (ADR-011) y `next start` | `deploy` necesita red con el contexto copiado (ADR-011, R1) y deja en la imagen todo `node_modules` de producción: los binarios `@next/swc-*` (solo de build), `sharp` y los `.ts` de los paquetes inyectados. Además el build tendría que correr dentro del directorio desplegado |
| `serverExternalPackages: ["@agentlab/persistence"]` | Node cargaría `.ts` en runtime sin `tsx`: no arranca |
| `typescript.ignoreBuildErrors` para no necesitar `tsconfig.base.json` en el contexto | Quita la comprobación de tipos del build de la imagen |

## Consecuencias
- Positivas: la imagen final solo lleva el servidor trazado, sus dependencias y los estáticos; sin gestores de paquetes, sin devDependencies, sin fuentes `.ts`. El build de la aplicación (Next, Tailwind, `tsc`) corre sin red. No hace falta tocar la convención de imports de los paquetes.
- Negativas:
  - webpack es más lento que Turbopack y Next 16 lo mantiene como opción (`--webpack`), no como bandera por defecto. Deuda LOW, TASK-040. Si una versión futura lo retira antes de que Turbopack resuelva `.js → .ts`, hará falta la opción (b) de OD-039.
  - `sharp` y sus `libvips` (≈36 MB) entran en la imagen aunque M0 no usa `next/image`, porque Next los traza. Con `images: { unoptimized: true }` (`apps/web/next.config.ts`, TASK-007) no se cargan en runtime, pero siguen en la imagen. Deuda LOW, TASK-040 (security LOW-2): `next` los instala como opcionales; se excluyen de la imagen hasta que se usen.
  - Los ficheros de la imagen son de root y el proceso (uid 1000) no puede escribir en `/app`. **La imagen de web requiere un tmpfs en .next/cache; compose lo provee** (decisión humana, TASK-007): `compose.yaml` monta `/app/apps/web/.next/cache` como `tmpfs` (uid 1000, `0700`, 64m), porque compose es la unidad de despliegue (ARCHITECTURE §1). Aunque M0 no tiene ISR ni usa `next/image`, Next necesita escribir ahí: incluso con `images.unoptimized: true`, instancia `ImageOptimizerCache` antes de responder 404 en `/_next/image` (`next/dist/server/next-server.js:183-187` y `:193`, `next@16.4.2`, leído por security).
  - Las claves de preview y la `encryptionKey` se generan en el build y quedan dentro de la imagen (security LOW-5). Sin impacto mientras no haya Server Actions ni Draft Mode y la imagen no se publique. Deuda LOW, TASK-040.
  - `docker compose stop web` termina con código 143: Next 16.4.2 sale con `128 + 15` tras su limpieza (`next/dist/server/lib/start-server.js`).
  - `runMigrations` deja de exportarse desde el índice de `@agentlab/persistence` y se importa desde el sub-export explícito `@agentlab/persistence/migrate` (`"./migrate": "./src/migrate.ts"`, como `/testing`; OD-040 a). `web` no lo importa.

## Verificación
- `docker build -f docker/web.Dockerfile --target runtime .` sin `DATABASE_URL`; el paso de build con `--network=none`.
- `docker run --rm --entrypoint sh <imagen web> -c 'id -u; command -v pnpm corepack npm npx yarn'` → `1000` y nada; `find /app -name '*.ts' ! -name '*.d.ts'` vacío.
- Canarios `*.pem`, `*.key`, `.env*`, `*.env` y `.envrc` en la raíz, `apps/web`, `apps/web/src/app`, `packages/core/src` y `packages/persistence`: ninguno en el stage `build` ni en la imagen final.
- Lockfile alterado en una copia → el build falla con `ERR_PNPM_OUTDATED_LOCKFILE`.
- `docker compose up --build -d` → `curl 127.0.0.1:3000/api/health` = 200 `{"ok":true,"db":"up","version":"0.0.0"}`; con `db` en pausa, 503 en ≈2 s.
