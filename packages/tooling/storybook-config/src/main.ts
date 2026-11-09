import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { defineMain as defineStorybookMain, type StorybookConfig } from "@storybook/react-vite/node"
import { deepMerge } from "./utils/merge.js"

/**
 * The folder of a package this one depends on. Storybook resolves addon and framework names from the app's folder,
 * where pnpm doesn't put this package's dependencies, so the base names them by path.
 */
export function packageFolder(name: string): string {
  return dirname(fileURLToPath(import.meta.resolve(`${name}/package.json`)))
}

/**
 * Shared Storybook base configuration for the monorepo. Consumers should not
 * redefine these — `defineMain` merges an app's config on top of the base.
 */
export const baseConfig: Omit<StorybookConfig, "stories"> = {
  framework: {
    name: packageFolder("@storybook/react-vite"),
    options: {}
  },
  addons: [packageFolder("@storybook/addon-a11y"), packageFolder("@storybook/addon-vitest")],
  core: {
    disableTelemetry: true
  }
}

/** An app's Storybook config, which needs no framework because the base sets one. */
export type MainOverrides = Omit<StorybookConfig, "framework"> & Partial<Pick<StorybookConfig, "framework">>

/**
 * Builds a Storybook `main` config by combining the shared base with an app's
 * overrides (addons concatenated, objects merged deeply), then running it
 * through Storybook's own `defineMain` so the framework is wired correctly.
 *
 * ```ts
 * import { defineMain } from "@buildkitgg/storybook-config/main";
 *
 * export default defineMain({
 *   stories: ["../src/**\/*.stories.@(ts|tsx)"]
 * });
 * ```
 */
export function defineMain(overrides: MainOverrides): StorybookConfig {
  return defineStorybookMain(deepMerge(baseConfig, overrides))
}
