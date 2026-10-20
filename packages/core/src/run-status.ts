import { z } from "zod";

export const RUN_STATUSES = [
  "queued",
  "running",
  "awaiting_approval",
  "completed",
  "partial",
  "failed",
  "cancelled",
] as const;

export const RunStatusSchema = z.enum(RUN_STATUSES);
export type RunStatus = z.infer<typeof RunStatusSchema>;

const TRANSITIONS: Readonly<Record<RunStatus, readonly RunStatus[]>> = {
  queued: ["running", "cancelled"],
  running: [
    "awaiting_approval",
    "completed",
    "partial",
    "failed",
    "cancelled",
    "queued",
  ],
  awaiting_approval: ["running", "cancelled"],
  completed: [],
  partial: [],
  failed: [],
  cancelled: [],
};

export const TERMINAL_RUN_STATUSES: readonly RunStatus[] = [
  "completed",
  "partial",
  "failed",
  "cancelled",
];

export function canTransition(from: RunStatus, to: RunStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isTerminalRunStatus(status: RunStatus): boolean {
  return TERMINAL_RUN_STATUSES.includes(status);
}
