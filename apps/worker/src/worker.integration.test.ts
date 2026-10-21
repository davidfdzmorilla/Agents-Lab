import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { fileURLToPath } from "node:url";
import { loadTestDatabaseUrl, InvocationErrorSchema } from "@agentlab/core";
import { createRunsRepository } from "@agentlab/persistence";
import {
  createQueuedRun,
  createRunningRun,
  createScope,
  createTestDatabase,
  truncateAll,
  type TestScope,
} from "@agentlab/persistence/testing";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { WORKER_INTERRUPTED_ERROR } from "./worker.js";

// Real child processes against the real test database. Waits are on log lines and exit events;
// the only real timer is the 30 s ceiling of waitFor, so a hung child fails the test instead of hanging it.
const WORKER_DIR = fileURLToPath(new URL("..", import.meta.url));
const WAIT_CEILING_MS = 30_000;

const testUrl = loadTestDatabaseUrl();
const { pool, db } = createTestDatabase(testUrl);
const runs = createRunsRepository(db);
let scope: TestScope;
const children: ChildProcessWithoutNullStreams[] = [];

type Line = Record<string, unknown>;
type Exit = { code: number | null; signal: NodeJS.Signals | null };

interface WorkerProcess {
  readonly child: ChildProcessWithoutNullStreams;
  readonly exited: Promise<Exit>;
  output(): string;
  waitFor(predicate: (line: Line) => boolean, label: string): Promise<Line>;
  send(text: string): void;
}

function spawnWorker(
  entry: "src/index.ts" | "src/testing/gated-main.ts",
  extraEnv: Record<string, string> = {},
): WorkerProcess {
  // Built, not copied from process.env (testing-conventions rule 5): no *_API_KEY leaks into the child.
  const env: Record<string, string> = {
    DATABASE_URL: testUrl,
    LOG_LEVEL: "info",
    WORKER_POLL_MS: "100",
    ...extraEnv,
  };
  const child = spawn(process.execPath, ["--import", "tsx", entry], {
    cwd: WORKER_DIR,
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  children.push(child);

  const lines: Line[] = [];
  const chunks: string[] = [];
  const listeners = new Set<() => void>();
  const buffers = { stdout: "", stderr: "" };
  for (const name of ["stdout", "stderr"] as const) {
    child[name].setEncoding("utf8");
    child[name].on("data", (chunk: string) => {
      chunks.push(chunk);
      buffers[name] += chunk;
      let newline = buffers[name].indexOf("\n");
      while (newline >= 0) {
        const text = buffers[name].slice(0, newline);
        buffers[name] = buffers[name].slice(newline + 1);
        try {
          lines.push(JSON.parse(text) as Line);
        } catch {
          lines.push({ raw: text });
        }
        newline = buffers[name].indexOf("\n");
      }
      listeners.forEach((listener) => {
        listener();
      });
    });
  }
  // stdin errors (EPIPE after the child exits) must not fail the test run.
  child.stdin.on("error", () => undefined);

  const exited = new Promise<Exit>((resolve) => {
    child.on("close", (code, signal) => {
      resolve({ code, signal });
      listeners.forEach((listener) => {
        listener();
      });
    });
  });
  let closed = false;
  void exited.then(() => {
    closed = true;
  });

  return {
    child,
    exited,
    output: () => chunks.join(""),
    send: (text) => {
      child.stdin.write(text);
    },
    waitFor: (predicate, label) =>
      new Promise<Line>((resolve, reject) => {
        const check = () => {
          const found = lines.find(predicate);
          if (found !== undefined) {
            cleanup();
            resolve(found);
          } else if (closed) {
            cleanup();
            reject(
              new Error(
                `child exited before "${label}"; output:\n${chunks.join("")}`,
              ),
            );
          }
        };
        const timer = setTimeout(() => {
          cleanup();
          reject(
            new Error(
              `timeout waiting for "${label}"; output:\n${chunks.join("")}`,
            ),
          );
        }, WAIT_CEILING_MS);
        const cleanup = () => {
          clearTimeout(timer);
          listeners.delete(check);
        };
        listeners.add(check);
        check();
      }),
  };
}

const msg = (text: string) => (line: Line) => line["msg"] === text;
const sweep = (kind: "startup" | "periodic", count: number) => (line: Line) =>
  line["msg"] === "orphaned runs marked failed" &&
  line["sweep"] === kind &&
  line["count"] === count;

beforeEach(async () => {
  await truncateAll(db);
  scope = await createScope(db);
});

afterEach(() => {
  for (const child of children.splice(0)) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
    }
  }
});

afterAll(async () => {
  await pool.end();
});

describe("worker process", () => {
  it("completes a queued run, refreshes its heartbeat and exits 0 on SIGTERM", async () => {
    const queued = await createQueuedRun(db, scope);
    expect(queued.workerHeartbeatAt).toBeNull();
    const worker = spawnWorker("src/index.ts");

    await worker.waitFor(msg("run finalized"), "run finalized");
    const row = await runs.get(queued.id);
    expect(row?.status).toBe("completed");
    expect(row?.workerId?.startsWith(`${hostname()}/`)).toBe(true);
    expect(row?.workerHeartbeatAt).not.toBeNull();
    expect(row?.finishedAt).not.toBeNull();

    const started = await worker.waitFor(
      msg("worker started"),
      "worker started",
    );
    expect(started["workerId"]).toBe(row?.workerId);

    worker.child.kill("SIGTERM");
    expect(await worker.exited).toEqual({ code: 0, signal: null });
  });

  it("exits 0 on SIGTERM while idle", async () => {
    const worker = spawnWorker("src/index.ts");
    await worker.waitFor(sweep("startup", 0), "startup sweep");
    worker.child.kill("SIGTERM");
    expect(await worker.exited).toEqual({ code: 0, signal: null });
  });

  it("waits for the run in progress after SIGTERM and completes it when released", async () => {
    const queued = await createQueuedRun(db, scope);
    const worker = spawnWorker("src/testing/gated-main.ts");
    await worker.waitFor(msg("run claimed"), "run claimed");

    worker.child.kill("SIGTERM");
    await worker.waitFor(msg("shutdown requested"), "shutdown requested");
    expect((await runs.get(queued.id))?.status).toBe("running");
    expect(worker.child.exitCode).toBeNull();

    worker.send("release\n");
    expect(await worker.exited).toEqual({ code: 0, signal: null });
    expect((await runs.get(queued.id))?.status).toBe("completed");
  });

  it("exits 0 leaving the run running when the grace expires, and the next start marks it failed", async () => {
    const queued = await createQueuedRun(db, scope);
    const first = spawnWorker("src/testing/gated-main.ts", {
      SHUTDOWN_GRACE_MS: "300",
    });
    await first.waitFor(msg("run claimed"), "run claimed");
    first.child.kill("SIGTERM");
    expect(await first.exited).toEqual({ code: 0, signal: null });

    const left = await runs.get(queued.id);
    expect(left?.status).toBe("running");
    expect(left?.finishedAt).toBeNull();

    const second = spawnWorker("src/index.ts");
    await second.waitFor(sweep("startup", 1), "startup sweep with one run");
    const swept = await runs.get(queued.id);
    expect(swept?.status).toBe("failed");
    expect(InvocationErrorSchema.parse(swept?.error)).toEqual(
      WORKER_INTERRUPTED_ERROR,
    );
    second.child.kill("SIGTERM");
    expect(await second.exited).toEqual({ code: 0, signal: null });
  });

  it("exits 0 on a SIGTERM sent while the process is still starting", async () => {
    const worker = spawnWorker("src/testing/gated-main.ts");
    await worker.waitFor(
      msg("signal handlers registered"),
      "signal handlers registered",
    );
    worker.child.kill("SIGTERM");
    expect(await worker.exited).toEqual({ code: 0, signal: null });
  });

  it("exits 0 on SIGTERM although the event loop was blocked for 200 ms", async () => {
    const queued = await createQueuedRun(db, scope);
    const worker = spawnWorker("src/testing/gated-main.ts");
    await worker.waitFor(msg("run claimed"), "run claimed");

    worker.send("block 200\n");
    await worker.waitFor(msg("blocking"), "blocking");
    worker.child.kill("SIGTERM");
    await worker.waitFor(msg("shutdown requested"), "shutdown requested");
    worker.send("release\n");

    expect(await worker.exited).toEqual({ code: 0, signal: null });
    expect((await runs.get(queued.id))?.status).toBe("completed");
  });
});

describe("startup sweep (process)", () => {
  it("fails stale, null-heartbeat and earlier same-host runs, and leaves the rest", async () => {
    const host = hostname();
    const sameHostEarlier = await createRunningRun(db, scope, {
      workerId: `${host}/${randomUUID()}`,
      heartbeatAgeMs: 5_000,
    });
    const otherHostStale = await createRunningRun(db, scope, {
      workerId: `other-host/${randomUUID()}`,
      heartbeatAgeMs: 120_000,
    });
    const nullHeartbeat = await createRunningRun(db, scope, {
      workerId: `other-host/${randomUUID()}`,
      heartbeatAgeMs: null,
    });
    const otherHostFresh = await createRunningRun(db, scope, {
      workerId: `other-host/${randomUUID()}`,
      heartbeatAgeMs: 5_000,
    });
    const queued = await createQueuedRun(db, scope);

    const worker = spawnWorker("src/index.ts");
    await worker.waitFor(sweep("startup", 3), "startup sweep with three runs");
    await worker.waitFor(msg("run finalized"), "run finalized");

    for (const run of [sameHostEarlier, otherHostStale, nullHeartbeat]) {
      const row = await runs.get(run.id);
      expect(row?.status).toBe("failed");
      expect(InvocationErrorSchema.parse(row?.error)).toEqual(
        WORKER_INTERRUPTED_ERROR,
      );
      expect(row?.finishedAt).not.toBeNull();
    }
    expect((await runs.get(otherHostFresh.id))?.status).toBe("running");
    expect((await runs.get(queued.id))?.status).toBe("completed");

    worker.child.kill("SIGTERM");
    expect(await worker.exited).toEqual({ code: 0, signal: null });
  });
});

describe("periodic sweep (process)", () => {
  it("fails a foreign stale run and spares the own run and a same-host run with a fresh heartbeat", async () => {
    const queued = await createQueuedRun(db, scope);
    const worker = spawnWorker("src/testing/gated-main.ts", {
      WORKER_HEARTBEAT_MS: "200",
      WORKER_STALE_MS: "1000",
    });
    await worker.waitFor(sweep("startup", 0), "startup sweep");
    await worker.waitFor(msg("run claimed"), "run claimed");

    const foreignStale = await createRunningRun(db, scope, {
      workerId: `other-host/${randomUUID()}`,
      heartbeatAgeMs: 120_000,
    });
    // A heartbeat in the future stays fresh for the whole test; only the startup (host) criterion would catch it.
    const sameHostFresh = await createRunningRun(db, scope, {
      workerId: `${hostname()}/${randomUUID()}`,
      heartbeatAgeMs: -600_000,
    });

    await worker.waitFor(sweep("periodic", 1), "periodic sweep with one run");
    const failed = await runs.get(foreignStale.id);
    expect(failed?.status).toBe("failed");
    expect(InvocationErrorSchema.parse(failed?.error)).toEqual(
      WORKER_INTERRUPTED_ERROR,
    );
    expect((await runs.get(sameHostFresh.id))?.status).toBe("running");
    expect((await runs.get(queued.id))?.status).toBe("running");

    worker.send("release\n");
    await worker.waitFor(msg("run finalized"), "run finalized");
    expect((await runs.get(queued.id))?.status).toBe("completed");
    worker.child.kill("SIGTERM");
    expect(await worker.exited).toEqual({ code: 0, signal: null });
  });
});

describe("startup checks (process)", () => {
  it("exits 1 before connecting when WORKER_HEARTBEAT_MS is not lower than WORKER_STALE_MS", async () => {
    const worker = spawnWorker("src/index.ts", {
      WORKER_HEARTBEAT_MS: "60000",
      WORKER_STALE_MS: "60000",
      DATABASE_URL: "postgres://u:p@127.0.0.1:1/x",
    });
    expect((await worker.exited).code).toBe(1);
    expect(worker.output()).toContain(
      "WORKER_HEARTBEAT_MS must be lower than WORKER_STALE_MS",
    );
    expect(worker.output()).not.toContain("ECONNREFUSED");
  });

  it("exits 1 telling to run pnpm db:migrate when the langgraph schema is missing, without leaking secrets", async () => {
    const dbCanary = "canary-application-name-6e2b";
    const keyCanary = "canary-openrouter-key-b81d";
    const url = new URL(testUrl);
    url.pathname = "/postgres";
    url.searchParams.set("application_name", dbCanary);
    const worker = spawnWorker("src/index.ts", {
      DATABASE_URL: url.toString(),
      OPENROUTER_API_KEY: keyCanary,
      LOG_LEVEL: "debug",
    });

    expect((await worker.exited).code).toBe(1);
    const output = worker.output();
    expect(output).toContain("pnpm db:migrate");
    expect(output).not.toContain(dbCanary);
    expect(output).not.toContain(keyCanary);
    if (url.password !== "") expect(output).not.toContain(url.password);
  });
});
