import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as agents from "./index.js";

describe("public API", () => {
  it("exports exactly the roles, schemas and the team factory", () => {
    expect(Object.keys(agents).sort()).toEqual(
      [
        "AgentLimitsSchema",
        "AnalystOutputSchema",
        "CriticOutputSchema",
        "ManagerOutputSchema",
        "RESEARCH_TEAM_ROLES",
        "ResearcherOutputSchema",
        "analystRole",
        "buildResearchTeam",
        "criticRole",
        "managerRole",
        "researcherRole",
      ].sort(),
    );
  });

  it("declares exactly the . export and the file exists", () => {
    const manifest: unknown = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    );
    const exportsField =
      typeof manifest === "object" && manifest !== null && "exports" in manifest
        ? manifest.exports
        : undefined;
    const expected = { ".": "./src/index.ts" };
    expect(exportsField).toEqual(expected);
    for (const target of Object.values(expected)) {
      expect(
        existsSync(fileURLToPath(new URL(`../${target}`, import.meta.url))),
      ).toBe(true);
    }
  });
});

describe("no source file reads the process environment", () => {
  const srcDir = fileURLToPath(new URL(".", import.meta.url));
  const files = readdirSync(srcDir, {
    recursive: true,
    encoding: "utf8",
  }).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

  it("scans a non-trivial set of source files", () => {
    expect(files.length).toBeGreaterThanOrEqual(7);
  });

  it.each(["process.env", "process[", "globalThis.process", "node:process"])(
    "no source file contains %s",
    (needle) => {
      for (const file of files) {
        const text = readFileSync(`${srcDir}${file}`, "utf8");
        expect(text, file).not.toContain(needle);
      }
    },
  );
});
