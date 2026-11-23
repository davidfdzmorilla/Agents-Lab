import {
  ProviderConfigInvalidError,
  type ProviderCapabilities,
} from "@agentlab/core";
import {
  createAgentDefinitionsRepository,
  createProjectsRepository,
  createProviderConfigsRepository,
  type AgentDefinitionRow,
  type Database,
  type ProviderConfigRow,
} from "@agentlab/persistence";
import {
  isProviderType,
  PROVIDER_PRESETS,
  providerConfigFromRecord,
  type ProviderType,
} from "@agentlab/providers/presets";
import { withDatabase } from "./db.js";

export interface ProviderView {
  readonly id: string;
  readonly projectId: string;
  readonly type: ProviderType | null;
  readonly valid: boolean;
  readonly error: { readonly code: "PROVIDER_CONFIG_INVALID" } | null;
  readonly defaultModel: string;
  readonly capabilities: ProviderCapabilities | null;
  readonly models: readonly { readonly id: string }[];
}

const headers = { "cache-control": "no-store" };

// Only the fields the contract allows leave this function: never base_url nor api_key_env.
export function toProviderView(
  row: ProviderConfigRow,
  agents: readonly AgentDefinitionRow[],
): ProviderView {
  const modelIds = [row.defaultModel];
  for (const agent of agents) {
    if (agent.providerConfigId === row.id && !modelIds.includes(agent.modelId))
      modelIds.push(agent.modelId);
  }
  const models = modelIds.map((id) => ({ id }));

  let type: ProviderType | null = null;
  try {
    providerConfigFromRecord(row);
    if (isProviderType(row.providerType)) type = row.providerType;
  } catch (error) {
    if (!(error instanceof ProviderConfigInvalidError)) throw error;
  }

  if (type === null) {
    return {
      id: row.id,
      projectId: row.projectId,
      type: null,
      valid: false,
      error: { code: "PROVIDER_CONFIG_INVALID" },
      defaultModel: row.defaultModel,
      capabilities: null,
      models,
    };
  }
  return {
    id: row.id,
    projectId: row.projectId,
    type,
    valid: true,
    error: null,
    defaultModel: row.defaultModel,
    capabilities: { ...PROVIDER_PRESETS[type].capabilities },
    models,
  };
}

export async function listProviderViews(db: Database): Promise<ProviderView[]> {
  const configs = createProviderConfigsRepository(db);
  const agents = createAgentDefinitionsRepository(db);
  const views: ProviderView[] = [];
  // N+1 queries, N small (single user): TD-038 / TASK-014.
  for (const project of await createProjectsRepository(db).list()) {
    const [rows, agentRows] = await Promise.all([
      configs.listByProject(project.id),
      agents.listByProject(project.id),
    ]);
    for (const row of rows) views.push(toProviderView(row, agentRows));
  }
  return views;
}

// Any failure, the database included, gives the same fixed body: the exception is never echoed.
export async function providersResponse(
  databaseUrl: string,
): Promise<Response> {
  try {
    const providers = await withDatabase(databaseUrl, listProviderViews);
    return Response.json({ providers }, { headers });
  } catch {
    return Response.json(
      { code: "INTERNAL", message: "Internal server error" },
      { status: 500, headers },
    );
  }
}
