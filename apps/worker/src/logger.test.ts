import { EnvValidationError } from "@agentlab/core";
import { describe, expect, it } from "vitest";
import { REDACT_PATHS, createLogger } from "./logger.js";

const CANARIES = {
  DATABASE_URL: "canary-database-url-4d1f",
  DATABASE_URL_TEST: "canary-database-url-test-9b7e",
  OPENROUTER_API_KEY: "canary-openrouter-key-2a6c",
  GEMINI_API_KEY: "canary-gemini-key-71e0",
};

function capture() {
  const chunks: string[] = [];
  const logger = createLogger({
    level: "debug",
    destination: {
      write: (chunk: string) => {
        chunks.push(chunk);
      },
    },
  });
  return { logger, output: () => chunks.join("") };
}

describe("logger redaction", () => {
  it("derives the redact paths from the declared env names", () => {
    expect(REDACT_PATHS).toEqual(
      expect.arrayContaining([
        "DATABASE_URL",
        "*.DATABASE_URL",
        "DATABASE_URL_TEST",
        "*.DATABASE_URL_TEST",
        "OPENROUTER_API_KEY",
        "*.GEMINI_API_KEY",
      ]),
    );
    expect(REDACT_PATHS).not.toContain("LOG_LEVEL");
  });

  it("hides secrets logged at the root of the record", () => {
    const { logger, output } = capture();
    logger.info(CANARIES, "root");
    const text = output();
    for (const canary of Object.values(CANARIES)) {
      expect(text).not.toContain(canary);
    }
    expect(text).toContain("[REDACTED]");
  });

  it("hides secrets logged one level deep", () => {
    const { logger, output } = capture();
    logger.info({ config: CANARIES }, "nested");
    const text = output();
    for (const canary of Object.values(CANARIES)) {
      expect(text).not.toContain(canary);
    }
    expect(text).toContain("[REDACTED]");
  });

  it("does not log the message of errors that are not AgentLabError", () => {
    const { logger, output } = capture();
    logger.error(
      { err: new Error(`insert failed with params ${CANARIES.DATABASE_URL}`) },
      "driver failure",
    );
    const text = output();
    expect(text).not.toContain(CANARIES.DATABASE_URL);
    expect(JSON.parse(text)).toMatchObject({ err: { type: "Error" } });
  });

  it("keeps the code of driver errors", () => {
    const { logger, output } = capture();
    const error = Object.assign(new Error("hidden"), { code: "ECONNREFUSED" });
    logger.error({ err: error }, "connect failed");
    expect(JSON.parse(output())).toMatchObject({
      err: { type: "Error", code: "ECONNREFUSED" },
    });
  });

  it("logs type, code and message of AgentLabError", () => {
    const { logger, output } = capture();
    logger.error({ err: new EnvValidationError("bad env") }, "invalid");
    expect(JSON.parse(output())).toMatchObject({
      err: {
        type: "EnvValidationError",
        code: "ENV_INVALID",
        message: "bad env",
      },
    });
  });

  it("logs only the type of a thrown non-error value", () => {
    const { logger, output } = capture();
    logger.error({ err: CANARIES.GEMINI_API_KEY }, "thrown string");
    const text = output();
    expect(text).not.toContain(CANARIES.GEMINI_API_KEY);
    expect(JSON.parse(text)).toMatchObject({ err: { type: "string" } });
  });
});
