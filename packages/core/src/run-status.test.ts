import { describe, expect, it } from "vitest";
import {
  RUN_STATUSES,
  TERMINAL_RUN_STATUSES,
  canTransition,
  isTerminalRunStatus,
  type RunStatus,
} from "./run-status.js";

const ALLOWED: readonly (readonly [RunStatus, RunStatus])[] = [
  ["queued", "running"],
  ["queued", "cancelled"],
  ["running", "awaiting_approval"],
  ["running", "completed"],
  ["running", "partial"],
  ["running", "failed"],
  ["running", "cancelled"],
  ["running", "queued"],
  ["awaiting_approval", "running"],
  ["awaiting_approval", "cancelled"],
];

const ALL_PAIRS = RUN_STATUSES.flatMap((from) =>
  RUN_STATUSES.map((to) => [from, to] as const),
);

describe("canTransition", () => {
  it("covers 49 combinations", () => {
    expect(ALL_PAIRS).toHaveLength(49);
  });

  it.each(ALL_PAIRS)("%s -> %s", (from, to) => {
    const expected = ALLOWED.some(([f, t]) => f === from && t === to);
    expect(canTransition(from, to)).toBe(expected);
  });
});

describe("isTerminalRunStatus", () => {
  it.each(RUN_STATUSES)("%s", (status) => {
    const expected = ["completed", "partial", "failed", "cancelled"].includes(
      status,
    );
    expect(isTerminalRunStatus(status)).toBe(expected);
  });

  it("terminal statuses have no outgoing transitions", () => {
    for (const from of TERMINAL_RUN_STATUSES) {
      for (const to of RUN_STATUSES)
        expect(canTransition(from, to)).toBe(false);
    }
  });
});
