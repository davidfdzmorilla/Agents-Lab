import { z } from "zod";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EnvSchema,
  createSecretResolver,
  isApiKeyEnvName,
  loadEnv,
  loadTestDatabaseUrl,
} from "./env.js";
import { EnvValidationError } from "./errors.js";

const DB = "postgres://user@localhost:5432/agentlab";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("loadEnv", () => {
  it("fails naming the variable when DATABASE_URL is missing", () => {
    expect(() => loadEnv({})).toThrow(EnvValidationError);
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });

  it("treats an empty string as not defined", () => {
    expect(() => loadEnv({ DATABASE_URL: "" })).toThrow(/DATABASE_URL/);
    const env = loadEnv({
      DATABASE_URL: DB,
      OPENROUTER_API_KEY: "",
      AGENTLAB_PROVIDER: "",
    });
    expect(env.OPENROUTER_API_KEY).toBeUndefined();
    expect(env.AGENTLAB_PROVIDER).toBeUndefined();
  });

  it("applies documented defaults", () => {
    expect(loadEnv({ DATABASE_URL: DB })).toEqual({
      DATABASE_URL: DB,
      WORKER_CONCURRENCY: 1,
      WORKER_HEARTBEAT_MS: 15000,
      WORKER_STALE_MS: 60000,
      WORKER_POLL_MS: 1000,
      SHUTDOWN_GRACE_MS: 30000,
      LOG_LEVEL: "info",
      LANGCHAIN_TRACING_V2: "false",
    });
  });

  it("coerces numeric variables and reads optional ones", () => {
    const env = loadEnv({
      DATABASE_URL: DB,
      WORKER_CONCURRENCY: "4",
      LANGCHAIN_TRACING_V2: "true",
      AGENTLAB_PROVIDER: "gemini",
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318",
    });
    expect(env.WORKER_CONCURRENCY).toBe(4);
    expect(env.LANGCHAIN_TRACING_V2).toBe("true");
    expect(env.AGENTLAB_PROVIDER).toBe("gemini");
  });

  it("coerces WORKER_POLL_MS from a string", () => {
    const env = loadEnv({ DATABASE_URL: DB, WORKER_POLL_MS: "250" });
    expect(env.WORKER_POLL_MS).toBe(250);
  });

  it("rejects non-positive and non-numeric WORKER_POLL_MS", () => {
    expect(() => loadEnv({ DATABASE_URL: DB, WORKER_POLL_MS: "0" })).toThrow(
      /WORKER_POLL_MS/,
    );
    expect(() => loadEnv({ DATABASE_URL: DB, WORKER_POLL_MS: "abc" })).toThrow(
      /WORKER_POLL_MS/,
    );
  });

  it("rejects invalid numbers, enums and tracing flag", () => {
    expect(() =>
      loadEnv({ DATABASE_URL: DB, WORKER_CONCURRENCY: "abc" }),
    ).toThrow(/WORKER_CONCURRENCY/);
    expect(() =>
      loadEnv({ DATABASE_URL: DB, WORKER_CONCURRENCY: "0" }),
    ).toThrow(/WORKER_CONCURRENCY/);
    expect(() => loadEnv({ DATABASE_URL: DB, LOG_LEVEL: "loud" })).toThrow(
      /LOG_LEVEL/,
    );
    expect(() =>
      loadEnv({ DATABASE_URL: DB, LANGCHAIN_TRACING_V2: "yes" }),
    ).toThrow(/LANGCHAIN_TRACING_V2/);
  });

  it("rejects a non-postgres DATABASE_URL", () => {
    expect(() => loadEnv({ DATABASE_URL: "http://localhost/db" })).toThrow(
      /DATABASE_URL/,
    );
  });

  it("never includes received values in the error message", () => {
    const canary = "not-a-url-canary-123";
    const key = "sk-canary-key-456";
    let message = "";
    try {
      loadEnv({
        DATABASE_URL: canary,
        OPENROUTER_API_KEY: key,
        GEMINI_API_KEY: key,
        LOG_LEVEL: canary,
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("DATABASE_URL");
    expect(message).not.toContain(canary);
    expect(message).not.toContain(key);
  });

  it("accepts http(s) URLs and rejects other schemes for OLLAMA_BASE_URL and OTLP", () => {
    for (const name of ["OLLAMA_BASE_URL", "OTEL_EXPORTER_OTLP_ENDPOINT"]) {
      expect(
        loadEnv({ DATABASE_URL: DB, [name]: "http://localhost:1" }),
      ).toBeDefined();
      expect(
        loadEnv({ DATABASE_URL: DB, [name]: "https://h.example/x" }),
      ).toBeDefined();
      for (const bad of [
        "file:///etc/passwd",
        "javascript:alert(1)",
        "ftp://h",
      ]) {
        expect(() => loadEnv({ DATABASE_URL: DB, [name]: bad })).toThrow(
          new RegExp(name),
        );
      }
    }
  });

  it("validates DATABASE_URL_TEST like DATABASE_URL", () => {
    const test = "postgresql://u@localhost:5432/agentlab_test";
    expect(
      loadEnv({ DATABASE_URL: DB, DATABASE_URL_TEST: test }).DATABASE_URL_TEST,
    ).toBe(test);
    expect(() =>
      loadEnv({ DATABASE_URL: DB, DATABASE_URL_TEST: "http://localhost/db" }),
    ).toThrow(/DATABASE_URL_TEST/);
    expect(() =>
      loadEnv({ DATABASE_URL: DB, DATABASE_URL_TEST: "nope" }),
    ).toThrow(/DATABASE_URL_TEST/);
  });

  it("keeps EnvValidationError.cause free of received values", () => {
    const canary = "canary-secret-789";
    let cause: unknown;
    try {
      loadEnv({
        DATABASE_URL: canary,
        OPENROUTER_API_KEY: canary,
        LOG_LEVEL: canary,
        OLLAMA_BASE_URL: canary,
      });
    } catch (error) {
      cause = (error as EnvValidationError).cause;
    }
    expect(cause).toBeInstanceOf(z.ZodError);
    const zodError = cause as z.ZodError;
    expect(zodError.message).not.toContain(canary);
    expect(JSON.stringify(zodError.issues)).not.toContain(canary);
    expect(JSON.stringify(zodError)).not.toContain(canary);
    expect(zodError.stack ?? "").not.toContain(canary);
  });

  it("reads process.env by default", () => {
    vi.stubEnv("DATABASE_URL", DB);
    expect(loadEnv().DATABASE_URL).toBe(DB);
  });
});

describe("createSecretResolver", () => {
  it("resolves a declared *_API_KEY name", () => {
    const resolve = createSecretResolver({
      OPENROUTER_API_KEY: "v",
      GEMINI_API_KEY: "w",
    });
    expect(resolve("OPENROUTER_API_KEY")).toBe("v");
    expect(resolve("GEMINI_API_KEY")).toBe("w");
  });

  it("returns undefined for an undeclared *_API_KEY", () => {
    expect(
      createSecretResolver({ OTHER_API_KEY: "v" })("OTHER_API_KEY"),
    ).toBeUndefined();
  });

  it("returns undefined for non-key names even if present in the source", () => {
    const resolve = createSecretResolver({
      DATABASE_URL: DB,
      PATH: "/bin",
      HOME: "/home/x",
      LANGCHAIN_TRACING_V2: "true",
      LANGCHAIN_API_KEY: "v",
    });
    for (const name of [
      "DATABASE_URL",
      "PATH",
      "HOME",
      "LANGCHAIN_TRACING_V2",
      "LANGCHAIN_API_KEY",
    ]) {
      expect(resolve(name)).toBeUndefined();
    }
  });

  it("returns undefined for lowercase, suffix-less and unanchored names", () => {
    const resolve = createSecretResolver({
      openrouter_api_key: "v",
      OPENROUTER_KEY: "v",
      "x OPENROUTER_API_KEY": "v",
      "OPENROUTER_API_KEY\n": "v",
      "1_API_KEY": "v",
    });
    for (const name of [
      "openrouter_api_key",
      "OPENROUTER_KEY",
      "x OPENROUTER_API_KEY",
      "OPENROUTER_API_KEY\n",
      "1_API_KEY",
    ]) {
      expect(resolve(name)).toBeUndefined();
    }
  });

  it("returns undefined for absent, empty and prototype names", () => {
    const resolve = createSecretResolver({
      GEMINI_API_KEY: "",
      OPENROUTER_API_KEY: undefined,
    });
    expect(resolve("MISSING")).toBeUndefined();
    expect(resolve("GEMINI_API_KEY")).toBeUndefined();
    expect(resolve("OPENROUTER_API_KEY")).toBeUndefined();
    expect(resolve("toString")).toBeUndefined();
    expect(resolve("__proto__")).toBeUndefined();
  });

  it("resolves exactly OPENROUTER_API_KEY and GEMINI_API_KEY among declared names", () => {
    const source: Record<string, string> = {};
    for (const key of Object.keys(EnvSchema.shape))
      source[key] = "canary-value";
    const resolve = createSecretResolver(source);
    const resolvable = Object.keys(EnvSchema.shape)
      .filter((key) => resolve(key) !== undefined)
      .sort();
    expect(resolvable).toEqual(["GEMINI_API_KEY", "OPENROUTER_API_KEY"]);
  });

  it("rejects near-miss names of declared keys", () => {
    const names = [
      "Gemini_API_KEY",
      "OPENROUTER_API_KEYS",
      "OPENROUTER_API_KEY_OLD",
      "X_OPENROUTER_API_KEY",
      " GEMINI_API_KEY",
      "FOO\nGEMINI_API_KEY",
      "DATABASE_URL_TEST",
    ];
    const source: Record<string, string> = {};
    for (const name of names) source[name] = "canary-value";
    const resolve = createSecretResolver(source);
    for (const name of names) expect(resolve(name)).toBeUndefined();
  });

  it("never throws on odd input", () => {
    const resolve = createSecretResolver({});
    expect(() => resolve("")).not.toThrow();
    expect(() => resolve("a b\u0000c")).not.toThrow();
  });

  it("reflects changes of the source on every call", () => {
    const source: Record<string, string | undefined> = {};
    const resolve = createSecretResolver(source);
    expect(resolve("GEMINI_API_KEY")).toBeUndefined();
    source["GEMINI_API_KEY"] = "late";
    expect(resolve("GEMINI_API_KEY")).toBe("late");
  });

  it("reads process.env by default", () => {
    vi.stubEnv("GEMINI_API_KEY", "from-process");
    expect(createSecretResolver()("GEMINI_API_KEY")).toBe("from-process");
  });
});

describe("loadTestDatabaseUrl", () => {
  const TEST_URL = "postgresql://tester@localhost:5432/agentlab_test";

  it("returns DATABASE_URL_TEST when valid", () => {
    expect(loadTestDatabaseUrl({ DATABASE_URL_TEST: TEST_URL })).toBe(TEST_URL);
  });

  it("fails with the fixed message when absent", () => {
    expect(() => loadTestDatabaseUrl({})).toThrow(EnvValidationError);
    expect(() => loadTestDatabaseUrl({})).toThrow(
      "DATABASE_URL_TEST is required for integration tests and db:reset (cp .env.example .env)",
    );
  });

  it("treats an empty string as absent", () => {
    expect(() => loadTestDatabaseUrl({ DATABASE_URL_TEST: "" })).toThrow(
      /is required/,
    );
  });

  it("does not fall back to DATABASE_URL", () => {
    expect(() => loadTestDatabaseUrl({ DATABASE_URL: DB })).toThrow(/required/);
  });

  it("rejects an invalid URL without echoing it", () => {
    const bad = "mysql://secretuser:secretpw@host/db";
    let message = "";
    try {
      loadTestDatabaseUrl({ DATABASE_URL_TEST: bad });
    } catch (e) {
      expect(e).toBeInstanceOf(EnvValidationError);
      message = (e as Error).message;
    }
    expect(message).not.toBe("");
    expect(message).not.toContain("secretpw");
    expect(message).not.toContain(bad);
  });

  it("reads process.env by default", () => {
    vi.stubEnv("DATABASE_URL_TEST", TEST_URL);
    expect(loadTestDatabaseUrl()).toBe(TEST_URL);
  });
});

describe("isApiKeyEnvName", () => {
  it("accepts a conforming name", () => {
    expect(isApiKeyEnvName("OPENROUTER_API_KEY")).toBe(true);
  });

  it.each([
    ["an OpenAI-style key", "sk-abc123"],
    ["a Google-style key", "AIzaSyExample"],
    ["lowercase", "openrouter_api_key"],
    ["empty", ""],
    ["no suffix", "OPENROUTER"],
  ])("rejects %s", (_label, name) => {
    expect(isApiKeyEnvName(name)).toBe(false);
  });
});
