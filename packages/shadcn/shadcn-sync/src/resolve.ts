import { existsSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import * as z from "zod"
import { readJson } from "./json.js"

/** The parts of a package.json sync reads from installed packages. */
const manifestSchema = z.looseObject({
  name: z.string().optional(),
  version: z.string().optional(),
  style: z.string().optional(),
  main: z.string().optional(),
  module: z.string().optional(),
  exports: z.unknown().optional(),
  dependencies: z.record(z.string(), z.string()).optional(),
  peerDependencies: z.record(z.string(), z.string()).optional()
})

export type InstalledManifest = z.infer<typeof manifestSchema>

/** A bare import specifier split into its package name and subpath. */
export function packageName(specifier: string): string {
  const parts = specifier.split("/")

  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : (parts[0] ?? specifier)
}

/**
 * Finds a package's folder the way Node does, by walking up `node_modules` folders from `from`. It doesn't read the
 * package's `exports`, so it works for packages that don't export `package.json`.
 */
export function findPackage(name: string, from: string): string | undefined {
  let directory = resolve(from)

  for (;;) {
    const candidate = join(directory, "node_modules", name)

    if (existsSync(join(candidate, "package.json"))) {
      return candidate
    }

    const parent = dirname(directory)

    if (parent === directory) {
      return undefined
    }

    directory = parent
  }
}

export function readManifest(directory: string): InstalledManifest {
  return readJson(join(directory, "package.json"), manifestSchema)
}

const exportTarget: z.ZodType<string | ExportConditions | null> = z.lazy(() =>
  z.union([z.string(), z.null(), z.record(z.string(), exportTarget)])
)

interface ExportConditions {
  readonly [condition: string]: string | ExportConditions | null
}

function pickCondition(target: string | ExportConditions | null, conditions: readonly string[]): string | undefined {
  if (target === null) {
    return undefined
  }

  if (!(target instanceof Object)) {
    return target
  }

  for (const [condition, value] of Object.entries(target)) {
    if (conditions.includes(condition)) {
      const picked = pickCondition(value, conditions)

      if (picked) {
        return picked
      }
    }
  }

  return undefined
}

/** A subpath's entry in an `exports` field, which is either a subpath map or the root's conditions. */
function exportEntry(map: string | ExportConditions, subpath: string) {
  if (map instanceof Object && Object.keys(map).some((key) => key.startsWith("."))) {
    return map[subpath]
  }

  return subpath === "." ? map : undefined
}

/**
 * Resolves a bare specifier to a file through the package's `exports` with the given conditions. Sync uses it for CSS
 * (the `style` condition) and for importing icon adapters from the app rather than from sync itself.
 */
export function resolveFile(specifier: string, from: string, conditions: readonly string[]): string {
  const name = packageName(specifier)
  const directory = findPackage(name, from)

  if (!directory) {
    throw new Error(`Can't find ${name} from ${from}`)
  }

  const manifest = readManifest(directory)
  const subpath = specifier === name ? "." : `.${specifier.slice(name.length)}`
  const exportsField = exportTarget.safeParse(manifest.exports ?? null)

  if (exportsField.success && exportsField.data !== null) {
    const entry = exportEntry(exportsField.data, subpath)
    const target = entry === undefined ? undefined : pickCondition(entry, conditions)

    if (target) {
      return join(directory, target)
    }
  }

  if (subpath !== ".") {
    return join(directory, subpath)
  }

  const fallback = conditions.includes("style") ? manifest.style : (manifest.module ?? manifest.main)

  return join(directory, fallback ?? "index.js")
}
