import { describe, expect, it } from "vite-plus/test"
import { dependencySpecifier } from "./register.js"

describe("dependencySpecifier", () => {
  it.each([
    ["pnpm", "link:node_modules/.buildkit/shadcn"],
    ["yarn", "link:node_modules/.buildkit/shadcn"],
    ["npm", "file:node_modules/.buildkit/shadcn"]
  ] as const)("links the output with %s", (manager, specifier) => {
    expect(dependencySpecifier(manager)).toBe(specifier)
  })

  it("writes no entry for Bun, which refuses a local folder that doesn't exist yet", () => {
    expect(dependencySpecifier("bun")).toBeUndefined()
  })
})
