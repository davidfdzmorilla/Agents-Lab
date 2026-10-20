import { AGENT_ROLES, type AgentRole } from "@agentlab/core";
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  jsonb,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import {
  createdAtColumn,
  idColumn,
  inList,
  updatedAtColumn,
} from "./columns.js";
import { runs } from "./runs.js";

export const tasks = pgTable(
  "tasks",
  {
    id: idColumn(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    parentTaskId: uuid("parent_task_id").references(
      (): AnyPgColumn => tasks.id,
      { onDelete: "cascade" },
    ),
    title: text("title").notNull(),
    assignedRole: text("assigned_role").$type<AgentRole>().notNull(),
    dependsOn: uuid("depends_on")
      .array()
      .notNull()
      .default(sql`'{}'`),
    status: text("status").notNull(),
    input: jsonb("input"),
    output: jsonb("output"),
  },
  (table) => [
    check("tasks_assigned_role_check", inList(table.assignedRole, AGENT_ROLES)),
  ],
);

export type TaskRow = typeof tasks.$inferSelect;
export type NewTaskRow = typeof tasks.$inferInsert;
