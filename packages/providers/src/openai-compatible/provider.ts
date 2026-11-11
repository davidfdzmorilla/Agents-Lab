import OpenAI from "openai";
import {
  ProviderAuthError,
  ProviderResponseError,
  ProviderTimeoutError,
  isApiKeyEnvName,
  type GenerateRequest,
  type GenerateResponse,
  type ModelInfo,
  type ModelProvider,
  type ProviderCapabilities,
  type SecretResolver,
} from "@agentlab/core";
import { assertCapabilities } from "../capabilities.js";
import { toProviderError } from "./errors.js";
import { fromChatCompletion, toChatParams } from "./mapping.js";

const LIST_MODELS_TIMEOUT_MS = 10_000;
const MAX_ENV_NAME_LENGTH = 40;
// The SDK refuses to build without a key; with no key configured (Ollama) this fixed
// non-secret marker satisfies it and the Authorization header is then removed.
const NO_KEY_MARKER = "none";

export interface OpenAICompatibleProviderOptions {
  readonly id: string;
  readonly baseUrl: string;
  readonly apiKeyEnv: string | null;
  readonly capabilities: ProviderCapabilities;
  readonly secretResolver: SecretResolver;
}

function assertHttpUrl(id: string, baseUrl: string): void {
  const valid =
    URL.canParse(baseUrl) && /^https?:$/.test(new URL(baseUrl).protocol);
  // An empty baseURL would make the SDK fall back to api.openai.com and send it the key.
  // The URL is not echoed: it may carry credentials.
  if (!valid) {
    throw new ProviderResponseError(
      `Provider "${id}" has an invalid baseUrl (an http or https URL is required)`,
    );
  }
}

function resolveKey(
  id: string,
  apiKeyEnv: string,
  secretResolver: SecretResolver,
): string {
  const key = secretResolver(apiKeyEnv);
  if (key === undefined || key === "") {
    // A malformed api_key_env could be a pasted key, so it is only quoted when it is a
    // well-formed variable name (same rule as InvalidApiKeyEnvError).
    const named =
      isApiKeyEnvName(apiKeyEnv) && apiKeyEnv.length <= MAX_ENV_NAME_LENGTH
        ? `environment variable ${apiKeyEnv} is not set, empty or not allowed`
        : "the configured api_key_env is not a valid or allowed variable name";
    throw new ProviderAuthError(
      `Provider "${id}" has no usable API key: ${named}`,
    );
  }
  return key;
}

export class OpenAICompatibleProvider implements ModelProvider {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;
  readonly #client: OpenAI;

  constructor(options: OpenAICompatibleProviderOptions) {
    assertHttpUrl(options.id, options.baseUrl);
    const apiKey =
      options.apiKeyEnv === null
        ? NO_KEY_MARKER
        : resolveKey(options.id, options.apiKeyEnv, options.secretResolver);

    this.id = options.id;
    this.capabilities = Object.freeze({ ...options.capabilities });
    // Every option is explicit: the SDK reads the OPENAI_* variables for any option left undefined.
    // Only OPENAI_CUSTOM_HEADERS cannot be avoided (OD-064, accepted as debt).
    this.#client = new OpenAI({
      apiKey,
      baseURL: options.baseUrl,
      organization: null,
      project: null,
      adminAPIKey: null,
      webhookSecret: null,
      maxRetries: 0,
      logLevel: "off",
      ...(options.apiKeyEnv === null
        ? { defaultHeaders: { Authorization: null } }
        : {}),
    });
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const page = await this.#client.models.list({
        timeout: LIST_MODELS_TIMEOUT_MS,
        maxRetries: 0,
      });
      return page.data.map((m) => ({ id: m.id }));
    } catch (err) {
      throw toProviderError(err, this.id, Date.now());
    }
  }

  async generate(
    req: GenerateRequest,
    signal: AbortSignal,
  ): Promise<GenerateResponse> {
    assertCapabilities(this.id, this.capabilities, req);
    signal.throwIfAborted();

    // setTimeout rather than AbortSignal.timeout so fake timers can drive it in tests.
    const own = new AbortController();
    const timer = setTimeout(() => {
      own.abort();
    }, req.timeoutMs);
    try {
      const res = await this.#client.chat.completions.create(
        toChatParams(req),
        {
          signal: AbortSignal.any([signal, own.signal]),
          timeout: req.timeoutMs,
          maxRetries: 0,
        },
      );
      return fromChatCompletion(res, this.id);
    } catch (err) {
      if (signal.aborted) throw signal.reason;
      if (own.signal.aborted) {
        throw new ProviderTimeoutError(
          `Provider "${this.id}" request timed out`,
        );
      }
      throw toProviderError(err, this.id, Date.now());
    } finally {
      clearTimeout(timer);
    }
  }
}
