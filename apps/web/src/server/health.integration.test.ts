import { loadTestDatabaseUrl } from "@agentlab/core";
import {
  createServer,
  type AddressInfo,
  type Server,
  type Socket,
} from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import packageJson from "../../package.json" with { type: "json" };
import { checkHealth, HEALTH_TIMEOUT_MS } from "./health.js";

const testUrl = loadTestDatabaseUrl();
const CANARY = "canary-pw-7731";

const servers: Server[] = [];
const sockets: Socket[] = [];

function urlFor(port: number): string {
  const url = new URL(testUrl);
  url.hostname = "127.0.0.1";
  url.port = String(port);
  url.password = CANARY;
  return url.toString();
}

function listenSilent(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer((socket) => {
      sockets.push(socket);
      socket.on("error", () => undefined);
    });
    servers.push(server);
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      resolve((server.address() as AddressInfo).port);
    });
  });
}

afterEach(() => {
  vi.useRealTimers();
  for (const socket of sockets.splice(0)) socket.destroy();
  for (const server of servers.splice(0)) server.close();
});

describe("checkHealth", () => {
  it("answers 200 with ok, db up and the package version when the database responds", async () => {
    const response = await checkHealth(testUrl);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toMatch(/^application\/json/);
    expect(await response.json()).toEqual({
      ok: true,
      db: "up",
      version: packageJson.version,
    });
  });

  it("answers 503 without leaking the connection string when the port is closed", async () => {
    const response = await checkHealth(urlFor(1));
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(JSON.parse(text)).toEqual({ ok: false, db: "down" });
    expect(text).not.toContain(CANARY);
  });

  it("answers 503 exactly when the 2 s deadline passes on a server that never replies", async () => {
    const port = await listenSilent();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    let settled = false;
    const pending = checkHealth(urlFor(port)).then((response) => {
      settled = true;
      return response;
    });

    await vi.advanceTimersByTimeAsync(HEALTH_TIMEOUT_MS - 1);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    const response = await pending;
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, db: "down" });
  });
});
