import { describe, expect, it } from "vitest";
import { ProviderConfigInvalidError } from "@agentlab/core";
import { OpenAICompatibleProvider } from "./provider.js";
import { CANARY, CAPS } from "./test-server.js";

// Tester addition (TASK-020, DoD 2): a password without user name (`https://:secret@host`)
// leaves `url.username` empty, so only the `url.password` check rejects it.
describe("assertHttpUrl rejects a password-only userinfo", () => {
  it.each(["https://:pw-canary-77c1@fake-provider.test/v1"])(
    "rejects %s with and without a key, without echoing the password",
    (baseUrl) => {
      for (const apiKeyEnv of ["OPENROUTER_API_KEY", null]) {
        let caught: unknown;
        try {
          new OpenAICompatibleProvider({
            id: "p",
            baseUrl,
            apiKeyEnv,
            capabilities: CAPS,
            secretResolver: () => CANARY,
          });
        } catch (err) {
          caught = err;
        }
        expect(caught).toBeInstanceOf(ProviderConfigInvalidError);
        expect((caught as Error).message).not.toContain("pw-canary-77c1");
      }
    },
  );
});
