import { afterEach, describe, expect, it, vi } from "vitest";
import { ProviderConfigInvalidError } from "@agentlab/core";
import { OpenAICompatibleProvider } from "./provider.js";
import { BASE, CAPS } from "./test-server.js";

const CANARY_KEY = "CANARY-xyz";

afterEach(() => {
  vi.unstubAllEnvs();
});

function build(key: string, apiKeyEnv: string | null = "OPENROUTER_API_KEY") {
  return new OpenAICompatibleProvider({
    id: "openrouter",
    baseUrl: BASE,
    apiKeyEnv,
    capabilities: CAPS,
    secretResolver: () => key,
  });
}

function capture(fn: () => unknown): unknown {
  try {
    fn();
  } catch (err) {
    return err;
  }
  return undefined;
}

function expectSanitized(err: unknown): void {
  expect(err).toBeInstanceOf(ProviderConfigInvalidError);
  if (!(err instanceof ProviderConfigInvalidError)) return;
  expect(err.message).not.toContain("CANARY");
  expect(String(err)).not.toContain("CANARY");
  expect(JSON.stringify(err)).not.toContain("CANARY");
  expect(err.cause).toBeUndefined();
}

describe("client construction with an invalid header value (security MEDIUM, TASK-020 cycle 1)", () => {
  it("rejects a key with CR/LF without leaking it when OPENAI_CUSTOM_HEADERS is set", () => {
    vi.stubEnv("OPENAI_CUSTOM_HEADERS", "X-A: b");
    expectSanitized(capture(() => build(`${CANARY_KEY}\r\nx`)));
  });

  it("rejects a key with an interior NUL without leaking it when OPENAI_CUSTOM_HEADERS is set", () => {
    vi.stubEnv("OPENAI_CUSTOM_HEADERS", "X-A: b");
    expectSanitized(capture(() => build(`${CANARY_KEY}\u0000x`)));
  });

  // A NUL cannot travel in an environment variable (it truncates the value), so the invalid
  // OPENAI_CUSTOM_HEADERS entry uses a header name that is not an HTTP token. The SDK quotes
  // that name in its TypeError (openai internal/headers.js:55).
  it("rejects an invalid OPENAI_CUSTOM_HEADERS name without leaking it", () => {
    vi.stubEnv("OPENAI_CUSTOM_HEADERS", `${CANARY_KEY} bad: v`);
    expectSanitized(capture(() => build("sk-valid-key")));
  });

  it("rejects an invalid OPENAI_CUSTOM_HEADERS name for a keyless provider", () => {
    vi.stubEnv("OPENAI_CUSTOM_HEADERS", `${CANARY_KEY} bad: v`);
    expectSanitized(capture(() => build("unused", null)));
  });
});
