import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import type pg from "pg";

export const CHECKPOINT_SCHEMA = "langgraph";

// Never call saver.end(): it would close the pool the caller owns (ADR-002).
export async function setupCheckpointer(pool: pg.Pool): Promise<void> {
  const saver = new PostgresSaver(pool, undefined, {
    schema: CHECKPOINT_SCHEMA,
  });
  await saver.setup();
}

export async function checkpointSchemaExists(pool: pg.Pool): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    "select exists(select 1 from pg_namespace where nspname = $1) as exists",
    [CHECKPOINT_SCHEMA],
  );
  return result.rows[0]?.exists === true;
}
