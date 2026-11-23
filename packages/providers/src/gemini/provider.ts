import { GoogleGenAI } from "@google/genai";
import {
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
import { noRedirectFetch } from "../no-redirect-fetch.js";
import { GEMINI_CAPABILITIES } from "../presets.js";
import { toGeminiProviderError } from "./errors.js";
import {
  assertRepresentable,
  fromGenerateContentResponse,
  toGenerateParams,
} from "./mapping.js";

const LIST_MODELS_TIMEOUT_MS = 10_000;
const MODEL_PREFIX = "models/";
// A constant on purpose (OD-079): the key only ever travels to this host. Without an
// explicit value the SDK would read GOOGLE_GEMINI_BASE_URL from the environment.
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/";

export interface GeminiProviderOptions {
  readonly id: string;
  readonly apiKeyEnv: string;
  readonly secretResolver: SecretResolver;
}

export class GeminiProvider implements ModelProvider {
  readonly id: string;
  readonly capabilities: ProviderCapabilities = GEMINI_CAPABILITIES;
  readonly #client: GoogleGenAI;

  constructor(options: GeminiProviderOptions) {
    const apiKey = resolveApiKey(
      options.id,
      options.apiKeyEnv,
      options.secretResolver,
    );

    this.id = options.id;
    // Every option is explicit: left undefined, the SDK reads GOOGLE_GENAI_USE_*,
    // GOOGLE_GEMINI_BASE_URL and, in 3.x, GOOGLE_GENAI_API_VERSION. No retryOptions:
    // retries belong to the layer above. The SDK still reads GOOGLE_API_KEY,
    // GEMINI_API_KEY and GOOGLE_CLOUD_* and discards them (OD-080).
    this.#client = new GoogleGenAI({
      apiKey,
      vertexai: false,
      apiVersion: "v1beta",
      // An explicit fetch drops the SDK's no-timeout dispatcher, so undici's default timeouts
      // apply (plan R3); the whitelisted timeout codes are retried as before.
      httpOptions: { baseUrl: GEMINI_BASE_URL, fetch: noRedirectFetch },
    });
  }

  async listModels(): Promise<ModelInfo[]> {
    // setTimeout rather than AbortSignal.timeout so fake timers can drive it in tests.
    const own = new AbortController();
    const timer = setTimeout(() => {
      own.abort();
    }, LIST_MODELS_TIMEOUT_MS);
    try {
      const pager = await this.#client.models.list({
        config: { pageSize: 1000, abortSignal: own.signal },
      });
      const models: ModelInfo[] = [];
      for await (const model of pager) {
        const name = model.name;
        // Embedding and other non-chat models are of no use to generate().
        if (
          name !== undefined &&
          model.supportedActions?.includes("generateContent") === true
        ) {
          models.push({
            id: name.startsWith(MODEL_PREFIX)
              ? name.slice(MODEL_PREFIX.length)
              : name,
          });
        }
      }
      return models;
    } catch (err) {
      if (own.signal.aborted) {
        throw new ProviderTimeoutError(
          `Provider "${this.id}" request timed out`,
        );
      }
      throw toGeminiProviderError(err, this.id);
    } finally {
      clearTimeout(timer);
    }
  }

  async generate(
    req: GenerateRequest,
    signal: AbortSignal,
  ): Promise<GenerateResponse> {
    assertCapabilities(this.id, this.capabilities, req);
    assertRepresentable(this.id, req);
    signal.throwIfAborted();

    const own = new AbortController();
    const timer = setTimeout(() => {
      own.abort();
    }, req.timeoutMs);
    try {
      const { model, contents, config } = toGenerateParams(req);
      const res = await this.#client.models.generateContent({
        model,
        contents,
        config: {
          ...config,
          abortSignal: AbortSignal.any([signal, own.signal]),
        },
      });
      return fromGenerateContentResponse(res, this.id);
    } catch (err) {
      if (signal.aborted) throw signal.reason;
      if (own.signal.aborted) {
        throw new ProviderTimeoutError(
          `Provider "${this.id}" request timed out`,
        );
      }
      throw toGeminiProviderError(err, this.id);
    } finally {
      clearTimeout(timer);
    }
  }
}
