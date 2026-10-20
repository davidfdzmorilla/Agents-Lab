import { z } from "zod";

export const InvocationErrorSchema = z.strictObject({
  code: z.string().min(1),
  message: z.string(),
  retryable: z.boolean(),
});
export type InvocationError = z.infer<typeof InvocationErrorSchema>;

export const InvocationUsageSchema = z.strictObject({
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  costReported: z.number().nonnegative().optional(),
});
export type InvocationUsage = z.infer<typeof InvocationUsageSchema>;

export const AgentInvocationResultSchema = z.strictObject({
  content: z.unknown(),
  status: z.enum([
    "ok",
    "invalid_output",
    "error",
    "timeout",
    "budget_exceeded",
  ]),
  errors: z.array(InvocationErrorSchema),
  references: z.array(
    z.strictObject({
      kind: z.string().min(1),
      uri: z.string().min(1),
      title: z.string().optional(),
    }),
  ),
  usage: InvocationUsageSchema,
});
export type AgentInvocationResult = z.infer<typeof AgentInvocationResultSchema>;
