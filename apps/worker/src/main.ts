import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { loadEnv } from "@agentlab/core";
import {
  checkpointSchemaExists,
  createDatabase,
  createPool,
  createRunsRepository,
} from "@agentlab/persistence";
import { noopExecutor, type RunExecutor } from "./executor.js";
import { createLogger } from "./logger.js";
import { runWorker } from "./worker.js";

// Past the grace period the executor gets this long to return "interrupted" before the process exits.
export const SHUTDOWN_MARGIN_MS = 5000;

const SCHEMA_MISSING_MESSAGE =
  'langgraph schema not found: run "pnpm db:migrate" (docker compose: the migrate service) before starting the worker';

/** Composition root. Resolves with the process exit code; never throws. */
export async function main(options: {
  readonly shutdown: AbortSignal;
  readonly executor?: RunExecutor;
}): Promise<number> {
  const { shutdown } = options;

  // Single fields only: the Env object holds secrets and is never logged or serialized (TD-011).
  let env: ReturnType<typeof loadEnv>;
  try {
    env = loadEnv();
  } catch (error) {
    createLogger({ level: "error" }).fatal(
      { err: error },
      "invalid environment configuration",
    );
    return 1;
  }
  const logger = createLogger({ level: env.LOG_LEVEL });
  const heartbeatMs = env.WORKER_HEARTBEAT_MS;
  const staleMs = env.WORKER_STALE_MS;
  const shutdownGraceMs = env.SHUTDOWN_GRACE_MS;

  // The sweeps of other workers rely on this: a live run's heartbeat must always be fresher than the threshold.
  if (heartbeatMs >= staleMs) {
    logger.fatal(
      { heartbeatMs, staleMs },
      "WORKER_HEARTBEAT_MS must be lower than WORKER_STALE_MS",
    );
    return 1;
  }

  const onShutdown = () => {
    logger.info("shutdown requested");
    setTimeout(
      () => process.exit(0),
      shutdownGraceMs + SHUTDOWN_MARGIN_MS,
    ).unref();
  };
  if (shutdown.aborted) onShutdown();
  else shutdown.addEventListener("abort", onShutdown, { once: true });

  const pool = createPool(env.DATABASE_URL);
  pool.on("error", (error) => {
    logger.error({ err: error }, "idle database client error");
  });
  try {
    if (!(await checkpointSchemaExists(pool))) {
      logger.fatal(SCHEMA_MISSING_MESSAGE);
      return 1;
    }

    const host = hostname();
    const workerId = `${host}/${randomUUID()}`;
    logger.info(
      {
        workerId,
        concurrency: env.WORKER_CONCURRENCY,
        heartbeatMs,
        pollMs: env.WORKER_POLL_MS,
        staleMs,
        shutdownGraceMs,
      },
      "worker started",
    );

    await runWorker(
      {
        runs: createRunsRepository(createDatabase(pool)),
        executor: options.executor ?? noopExecutor,
        logger,
        workerId,
        hostPrefix: `${host}/`,
        concurrency: env.WORKER_CONCURRENCY,
        heartbeatMs,
        pollMs: env.WORKER_POLL_MS,
        staleMs,
        shutdownGraceMs,
      },
      shutdown,
    );
    logger.info("worker stopped");
    return 0;
  } catch (error) {
    logger.fatal({ err: error }, "worker failed");
    return 1;
  } finally {
    await pool.end();
  }
}
