// Shared fixtures for the Gemini adapter tests. Not exported from the package.
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { GenerateRequest } from "@agentlab/core";
import { GeminiProvider } from "./provider.js";

export const HOST = "https://generativelanguage.googleapis.com";
export const CANARY = "AIza-canary-0123456789abcdef";

export interface Received {
  readonly method: string;
  readonly url: string;
  readonly path: string;
  readonly headers: Headers;
  readonly body: unknown;
}

export const received: Received[] = [];
export const server = setupServer();

// `:generateContent` would be read as a path parameter, so generate routes use a wildcard.
export const GENERATE_PATH = "/v1beta/models/*";
export const LIST_PATH = "/v1beta/models";

export function route(
  method: "get" | "post",
  path: string,
  responder: (request: Request) => Response | Promise<Response>,
) {
  return http[method](`${HOST}${path}`, async ({ request }) => {
    const text = method === "post" ? await request.clone().text() : "";
    received.push({
      method: request.method,
      url: request.url,
      path: new URL(request.url).pathname,
      headers: new Headers(request.headers),
      body: text === "" ? undefined : JSON.parse(text),
    });
    return responder(request);
  });
}

export function generateOk(extra: object = {}): Response {
  return HttpResponse.json({
    candidates: [
      {
        content: { role: "model", parts: [{ text: "hello" }] },
        finishReason: "STOP",
      },
    ],
    usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2 },
    ...extra,
  });
}

export function request(extra: Partial<GenerateRequest> = {}): GenerateRequest {
  return {
    model: "gemini-2.5-flash",
    messages: [{ role: "user", content: "hi" }],
    requires: {},
    maxOutputTokens: 16,
    timeoutMs: 5000,
    ...extra,
  };
}

export function buildProvider(secret: string | null = CANARY): GeminiProvider {
  return new GeminiProvider({
    id: "gemini",
    apiKeyEnv: "GEMINI_API_KEY",
    secretResolver: () => secret ?? undefined,
  });
}
