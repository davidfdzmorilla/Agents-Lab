import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as persistence from "./index.js";
import * as migrate from "./migrate.js";

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
        "pingDatabase",
      ].sort(),
    );
  });

  it("exposes runMigrations only through the explicit ./migrate sub-export", () => {
    const manifest: unknown = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    );
    const exportsField =
      typeof manifest === "object" && manifest !== null && "exports" in manifest
        ? manifest.exports
        : undefined;
    const expectedExports = {
      ".": "./src/index.ts",
      "./migrate": "./src/migrate.ts",
      "./testing": "./src/testing/index.ts",
    };
    expect(exportsField).toEqual(expectedExports);
    for (const target of Object.values(expectedExports)) {
      const file = fileURLToPath(new URL(`../${target}`, import.meta.url));
      expect(existsSync(file)).toBe(true);
    }
    expect(Object.keys(migrate)).toEqual(["runMigrations"]);
    expect(Object.keys(persistence)).not.toContain("runMigrations");
  });
});
