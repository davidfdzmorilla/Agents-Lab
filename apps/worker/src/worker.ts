import { InvalidTransitionError, type InvocationError } from "@agentlab/core";
import type { Run, RunsRepository } from "@agentlab/persistence";
import type { RunExecutor, RunOutcome } from "./executor.js";
import type { Logger } from "./logger.js";

export const WORKER_INTERRUPTED_ERROR: InvocationError = {
  code: "WORKER_INTERRUPTED",
  message:
    "Worker stopped before the run finished; marked failed by the orphaned-run sweep",
  retryable: false,
};

export interface WorkerDeps {
  readonly runs: Pick<
    RunsRepository,
    "failOrphaned" | "claimNext" | "transition" | "heartbeat"
  >;
  readonly executor: RunExecutor;
  readonly logger: Logger;
  /** "<hostname>/<uuid>", unique per process start. */
  readonly workerId: string;
  /** "<hostname>/": earlier runs of this host are orphaned at startup. */
  readonly hostPrefix: string;
  readonly concurrency: number;
  readonly heartbeatMs: number;
  readonly pollMs: number;
  readonly staleMs: number;
  readonly shutdownGraceMs: number;
}

/** Resolves when the timer fires or the signal aborts; never rejects. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Startup sweep once, then `concurrency` claim loops and the periodic sweep in parallel.
 * Rejects only when the startup sweep fails; resolves after every loop has stopped.
 */
export async function runWorker(
  deps: WorkerDeps,
  shutdown: AbortSignal,
): Promise<void> {
  const failed = await deps.runs.failOrphaned({
    currentWorkerId: deps.workerId,
    staleMs: deps.staleMs,
    error: WORKER_INTERRUPTED_ERROR,
    hostPrefix: deps.hostPrefix,
  });
  deps.logger.info(
    { count: failed.length, sweep: "startup" },
    "orphaned runs marked failed",
  );
  if (shutdown.aborted) return;

  const loops = Array.from({ length: deps.concurrency }, () =>
    claimLoop(deps, shutdown),
  );
  await Promise.all([...loops, sweepLoop(deps, shutdown)]);
}

// Sequential, not setInterval: a slow statement never overlaps the next one. Heartbeat-only criterion (never the host one).
async function sweepLoop(
  deps: WorkerDeps,
  shutdown: AbortSignal,
): Promise<void> {
  while (!shutdown.aborted) {
    await sleep(deps.staleMs, shutdown);
    if (shutdown.aborted) return;
    try {
      const failed = await deps.runs.failOrphaned({
        currentWorkerId: deps.workerId,
        staleMs: deps.staleMs,
        error: WORKER_INTERRUPTED_ERROR,
      });
      if (failed.length > 0) {
        deps.logger.info(
          { count: failed.length, sweep: "periodic" },
          "orphaned runs marked failed",
        );
      } else {
        deps.logger.debug(
          { count: 0, sweep: "periodic" },
          "orphaned runs marked failed",
        );
      }
    } catch (error) {
      deps.logger.warn({ err: error }, "orphaned run sweep failed");
    }
  }
}

async function claimLoop(
  deps: WorkerDeps,
  shutdown: AbortSignal,
): Promise<void> {
  while (!shutdown.aborted) {
    let run: Run | null;
    try {
      run = await deps.runs.claimNext(deps.workerId);
    } catch (error) {
      deps.logger.error({ err: error }, "claiming a run failed");
      await sleep(deps.pollMs, shutdown);
      continue;
    }
    if (run === null) {
      await sleep(deps.pollMs, shutdown);
      continue;
    }
    await processRun(deps, run, shutdown);
  }
}

type ExecutionResult =
  | { readonly kind: "outcome"; readonly outcome: RunOutcome }
  | { readonly kind: "threw"; readonly error: unknown };

async function processRun(
  deps: WorkerDeps,
  run: Run,
  shutdown: AbortSignal,
): Promise<void> {
  const { logger } = deps;
  const controller = new AbortController();
  let lost = false;
  logger.info({ runId: run.id }, "run claimed");

  const heartbeat = setInterval(() => {
    void (async () => {
      try {
        if (!(await deps.runs.heartbeat(run.id, deps.workerId))) {
          lost = true;
          logger.warn({ runId: run.id }, "run no longer owned by this worker");
          controller.abort();
        }
      } catch (error) {
        logger.warn({ err: error, runId: run.id }, "heartbeat failed");
      }
    })();
  }, deps.heartbeatMs);

  let graceTimer: NodeJS.Timeout | undefined;
  const onShutdown = () => {
    graceTimer = setTimeout(() => {
      logger.warn({ runId: run.id }, "shutdown grace expired; aborting run");
      controller.abort();
    }, deps.shutdownGraceMs);
  };
  if (shutdown.aborted) onShutdown();
  else shutdown.addEventListener("abort", onShutdown, { once: true });

  let result: ExecutionResult;
  try {
    result = {
      kind: "outcome",
      outcome: await deps.executor.execute(run, controller.signal),
    };
  } catch (error) {
    result = { kind: "threw", error };
  } finally {
    clearInterval(heartbeat);
    clearTimeout(graceTimer);
    shutdown.removeEventListener("abort", onShutdown);
  }

  if (lost) return;
  await finalize(deps, run, result);
}

async function finalize(
  deps: WorkerDeps,
  run: Run,
  result: ExecutionResult,
): Promise<void> {
  const { logger } = deps;
  if (result.kind === "outcome" && result.outcome === "interrupted") {
    logger.info({ runId: run.id }, "run interrupted; left running");
    return;
  }
  const to = result.kind === "outcome" ? "completed" : "failed";
  if (result.kind === "threw") {
    logger.error({ err: result.error, runId: run.id }, "run executor threw");
  }
  try {
    const updated = await deps.runs.transition(run.id, to);
    if (updated === null) {
      logger.warn({ runId: run.id }, "run no longer exists; not finalized");
    } else {
      logger.info({ runId: run.id, status: to }, "run finalized");
    }
  } catch (error) {
    if (error instanceof InvalidTransitionError) {
      logger.warn(
        { err: error, runId: run.id },
        "run could not be finalized; status changed meanwhile",
      );
    } else {
      logger.error({ err: error, runId: run.id }, "finalizing the run failed");
    }
  }
}
