// No static imports: the signal handlers must exist before the heavy modules (drizzle, pg) load,
// so a SIGTERM during startup is queued and honoured instead of killing the process (TASK-008, decision 2).
const shutdown = new AbortController();
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    shutdown.abort();
  });
}

const { main } = await import("./main.js");
process.exitCode = await main({ shutdown: shutdown.signal });
