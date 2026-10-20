# TASK-002 · Resolver OD-001: versiones de LangGraph.js, checkpointer PostgreSQL, Drizzle, Next.js

| Campo | Valor |
|---|---|
| Tarea | TASK-002 |
| Hito | M0 |
| Owner | architect |
| Fecha de cierre | 2026-10-20 |
| Veredictos finales | TEST: PASS (ciclo 1) · REVIEW: APPROVED (ciclo 1) · SECURITY: no aplica |
| Plan | docs/reports/TASK-002-plan.md (conservado tal cual) |

### Decisiones humanas (citas literales, 2026-10-20)

- "TASK-002: plan aprobado. Decido ya: TypeScript 5.9.3 y @types/node 22 (ARCHITECTURE §9 no cambia); pg como driver único; el checkpointer de LangGraph en esquema propio `langgraph` de la misma base. ADR-002 → Accepted con fecha de hoy; que el architect lo cierre y resuelva OD-001 en SPEC §13 con las versiones exactas y las fuentes."
- "Abre OD-007: ejecución de TypeScript en runtime ... Bloquea TASK-003 y TASK-008, no TASK-001."
- "Sí: amplía el scope de TASK-002 con docs/adr/ADR-000-indice-y-plantilla.md, SPEC §3 y ARCHITECTURE §4 y §6. ... La versión de @langchain/langgraph-checkpoint queda una sola..."
- "OD-008 no se abre: decidido. setup() del checkpointer lo ejecuta `pnpm db:migrate` ...; el worker comprueba al arrancar que el esquema langgraph existe y falla rápido..."
- "Sobre la instalación de prueba del architect: aceptada esta vez porque fue fuera del repositorio y no tocó el proyecto. Regla desde ahora: el architect puede validar en un directorio temporal fuera del repo y debe decirlo en el informe PLAN; dentro del repo, nunca sin deps_allowed. Que docs-keeper lo añada a DEVELOPMENT_WORKFLOW §3 al cerrar TASK-002."
- "Cierra TASK-002 ahora: /close-task TASK-002 y /commit."

### Ficheros cambiados por la tarea

- docs/ARCHITECTURE.md (§4, §6, §9)
- docs/TECHNICAL_SPEC.md (§3, §13)
- docs/adr/ADR-000-indice-y-plantilla.md (índice)
- docs/adr/ADR-002-langgraph-checkpointer-postgresql.md
- docs/reports/TASK-002-plan.md
- docs/reports/TASK-002.md (este informe)
- docs/TASKS.md (estado DONE y registro de cambios)
- docs/DEVELOPMENT_WORKFLOW.md (§3, regla 11; versión 1.1)
- docs/ROADMAP.md (M0, entregable OD-001 marcado)

### Deuda registrada

Ninguna para TASK-002.

### OPEN DECISIONS registradas

OD-007 (ejecución de TypeScript en runtime; bloquea TASK-003 y TASK-008), registrada en SPEC §13 dentro de esta tarea. Ninguna otra.

---

## PLAN — TASK-002 (resumen; texto completo en docs/reports/TASK-002-plan.md)

Versiones propuestas (npm, 2026-10-20): @langchain/langgraph 1.5.1 (2026-10-16), @langchain/langgraph-checkpoint-postgres 1.1.0 (2026-10-12), @langchain/langgraph-checkpoint 1.2.0 (2026-10-12), @langchain/core 1.2.18 (2026-10-15), drizzle-orm 0.45.4 (2026-10-08), drizzle-kit 0.31.11 (2026-09-21), next 16.4.2 (2026-10-15). Compatibilidad de peers verificada; PostgresSaver acepta pg.Pool, setup() crea checkpoints/checkpoint_blobs/checkpoint_writes/checkpoint_migrations, thread_id TEXT. SSE con ReadableStream documentado en route.js. Decisiones: langgraph 1.5.1 vs 1.4.21; PostgresSaver oficial vs propio; Drizzle 0.45 vs 1.0-rc; Next 16 vs 15.5. Riesgos: línea 1.5.x de 8 días; migración futura a Drizzle 1.0; drizzle-kit push borraría tablas del checkpointer; duplicados de @langchain/core; langsmith; EOL Node 22 2027-04-30. OPEN DECISIONS: OD-A driver pg (recomendado pg); OD-B esquema langgraph (recomendado); OD-C TS 5.9.3 (recomendado); OD-D zod 4.6.7 en TASK-004; OD-E react 19.3.1/tailwind 4.3.3 en TASK-007; OD-F referencias a OD-001 fuera de scope. El architect validó con `npm pack` del checkpointer fuera del repo.

---

## IMPLEMENTATION — TASK-002 (ciclo 0)

Hecho: versiones de OD-001 fijadas; ADR-002 Accepted con decisiones humanas; OD-001 resuelta; OD-007 registrada con propuesta.
- ARCHITECTURE §9: fila TS precisa 5.9.3 + @types/node 22.x; tabla con versión exacta, workspace y razón para langgraph 1.5.1, checkpoint 1.2.0, checkpoint-postgres 1.1.0, core 1.2.18, drizzle-orm 0.45.4, drizzle-kit 0.31.11, pg 8.23.1, @types/pg 8.23.1, next 16.4.2. Nota: zod en TASK-004; react/react-dom/tailwind en TASK-007.
- ADR-002: Accepted (2026-10-20). PostgresSaver thread_id=runId, checkpoint_ns=""; pg driver único con pool compartido sin end(); esquema langgraph con tablas de setup(); checkpoint_id text FK lógico. Sección "Compatibilidad verificada" (npm, GitHub Releases #2961, docs Route Handlers). Alternativas y consecuencias ampliadas.
- SPEC §13: OD-001 tachada RESUELTA con versiones y fuentes. OD-007 nueva (bloquea TASK-003, TASK-008) con opciones (a) tsx 4.23.15, (b) bundle esbuild 0.28.2 / tsup 9.0.0, (c) type stripping Node ≥22.18; recomendación (a) `node --import tsx`, PROPUESTA — pendiente de decisión humana.

Comandos: npm view de las 9 versiones + typescript@5.9.3 coinciden; @types/node@22 → 22.20.5; typescript latest 7.0.2.
Desviaciones: pg/@types/pg y TS 5.9.3 por aprobación humana; verificación de setup() asignada a la tarea de persistence de M3.
Fuera de scope detectado: ARCHITECTURE.md:149 (§4), TECHNICAL_SPEC.md:96 (§3), ADR-000:14, ARCHITECTURE §6 (excepción langgraph), ROADMAP.md:24.
Dependencias: ninguna. Deuda: ninguna. Dudas: ninguna.

---

## TEST — TASK-002 (ciclo 0)

Comandos: git diff -U0 (hunks ARCH 209/211 en §9; SPEC 328 y 334+ en §13); npm view de 11 versiones (existen; latest coincide); curl de enlaces (GitHub Releases, docs Next, docs Node → 200; npmjs.com 403 por bots, cubierto por npm view).
Peers: langgraph 1.5.1 → checkpoint ^1.2.0, core ^1.1.48; checkpoint 1.2.0 → core ^1.1.48; checkpoint-postgres 1.1.0 → core ^1.1.44, checkpoint ^1.2.0, pg ^8.12.0; drizzle-orm 0.45.4 → pg >=8, @types/pg *; next 16.4.2 → Node >=20.9, react ^18.2||^19. Todas estables y exactas.
DoD: 1 ✅ · 2 ✅ · 3 ✅ · 4 ✅ · 5 ✅.
Adicionales: decisiones humanas presentes ✅; zod/react/tailwind no fijados ✅; OD-007 bien registrada ✅; 5 inconsistencias fuera de scope confirmadas.
Observaciones: zod debe cumplir ^3.25.32||^4.2.0 (langgraph) y ^3.25.76||^4 (core) en TASK-004; setup() diferido.
Veredicto: PASS

---

## REVIEW — TASK-002 (ciclo 0)

Veredicto: CHANGES_REQUESTED.
- [MAJOR] TECHNICAL_SPEC.md:96 — sigue "OPEN DECISION OD-001", contradice §13:328.
- [MAJOR] ADR-000:14 — índice muestra ADR-002 Proposed.
- [MINOR] ARCHITECTURE.md:171 (§6) — columnas obligatorias vs tablas del esquema langgraph.
- [MINOR] ARCHITECTURE.md:149 (§4) — "o equivalente, OD-001" desfasado.
- [MINOR] ARCHITECTURE.md:217 ↔ ADR-002:51 — versión de checkpoint en persistence vs persistence+orchestrator.
- [MINOR] ADR-002:18 — pool leíble como singleton de módulo.
- [MINOR] ADR-002:53 — LangSmith: falsa protección.
- [MINOR] ADR-002:49,56 — obligaciones futuras sin tarea concreta (schemaFilter→TASK-005; setup() idempotente→TASK-023; quién ejecuta setup(); zod→TASK-004).
- [NIT] ADR-002:19 — "no hay FK física posible" excesivo.
- [NIT] ARCHITECTURE.md:209 — TS 5.9.3 vs "§9 no cambia": aceptable, confirmar con humano.
- [NIT] ADR-002:5 — Estado sin quién aprobó.

Respuestas: plantilla ADR respetada; dirección de dependencias correcta; ningún requisito inventado; ROADMAP:24 no es inconsistencia; OD-007 bien planteada.
Cumplimiento: SPEC ❌ (solo :96) · ARCHITECTURE ✅ · ADRs ❌ (índice) · DoD ✅ · plan ✅. Sobrearquitectura: ninguna. Deuda: TD LOW si §4/§6 no se alinean. Security: no; recomendado en TASK-005/007/013.

---

## IMPLEMENTATION — TASK-002 (corrección ciclo 1/3)

Corregidos los 2 MAJOR, 6 MINOR y NIT ADR-002:5/:19; decisión humana de setup() añadida; ARCH:209 sin tocar.
- SPEC:96 remite a ARCH §9 y ADR-002 (Accepted; OD-001 resuelta en TASK-002).
- ADR-000:14 → Accepted.
- ARCH §6:171-173 columnas obligatorias aplican a tablas Drizzle (public); excepción para las 4 tablas del esquema langgraph.
- ARCH §4:149 → `PostgresSaver` (`@langchain/langgraph-checkpoint-postgres`, esquema langgraph; ADR-002).
- ARCH §9:219,220,228 → checkpoint 1.2.0 en persistence y orchestrator, exacta en todo workspace; checkpoint-postgres en persistence desde TASK-005 (setup() en db:migrate); mecanismo de versión única en TASK-013, comprobación pnpm why en TASK-023.
- ADR-002: :17 regla de versión única; :18 pool por proceso creado por la app con función de construcción, inyectado, sin singleton; :19 "no se declara FK física"; :5 Estado con aprobación humana; :20 decisión 7 (setup() en db:migrate TASK-005; worker comprueba esquema TASK-008); :15 MemorySaver M1/PostgresSaver TASK-023/paquete en TASK-005; :8 Relacionado + TASK-004, TASK-008; :50-56 obligaciones con tarea; :57 riesgo LangSmith con medida en TASK-013; :60 verificación nombra TASK-005/008/023.

Desviaciones: ninguna. Deuda: ninguna. Duda: decisión 7 añadida a ADR Accepted sin ADR nuevo por orden humana.

---

## TEST — TASK-002 (ciclo 1)

DoD: 1 ✅ (ARCH:214-228; 10 versiones existen) · 2 ✅ · 3 ✅ · 4 ✅ (ADR-002:5, ADR-000:14) · 5 ✅ (SPEC:328).
Hunks dentro de scope ✅ (ARCH 149, 171-173, 211-228; SPEC 96, 328, 334-346; ADR-000 solo fila ADR-002). Ninguna OD-001 abierta ✅. Una sola versión de checkpoint 1.2.0 ✅. Tres obligaciones en ADR-002 ✅.
Observación: mecanismo de versión única delegado a TASK-013 a propósito.
Veredicto: PASS (5/5, sin regresiones)

---

## REVIEW — TASK-002 (ciclo 1, limitada)

Los 11 hallazgos del ciclo 0 resueltos (detalle por línea: SPEC:96, ADR-000:14, ARCH:171-173, ARCH:149, ARCH:219,221,228↔ADR-002:17,54, ADR-002:18, :57, :49-56, :19, ARCH:211, ADR-002:5). Decisión de setup() conforme a la cita humana; sin regresiones.
- [NIT] ARCH §9:220-222 — el Orchestrator debe incluir los paquetes @langchain/* en deps_allowed de TASK-005 con versión exacta.

Respuesta a la duda: no choca con ADR-000:27; el paso a Accepted y la decisión 7 van en el mismo diff sin commitear y aprobados por el humano; la 7 no modifica 1-6. Condición: tras el commit de TASK-002, cualquier cambio a ADR-002 requiere ADR nuevo.
Cumplimiento: SPEC ✅ · ARCHITECTURE ✅ · ADRs ✅ · DoD ✅ · plan ✅. Sobrearquitectura: ninguna. Deuda: ninguna. Security: no.
Veredicto: APPROVED

---

## SECURITY — TASK-002

No aplica — diff solo documental (docs/ARCHITECTURE.md, docs/TECHNICAL_SPEC.md, docs/adr/ADR-000, ADR-002); confirmado por reviewer.
