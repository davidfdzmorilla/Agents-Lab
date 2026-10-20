import { defineConfig } from "drizzle-kit";

// No dbCredentials on purpose: generate needs no database, and push/migrate cannot touch one.
// schemaFilter keeps Drizzle away from the langgraph schema (ADR-002).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  schemaFilter: ["public"],
  strict: true,
  verbose: true,
});
