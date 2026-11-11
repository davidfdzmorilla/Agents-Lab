import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { HttpResponse } from "msw";
import {
  ProviderAuthError,
  ProviderCapabilityError,
  ProviderRateLimitError,
  ProviderResponseError,
  ProviderTimeoutError,
  type SecretResolver,
} from "@agentlab/core";
import { OpenAICompatibleProvider } from "./provider.js";
import {
  BASE,
  CANARY,
  CAPS,
  chatOk,
  received,
  request,
  route,
  server,
} from "./test-server.js";

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  received.length = 0;
});
afterEach(() => {
  server.resetHandlers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
afterAll(() => {
  server.close();
});

const live = new AbortController().signal;

function build(
  over: Partial<ConstructorParameters<typeof OpenAICompatibleProvider>[0]> = {},
  resolver: SecretResolver = () => CANARY,
) {
  return new OpenAICompatibleProvider({
    id: "openrouter",
    baseUrl: BASE,
    apiKeyEnv: "OPENROUTER_API_KEY",
    capabilities: CAPS,
    secretResolver: resolver,
    ...over,
  });
}

describe("construction and key handling", () => {
  it("resolves the key once at construction and never during generate", async () => {
    server.use(route("post", "/chat/completions", () => chatOk()));
    const resolver = vi.fn<SecretResolver>(() => CANARY);
    const p = build({}, resolver);
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(resolver).toHaveBeenCalledWith("OPENROUTER_API_KEY");
    await p.generate(request(), live);
    await p.generate(request(), live);
    expect(resolver).toHaveBeenCalledTimes(1);
  });

  it("sends the resolved key as a bearer token to the configured baseUrl (positive control)", async () => {
    server.use(route("post", "/chat/completions", () => chatOk()));
    await build().generate(request(), live);
    expect(received).toHaveLength(1);
    expect(received[0]?.path).toBe("/v1/chat/completions");
    expect(received[0]?.headers.get("authorization")).toBe(`Bearer ${CANARY}`);
  });

  it.each([undefined, ""])(
    "throws ProviderAuthError at construction when the resolver returns %j, citing the name only",
    (value) => {
      const resolver: SecretResolver = () => value;
      let caught: unknown;
      try {
        build({}, resolver);
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(ProviderAuthError);
      expect(caught).toMatchObject({ retryable: false });
      expect((caught as ProviderAuthError).message).toContain(
        "OPENROUTER_API_KEY",
      );
    },
  );

  it("does not quote a malformed api_key_env, which could be a pasted key", () => {
    let caught: unknown;
    try {
      build({ apiKeyEnv: "sk-canary-value" }, () => undefined);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ProviderAuthError);
    expect((caught as ProviderAuthError).message).not.toContain(
      "sk-canary-value",
    );
  });

  it("does not quote an over-long variable name", () => {
    const name = `${"A".repeat(40)}_API_KEY`;
    let caught: unknown;
    try {
      build({ apiKeyEnv: name }, () => undefined);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ProviderAuthError);
    expect((caught as ProviderAuthError).message).not.toContain(name);
  });

  it("with apiKeyEnv null never calls the resolver and sends no Authorization header", async () => {
    server.use(route("post", "/chat/completions", () => chatOk()));
    const resolver = vi.fn<SecretResolver>(() => CANARY);
    const p = build({ id: "ollama", apiKeyEnv: null }, resolver);
    await p.generate(request(), live);
    expect(resolver).not.toHaveBeenCalled();
    expect(received).toHaveLength(1);
    expect(received[0]?.headers.has("authorization")).toBe(false);
  });

  it.each(["", "not a url", "ftp://host/v1", "file:///etc/passwd"])(
    "rejects baseUrl %j without echoing it",
    (baseUrl) => {
      let caught: unknown;
      try {
        build({ baseUrl });
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(ProviderResponseError);
      if (baseUrl !== "") {
        expect((caught as ProviderResponseError).message).not.toContain(
          baseUrl,
        );
      }
    },
  );

  it("exposes only id and a frozen copy of the capabilities", () => {
    const caps = { ...CAPS };
    const p = build({ capabilities: caps });
    caps.tools = false;
    expect(p.capabilities.tools).toBe(true);
    expect(Object.isFrozen(p.capabilities)).toBe(true);
    expect(Object.keys(p).sort()).toEqual(["capabilities", "id"]);
  });
});

describe("environment independence", () => {
  it("ignores OPENAI_* variables: base URL, key and organization come from the options", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-env-canary");
    vi.stubEnv("OPENAI_BASE_URL", "http://env-canary.test/v1");
    vi.stubEnv("OPENAI_ORG_ID", "org-env-canary");
    vi.stubEnv("OPENAI_PROJECT_ID", "proj-env-canary");
    vi.stubEnv("OPENAI_ADMIN_KEY", "sk-admin-env-canary");
    vi.stubEnv("OPENAI_LOG", "debug");
    const spies = (["log", "debug", "info", "warn", "error"] as const).map(
      (m) => vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    server.use(route("post", "/chat/completions", () => chatOk()));
    await build().generate(request(), live);
    expect(received).toHaveLength(1);
    const headers = received[0]?.headers;
    expect(headers?.get("authorization")).toBe(`Bearer ${CANARY}`);
    expect(headers?.has("openai-organization")).toBe(false);
    expect(headers?.has("openai-project")).toBe(false);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});

describe("generate", () => {
  it("returns content and usage exactly as reported", async () => {
    server.use(
      route("post", "/chat/completions", () =>
        chatOk({
          usage: {
            prompt_tokens: 11,
            completion_tokens: 7,
            total_tokens: 18,
            cost: 0.0042,
          },
        }),
      ),
    );
    const out = await build().generate(request(), live);
    expect(out).toEqual({
      content: "hello",
      toolCalls: [],
      usage: { inputTokens: 11, outputTokens: 7 },
      costReported: 0.0042,
    });
  });

  it("returns null usage and cost when the provider reports none", async () => {
    server.use(route("post", "/chat/completions", () => chatOk()));
    const out = await build().generate(request(), live);
    expect(out.usage).toEqual({ inputTokens: null, outputTokens: null });
    expect(out.costReported).toBeNull();
  });

  it("sends the mapped request body", async () => {
    let body: unknown;
    server.use(
      route("post", "/chat/completions", async (req) => {
        body = await req.json();
        return chatOk();
      }),
    );
    await build().generate(
      request({
        temperature: 0.2,
        tools: [
          { name: "t", description: "d", parameters: { type: "object" } },
        ],
        responseSchema: { type: "object" },
        requires: { tools: true, structuredOutput: true },
      }),
      live,
    );
    expect(body).toMatchObject({
      model: "m",
      max_tokens: 16,
      temperature: 0.2,
      stream: false,
      tools: [{ type: "function", function: { name: "t" } }],
      response_format: { type: "json_schema" },
    });
  });

  it("fails with ProviderCapabilityError before any request", async () => {
    server.use(route("post", "/chat/completions", () => chatOk()));
    const p = build({ capabilities: { ...CAPS, tools: false } });
    await expect(
      p.generate(request({ requires: { tools: true } }), live),
    ).rejects.toBeInstanceOf(ProviderCapabilityError);
    expect(received).toHaveLength(0);
  });

  it("maps 401 to ProviderAuthError", async () => {
    server.use(
      route("post", "/chat/completions", () =>
        HttpResponse.json({ error: { message: "no" } }, { status: 401 }),
      ),
    );
    await expect(build().generate(request(), live)).rejects.toBeInstanceOf(
      ProviderAuthError,
    );
  });

  it.each([
    [{ "retry-after": "2" }, 2000],
    [{ "retry-after-ms": "250" }, 250],
    [{}, undefined],
  ])("maps 429 with %j to retryAfterMs %s", async (headers, expected) => {
    server.use(
      route("post", "/chat/completions", () =>
        HttpResponse.json({}, { status: 429, headers }),
      ),
    );
    const err = await build()
      .generate(request(), live)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderRateLimitError);
    expect(err).toMatchObject({ retryable: true, retryAfterMs: expected });
  });

  it("does not retry a 500: the server sees exactly one request", async () => {
    server.use(
      route("post", "/chat/completions", () =>
        HttpResponse.json({}, { status: 500 }),
      ),
    );
    const err = await build()
      .generate(request(), live)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderResponseError);
    expect(err).toMatchObject({ retryable: true });
    expect(received).toHaveLength(1);
  });

  it("maps a network failure to a retryable ProviderResponseError", async () => {
    server.use(route("post", "/chat/completions", () => HttpResponse.error()));
    const err = await build()
      .generate(request(), live)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderResponseError);
    expect(err).toMatchObject({ retryable: true });
  });

  it("maps a response without choices to ProviderResponseError", async () => {
    server.use(
      route("post", "/chat/completions", () =>
        HttpResponse.json({ id: "x", choices: [] }),
      ),
    );
    await expect(build().generate(request(), live)).rejects.toBeInstanceOf(
      ProviderResponseError,
    );
  });

  it("times out with a retryable ProviderTimeoutError when the server never answers", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    server.use(
      route(
        "post",
        "/chat/completions",
        () => new Promise<Response>(() => undefined),
      ),
    );
    const pending = build()
      .generate(request({ timeoutMs: 1000 }), live)
      .catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(1000);
    const err = await pending;
    expect(err).toBeInstanceOf(ProviderTimeoutError);
    expect(err).toMatchObject({ retryable: true });
  });

  it("rethrows the signal reason, not a timeout, when the caller aborts during the call", async () => {
    server.use(
      route(
        "post",
        "/chat/completions",
        () => new Promise<Response>(() => undefined),
      ),
    );
    const ac = new AbortController();
    const reason = new Error("cancelled by caller");
    const pending = build()
      .generate(request(), ac.signal)
      .catch((e: unknown) => e);
    await vi.waitFor(() => {
      expect(received).toHaveLength(1);
    });
    ac.abort(reason);
    expect(await pending).toBe(reason);
  });

  it("rethrows the signal reason without a request when already aborted", async () => {
    server.use(route("post", "/chat/completions", () => chatOk()));
    const ac = new AbortController();
    const reason = new Error("already cancelled");
    ac.abort(reason);
    await expect(build().generate(request(), ac.signal)).rejects.toBe(reason);
    expect(received).toHaveLength(0);
  });
});

describe("listModels", () => {
  it("returns the model ids", async () => {
    server.use(
      route("get", "/models", () =>
        HttpResponse.json({
          object: "list",
          data: [
            { id: "a", object: "model", created: 0, owned_by: "x" },
            { id: "b", object: "model", created: 0, owned_by: "x" },
          ],
        }),
      ),
    );
    expect(await build().listModels()).toEqual([{ id: "a" }, { id: "b" }]);
  });

  it("maps errors like generate does", async () => {
    server.use(
      route("get", "/models", () => HttpResponse.json({}, { status: 401 })),
    );
    await expect(build().listModels()).rejects.toBeInstanceOf(
      ProviderAuthError,
    );
  });
});
