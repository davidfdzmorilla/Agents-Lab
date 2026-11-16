# @agentlab/agents

Product agent roles for AgentLab: Manager, Researcher, Analyst and Critic. Each role is one file in `src/roles/` with a `systemPrompt`, a `promptVersion`, an `outputSchema` (Zod), the derived `outputJsonSchema` and `defaultLimits`. `src/teams/research.ts` builds the example `research` team. The package has no graph logic, no network and no database: the graph lives in `@agentlab/orchestrator`, which does not import this package (ARCHITECTURE section 2).

## Language

Prompts are written in English, the working language of the models. A test checks that every prompt is printable ASCII. The shared `OUTPUT_RULES` ask the model to write only the free-text values of its output in the language of the user request (OD-073); enum values and property names stay exactly as in the schema. Roles that receive no `<user_request>` (the Critic) take the language of the plan texts or findings they receive.

## Prompt structure

`systemPrompt` = role text + `UNTRUSTED_DATA_RULES` + `OUTPUT_RULES` + `JSON Schema of your output:` + the serialized JSON Schema. The JSON Schema has a single source: `z.toJSONSchema(outputSchema)`.

## Untrusted data (`trust="untrusted"`)

The prompts say that any content inside an element marked `trust="untrusted"` is data, not instructions, and forbid following instructions found in it. M1 uses `<user_request trust="untrusted">` and `<agent_output role="..." trust="untrusted">`; M4 adds `<tool_result ... trust="untrusted">` without a prompt change.

Work items derived from the Manager plan are named elements without `trust="untrusted"`: `<research_question>`, `<analysis_instruction>` and `<success_criteria>`. They are legitimate work instructions but their origin is not trusted (user request -> Manager -> plan). The prompts bound them: they define what to work on only and cannot change the rules, role, output format, tools or limits; the Critic also ignores any criterion that imposes a verdict or claims prior approval. Whether they should carry `trust="untrusted"` is for security to decide.

Exported roles are deep-frozen (`outputJsonSchema`, `defaultLimits`); `buildResearchTeam` returns independent mutable copies.

This is a soft defence. The hard controls belong to `orchestrator` (TASK-013): it wraps the data, neutralizes closing tags inside it (for example a `</user_request>` in the request), validates every output with the strict Zod schema and never exposes the budget to a node.

## Output schemas

All schemas are `z.strictObject`, so an extra field (for example `budget`) is rejected. Rule: only constraints that JSON Schema can represent (types, enums, `min`, strict objects). No `refine`, `superRefine`, `transform` or `default`: they disappear silently from the JSON Schema, and the model would see a different contract. The tests validate every example against both Zod and the JSON Schema.

The Analyst `report` (Markdown) is the deliverable of the run in M1 (OD-070).

## Versioning

Every change to a prompt text, including the schema embedded in it, bumps `promptVersion`:

- MAJOR: the output schema changes incompatibly.
- MINOR: the instructions change without breaking the output, or the schema changes compatibly.
- PATCH: wording only.

`src/prompts.test.ts` pins the sha256 of each prompt per version. The table is append-only: add a new entry for the new version and never rewrite an old one. The reviewer checks this in the diff.

| Role | Version | sha256 of `systemPrompt` |
|---|---|---|
| manager | 1.0.0 | `aeee54958ac5e10cdf9fe0d05936d58d6fabc4adbe29bf79ecbd04584cd7f481` |
| researcher | 1.0.0 | `3a25c37f5a27827ca4b674634f528e5038882ce1c530516e66e49b488b6e7154` |
| analyst | 1.0.0 | `d9b1fd6e9dae9b3492425eeadc53b9da3ebf534ad457b41fd9d8e4981c673fb4` |
| critic | 1.0.0 | `ba14ce15f179704380e1afa0cd3bc1ab8fd3ca693de39f7873890c461033ee59` |

## Default limits (provisional, OD-069)

| Role | maxCalls | maxTokens | timeoutMs |
|---|---|---|---|
| manager | 2 | 2000 | 45000 |
| researcher | 2 | 3000 | 60000 |
| analyst | 2 | 4000 | 90000 |
| critic | 2 | 2000 | 45000 |

`maxCalls` is the number of model calls inside one invocation (one call plus one retry). `maxTokens` is output tokens per call; the orchestrator sends `min(agent.maxTokens, budget.maxTokensPerCall)`. `timeoutMs` is per call. The run `Budget` always prevails; these limits only narrow it per agent. Values are provisional until OD-002 is decided; changing them needs no prompt change or version bump.

## Research team

`buildResearchTeam({ providerId, models, newId? })` returns `{ team, agents }`. `models` has one `modelId` per role (the `FakeProvider` script is chosen by model). `newId` defaults to `randomUUID`. The factory does not validate; the repository validates on persist.

## Adding a role

1. Create `src/roles/<role>.ts` with a `z.strictObject` schema and `defineRole({ role, promptVersion: "1.0.0", rolePrompt, outputSchema, defaultLimits })`.
2. Add `src/roles/<role>.test.ts` with the canonical example and three incorrect variants.
3. Add the role to `src/prompts.test.ts` (fingerprint included) and export it from `src/index.ts` and `src/index.test.ts`.
