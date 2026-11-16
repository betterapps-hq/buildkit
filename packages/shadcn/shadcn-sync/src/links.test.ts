import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vite-plus/test"
import { linkAll, linkMissing, packageTargets } from "./links.js"
import { findPackage } from "./resolve.js"

describe("linkMissing", () => {
  it("links sync's own copy of what the app can't resolve, and leaves the app's own packages to the app", () => {
    // A temp folder outside the workspace resolves nothing, as an app with pnpm's isolated layout can't see sync's
    // dependencies.
    const app = mkdtempSync(join(tmpdir(), "shadcn-sync-links-"))
    const output = join(app, "node_modules/.buildkit/shadcn")

    mkdirSync(join(app, "node_modules/cn"), { recursive: true })
    writeFileSync(join(app, "node_modules/cn/package.json"), '{ "name": "cn", "version": "0.0.0" }')

    const targets = packageTargets(["cn", "@base-ui/react", "react", "not-a-dependency-of-sync"], app)
    const linked = linkMissing(output, targets, app)

    expect(linked).toEqual(["@base-ui/react"])
    expect(realpathSync(join(output, "node_modules/@base-ui/react"))).toBe(
      realpathSync(findPackage("@base-ui/react", import.meta.dirname) ?? "")
    )
    expect(findPackage("cn", output)).toBe(join(app, "node_modules/cn"))
  })
})

describe("linkAll", () => {
  it("links the app's copy when it has one and sync's otherwise, into a folder outside the app", () => {
    const app = mkdtempSync(join(tmpdir(), "shadcn-sync-links-"))
    const work = mkdtempSync(join(tmpdir(), "shadcn-sync-work-"))

    mkdirSync(join(app, "node_modules/cn"), { recursive: true })
    writeFileSync(join(app, "node_modules/cn/package.json"), '{ "name": "cn", "version": "0.0.0" }')
    linkAll(work, packageTargets(["cn", "@base-ui/react", "react"], app, true))

    expect(realpathSync(join(work, "node_modules/cn"))).toBe(realpathSync(join(app, "node_modules/cn")))
    expect(realpathSync(join(work, "node_modules/@base-ui/react"))).toBe(
      realpathSync(findPackage("@base-ui/react", import.meta.dirname) ?? "")
    )
    expect(findPackage("react", work)).toBeUndefined()
    // Base UI's own dependencies come from beside it, so its declarations can name their types.
    expect(realpathSync(join(work, "node_modules/@base-ui/utils"))).toBe(
      realpathSync(findPackage("@base-ui/utils", realpathSync(join(work, "node_modules/@base-ui/react"))) ?? "")
    )
  })

  it("links into a folder reached through a link to a deeper folder, as macOS's temp folder is", () => {
    const real = join(mkdtempSync(join(tmpdir(), "shadcn-sync-real-")), "nested")
    const alias = join(mkdtempSync(join(tmpdir(), "shadcn-sync-alias-")), "work")

    mkdirSync(real)
    symlinkSync(real, alias, "junction")
    linkAll(alias, packageTargets(["@base-ui/react"], alias))

    expect(findPackage("@base-ui/react", alias)).toBe(join(alias, "node_modules/@base-ui/react"))
  })
})
