import { createPool, pingDatabase } from "@agentlab/persistence";
import packageJson from "../../package.json" with { type: "json" };

export const HEALTH_TIMEOUT_MS = 2000;

const headers = { "cache-control": "no-store" };

export async function checkHealth(
  databaseUrl: string,
  timeoutMs: number = HEALTH_TIMEOUT_MS,
): Promise<Response> {
  const pool = createPool(databaseUrl, {
    max: 1,
    connectionTimeoutMillis: timeoutMs,
  });
  // An idle client error must not take the process down.
  pool.on("error", () => undefined);
  const up = await pingDatabase(pool, { timeoutMs });
  void pool.end().catch(() => undefined);
  if (up) {
    return Response.json(
      { ok: true, db: "up", version: packageJson.version },
      { headers },
    );
  }
  return Response.json({ ok: false, db: "down" }, { status: 503, headers });
}
