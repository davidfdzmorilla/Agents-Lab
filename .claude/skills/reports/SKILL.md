---
name: reports
description: "Formatos obligatorios de los informes que devuelven los subagentes de AgentLab (PLAN, IMPLEMENTATION, TEST, REVIEW, SECURITY, CLOSURE, COMMIT). Informes, no volcados."
---

# Informes

Todo subagente termina con **un** informe en este formato, en su mensaje final. `docs-keeper` los archiva íntegros en `docs/reports/TASK-NNN.md`. Máximo 30 líneas de log o salida de comandos por informe; nunca ficheros enteros.

## Cierre de hallazgos

Regla decidida por el humano: "un hallazgo solo se cierra con cita literal del fichero corregido".

- Todo hallazgo marcado como resuelto (en IMPLEMENTATION de un ciclo de corrección, y al verificarlo en TEST, REVIEW y SECURITY) lleva `fichero:línea` y el texto literal de esa línea tal como está en disco, leído después del cambio.
- Sin cita, el hallazgo cuenta como no resuelto.
- La cita cuenta dentro de las 30 líneas de la regla general.

## Fechas

- Cada informe lleva en su cabecera `Fecha: <salida de date +%F>`.
- Toda fecha que el informe escriba en un documento sale también de `date +%F` ejecutado en ese momento; nunca de memoria ni copiada de un encargo o informe anterior.
- Excepción: `docs-keeper` y `committer` toman la fecha del campo `Fecha:` de su encargo (que el Orchestrator rellena con `date +%F`), porque no pueden ejecutar `date`. Si el encargo no trae `Fecha:`, no la inventan: lo indican en el informe.

## PLAN (architect)
```
## PLAN — TASK-NNN
Fecha: <salida de date +%F>
Contexto: <3 líneas>
Decisiones:
  - <decisión> — alternativa descartada: <x> porque <y>
Pasos:
  1. <paso> → ficheros: <lista>
Contratos públicos nuevos/cambiados: <firmas>
Tests: <qué se prueba y cómo>
Riesgos: <lista>
OPEN DECISIONS: <OD-? qué falta, opciones, recomendación> | ninguna
```

## IMPLEMENTATION (owner)
```
## IMPLEMENTATION — TASK-NNN
Fecha: <salida de date +%F>
Hecho: <qué existe ahora, 3-8 líneas>
Ficheros: creados <lista> · modificados <lista>
Cómo probarlo: <comandos>
Comandos ejecutados y resultado: <typecheck/lint/test, ≤ 30 líneas>
Desviaciones del plan: <cuáles y por qué> | ninguna
Fuera de scope detectado: <ruta y motivo> | ninguno
Dependencias que harían falta: <paquete y motivo> | ninguna
OPEN DECISIONS: <descripción> | ninguna
Deuda propuesta: <descripción, severidad, dónde pagar> | ninguna
Hallazgos resueltos (opcional, solo ciclos de corrección): [x] <id> — fichero:línea — "<línea literal leída tras el cambio>"
Dudas: <…> | ninguna
```

## TEST (tester)
```
## TEST — TASK-NNN
Fecha: <salida de date +%F>
Comandos: <lista con resultado resumido>
DoD:
  | # | Viñeta (literal) | Resultado | Evidencia |
  | 1 | … | ✅ / ❌ / ⚠️ manual | test:fichero::nombre o cómo se verificó |
Cobertura: <n % (objetivo m %)> | n/a
Tests añadidos: <lista> | ninguno
Problemas en tests existentes: <…> | ninguno
Hallazgos verificados (opcional): [x] <id> — fichero:línea — "<línea literal leída en disco>"
Veredicto: PASS | FAIL
Si FAIL: <viñeta, fallo exacto, cómo reproducir>
```

## REVIEW (reviewer)
```
## REVIEW — TASK-NNN
Fecha: <salida de date +%F>
Hallazgos:
  - [BLOCKER|MAJOR|MINOR|NIT] fichero:línea — <qué> — <qué cambiar>
Cumplimiento: SPEC ✅/❌ · ARCHITECTURE ✅/❌ · ADRs ✅/❌ · DoD ✅/❌ · plan ✅/❌
Sobrearquitectura detectada: <…> | ninguna
Deuda propuesta: <descripción, severidad propuesta (≤ MEDIUM), dónde pagar> | ninguna
Requiere security: sí (motivo) | no
Hallazgos verificados (opcional): [x] <id> — fichero:línea — "<línea literal leída en disco>"
Veredicto: APPROVED | CHANGES_REQUESTED
```

## SECURITY (security)
```
## SECURITY — TASK-NNN
Fecha: <salida de date +%F>
Vectores revisados: secretos · inyección · SSRF · presupuesto · autoaprobación · docker/ci · garantías dev · dependencias
Hallazgos:
  - [CRITICAL|HIGH|MEDIUM|LOW] fichero:línea — impacto — corrección mínima
Hallazgos verificados (opcional): [x] <id> — fichero:línea — "<línea literal leída en disco>"
Veredicto: APPROVED | BLOCKED
```

## CLOSURE (docs-keeper)
```
## CLOSURE — TASK-NNN
Fecha: <salida de date +%F>
Ficheros tocados: <lista exacta>
TASKS.md: TASK-NNN → DONE; desbloqueadas: <lista> | ninguna
Deuda registrada: <TD-nnn …> | ninguna
README actualizado: sí (<qué>) | no
```

## COMMIT (committer)
```
## COMMIT — TASK-NNN — phase: PREPARE | EXECUTE
Fecha: <salida de date +%F>
Ficheros incluidos: <lista>
Ficheros excluidos: <ruta — motivo> | ninguno
Mensaje:
<mensaje completo>
Hash: <solo en EXECUTE>
```
