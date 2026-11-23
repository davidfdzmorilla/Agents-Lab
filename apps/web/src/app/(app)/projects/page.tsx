import { loadEnv } from "@agentlab/core";
import Link from "next/link";
import { withDatabase } from "../../../server/db.js";
import { listProjectSummaries } from "../../../server/projects.js";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await withDatabase(
    loadEnv().DATABASE_URL,
    listProjectSummaries,
  );
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">Projects</h1>
      {projects.length === 0 ? (
        <p className="mt-4 text-slate-600">No projects yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {projects.map((project) => (
            <li key={project.id}>
              <Link href={`/projects/${project.id}`} className="underline">
                {project.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
