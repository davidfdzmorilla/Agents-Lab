import OpenAI from "openai";
import {
  ProviderConfigInvalidError,
  ProviderTimeoutError,
  type GenerateRequest,
  type GenerateResponse,
  type ModelInfo,
  type ModelProvider,
  type ProviderCapabilities,
  type SecretResolver,
} from "@agentlab/core";
import { resolveApiKey } from "../api-key.js";
import { assertCapabilities } from "../capabilities.js";
import { toProviderError } from "./errors.js";
import { fromChatCompletion, toChatParams } from "./mapping.js";

const LIST_MODELS_TIMEOUT_MS = 10_000;
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

// An empty baseURL would make the SDK fall back to api.openai.com and send it the key.
// Credentials in the URL are refused (TD-141 L1) and so is plain http when a key is sent
// (L3). The URL is not echoed: it may carry credentials.
function assertHttpUrl(id: string, baseUrl: string, hasKey: boolean): void {
  const url = URL.canParse(baseUrl) ? new URL(baseUrl) : undefined;
  const valid =
    url !== undefined &&
    (url.protocol === "https:" || (url.protocol === "http:" && !hasKey)) &&
    url.username === "" &&
    url.password === "";
  if (!valid) {
    throw new ProviderConfigInvalidError(
      `Provider "${id}" has an invalid baseUrl (an http or https URL without credentials is required, and https when an API key is used)`,
    );
  }
}

export class OpenAICompatibleProvider implements ModelProvider {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;
  readonly #client: OpenAI;

  constructor(options: OpenAICompatibleProviderOptions) {
    assertHttpUrl(options.id, options.baseUrl, options.apiKeyEnv !== null);
    const apiKey =
      options.apiKeyEnv === null
        ? NO_KEY_MARKER
        : resolveApiKey(options.id, options.apiKeyEnv, options.secretResolver);

    this.id = options.id;
    this.capabilities = Object.freeze({ ...options.capabilities });
    // Every option is explicit: the SDK reads the OPENAI_* variables for any option left undefined.
    // OPENAI_CUSTOM_HEADERS cannot be avoided (OD-064), but explicit defaultHeaders win over
    // it, so the environment cannot replace Authorization (TD-142). Other custom headers
    // remain accepted. Redirects are never followed (TD-141 L2).
    // The SDK builds headers in the constructor, and undici's TypeError for an invalid header
    // value quotes it (the key). Nothing from the original error is kept.
    try {
      this.#client = new OpenAI({
        apiKey,
        baseURL: options.baseUrl,
        organization: null,
        project: null,
        adminAPIKey: null,
        webhookSecret: null,
        maxRetries: 0,
        logLevel: "off",
        fetchOptions: { redirect: "error" },
        defaultHeaders: {
          Authorization: options.apiKeyEnv === null ? null : `Bearer ${apiKey}`,
        },
      });
    } catch {
      throw new ProviderConfigInvalidError(
        `Provider "${options.id}" could not build its client (an API key or an OPENAI_CUSTOM_HEADERS value is not a valid HTTP header value)`,
      );
    }
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
