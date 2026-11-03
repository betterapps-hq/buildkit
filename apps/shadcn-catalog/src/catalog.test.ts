import * as root from "@buildkitgg/shadcn-baseui-kit"
import { describe, expect, it } from "vite-plus/test"
import upstream from "../../../packages/shadcn/shadcn-baseui-nova/upstream.json"

describe("component catalog contract", () => {
  it("exports every public symbol from every catalog module", () => {
    const exported = new Map<string, unknown>(Object.entries(root))

    const modules = import.meta.glob<object>("../../../packages/shadcn/shadcn-baseui-nova/dist/ui/*.js", {
      eager: true
    })

    const files = Object.keys(modules)
    expect(files).toHaveLength(upstream.components.length)

    for (const file of files) {
      const component = modules[file]!

      for (const [name, value] of Object.entries(component)) {
        const publicName = file.endsWith("/sonner.js") && name === "Toaster" ? "SonnerToaster" : name
        expect(exported.get(publicName), `${file}: ${name}`).toBe(value)
      }
    }
  })
})
