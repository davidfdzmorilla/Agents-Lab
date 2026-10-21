import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";

export type Database = NodePgDatabase<typeof schema>;

export function createPool(
  connectionString: string,
  options: {
    readonly max?: number;
    readonly connectionTimeoutMillis?: number;
  } = {},
): pg.Pool {
  return new pg.Pool({
    connectionString,
    ...(options.max === undefined ? {} : { max: options.max }),
    ...(options.connectionTimeoutMillis === undefined
      ? {}
      : { connectionTimeoutMillis: options.connectionTimeoutMillis }),
  });
}

export function createDatabase(pool: pg.Pool): Database {
  return drizzle(pool, { schema });
}
