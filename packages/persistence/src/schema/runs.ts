import {
  RUN_STATUSES,
  type Budget,
  type RunRequest,
  type RunStatus,
} from "@agentlab/core";
import {
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import {
  createdAtColumn,
  idColumn,
  inList,
  updatedAtColumn,
} from "./columns.js";
import { projects } from "./projects.js";
import { teamDefinitions } from "./team-definitions.js";

export const runs = pgTable(
  "runs",
  {
    id: idColumn(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "restrict" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teamDefinitions.id, { onDelete: "restrict" }),
    request: jsonb("request").$type<RunRequest>().notNull(),
    status: text("status").$type<RunStatus>().notNull().default("queued"),
    budget: jsonb("budget").$type<Budget>().notNull(),
    budgetUsed: jsonb("budget_used"),
    result: jsonb("result"),
    error: jsonb("error"),
    cancelRequested: boolean("cancel_requested").notNull().default(false),
    workerId: text("worker_id"),
    workerHeartbeatAt: timestamp("worker_heartbeat_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [
    index("runs_status_created_at_idx").on(table.status, table.createdAt),
    check("runs_status_check", inList(table.status, RUN_STATUSES)),
  ],
);

export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;
