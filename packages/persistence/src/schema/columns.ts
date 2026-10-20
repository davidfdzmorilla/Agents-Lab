import { sql, type AnyColumn, type SQL } from "drizzle-orm";
import { timestamp, uuid } from "drizzle-orm/pg-core";

export const idColumn = () =>
  uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`);

export const createdAtColumn = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const updatedAtColumn = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// Values come from constant lists exported by core, never from user input.
export function inList(column: AnyColumn, values: readonly string[]): SQL {
  const literals = values.map((value) => `'${value.replaceAll("'", "''")}'`);
  return sql`${column} in (${sql.raw(literals.join(", "))})`;
}
