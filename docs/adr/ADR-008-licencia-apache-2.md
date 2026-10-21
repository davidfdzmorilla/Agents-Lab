# ADR-008 — Licencia Apache-2.0

| Campo | Valor |
|---|---|
| Estado | Proposed (se acepta en TASK-038, M5) |
| Fecha | 2026-10-20 |
| Decisores | Responsable humano |
| Relacionado | SPEC §11; TASK-038 |

## Contexto
P8: licencia definida antes de publicar. Se busca un proyecto abierto, reutilizable, con permisos claros de uso comercial, modificación y distribución, y protección frente a reclamaciones de patentes.

## Decisión (propuesta)
1. Apache-2.0 para el código del repositorio.
2. `NOTICE` con avisos de terceros; `docs/THIRD_PARTY.md` con el resultado de `pnpm licenses list`.
3. La licencia **no** cubre pesos de modelos ni datos de entrenamiento de ningún proveedor; cada uno se rige por sus condiciones, documentadas en `docs/PROVIDERS.md`.
4. Antes de aceptar: revisar que ninguna dependencia de runtime sea GPL/AGPL incompatible.

## Alternativas consideradas
| Alternativa | Por qué se descarta (provisionalmente) |
|---|---|
| MIT | Sin cláusula de patentes |
| AGPL-3.0 | Limita la adopción; no es el objetivo del proyecto |

## Consecuencias
Pendiente de aceptación. Hasta entonces el repositorio es público sin licencia.

Nota (2026-10-21, TASK-006, decisión humana): Repositorio público desde 2026-10-21 sin fichero LICENSE ni campo `license` en `package.json`: sin licencia, todos los derechos reservados, hasta que ADR-008 se acepte en M5. Si se decide poner `"license"` en `package.json` antes que el fichero LICENSE, va en TASK-038.

## Verificación
TASK-038.
