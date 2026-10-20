import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores(["**/dist/", "**/.turbo/", "**/.next/", "**/coverage/"]),
  js.configs.recommended,
  tseslint.configs.strict,
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@agentlab/*/src", "@agentlab/*/src/**"],
              message:
                "Import from the package entry point (@agentlab/<pkg>), never from its src/.",
            },
          ],
        },
      ],
    },
  },
  prettier,
);
