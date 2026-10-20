import { defineConfig } from "vitest/config";

// Integration tests share the agentlab_test database: one runner, files in series (testing-conventions rule 11).
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    fileParallelism: false,
    restoreMocks: true,
    globalSetup: ["src/testing/global-setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/testing/global-setup.ts"],
      reporter: ["text", "json-summary"],
    },
  },
});
