# ADR-003 — Capa de proveedores: interfaz común + adaptadores

| Campo | Valor |
|---|---|
| Estado | Accepted |
| Fecha | 2026-10-20 |
| Decisores | Responsable humano |
| Relacionado | SPEC §2.1, §3; ARCHITECTURE §3.1; TASK-010, TASK-018, TASK-019 |

## Contexto
P1 y P2 del SPEC: coste de inferencia cero y ningún proveedor obligatorio. OpenRouter y Ollama exponen API compatible con OpenAI; Gemini no.

## Decisión
1. Interfaz interna `ModelProvider` en `core` con `capabilities` declaradas, `generate(req, signal)` y errores normalizados (`ProviderAuthError`, `ProviderRateLimitError`, `ProviderTimeoutError`, `ProviderCapabilityError`, `ProviderResponseError`).
2. Adaptador `openai-compatible` (SDK de OpenAI) parametrizado por `baseUrl` + `apiKeyEnv`; OpenRouter y Ollama son **configuraciones** del mismo adaptador.
3. Adaptador `gemini` con el SDK de Google GenAI.
4. El motor declara capacidades requeridas; si el proveedor no las tiene, falla **antes** de la llamada de red. Nunca degradación silenciosa.
5. `usage` y `costReported` son `null` cuando el proveedor no los informa; nunca estimados.
6. `FakeProvider` determinista en `@agentlab/providers/testing` es el proveedor de los tests.

## Alternativas consideradas
| Alternativa | Por qué se descarta |
|---|---|
| Vercel AI SDK como abstracción | Añade otra capa cuya semántica de capacidades y errores no controlamos; dificulta "no fingir que todos los modelos son iguales" |
| Solo OpenAI-compatible (Gemini vía proxy) | Añade un proxy externo o pierde capacidades de Gemini |
| LangChain ChatModels | Acopla el motor a abstracciones de LangChain más allá de LangGraph |

## Consecuencias
- Positivas: añadir proveedor = un adaptador + tests de contrato; el grafo no cambia.
- Negativas: mantener dos SDKs.

## Verificación
TASK-022: la misma suite de contrato pasa contra fake, OpenRouter, Ollama y Gemini.
