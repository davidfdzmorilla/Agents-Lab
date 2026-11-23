import { PROVIDER_PRESETS } from "@agentlab/providers/presets";
import { describe, expect, it } from "vitest";
import { toProviderView } from "./providers.js";
import { agentRow, CONFIG_ID, configRow, PROJECT_ID } from "./test-rows.js";

describe("toProviderView", () => {
  it("returns the preset capabilities and type for a valid openrouter row", () => {
    const view = toProviderView(configRow(), []);

    expect(view).toMatchObject({
      id: CONFIG_ID,
      projectId: PROJECT_ID,
      type: "openrouter",
      valid: true,
      error: null,
      capabilities: PROVIDER_PRESETS.openrouter.capabilities,
    });
  });

  it("accepts ollama without a key and gemini with one", () => {
    expect(
      toProviderView(configRow({ providerType: "ollama", apiKeyEnv: null }), [])
        .type,
    ).toBe("ollama");
    expect(
      toProviderView(
        configRow({ providerType: "gemini", apiKeyEnv: "GEMINI_API_KEY" }),
        [],
      ).capabilities,
    ).toEqual(PROVIDER_PRESETS.gemini.capabilities);
  });

  it.each([
    ["an unknown type", { providerType: "openai-compatible" }],
    ["openrouter without a key", { apiKeyEnv: null }],
    ["ollama with a key", { providerType: "ollama" }],
  ] as const)(
    "marks %s as invalid with null type and capabilities",
    (_n, o) => {
      const view = toProviderView(configRow(o), []);

      expect(view).toMatchObject({
        valid: false,
        type: null,
        capabilities: null,
        error: { code: "PROVIDER_CONFIG_INVALID" },
      });
    },
  );

  it("lists the default model first, then agent models of that config without duplicates", () => {
    const view = toProviderView(configRow(), [
      agentRow({ modelId: "m-a" }),
      agentRow({ modelId: "default-model" }),
      agentRow({ modelId: "m-a" }),
      agentRow({ modelId: "m-b" }),
      agentRow({ modelId: "other", providerConfigId: "other-config" }),
    ]);

    expect(view.models).toEqual([
      { id: "default-model" },
      { id: "m-a" },
      { id: "m-b" },
    ]);
  });

  it("never exposes base_url or api_key_env", () => {
    const text = JSON.stringify(toProviderView(configRow(), []));

    expect(text).not.toContain("CANARY-URL");
    expect(text).not.toContain("OPENROUTER_API_KEY");
    expect(text).not.toContain("baseUrl");
    expect(text).not.toContain("apiKeyEnv");
  });
});
