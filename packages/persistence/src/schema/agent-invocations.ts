import {
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { agentDefinitions } from "./agent-definitions.js";
import { createdAtColumn, idColumn, updatedAtColumn } from "./columns.js";
import { runs } from "./runs.js";
import { tasks } from "./tasks.js";

export const agentInvocations = pgTable("agent_invocations", {
  id: idColumn(),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
  runId: uuid("run_id")
    .notNull()
    .references(() => runs.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  agentDefinitionId: uuid("agent_definition_id")
    .notNull()
    .references(() => agentDefinitions.id, { onDelete: "restrict" }),
  step: integer("step").notNull(),
  providerType: text("provider_type").notNull(),
  modelId: text("model_id").notNull(),
  status: text("status").notNull(),
  attempt: integer("attempt").notNull().default(1),
  durationMs: integer("duration_ms"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  costReported: numeric("cost_reported"),
  validation: jsonb("validation"),
  error: jsonb("error"),
});

export type AgentInvocationRow = typeof agentInvocations.$inferSelect;
export type NewAgentInvocationRow = typeof agentInvocations.$inferInsert;
