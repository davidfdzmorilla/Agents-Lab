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
import { HttpResponse, http } from "msw";
import { ProviderResponseError } from "@agentlab/core";
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

const live = new AbortController().signal;
const TARGET = "https://redirect-target.test/v1/chat/completions";

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  received.length = 0;
});
afterEach(() => {
  server.resetHandlers();
  vi.unstubAllEnvs();
});
afterAll(() => {
  server.close();
});

function build(apiKeyEnv: string | null = "OPENROUTER_API_KEY") {
  return new OpenAICompatibleProvider({
    id: "openrouter",
    baseUrl: BASE,
    apiKeyEnv,
    capabilities: CAPS,
    secretResolver: () => CANARY,
  });
}

describe("redirects are never followed (TD-141 L2)", () => {
  it.each([301, 302, 307, 308])(
    "fails closed on HTTP %i: one request, nothing sent to the target, a non-retryable connection error without cause",
    async (status) => {
      const targetHits: Headers[] = [];
      server.use(
        route(
          "post",
          "/chat/completions",
          () =>
            new HttpResponse(null, { status, headers: { Location: TARGET } }),
        ),
        http.all(TARGET, ({ request: r }) => {
          targetHits.push(new Headers(r.headers));
          return chatOk();
        }),
      );

      const err = await build()
        .generate(request(), live)
        .catch((e: unknown) => e);

      expect(received).toHaveLength(1);
      expect(targetHits).toHaveLength(0);
      expect(err).toBeInstanceOf(ProviderResponseError);
      expect((err as ProviderResponseError).message).toBe(
        'Provider "openrouter" connection failed',
      );
      expect(err).toHaveProperty("retryable", false);
      expect((err as ProviderResponseError).cause).toBeUndefined();
    },
  );

  it("also refuses a redirect on listModels", async () => {
    server.use(
      route(
        "get",
        "/models",
        () =>
          new HttpResponse(null, {
            status: 307,
            headers: { Location: TARGET },
          }),
      ),
    );
    const err = await build()
      .listModels()
      .catch((e: unknown) => e);
    expect(received).toHaveLength(1);
    expect(err).toHaveProperty("retryable", false);
  });
});

describe("OPENAI_CUSTOM_HEADERS cannot replace Authorization (TD-142)", () => {
  it("sends the key from the resolver, not the one in the environment", async () => {
    vi.stubEnv("OPENAI_CUSTOM_HEADERS", "Authorization: Bearer attacker");
    server.use(route("post", "/chat/completions", () => chatOk()));
    await build().generate(request(), live);
    expect(received).toHaveLength(1);
    expect(received[0]?.headers.get("authorization")).toBe(`Bearer ${CANARY}`);
  });

  it("sends no Authorization at all without a key, whatever the environment says", async () => {
    vi.stubEnv("OPENAI_CUSTOM_HEADERS", "Authorization: Bearer attacker");
    server.use(route("post", "/chat/completions", () => chatOk()));
    await build(null).generate(request(), live);
    expect(received).toHaveLength(1);
    expect(received[0]?.headers.has("authorization")).toBe(false);
  });

  it("still accepts other custom headers from the environment (OD-064 (a))", async () => {
    vi.stubEnv("OPENAI_CUSTOM_HEADERS", "X-Operator-Tag: ok");
    server.use(route("post", "/chat/completions", () => chatOk()));
    await build().generate(request(), live);
    expect(received[0]?.headers.get("x-operator-tag")).toBe("ok");
  });
});
