---
name: reports
description: "Formatos obligatorios de los informes que devuelven los subagentes de AgentLab (PLAN, IMPLEMENTATION, TEST, REVIEW, SECURITY, CLOSURE, COMMIT). Informes, no volcados."
---

# Informes

Todo subagente termina con **un** informe en este formato, en su mensaje final. `docs-keeper` los archiva íntegros en `docs/reports/TASK-NNN.md`. Máximo 30 líneas de log o salida de comandos por informe; nunca ficheros enteros.

## PLAN (architect)
```
## PLAN — TASK-NNN
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
Hecho: <qué existe ahora, 3-8 líneas>
Ficheros: creados <lista> · modificados <lista>
Cómo probarlo: <comandos>
Comandos ejecutados y resultado: <typecheck/lint/test, ≤ 30 líneas>
Desviaciones del plan: <cuáles y por qué> | ninguna
Fuera de scope detectado: <ruta y motivo> | ninguno
Dependencias que harían falta: <paquete y motivo> | ninguna
OPEN DECISIONS: <descripción> | ninguna
Deuda propuesta: <descripción, severidad, dónde pagar> | ninguna
Dudas: <…> | ninguna
```

## TEST (tester)
```
## TEST — TASK-NNN
Comandos: <lista con resultado resumido>
DoD:
  | # | Viñeta (literal) | Resultado | Evidencia |
  | 1 | … | ✅ / ❌ / ⚠️ manual | test:fichero::nombre o cómo se verificó |
Cobertura: <n % (objetivo m %)> | n/a
Tests añadidos: <lista> | ninguno
Problemas en tests existentes: <…> | ninguno
Veredicto: PASS | FAIL
Si FAIL: <viñeta, fallo exacto, cómo reproducir>
```

## REVIEW (reviewer)
```
## REVIEW — TASK-NNN
Hallazgos:
  - [BLOCKER|MAJOR|MINOR|NIT] fichero:línea — <qué> — <qué cambiar>
Cumplimiento: SPEC ✅/❌ · ARCHITECTURE ✅/❌ · ADRs ✅/❌ · DoD ✅/❌ · plan ✅/❌
Sobrearquitectura detectada: <…> | ninguna
Deuda propuesta: <descripción, severidad propuesta (≤ MEDIUM), dónde pagar> | ninguna
Requiere security: sí (motivo) | no
Veredicto: APPROVED | CHANGES_REQUESTED
```

## SECURITY (security)
```
## SECURITY — TASK-NNN
Vectores revisados: secretos · inyección · SSRF · presupuesto · autoaprobación · docker/ci · garantías dev · dependencias
Hallazgos:
  - [CRITICAL|HIGH|MEDIUM|LOW] fichero:línea — impacto — corrección mínima
Veredicto: APPROVED | BLOCKED
```

## CLOSURE (docs-keeper)
```
## CLOSURE — TASK-NNN
Ficheros tocados: <lista exacta>
TASKS.md: TASK-NNN → DONE; desbloqueadas: <lista> | ninguna
Deuda registrada: <TD-nnn …> | ninguna
README actualizado: sí (<qué>) | no
```

## COMMIT (committer)
```
## COMMIT — TASK-NNN — phase: PREPARE | EXECUTE
Ficheros incluidos: <lista>
Ficheros excluidos: <ruta — motivo> | ninguno
Mensaje:
<mensaje completo>
Hash: <solo en EXECUTE>
```
