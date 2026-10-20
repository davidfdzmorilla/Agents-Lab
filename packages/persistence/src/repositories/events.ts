import { RunEventSchema, type RunEvent } from "@agentlab/core";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import type { Database } from "../pool.js";
import { runEvents, runs, type RunEventRow } from "../schema/index.js";
import { requireRow } from "./rows.js";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

export type NewRunEvent = DistributiveOmit<RunEvent, "runId" | "seq" | "ts">;

export interface EventsRepository {
  /** Assigns the next seq atomically (ARCHITECTURE 3.4). Rejects events that fail RunEventSchema without inserting. */
  append(runId: string, event: NewRunEvent): Promise<RunEvent>;
  /** Events with seq > the given value, ascending. */
  listSince(runId: string, seq: number): Promise<RunEvent[]>;
}

function toRunEvent(row: RunEventRow): RunEvent {
  return RunEventSchema.parse({
    type: row.type,
    runId: row.runId,
    seq: row.seq,
    ts: row.ts.toISOString(),
    payload: row.payload,
  });
}

export function createEventsRepository(db: Database): EventsRepository {
  return {
    async append(runId, event) {
      RunEventSchema.parse({
        ...event,
        runId,
        seq: 1,
        ts: new Date().toISOString(),
      });
      const row = await db.transaction(async (tx) => {
        // FOR UPDATE is not allowed with MAX(), so the run row is the lock (OD-022).
        await tx
          .select({ id: runs.id })
          .from(runs)
          .where(eq(runs.id, runId))
          .for("update");
        const inserted = await tx.execute<{ id: string }>(sql`
          insert into run_events (run_id, seq, type, payload)
          select ${runId}::uuid, coalesce(max(seq), 0) + 1, ${event.type}, ${JSON.stringify(event.payload)}::jsonb
          from run_events where run_id = ${runId}::uuid
          returning id`);
        const id = requireRow(inserted.rows[0]).id;
        const [stored] = await tx
          .select()
          .from(runEvents)
          .where(eq(runEvents.id, id));
        return requireRow(stored);
      });
      return toRunEvent(row);
    },

    async listSince(runId, seq) {
      const rows = await db
        .select()
        .from(runEvents)
        .where(and(eq(runEvents.runId, runId), gt(runEvents.seq, seq)))
        .orderBy(asc(runEvents.seq));
      return rows.map(toRunEvent);
    },
  };
}
