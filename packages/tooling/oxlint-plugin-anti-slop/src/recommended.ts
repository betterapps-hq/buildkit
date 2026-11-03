import { extname } from "node:path"
import { fileURLToPath } from "node:url"
import type { OxlintConfig } from "oxlint"
import plugin from "./index.ts"

// The plugin has this module's extension: compiled JavaScript when published, TypeScript source inside this repository.
const extension = extname(fileURLToPath(import.meta.url))

/**
 * The recommended rule set: the plugin, every one of its rules and `oxc/no-accumulating-spread`, all as errors. Extend
 * it from a Vite+ `lint` block or from `oxlint.config.ts`.
 */
const antiSlop: OxlintConfig = {
  jsPlugins: [
    {
      name: "anti-slop",
      specifier: fileURLToPath(new URL(`./index${extension}`, import.meta.url))
    }
  ],
  rules: {
    "oxc/no-accumulating-spread": "error",
    ...Object.fromEntries(Object.keys(plugin.rules).map((rule) => [`anti-slop/${rule}`, "error"]))
  }
}

export default antiSlop
