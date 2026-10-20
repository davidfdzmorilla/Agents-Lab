import { z } from "zod";

const positiveInt = z.number().int().positive();
const nonNegativeInt = z.number().int().nonnegative();

export const BudgetSchema = z.strictObject({
  maxModelCalls: positiveInt,
  maxConcurrentAgents: positiveInt,
  maxReviewIterations: nonNegativeInt,
  timeoutMs: positiveInt,
  maxTokensPerCall: positiveInt,
  maxTotalTokens: positiveInt,
  maxContextRatio: z.number().gt(0).lte(1),
  maxToolsPerInvocation: nonNegativeInt,
  maxResultChars: positiveInt,
  maxGraphDepth: positiveInt,
});
export type Budget = z.infer<typeof BudgetSchema>;
export type BudgetLimit = keyof Budget;
