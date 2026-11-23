import {
  ProviderConfigInvalidError,
  type ModelProvider,
  type ProviderCapabilities,
  type SecretResolver,
} from "@agentlab/core";
import { GeminiProvider } from "./gemini/provider.js";
import { OpenAICompatibleProvider } from "./openai-compatible/provider.js";

// Immutable on purpose: the worker builds it once per configuration. The key is
// `provider.id` (OD-057). An unknown id is not an error here: the caller decides.
export class ProviderRegistry {
  readonly #byId = new Map<string, ModelProvider>();

  constructor(providers: readonly ModelProvider[]) {
    for (const provider of providers) {
      if (provider.id === "") {
        throw new ProviderConfigInvalidError("A provider id must not be empty");
      }
      if (this.#byId.has(provider.id)) {
        throw new ProviderConfigInvalidError(
          `Provider "${provider.id}" is already registered`,
        );
      }
      this.#byId.set(provider.id, provider);
    }
  }

  get(id: string): ModelProvider | undefined {
    return this.#byId.get(id);
  }

  list(): readonly ModelProvider[] {
    return [...this.#byId.values()];
  }
}

export type ProviderConfig =
  | {
      readonly type: "openai-compatible";
      readonly id: string;
      readonly baseUrl: string;
      readonly apiKeyEnv: string | null;
      readonly capabilities: ProviderCapabilities;
    }
  | {
      readonly type: "gemini";
      readonly id: string;
      readonly apiKeyEnv: string;
    };

export function createProvider(
  config: ProviderConfig,
  deps: { readonly secretResolver: SecretResolver },
): ModelProvider {
  switch (config.type) {
    case "openai-compatible":
      return new OpenAICompatibleProvider({
        id: config.id,
        baseUrl: config.baseUrl,
        apiKeyEnv: config.apiKeyEnv,
        capabilities: config.capabilities,
        secretResolver: deps.secretResolver,
      });
    case "gemini":
      return new GeminiProvider({
        id: config.id,
        apiKeyEnv: config.apiKeyEnv,
        secretResolver: deps.secretResolver,
      });
    default:
      // Compile-time exhaustiveness. At run time a `type` that is none of the above (a
      // config cast past the types) is rejected; the value is not echoed.
      config satisfies never;
      throw new ProviderConfigInvalidError(
        "The provider configuration has an unknown type",
      );
  }
}
