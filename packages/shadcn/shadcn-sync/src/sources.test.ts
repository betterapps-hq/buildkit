import { Project } from "ts-morph"
import { describe, expect, it } from "vite-plus/test"
import { importStyles, type PreparedSources } from "./sources.js"

describe("importStyles", () => {
  it("imports a stylesheet into each component and each hooks or lib module whose classes compile to rules", () => {
    const project = new Project({ useInMemoryFileSystem: true })

    project.createSourceFile("/src/ui/dialog.tsx", '"use client"\nexport const Dialog = 1')
    project.createSourceFile("/src/lib/highlighter.tsx", "export const highlightCode = 1")
    project.createSourceFile("/src/hooks/use-mobile.ts", "export const useIsMobile = 1")

    const prepared: PreparedSources = {
      project,
      components: [{ name: "dialog", path: "ui/dialog.tsx", values: ["Dialog"], types: [], modules: [] }],
      shared: [
        { path: "hooks/use-mobile.ts", values: ["useIsMobile"], types: [] },
        { path: "lib/highlighter.tsx", values: ["highlightCode"], types: [] }
      ],
      packages: [],
      candidates: new Map()
    }

    importStyles(prepared, "/src", new Set(["lib/highlighter.tsx"]))

    expect(project.getSourceFileOrThrow("/src/ui/dialog.tsx").getFullText()).toMatch(
      /^"use client"\n+import "..\/shared.css";\nimport "..\/components\/dialog\/styles.css";/
    )
    expect(project.getSourceFileOrThrow("/src/lib/highlighter.tsx").getFullText()).toMatch(
      /^import "..\/shared.css";\nimport ".\/highlighter.css";/
    )
    expect(project.getSourceFileOrThrow("/src/hooks/use-mobile.ts").getFullText()).not.toContain(".css")
  })
})
