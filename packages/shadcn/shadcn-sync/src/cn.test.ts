import { Project } from "ts-morph"
import { describe, expect, it } from "vite-plus/test"
import { cnSource, swapCnImports } from "./cn.js"

function workspace(files: Record<string, string>) {
  const project = new Project({ useInMemoryFileSystem: true })

  for (const [path, text] of Object.entries(files)) {
    project.createSourceFile(`/src/${path}`, text)
  }

  return project
}

describe("swapCnImports", () => {
  it("points every cn import at lib/utils and makes it swappable", () => {
    const project = workspace({
      "lib/utils.ts": 'export { cn } from "cn"',
      "ui/button.tsx": 'import { cn } from "cn"\nexport const Button = () => <button className={cn("px-2")} />',
      "ui/badge.tsx": 'import { cn as merge } from "cn"\nexport const badge = merge("px-1")',
      "hooks/use-classes.ts": 'export { cn } from "cn"',
      "ui/chart.tsx": 'import { createCn } from "cn/config"\nexport const local = createCn()'
    })

    swapCnImports(project, "/src")

    expect(project.getSourceFileOrThrow("/src/lib/utils.ts").getFullText()).toBe(cnSource)
    expect(project.getSourceFileOrThrow("/src/ui/button.tsx").getFullText()).toContain(
      'import { cn } from "../lib/utils"'
    )
    expect(project.getSourceFileOrThrow("/src/ui/badge.tsx").getFullText()).toContain(
      'import { cn as merge } from "../lib/utils"'
    )
    expect(project.getSourceFileOrThrow("/src/hooks/use-classes.ts").getFullText()).toContain(
      'export { cn } from "../lib/utils"'
    )
    expect(project.getSourceFileOrThrow("/src/ui/chart.tsx").getFullText()).toContain('from "cn/config"')
  })

  it("writes lib/utils when the catalog has none", () => {
    const project = workspace({ "ui/button.tsx": 'import { cn } from "cn"\nexport const a = cn()' })

    swapCnImports(project, "/src")

    expect(project.getSourceFileOrThrow("/src/lib/utils.ts").getFullText()).toContain("export function setCn")
  })

  it("refuses an import of something other than cn, which lib/utils doesn't export", () => {
    const project = workspace({ "ui/button.tsx": 'import { cn, twMerge } from "cn"\nexport { cn, twMerge }' })

    expect(() => swapCnImports(project, "/src")).toThrow('ui/button.tsx imports more than cn from "cn"')
  })
})
