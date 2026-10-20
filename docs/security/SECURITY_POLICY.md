# AgentLab — Política de seguridad

| Campo | Valor |
|---|---|
| Estado | Esqueleto (se completa en TASK-037, M5) |
| Fuente | TECHNICAL_SPEC §9 |

## Principios vigentes desde M0
1. Secretos solo en entorno o almacén cifrado; nunca en repositorio, tablas, eventos, prompts ni trazas.
2. `db` y `ollama` sin exposición pública.
3. Herramientas con permisos explícitos y validación de parámetros.
4. Sin ejecución de código arbitrario en el MVP; futuras herramientas de shell en contenedores aislados sin privilegios y con límites.
5. Ningún agente del producto aprueba sus propias acciones sensibles ni modifica sus límites.
6. Herramientas HTTP con allowlist y bloqueo de rangos privados y metadatos.
7. Contenido de webs y documentos = datos no confiables.
8. Aprobación humana separada de la decisión del modelo.

## Pendiente (M5)
- Modelo de amenazas por componente.
- Proceso de reporte de vulnerabilidades (`SECURITY.md` en raíz).
- Suite `tests/security/` (inyección, SSRF, fugas, escalada de presupuesto).
- Revisión de dependencias y `pnpm audit` en CI (desde M0, TASK-006).
