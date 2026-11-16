import { z } from "zod";
import { AgentDefinitionSchema } from "@agentlab/core";
import type { AgentRole, JsonSchema } from "@agentlab/core";
import { OUTPUT_RULES, UNTRUSTED_DATA_RULES } from "./prompt-rules.js";

export const AgentLimitsSchema = AgentDefinitionSchema.pick({
  maxCalls: true,
  maxTokens: true,
  timeoutMs: true,
});
export type AgentLimits = z.infer<typeof AgentLimitsSchema>;

export interface RoleDefinition<TOutput> {
  readonly role: AgentRole;
  readonly systemPrompt: string;
  readonly promptVersion: string;
  readonly outputSchema: z.ZodType<TOutput>;
  readonly outputJsonSchema: JsonSchema;
  readonly defaultLimits: AgentLimits;
}

export interface RoleSpec<TOutput> {
  readonly role: AgentRole;
  readonly promptVersion: string;
  readonly rolePrompt: string;
  readonly outputSchema: z.ZodType<TOutput>;
  readonly defaultLimits: AgentLimits;
}

export function defineRole<TOutput>(
  spec: RoleSpec<TOutput>,
): RoleDefinition<TOutput> {
  const outputJsonSchema: JsonSchema = z.toJSONSchema(spec.outputSchema);
  const systemPrompt = [
    spec.rolePrompt,
    UNTRUSTED_DATA_RULES,
    OUTPUT_RULES,
    "JSON Schema of your output:",
    JSON.stringify(outputJsonSchema),
  ].join("\n\n");
  return Object.freeze({
    role: spec.role,
    systemPrompt,
    promptVersion: spec.promptVersion,
    outputSchema: spec.outputSchema,
    outputJsonSchema: deepFreeze(outputJsonSchema),
    defaultLimits: deepFreeze({ ...spec.defaultLimits }),
  });
}

function deepFreeze<T extends object>(value: T): T {
  for (const child of Object.values(value)) {
    if (typeof child === "object" && child !== null) deepFreeze(child);
  }
  return Object.freeze(value);
}
