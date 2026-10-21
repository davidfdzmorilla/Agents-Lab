import { eq, sql } from "drizzle-orm";
import type { Budget } from "@agentlab/core";
import type { Database } from "../pool.js";
import { createProjectsRepository } from "../repositories/projects.js";
import { createRunsRepository } from "../repositories/runs.js";
import { runs, teamDefinitions, type Run } from "../schema/index.js";

export const TEST_BUDGET: Budget = {
  maxModelCalls: 10,
  maxConcurrentAgents: 2,
  maxReviewIterations: 1,
  timeoutMs: 60000,
  maxTokensPerCall: 1000,
  maxTotalTokens: 10000,
  maxContextRatio: 0.8,
  maxToolsPerInvocation: 2,
  maxResultChars: 5000,
  maxGraphDepth: 3,
};

export interface TestScope {
  readonly projectId: string;
  readonly teamId: string;
}

export async function createScope(db: Database): Promise<TestScope> {
  const project = await createProjectsRepository(db).create({
    name: "test project",
    budgetProfile: TEST_BUDGET,
  });
  const [team] = await db
    .insert(teamDefinitions)
    .values({
      projectId: project.id,
      name: "test team",
      graphBuilder: "research",
      agentIds: [],
    })
    .returning();
  if (team === undefined) throw new TypeError("team insert returned no row");
  return { projectId: project.id, teamId: team.id };
}

export function createQueuedRun(db: Database, scope: TestScope): Promise<Run> {
  return createRunsRepository(db).create({
    projectId: scope.projectId,
    teamId: scope.teamId,
    request: {
      projectId: scope.projectId,
      teamId: scope.teamId,
      input: "test input",
    },
    budget: TEST_BUDGET,
  });
}

export interface RunningRunOptions {
  readonly workerId: string | null;
  /** Age of the heartbeat in ms, computed by the database clock; null leaves it unset. */
  readonly heartbeatAgeMs: number | null;
}

export async function createRunningRun(
  db: Database,
  scope: TestScope,
  options: RunningRunOptions,
): Promise<Run> {
  const queued = await createQueuedRun(db, scope);
  const [row] = await db
    .update(runs)
    .set({
      status: "running",
      workerId: options.workerId,
      workerHeartbeatAt:
        options.heartbeatAgeMs === null
          ? null
          : sql`now() - ${options.heartbeatAgeMs} * interval '1 millisecond'`,
      startedAt: sql`now()`,
    })
    .where(eq(runs.id, queued.id))
    .returning();
  if (row === undefined) throw new TypeError("run update returned no row");
  return row;
}
