import { loadEnv } from "@agentlab/core";
import { providersResponse } from "../../../server/providers.js";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return providersResponse(loadEnv().DATABASE_URL);
}
