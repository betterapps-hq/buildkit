import { describe, expect, it } from "vite-plus/test"
import { exclusions, upstreams } from "../curation.ts"
import * as utils from "./index.ts"

const exported = new Map<string, unknown>(Object.entries(utils))

function isExcluded(from: string, name: string) {
  return exclusions.some((exclusion) => exclusion.from === from && exclusion.name === name)
}

describe("@buildkitgg/typescript-utils", () => {
  it.each(upstreams.filter((upstream) => !upstream.typesOnly))(
    "re-exports every runtime export of $name that is not excluded",
    async (upstream) => {
      const included = Object.entries(await import(upstream.name))
        .filter(([name]) => !isExcluded(upstream.name, name))
        .map(([name, value]) => [upstream.rename?.[name] ?? name, value] as const)

      const reexported = included.map(([name]) => [name, exported.get(name)] as const)
      expect(Object.fromEntries(reexported)).toStrictEqual(Object.fromEntries(included))
    }
  )

  it("exports invariant from tiny-invariant", async () => {
    const tinyInvariant = await import("tiny-invariant")
    expect(utils.invariant).toBe(tinyInvariant.default)
  })

  it("leaves out excluded exports that nothing else provides", () => {
    expect(exported.get("assert")).toBeUndefined()
    expect(exported.get("Pattern")).toBeUndefined()
  })
})
