import { loadTestDatabaseUrl } from "@agentlab/core";
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase, createPool } from "../pool.js";
import { runEvents } from "../schema/index.js";
import {
  createQueuedRun,
  createScope,
  type TestScope,
} from "../testing/fixtures.js";
import { truncateAll } from "../testing/index.js";
import { createEventsRepository, type NewRunEvent } from "./events.js";

const pool = createPool(loadTestDatabaseUrl(), { max: 8 });
const db = createDatabase(pool);
const repo = createEventsRepository(db);
let scope: TestScope;

const step: NewRunEvent = {
  type: "run.step",
  payload: { node: "plan", step: 1 },
};

beforeEach(async () => {
  await truncateAll(db);
  scope = await createScope(db);
});

afterAll(async () => {
  await pool.end();
});

describe("append", () => {
  it("returns a valid RunEvent with seq 1 for the first event", async () => {
    const run = await createQueuedRun(db, scope);
    const event = await repo.append(run.id, step);
    expect(event).toMatchObject({
      type: "run.step",
      runId: run.id,
      seq: 1,
      payload: { node: "plan", step: 1 },
    });
  });

  it("assigns contiguous seq 1..50 across 50 concurrent appends", async () => {
    const run = await createQueuedRun(db, scope);
    const events = await Promise.all(
      Array.from({ length: 50 }, () => repo.append(run.id, step)),
    );
    const seqs = events.map((event) => event.seq).sort((a, b) => a - b);
    expect(seqs).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
  });

  it("keeps independent sequences for two interleaved runs", async () => {
    const a = await createQueuedRun(db, scope);
    const b = await createQueuedRun(db, scope);
    const events = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        repo.append(i % 2 === 0 ? a.id : b.id, step),
      ),
    );
    for (const run of [a, b]) {
      const seqs = events
        .filter((event) => event.runId === run.id)
        .map((event) => event.seq)
        .sort((x, y) => x - y);
      expect(seqs).toEqual(Array.from({ length: 10 }, (_, i) => i + 1));
    }
  });

  it("rejects a payload that does not satisfy RunEventSchema without inserting", async () => {
    const run = await createQueuedRun(db, scope);
    const invalid = {
      type: "run.step",
      payload: { node: "", step: -1 },
    } satisfies NewRunEvent;
    await expect(repo.append(run.id, invalid)).rejects.toThrow();
    expect(await db.select().from(runEvents)).toHaveLength(0);
  });

  it("rejects an event for a run that does not exist", async () => {
    await expect(repo.append(randomUUID(), step)).rejects.toThrow();
    expect(await db.select().from(runEvents)).toHaveLength(0);
  });
});

describe("listSince", () => {
  it("returns events with seq greater than n in ascending order", async () => {
    const run = await createQueuedRun(db, scope);
    for (let i = 0; i < 50; i += 1) await repo.append(run.id, step);
    const events = await repo.listSince(run.id, 10);
    expect(events.map((event) => event.seq)).toEqual(
      Array.from({ length: 40 }, (_, i) => i + 11),
    );
  });

  it("returns an empty list for a run without events", async () => {
    const run = await createQueuedRun(db, scope);
    expect(await repo.listSince(run.id, 0)).toEqual([]);
  });
});
