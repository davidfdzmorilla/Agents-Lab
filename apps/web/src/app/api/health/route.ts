import { loadEnv } from "@agentlab/core";
import { checkHealth } from "../../../server/health.js";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return checkHealth(loadEnv().DATABASE_URL);
}
