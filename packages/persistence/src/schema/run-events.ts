import { RUN_EVENT_TYPES, type RunEventType } from "@agentlab/core";
import {
  check,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import {
  createdAtColumn,
  idColumn,
  inList,
  updatedAtColumn,
} from "./columns.js";
import { runs } from "./runs.js";

export const runEvents = pgTable(
  "run_events",
  {
    id: idColumn(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    type: text("type").$type<RunEventType>().notNull(),
    payload: jsonb("payload").notNull(),
    ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("run_events_run_id_seq_unique").on(table.runId, table.seq),
    check("run_events_type_check", inList(table.type, RUN_EVENT_TYPES)),
  ],
);

export type RunEventRow = typeof runEvents.$inferSelect;
