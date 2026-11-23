import type { AgentRole } from "@agentlab/core";
import {
  createAgentDefinitionsRepository,
  createProjectsRepository,
  createProviderConfigsRepository,
  type AgentDefinitionRow,
  type Database,
  type Project,
  type ProviderConfigRow,
} from "@agentlab/persistence";
import { toProviderView, type ProviderView } from "./providers.js";

export type AgentIssue = "provider_invalid" | "provider_other_project";

export interface AgentView {
  readonly id: string;
  readonly name: string;
  readonly role: AgentRole;
  readonly providerConfigId: string;
  // Null when the configuration is not one of this project's.
  readonly providerType: ProviderView["type"];
  readonly modelId: string;
  readonly enabled: boolean;
  readonly issues: readonly AgentIssue[];
}

export interface ProjectView {
  readonly id: string;
  readonly name: string;
  readonly providers: readonly ProviderView[];
  readonly agents: readonly AgentView[];
}

export interface ProjectSummary {
  readonly id: string;
  readonly name: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

// The foreign key does not stop an agent from pointing at another project's configuration.
export function buildProjectView(
  project: Pick<Project, "id" | "name">,
  providerRows: readonly ProviderConfigRow[],
  agentRows: readonly AgentDefinitionRow[],
): ProjectView {
  const providers = providerRows.map((row) => toProviderView(row, agentRows));
  const byId = new Map(providers.map((view) => [view.id, view]));
  const agents = agentRows.map((agent): AgentView => {
    const provider = byId.get(agent.providerConfigId);
    const issues: AgentIssue[] = [];
    if (provider === undefined) issues.push("provider_other_project");
    else if (!provider.valid) issues.push("provider_invalid");
    return {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      providerConfigId: agent.providerConfigId,
      providerType: provider?.type ?? null,
      modelId: agent.modelId,
      enabled: agent.enabled,
      issues,
    };
  });
  return { id: project.id, name: project.name, providers, agents };
}

export async function getProjectView(
  db: Database,
  projectId: string,
): Promise<ProjectView | null> {
  if (!isUuid(projectId)) return null;
  const project = await createProjectsRepository(db).get(projectId);
  if (project === null) return null;
  const [providerRows, agentRows] = await Promise.all([
    createProviderConfigsRepository(db).listByProject(projectId),
    createAgentDefinitionsRepository(db).listByProject(projectId),
  ]);
  return buildProjectView(project, providerRows, agentRows);
}

export async function listProjectSummaries(
  db: Database,
): Promise<ProjectSummary[]> {
  const rows = await createProjectsRepository(db).list();
  return rows.map(({ id, name }) => ({ id, name }));
}
