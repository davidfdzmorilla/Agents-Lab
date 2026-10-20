// Provisional worker (TASK-003): stays alive until SIGTERM/SIGINT, then exits 0.
// TASK-008 replaces it with the real worker and a pino logger.

function log(msg: string, extra: Record<string, string> = {}): void {
  process.stdout.write(
    `${JSON.stringify({ ...extra, level: 30, time: Date.now(), name: "worker", msg })}\n`,
  );
}

function main(): void {
  log("worker started (provisional)");
  const keepAlive = setInterval(() => undefined, 60_000);
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, () => {
      clearInterval(keepAlive);
      log("worker stopping", { signal });
    });
  }
}

main();
