import { createRequire } from "node:module"
import type { FluentIcon } from "@fluentui/react-icons"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vite-plus/test"
import registry from "../fixtures/registry-icons.json" with { type: "json" }
import fluent from "./index.js"

const used: Readonly<Record<string, readonly string[]>> = registry.icons
const require = createRequire(import.meta.url)

async function loadIcon(module: string, name: string): Promise<FluentIcon | undefined> {
  // Each headless module exports FluentIcon components only.
  const exports: Readonly<Record<string, FluentIcon>> = await import(module)

  return exports[name]
}

describe("Fluent icon adapter", () => {
  it("maps every Lucide icon the registry's components use", () => {
    const missing = Object.keys(used)
      .filter((icon) => !Object.hasOwn(fluent.icons, icon))
      .map((icon) => `${icon} (used in ${used[icon]?.join(", ")})`)

    expect(missing, "Lucide icons without a Fluent replacement").toEqual([])
  })

  it("maps no icon the registry doesn't use", () => {
    const unused = Object.keys(fluent.icons).filter((icon) => !Object.hasOwn(used, icon))

    expect(unused, "Mappings for icons the registry no longer uses").toEqual([])
  })

  it("imports from the package it declares as a peer", () => {
    expect(fluent.package).toBe("@fluentui/react-icons")

    const outside = Object.values(fluent.icons).filter(
      (replacement) => !replacement.module.startsWith(`${fluent.package}/headless/svg/`)
    )

    expect(outside, "Replacements outside Fluent's headless icons").toEqual([])
  })

  it("names a stylesheet the package exports", () => {
    expect(require.resolve(fluent.styles)).toMatch(/styles\.css$/)
  })

  it.each(Object.entries(fluent.icons))("replaces %s with an existing Fluent icon", async (_, replacement) => {
    const Icon = await loadIcon(replacement.module, replacement.name)

    expect(Icon, `${replacement.module} doesn't export ${replacement.name}`).toBeDefined()

    if (!Icon) {
      return
    }

    const markup = renderToStaticMarkup(createElement(Icon, { className: "size-4" }))

    // The headless stylesheet targets data-fui-icon, and size classes from the components must reach the svg.
    expect(markup).toMatch(/^<svg\b[^>]*\bdata-fui-icon\b/)
    expect(markup).toMatch(/^<svg[^>]*\bclass="[^"]*\bsize-4\b/)
  })
})
