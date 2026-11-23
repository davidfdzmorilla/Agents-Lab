import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { HttpResponse, http } from "msw";
import { ProviderResponseError } from "@agentlab/core";
import {
  GENERATE_PATH,
  LIST_PATH,
  buildProvider,
  generateOk,
  received,
  request,
  route,
  server,
} from "./test-server.js";

const live = new AbortController().signal;
const TARGET = "https://redirect-target.test/v1beta/models/m:generateContent";

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  received.length = 0;
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

describe("redirects are never followed (TD-141, Gemini)", () => {
  it.each([301, 302, 307, 308])(
    "fails closed on HTTP %i: one request, nothing sent to the target, a non-retryable connection error without cause",
    async (status) => {
      const targetHits: Headers[] = [];
      server.use(
        route(
          "post",
          GENERATE_PATH,
          () =>
            new HttpResponse(null, { status, headers: { Location: TARGET } }),
        ),
        http.all(TARGET, ({ request: r }) => {
          targetHits.push(new Headers(r.headers));
          return generateOk();
        }),
      );

      const err = await buildProvider()
        .generate(request(), live)
        .catch((e: unknown) => e);

      expect(received).toHaveLength(1);
      expect(targetHits).toHaveLength(0);
      expect(err).toBeInstanceOf(ProviderResponseError);
      expect((err as ProviderResponseError).message).toBe(
        'Provider "gemini" connection failed',
      );
      expect(err).toHaveProperty("retryable", false);
      expect((err as ProviderResponseError).cause).toBeUndefined();
    },
  );

  it("also refuses a redirect on listModels", async () => {
    server.use(
      route(
        "get",
        LIST_PATH,
        () =>
          new HttpResponse(null, {
            status: 307,
            headers: { Location: TARGET },
          }),
      ),
    );
    const err = await buildProvider()
      .listModels()
      .catch((e: unknown) => e);
    expect(received).toHaveLength(1);
    expect(err).toBeInstanceOf(ProviderResponseError);
    expect(err).toHaveProperty("retryable", false);
  });
});
