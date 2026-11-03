import { defineConfig } from "vite-plus"
import base from "./packages/tooling/oxlint-config/src/base.ts"

// Lint and format run once from the workspace root; packages keep their own Vitest configs.
export default defineConfig({
  fmt: {
    printWidth: 120,
    semi: false,
    trailingComma: "none",
    proseWrap: "always",
    sortImports: { enabled: true, newlinesBetween: false, sortSpecifiers: true },
    sortPackageJson: false,
    ignorePatterns: [
      "**/dist/**",
      "**/coverage/**",
      "**/node_modules/**",
      "pnpm-lock.yaml",
      "api-reports/*.api.md",
      "**/.generated/**",
      "**/routeTree.gen.ts",
      // Written by pnpm --filter @buildkitgg/typescript-utils generate
      "packages/core/typescript-utils/src/index.ts",
      "packages/core/typescript-utils/reexports.json",
      "packages/core/typescript-utils/AGENTS.md",
      // The site shows these files as written, wrapped to fit its code editor
      "apps/site/src/examples/**",
      // Upstream copies, written by a sync script
      "**/src/vendor/**"
    ]
  },
  lint: {
    extends: [base],
    ignorePatterns: [
      "packages/tooling/catalog/templates/**",
      "**/src/vendor/**",
      // Code the anti-slop tests expect to be reported
      "packages/tooling/oxlint-config/test/fixture/slop.ts"
    ],
    options: { typeAware: true, typeCheck: true },
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      // Type-aware rules the code doesn't pass yet; turning one on means fixing its errors first.
      "typescript/unbound-method": "off",
      "typescript/no-floating-promises": "off",
      "typescript/no-base-to-string": "off",
      "typescript/no-useless-default-assignment": "off",
      "typescript/restrict-template-expressions": "off",
      "typescript/require-array-sort-compare": "off",
      "typescript/no-misused-spread": "off",
      "typescript/await-thenable": "off"
    },
    overrides: [
      {
        // The scaffolder's core runs in Workers and browsers.
        files: [
          "packages/tooling/scaffolder/src/core.ts",
          "packages/tooling/scaffolder/src/edit.ts",
          "packages/tooling/scaffolder/src/{manifest,resolve,plan,ownership,merge,state,points,upgrade,edit}/**"
        ],
        rules: {
          "no-restricted-imports": [
            "error",
            {
              patterns: [
                {
                  group: ["node:*"],
                  message: "The core runs in Workers and browsers: keep Node APIs in src/node or src/cli."
                }
              ]
            }
          ]
        }
      }
    ]
  },
  staged: {
    "*.{ts,tsx,js,jsx,mjs,cjs}": "vp lint --fix",
    "*.{ts,tsx,js,jsx,mjs,cjs,json,jsonc,md,yml,yaml}": "vp fmt --no-error-on-unmatched-pattern"
  }
})
