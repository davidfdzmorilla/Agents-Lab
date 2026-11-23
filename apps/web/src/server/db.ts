import {
  createDatabase,
  createPool,
  type Database,
} from "@agentlab/persistence";

export const DB_TIMEOUT_MS = 2000;

// One pool per request (TD-038): the single place TASK-014 replaces with the shared pool.
export async function withDatabase<T>(
  databaseUrl: string,
  run: (db: Database) => Promise<T>,
): Promise<T> {
  const pool = createPool(databaseUrl, {
    max: 1,
    connectionTimeoutMillis: DB_TIMEOUT_MS,
  });
  // An idle client error must not take the process down.
  pool.on("error", () => undefined);
  try {
    return await run(createDatabase(pool));
  } finally {
    void pool.end().catch(() => undefined);
  }
}
