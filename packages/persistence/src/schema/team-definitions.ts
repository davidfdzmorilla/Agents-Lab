import { pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAtColumn, idColumn, updatedAtColumn } from "./columns.js";
import { projects } from "./projects.js";

export const teamDefinitions = pgTable("team_definitions", {
  id: idColumn(),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  graphBuilder: text("graph_builder").notNull(),
  agentIds: uuid("agent_ids").array().notNull(),
});

export type TeamDefinitionRow = typeof teamDefinitions.$inferSelect;
export type NewTeamDefinitionRow = typeof teamDefinitions.$inferInsert;
