import * as icons from "@fluentui/react-icons"
import type { FluentIcon } from "@fluentui/react-icons"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vite-plus/test"
import registry from "../fixtures/registry-icons.json" with { type: "json" }
import fluent from "./index.js"

const used: Readonly<Record<string, readonly string[]>> = registry.icons

// Every unsized Regular export is a FluentIcon, and the mapping only uses those.
const regular: Readonly<Record<Extract<keyof typeof icons, `${string}Regular`>, FluentIcon>> = icons
const library: ReadonlyMap<string, FluentIcon> = new Map(Object.entries(regular))

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
  })

  it.each(Object.entries(fluent.icons))("replaces %s with an existing Fluent icon", (_, replacement) => {
    const Icon = library.get(replacement.name)

    expect(Icon, `${replacement.name} isn't a Regular icon exported by @fluentui/react-icons`).toBeDefined()

    if (!Icon) {
      return
    }

    const markup = renderToStaticMarkup(createElement(Icon, { className: "size-4" }))

    expect(markup).toMatch(/^<svg\b/)
    // Size classes from the components must reach the svg; Fluent adds its own classes beside them.
    expect(markup).toMatch(/^<svg[^>]*\bclass="[^"]*\bsize-4\b/)
  })
})
