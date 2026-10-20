import { z } from "zod";
import { JsonSchemaSchema } from "./json-schema.js";

export const AGENT_ROLES = [
  "manager",
  "researcher",
  "analyst",
  "writer",
  "critic",
  "evaluator",
] as const;
export const AgentRoleSchema = z.enum(AGENT_ROLES);
export type AgentRole = z.infer<typeof AgentRoleSchema>;

const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

export const AgentDefinitionSchema = z.strictObject({
  id: z.uuid(),
  name: z.string().min(1),
  role: AgentRoleSchema,
  systemPrompt: z.string().min(1),
  promptVersion: z.string().regex(SEMVER),
  providerId: z.uuid(),
  modelId: z.string().min(1),
  toolAllowlist: z.array(z.string().min(1)),
  maxCalls: z.number().int().positive(),
  maxTokens: z.number().int().positive(),
  timeoutMs: z.number().int().positive(),
  outputSchema: JsonSchemaSchema,
  enabled: z.boolean(),
});
export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;
