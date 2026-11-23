# ADR-014 — Salida restringida de `worker` y `web` con un `egress-gateway` propio

| Campo | Valor |
|---|---|
| Estado | Proposed |
| Fecha | 2026-11-20 |
| Decisores | Responsable humano · architect |
| Relacionado | SPEC §9.7 y §13 (OD-088, OD-093); ARCHITECTURE §1 y §9; ADR-003; ADR-004; ADR-011; ADR-012; TD-012; TD-018; TASK-020 (plan §8); TASK-050; TASK-021; TASK-014 |

## Contexto

- Hoy `web` y `worker` están en `backend` (interna) y en `egress` (bridge con salida a internet) (`compose.yaml:48`, `:69`, `:121-126`). El `worker` está en `egress` porque tiene que llamar a OpenRouter y a Gemini. `web` está ahí solo para publicar `127.0.0.1:3000`, porque una red `internal: true` no publica puertos (ARCHITECTURE §1).
- Con eso, los dos procesos alcanzan cualquier destino: RFC1918, servicios del host, los metadatos cloud (`169.254.169.254`, `fd00:ec2::254`) e internet entero. Es TD-018 (LOW, sin SSRF hoy porque no hay herramientas HTTP), ampliada a `web` en TASK-007. TD-012 pide además una allowlist de host (SPEC §9.7).
- M2 lleva al `worker` las primeras claves reales, y M4 trae herramientas HTTP (`fetch_url`). La restricción tiene que existir antes y no puede depender de que el proceso coopere.
- Docker no tiene un modo de red que publique un puerto y a la vez bloquee la salida con garantía. `gateway_mode_ipv4=isolated` exige una red `internal`, y `routed` o `enable_ip_masquerade=false` solo quitan el NAT; el contenedor sigue alcanzando el host por la puerta de enlace del bridge [DKR-BR] [DKR-PP].
- Decisión humana del 2026-11-20 (SPEC §13): OD-088 (b), el egress sale de TASK-020 a una tarea propia (TASK-050); OD-093 (a), `egress-gateway` propio. Respuesta literal: «Aceptar todas (Recommended)». El diseño de partida es el plan de TASK-020, §8.

## Decisión

1. **Un servicio nuevo, `egress-gateway`, es el único de la aplicación con salida a internet** (además de `ollama`, ver 6). `web` y `worker` pasan a estar solo en redes `internal: true`: sin ruta a internet aunque el proceso ignore el proxy. Falla cerrado.
2. **Implementación propia en Node, sin imagen ni dependencia nueva.**
   - Usa el stage `runtime` de `docker/worker.Dockerfile` (ADR-011) con `command: ["node", "--import", "tsx", "src/egress-gateway/main.ts"]`.
   - El código vive en `apps/worker/src/egress-gateway/**` (engine-dev). Solo usa módulos de Node (`node:net`, `node:dns`, `node:http`) y lo que el `worker` ya tiene.
   - Contenedor: `cap_drop: [ALL]`, `security_opt: [no-new-privileges:true]`, `read_only: true`, uid 1000, puertos > 1024, sin variables de entorno de la aplicación y sin `DATABASE_URL`. No está en `backend`.
3. **Topología:**

   | Red | `internal` | Miembros |
   |---|---|---|
   | `backend` | sí | `db`, `migrate`, `web`, `worker`, `ollama` (sin cambios) |
   | `test-db` | sí | `db`, `test` (sin cambios) |
   | `egress` | no | `egress-gateway`, `ollama` (`web` y `worker` salen de ella) |
   | `worker-egress` (nueva) | sí | `worker`, `egress-gateway` |
   | `web-ingress` (nueva) | sí | `web`, `egress-gateway` |

4. **Entrada a `web`: reenvío TCP.** `127.0.0.1:3000` lo publica `egress-gateway` y lo reenvía byte a byte a `web:3000` por `web-ingress`. No interpreta HTTP: conserva `Host` (que TASK-014 necesita para sus comprobaciones) y deja pasar SSE. Ningún otro destino es alcanzable por ese puerto.
5. **Salida: proxy `CONNECT` en `:3128`, alcanzable solo desde `worker-egress` y `web-ingress`.**
   - Solo acepta `CONNECT host:443`. `host` tiene que coincidir exactamente con una allowlist constante en el código: `openrouter.ai` y `generativelanguage.googleapis.com`, los hosts de los presets de OD-090 (a) y OD-079. Un test compara la allowlist con esos presets.
   - Antes de conectar:
     1. resuelve el nombre con un resolver inyectable;
     2. rechaza si **alguna** dirección resuelta cae en 0/8, 10/8, 100.64/10, 127/8, 169.254/16 (incluido `169.254.169.254`), 172.16/12, 192.0.0/24, 192.168/16, 198.18/15, 224/4, 240/4, `::1`, `::`, `fc00::/7` (incluido `fd00:ec2::254`), `fe80::/10` o `::ffff:0:0/96` (IPv4 mapeadas);
     3. conecta a la dirección ya comprobada, sin volver a resolver (contra el DNS rebinding entre comprobación y conexión);
     4. lee el ClientHello y exige que el SNI coincida con el host del `CONNECT` (contra el domain fronting en CDN).
   - Todo lo demás se responde con 403 y se cierra: otro método, HTTP en claro, una IP literal, otro puerto, otro host o un SNI distinto o ausente.
   - Plazos de inactividad y un tope de conexiones simultáneas, como constantes.
   - El proxy no ve el contenido TLS: no termina TLS ni ve claves.
6. **Clientes.**
   - `worker`: `HTTPS_PROXY=http://egress-gateway:3128`, `NO_PROXY=ollama` y `NODE_USE_ENV_PROXY=1`, que activa el proxy de entorno en `fetch()` desde Node 22.21.0 [NODE-PX]; el proyecto usa 22.23.4. Lo lee Node, no el código de la aplicación (la regla de `process.env` solo en `core` no cambia).
   - `web`: las mismas variables y la misma allowlist («restringida igual», TD-018). Con OD-089 (b), hoy no tiene ninguna llamada saliente.
   - El proxy de entorno es cooperativo: un agente o dispatcher explícito lo anula [NODE-PX]. Por eso el control real es la topología (1), no las variables.
7. **Ollama (perfil `local`).** `worker` → `ollama` va directo por `backend`, sin proxy. `ollama` conserva `egress` para descargar modelos; si esas descargas pasan por el gateway (con `registry.ollama.ai` en la allowlist) lo decide TASK-021. Ollama nativo en el host (`host.docker.internal`) queda bloqueado por diseño, y TASK-021 lo documenta en `docs/PROVIDERS.md`.

## Alternativas consideradas

| Alternativa | Por qué se descarta |
|---|---|
| (b) Squid como proxy de salida (ACL `dstdomain` y `dst` para los rangos privados) más un reenviador TCP para `web` | Dos imágenes nuevas sujetas a la regla de las dos semanas y a digest (ARCHITECTURE §9); las etiquetas de `ubuntu/squid` en Docker Hub son `_beta` [HUB-SQ]; historial de CVE; el reenviador de `web` sigue haciendo falta. Un CONNECT con allowlist fija es poco código y se prueba sin red |
| (c) `web` en un bridge con `enable_ip_masquerade: "false"`, sin proxy | No restringe el `worker`, que necesita salir. El contenedor sigue alcanzando el host por la puerta de enlace del bridge, y el comportamiento en Docker Desktop no está garantizado [DKR-BR]. No es un control verificable |
| Solo variables `HTTPS_PROXY` sin cambiar las redes | Cooperativo: cualquier cliente con dispatcher propio, o un SDK que no lo respete, sale directo [NODE-PX]. Falla abierto |
| Allowlist de host solo en la aplicación (validar `base_url`) | Con OD-090 (a) ninguna URL de BD o UI llega a un adaptador, pero eso no cubre las herramientas HTTP de M4 ni un proceso comprometido. Es una capa complementaria, no la barrera |
| Una sola tarea con TASK-020 (OD-088 (a)) | Mezcla un servicio de infraestructura con su verificación manual de red con una API de lectura; un fallo del egress bloquearía la API |

## Consecuencias

**Positivas:**
- `web` y `worker` no alcanzan RFC1918, el host ni los metadatos cloud, sea cual sea el código que ejecuten: la barrera es la red, no el proceso.
- La salida del `worker` queda limitada a dos hosts exactos en el 443. Cuando lleguen las herramientas HTTP (M4), el punto de control ya existe.
- Sin imagen ni dependencia externa nueva: no entra nada en la regla de las dos semanas.
- La lógica de decisión (rangos, allowlist, SNI) es una función pura con tests sin red.

**Negativas:**
- Código de red sensible propio. Lo mitigan la allowlist exacta, la IP fijada, el SNI, los tests, la verificación manual y `security REQUIRED` en TASK-050.
- `egress-gateway` comparte imagen con el `worker`: un cambio de dependencias del `worker` cambia también la imagen del gateway.
- Un nuevo proveedor o una herramienta con destino nuevo exige cambiar la allowlist en código (y su ADR o tarea). Es intencionado.
- `web` deja de publicar su propio puerto: si el gateway cae, la UI no es accesible. El orden de arranque y el reinicio los fija compose.
- `web` ve como origen de las conexiones la IP del gateway, no la del navegador. Hoy no se usa la IP del cliente (monousuario, sin autenticación, TD-005).
- Un colector OTLP externo (TASK-027) no sería alcanzable sin añadirlo a la allowlist; uno interno va por `backend` con `NO_PROXY`.

**Para ARCHITECTURE:**
- §1 (vista de procesos y redes) cambia: servicio `egress-gateway`, redes `worker-egress` y `web-ingress`, y `web`/`worker` fuera de `egress`. El architect lo actualiza cuando este ADR pase a `Accepted` y TASK-050 se cierre.

**Riesgos:**
- R1 · Docker Desktop (macOS) y Linux pueden diferir en redes internas y publicación de puertos. Se verifica en los dos si es posible (Verificación).
- R2 · El SDK de Gemini usa su propio dispatcher de undici, que delega en el global (plan de TASK-020, §1.3). Con el `httpOptions.fetch` de TASK-020 (DoD 3) pasa por `globalThis.fetch`. Si algún cliente no usara el proxy, falla cerrado: la llamada no sale.
- R3 · `ollama` sigue en `egress` y es alcanzable desde el `worker` por `backend`. Su API de descarga de modelos (`/api/pull`) acepta nombres con registro y podría servir de salto. TASK-021 decide si `ollama` sale por el gateway.
- R4 · Un fallo en el análisis del ClientHello. El parser solo extrae el SNI y rechaza todo lo que no entiende; tiene tests con ClientHello mal formados y truncados.

## Verificación

**TASK-050** (devops + engine-dev; security REQUIRED):
- Tests unitarios de la política con resolver falso: cada rango de la lista, IPv6 e IPv4 mapeadas, una resolución mixta (pública y privada), puerto distinto de 443, método distinto de `CONNECT`, IP literal, host fuera de la allowlist, SNI distinto, ausente o mal formado.
- Tests de integración en proceso con sockets locales y un clasificador inyectado para el camino feliz, sin red real.
- Test que compara la allowlist con los hosts de los presets.
- Prueba manual del humano en Docker Desktop (macOS) y, si puede, en Linux, con `docker compose exec` dentro de los contenedores (nunca Node en el host), documentada en el informe:
  - desde `worker`, `fetch` a `https://example.com`, `http://169.254.169.254/`, `10.0.0.1`, `192.168.1.1` y `host.docker.internal` falla;
  - desde `worker`, `https://openrouter.ai/api/v1/models` y `https://generativelanguage.googleapis.com/` devuelven una respuesta HTTP (conectividad, sin clave);
  - desde `web`, toda salida directa falla;
  - desde el host, `curl http://127.0.0.1:3000/api/health` da 200.
- Target de Makefile `egress-check` para esa prueba; el reviewer comprueba que ningún workflow de `.github/workflows` lo llama.

## Fuentes (consultadas el 2026-11-20, plan de TASK-020 §12)

- [NODE-PX] Node.js, «Enterprise network configuration»: `NODE_USE_ENV_PROXY` para `fetch()` desde v22.21.0; un agente o dispatcher explícito lo anula. https://nodejs.org/en/learn/http/enterprise-network-configuration
- [DKR-PP] Docker, «Port publishing and mapping». https://docs.docker.com/engine/network/port-publishing/
- [DKR-BR] Docker, «Bridge network driver» (`internal`, `gateway_mode_ipv4`, `enable_ip_masquerade`). https://docs.docker.com/engine/network/drivers/bridge/
- [HUB-SQ] Docker Hub, etiquetas de `ubuntu/squid`. https://hub.docker.com/r/ubuntu/squid/tags
