import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as providers from "./index.js";
import * as testing from "./testing/index.js";

describe("public API", () => {
  it("exports only the adapter from the index and the fake only from ./testing", () => {
    expect(Object.keys(providers)).toEqual(["OpenAICompatibleProvider"]);
    expect(Object.keys(testing)).toEqual(["FakeProvider"]);
  });

  it("declares exactly the . and ./testing sub-exports, and the files exist", () => {
    const manifest: unknown = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    );
    const exportsField =
      typeof manifest === "object" && manifest !== null && "exports" in manifest
        ? manifest.exports
        : undefined;
    const expected = {
      ".": "./src/index.ts",
      "./testing": "./src/testing/index.ts",
    };
    expect(exportsField).toEqual(expected);
    for (const target of Object.values(expected)) {
      expect(
        existsSync(fileURLToPath(new URL(`../${target}`, import.meta.url))),
      ).toBe(true);
    }
  });
});

describe("no adapter reads the process environment", () => {
  const srcDir = fileURLToPath(new URL(".", import.meta.url));
  const files = readdirSync(srcDir, {
    recursive: true,
    encoding: "utf8",
  }).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

  it("scans a non-trivial set of source files", () => {
    expect(files.length).toBeGreaterThanOrEqual(6);
  });

  it.each([
    "process.env",
    "process[",
    "globalThis.process",
    "node:process",
    "globalThis[",
  ])("no source file contains %s", (needle) => {
    for (const file of files) {
      const text = readFileSync(`${srcDir}${file}`, "utf8");
      expect(text, file).not.toContain(needle);
    }
  });
});
