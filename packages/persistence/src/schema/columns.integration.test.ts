import { loadTestDatabaseUrl } from "@agentlab/core";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, expect, it } from "vitest";
import { createDatabase, createPool } from "../pool.js";
import { projects } from "./index.js";
import { TEST_BUDGET } from "../testing/fixtures.js";
import { truncateAll } from "../testing/index.js";

const pool = createPool(loadTestDatabaseUrl(), { max: 2 });
const db = createDatabase(pool);

beforeEach(async () => {
  await truncateAll(db);
});

afterAll(async () => {
  await pool.end();
});

// ARCHITECTURE §6 «Común»: "`created_at` y `updated_at` los fija PostgreSQL
// (`defaultNow()` y `now()` en cada `UPDATE`, inyectado por el repositorio vía
// `$onUpdate`), sin triggers. Ningún proceso escribe su propia hora."
// now() is transaction_timestamp(): inside one transaction it is frozen, so
// after pg_sleep the process clock is >= 50 ms ahead and only the DB clock
// can make updated_at = now() hold exactly.
it("refreshes updated_at with the database clock when an update sets no updatedAt", async () => {
  const [project] = await db
    .insert(projects)
    .values({ name: "clock", budgetProfile: TEST_BUDGET })
    .returning();
  expect(project).toBeDefined();
  const id = project?.id ?? "";
  await db.execute(
    sql`update projects set updated_at = now() - interval '1 minute' where id = ${id}::uuid`,
  );
  const [stale] = await db.select().from(projects).where(eq(projects.id, id));
  expect(stale).toBeDefined();

  const { same, updatedAt } = await db.transaction(async (tx) => {
    await tx.execute(sql`select now() as now`);
    await tx.execute(sql`select pg_sleep(0.05)`);
    await tx
      .update(projects)
      .set({ name: "clock-2" })
      .where(eq(projects.id, id));
    const check = await tx.execute<{ same: boolean }>(
      sql`select updated_at = now() as same from projects where id = ${id}::uuid`,
    );
    const [row] = await tx.select().from(projects).where(eq(projects.id, id));
    return { same: check.rows[0]?.same, updatedAt: row?.updatedAt };
  });

  expect(same).toBe(true);
  expect(updatedAt?.getTime()).toBeGreaterThan(stale?.updatedAt.getTime() ?? 0);
});
