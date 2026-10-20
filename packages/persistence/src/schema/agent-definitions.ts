import {
  AGENT_ROLES,
  type AgentDefinition,
  type AgentRole,
} from "@agentlab/core";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
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
import { projects } from "./projects.js";
import { providerConfigs } from "./provider-configs.js";

export const agentDefinitions = pgTable(
  "agent_definitions",
  {
    id: idColumn(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    role: text("role").$type<AgentRole>().notNull(),
    systemPrompt: text("system_prompt").notNull(),
    promptVersion: text("prompt_version").notNull(),
    providerConfigId: uuid("provider_config_id")
      .notNull()
      .references(() => providerConfigs.id, { onDelete: "restrict" }),
    modelId: text("model_id").notNull(),
    toolAllowlist: text("tool_allowlist")
      .array()
      .notNull()
      .default(sql`'{}'`),
    maxCalls: integer("max_calls").notNull(),
    maxTokens: integer("max_tokens").notNull(),
    timeoutMs: integer("timeout_ms").notNull(),
    outputSchema: jsonb("output_schema")
      .$type<AgentDefinition["outputSchema"]>()
      .notNull(),
    enabled: boolean("enabled").notNull().default(true),
  },
  (table) => [
    index("agent_definitions_project_id_idx").on(table.projectId),
    check("agent_definitions_role_check", inList(table.role, AGENT_ROLES)),
  ],
);

export type AgentDefinitionRow = typeof agentDefinitions.$inferSelect;
export type NewAgentDefinitionRow = typeof agentDefinitions.$inferInsert;
