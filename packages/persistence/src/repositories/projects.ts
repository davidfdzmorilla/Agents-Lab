import type { Budget } from "@agentlab/core";
import { asc, eq } from "drizzle-orm";
import type { Database } from "../pool.js";
import { projects, type Project } from "../schema/index.js";
import { requireRow } from "./rows.js";

export interface ProjectsRepository {
  create(input: {
    readonly name: string;
    readonly budgetProfile: Budget;
  }): Promise<Project>;
  get(id: string): Promise<Project | null>;
  list(): Promise<Project[]>;
}

export function createProjectsRepository(db: Database): ProjectsRepository {
  return {
    async create(input) {
      const [row] = await db.insert(projects).values(input).returning();
      return requireRow(row);
    },
    async get(id) {
      const [row] = await db.select().from(projects).where(eq(projects.id, id));
      return row ?? null;
    },
    list() {
      return db
        .select()
        .from(projects)
        .orderBy(asc(projects.createdAt), asc(projects.id));
    },
  };
}
