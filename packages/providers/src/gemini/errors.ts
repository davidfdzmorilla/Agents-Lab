import { ApiError } from "@google/genai";
import {
  AgentLabError,
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderResponseError,
  ProviderTimeoutError,
} from "@agentlab/core";

const RETRY_DELAY = /^(\d+(?:\.\d+)?)s$/;
const RETRY_INFO_TYPE = "type.googleapis.com/google.rpc.RetryInfo";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// The SDK puts the serialised response body in `ApiError.message`. It is only parsed to
// read two structured fields; no text from it is ever copied into an error we throw.
function errorDetails(body: string): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return [];
  }
  const error = isRecord(parsed) ? parsed["error"] : undefined;
  const details = isRecord(error) ? error["details"] : undefined;
  return Array.isArray(details) ? details : [];
}

export function parseRetryDelayMs(body: string): number | undefined {
  for (const detail of errorDetails(body)) {
    if (!isRecord(detail) || detail["@type"] !== RETRY_INFO_TYPE) continue;
    const delay = detail["retryDelay"];
    const match = typeof delay === "string" ? RETRY_DELAY.exec(delay) : null;
    const seconds = match?.[1];
    if (seconds === undefined) return undefined;
    const ms = Math.ceil(Number(seconds) * 1000);
    return Number.isFinite(ms) ? ms : undefined;
  }
  return undefined;
}

function hasInvalidKeyReason(body: string): boolean {
  return errorDetails(body).some(
    (detail) => isRecord(detail) && detail["reason"] === "API_KEY_INVALID",
  );
}

// The SDK rethrows what fetch throws. A network failure is the Fetch spec's
// `TypeError("fetch failed", { cause })` (undici: an Error; msw's emulation: a Response). Other TypeErrors (e.g. the SDK choking on a
// malformed 200 body) carry no cause and are not worth retrying. Nothing is copied.
function isFetchNetworkFailure(err: unknown): boolean {
  return (
    err instanceof TypeError &&
    err.message === "fetch failed" &&
    isRecord(err.cause)
  );
}

// Messages are fixed templates on purpose: the SDK message is the response body, so none of
// it is copied, and no `cause` is attached (TASK-004 security note, TD-144).
export function toGeminiProviderError(
  err: unknown,
  providerId: string,
): AgentLabError {
  if (err instanceof AgentLabError) return err;
  const who = `Provider "${providerId}"`;

  if (err instanceof ApiError) {
    const status = err.status;
    if (
      status === 401 ||
      status === 403 ||
      (status === 400 && hasInvalidKeyReason(err.message))
    ) {
      return new ProviderAuthError(
        `${who} rejected the credentials (HTTP ${status})`,
      );
    }
    if (status === 429) {
      const retryAfterMs = parseRetryDelayMs(err.message);
      return new ProviderRateLimitError(
        `${who} rate limited the request (HTTP 429)`,
        retryAfterMs === undefined ? {} : { retryAfterMs },
      );
    }
    if (status === 408) {
      return new ProviderTimeoutError(
        `${who} reported a request timeout (HTTP 408)`,
      );
    }
    return new ProviderResponseError(
      `${who} returned an error (HTTP ${status})`,
      { retryable: status === 409 || status >= 500 },
    );
  }
  if (isFetchNetworkFailure(err)) {
    return new ProviderResponseError(`${who} connection failed`, {
      retryable: true,
    });
  }
  return new ProviderResponseError(`${who} failed with an unexpected error`);
}
