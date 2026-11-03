import { defineConfig } from "oxlint"

// The plugin on its own, by package name, with rules chosen one at a time.
export default defineConfig({
  jsPlugins: [{ name: "anti-slop", specifier: "@buildkitgg/oxlint-plugin-anti-slop" }],
  rules: { "anti-slop/no-array-filter-map": "error", "anti-slop/no-runtime-typeof": "error" }
})
