import type { ZodType } from "zod";

export interface ToolContext {
  runId: string;
  signal: AbortSignal;
}

export interface Tool<I, O> {
  name: string;
  description: string;
  input: ZodType<I>;
  output: ZodType<O>;
  sensitivity: "none" | "network" | "write" | "approval";
  execute(input: I, ctx: ToolContext): Promise<O>;
}
