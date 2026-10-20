import { asc, eq } from "drizzle-orm";
import type { Database } from "../pool.js";
import {
  agentDefinitions,
  type AgentDefinitionRow,
  type NewAgentDefinitionRow,
} from "../schema/index.js";
import { requireRow } from "./rows.js";

export type CreateAgentDefinitionInput = Omit<
  NewAgentDefinitionRow,
  "id" | "createdAt" | "updatedAt"
>;

export interface AgentDefinitionsRepository {
  create(input: CreateAgentDefinitionInput): Promise<AgentDefinitionRow>;
  get(id: string): Promise<AgentDefinitionRow | null>;
  listByProject(projectId: string): Promise<AgentDefinitionRow[]>;
}

export function createAgentDefinitionsRepository(
  db: Database,
): AgentDefinitionsRepository {
  return {
    async create(input) {
      const [row] = await db.insert(agentDefinitions).values(input).returning();
      return requireRow(row);
    },
    async get(id) {
      const [row] = await db
        .select()
        .from(agentDefinitions)
        .where(eq(agentDefinitions.id, id));
      return row ?? null;
    },
    listByProject(projectId) {
      return db
        .select()
        .from(agentDefinitions)
        .where(eq(agentDefinitions.projectId, projectId))
        .orderBy(asc(agentDefinitions.createdAt), asc(agentDefinitions.id));
    },
  };
}
