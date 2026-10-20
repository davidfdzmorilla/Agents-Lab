import { InvalidApiKeyEnvError, isApiKeyEnvName } from "@agentlab/core";
import { asc, eq } from "drizzle-orm";
import type { Database } from "../pool.js";
import { providerConfigs, type ProviderConfigRow } from "../schema/index.js";
import { requireRow } from "./rows.js";

const API_KEY_ENV_MAX_LENGTH = 40;

export interface CreateProviderConfigInput {
  readonly projectId: string;
  readonly providerType: string;
  readonly baseUrl: string | null;
  readonly defaultModel: string;
  readonly apiKeyEnv: string | null;
}

export interface ProviderConfigsRepository {
  create(input: CreateProviderConfigInput): Promise<ProviderConfigRow>;
  get(id: string): Promise<ProviderConfigRow | null>;
  listByProject(projectId: string): Promise<ProviderConfigRow[]>;
}

// Validation happens here and not in a CHECK so a rejected value never reaches the database logs (OD-023).
function assertApiKeyEnv(name: string | null): void {
  if (name === null) return;
  if (name.length > API_KEY_ENV_MAX_LENGTH || !isApiKeyEnvName(name)) {
    throw new InvalidApiKeyEnvError();
  }
}

export function createProviderConfigsRepository(
  db: Database,
): ProviderConfigsRepository {
  return {
    async create(input) {
      assertApiKeyEnv(input.apiKeyEnv);
      const [row] = await db.insert(providerConfigs).values(input).returning();
      return requireRow(row);
    },
    async get(id) {
      const [row] = await db
        .select()
        .from(providerConfigs)
        .where(eq(providerConfigs.id, id));
      return row ?? null;
    },
    listByProject(projectId) {
      return db
        .select()
        .from(providerConfigs)
        .where(eq(providerConfigs.projectId, projectId))
        .orderBy(asc(providerConfigs.createdAt), asc(providerConfigs.id));
    },
  };
}
