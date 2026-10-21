import type { Run } from "@agentlab/persistence";

/** "interrupted": aborted by shutdown; the run stays running (OD-033 a). */
export type RunOutcome = "completed" | "interrupted";

export interface RunExecutor {
  execute(run: Run, signal: AbortSignal): Promise<RunOutcome>;
}

export const noopExecutor: RunExecutor = {
  execute: () => Promise.resolve("completed"),
};
