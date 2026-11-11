import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { ProviderAuthError } from "@agentlab/core";
import { OpenAICompatibleProvider } from "./provider.js";
import { BASE, CAPS, server } from "./test-server.js";

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  vi.restoreAllMocks();
});
afterAll(() => {
  server.close();
});

// A request still in flight is invisible to a synchronous check, so the event loop is
// drained before asserting. The spy goes on before construction because the SDK captures
// globalThis.fetch in its constructor.
it.each([undefined, ""])(
  "sends no request, even asynchronously, when the resolver returns %j at construction",
  async (value) => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(
      () =>
        new OpenAICompatibleProvider({
          id: "openrouter",
          baseUrl: BASE,
          apiKeyEnv: "OPENROUTER_API_KEY",
          capabilities: CAPS,
          secretResolver: () => value,
        }),
    ).toThrow(ProviderAuthError);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(fetchSpy).not.toHaveBeenCalled();
  },
);
