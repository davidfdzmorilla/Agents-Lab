import { describe, expect, it } from "vitest";
import {
  ProviderCapabilityError,
  type GenerateRequest,
  type ProviderCapabilities,
} from "@agentlab/core";
import { assertCapabilities } from "./capabilities.js";

const full: ProviderCapabilities = {
  tools: true,
  structuredOutput: true,
  streaming: false,
  maxContextTokens: null,
  reportsUsage: true,
  reportsCost: false,
};
const none: ProviderCapabilities = {
  ...full,
  tools: false,
  structuredOutput: false,
};

function req(extra: Partial<GenerateRequest> = {}): GenerateRequest {
  return {
    model: "m",
    messages: [{ role: "user", content: "hi" }],
    requires: {},
    maxOutputTokens: 10,
    timeoutMs: 1000,
    ...extra,
  };
}

describe("assertCapabilities", () => {
  it("accepts a plain request on a provider without optional capabilities", () => {
    expect(() => assertCapabilities("p", none, req())).not.toThrow();
  });

  it("accepts tools and structured output when the provider supports them", () => {
    expect(() =>
      assertCapabilities(
        "p",
        full,
        req({
          requires: { tools: true, structuredOutput: true },
          tools: [{ name: "t", description: "d", parameters: {} }],
          responseSchema: {},
        }),
      ),
    ).not.toThrow();
  });

  it("rejects requires.tools when tools is unsupported", () => {
    expect(() =>
      assertCapabilities("p", none, req({ requires: { tools: true } })),
    ).toThrow(ProviderCapabilityError);
  });

  it("rejects requires.structuredOutput when unsupported", () => {
    expect(() =>
      assertCapabilities(
        "p",
        none,
        req({ requires: { structuredOutput: true } }),
      ),
    ).toThrow(ProviderCapabilityError);
  });

  it("rejects a non-empty tools list even without requires (no silent degradation)", () => {
    expect(() =>
      assertCapabilities(
        "p",
        none,
        req({ tools: [{ name: "t", description: "d", parameters: {} }] }),
      ),
    ).toThrow(ProviderCapabilityError);
  });

  it("ignores an empty tools list", () => {
    expect(() =>
      assertCapabilities("p", none, req({ tools: [] })),
    ).not.toThrow();
  });

  it("rejects a responseSchema even without requires", () => {
    expect(() =>
      assertCapabilities("p", none, req({ responseSchema: {} })),
    ).toThrow(ProviderCapabilityError);
  });

  it("names the provider and is not retryable", () => {
    try {
      assertCapabilities(
        "openrouter",
        none,
        req({ requires: { tools: true } }),
      );
      expect.unreachable();
    } catch (err) {
      if (!(err instanceof ProviderCapabilityError)) throw err;
      expect(err.message).toContain("openrouter");
      expect(err.retryable).toBe(false);
    }
  });
});
