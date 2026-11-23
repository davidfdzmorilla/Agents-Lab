// Redirects are never followed (TD-141): undici would resend the prompt, and for Gemini the
// `x-goog-api-key` header, to the redirect target. A redirect is a failed request, so it
// surfaces as a fetch network error. `globalThis.fetch` is looked up at call time so test
// interceptors see the call.
export function noRedirectFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  return globalThis.fetch(input, { ...init, redirect: "error" });
}
