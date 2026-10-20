import { z } from "zod";

export const ProviderCapabilitiesSchema = z.strictObject({
  tools: z.boolean(),
  structuredOutput: z.boolean(),
  streaming: z.boolean(),
  maxContextTokens: z.number().int().positive().nullable(),
  reportsUsage: z.boolean(),
  reportsCost: z.boolean(),
});
export type ProviderCapabilities = z.infer<typeof ProviderCapabilitiesSchema>;
