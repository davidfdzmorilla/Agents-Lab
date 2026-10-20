import type { Budget } from "@agentlab/core";
import { jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { createdAtColumn, idColumn, updatedAtColumn } from "./columns.js";

export const projects = pgTable("projects", {
  id: idColumn(),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
  name: text("name").notNull(),
  budgetProfile: jsonb("budget_profile").$type<Budget>().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
