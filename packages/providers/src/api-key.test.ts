import { describe, expect, it, vi } from "vitest";
import { ProviderAuthError } from "@agentlab/core";
import { resolveApiKey } from "./api-key.js";

const CANARY = "sk-canary-0123456789abcdef";

function failure(apiKeyEnv: string, value?: string): ProviderAuthError {
  try {
    resolveApiKey("p", apiKeyEnv, () => value);
  } catch (err) {
    if (err instanceof ProviderAuthError) return err;
  }
  throw new Error("expected a ProviderAuthError");
}

describe("resolveApiKey", () => {
  it("returns the resolved value and asks the resolver once with the variable name", () => {
    const resolver = vi.fn(() => CANARY);
    expect(resolveApiKey("p", "GEMINI_API_KEY", resolver)).toBe(CANARY);
    expect(resolver).toHaveBeenCalledExactlyOnceWith("GEMINI_API_KEY");
  });

  it.each([undefined, ""])("rejects an unusable value (%j)", (value) => {
    expect(failure("GEMINI_API_KEY", value).retryable).toBe(false);
  });

  it("quotes a well-formed variable name", () => {
    expect(failure("GEMINI_API_KEY").message).toContain("GEMINI_API_KEY");
  });

  it("does not quote a malformed name, which could be a pasted key", () => {
    expect(failure(CANARY).message).not.toContain(CANARY);
  });

  it("does not quote a name longer than 40 characters", () => {
    const long = `${"A".repeat(40)}_API_KEY`;
    expect(failure(long).message).not.toContain(long);
  });
});
