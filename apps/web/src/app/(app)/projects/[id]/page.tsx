import { loadEnv } from "@agentlab/core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { withDatabase } from "../../../../server/db.js";
import {
  getProjectView,
  type AgentIssue,
} from "../../../../server/projects.js";

export const dynamic = "force-dynamic";

const ISSUE_TEXT: Record<AgentIssue, string> = {
  provider_invalid: "Its provider configuration is invalid",
  provider_other_project:
    "Its provider configuration belongs to another project",
};

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const view = await withDatabase(loadEnv().DATABASE_URL, (db) =>
    getProjectView(db, id),
  );
  if (view === null) notFound();

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-8">
      <div>
        <Link href="/projects" className="text-sm underline">
          Projects
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{view.name}</h1>
      </div>

      <section>
        <h2 className="text-xl font-semibold">Provider configurations</h2>
        {view.providers.length === 0 ? (
          <p className="mt-2 text-slate-600">None.</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {view.providers.map((provider) => (
              <li key={provider.id} className="rounded border p-3">
                <p className="font-medium">
                  {provider.type ?? "unknown type"} ·{" "}
                  <span className={provider.valid ? "" : "text-red-700"}>
                    {provider.valid ? "valid" : "invalid"}
                  </span>
                </p>
                <p className="text-sm">
                  Default model: {provider.defaultModel}
                </p>
                {provider.capabilities === null ? null : (
                  <p className="text-sm text-slate-600">
                    tools {String(provider.capabilities.tools)} · structured
                    output {String(provider.capabilities.structuredOutput)} ·
                    streaming {String(provider.capabilities.streaming)} · max
                    context{" "}
                    {provider.capabilities.maxContextTokens ?? "unknown"} ·
                    usage {String(provider.capabilities.reportsUsage)} · cost{" "}
                    {String(provider.capabilities.reportsCost)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold">Agents</h2>
        {view.agents.length === 0 ? (
          <p className="mt-2 text-slate-600">None.</p>
        ) : (
          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr>
                <th className="py-1">Name</th>
                <th>Role</th>
                <th>Provider</th>
                <th>Model</th>
                <th>Enabled</th>
              </tr>
            </thead>
            <tbody>
              {view.agents.map((agent) => (
                <tr key={agent.id} className="border-t align-top">
                  <td className="py-1">{agent.name}</td>
                  <td>{agent.role}</td>
                  <td>{agent.providerType ?? agent.providerConfigId}</td>
                  <td>{agent.modelId}</td>
                  <td>{agent.enabled ? "yes" : "no"}</td>
                  <td className="text-red-700">
                    {agent.issues.map((issue) => (
                      <p key={issue}>{ISSUE_TEXT[issue]}</p>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
