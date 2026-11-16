import { randomUUID } from "node:crypto";
import type { AgentDefinition, TeamDefinition } from "@agentlab/core";
import { analystRole } from "../roles/analyst.js";
import { criticRole } from "../roles/critic.js";
import { managerRole } from "../roles/manager.js";
import { researcherRole } from "../roles/researcher.js";

export const RESEARCH_TEAM_ROLES = [
  "manager",
  "researcher",
  "analyst",
  "critic",
] as const;
export type ResearchTeamRole = (typeof RESEARCH_TEAM_ROLES)[number];

export interface ResearchTeamOptions {
  readonly providerId: string;
  readonly models: Readonly<Record<ResearchTeamRole, string>>;
  readonly newId?: () => string;
}

export interface ResearchTeam {
  readonly team: TeamDefinition;
  readonly agents: readonly AgentDefinition[];
}

const ROLES = {
  manager: { name: "Manager", def: managerRole },
  researcher: { name: "Researcher", def: researcherRole },
  analyst: { name: "Analyst", def: analystRole },
  critic: { name: "Critic", def: criticRole },
} as const;

export function buildResearchTeam(options: ResearchTeamOptions): ResearchTeam {
  const newId = options.newId ?? randomUUID;
  const agents = RESEARCH_TEAM_ROLES.map((key): AgentDefinition => {
    const { name, def } = ROLES[key];
    return {
      id: newId(),
      name,
      role: def.role,
      systemPrompt: def.systemPrompt,
      promptVersion: def.promptVersion,
      providerId: options.providerId,
      modelId: options.models[key],
      toolAllowlist: [],
      ...def.defaultLimits,
      outputSchema: structuredClone(def.outputJsonSchema),
      enabled: true,
    };
  });
  const team: TeamDefinition = {
    id: newId(),
    name: "Research team",
    graphBuilder: "research",
    agentIds: agents.map((a) => a.id),
  };
  return { team, agents };
}
