import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const monorepoRoot = fileURLToPath(new URL("../..", import.meta.url));

// Workspace packages export .ts and import siblings with a .js suffix; webpack needs the alias to find them (ADR-012).
const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: monorepoRoot,
  transpilePackages: ["@agentlab/core", "@agentlab/persistence"],
  poweredByHeader: false,
  // No image optimizer until next/image is used (security LOW, TASK-007); keeps sharp unused at runtime.
  images: { unoptimized: true },
  webpack: (config: {
    resolve: { extensionAlias?: Record<string, string[]> };
  }) => {
    config.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"] };
    return config;
  },
};

export default nextConfig;
