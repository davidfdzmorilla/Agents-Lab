import {
  InvalidTransitionError,
  canTransition,
  isTerminalRunStatus,
  type Budget,
  type InvocationError,
  type RunRequest,
  type RunStatus,
} from "@agentlab/core";
import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../pool.js";
import { runs, type Run } from "../schema/index.js";
import { requireRow } from "./rows.js";

export interface CreateRunInput {
  readonly projectId: string;
  readonly teamId: string;
  readonly request: RunRequest;
  readonly budget: Budget;
}

export interface FailOrphanedInput {
  /** The caller's own worker_id; never marked, whatever its heartbeat. */
  readonly currentWorkerId: string;
  /** Heartbeat older than this, or null, means orphaned (WORKER_STALE_MS). */
  readonly staleMs: number;
  readonly error: InvocationError;
  /** worker_id prefix of this host ("<hostname>/"). When given, earlier runs of this host are orphaned regardless of heartbeat (startup sweep only). */
  readonly hostPrefix?: string;
}

export interface RunsRepository {
  create(input: CreateRunInput): Promise<Run>;
  get(id: string): Promise<Run | null>;
  claimNext(workerId: string): Promise<Run | null>;
  /** Throws InvalidTransitionError; resolves null when the run does not exist. */
  transition(id: string, to: RunStatus): Promise<Run | null>;
  /** False when the run is no longer running under this worker. */
  heartbeat(id: string, workerId: string): Promise<boolean>;
  /** Marks orphaned running runs failed in one statement; returns their ids. */
  failOrphaned(input: FailOrphanedInput): Promise<string[]>;
}

export function createRunsRepository(db: Database): RunsRepository {
  return {
    async create(input) {
      const [row] = await db.insert(runs).values(input).returning();
      return requireRow(row);
    },

    async get(id) {
      const [row] = await db.select().from(runs).where(eq(runs.id, id));
      return row ?? null;
    },

    async claimNext(workerId) {
      const [row] = await db
        .update(runs)
        .set({
          status: "running",
          workerId,
          workerHeartbeatAt: sql`now()`,
          startedAt: sql`coalesce(${runs.startedAt}, now())`,
          updatedAt: sql`now()`,
        })
        .where(
          eq(
            runs.id,
            sql`(select id from runs where status = 'queued' order by created_at, id limit 1 for update skip locked)`,
          ),
        )
        .returning();
      return row ?? null;
    },

    transition(id, to) {
      return db.transaction(async (tx) => {
        const [current] = await tx
          .select({ status: runs.status })
          .from(runs)
          .where(eq(runs.id, id))
          .for("update");
        if (current === undefined) return null;
        if (!canTransition(current.status, to)) {
          throw new InvalidTransitionError(current.status, to);
        }
        const [row] = await tx
          .update(runs)
          .set({
            status: to,
            updatedAt: sql`now()`,
            ...(isTerminalRunStatus(to) ? { finishedAt: sql`now()` } : {}),
          })
          .where(eq(runs.id, id))
          .returning();
        return requireRow(row);
      });
    },

    async heartbeat(id, workerId) {
      const updated = await db
        .update(runs)
        .set({ workerHeartbeatAt: sql`now()`, updatedAt: sql`now()` })
        .where(
          and(
            eq(runs.id, id),
            eq(runs.workerId, workerId),
            eq(runs.status, "running"),
          ),
        )
        .returning({ id: runs.id });
      return updated.length > 0;
    },

    async failOrphaned(input) {
      const hostMatch =
        input.hostPrefix === undefined
          ? sql``
          : sql` or starts_with(${runs.workerId}, ${input.hostPrefix})`;
      const updated = await db
        .update(runs)
        .set({
          status: "failed",
          error: input.error,
          finishedAt: sql`now()`,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(runs.status, "running"),
            sql`${runs.workerId} is distinct from ${input.currentWorkerId}`,
            sql`(${runs.workerHeartbeatAt} is null or ${runs.workerHeartbeatAt} < now() - ${input.staleMs} * interval '1 millisecond'${hostMatch})`,
          ),
        )
        .returning({ id: runs.id });
      return updated.map((row) => row.id);
    },
  };
}
