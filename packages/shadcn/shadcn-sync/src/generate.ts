import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join, relative, sep } from "node:path"
import * as z from "zod"
import { SyncError } from "./errors.js"
import { readJson, type Json } from "./json.js"
import type { SyncSettings } from "./options.js"
import { findPackage, readManifest } from "./resolve.js"
import type { ComponentModule, SharedModule } from "./sources.js"
import { run } from "./spawn.js"

const require = createRequire(import.meta.url)
const typescriptManifest = require.resolve("typescript/package.json")

const syncManifest = readJson(
  require.resolve("../package.json"),
  z.object({ version: z.string(), dependencies: z.record(z.string(), z.string()) })
)

/** This package's version, which goes into the generated manifest and the fingerprint. */
export const syncVersion = syncManifest.version

/** The packages sync depends on, which it links into its build folders when the app can't resolve them. */
export const syncDependencies = Object.keys(syncManifest.dependencies)

export const typescriptVersion = readJson(typescriptManifest, z.object({ version: z.string() })).version

/** The generated package's name. It never exists on npm, so the import path stays the same whatever the settings. */
export const generatedName = "@buildkitgg/shadcn"

/** Root export names that would collide, renamed the way the published style packages renamed them. */
const renames = new Map([["sonner", new Map([["Toaster", "SonnerToaster"]])]])

function write(path: string, content: string) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

function writeJsonFile(path: string, value: Json) {
  write(path, JSON.stringify(value, null, 2) + "\n")
}

function exportList(names: readonly string[], rename: ReadonlyMap<string, string> = new Map()) {
  return names.map((name) => (rename.has(name) ? `${name} as ${rename.get(name)}` : name)).join(", ")
}

/** A `hooks/` or `lib/` module's subpath, which is its path without the extension, such as `lib/utils`. */
function sharedSubpath(module: SharedModule) {
  return module.path.replace(/\.tsx?$/, "")
}

/**
 * Writes each component's entry point, which re-exports the upstream module directly, and the root barrel, which also
 * re-exports the `hooks/` and `lib/` modules. Fails on an export name collision instead of dropping a name.
 */
export function writeEntryPoints(
  root: string,
  components: readonly ComponentModule[],
  shared: readonly SharedModule[]
) {
  const owners = new Map<string, string>()
  const barrel: string[] = []

  for (const component of components) {
    const module = `../../${component.path.replace(/\.tsx?$/, ".js")}`

    const lines = [
      component.values.length > 0 ? `export { ${exportList(component.values)} } from "${module}"` : "",
      component.types.length > 0 ? `export type { ${exportList(component.types)} } from "${module}"` : ""
    ].filter(Boolean)

    write(join(root, "components", component.name, "index.ts"), `${lines.join("\n")}\n`)

    const rename = renames.get(component.name) ?? new Map<string, string>()

    for (const name of [...component.values, ...component.types]) {
      const exported = rename.get(name) ?? name
      const owner = owners.get(exported)

      if (owner) {
        throw new SyncError("compilation", `${owner} and ${component.name} both export ${exported}.`, true)
      }

      owners.set(exported, component.name)
    }

    const entry = `./components/${component.name}/index.js`

    if (component.values.length > 0) {
      barrel.push(`export { ${exportList(component.values, rename)} } from "${entry}"`)
    }

    if (component.types.length > 0) {
      barrel.push(`export type { ${exportList(component.types, rename)} } from "${entry}"`)
    }
  }

  for (const module of shared) {
    const subpath = sharedSubpath(module)

    for (const name of [...module.values, ...module.types]) {
      const owner = owners.get(name)

      if (owner) {
        throw new SyncError("compilation", `${owner} and ${subpath} both export ${name}.`, true)
      }

      owners.set(name, subpath)
    }

    if (module.values.length > 0) {
      barrel.push(`export { ${exportList(module.values)} } from "./${subpath}.js"`)
    }

    if (module.types.length > 0) {
      barrel.push(`export type { ${exportList(module.types)} } from "./${subpath}.js"`)
    }
  }

  write(join(root, "index.ts"), `${barrel.join("\n")}\n`)
}

/** Compiles the sources to ES modules and declarations in one TypeScript pass, keeping `"use client"`. */
export async function compileSources(sourceRoot: string, outDir: string) {
  const config = join(dirname(sourceRoot), "tsconfig.build.json")

  writeJsonFile(config, {
    compilerOptions: {
      target: "ES2022",
      lib: ["ES2022", "DOM", "DOM.Iterable"],
      module: "ESNext",
      moduleResolution: "Bundler",
      jsx: "react-jsx",
      strict: true,
      skipLibCheck: true,
      declaration: true,
      noEmitOnError: true,
      noUncheckedSideEffectImports: false,
      isolatedModules: true,
      rootDir: relative(dirname(config), sourceRoot).split(sep).join("/"),
      outDir: relative(dirname(config), outDir).split(sep).join("/"),
      types: []
    },
    include: [`${relative(dirname(config), sourceRoot).split(sep).join("/")}/**/*`],
    exclude: [`${relative(dirname(config), sourceRoot).split(sep).join("/")}/**/*.css`]
  })

  const tsc = join(dirname(typescriptManifest), "bin/tsc")

  const result = await run(process.execPath, [tsc, "-p", config, "--pretty", "false"], { cwd: dirname(config) })

  if (result.status !== 0) {
    throw new SyncError(
      "compilation",
      `The components don't type-check:\n${result.output.trim().split("\n").slice(0, 20).join("\n")}`,
      true
    )
  }
}

/** The generated files, without the dependency links in `node_modules`. */
function listFiles(directory: string, base = directory): string[] {
  return readdirSync(directory).flatMap((name) => {
    if (name === "node_modules") {
      return []
    }

    const path = join(directory, name)

    return statSync(path).isDirectory() ? listFiles(path, base) : [relative(base, path).split(sep).join("/")]
  })
}

export function hashFile(path: string) {
  return `sha256-${createHash("sha256").update(readFileSync(path)).digest("base64")}`
}

export function hashFiles(directory: string): Record<string, string> {
  return Object.fromEntries(
    listFiles(directory)
      .filter((file) => file !== "manifest.json")
      .toSorted()
      .map((file) => [file, hashFile(join(directory, file))])
  )
}

/** The peer range for each package the generated code imports: sync's own range, else the app's installed version. */
export function peerRanges(packages: readonly string[], appDirectory: string): Record<string, string> {
  const ranges = new Map([
    ["react", "^19.2.0"],
    ["react-dom", "^19.2.0"]
  ])

  for (const name of packages) {
    if (ranges.has(name)) {
      continue
    }

    const own = syncManifest.dependencies[name]

    if (own) {
      ranges.set(name, own)
      continue
    }

    const installed = findPackage(name, appDirectory)
    const version = installed ? readManifest(installed).version : undefined

    if (!version) {
      throw new SyncError(
        "dependency",
        `${name} isn't installed. Add it to this app's dependencies, then install again.`,
        true,
        [name]
      )
    }

    ranges.set(name, `^${version}`)
  }

  return Object.fromEntries([...ranges].toSorted(([a], [b]) => (a < b ? -1 : 1)))
}

/** Fails with the package to add when the generated code imports something the app can't resolve. */
export function checkDependencies(packages: readonly string[], from: string) {
  const missing = packages.filter((name) => !findPackage(name, from))

  if (missing.length > 0) {
    throw new SyncError(
      "dependency",
      `${missing.join(", ")} ${missing.length === 1 ? "isn't" : "aren't"} installed. Add ${missing.length === 1 ? "it" : "them"} to this app's dependencies, then install again.`,
      true,
      missing
    )
  }
}

/** The generated package's identity, written to `manifest.json`. */
export interface GeneratedManifest {
  readonly generatorVersion: string
  readonly settings: SyncSettings
  readonly snapshot: string
  readonly fingerprint: string
  readonly files: Readonly<Record<string, string>>
}

const generatedManifestSchema = z.object({
  generatorVersion: z.string(),
  settings: z.object({
    base: z.string(),
    icons: z.string(),
    style: z.string(),
    theme: z.string(),
    css: z.enum(["compiled", "tailwind"])
  }),
  snapshot: z.string(),
  fingerprint: z.string(),
  files: z.record(z.string(), z.string())
})

/**
 * Whether every dependency link in the output still points at an installed package the app can't resolve itself. Once
 * the app installs its own copy of a linked package, the link has to go, so the components use the app's version.
 */
function linksResolve(outDir: string, appDirectory: string) {
  const modules = join(outDir, "node_modules")

  if (!existsSync(modules)) {
    return true
  }

  const entries = readdirSync(modules).flatMap((name) =>
    name.startsWith("@") ? readdirSync(join(modules, name)).map((scoped) => join(name, scoped)) : [name]
  )

  return entries.every(
    (entry) =>
      existsSync(join(modules, entry, "package.json")) && !findPackage(entry.split(sep).join("/"), appDirectory)
  )
}

/**
 * Whether the output matches the fingerprint, its dependency links are still the ones a build would make, and every
 * file in its manifest is present and unchanged.
 */
export function isCurrent(outDir: string, fingerprint: string, appDirectory: string): boolean {
  const manifestPath = join(outDir, "manifest.json")

  if (!existsSync(manifestPath)) {
    return false
  }

  const manifest = generatedManifestSchema.safeParse(JSON.parse(readFileSync(manifestPath, "utf8")))

  return (
    manifest.success &&
    manifest.data.fingerprint === fingerprint &&
    linksResolve(outDir, appDirectory) &&
    Object.entries(manifest.data.files).every(([file, hash]) => {
      const path = join(outDir, file)

      return existsSync(path) && hashFile(path) === hash
    })
  )
}

/** What the generated README says about each CSS mode. */
const cssSetup = {
  compiled: "Each component imports its own stylesheet, so there's no CSS to set up.",
  tailwind: `The components import no CSS. Import their theme, variants and sources after Tailwind in the app's stylesheet:\n\n\`\`\`css\n@import "tailwindcss";\n@import "${generatedName}/tailwind.css";\n\`\`\``
}

/** Writes `package.json`, the README and `manifest.json` into the compiled output. */
export function writePackageFiles(
  outDir: string,
  components: readonly ComponentModule[],
  shared: readonly SharedModule[],
  peers: Record<string, string>,
  identity: Omit<GeneratedManifest, "files">
) {
  const exportsMap = Object.fromEntries([
    [".", { types: "./index.d.ts", import: "./index.js" }],
    ...components.map((component) => [
      `./${component.name}`,
      { types: `./components/${component.name}/index.d.ts`, import: `./components/${component.name}/index.js` }
    ]),
    ...shared.map((module) => [
      `./${sharedSubpath(module)}`,
      { types: `./${sharedSubpath(module)}.d.ts`, import: `./${sharedSubpath(module)}.js` }
    ]),
    identity.settings.css === "compiled" ? ["./shared.css", "./shared.css"] : ["./tailwind.css", "./tailwind.css"],
    ["./package.json", "./package.json"]
  ])

  writeJsonFile(join(outDir, "package.json"), {
    name: generatedName,
    version: syncVersion,
    private: true,
    description: "shadcn components built for this app by shadcn-sync. Generated; don't edit.",
    type: "module",
    sideEffects: ["**/*.css"],
    exports: exportsMap,
    peerDependencies: peers
  })
  write(
    join(outDir, "README.md"),
    `# ${generatedName}\n\nGenerated by \`shadcn-sync sync\` from this app's \`shadcn-registry.json\`. Don't edit these files: sync replaces them on the next install.\n\nSettings: base ${identity.settings.base}, icons ${identity.settings.icons}, style ${identity.settings.style}, theme ${identity.settings.theme}, CSS ${identity.settings.css}.\n\n${cssSetup[identity.settings.css]}\n\nSome components need a provider near the root of the app: \`TooltipProvider\` for tooltips, and \`Toaster\` (or \`SonnerToaster\`) for toasts.\n`
  )

  const manifest: GeneratedManifest = { ...identity, files: hashFiles(outDir) }

  writeJsonFile(join(outDir, "manifest.json"), {
    generatorVersion: manifest.generatorVersion,
    settings: { ...manifest.settings },
    snapshot: manifest.snapshot,
    fingerprint: manifest.fingerprint,
    files: manifest.files
  })
}
