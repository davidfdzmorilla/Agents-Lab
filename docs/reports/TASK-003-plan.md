# PLAN — TASK-003 · Docker Compose: web, worker, db (+ perfil local con ollama)

| Campo | Valor |
|---|---|
| Autor | architect |
| Fecha | 2026-10-20 (ajustado el 2026-10-21 tras la decisión humana) |
| Owner de la implementación | devops |
| Estado | Aprobado por el humano (2026-10-21) con las decisiones de abajo. Quedan abiertas OD-G y OD-H, que no bloquean (hay recomendación) |

## Decisiones humanas (2026-10-21, literal)

> A  web: (a) — "Compose sirve /api/health en 3000" y el Dockerfile de web pasan a TASK-007. worker: (b) — TASK-003 incluye apps/worker/src/index.ts provisional (log de arranque, espera SIGTERM, sale con 0); añádelo al scope. Un contenedor que no se mantiene arriba no verifica nada; el apagado real sigue en TASK-008.
> B  (a). .env.example con POSTGRES_PASSWORD y DATABASE_URL(_TEST) vacíos y obligatorios en compose; LANGCHAIN_TRACING_V2=false. README: cp .env.example .env y rellenar antes de make up.
> C  127.0.0.1:3000.
> D  init: true. Una línea en ADR-009 (architect) : tsx es el proceso de la aplicación bajo tini.
> E  (a). TASK-005 recibe turbo.json y Makefile en scope.
> F  Sí, con .gitignore en scope.
> Riesgos:
> - Migraciones en make up: decidido. TASK-005 añade a compose un servicio one-shot `migrate` (depends_on db healthy, ejecuta pnpm db:migrate y sale); web y worker dependen de que termine. TASK-003 deja el hueco documentado en el plan, no lo implementa.
> - Superusuario de PostgreSQL: deuda LOW, se paga en TASK-037 (usuario de aplicación sin DDL; las migraciones con otro rol).
> - ollama como root: deuda LOW, se paga en TASK-021.
> - make validate y node_modules: no acepto que sustituya los binarios del host. DoD de TASK-003: el contenedor de validación monta node_modules en un volumen con nombre propio (y el store fuera del repo); el node_modules del host no se toca. Que devops lo verifique con un fichero centinela.
> - pre-commit y URLs con contraseña: ya exento .env.example; con los valores vacíos de B no aplica.
> Plan aprobado con esto.

Qué cambia respecto a la versión del 2026-10-20:
- `docker/web.Dockerfile` sale del scope (pasa a TASK-007). `web` queda definido en `compose.yaml` detrás del perfil `web` (OD-G).
- Entra `apps/worker/src/index.ts` provisional (OD-H, para el log de arranque).
- Entra `.gitignore`, con `compose.override.yaml`.
- `make validate` deja de tocar el repo del host: monta el repo en solo lectura, trabaja sobre una copia dentro del contenedor y usa volúmenes con nombre para `node_modules` y el store.
- ADR-009: tsx ya no es PID 1, es el proceso de la aplicación bajo tini (línea añadida en Consecuencias).

## Contexto

Hoy `apps/web` y `apps/worker` son placeholders (`export {};`) sin scripts `start`. No hay `compose.yaml`, Dockerfiles, `init.sql` ni `.dockerignore`. `.env.example` tiene 12 de las 13 variables de `packages/core/src/env.ts` (falta `LANGCHAIN_TRACING_V2`) y trae `agentlab:agentlab` en las URLs de PostgreSQL.

TASK-003 deja montado el entorno: imagen multi-stage del worker, red interna, base de datos con dos bases, perfil `local` con Ollama, `make validate` (TD-008) sin efectos en el host, `tsx` declarado (ADR-009) y un worker provisional que se mantiene arriba hasta `SIGTERM`. Web queda declarado pero inactivo hasta TASK-007.

## Validación previa del architect (2026-10-20, fuera del repo)

Hice una copia del repo en el scratchpad de la sesión, sin `node_modules`, `.git` ni `.env*`. Probé con Docker Engine 29.8.2 y Compose v5.5.0 (darwin/arm64), usando los borradores de este plan. Resultados:

- `pnpm fetch --prod` con solo `pnpm-lock.yaml`, `pnpm-workspace.yaml` y `.npmrc`, seguido de `pnpm install --offline --frozen-lockfile --prod --filter <app>...`, funciona con pnpm 9.15.9 vía corepack. La imagen ocupa unos 378 MB.
- Usuario `node` (uid 1000) en runtime. `/app` es de root, así que el proceso no puede escribir en el código.
- Con `COREPACK_HOME=/opt/corepack` y `COREPACK_ENABLE_NETWORK=0`, `pnpm` funciona en runtime como usuario no root y sin red.
- Redes. La red `backend` tiene `internal: true` y contiene `db`; ahí `db` no resuelve DNS externo.
- **Hallazgo 1:** un puerto publicado en un servicio que solo está en una red `internal` se ignora sin aviso. Por eso el override tiene que añadir `db` a `egress`.
- `init.sql` con `\gexec` idempotente y `POSTGRES_DB: postgres` crea `agentlab` y `agentlab_test`. El healthcheck `pg_isready -h 127.0.0.1` solo da *healthy* cuando el init ha terminado.
- Apagado con `init: true` y `stop_grace_period: 40s`, con un script sustituto en node (no en tsx). Si atiende `SIGTERM` y sale, el contenedor sale con 0. Sin handler sale con 143. Si ignora `SIGTERM`, se mata a los 40 s con 137.
- **Hallazgo 2:** `docker compose down` sin perfil **no** elimina los contenedores de servicios con perfil. `docker compose --profile '*' down` sí lo hace.
- **No probé `tsx`** (el hook bloqueó `pnpm add` con `deps_allowed` vacío). El 2026-10-21 tampoco pude probar el perfil `web` con el Dockerfile ausente, porque el hook bloquea ahora escribir en el scratchpad. No lo rodeé. devops lo verifica (tests 3 y 4).

Fuentes, consultadas el 2026-10-20 salvo que se diga otra fecha:
- Docker Hub API v2 (`/v2/repositories/{library/node,library/postgres,ollama/ollama}/tags`): etiquetas y digests.
- `tsx` `src/cli.ts`, rama master: reenvía `SIGINT`/`SIGTERM` al hijo y sale con su código.
- pnpm docs `cli/fetch`: `fetch` solo necesita el lockfile y `pnpm-workspace.yaml`; después va `install --offline`.
- Turborepo docs "Using environment variables": el modo *strict* es el modo por defecto.
- Docker docs "Using profiles with Compose" (docs.docker.com/compose/how-tos/profiles, 2026-10-21). Los servicios con perfil solo arrancan si el perfil está activo, `--profile "*"` activa todos, y nombrar un servicio con perfil lo arranca aunque su perfil no esté activo.

## Versiones e imágenes (verificadas en Docker Hub el 2026-10-20)

| Uso | Referencia exacta | Nota |
|---|---|---|
| Node (`worker.Dockerfile`, `make validate` y `make test`) | `node:22.23.3-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392` | Último 22.x (2026-10-06), dentro de `>=22.12 <23`. Índice multi-arch |
| PostgreSQL | `postgres:16.15-trixie@sha256:ca0bd484cb98bf4b24eb1010e73fb3fcbd6714d240fbc1a10eea5b7dbecb641d` | Último 16.x (2026-10-07) |
| Ollama | `ollama/ollama:0.40.6@sha256:265409e1d931028a8f7d5a32bcbafddd7bffbc6cc629d77efe9560adf692a5e7` | Último estable (2026-10-17). El modelo no se fija aquí (OD-005, M2) |
| pnpm | `9.15.9` (corepack) | ARCH §9, `packageManager` |
| tsx | `4.23.15` exacta | ADR-009 |

Antes de escribir los digests, devops los confirma con `docker buildx imagetools inspect <tag>` (digest del índice, no el de una plataforma). TASK-007 reutiliza la misma referencia de Node en `web.Dockerfile`.

## Decisiones (cada una con la alternativa que descarto)

1. **Etiqueta exacta y digest** en todas las imágenes. Descarto `node:22` flotante porque no es reproducible. Coste: actualizar el digest en `worker.Dockerfile` y en el `Makefile` (y en `web.Dockerfile` desde TASK-007).
2. **Store de pnpm en una capa de la etapa intermedia.** `fetch` se cachea por capa y solo se invalida si cambia el lockfile; después va `install --offline`. Descarto el *cache mount* de BuildKit: si se purga el mount con la capa de `fetch` en caché, `install --offline` falla.
3. **Etapas `base → deps → prod → runtime`** en `worker.Dockerfile`. Descarto una etapa `build` porque el worker no tiene build en v1 (ADR-009 §6).
4. **Worker: `CMD ["tsx", "src/index.ts"]`, `init: true`** (decisión D). tini es PID 1 y `tsx` es el proceso de la aplicación bajo tini. `WORKDIR /app/apps/worker` y `PATH` con `node_modules/.bin`. Descarto `pnpm start`, porque los scripts los define TASK-008 y pnpm como intermediario complica las señales.
5. **Worker provisional en `apps/worker/src/index.ts`** (decisión A-b): registra el arranque, mantiene el bucle de eventos vivo con un `setInterval` y, con `SIGTERM` o `SIGINT`, lo limpia, registra la parada y deja que el proceso termine solo con código 0. No usa `process.exit`, no lee `process.env` (convención: solo `@agentlab/core`) y no tiene estado de módulo: todo vive dentro de `main()`. Descarto `process.exit(0)` en el handler porque cortaría la salida pendiente de stdout. El log se describe en el paso 4 (OD-H).
6. **`web` en `compose.yaml` detrás de `profiles: ["web"]` hasta TASK-007** (OD-G). Queda declarado completo (build con `docker/web.Dockerfile`, puerto `127.0.0.1:3000:3000`, redes, `depends_on`, variables), pero `docker compose up --build` y `make up` no lo construyen porque su perfil no está activo. Descarto no definirlo hasta TASK-007: incumple la viñeta «define `web`». Descarto un `image:` sustituto con un `command` de espera porque sería un servicio falso con puerto publicado.
7. **Redes.** `backend` tiene `internal: true` y en ella están db, web, worker y ollama. `egress` es un bridge normal, con web (puerto publicado), worker (proveedores en M1) y ollama (`ollama pull`). `db` solo está en `backend`. Descarto la red por defecto porque daría salida a internet a `db`.
8. **Variables explícitas por servicio.** `POSTGRES_PASSWORD`, `DATABASE_URL` y `DATABASE_URL_TEST` van con `${VAR:?…}` (decisión B), y el resto con `${VAR:-}` (`env.ts` trata `""` como ausente). Descarto `env_file: .env` porque pasaría las claves de proveedor a `db` y a `web`.
9. **`stop_grace_period: 40s`** en worker: los 30 000 ms de `SHUTDOWN_GRACE_MS` más 10 s de margen. Un comentario en `compose.yaml` lo enlaza con `SHUTDOWN_GRACE_MS`. Descarto una variable propia porque Compose no permite aritmética.
10. **`init.sql` idempotente con `\gexec`** y `POSTGRES_DB: postgres`. Descarto `CREATE DATABASE` a secas porque falla si la base ya existe.
11. **`make down`, `make logs` y `make ps` con `--profile '*'`** (hallazgo 2). `make up` y `make up-local` siguen sin activar `web` hasta TASK-007.
12. **`make validate` y `make test` sin tocar el host** (riesgo decidido por el humano):
    - El repo se monta en **solo lectura** en `/src`.
    - El contenedor copia el repo a `/work` con `tar` y excluye `node_modules`, `.git`, `.turbo`, `.pnpm-store`, `.env` y `.env.*`.
    - `/work/node_modules` es el volumen con nombre `agentlab-validate-node-modules`.
    - El store vive en el volumen `agentlab-pnpm-store`, montado en `/pnpm-store`, fuera del repo.
    - Los `node_modules` de cada workspace quedan en el sistema de ficheros efímero del contenedor (`--rm`).

    Descarto montar el repo en lectura-escritura con un volumen solo en `node_modules` de la raíz: pnpm reescribiría `apps/*/node_modules` y `packages/*/node_modules` en el host (enlaces Linux y, en Linux, ficheros de root). También descarto un volumen por workspace, porque obliga a mantener la lista a mano cada vez que se añade un paquete. Sin `rm -rf node_modules`: sobre un punto de montaje falla con `EBUSY`, y `pnpm install --frozen-lockfile` ya reconcilia el volumen con el lockfile.
13. **`.dockerignore` excluye `.env` y `.env.*` sin excepciones**, además de `.git`, `**/node_modules`, `.pnpm-store`, `.claude`, `docs`, `**/.turbo`, `**/.next`, `**/dist`, `**/coverage`, `*.log` y `.DS_Store`.

## Hueco documentado: migraciones en `make up` (lo cierra TASK-005)

TASK-003 **no** migra. Tras `make up`, `agentlab` existe vacía. Mientras el worker sea provisional, eso no afecta, porque no consulta la base. TASK-005 añade a `compose.yaml` un servicio one-shot `migrate`: `depends_on: db: { condition: service_healthy }`, ejecuta `pnpm db:migrate` y sale. `web` y `worker` pasan a `depends_on: migrate: { condition: service_completed_successfully }`. Para preparar ese cambio, en TASK-003 `worker` y `web` declaran `depends_on` en forma larga (`db: { condition: service_healthy }`), y un comentario en inglés en `compose.yaml` señala el hueco: `# TASK-005 adds a one-shot "migrate" service; web and worker will depend on it`. La imagen que use `migrate` necesita `drizzle-kit`, que es una dependencia de desarrollo: lo decide TASK-005.

## Pasos (devops)

0. **Orchestrator, antes de lanzar a devops.** En `task-scope.json` va el scope de TASKS.md (ya actualizado) y `deps_allowed: ["tsx"]`.
1. **Declarar `tsx`.** Dentro del contenedor node fijado, con el store en volumen y la misma técnica de solo lectura y copia de la decisión 12, ejecutar `pnpm --filter worker add tsx@4.23.15 --save-exact`. Después se copian de vuelta **solo** `apps/worker/package.json` y `pnpm-lock.yaml`. Si el hook impide copiarlos, devops ejecuta `pnpm` en el host solo para esos dos ficheros y lo reporta. Resultado: `"dependencies": { "tsx": "4.23.15" }`, **sin scripts** (los añade TASK-008). → `apps/worker/package.json`, `pnpm-lock.yaml`
2. **`.dockerignore`** según la decisión 13. **`.gitignore`**: añadir `compose.override.yaml`. → `.dockerignore`, `.gitignore`
3. **`docker/worker.Dockerfile`** → `docker/worker.Dockerfile`
   - Primera línea: `# syntax=docker/dockerfile:1`.
   - `base`: `FROM` la imagen node de la tabla, con `ENV TURBO_TELEMETRY_DISABLED=1 COREPACK_HOME=/opt/corepack COREPACK_ENABLE_DOWNLOAD_PROMPT=0 npm_config_store_dir=/pnpm/store`, `RUN corepack enable && corepack prepare pnpm@9.15.9 --activate` y `WORKDIR /app`.
   - `deps`: `COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./` y `RUN pnpm fetch --prod`.
   - `prod`: `COPY . .` y `RUN pnpm install --offline --frozen-lockfile --prod --filter worker...`.
   - `runtime`: `FROM base`, con `ENV NODE_ENV=production COREPACK_ENABLE_NETWORK=0`, `COPY --from=prod /app /app` (propiedad de root), `USER node`, `WORKDIR /app/apps/worker`, `ENV PATH=/app/apps/worker/node_modules/.bin:$PATH` y `CMD ["tsx", "src/index.ts"]`.
4. **`apps/worker/src/index.ts` provisional** (decisión 5) → `apps/worker/src/index.ts`
   - Una función local `log(msg: string, extra?: Record<string, string>)` escribe **una línea JSON** con `process.stdout.write`, con forma compatible con pino: `{"level":30,"time":<epoch ms>,"name":"worker","msg":…}`.
   - `main()` registra `worker started (provisional)`, arranca `setInterval(() => undefined, 60_000)` y registra `process.once` para `SIGTERM` y `SIGINT`. El handler hace `clearInterval` y registra `worker stopping` con `{ signal }`.
   - Comentario de cabecera en inglés: es provisional y lo sustituye TASK-008.
   - Sin dependencias nuevas, sin `console.*` y sin `process.env` (ver OD-H).
5. **`docker/postgres/init.sql`**: dos sentencias `SELECT 'CREATE DATABASE <db>' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '<db>')\gexec`, para `agentlab` y para `agentlab_test`. Sin usuarios ni contraseñas. → `docker/postgres/init.sql`
6. **`compose.yaml`** → `compose.yaml`
   - Nivel superior: `name: agentlab`.
   - `db`: imagen de la tabla. Variables `POSTGRES_USER: agentlab`, `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set it in .env (cp .env.example .env)}` y `POSTGRES_DB: postgres`. Volúmenes `pgdata:/var/lib/postgresql/data` e `init.sql` montado `:ro` en `/docker-entrypoint-initdb.d/`. Red `[backend]`. Healthcheck `pg_isready -h 127.0.0.1 -U agentlab -d agentlab`.
   - `web`: `profiles: ["web"]`, con un comentario en inglés: `# enabled by TASK-007, which adds docker/web.Dockerfile`. `build` con `docker/web.Dockerfile`, `ports: ["127.0.0.1:3000:3000"]` (decisión C) y redes `[backend, egress]`. `depends_on: db: { condition: service_healthy }`. Variables `DATABASE_URL: ${DATABASE_URL:?…}`, `LOG_LEVEL` y `LANGCHAIN_TRACING_V2`.
   - `worker`: `build` con `docker/worker.Dockerfile`, `init: true`, `stop_grace_period: 40s` y redes `[backend, egress]`. `depends_on: db: { condition: service_healthy }`. Variables `DATABASE_URL: ${DATABASE_URL:?…}`; con `${VAR:-}`, `WORKER_*`, `SHUTDOWN_GRACE_MS`, `LOG_LEVEL`, `LANGCHAIN_TRACING_V2`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `OLLAMA_BASE_URL`, `AGENTLAB_PROVIDER` y `OTEL_EXPORTER_OTLP_ENDPOINT`.
   - `ollama`: imagen de la tabla, `profiles: [local]`, sin `ports`, volumen `ollama:/root/.ollama` y redes `[backend, egress]`.
   - `networks`: `backend: { internal: true }` y `egress: {}`. `volumes`: `pgdata` y `ollama`.
   - El comentario del hueco de migraciones (ver la sección anterior). Sin `restart` en M0.
7. **`compose.override.example.yaml`**: `db` con `ports: ["127.0.0.1:5432:5432"]` y `networks: [backend, egress]`, con un comentario que explica el hallazgo 1 y que se copia a `compose.override.yaml` (gitignored). → `compose.override.example.yaml`
8. **`.env.example`** (decisión B) → `.env.example`
   - Cabecera: las variables de la sección «Compose» solo las lee `docker compose`; el resto se valida en `env.ts`. Primer paso: `cp .env.example .env` y rellenar antes de `make up`.
   - Sección Compose: `POSTGRES_PASSWORD=`, vacía, con el comentario «obligatoria; solo `[A-Za-z0-9]`; la misma en las dos URLs».
   - `DATABASE_URL=` y `DATABASE_URL_TEST=` vacías, cada una con un comentario de una línea con la forma `postgresql://agentlab:<pw>@db:5432/agentlab` y `postgresql://agentlab:<pw>@localhost:5432/agentlab_test` (esta, con el override), donde `<pw>` es `POSTGRES_PASSWORD`. El marcador tiene que ser corto: uno de 8 o más caracteres, como `<POSTGRES_PASSWORD>`, casaría con la regex del pre-commit. `.env.example` está exento, pero la regla se mantiene por si el ejemplo se copia a otro fichero (test 12).
   - `LANGCHAIN_TRACING_V2=false   # LangSmith off; no LANGCHAIN_API_KEY exists`.
   - El resto, sin cambios.
   - *README*: la instrucción `cp .env.example .env` que pide la decisión B la añade docs-keeper al cerrar (README no está en el scope de devops).
9. **`Makefile`** → `Makefile`
   - `export TURBO_TELEMETRY_DISABLED := 1`. Variables `NODE_IMAGE` (la de la tabla), `PNPM_STORE_VOLUME := agentlab-pnpm-store` y `NODE_MODULES_VOLUME := agentlab-validate-node-modules`.
   - `DOCKER_NODE`: `docker run --rm -v $(CURDIR):/src:ro -v $(PNPM_STORE_VOLUME):/pnpm-store -v $(NODE_MODULES_VOLUME):/work/node_modules -e npm_config_store_dir=/pnpm-store -e TURBO_TELEMETRY_DISABLED=1 -w /work $(NODE_IMAGE) bash -euo pipefail -c`.
   - `IN_COPY`: el prefijo común, `tar -C /src --exclude=./node_modules --exclude='*/node_modules' --exclude=./.git --exclude='*/.turbo' --exclude=./.pnpm-store --exclude=./.env --exclude='./.env.*' -cf - . | tar -C /work -xf - && corepack enable && corepack prepare pnpm@9.15.9 --activate && pnpm install --frozen-lockfile`.
   - `validate:` ejecuta `docker volume create` para los dos volúmenes y `$(DOCKER_NODE) '$(IN_COPY) && pnpm -r typecheck && pnpm -r lint && pnpm test && pnpm format:check'`.
   - `test:` es igual, pero solo con `pnpm test` (decisión E-a; sin base de datos, sin `DATABASE_URL_TEST`; TASK-005 lo conecta a `db`).
   - `up` y `up-local` sin cambios. `down`, `logs` y `ps` con `--profile '*'`.
   - Añadir `validate` a `.PHONY`. Cada target documentado con `##`. El texto de `up` pasa a «Levanta db + worker (web desde TASK-007)».
10. **Verificación.** Ver «Tests». Las credenciales son desechables y se escriben en línea en el comando, por ejemplo `POSTGRES_PASSWORD=probe DATABASE_URL=postgresql://agentlab:probe@db:5432/agentlab DATABASE_URL_TEST=x docker compose …`. **Nunca** se crea ni se lee `.env`. **Nunca** se ejecuta `docker compose config` sin `--quiet` con secretos reales.

## Contratos públicos nuevos o cambiados

- Servicios de Compose: `db`, `worker`, `web` (perfil `web`, inactivo hasta TASK-007) y `ollama` (perfil `local`). Redes `agentlab_backend` (interna) y `agentlab_egress`. Volúmenes `agentlab_pgdata` y `agentlab_ollama`, más los externos que crea make: `agentlab-pnpm-store` y `agentlab-validate-node-modules`.
- Imagen worker: usuario `node`, `WORKDIR /app/apps/worker` y `CMD ["tsx","src/index.ts"]`, con `init: true` (tini PID 1) y `stop_grace_period: 40s`.
- `apps/worker/src/index.ts`: sin exports. Su contrato es de proceso: una línea JSON en stdout al arrancar, se mantiene vivo y sale con 0 tras `SIGTERM` o `SIGINT`.
- Contrato que hereda TASK-007: `web` construye desde `docker/web.Dockerfile`, con contexto en la raíz, y escucha en el puerto 3000 del contenedor.
- Bases `agentlab` y `agentlab_test`, cuyo propietario es el superusuario `agentlab` (TD-013).
- Variables: nueva `POSTGRES_PASSWORD` (solo Compose). `POSTGRES_PASSWORD`, `DATABASE_URL` y `DATABASE_URL_TEST` son obligatorias para Compose. `.env.example` incorpora `LANGCHAIN_TRACING_V2=false`.
- Makefile: `up`, `up-local`, `down`, `logs`, `ps`, `test`, `validate`, `lint`, `typecheck`, `setup`, `orchestrator`, `verify-hooks` y `help`.
- `apps/worker/package.json`: `dependencies.tsx = "4.23.15"`.

## Tests (tester; todo con credenciales desechables en línea)

1. `docker compose config --quiet` devuelve exit 0, también con `--profile local` y con `--profile '*'` aunque falte `docker/web.Dockerfile`. Sin `POSTGRES_PASSWORD` o sin `DATABASE_URL`, falla con el mensaje `:?`.
2. `docker compose up --build -d` termina con exit 0 y **no** construye `web` (`docker compose --profile '*' ps -a` no muestra contenedor `web`). `db` queda *healthy*. `docker compose ps` no muestra puertos de `db` en el host. Dentro de `db`, `getent hosts deb.debian.org` falla. `psql -l` lista `agentlab` y `agentlab_test`.
3. Worker provisional:
   - `docker inspect` muestra `Config.User=node` y `Cmd=[tsx src/index.ts]`, y `HostConfig.Init=true`.
   - `docker compose exec worker cat /proc/1/cmdline | tr '\0' ' '` empieza por `/sbin/docker-init`.
   - A los 10 s de `up`, el worker sigue en `running`, y `docker compose logs worker` contiene una línea JSON con `"msg":"worker started (provisional)"`.
   - `time docker compose stop worker` tarda menos de 30 s (`SHUTDOWN_GRACE_MS`), `docker inspect -f '{{.State.ExitCode}}'` da `0` y los logs contienen `"signal":"SIGTERM"`.
   - `docker compose run --rm --no-deps worker id` → uid 1000.
4. Web: `docker compose --profile web config` muestra `127.0.0.1` / `3000` publicado y `dockerfile: docker/web.Dockerfile`. Que `docker compose --profile web up --build` falle por falta de Dockerfile es lo esperado hasta TASK-007 y no cuenta como fallo.
5. `docker compose --profile local up -d` añade `ollama` sin puerto publicado (`docker compose port ollama 11434` vacío). Desde la red interna responde: `docker compose run --rm --no-deps worker node -e "fetch('http://ollama:11434/api/version').then(r=>process.exit(r.ok?0:1))"`.
6. Override, sin copiar nada: `docker compose -f compose.yaml -f compose.override.example.yaml up -d db`, y después `pg_isready -h 127.0.0.1 -p 5432` desde el host o desde un contenedor con `--network host`. `git check-ignore compose.override.yaml` devuelve la ruta.
7. `make down` no deja ningún contenedor (ollama incluido) y mantiene los volúmenes. Al volver a levantar con el volumen existente, `init.sql` no rompe nada. Con `down -v` se reinicializa.
8. **Centinela de `make validate`**, en el repo y con el `node_modules` del host ya instalado:
   - Antes: `touch node_modules/.agentlab-sentinel`. Guardar `shasum node_modules/.modules.yaml` y `ls -la node_modules apps/*/node_modules packages/*/node_modules | shasum`.
   - `make validate` → exit 0.
   - Después: el centinela existe y los dos `shasum` coinciden. Los volúmenes `agentlab-validate-node-modules` y `agentlab-pnpm-store` existen. `git status --porcelain` no muestra cambios nuevos. Al terminar, borrar el centinela.
   - Repetir `make validate` (segunda ejecución con los volúmenes poblados) → exit 0.
9. `make test` termina con exit 0 (tests de `core`) y vuelve a pasar el centinela. `make logs` sigue los logs (comprobar con timeout). `make up` termina con exit 0.
10. `grep TURBO_TELEMETRY_DISABLED=1` aparece en `Makefile` y en `docker/worker.Dockerfile`; el de `web.Dockerfile` lo comprueba TASK-007.
11. `pnpm -r typecheck` y `pnpm -r lint` pasan con el nuevo `apps/worker/src/index.ts` (los cubre `make validate`). `grep -n "console\.\|process\.env" apps/worker/src/index.ts` no devuelve nada.
12. Las claves de `.env.example` coinciden con las de `EnvSchema.shape` más `POSTGRES_PASSWORD`. Cada variable está documentada en una línea y ningún valor es secreto. La regex del pre-commit `postgres(ql)?://[^:/\s]+:[^@/\s]{8,}@` no casa con ningún fichero del diff.
13. `pnpm audit --prod` (entran tsx y esbuild) y `pnpm --filter worker list --prod` (debe salir `tsx 4.23.15`).

## Riesgos

- R1. **Regex de secretos del pre-commit.** No aplica: `.env.example` está exento y sus valores van vacíos (decisión B). En `compose.yaml` no se construyen URLs.
- R2. **Turbo en modo strict filtra `DATABASE_URL_TEST`.** Lo resuelve TASK-005, que tiene `turbo.json` en su scope (decisión E).
- R3. **Desajuste entre `SHUTDOWN_GRACE_MS` y `stop_grace_period`.** Si se sube `SHUTDOWN_GRACE_MS` por encima de 40 000, Docker mata con SIGKILL antes de tiempo. Queda documentado en `compose.yaml` y `.env.example`.
- R4. **`init.sql` solo se ejecuta con el volumen vacío.** Un volumen anterior no tendrá `agentlab_test`; se arregla con `docker compose down -v`.
- R5a. **TD-013 (LOW):** la app se conecta como superusuario. Se paga en TASK-037.
- R5b. **TD-014 (LOW):** `ollama` corre como root. Se paga en TASK-021.
- R6. **`make validate` y el host.** Resuelto por la decisión humana y la decisión 12. Queda un riesgo menor: el montaje de solo lectura en `/src` sigue dejando visible `.env` dentro del contenedor de validación (como el comando de TASK-001), aunque la copia lo excluye y ninguna herramienta lo lee. Security lo revisa (R9).
- R7. **Imagen de Ollama.** Pesa varios GB y en macOS no usa GPU. Sin `ollama pull` no hay inferencia local (OD-005).
- R8. **Migraciones.** Hueco documentado; lo cierra TASK-005 con el servicio `migrate`.
- R9. **Security tendrá que revisar:**
  - el puerto de web y el contexto de build;
  - las variables de cada servicio;
  - el usuario no root;
  - que `db` y `ollama` no tengan puerto;
  - el pinning por digest;
  - tsx y esbuild en runtime;
  - el montaje de solo lectura de `make validate`;
  - que `docker compose config` no vuelque secretos en los informes.
- R10. Ya conocido: `role-guard.sh` permite a devops `apps/*/src/index.ts`, y ahora entra en el scope.
- R11. **Perfil `web` sin Dockerfile.** `docker compose --profile '*' up --build`, o nombrar `web` explícitamente, falla hasta TASK-007. Ningún target de make lo hace (`down`, `logs` y `ps` no construyen). Si `config --quiet` con `--profile '*'` fallara por el Dockerfile ausente (no lo pude verificar), devops lo reporta y se aplica la opción (b) de OD-G.
- R12. **Paso 1 (`pnpm add` en contenedor con copia).** Devolver `package.json` y el lockfile al repo requiere escribir en dos rutas del scope desde Docker. Si el hook lo bloquea, la alternativa reportable es `pnpm` del host (Node 26 con `engine-strict` puede negarse a ejecutarlo); en ese caso devops para y lo reporta.

## OPEN DECISIONS (nuevas; la recomendación es solo mía)

**OD-G · Cómo queda `web` en `compose.yaml` en M0.** La viñeta pide «define `web`, cuyo Dockerfile llega en TASK-007», y `docker compose up --build` no debe fallar.
- (a) **Recomendada.** `profiles: ["web"]` con la definición completa. TASK-007 quita el perfil, lo que exige añadir `compose.yaml` a su scope (hoy tiene `apps/web/**` y `docker/web.Dockerfile`). También revisa el texto de `make up`.
- (b) No definir `web` hasta TASK-007. No cumple «define `web»` y TASK-007 tendría que escribir el servicio entero.
- (c) Servicio `web` con imagen node y `command` de espera. Descartada: un contenedor falso con puerto publicado.

Decisión para Orchestrator o humano: aprobar (a) y añadir `compose.yaml` (y `Makefile`, por el texto de `up`) al scope de TASK-007.

**OD-H · Cómo registra el arranque el worker provisional.** ARCHITECTURE §10 (l. 241) y monorepo-conventions prohíben `console.*` **en paquetes** y piden un logger inyectado (`pino` en M0–M2). `apps/worker` es una app, así que la regla no la cubre de forma literal. ESLint no tiene `no-console`. `pino` no está en `deps_allowed`.
- (a) **Recomendada.** Una línea JSON con forma de pino escrita con `process.stdout.write` (paso 4). No usa `console`, no añade dependencias y TASK-008 la sustituye por `pino` sin cambiar el formato.
- (b) `console.info` en la app: la letra lo permite, pero va contra el espíritu de la convención.
- (c) Añadir `pino` ya: requiere `deps_allowed` y adelanta trabajo de TASK-008.

Mientras no se decida otra cosa, devops aplica (a).
