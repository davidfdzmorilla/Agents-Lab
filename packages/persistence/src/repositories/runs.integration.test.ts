import {
  InvalidTransitionError,
  RUN_STATUSES,
  canTransition,
  isTerminalRunStatus,
  loadTestDatabaseUrl,
  type InvocationError,
  InvocationErrorSchema,
  type RunStatus,
} from "@agentlab/core";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase, createPool } from "../pool.js";
import { runs } from "../schema/index.js";
import {
  createQueuedRun,
  createRunningRun,
  createScope,
  type TestScope,
} from "../testing/fixtures.js";
import { truncateAll } from "../testing/index.js";
import { createRunsRepository } from "./runs.js";

const pool = createPool(loadTestDatabaseUrl(), { max: 6 });
const db = createDatabase(pool);
const repo = createRunsRepository(db);
let scope: TestScope;

beforeEach(async () => {
  await truncateAll(db);
  scope = await createScope(db);
});

afterAll(async () => {
  await pool.end();
});

async function runInStatus(status: RunStatus) {
  const run = await createQueuedRun(db, scope);
  await db.update(runs).set({ status }).where(eq(runs.id, run.id));
  return run;
}

describe("create and get", () => {
  it("creates a queued run with a null finished_at", async () => {
    const run = await createQueuedRun(db, scope);
    expect(run.status).toBe("queued");
    expect(run.cancelRequested).toBe(false);
    expect(run.finishedAt).toBeNull();
    expect(await repo.get(run.id)).toEqual(run);
  });

  it("returns null for an id that does not exist", async () => {
    expect(await repo.get(randomUUID())).toBeNull();
  });
});

describe("transition", () => {
  const combinations = RUN_STATUSES.flatMap((from) =>
    RUN_STATUSES.map((to) => [from, to] as const),
  );

  it.each(combinations)("%s -> %s follows canTransition", async (from, to) => {
    const run = await runInStatus(from);
    if (canTransition(from, to)) {
      const updated = await repo.transition(run.id, to);
      expect(updated?.status).toBe(to);
      expect(updated?.finishedAt !== null).toBe(isTerminalRunStatus(to));
    } else {
      const error = await repo.transition(run.id, to).then(
        () => null,
        (caught: unknown) => caught,
      );
      expect(error).toBeInstanceOf(InvalidTransitionError);
      expect(error).toMatchObject({ code: "INVALID_TRANSITION", from, to });
      expect((await repo.get(run.id))?.status).toBe(from);
      expect((await repo.get(run.id))?.finishedAt).toBeNull();
    }
  });

  it("returns null when the run does not exist", async () => {
    expect(await repo.transition(randomUUID(), "running")).toBeNull();
  });

  it("refreshes updated_at on every transition", async () => {
    const run = await createQueuedRun(db, scope);
    const updated = await repo.transition(run.id, "cancelled");
    expect(updated?.updatedAt.getTime()).toBeGreaterThan(
      run.updatedAt.getTime(),
    );
  });
});

describe("claimNext", () => {
  it("returns null when nothing is queued", async () => {
    expect(await repo.claimNext("w1")).toBeNull();
  });

  it("claims a run: running, worker, heartbeat and started_at set", async () => {
    const run = await createQueuedRun(db, scope);
    const claimed = await repo.claimNext("w1");
    expect(claimed?.id).toBe(run.id);
    expect(claimed?.status).toBe("running");
    expect(claimed?.workerId).toBe("w1");
    expect(claimed?.workerHeartbeatAt).not.toBeNull();
    expect(claimed?.startedAt).not.toBeNull();
  });

  it("claims the oldest run first", async () => {
    const first = await createQueuedRun(db, scope);
    const second = await createQueuedRun(db, scope);
    expect((await repo.claimNext("w1"))?.id).toBe(first.id);
    expect((await repo.claimNext("w1"))?.id).toBe(second.id);
  });

  it("keeps started_at when a recovered run is claimed again", async () => {
    await createQueuedRun(db, scope);
    const first = await repo.claimNext("w1");
    await repo.transition(first?.id ?? "", "queued");
    const again = await repo.claimNext("w2");
    expect(again?.startedAt).toEqual(first?.startedAt);
    expect(again?.workerId).toBe("w2");
  });

  it("lets exactly one of two concurrent callers claim a single queued run", async () => {
    await createQueuedRun(db, scope);
    const results = await Promise.all([
      repo.claimNext("w1"),
      repo.claimNext("w2"),
    ]);
    expect(results.filter((run) => run !== null)).toHaveLength(1);
  });

  it("claims N distinct runs from 2N concurrent calls", async () => {
    const created = await Promise.all(
      Array.from({ length: 8 }, () => createQueuedRun(db, scope)),
    );
    const results = await Promise.all(
      Array.from({ length: 16 }, (_, i) => repo.claimNext(`w${i}`)),
    );
    const ids = results.flatMap((run) => (run === null ? [] : [run.id]));
    expect(ids).toHaveLength(8);
    expect(new Set(ids)).toEqual(new Set(created.map((run) => run.id)));
  });

  it("skips a row locked by another transaction instead of waiting", async () => {
    const run = await createQueuedRun(db, scope);
    const holder = await pool.connect();
    try {
      await holder.query("BEGIN");
      await holder.query("SELECT id FROM runs WHERE id = $1 FOR UPDATE", [
        run.id,
      ]);
      expect(await repo.claimNext("w1")).toBeNull();
    } finally {
      await holder.query("ROLLBACK");
      holder.release();
    }
    expect((await repo.claimNext("w1"))?.id).toBe(run.id);
  });
});

describe("heartbeat", () => {
  it("refreshes worker_heartbeat_at and returns true for the owning worker", async () => {
    await createQueuedRun(db, scope);
    const claimed = await repo.claimNext("w1");
    await db.execute(
      sql`update runs set worker_heartbeat_at = now() - interval '1 hour' where id = ${claimed?.id ?? ""}::uuid`,
    );
    expect(await repo.heartbeat(claimed?.id ?? "", "w1")).toBe(true);
    const after = await repo.get(claimed?.id ?? "");
    expect(after?.workerHeartbeatAt?.getTime()).toBeGreaterThan(
      Date.now() - 60_000,
    );
  });

  it("returns false for a different worker", async () => {
    await createQueuedRun(db, scope);
    const claimed = await repo.claimNext("w1");
    expect(await repo.heartbeat(claimed?.id ?? "", "w2")).toBe(false);
  });

  it("returns false when the run is not running", async () => {
    const run = await createQueuedRun(db, scope);
    expect(await repo.heartbeat(run.id, "w1")).toBe(false);
  });
});

describe("failOrphaned", () => {
  const error: InvocationError = {
    code: "WORKER_INTERRUPTED",
    message: "Worker stopped before the run finished",
    retryable: false,
  };
  const current = "hostA/current";
  const FRESH = 5_000;
  const OLD = 120_000;
  const STALE_MS = 60_000;

  async function seed() {
    const staleOtherHost = await createRunningRun(db, scope, {
      workerId: "hostB/old",
      heartbeatAgeMs: OLD,
    });
    const previousRunSameHost = await createRunningRun(db, scope, {
      workerId: "hostA/previous",
      heartbeatAgeMs: FRESH,
    });
    const nullHeartbeat = await createRunningRun(db, scope, {
      workerId: "hostB/nohb",
      heartbeatAgeMs: null,
    });
    const freshOtherHost = await createRunningRun(db, scope, {
      workerId: "hostB/live",
      heartbeatAgeMs: FRESH,
    });
    const ownFresh = await createRunningRun(db, scope, {
      workerId: current,
      heartbeatAgeMs: FRESH,
    });
    const ownOld = await createRunningRun(db, scope, {
      workerId: current,
      heartbeatAgeMs: OLD,
    });
    const prefixTrap = await createRunningRun(db, scope, {
      workerId: "hostAA/other",
      heartbeatAgeMs: FRESH,
    });
    const queued = await createQueuedRun(db, scope);
    const awaiting = {
      ...(await runInStatus("awaiting_approval")),
      status: "awaiting_approval",
    };
    const completed = {
      ...(await runInStatus("completed")),
      status: "completed",
    };
    return {
      staleOtherHost,
      previousRunSameHost,
      nullHeartbeat,
      untouched: [
        freshOtherHost,
        ownFresh,
        ownOld,
        prefixTrap,
        queued,
        awaiting,
        completed,
      ],
    };
  }

  async function expectUntouched(
    ids: readonly { id: string; status: string }[],
  ) {
    for (const before of ids) {
      expect((await repo.get(before.id))?.status).toBe(before.status);
    }
  }

  it("marks stale, null-heartbeat and previous same-host runs with hostPrefix", async () => {
    const rows = await seed();
    const ids = await repo.failOrphaned({
      currentWorkerId: current,
      staleMs: STALE_MS,
      error,
      hostPrefix: "hostA/",
    });
    expect([...ids].sort()).toEqual(
      [
        rows.staleOtherHost.id,
        rows.previousRunSameHost.id,
        rows.nullHeartbeat.id,
      ].sort(),
    );
    await expectUntouched(rows.untouched);
  });

  it("ignores the host criterion without hostPrefix", async () => {
    const rows = await seed();
    const ids = await repo.failOrphaned({
      currentWorkerId: current,
      staleMs: STALE_MS,
      error,
    });
    expect([...ids].sort()).toEqual(
      [rows.staleOtherHost.id, rows.nullHeartbeat.id].sort(),
    );
    expect((await repo.get(rows.previousRunSameHost.id))?.status).toBe(
      "running",
    );
    await expectUntouched(rows.untouched);
  });

  it("never marks the current worker even with an expired heartbeat", async () => {
    const own = await createRunningRun(db, scope, {
      workerId: current,
      heartbeatAgeMs: OLD,
    });
    for (const hostPrefix of [undefined, "hostA/"]) {
      const ids = await repo.failOrphaned({
        currentWorkerId: current,
        staleMs: STALE_MS,
        error,
        ...(hostPrefix === undefined ? {} : { hostPrefix }),
      });
      expect(ids).toEqual([]);
    }
    expect((await repo.get(own.id))?.status).toBe("running");
  });

  it("stores the error, finished_at and a refreshed updated_at on marked runs", async () => {
    const run = await createRunningRun(db, scope, {
      workerId: "hostB/old",
      heartbeatAgeMs: OLD,
    });
    await repo.failOrphaned({
      currentWorkerId: current,
      staleMs: STALE_MS,
      error,
    });
    const after = await repo.get(run.id);
    expect(after?.status).toBe("failed");
    expect(after?.error).toEqual(error);
    expect(InvocationErrorSchema.safeParse(after?.error).success).toBe(true);
    expect(after?.finishedAt).not.toBeNull();
    expect(after?.updatedAt.getTime()).toBeGreaterThan(run.updatedAt.getTime());
  });

  it("relies on running to failed being an allowed transition", () => {
    expect(canTransition("running", "failed")).toBe(true);
  });

  it("does not mark a run whose heartbeat is refreshed by an uncommitted transaction", async () => {
    const run = await createRunningRun(db, scope, {
      workerId: "hostB/old",
      heartbeatAgeMs: OLD,
    });
    const client = await pool.connect();
    let sweep: Promise<string[]> | undefined;
    try {
      await client.query("begin");
      await client.query(
        "update runs set worker_heartbeat_at = now() where id = $1",
        [run.id],
      );
      let settled = false;
      sweep = repo
        .failOrphaned({ currentWorkerId: current, staleMs: STALE_MS, error })
        .finally(() => {
          settled = true;
        });
      // Let the sweep reach the row lock; it must still be waiting.
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(settled).toBe(false);
      await client.query("commit");
    } catch (cause) {
      await client.query("rollback");
      throw cause;
    } finally {
      client.release();
    }
    expect(await sweep).toEqual([]);
    expect((await repo.get(run.id))?.status).toBe("running");
  });
});
