import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  RUN_EVENT_TYPES,
  RunEventSchema,
  type RunEventType,
} from "./run-event.js";

const agentRef = { agentDefinitionId: randomUUID(), role: "writer", step: 1 };
const error = { code: "X", message: "boom", retryable: false };
const budget = { limit: "maxModelCalls", used: 19, max: 20 };

const PAYLOADS: Record<RunEventType, unknown> = {
  "run.started": {},
  "run.step": { node: "plan", step: 0 },
  "agent.started": { ...agentRef, attempt: 1 },
  "agent.completed": { ...agentRef, durationMs: 10, usage: { inputTokens: 1 } },
  "agent.failed": { ...agentRef, error },
  "tool.started": { toolName: "search", step: 2 },
  "tool.completed": { toolName: "search", step: 2, durationMs: 5 },
  "run.awaiting_approval": { toolName: "write_file" },
  "run.resumed": {},
  "run.cancelled": {},
  "run.completed": {},
  "run.partial": { partialReason: "review iterations exhausted" },
  "run.failed": { error },
  "budget.warning": budget,
  "budget.exceeded": budget,
};

function make(type: string, payload: unknown, extra: object = {}) {
  return {
    type,
    runId: randomUUID(),
    seq: 1,
    ts: "2026-10-20T10:00:00Z",
    payload,
    ...extra,
  };
}

describe("RunEventSchema", () => {
  it("lists exactly the 15 event types of SPEC section 8", () => {
    expect([...RUN_EVENT_TYPES].sort()).toEqual(
      [
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
      ].sort(),
    );
    expect(RUN_EVENT_TYPES).toHaveLength(15);
  });

  it.each(RUN_EVENT_TYPES)("accepts a valid %s event", (type) => {
    expect(RunEventSchema.safeParse(make(type, PAYLOADS[type])).success).toBe(
      true,
    );
  });

  it.each([
    ["unknown type", make("run.exploded", {})],
    ["seq 0", make("run.started", {}, { seq: 0 })],
    ["fractional seq", make("run.started", {}, { seq: 1.5 })],
    ["ts without ISO format", make("run.started", {}, { ts: "yesterday" })],
    ["ts without zone", make("run.started", {}, { ts: "2026-10-20T10:00:00" })],
    ["payload of another type", make("run.step", PAYLOADS["run.failed"])],
    ["run.partial without reason", make("run.partial", {})],
    [
      "run.partial with empty reason",
      make("run.partial", { partialReason: "" }),
    ],
    ["extra payload key", make("run.completed", { status: "completed" })],
    ["non-uuid runId", make("run.started", {}, { runId: "r1" })],
    ["negative budget used", make("budget.warning", { ...budget, used: -1 })],
    ["negative budget max", make("budget.exceeded", { ...budget, max: -1 })],
    [
      "unknown budget limit",
      make("budget.warning", { ...budget, limit: "nope" }),
    ],
  ])("rejects %s", (_name, value) => {
    expect(RunEventSchema.safeParse(value).success).toBe(false);
  });
});
