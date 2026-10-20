import { z } from "zod";
import {
  InvocationErrorSchema,
  InvocationUsageSchema,
} from "./agent-invocation-result.js";
import { AgentRoleSchema } from "./agent-definition.js";
import { BudgetSchema } from "./budget.js";

export const RUN_EVENT_TYPES = [
  "run.started",
  "run.step",
  "agent.started",
  "agent.completed",
  "agent.failed",
  "tool.started",
  "tool.completed",
  "run.awaiting_approval",
  "run.resumed",
  "run.cancelled",
  "run.completed",
  "run.partial",
  "run.failed",
  "budget.warning",
  "budget.exceeded",
] as const;
export type RunEventType = (typeof RUN_EVENT_TYPES)[number];

const step = z.number().int().nonnegative();
const durationMs = z.number().int().nonnegative();
const agentRef = {
  agentDefinitionId: z.uuid(),
  role: AgentRoleSchema,
  step,
};
const budgetPayload = z.strictObject({
  limit: BudgetSchema.keyof(),
  used: z.number().nonnegative(),
  max: z.number().nonnegative(),
});

function event<T extends RunEventType, P extends z.ZodType>(
  type: T,
  payload: P,
) {
  return z.strictObject({
    type: z.literal(type),
    runId: z.uuid(),
    seq: z.number().int().min(1),
    ts: z.iso.datetime({ offset: true }),
    payload,
  });
}

const empty = z.strictObject({});

export const RunEventSchema = z.discriminatedUnion("type", [
  event("run.started", empty),
  event("run.step", z.strictObject({ node: z.string().min(1), step })),
  event(
    "agent.started",
    z.strictObject({ ...agentRef, attempt: z.number().int().min(1) }),
  ),
  event(
    "agent.completed",
    z.strictObject({ ...agentRef, durationMs, usage: InvocationUsageSchema }),
  ),
  event(
    "agent.failed",
    z.strictObject({ ...agentRef, error: InvocationErrorSchema }),
  ),
  event("tool.started", z.strictObject({ toolName: z.string().min(1), step })),
  event(
    "tool.completed",
    z.strictObject({ toolName: z.string().min(1), step, durationMs }),
  ),
  event(
    "run.awaiting_approval",
    z.strictObject({ toolName: z.string().min(1) }),
  ),
  event("run.resumed", empty),
  event("run.cancelled", empty),
  event("run.completed", empty),
  event("run.partial", z.strictObject({ partialReason: z.string().min(1) })),
  event("run.failed", z.strictObject({ error: InvocationErrorSchema })),
  event("budget.warning", budgetPayload),
  event("budget.exceeded", budgetPayload),
]);
export type RunEvent = z.infer<typeof RunEventSchema>;
