import { describe, expect, it } from "vitest";
import { ApiError } from "@google/genai";
import {
  AgentLabError,
  ProviderAuthError,
  ProviderCapabilityError,
  ProviderRateLimitError,
  ProviderResponseError,
  ProviderTimeoutError,
} from "@agentlab/core";
import { parseRetryDelayMs, toGeminiProviderError } from "./errors.js";

const RETRY_INFO = "type.googleapis.com/google.rpc.RetryInfo";

function apiError(status: number, body: unknown): ApiError {
  return new ApiError({
    status,
    message: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function withDetails(details: unknown[]): unknown {
  return { error: { code: 0, message: "secret body text", details } };
}

describe("parseRetryDelayMs", () => {
  it.each([
    ["37s", 37000],
    ["15.0029s", 15003],
    ["0s", 0],
  ])("reads RetryInfo.retryDelay %j as %d ms", (delay, ms) => {
    const body = JSON.stringify(
      withDetails([{ "@type": RETRY_INFO, retryDelay: delay }]),
    );
    expect(parseRetryDelayMs(body)).toBe(ms);
  });

  it("skips unrelated details and finds the RetryInfo entry", () => {
    const body = JSON.stringify(
      withDetails([
        null,
        { "@type": "type.googleapis.com/google.rpc.QuotaFailure" },
        { "@type": RETRY_INFO, retryDelay: "2s" },
      ]),
    );
    expect(parseRetryDelayMs(body)).toBe(2000);
  });

  it.each([["-1s"], ["abc"], ["1.5"], ["s"]])(
    "ignores an invalid retryDelay string %j",
    (delay) => {
      const body = JSON.stringify(
        withDetails([{ "@type": RETRY_INFO, retryDelay: delay }]),
      );
      expect(parseRetryDelayMs(body)).toBeUndefined();
    },
  );

  it("ignores a numeric retryDelay", () => {
    const body = JSON.stringify(
      withDetails([{ "@type": RETRY_INFO, retryDelay: 5 }]),
    );
    expect(parseRetryDelayMs(body)).toBeUndefined();
  });

  it.each([
    ["without RetryInfo", JSON.stringify(withDetails([]))],
    ["not JSON", "<html>busy</html>"],
    ["a JSON primitive", "42"],
    ["an error without details", JSON.stringify({ error: {} })],
    ["details that is not an array", JSON.stringify({ error: { details: 1 } })],
  ])("returns undefined for a body %s", (_name, body) => {
    expect(parseRetryDelayMs(body)).toBeUndefined();
  });
});

describe("toGeminiProviderError", () => {
  it.each([401, 403])(
    "maps HTTP %d to a non-retryable auth error",
    (status) => {
      const err = toGeminiProviderError(apiError(status, {}), "g");
      expect(err).toBeInstanceOf(ProviderAuthError);
      expect(err.retryable).toBe(false);
      expect(err.message).toBe(
        `Provider "g" rejected the credentials (HTTP ${status})`,
      );
    },
  );

  it("maps 400 API_KEY_INVALID to an auth error", () => {
    const body = withDetails([
      {
        "@type": "type.googleapis.com/google.rpc.ErrorInfo",
        reason: "API_KEY_INVALID",
      },
    ]);
    const err = toGeminiProviderError(apiError(400, body), "g");
    expect(err).toBeInstanceOf(ProviderAuthError);
  });

  it("maps a plain 400 to a non-retryable response error", () => {
    const err = toGeminiProviderError(apiError(400, withDetails([])), "g");
    expect(err).toBeInstanceOf(ProviderResponseError);
    expect(err.retryable).toBe(false);
  });

  it("maps 429 to a retryable rate limit error carrying retryAfterMs", () => {
    const body = withDetails([{ "@type": RETRY_INFO, retryDelay: "37s" }]);
    const err = toGeminiProviderError(apiError(429, body), "g");
    expect(err).toBeInstanceOf(ProviderRateLimitError);
    expect(err.retryable).toBe(true);
    expect((err as ProviderRateLimitError).retryAfterMs).toBe(37000);
  });

  it("maps 429 without RetryInfo to a rate limit error without retryAfterMs", () => {
    const err = toGeminiProviderError(apiError(429, "not json"), "g");
    expect(err).toBeInstanceOf(ProviderRateLimitError);
    expect((err as ProviderRateLimitError).retryAfterMs).toBeUndefined();
  });

  it("maps 408 to a retryable timeout error", () => {
    const err = toGeminiProviderError(apiError(408, {}), "g");
    expect(err).toBeInstanceOf(ProviderTimeoutError);
    expect(err.retryable).toBe(true);
  });

  it.each([409, 500, 503, 504])(
    "maps HTTP %d to a retryable response error",
    (status) => {
      const err = toGeminiProviderError(apiError(status, {}), "g");
      expect(err).toBeInstanceOf(ProviderResponseError);
      expect(err.retryable).toBe(true);
    },
  );

  it.each([402, 404, 416, 499])(
    "maps HTTP %d to a non-retryable response error",
    (status) => {
      const err = toGeminiProviderError(apiError(status, {}), "g");
      expect(err).toBeInstanceOf(ProviderResponseError);
      expect(err.retryable).toBe(false);
    },
  );

  it("maps a fetch TypeError to a retryable connection error without cause", () => {
    const err = toGeminiProviderError(
      new TypeError("fetch failed", { cause: new Error("ECONNREFUSED") }),
      "g",
    );
    expect(err).toBeInstanceOf(ProviderResponseError);
    expect(err.retryable).toBe(true);
    expect(err.cause).toBeUndefined();
    expect(err.message).toBe('Provider "g" connection failed');
  });

  it.each([
    ["without a cause", new TypeError("fetch failed")],
    [
      "with another message",
      new TypeError("Failed to parse URL", { cause: new Error("x") }),
    ],
    [
      "the SDK failing on a null body",
      new TypeError(
        "Cannot set properties of null (setting 'sdkHttpResponse')",
      ),
    ],
  ])("maps a TypeError %s to a non-retryable response error", (_n, error) => {
    const err = toGeminiProviderError(error, "g");
    expect(err).toBeInstanceOf(ProviderResponseError);
    expect(err.retryable).toBe(false);
    expect(err.message).toBe('Provider "g" failed with an unexpected error');
  });

  it("maps an unknown error to a non-retryable response error", () => {
    const err = toGeminiProviderError(new Error("boom"), "g");
    expect(err).toBeInstanceOf(ProviderResponseError);
    expect(err.retryable).toBe(false);
    expect(err.message).not.toContain("boom");
  });

  it("returns an AgentLabError unchanged", () => {
    const original = new ProviderCapabilityError("x");
    expect(toGeminiProviderError(original, "g")).toBe(original);
    expect(original).toBeInstanceOf(AgentLabError);
  });

  it("never copies the response body or attaches a cause", () => {
    const err = toGeminiProviderError(
      apiError(500, withDetails([{ note: "sk-canary" }])),
      "g",
    );
    expect(err.message).not.toContain("secret body text");
    expect(err.message).not.toContain("sk-canary");
    expect(err.cause).toBeUndefined();
  });
});
