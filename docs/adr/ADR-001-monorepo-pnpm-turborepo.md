# ADR-001 — Monorepo pnpm + Turborepo con paquetes por responsabilidad

| Campo | Valor |
|---|---|
| Estado | Accepted |
| Fecha | 2026-10-20 |
| Decisores | Responsable humano |
| Relacionado | SPEC §7; ARCHITECTURE §2; TASK-001 |

## Contexto
AgentLab tiene dos aplicaciones (`web`, `worker`) que comparten contratos, persistencia y motor. Se quiere poder crecer (más proveedores, herramientas, evaluaciones) sin convertirlo en un monolito, y mantener TypeScript estricto en todo.

## Decisión
1. Monorepo con **pnpm workspaces** y **Turborepo** para pipelines (`build`, `lint`, `typecheck`, `test`) con caché.
2. Paquetes con dirección de dependencias estricta: `core ← persistence ← policies ← providers ← orchestrator ← agents ← {worker, web}`; `observability`, `tools`, `evaluations` solo dependen de `core` (+ `policies`/`persistence` donde ARCHITECTURE §2 lo indica).
3. Cada paquete exporta solo desde `src/index.ts`; la regla ESLint `no-restricted-imports` prohíbe `@agentlab/*/src/*`.
4. **No se crean paquetes vacíos**: cada uno nace en el hito que ROADMAP indica.
5. ESM, Node 22 LTS, `tsconfig.base.json` con `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.

## Alternativas consideradas
| Alternativa | Por qué se descarta |
|---|---|
| Una sola app Next.js con el worker dentro | Mezcla ciclo de vida web y ejecución larga; imposible reiniciar uno sin el otro |
| Dos repos (web y motor) | Duplica contratos; rompe el tipado compartido |
| Nx | Más pesado para un proyecto de una persona; Turborepo cubre lo necesario |

## Consecuencias
- Positivas: límites claros, tipado compartido, builds cacheados.
- Negativas: algo de ceremonia (un `package.json` por paquete); se mitiga con plantilla en `monorepo-conventions`.

## Verificación
`pnpm -r typecheck` y la regla ESLint fallan ante un import cruzado indebido (TASK-001).
