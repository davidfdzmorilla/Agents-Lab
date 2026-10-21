import { loadTestDatabaseUrl } from "@agentlab/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import packageJson from "../../../../package.json" with { type: "json" };
import { dynamic, GET } from "./route.js";

const testUrl = loadTestDatabaseUrl();
const CANARY = "canary-pw-4417";

function closedPortUrl(): string {
  const url = new URL(testUrl);
  url.hostname = "127.0.0.1";
  url.port = "1";
  url.password = CANARY;
  return url.toString();
}

// Next invokes route handlers with the incoming request; GET ignores it.
async function call(): Promise<Response> {
  const handler = GET as (request: Request) => Promise<Response>;
  return handler(new Request("http://localhost:3000/api/health"));
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/health", () => {
  it("is evaluated per request, never prerendered", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("answers 200 JSON with no-store and the package version when the database responds", async () => {
    vi.stubEnv("DATABASE_URL", testUrl);

    const response = await call();

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toMatch(/^application\/json/);
    expect(await response.json()).toEqual({
      ok: true,
      db: "up",
      version: packageJson.version,
    });
  });

  it("answers 503 JSON with no-store and no connection string when the database is down", async () => {
    vi.stubEnv("DATABASE_URL", closedPortUrl());

    const response = await call();
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toMatch(/^application\/json/);
    expect(JSON.parse(text)).toEqual({ ok: false, db: "down" });
    expect(text).not.toContain(CANARY);
  });
});
