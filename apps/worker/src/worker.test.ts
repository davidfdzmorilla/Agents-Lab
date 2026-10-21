import { InvalidTransitionError, canTransition } from "@agentlab/core";
import type { Run, RunsRepository } from "@agentlab/persistence";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RunExecutor, RunOutcome } from "./executor.js";
import { createLogger } from "./logger.js";
import {
  WORKER_INTERRUPTED_ERROR,
  runWorker,
  type WorkerDeps,
} from "./worker.js";

const WORKER_ID = "host/self";
const HOST_PREFIX = "host/";

function fakeRun(id: string): Run {
  return {
    id,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    projectId: "project",
    teamId: "team",
    request: { projectId: "project", teamId: "team", input: "input" },
    status: "running",
    budget: {
      maxModelCalls: 1,
      maxConcurrentAgents: 1,
      maxReviewIterations: 1,
      timeoutMs: 1,
      maxTokensPerCall: 1,
      maxTotalTokens: 1,
      maxContextRatio: 0.5,
      maxToolsPerInvocation: 1,
      maxResultChars: 1,
      maxGraphDepth: 1,
    },
    budgetUsed: null,
    result: null,
    error: null,
    cancelRequested: false,
    workerId: WORKER_ID,
    workerHeartbeatAt: null,
    startedAt: null,
    finishedAt: null,
  };
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

type Line = Record<string, unknown>;

function setup(overrides: Partial<WorkerDeps> = {}) {
  const lines: Line[] = [];
  const logger = createLogger({
    level: "debug",
    destination: {
      write: (chunk: string) => {
        lines.push(JSON.parse(chunk) as Line);
      },
    },
  });
  const runs = {
    failOrphaned: vi.fn<RunsRepository["failOrphaned"]>(() =>
      Promise.resolve([]),
    ),
    claimNext: vi.fn<RunsRepository["claimNext"]>(() => Promise.resolve(null)),
    transition: vi.fn<RunsRepository["transition"]>((id) =>
      Promise.resolve(fakeRun(id)),
    ),
    heartbeat: vi.fn<RunsRepository["heartbeat"]>(() => Promise.resolve(true)),
  };
  const execute = vi.fn<RunExecutor["execute"]>(() =>
    Promise.resolve("completed"),
  );
  const deps: WorkerDeps = {
    runs,
    executor: { execute },
    logger,
    workerId: WORKER_ID,
    hostPrefix: HOST_PREFIX,
    concurrency: 1,
    heartbeatMs: 15_000,
    pollMs: 100,
    staleMs: 3_600_000,
    shutdownGraceMs: 5_000,
    ...overrides,
  };
  const shutdown = new AbortController();
  const logged = (msg: string) => lines.filter((line) => line["msg"] === msg);
  return { deps, runs, execute, shutdown, lines, logged };
}

type Harness = ReturnType<typeof setup>;

function start(h: Harness): Promise<void> {
  return runWorker(h.deps, h.shutdown.signal);
}

async function stop(h: Harness, done: Promise<void>): Promise<void> {
  h.shutdown.abort();
  await vi.advanceTimersByTimeAsync(0);
  await done;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("startup sweep", () => {
  it.each([1, 2])(
    "sweeps once with the host prefix before the first claim (concurrency %i)",
    async (concurrency) => {
      const h = setup({ concurrency, staleMs: 1_000 });
      h.runs.failOrphaned.mockResolvedValueOnce(["a", "b", "c"]);
      const done = start(h);
      await vi.advanceTimersByTimeAsync(0);

      expect(h.runs.failOrphaned).toHaveBeenCalledTimes(1);
      expect(h.runs.failOrphaned).toHaveBeenCalledWith({
        currentWorkerId: WORKER_ID,
        staleMs: 1_000,
        error: WORKER_INTERRUPTED_ERROR,
        hostPrefix: HOST_PREFIX,
      });
      expect(h.runs.failOrphaned.mock.invocationCallOrder[0]).toBeLessThan(
        h.runs.claimNext.mock.invocationCallOrder[0] ?? 0,
      );
      expect(h.logged("orphaned runs marked failed")[0]).toMatchObject({
        count: 3,
        sweep: "startup",
        level: 30,
      });
      await stop(h, done);
    },
  );

  it("rejects without claiming or scheduling the periodic sweep when it fails", async () => {
    const h = setup({ staleMs: 1_000 });
    h.runs.failOrphaned.mockRejectedValue(new Error("db down"));
    const done = start(h);
    await expect(done).rejects.toThrow("db down");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(h.runs.claimNext).not.toHaveBeenCalled();
    expect(h.runs.failOrphaned).toHaveBeenCalledTimes(1);
  });

  it("returns without starting loops when shutdown arrived during the sweep", async () => {
    const h = setup();
    h.shutdown.abort();
    await start(h);
    expect(h.runs.claimNext).not.toHaveBeenCalled();
  });

  it("uses a transition that exists for the sweep", () => {
    expect(canTransition("running", "failed")).toBe(true);
  });
});

describe("periodic sweep", () => {
  it("runs every staleMs without the host prefix, once per period whatever the concurrency", async () => {
    const h = setup({ staleMs: 1_000, concurrency: 2 });
    const done = start(h);
    await vi.advanceTimersByTimeAsync(0);
    expect(h.runs.failOrphaned).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(h.runs.failOrphaned).toHaveBeenCalledTimes(2);
    expect(h.runs.failOrphaned).toHaveBeenLastCalledWith({
      currentWorkerId: WORKER_ID,
      staleMs: 1_000,
      error: WORKER_INTERRUPTED_ERROR,
    });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(h.runs.failOrphaned).toHaveBeenCalledTimes(3);
    await stop(h, done);
  });

  it("keeps sweeping while a run is in progress", async () => {
    const h = setup({ staleMs: 1_000, heartbeatMs: 400 });
    const running = deferred<RunOutcome>();
    h.runs.claimNext.mockResolvedValueOnce(fakeRun("r1"));
    h.execute.mockReturnValue(running.promise);
    const done = start(h);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(h.runs.failOrphaned).toHaveBeenCalledTimes(4);
    running.resolve("completed");
    await stop(h, done);
  });

  it("does not overlap with itself: the next wait starts when the statement ends", async () => {
    const h = setup({ staleMs: 1_000 });
    const pending = deferred<string[]>();
    h.runs.failOrphaned
      .mockResolvedValueOnce([])
      .mockReturnValueOnce(pending.promise);
    const done = start(h);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(h.runs.failOrphaned).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(h.runs.failOrphaned).toHaveBeenCalledTimes(2);

    pending.resolve([]);
    await vi.advanceTimersByTimeAsync(999);
    expect(h.runs.failOrphaned).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(h.runs.failOrphaned).toHaveBeenCalledTimes(3);
    await stop(h, done);
  });

  it("warns without the driver message and carries on when the statement fails", async () => {
    const h = setup({ staleMs: 1_000 });
    h.runs.failOrphaned
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("params: canary-secret"));
    const done = start(h);
    await vi.advanceTimersByTimeAsync(1_000);

    const warns = h.logged("orphaned run sweep failed");
    expect(warns).toHaveLength(1);
    expect(warns[0]).toMatchObject({ level: 40, err: { type: "Error" } });
    expect(JSON.stringify(h.lines)).not.toContain("canary-secret");

    await vi.advanceTimersByTimeAsync(1_000);
    expect(h.runs.failOrphaned).toHaveBeenCalledTimes(3);
    await stop(h, done);
  });

  it("logs at info with the count when it marks runs, and not at info when it marks none", async () => {
    const h = setup({ staleMs: 1_000 });
    h.runs.failOrphaned
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(["x"])
      .mockResolvedValueOnce([]);
    const done = start(h);
    await vi.advanceTimersByTimeAsync(2_000);

    const periodic = h
      .logged("orphaned runs marked failed")
      .filter((line) => line["sweep"] === "periodic");
    expect(periodic.map((line) => [line["level"], line["count"]])).toEqual([
      [30, 1],
      [20, 0],
    ]);
    await stop(h, done);
  });

  it("stops waiting on shutdown without another statement", async () => {
    const h = setup({ staleMs: 1_000 });
    const done = start(h);
    await vi.advanceTimersByTimeAsync(500);
    await stop(h, done);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(h.runs.failOrphaned).toHaveBeenCalledTimes(1);
  });

  it("does not resolve until a statement in flight at shutdown settles", async () => {
    const h = setup({ staleMs: 1_000 });
    const events: string[] = [];
    const pending = deferred<string[]>();
    h.runs.failOrphaned.mockResolvedValueOnce([]).mockReturnValueOnce(
      pending.promise.then((ids) => {
        events.push("sweep settled");
        return ids;
      }),
    );
    const done = start(h).then(() => {
      events.push("runWorker resolved");
    });
    await vi.advanceTimersByTimeAsync(1_000);

    h.shutdown.abort();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(events).toEqual([]);

    pending.resolve([]);
    await done;
    expect(events).toEqual(["sweep settled", "runWorker resolved"]);
  });
});

describe("claim loop", () => {
  it("claims a run, executes it and finalizes it as completed", async () => {
    const h = setup();
    h.runs.claimNext.mockResolvedValueOnce(fakeRun("r1"));
    const done = start(h);
    await vi.advanceTimersByTimeAsync(0);

    expect(h.runs.claimNext).toHaveBeenCalledWith(WORKER_ID);
    expect(h.execute).toHaveBeenCalledTimes(1);
    expect(h.execute.mock.calls[0]?.[0].id).toBe("r1");
    expect(h.runs.transition).toHaveBeenCalledWith("r1", "completed");
    expect(h.logged("run finalized")[0]).toMatchObject({
      runId: "r1",
      status: "completed",
    });
    await stop(h, done);
  });

  it("polls again every pollMs while idle", async () => {
    const h = setup({ pollMs: 100 });
    const done = start(h);
    await vi.advanceTimersByTimeAsync(0);
    expect(h.runs.claimNext).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(h.runs.claimNext).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(100);
    expect(h.runs.claimNext).toHaveBeenCalledTimes(3);
    await stop(h, done);
  });

  it("logs the error and retries on the next poll when claimNext fails", async () => {
    const h = setup({ pollMs: 100 });
    h.runs.claimNext.mockRejectedValueOnce(new Error("params: canary-claim"));
    const done = start(h);
    await vi.advanceTimersByTimeAsync(0);
    expect(h.logged("claiming a run failed")).toHaveLength(1);
    expect(JSON.stringify(h.lines)).not.toContain("canary-claim");
    expect(h.runs.claimNext).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(h.runs.claimNext).toHaveBeenCalledTimes(2);
    await stop(h, done);
  });

  it("runs two runs at once with concurrency 2", async () => {
    const h = setup({ concurrency: 2 });
    h.runs.claimNext
      .mockResolvedValueOnce(fakeRun("r1"))
      .mockResolvedValueOnce(fakeRun("r2"));
    const first = deferred<RunOutcome>();
    const second = deferred<RunOutcome>();
    h.execute
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const done = start(h);
    await vi.advanceTimersByTimeAsync(0);

    expect(h.execute).toHaveBeenCalledTimes(2);
    expect(h.runs.transition).not.toHaveBeenCalled();
    first.resolve("completed");
    second.resolve("completed");
    await stop(h, done);
    expect(h.runs.transition).toHaveBeenCalledTimes(2);
  });

  it("marks the run failed and logs only name and code when the executor throws", async () => {
    const h = setup();
    h.runs.claimNext.mockResolvedValueOnce(fakeRun("r1"));
    h.execute.mockRejectedValueOnce(new Error("prompt: canary-prompt"));
    const done = start(h);
    await vi.advanceTimersByTimeAsync(0);

    expect(h.runs.transition).toHaveBeenCalledWith("r1", "failed");
    expect(h.logged("run executor threw")[0]).toMatchObject({
      level: 50,
      err: { type: "Error" },
    });
    expect(JSON.stringify(h.lines)).not.toContain("canary-prompt");
    await stop(h, done);
  });

  it("warns and keeps looping when the run can no longer be finalized", async () => {
    const h = setup({ pollMs: 100 });
    h.runs.claimNext.mockResolvedValueOnce(fakeRun("r1"));
    h.runs.transition.mockRejectedValueOnce(
      new InvalidTransitionError("cancelled", "completed"),
    );
    const done = start(h);
    await vi.advanceTimersByTimeAsync(0);

    expect(
      h.logged("run could not be finalized; status changed meanwhile"),
    ).toHaveLength(1);
    // Claimed again right after finalizing, then once per poll.
    expect(h.runs.claimNext).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(100);
    expect(h.runs.claimNext).toHaveBeenCalledTimes(3);
    await stop(h, done);
  });

  it("warns when the run no longer exists at finalization", async () => {
    const h = setup();
    h.runs.claimNext.mockResolvedValueOnce(fakeRun("r1"));
    h.runs.transition.mockResolvedValueOnce(null);
    const done = start(h);
    await vi.advanceTimersByTimeAsync(0);
    expect(h.logged("run no longer exists; not finalized")).toHaveLength(1);
    await stop(h, done);
  });

  it("logs and keeps looping when finalizing fails on the database", async () => {
    const h = setup({ pollMs: 100 });
    h.runs.claimNext.mockResolvedValueOnce(fakeRun("r1"));
    h.runs.transition.mockRejectedValueOnce(new Error("db down"));
    const done = start(h);
    await vi.advanceTimersByTimeAsync(100);
    expect(h.logged("finalizing the run failed")).toHaveLength(1);
    expect(h.runs.claimNext).toHaveBeenCalledTimes(3);
    await stop(h, done);
  });
});

describe("heartbeat", () => {
  it("beats every heartbeatMs while the executor is pending and stops after finalize", async () => {
    const h = setup({ heartbeatMs: 15_000 });
    const running = deferred<RunOutcome>();
    h.runs.claimNext.mockResolvedValueOnce(fakeRun("r1"));
    h.execute.mockReturnValue(running.promise);
    const done = start(h);
    await vi.advanceTimersByTimeAsync(14_999);
    expect(h.runs.heartbeat).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(h.runs.heartbeat).toHaveBeenCalledTimes(1);
    expect(h.runs.heartbeat).toHaveBeenCalledWith("r1", WORKER_ID);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(h.runs.heartbeat).toHaveBeenCalledTimes(2);

    running.resolve("completed");
    await vi.advanceTimersByTimeAsync(0);
    expect(h.runs.transition).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(h.runs.heartbeat).toHaveBeenCalledTimes(2);
    await stop(h, done);
  });

  it("aborts the executor and does not finalize when the heartbeat reports the run lost", async () => {
    const h = setup({ heartbeatMs: 1_000 });
    h.runs.claimNext.mockResolvedValueOnce(fakeRun("r1"));
    h.runs.heartbeat.mockResolvedValue(false);
    let aborted = false;
    h.execute.mockImplementation(
      (_run, signal) =>
        new Promise((resolve) => {
          signal.addEventListener("abort", () => {
            aborted = true;
            resolve("completed");
          });
        }),
    );
    const done = start(h);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(aborted).toBe(true);
    expect(h.runs.transition).not.toHaveBeenCalled();
    expect(h.logged("run no longer owned by this worker")).toHaveLength(1);
    await stop(h, done);
  });

  it("warns and keeps beating when the heartbeat fails on the database", async () => {
    const h = setup({ heartbeatMs: 1_000 });
    const running = deferred<RunOutcome>();
    h.runs.claimNext.mockResolvedValueOnce(fakeRun("r1"));
    h.execute.mockReturnValue(running.promise);
    h.runs.heartbeat.mockRejectedValueOnce(new Error("db down"));
    const done = start(h);
    await vi.advanceTimersByTimeAsync(2_000);

    expect(h.runs.heartbeat).toHaveBeenCalledTimes(2);
    expect(h.logged("heartbeat failed")).toHaveLength(1);
    running.resolve("completed");
    await stop(h, done);
  });
});

describe("shutdown", () => {
  it("stops an idle worker at once, without waiting for the poll", async () => {
    const h = setup({ pollMs: 60_000 });
    const done = start(h);
    await vi.advanceTimersByTimeAsync(0);
    expect(h.runs.claimNext).toHaveBeenCalledTimes(1);
    await stop(h, done);
    expect(h.runs.claimNext).toHaveBeenCalledTimes(1);
  });

  it("claims nothing new and finalizes the run in progress if it ends within the grace", async () => {
    const h = setup({ shutdownGraceMs: 5_000, pollMs: 100 });
    const running = deferred<RunOutcome>();
    h.runs.claimNext.mockResolvedValueOnce(fakeRun("r1"));
    h.execute.mockReturnValue(running.promise);
    const done = start(h);
    await vi.advanceTimersByTimeAsync(0);

    h.shutdown.abort();
    await vi.advanceTimersByTimeAsync(4_999);
    expect(h.runs.transition).not.toHaveBeenCalled();

    running.resolve("completed");
    await done;
    expect(h.runs.transition).toHaveBeenCalledWith("r1", "completed");
    expect(h.runs.claimNext).toHaveBeenCalledTimes(1);
  });

  it("aborts the executor when the grace expires and leaves an interrupted run running", async () => {
    const h = setup({ shutdownGraceMs: 5_000 });
    h.runs.claimNext.mockResolvedValueOnce(fakeRun("r1"));
    let signalSeen: AbortSignal | undefined;
    h.execute.mockImplementation((_run, signal) => {
      signalSeen = signal;
      return new Promise((resolve) => {
        signal.addEventListener("abort", () => {
          resolve("interrupted");
        });
      });
    });
    const done = start(h);
    await vi.advanceTimersByTimeAsync(0);

    h.shutdown.abort();
    await vi.advanceTimersByTimeAsync(4_999);
    expect(signalSeen?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(signalSeen?.aborted).toBe(true);

    await done;
    expect(h.runs.transition).not.toHaveBeenCalled();
    expect(h.logged("run interrupted; left running")).toHaveLength(1);
  });

  it("starts the grace immediately for a run claimed after shutdown was requested", async () => {
    const h = setup({ shutdownGraceMs: 2_000 });
    const claim = deferred<Run | null>();
    h.runs.claimNext.mockReturnValueOnce(claim.promise);
    let aborted = false;
    h.execute.mockImplementation(
      (_run, signal) =>
        new Promise((resolve) => {
          signal.addEventListener("abort", () => {
            aborted = true;
            resolve("interrupted");
          });
        }),
    );
    const done = start(h);
    await vi.advanceTimersByTimeAsync(0);
    h.shutdown.abort();
    claim.resolve(fakeRun("r1"));
    await vi.advanceTimersByTimeAsync(2_000);
    expect(aborted).toBe(true);
    await done;
  });
});
