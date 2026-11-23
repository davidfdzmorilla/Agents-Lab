import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ProviderConfigInvalidError } from "@agentlab/core";
import {
  GEMINI_CAPABILITIES,
  PROVIDER_PRESETS,
  PROVIDER_TYPES,
  isProviderType,
  providerConfigFromRecord,
} from "./presets.js";
import { GeminiProvider } from "./gemini/provider.js";

const ID = "7d6f0e0c-5c1c-4c0e-9a55-1f6a2a0f6b11";

const OPENAI_CAPS = {
  tools: true,
  structuredOutput: true,
  streaming: false,
  maxContextTokens: null,
  reportsUsage: true,
  reportsCost: false,
};

function record(
  providerType: string,
  apiKeyEnv: string | null,
  extra: Record<string, unknown> = {},
) {
  return { id: ID, providerType, apiKeyEnv, ...extra };
}

function thrown(fn: () => unknown): unknown {
  try {
    fn();
  } catch (err) {
    return err;
  }
  return undefined;
}

describe("PROVIDER_TYPES and PROVIDER_PRESETS", () => {
  it("lists exactly the three closed types, frozen", () => {
    expect(PROVIDER_TYPES).toEqual(["openrouter", "ollama", "gemini"]);
    expect(Object.isFrozen(PROVIDER_TYPES)).toBe(true);
    expect(isProviderType("ollama")).toBe(true);
    expect(isProviderType("openai-compatible")).toBe(false);
  });

  it("matches the confirmed D3 table", () => {
    expect(PROVIDER_PRESETS).toEqual({
      openrouter: {
        adapter: "openai-compatible",
        apiKey: "required",
        capabilities: OPENAI_CAPS,
      },
      ollama: {
        adapter: "openai-compatible",
        apiKey: "none",
        capabilities: OPENAI_CAPS,
      },
      gemini: {
        adapter: "gemini",
        apiKey: "required",
        capabilities: {
          tools: true,
          structuredOutput: true,
          streaming: false,
          maxContextTokens: null,
          reportsUsage: true,
          reportsCost: false,
        },
      },
    });
  });

  it("freezes the presets and their capabilities", () => {
    expect(Object.isFrozen(PROVIDER_PRESETS)).toBe(true);
    for (const type of PROVIDER_TYPES) {
      expect(Object.isFrozen(PROVIDER_PRESETS[type])).toBe(true);
      expect(Object.isFrozen(PROVIDER_PRESETS[type].capabilities)).toBe(true);
    }
  });

  it("is the single source of the Gemini capabilities the adapter reports", () => {
    expect(PROVIDER_PRESETS.gemini.capabilities).toBe(GEMINI_CAPABILITIES);
    const provider = new GeminiProvider({
      id: "g",
      apiKeyEnv: "GEMINI_API_KEY",
      secretResolver: () => "AIza-canary-presets",
    });
    expect(provider.capabilities).toBe(GEMINI_CAPABILITIES);
  });
});

describe("providerConfigFromRecord", () => {
  it("maps openrouter to the OpenAI-compatible adapter with the preset URL", () => {
    expect(
      providerConfigFromRecord(record("openrouter", "OPENROUTER_API_KEY")),
    ).toEqual({
      type: "openai-compatible",
      id: ID,
      baseUrl: "https://openrouter.ai/api/v1",
      apiKeyEnv: "OPENROUTER_API_KEY",
      capabilities: OPENAI_CAPS,
    });
  });

  it("maps ollama to the OpenAI-compatible adapter without a key", () => {
    expect(providerConfigFromRecord(record("ollama", null))).toEqual({
      type: "openai-compatible",
      id: ID,
      baseUrl: "http://ollama:11434/v1/",
      apiKeyEnv: null,
      capabilities: OPENAI_CAPS,
    });
  });

  it("maps gemini to the Gemini adapter", () => {
    expect(
      providerConfigFromRecord(record("gemini", "GEMINI_API_KEY")),
    ).toEqual({
      type: "gemini",
      id: ID,
      apiKeyEnv: "GEMINI_API_KEY",
    });
  });

  it.each([
    ["openrouter", "OPENROUTER_API_KEY", "https://openrouter.ai/api/v1"],
    ["ollama", null, "http://ollama:11434/v1/"],
  ])(
    "ignores baseUrl for %s: a metadata address never reaches the config",
    (type, key, url) => {
      const config = providerConfigFromRecord(
        record(type, key, { baseUrl: "http://169.254.169.254/" }),
      );
      expect(config).toMatchObject({ baseUrl: url });
      expect(JSON.stringify(config)).not.toContain("169.254");
    },
  );

  it("ignores baseUrl for gemini", () => {
    const config = providerConfigFromRecord(
      record("gemini", "GEMINI_API_KEY", {
        baseUrl: "http://169.254.169.254/",
      }),
    );
    expect(JSON.stringify(config)).not.toContain("169.254");
  });

  it("returns a fresh capabilities object, not the frozen preset one", () => {
    const config = providerConfigFromRecord(record("ollama", null));
    expect(config.type === "openai-compatible" && config.capabilities).not.toBe(
      PROVIDER_PRESETS.ollama.capabilities,
    );
  });

  it.each([
    ["openrouter without a key", "openrouter", null],
    ["gemini without a key", "gemini", null],
    ["ollama with a key", "ollama", "OLLAMA_API_KEY"],
    ["an unknown type", "openai-compatible", "OPENROUTER_API_KEY"],
    ["an empty type", "", null],
  ])("rejects %s with a fixed message", (_name, type, key) => {
    const err = thrown(() =>
      providerConfigFromRecord(record(type, key, { id: "id-canary-77" })),
    );
    expect(err).toBeInstanceOf(ProviderConfigInvalidError);
    expect(err).toMatchObject({
      code: "PROVIDER_CONFIG_INVALID",
      retryable: false,
    });
    const message = (err as Error).message;
    for (const leak of [
      "openrouter",
      "openai-compatible",
      "ollama",
      "gemini",
      "API_KEY",
      "id-canary-77",
    ]) {
      expect(message).not.toContain(leak);
    }
  });

  it("keeps the preset apiKey rule consistent with what it enforces", () => {
    for (const type of PROVIDER_TYPES) {
      const required = PROVIDER_PRESETS[type].apiKey === "required";
      const withKey = thrown(() =>
        providerConfigFromRecord(record(type, "X_API_KEY")),
      );
      const withoutKey = thrown(() =>
        providerConfigFromRecord(record(type, null)),
      );
      expect(withKey === undefined).toBe(required);
      expect(withoutKey === undefined).toBe(!required);
    }
  });
});

describe("presets.ts stays free of the SDKs", () => {
  it("does not import openai or @google/genai", () => {
    const text = readFileSync(new URL("./presets.ts", import.meta.url), "utf8");
    const specifiers = [...text.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    expect(specifiers.sort()).toEqual(["./registry.js", "@agentlab/core"]);
    expect(text).not.toMatch(/from\s+"(openai|@google\/genai)/);
  });

  it("only imports types from registry.ts", () => {
    const text = readFileSync(new URL("./presets.ts", import.meta.url), "utf8");
    expect(text).toContain(
      'import type { ProviderConfig } from "./registry.js"',
    );
  });
});
