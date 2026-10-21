import { describe, expect, it } from "vitest";
import * as persistence from "./index.js";

describe("public API", () => {
  it("exports only repositories and infrastructure, never Drizzle tables", () => {
    expect(Object.keys(persistence).sort()).toEqual(
      [
        "CHECKPOINT_SCHEMA",
        "checkpointSchemaExists",
        "createAgentDefinitionsRepository",
        "createDatabase",
        "createEventsRepository",
        "createPool",
        "createProjectsRepository",
        "createProviderConfigsRepository",
        "createRunsRepository",
        "runMigrations",
      ].sort(),
    );
  });
});
