import { loadTestDatabaseUrl } from "@agentlab/core";
import {
  createServer,
  connect,
  type AddressInfo,
  type Server,
  type Socket,
} from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pingDatabase } from "./health.js";
import { createPool } from "./pool.js";

const testUrl = loadTestDatabaseUrl();
const TIMEOUT_MS = 2000;

const servers: Server[] = [];
const sockets: Socket[] = [];

function urlFor(port: number, host = "127.0.0.1"): string {
  const url = new URL(testUrl);
  url.hostname = host;
  url.port = String(port);
  return url.toString();
}

function listen(onConnection: (socket: Socket) => void): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer((socket) => {
      sockets.push(socket);
      socket.on("error", () => undefined);
      onConnection(socket);
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

describe("pingDatabase", () => {
  it("returns true and keeps the client in the pool when the database answers", async () => {
    const pool = createPool(testUrl, {
      max: 1,
      connectionTimeoutMillis: TIMEOUT_MS,
    });
    try {
      expect(await pingDatabase(pool, { timeoutMs: TIMEOUT_MS })).toBe(true);
      expect(pool.idleCount).toBe(1);
    } finally {
      await pool.end();
    }
  });

  it("returns false without throwing when the port is closed", async () => {
    const port = await listen(() => undefined);
    await new Promise<void>((resolve) => servers[0]?.close(() => resolve()));
    const pool = createPool(urlFor(port), {
      max: 1,
      connectionTimeoutMillis: TIMEOUT_MS,
    });
    pool.on("error", () => undefined);
    try {
      expect(await pingDatabase(pool, { timeoutMs: TIMEOUT_MS })).toBe(false);
      expect(pool.totalCount).toBe(0);
    } finally {
      await pool.end();
    }
  });

  it("returns false exactly when the deadline passes if the server accepts but never answers", async () => {
    const port = await listen(() => undefined);
    const pool = createPool(urlFor(port), { max: 1 });
    pool.on("error", () => undefined);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      let result: boolean | undefined;
      const ping = pingDatabase(pool, { timeoutMs: TIMEOUT_MS }).then((v) => {
        result = v;
      });
      await vi.advanceTimersByTimeAsync(TIMEOUT_MS - 1);
      expect(result).toBeUndefined();
      await vi.advanceTimersByTimeAsync(1);
      await ping;
      expect(result).toBe(false);
    } finally {
      vi.useRealTimers();
      for (const socket of sockets.splice(0)) socket.destroy();
      await pool.end();
    }
  });

  it("returns false and destroys the client when the query hangs after connecting", async () => {
    const target = new URL(testUrl);
    let querySwallowed: () => void = () => undefined;
    const swallowed = new Promise<void>((resolve) => {
      querySwallowed = resolve;
    });
    // Forwards everything to the real database except the first simple Query ('Q') message.
    const port = await listen((client) => {
      const upstream = connect(Number(target.port || 5432), target.hostname);
      sockets.push(upstream);
      upstream.on("error", () => client.destroy());
      client.on("close", () => upstream.destroy());
      upstream.on("data", (chunk) => client.write(chunk));
      client.on("data", (chunk: Buffer) => {
        if (chunk[0] === 0x51) {
          querySwallowed();
          return;
        }
        upstream.write(chunk);
      });
    });
    const pool = createPool(urlFor(port), { max: 1 });
    pool.on("error", () => undefined);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      let result: boolean | undefined;
      const ping = pingDatabase(pool, { timeoutMs: TIMEOUT_MS }).then((v) => {
        result = v;
      });
      await swallowed;
      await vi.advanceTimersByTimeAsync(TIMEOUT_MS - 1);
      expect(result).toBeUndefined();
      await vi.advanceTimersByTimeAsync(1);
      await ping;
      expect(result).toBe(false);
      expect(pool.totalCount).toBe(0);
    } finally {
      vi.useRealTimers();
      for (const socket of sockets.splice(0)) socket.destroy();
      await pool.end();
    }
  });
});
