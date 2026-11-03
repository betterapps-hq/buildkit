import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vite-plus/test"

const require = createRequire(import.meta.url)
const oxlint = resolve(dirname(require.resolve("oxlint/package.json")), "bin/oxlint")

describe("base rules", () => {
  // A config compiled to CommonJS loads these packages with `require`, which must return their configs and plugin
  // rather than module namespaces, or the anti-slop rules silently don't run.
  it("run the anti-slop rules from a config compiled to CommonJS", () => {
    const result = spawnSync(process.execPath, [oxlint, "-c", "vite.config.ts", "--format", "json", "slop.ts"], {
      cwd: fileURLToPath(new URL("../test/fixture/commonjs/", import.meta.url)),
      encoding: "utf8",
      env: { ...process.env, VP_VERSION: process.env.VP_VERSION ?? "1" }
    })

    // SAFETY: Oxlint's JSON format reports each diagnostic with the rule's code.
    const report = JSON.parse(result.stdout) as { diagnostics: { code: string }[] }

    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toContain("anti-slop(no-array-filter-map)")
  })
})
