import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vite-plus/test"
import antiSlop from "./anti-slop.ts"
import plugin from "./vendor/anti-slop/index.ts"

const fixture = fileURLToPath(new URL("../test/fixture/", import.meta.url))
const require = createRequire(import.meta.url)
const oxlint = resolve(dirname(require.resolve("oxlint/package.json")), "bin/oxlint")

// Under Vite+ (VP_VERSION is set), Oxlint reads the `lint` field of a vite.config.ts. Without it, Oxlint reads a plain
// oxlint.config.ts.
const plainEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => name !== "VP_VERSION"))
const vitePlusEnv = { ...process.env, VP_VERSION: process.env.VP_VERSION ?? "1" }

// Runs Oxlint the way an app does, with a config that extends the rule set.
function reportedRules(config: string) {
  const result = spawnSync(process.execPath, [oxlint, "-c", config, "--format", "json", "slop.ts"], {
    cwd: fixture,
    encoding: "utf8",
    env: config.startsWith("vite-plus") ? vitePlusEnv : plainEnv
  })
  const report = JSON.parse(result.stdout) as { diagnostics: { code: string }[] }
  return new Set(report.diagnostics.map((diagnostic) => diagnostic.code))
}

describe("anti-slop rule set", () => {
  it("turns on every vendored rule and oxc/no-accumulating-spread as errors", () => {
    const expected = ["oxc/no-accumulating-spread", ...Object.keys(plugin.rules).map((rule) => `anti-slop/${rule}`)]
    expect(Object.keys(antiSlop.rules ?? {}).sort()).toEqual(expected.sort())
    expect(new Set(Object.values(antiSlop.rules ?? {}))).toEqual(new Set(["error"]))
  })

  // The source config loads the TypeScript plugin. The built ones load the compiled plugin a published install uses,
  // from an oxlint.config.ts and from a Vite+ lint block.
  it.each(["src.config.ts", "dist.config.ts", "vite-plus.config.ts"])("reports slop through %s", (config) => {
    expect(reportedRules(config)).toEqual(
      new Set([
        "anti-slop(no-array-filter-map)",
        "anti-slop(no-runtime-typeof)",
        "anti-slop(no-unknown-parameters)",
        "oxc(no-accumulating-spread)"
      ])
    )
  })
})
