import { extname } from "node:path"
import { fileURLToPath } from "node:url"
import type { OxlintConfig } from "oxlint"
import plugin from "./vendor/anti-slop/index.ts"

// The plugin has this module's extension: compiled JavaScript when published, TypeScript source inside this repository.
const extension = extname(fileURLToPath(import.meta.url))

/**
 * The anti-slop rule set: every generic rule of the vendored anti-slop Oxlint plugin, plus `oxc/no-accumulating-spread`,
 * as errors. Extend it from a Vite+ `lint` block or from `oxlint.config.ts`.
 */
const antiSlop: OxlintConfig = {
  jsPlugins: [
    {
      name: "anti-slop",
      specifier: fileURLToPath(new URL(`./vendor/anti-slop/index${extension}`, import.meta.url))
    }
  ],
  rules: {
    "oxc/no-accumulating-spread": "error",
    ...Object.fromEntries(Object.keys(plugin.rules).map((rule) => [`anti-slop/${rule}`, "error"]))
  }
}

export default antiSlop
