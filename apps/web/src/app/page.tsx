import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-semibold">AgentLab</h1>
      <Link href="/projects" className="mt-4 inline-block underline">
        Projects
      </Link>
    </main>
  );
}
