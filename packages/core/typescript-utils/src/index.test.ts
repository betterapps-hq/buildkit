import { describe, expect, it } from "vite-plus/test"
import { exclusions, upstreams } from "../curation.ts"
import * as utils from "./index.ts"

const exported: Record<string, unknown> = { ...utils }

function isExcluded(from: string, name: string) {
  return exclusions.some((exclusion) => exclusion.from === from && exclusion.name === name)
}

describe("@buildkitgg/typescript-utils", () => {
  it.each(upstreams.filter((upstream) => !upstream.typesOnly))(
    "re-exports every runtime export of $name that is not excluded",
    async (upstream) => {
      const module: Record<string, unknown> = await import(upstream.name)
      const included = Object.entries(module)
        .filter(([name]) => !isExcluded(upstream.name, name))
        .map(([name, value]) => [upstream.rename?.[name] ?? name, value] as const)
      const reexported = included.map(([name]) => [name, exported[name]] as const)
      expect(Object.fromEntries(reexported)).toStrictEqual(Object.fromEntries(included))
    }
  )

  it("exports invariant from tiny-invariant", async () => {
    const tinyInvariant = await import("tiny-invariant")
    expect(utils.invariant).toBe(tinyInvariant.default)
  })

  it("leaves out excluded exports that nothing else provides", () => {
    expect(exported.assert).toBeUndefined()
    expect(exported.Pattern).toBeUndefined()
  })
})
