// Test entry point: same bootstrap as index.ts, but the executor is driven through stdin lines:
//   release        -> the run completes
//   block <ms>     -> logs "blocking" and spins the event loop for <ms>
// Aborting the executor signal makes it return "interrupted".
import { writeSync } from "node:fs";
import { createInterface } from "node:readline";

const shutdown = new AbortController();
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    shutdown.abort();
  });
}
// Lets tests send SIGTERM at the earliest safe point: handlers installed, nothing else loaded.
writeSync(1, `${JSON.stringify({ msg: "signal handlers registered" })}\n`);

const { main } = await import("../main.js");

process.exitCode = await main({
  shutdown: shutdown.signal,
  executor: {
    execute: (_run, signal) =>
      new Promise((resolve) => {
        const lines = createInterface({ input: process.stdin });
        const settle = (outcome: "completed" | "interrupted") => {
          lines.close();
          // A paused stdin pipe that already carried data keeps the event loop alive.
          process.stdin.destroy();
          resolve(outcome);
        };
        lines.on("line", (line) => {
          if (line === "release") settle("completed");
          else if (line.startsWith("block ")) {
            writeSync(1, `${JSON.stringify({ msg: "blocking" })}\n`);
            const end = Date.now() + Number(line.slice("block ".length));
            while (Date.now() < end) {
              // Busy wait on purpose: simulates a handler that blocks the event loop.
            }
          }
        });
        signal.addEventListener(
          "abort",
          () => {
            settle("interrupted");
          },
          { once: true },
        );
      }),
  },
});
