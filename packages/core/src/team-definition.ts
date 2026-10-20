import { z } from "zod";

export const TeamDefinitionSchema = z.strictObject({
  id: z.uuid(),
  name: z.string().min(1),
  graphBuilder: z.string().min(1),
  agentIds: z.array(z.uuid()).min(1),
});
export type TeamDefinition = z.infer<typeof TeamDefinitionSchema>;
