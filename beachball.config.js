// @ts-check
/// <reference types="node" />
import { writeFileSync } from "node:fs"
import { join } from "node:path"

/**
 * Beachball manages versioning and changelogs for the workspace packages.
 * Contributors run `pnpm change`; once main passes CI, its release job publishes the versions and pushes them to main.
 *
 * @type {import("beachball").BeachballConfig}
 */
const config = {
  branch: "origin/main",
  access: "public",
  groups: [
    // The buildkit CLI and its catalog release together, so a new app pins the CLI at the catalog's own version.
    {
      name: "buildkit-cli",
      include: ["packages/tooling/catalog", "packages/tooling/cli"],
      disallowedChangeTypes: null
    }
  ],
  hooks: {
    // The scaffolder records its own version in every project's lock, so its source copy follows each bump. The
    // constant is widened to string so its public API report doesn't change with each release.
    postbump(packagePath, name, version) {
      if (name === "@buildkitgg/scaffolder") {
        const comment = "/** The engine's version, recorded in every lock. A test keeps it equal to package.json. */"

        const safety =
          "// SAFETY: widening a string literal to string always holds, and keeps each release's number out of the public type."

        writeFileSync(
          join(packagePath, "src/version.ts"),
          `${comment}\n${safety}\nexport const engineVersion = ${JSON.stringify(version)} as string\n`
        )
      }
    }
  },
  ignorePatterns: [
    "**/*.test.{ts,tsx}",
    "**/*.stories.tsx",
    "**/.storybook/**",
    "**/tests/**",
    "**/*.md",
    "**/tsconfig*.json",
    "**/.oxlintrc.json"
  ]
}

export default config

// Beachball loads its config with `require`, which returns this export rather than the frozen module namespace.
export { config as "module.exports" }
