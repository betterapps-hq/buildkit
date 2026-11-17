import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vite-plus/test"
import { canonicalJson } from "./json.js"
import { defaultSettings, isBuiltInIcons, parseSettings, registryStyle } from "./options.js"
import { findSyncScript, scriptFlags, withSettings, writeScript } from "./scripts.js"

describe("parseSettings", () => {
  it("fills in the defaults", () => {
    expect(parseSettings({})).toEqual(defaultSettings)
  })

  it("keeps the given settings and the base for the rest", () => {
    expect(parseSettings({ style: "vega" }, { ...defaultSettings, icons: "phosphor" })).toEqual({
      ...defaultSettings,
      style: "vega",
      icons: "phosphor"
    })
  })

  it.each([
    [{ base: "mui" }, "--base mui isn't valid. Use radix, base, or aria."],
    [{ style: "nope" }, "--style nope isn't valid. Use nova,"],
    [{ theme: "slate" }, "--theme slate isn't valid. Use neutral, stone,"],
    [{ icons: "../icons" }, "--icons ../icons isn't an icon library id or a package name."],
    [{ direction: "auto" }, "--direction auto isn't valid. Use ltr or rtl."]
  ])("rejects %o", (flags, message) => {
    expect(() => parseSettings(flags)).toThrow(message)
  })

  it("names the registry style for each base", () => {
    expect(registryStyle(defaultSettings)).toBe("base-nova")
    expect(registryStyle({ ...defaultSettings, base: "radix", style: "vega" })).toBe("radix-vega")
  })

  it("tells built-in icon libraries from adapters", () => {
    expect(isBuiltInIcons("lucide")).toBe(true)
    expect(isBuiltInIcons("@buildkitgg/shadcn-icons-fluent")).toBe(false)
  })
})

describe("canonicalJson", () => {
  it("sorts keys at every level", () => {
    expect(canonicalJson({ b: [{ d: 1, c: 2 }], a: null })).toBe('{"a":null,"b":[{"c":2,"d":1}]}')
  })
})

describe("sync scripts", () => {
  const command = "shadcn-sync sync --base base --icons=lucide --style nova && echo done"

  it("reads the flags from the sync call only", () => {
    expect(scriptFlags(command)).toEqual({ base: "base", icons: "lucide", style: "nova" })
  })

  it("replaces flags in place and adds missing ones that aren't defaults", () => {
    const next = withSettings(command, { ...defaultSettings, icons: "phosphor", theme: "zinc" })

    expect(next).toBe("shadcn-sync sync --base base --icons=phosphor --style nova --theme zinc && echo done")
  })

  it("reads, sets and takes back right to left", () => {
    const rtl = withSettings(command, { ...defaultSettings, direction: "rtl" })

    expect(rtl).toBe("shadcn-sync sync --base base --icons=lucide --style nova --direction rtl && echo done")
    expect(scriptFlags(rtl).direction).toBe("rtl")
    expect(withSettings(rtl, defaultSettings)).toBe(
      "shadcn-sync sync --base base --icons=lucide --style nova --direction ltr && echo done"
    )
  })

  it("prefers the postinstall, then any script that runs sync", () => {
    const app = mkdtempSync(join(tmpdir(), "shadcn-sync-scripts-"))

    writeFileSync(
      join(app, "package.json"),
      JSON.stringify({ scripts: { build: "vite build", sync: "shadcn-sync sync --style vega" } }, null, 4)
    )

    expect(findSyncScript(app)).toEqual({ name: "sync", command: "shadcn-sync sync --style vega" })

    writeScript(app, "sync", "shadcn-sync sync --style luma")

    const text = readFileSync(join(app, "package.json"), "utf8")

    expect(text).toContain('    "scripts": {')
    expect(text.endsWith("\n")).toBe(false)
    expect(findSyncScript(app).command).toBe("shadcn-sync sync --style luma")

    writeFileSync(join(app, "package.json"), JSON.stringify({ scripts: { build: "vite build" } }))

    expect(() => findSyncScript(app)).toThrow("no script that runs shadcn-sync sync")
  })
})
