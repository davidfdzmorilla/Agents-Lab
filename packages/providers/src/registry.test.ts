import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { setupServer } from "msw/node";
import {
  ProviderAuthError,
  ProviderConfigInvalidError,
  type ProviderCapabilities,
} from "@agentlab/core";
import { FakeProvider } from "./testing/fake-provider.js";
import { GeminiProvider } from "./gemini/provider.js";
import { OpenAICompatibleProvider } from "./openai-compatible/provider.js";
import { ProviderRegistry, createProvider } from "./registry.js";

const CAPS: ProviderCapabilities = {
  tools: true,
  structuredOutput: true,
  streaming: false,
  maxContextTokens: null,
  reportsUsage: true,
  reportsCost: false,
};
const FAKE_KEY = "sk-canary-registry-0123456789";

function fakeWithId(id: string): FakeProvider {
  return new FakeProvider({ id, script: {} });
}

describe("ProviderRegistry", () => {
  it("looks providers up by their id", () => {
    const a = fakeWithId("a");
    const b = fakeWithId("b");
    const registry = new ProviderRegistry([a, b]);
    expect(registry.get("a")).toBe(a);
    expect(registry.get("b")).toBe(b);
  });

  it("returns undefined for an unknown id", () => {
    expect(new ProviderRegistry([fakeWithId("a")]).get("zzz")).toBeUndefined();
  });

  it("does not resolve inherited object keys", () => {
    const registry = new ProviderRegistry([fakeWithId("a")]);
    expect(registry.get("toString")).toBeUndefined();
    expect(registry.get("__proto__")).toBeUndefined();
  });

  it("lists providers in registration order", () => {
    const ids = ["z", "a", "m"];
    const registry = new ProviderRegistry(ids.map(fakeWithId));
    expect(registry.list().map((p) => p.id)).toEqual(ids);
  });

  it("accepts an empty list", () => {
    expect(new ProviderRegistry([]).list()).toEqual([]);
  });

  it("returns a copy of the list, so the registry cannot be altered", () => {
    const registry = new ProviderRegistry([fakeWithId("a")]);
    const list = registry.list() as unknown[];
    list.push(fakeWithId("b"));
    expect(registry.list()).toHaveLength(1);
    expect(registry.get("b")).toBeUndefined();
  });

  it("has no way to register after construction", () => {
    expect(
      Object.getOwnPropertyNames(ProviderRegistry.prototype).sort(),
    ).toEqual(["constructor", "get", "list"]);
  });

  it("rejects a repeated id with a non-retryable ProviderConfigInvalidError", () => {
    const build = () =>
      new ProviderRegistry([fakeWithId("a"), fakeWithId("b"), fakeWithId("a")]);
    expect(build).toThrow(ProviderConfigInvalidError);
    expect(build).toThrow('Provider "a" is already registered');
    try {
      build();
    } catch (err) {
      expect(err).toHaveProperty("retryable", false);
    }
  });

  it("rejects an empty id with a non-retryable ProviderConfigInvalidError", () => {
    const build = () => new ProviderRegistry([fakeWithId("")]);
    expect(build).toThrow(ProviderConfigInvalidError);
    expect(build).toThrow("A provider id must not be empty");
    try {
      build();
    } catch (err) {
      expect(err).toHaveProperty("retryable", false);
    }
  });
});

describe("createProvider", () => {
  const server = setupServer();
  beforeAll(() => {
    server.listen({ onUnhandledFrame: "error" });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });
  afterAll(() => {
    server.close();
  });

  const secretResolver = (name: string): string | undefined =>
    name === "OPENROUTER_API_KEY" || name === "GEMINI_API_KEY"
      ? FAKE_KEY
      : undefined;

  it("builds an OpenAICompatibleProvider from its config", () => {
    const provider = createProvider(
      {
        type: "openai-compatible",
        id: "openrouter",
        baseUrl: "https://fake-provider.test/v1",
        apiKeyEnv: "OPENROUTER_API_KEY",
        capabilities: CAPS,
      },
      { secretResolver },
    );
    expect(provider).toBeInstanceOf(OpenAICompatibleProvider);
    expect(provider.id).toBe("openrouter");
    expect(provider.capabilities).toEqual(CAPS);
  });

  it("builds a keyless OpenAICompatibleProvider (apiKeyEnv null)", () => {
    const provider = createProvider(
      {
        type: "openai-compatible",
        id: "ollama",
        baseUrl: "http://fake-provider.test/v1",
        apiKeyEnv: null,
        capabilities: CAPS,
      },
      { secretResolver: () => undefined },
    );
    expect(provider).toBeInstanceOf(OpenAICompatibleProvider);
  });

  it("builds a GeminiProvider from its config", () => {
    const provider = createProvider(
      { type: "gemini", id: "gemini", apiKeyEnv: "GEMINI_API_KEY" },
      { secretResolver },
    );
    expect(provider).toBeInstanceOf(GeminiProvider);
    expect(provider.id).toBe("gemini");
  });

  it("propagates ProviderAuthError when the key is missing", () => {
    expect(() =>
      createProvider(
        { type: "gemini", id: "gemini", apiKeyEnv: "GEMINI_API_KEY" },
        { secretResolver: () => undefined },
      ),
    ).toThrow(ProviderAuthError);
    expect(() =>
      createProvider(
        {
          type: "openai-compatible",
          id: "openrouter",
          baseUrl: "https://fake-provider.test/v1",
          apiKeyEnv: "OPENROUTER_API_KEY",
          capabilities: CAPS,
        },
        { secretResolver: () => undefined },
      ),
    ).toThrow(ProviderAuthError);
  });

  it("propagates the invalid baseUrl error", () => {
    expect(() =>
      createProvider(
        {
          type: "openai-compatible",
          id: "ollama",
          baseUrl: "not a url",
          apiKeyEnv: null,
          capabilities: CAPS,
        },
        { secretResolver },
      ),
    ).toThrow(ProviderConfigInvalidError);
  });

  it("rejects a type that is none of the known ones at run time, without echoing it", () => {
    const secretType = "secret-type-canary";
    const bad = { type: secretType, id: "x", apiKeyEnv: null };
    let caught: unknown;
    try {
      createProvider(bad as never, { secretResolver });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ProviderConfigInvalidError);
    expect(caught).toMatchObject({
      code: "PROVIDER_CONFIG_INVALID",
      retryable: false,
    });
    expect((caught as Error).message).not.toContain(secretType);
  });

  it("sends no HTTP request when constructing either adapter", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    createProvider(
      { type: "gemini", id: "gemini", apiKeyEnv: "GEMINI_API_KEY" },
      { secretResolver },
    );
    createProvider(
      {
        type: "openai-compatible",
        id: "openrouter",
        baseUrl: "https://fake-provider.test/v1",
        apiKeyEnv: "OPENROUTER_API_KEY",
        capabilities: CAPS,
      },
      { secretResolver },
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("feeds a registry with the providers it builds", () => {
    const registry = new ProviderRegistry(
      [{ type: "gemini", id: "g", apiKeyEnv: "GEMINI_API_KEY" } as const].map(
        (c) => createProvider(c, { secretResolver }),
      ),
    );
    expect(registry.get("g")).toBeInstanceOf(GeminiProvider);
  });
});
