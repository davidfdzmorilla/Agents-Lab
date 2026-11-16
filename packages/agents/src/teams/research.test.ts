import { describe, expect, it } from "vitest";
import { AgentDefinitionSchema, TeamDefinitionSchema } from "@agentlab/core";
import { AgentLimitsSchema } from "../role.js";
import { analystRole } from "../roles/analyst.js";
import { criticRole } from "../roles/critic.js";
import { managerRole } from "../roles/manager.js";
import { researcherRole } from "../roles/researcher.js";
import { RESEARCH_TEAM_ROLES, buildResearchTeam } from "./research.js";

const PROVIDER_ID = "2f6f0c1e-8a3b-4c52-9d4e-1a7b5c3d9e10";
const MODELS = {
  manager: "fake-manager",
  researcher: "fake-researcher",
  analyst: "fake-analyst",
  critic: "fake-critic",
};

function counterIds(): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  };
}

describe("buildResearchTeam", () => {
  const roleDefs = {
    manager: managerRole,
    researcher: researcherRole,
    analyst: analystRole,
    critic: criticRole,
  };

  it("builds a team and agents that satisfy the core schemas", () => {
    const { team, agents } = buildResearchTeam({
      providerId: PROVIDER_ID,
      models: MODELS,
      newId: counterIds(),
    });
    expect(TeamDefinitionSchema.safeParse(team).success).toBe(true);
    for (const agent of agents) {
      expect(AgentDefinitionSchema.safeParse(agent).success).toBe(true);
    }
  });

  it("lists agentIds in role order and uses the research graph builder", () => {
    const { team, agents } = buildResearchTeam({
      providerId: PROVIDER_ID,
      models: MODELS,
      newId: counterIds(),
    });
    expect(team.graphBuilder).toBe("research");
    expect(agents.map((a) => a.role)).toEqual([
      "manager",
      "researcher",
      "analyst",
      "critic",
    ]);
    expect(agents.map((a) => a.name)).toEqual([
      "Manager",
      "Researcher",
      "Analyst",
      "Critic",
    ]);
    expect(agents.map((a) => a.modelId)).toEqual([
      "fake-manager",
      "fake-researcher",
      "fake-analyst",
      "fake-critic",
    ]);
    expect(team.agentIds).toEqual(agents.map((a) => a.id));
  });

  it("returns mutable agents independent of the frozen roles", () => {
    const { agents } = buildResearchTeam({
      providerId: PROVIDER_ID,
      models: MODELS,
    });
    const first = agents[0];
    if (!first) throw new TypeError("no agents");
    first.maxCalls = 99;
    expect(managerRole.defaultLimits.maxCalls).not.toBe(99);
    expect(Object.isFrozen(first)).toBe(false);
    expect(Object.isFrozen(first.outputSchema)).toBe(false);
  });

  it("generates distinct ids across two calls", () => {
    const options = { providerId: PROVIDER_ID, models: MODELS };
    const a = buildResearchTeam(options);
    const b = buildResearchTeam(options);
    const ids = new Set([
      a.team.id,
      ...a.agents.map((x) => x.id),
      b.team.id,
      ...b.agents.map((x) => x.id),
    ]);
    expect(ids.size).toBe(10);
  });

  it("takes model, limits, prompt and version from each role", () => {
    const { agents } = buildResearchTeam({
      providerId: PROVIDER_ID,
      models: MODELS,
      newId: counterIds(),
    });
    for (const [i, key] of RESEARCH_TEAM_ROLES.entries()) {
      const agent = agents[i];
      const def = roleDefs[key];
      expect(agent?.modelId).toBe(MODELS[key]);
      expect(agent?.providerId).toBe(PROVIDER_ID);
      expect(agent?.systemPrompt).toBe(def.systemPrompt);
      expect(agent?.promptVersion).toBe(def.promptVersion);
      expect(agent?.maxCalls).toBe(def.defaultLimits.maxCalls);
      expect(agent?.maxTokens).toBe(def.defaultLimits.maxTokens);
      expect(agent?.timeoutMs).toBe(def.defaultLimits.timeoutMs);
      expect(agent?.toolAllowlist).toEqual([]);
      expect(agent?.enabled).toBe(true);
    }
  });

  it("gives every role default limits that satisfy AgentLimitsSchema", () => {
    for (const def of Object.values(roleDefs)) {
      expect(AgentLimitsSchema.safeParse(def.defaultLimits).success).toBe(true);
    }
  });

  it("copies the JSON Schema so mutating it does not touch the role", () => {
    const { agents } = buildResearchTeam({
      providerId: PROVIDER_ID,
      models: MODELS,
      newId: counterIds(),
    });
    const first = agents[0];
    expect(first?.outputSchema).toEqual(managerRole.outputJsonSchema);
    expect(first?.outputSchema).not.toBe(managerRole.outputJsonSchema);
    if (first) first.outputSchema["mutated"] = true;
    expect(managerRole.outputJsonSchema).not.toHaveProperty("mutated");
  });

  it("generates five distinct UUIDs when no newId is given", () => {
    const { team, agents } = buildResearchTeam({
      providerId: PROVIDER_ID,
      models: MODELS,
    });
    const ids = new Set([team.id, ...agents.map((a) => a.id)]);
    expect(ids.size).toBe(5);
    expect(TeamDefinitionSchema.safeParse(team).success).toBe(true);
  });
});
