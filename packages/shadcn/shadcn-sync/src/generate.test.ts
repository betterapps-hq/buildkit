import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vite-plus/test"
import { compileSources, isCurrent, writeEntryPoints, writePackageFiles } from "./generate.js"
import type { ComponentModule, SharedModule } from "./sources.js"

const components: ComponentModule[] = [
  {
    name: "button",
    path: "ui/button.tsx",
    values: ["Button", "buttonVariants"],
    types: [],
    modules: ["ui/button.tsx"]
  },
  { name: "sonner", path: "ui/sonner.tsx", values: ["Toaster"], types: [], modules: ["ui/sonner.tsx"] }
]

const shared: SharedModule[] = [
  { path: "hooks/use-mobile.ts", values: ["useIsMobile"], types: [] },
  { path: "lib/highlighter.tsx", values: ["highlightCode", "loadHighlighter"], types: [] },
  { path: "lib/utils.ts", values: ["cn", "setCn"], types: [] }
]

const identity = {
  generatorVersion: "0.0.0",
  settings: {
    base: "base",
    icons: "lucide",
    style: "nova",
    theme: "neutral",
    css: "compiled" as const,
    direction: "ltr" as const
  },
  snapshot: "sha256-snapshot",
  fingerprint: "sha256-fingerprint",
  packages: ["cmdk", "react"]
}

function temporary() {
  return mkdtempSync(join(tmpdir(), "shadcn-sync-generate-"))
}

describe("writeEntryPoints", () => {
  it("re-exports the components, hooks and lib modules from the root barrel", () => {
    const root = temporary()

    writeEntryPoints(root, components, shared)

    expect(readFileSync(join(root, "index.ts"), "utf8")).toBe(
      [
        'export { Button, buttonVariants } from "./components/button/index.js"',
        'export { Toaster as SonnerToaster } from "./components/sonner/index.js"',
        'export { useIsMobile } from "./hooks/use-mobile.js"',
        'export { highlightCode, loadHighlighter } from "./lib/highlighter.js"',
        'export { cn, setCn } from "./lib/utils.js"',
        ""
      ].join("\n")
    )
  })

  it("fails when a hook or lib module exports a component's name", () => {
    const clash: SharedModule = { path: "hooks/use-button.ts", values: ["Button"], types: [] }

    expect(() => writeEntryPoints(temporary(), components, [clash])).toThrow(
      "button and hooks/use-button both export Button."
    )
  })
})

describe("compileSources", () => {
  it("keeps the stylesheet imports in the JavaScript and leaves them out of the declarations", async () => {
    const root = temporary()
    const sourceRoot = join(root, "src")

    mkdirSync(join(sourceRoot, "ui"), { recursive: true })
    writeFileSync(
      join(sourceRoot, "ui/box.ts"),
      '"use client"\nimport "../shared.css"\nimport "./box.css"\nexport const box = 1\n'
    )

    await compileSources(sourceRoot, join(root, "out"))

    const javascript = readFileSync(join(root, "out/ui/box.js"), "utf8")
    const declaration = readFileSync(join(root, "out/ui/box.d.ts"), "utf8")

    expect(javascript).toContain('import "../shared.css";')
    expect(javascript).toContain('import "./box.css";')
    expect(declaration).not.toContain(".css")
    expect(declaration).toContain("export declare const box = 1;")
  })
})

describe("writePackageFiles", () => {
  it("gives each hooks and lib module a subpath at its own path", () => {
    const outDir = temporary()

    writePackageFiles(outDir, components, shared, { react: "^19.2.0" }, identity)

    const { exports } = JSON.parse(readFileSync(join(outDir, "package.json"), "utf8"))

    expect(Object.keys(exports)).toEqual([
      ".",
      "./button",
      "./sonner",
      "./hooks/use-mobile",
      "./lib/highlighter",
      "./lib/utils",
      "./shared.css",
      "./package.json"
    ])
    expect(exports["./lib/utils"]).toEqual({ types: "./lib/utils.d.ts", import: "./lib/utils.js" })
    expect(exports["./hooks/use-mobile"]).toEqual({
      types: "./hooks/use-mobile.d.ts",
      import: "./hooks/use-mobile.js"
    })
  })
})

describe("isCurrent", () => {
  function installed(directory: string, name: string) {
    mkdirSync(join(directory, "node_modules", name), { recursive: true })
    writeFileSync(join(directory, "node_modules", name, "package.json"), JSON.stringify({ name, version: "1.0.0" }))
  }

  it("rebuilds once the app installs its own copy of a package sync linked", () => {
    const app = temporary()
    const outDir = join(app, "node_modules/.buildkit/shadcn")

    writePackageFiles(outDir, components, shared, {}, identity)
    installed(outDir, "cmdk")

    expect(isCurrent(outDir, identity.fingerprint, app)).toBe(true)

    installed(app, "cmdk")

    expect(isCurrent(outDir, identity.fingerprint, app)).toBe(false)
  })

  it("rebuilds once the app drops a package it provided, so sync links its own copy", () => {
    const app = temporary()
    const outDir = join(app, "node_modules/.buildkit/shadcn")

    writePackageFiles(outDir, components, shared, {}, identity)
    installed(app, "cmdk")

    expect(isCurrent(outDir, identity.fingerprint, app)).toBe(true)

    rmSync(join(app, "node_modules/cmdk"), { recursive: true })

    expect(isCurrent(outDir, identity.fingerprint, app)).toBe(false)
  })
})
