# ADR-005 — Presupuesto interno comprobado antes de cada llamada

| Campo | Valor |
|---|---|
| Estado | Accepted |
| Fecha | 2026-10-20 |
| Decisores | Responsable humano |
| Relacionado | SPEC §5; ARCHITECTURE §3.3; TASK-011 |

## Contexto
Las cuotas gratuitas son finitas y variables. Un bucle de revisión sin tope o un fan-out descontrolado puede agotar la cuota diaria en un run.

## Decisión
1. `BudgetGuard` en `policies`, inyectado en el grafo, con `reserve()` **antes** de cada llamada a modelo o herramienta y `commit()` después con el uso real (o `null`).
2. Límites por run: llamadas, concurrencia, iteraciones de revisión, timeout total, tokens por llamada y acumulados, ratio de contexto, herramientas por invocación, longitud de resultado, profundidad de grafo. Valores por defecto en SPEC §5.1 (los de OD-002 con valores propuestos hasta decisión).
3. Los límites son `readonly` una vez creado el guard. Ningún nodo ni agente del producto puede elevarlos.
4. Al agotar un límite con resultado utilizable → `partial` con `partialReason`; sin resultado → `failed` con `BUDGET_EXCEEDED`.
5. Sin datos de uso del proveedor, el sistema no estima: muestra "no informado".

## Alternativas consideradas
| Alternativa | Por qué se descarta |
|---|---|
| Confiar en el rate limit del proveedor | Llega tarde (429) y no cubre tokens ni iteraciones |
| Límites solo en el prompt ("no hagas más de N llamadas") | No es un mecanismo; el modelo puede ignorarlo |

## Consecuencias
- Positivas: coste y bucles acotados por construcción.
- Negativas: algo de fricción al calibrar los valores (OD-002).

## Verificación
TASK-011 (test que intenta elevar un límite y falla), TASK-013 (`partial` por presupuesto).
