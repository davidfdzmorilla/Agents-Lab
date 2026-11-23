// Closed set of provider types (OD-090 (a)). This module must stay free of the provider SDKs:
// `web` imports it through `@agentlab/providers/presets` and must not bundle them. Only type
// imports from `registry.ts` are allowed, which are erased.
import {
  ProviderConfigInvalidError,
  type ProviderCapabilities,
} from "@agentlab/core";
import type { ProviderConfig } from "./registry.js";

export const PROVIDER_TYPES = Object.freeze([
  "openrouter",
  "ollama",
  "gemini",
] as const);

export type ProviderType = (typeof PROVIDER_TYPES)[number];

export function isProviderType(value: string): value is ProviderType {
  return PROVIDER_TYPES.some((type) => type === value);
}

// Fixed (OD-078): what the Gemini adapter really does today. Context size depends on the
// model, so it is unknown at provider level (TD-145). Streaming is not part of ModelProvider.
export const GEMINI_CAPABILITIES: ProviderCapabilities = Object.freeze({
  tools: true,
  structuredOutput: true,
  streaming: false,
  maxContextTokens: null,
  reportsUsage: true,
  reportsCost: false,
});

// What the OpenAI-compatible adapter does, as in OD-078 (TASK-020 plan, D3).
const OPENAI_COMPATIBLE_CAPABILITIES: ProviderCapabilities = Object.freeze({
  tools: true,
  structuredOutput: true,
  streaming: false,
  maxContextTokens: null,
  reportsUsage: true,
  reportsCost: false,
});

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const OLLAMA_BASE_URL = "http://ollama:11434/v1/";

export interface ProviderPreset {
  readonly adapter: "openai-compatible" | "gemini";
  readonly apiKey: "required" | "none";
  readonly capabilities: ProviderCapabilities;
}

export const PROVIDER_PRESETS: Readonly<Record<ProviderType, ProviderPreset>> =
  Object.freeze({
    openrouter: Object.freeze({
      adapter: "openai-compatible",
      apiKey: "required",
      capabilities: OPENAI_COMPATIBLE_CAPABILITIES,
    }),
    ollama: Object.freeze({
      adapter: "openai-compatible",
      apiKey: "none",
      capabilities: OPENAI_COMPATIBLE_CAPABILITIES,
    }),
    gemini: Object.freeze({
      adapter: "gemini",
      apiKey: "required",
      capabilities: GEMINI_CAPABILITIES,
    }),
  });

// Structural: a `provider_configs` row satisfies it. `base_url` is deliberately not read
// (OD-090 (a)): no URL that comes from the database or the UI ever reaches an adapter.
export interface ProviderConfigRecord {
  readonly id: string;
  readonly providerType: string;
  readonly apiKeyEnv: string | null;
}

// The message is a fixed template: it carries neither the type, the URL nor the key name.
function invalid(): ProviderConfigInvalidError {
  return new ProviderConfigInvalidError(
    "The provider configuration record is invalid",
  );
}

function requireKey(apiKeyEnv: string | null): string {
  if (apiKeyEnv === null) throw invalid();
  return apiKeyEnv;
}

function requireNoKey(apiKeyEnv: string | null): null {
  if (apiKeyEnv !== null) throw invalid();
  return null;
}

export function providerConfigFromRecord(
  record: ProviderConfigRecord,
): ProviderConfig {
  const type = record.providerType;
  if (!isProviderType(type)) throw invalid();
  const { capabilities } = PROVIDER_PRESETS[type];

  switch (type) {
    case "openrouter":
      return {
        type: "openai-compatible",
        id: record.id,
        baseUrl: OPENROUTER_BASE_URL,
        apiKeyEnv: requireKey(record.apiKeyEnv),
        capabilities: { ...capabilities },
      };
    case "ollama":
      return {
        type: "openai-compatible",
        id: record.id,
        baseUrl: OLLAMA_BASE_URL,
        apiKeyEnv: requireNoKey(record.apiKeyEnv),
        capabilities: { ...capabilities },
      };
    case "gemini":
      return {
        type: "gemini",
        id: record.id,
        apiKeyEnv: requireKey(record.apiKeyEnv),
      };
  }
}
