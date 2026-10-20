import { index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAtColumn, idColumn, updatedAtColumn } from "./columns.js";
import { projects } from "./projects.js";

// api_key_env holds the NAME of an environment variable and has no CHECK on purpose (OD-023):
// a rejected value must not reach the database logs. ProviderConfigsRepository validates it.
export const providerConfigs = pgTable(
  "provider_configs",
  {
    id: idColumn(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    providerType: text("provider_type").notNull(),
    baseUrl: text("base_url"),
    defaultModel: text("default_model").notNull(),
    apiKeyEnv: text("api_key_env"),
  },
  (table) => [index("provider_configs_project_id_idx").on(table.projectId)],
);

export type ProviderConfigRow = typeof providerConfigs.$inferSelect;
