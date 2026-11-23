import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const srcDir = join(import.meta.dirname, "..");

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        /\.tsx?$/.test(entry.name) &&
        !entry.name.endsWith(".test.ts"),
    )
    .map((entry) => join(entry.parentPath, entry.name));
}

// Built from pieces so this file does not match itself.
const FORBIDDEN = [
  "process" + ".env",
  "createSecret" + "Resolver",
  "Secret" + "Resolver",
];

describe("web has no access to provider secrets", () => {
  const files = [
    ...sources(join(srcDir, "server")),
    ...sources(join(srcDir, "app", "api", "providers")),
  ];

  it("scans the server and providers route sources", () => {
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  it.each(FORBIDDEN)(
    "no server or providers route source contains %s",
    (word) => {
      for (const file of files) {
        expect(readFileSync(file, "utf8"), file).not.toContain(word);
      }
    },
  );

  it("imports only the presets sub-export of providers, never the index or a provider SDK", () => {
    const all = [...files, ...sources(join(srcDir, "app"))];
    for (const file of all) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/from "@agentlab\/providers"/);
      expect(text, file).not.toMatch(/from "(openai|@google\/genai)/);
    }
  });
});

describe("project pages", () => {
  const pages = sources(join(srcDir, "app", "(app)", "projects"));

  it("finds the two pages", () => {
    expect(pages).toHaveLength(2);
  });

  it("are Server Components with no Server Actions or writes", () => {
    for (const file of pages) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/["']use (client|server)["']/);
      expect(text, file).not.toMatch(
        /\.create\(|\.insert\(|\.update\(|\.delete\(/,
      );
    }
  });
});
