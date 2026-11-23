import { describe, expect, it } from "vitest";
import { buildProjectView, isUuid } from "./projects.js";
import { agentRow, CONFIG_ID, configRow, PROJECT_ID } from "./test-rows.js";

const project = { id: PROJECT_ID, name: "p" };

describe("isUuid", () => {
  it("accepts a uuid and rejects anything else", () => {
    expect(isUuid(PROJECT_ID)).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid(`${PROJECT_ID}x`)).toBe(false);
    expect(isUuid("")).toBe(false);
  });
});

describe("buildProjectView", () => {
  it("shows an agent with a valid configuration without issues", () => {
    const view = buildProjectView(project, [configRow()], [agentRow()]);

    expect(view.agents).toEqual([
      expect.objectContaining({
        name: "agent",
        role: "researcher",
        providerConfigId: CONFIG_ID,
        providerType: "openrouter",
        modelId: "agent-model",
        enabled: true,
        issues: [],
      }),
    ]);
    expect(view.providers).toHaveLength(1);
  });

  it("flags an agent whose configuration is invalid", () => {
    const view = buildProjectView(
      project,
      [configRow({ providerType: "bogus" })],
      [agentRow()],
    );

    expect(view.agents[0]).toMatchObject({
      providerType: null,
      issues: ["provider_invalid"],
    });
  });

  it("flags an agent whose configuration belongs to another project", () => {
    const view = buildProjectView(
      project,
      [configRow()],
      [agentRow({ providerConfigId: "00000000-0000-4000-8000-0000000000c2" })],
    );

    expect(view.agents[0]).toMatchObject({
      providerType: null,
      issues: ["provider_other_project"],
    });
  });

  it("keeps the disabled flag and the order of the rows", () => {
    const view = buildProjectView(
      project,
      [],
      [
        agentRow({ name: "a", enabled: false }),
        agentRow({ name: "b", enabled: true }),
      ],
    );

    expect(view.agents.map((a) => [a.name, a.enabled])).toEqual([
      ["a", false],
      ["b", true],
    ]);
  });
});
