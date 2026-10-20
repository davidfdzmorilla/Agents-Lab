import { z } from "zod";

export const RunRequestSchema = z.strictObject({
  projectId: z.uuid(),
  teamId: z.uuid(),
  input: z.string().trim().min(1),
});
export type RunRequest = z.infer<typeof RunRequestSchema>;
