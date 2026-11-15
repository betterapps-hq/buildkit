import { Project } from "ts-morph"
import { describe, expect, it } from "vite-plus/test"
import type { ShadcnIconAdapter } from "./adapter.js"
import { applyAdapter } from "./icons.js"

const adapter: ShadcnIconAdapter = {
  package: "@acme/icons",
  icons: {
    XIcon: { name: "Close", module: "@acme/icons/close" },
    CheckIcon: { name: "Tick", module: "@acme/icons/tick", props: { strokeWidth: 2, "aria-hidden": true, size: "1em" } }
  }
}

function source(text: string) {
  return new Project({ useInMemoryFileSystem: true }).createSourceFile("dialog.tsx", text)
}

describe("applyAdapter", () => {
  it("imports each icon from its own module under the local name and passes the adapter's props", () => {
    const file = source(
      [
        '"use client"',
        'import { XIcon, CheckIcon as Done } from "lucide-react"',
        'export const A = () => <XIcon className="size-4" />',
        'export const B = () => <Done size="2em" />'
      ].join("\n")
    )

    expect(applyAdapter(file, adapter, "dialog")).toEqual([])
    expect(file.getFullText()).toContain('import { Close as XIcon } from "@acme/icons/close"')
    expect(file.getFullText()).toContain('import { Tick as Done } from "@acme/icons/tick"')
    expect(file.getFullText()).toContain('<Done size="2em" strokeWidth={2} aria-hidden={true} />')
    expect(file.getFullText()).not.toContain("lucide-react")
  })

  it("reports unmapped icons with their component and leaves the import alone", () => {
    const file = source('import { XIcon, ArrowUpRightIcon } from "lucide-react"\nexport { XIcon, ArrowUpRightIcon }')

    expect(applyAdapter(file, adapter, "sidebar")).toEqual([{ icon: "ArrowUpRightIcon", component: "sidebar" }])
    expect(file.getFullText()).toContain('from "lucide-react"')
  })

  it("refuses props for an icon that isn't rendered as JSX", () => {
    const file = source('import { CheckIcon } from "lucide-react"\nexport const icon = CheckIcon')

    expect(() => applyAdapter(file, adapter, "menu")).toThrow("isn't rendered as JSX")
  })

  it("reports namespace imports, which it can't map", () => {
    const file = source('import * as icons from "lucide-react"\nexport { icons }')

    expect(applyAdapter(file, adapter, "menu")).toEqual([
      { icon: 'import * as icons from "lucide-react"', component: "menu" }
    ])
  })
})
